/**
 * Centralized Brain + Voice provider managers with primary/secondary failover,
 * health cooldowns, usage tracking, and admin alerts.
 *
 * All AI Tutor chat/TTS runtime paths should go through these helpers —
 * do not re-implement failover in individual routes.
 */

import { storage } from "./storage";
import {
  getAiTutorConfig,
  sanitizeKey,
  resolveBrainEndpoint,
  resolveGroqModel,
  DEFAULT_GROQ_MODEL,
  type AiTutorConfig,
  type KeyHealth,
} from "./ai-config";
import { openAiSynthesize } from "./openai-tts";
import { edgeSynthesize, resolveEdgeVoiceId, isMalePersona } from "./edge-tts";

export type KeySlot = "primary" | "secondary";
export type ProviderKind = "brain" | "voice";

export type KeyUsageStats = {
  status: KeyHealth;
  requests: number;
  failures: number;
  rateLimitEvents: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  characters: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastError: string | null;
  cooldownUntil: number;
};

export type ProviderAlert = {
  id: string;
  kind: ProviderKind;
  severity: "warning" | "critical" | "error" | "failover" | "info";
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
};

type SlotState = KeyUsageStats;

const COOLDOWN_MS: Record<string, number> = {
  RATE_LIMITED: 60_000,
  QUOTA_EXHAUSTED: 15 * 60_000,
  INVALID: 30 * 60_000,
  EXPIRED: 30 * 60_000,
  ERROR: 45_000,
};

const ALERTS_KEY = "ai_tutor_alerts";
const USAGE_KEY = "ai_tutor_usage_v2";

const brainState: Record<KeySlot, SlotState> = {
  primary: emptyStats(),
  secondary: emptyStats(),
};
const voiceState: Record<KeySlot, SlotState> = {
  primary: emptyStats(),
  secondary: emptyStats(),
};

let alertsCache: ProviderAlert[] = [];
let alertsLoaded = false;
let usageLoaded = false;
let lastWarnEmit: Record<string, number> = {};

function emptyStats(): SlotState {
  return {
    status: "UNKNOWN",
    requests: 0,
    failures: 0,
    rateLimitEvents: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    characters: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,
    cooldownUntil: 0,
  };
}

async function ensureUsageLoaded() {
  if (usageLoaded) return;
  usageLoaded = true;
  try {
    const raw = await storage.getSetting(USAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.brain) {
      brainState.primary = { ...emptyStats(), ...parsed.brain.primary };
      brainState.secondary = { ...emptyStats(), ...parsed.brain.secondary };
    }
    if (parsed?.voice) {
      voiceState.primary = { ...emptyStats(), ...parsed.voice.primary };
      voiceState.secondary = { ...emptyStats(), ...parsed.voice.secondary };
    }
  } catch { /* ignore */ }
}

async function persistUsage() {
  try {
    await storage.setSetting(
      USAGE_KEY,
      JSON.stringify({
        brain: brainState,
        voice: voiceState,
        updatedAt: Date.now(),
      }),
    );
  } catch { /* non-fatal */ }
}

async function ensureAlertsLoaded() {
  if (alertsLoaded) return;
  alertsLoaded = true;
  try {
    const raw = await storage.getSetting(ALERTS_KEY);
    if (raw) alertsCache = JSON.parse(raw);
  } catch {
    alertsCache = [];
  }
}

async function persistAlerts() {
  try {
    // Keep last 50
    alertsCache = alertsCache.slice(0, 50);
    await storage.setSetting(ALERTS_KEY, JSON.stringify(alertsCache));
  } catch { /* non-fatal */ }
}

export async function pushAiAlert(alert: Omit<ProviderAlert, "id" | "createdAt" | "read">) {
  await ensureAlertsLoaded();
  const dedupeKey = `${alert.kind}:${alert.severity}:${alert.title}`;
  const now = Date.now();
  if ((lastWarnEmit[dedupeKey] || 0) > now - 5 * 60_000) return; // 5 min dedupe
  lastWarnEmit[dedupeKey] = now;
  const full: ProviderAlert = {
    ...alert,
    id: `ai-${now}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    read: false,
  };
  alertsCache.unshift(full);
  await persistAlerts();
  console.log(`[ai-provider] ALERT ${alert.severity.toUpperCase()} ${alert.kind}: ${alert.title}`);
}

export async function listAiAlerts(): Promise<ProviderAlert[]> {
  await ensureAlertsLoaded();
  return alertsCache;
}

export async function markAiAlertsRead(): Promise<void> {
  await ensureAlertsLoaded();
  alertsCache = alertsCache.map((a) => ({ ...a, read: true }));
  await persistAlerts();
}

function stateMap(kind: ProviderKind) {
  return kind === "brain" ? brainState : voiceState;
}

function getKey(cfg: AiTutorConfig, kind: ProviderKind, slot: KeySlot): string {
  if (kind === "brain") {
    return sanitizeKey(slot === "primary" ? cfg.brain.primaryKey : cfg.brain.secondaryKey);
  }
  return sanitizeKey(slot === "primary" ? cfg.voice.primaryKey : cfg.voice.secondaryKey);
}

function isUsable(st: SlotState): boolean {
  if (st.cooldownUntil && Date.now() < st.cooldownUntil) return false;
  if (st.status === "INVALID" || st.status === "EXPIRED" || st.status === "QUOTA_EXHAUSTED") {
    // Still blocked until cooldown ends
    if (st.cooldownUntil && Date.now() < st.cooldownUntil) return false;
  }
  return true;
}

export type ClassifiedError = {
  failover: boolean;
  status: KeyHealth;
  message: string;
};

export function classifyProviderError(status: number, bodyText = ""): ClassifiedError {
  const lower = (bodyText || "").toLowerCase();
  if (status === 401 || status === 403) {
    return { failover: true, status: "INVALID", message: "invalid or unauthorized API key" };
  }
  // OpenAI often returns HTTP 429 for both true rate limits AND insufficient quota.
  if (status === 429 || /rate.?limit|too many requests/i.test(lower)) {
    if (/insufficient_quota|quota|billing|exceeded your current quota|credit/i.test(lower)) {
      return { failover: true, status: "QUOTA_EXHAUSTED", message: "quota exhausted" };
    }
    return { failover: true, status: "RATE_LIMITED", message: "rate limited" };
  }
  if (status === 402 || /insufficient_quota|quota|billing|exceeded|credit/i.test(lower)) {
    return { failover: true, status: "QUOTA_EXHAUSTED", message: "quota exhausted" };
  }
  if ((status === 404 || status === 400) && /model.?not.?found|does not exist|invalid model/i.test(lower)) {
    return { failover: true, status: "ERROR", message: "model not found" };
  }
  if (status >= 500) {
    return { failover: true, status: "ERROR", message: `provider unavailable (${status})` };
  }
  if (status === 400) {
    // Invalid request / policy — don't burn secondary key
    return { failover: false, status: "ERROR", message: "invalid request" };
  }
  return { failover: status >= 500, status: "ERROR", message: `HTTP ${status}` };
}

/** Clear health/cooldown for a slot (keeps cumulative usage counters). */
export function resetSlotHealth(kind: ProviderKind, slot: KeySlot): void {
  const st = stateMap(kind)[slot];
  st.status = "UNKNOWN";
  st.cooldownUntil = 0;
  st.lastError = null;
  void persistUsage();
}

/**
 * When an admin replaces an API key, drop stale RATE_LIMITED / INVALID state
 * from the previous key so the new key is tried immediately.
 */
export async function resetHealthForChangedKeys(
  before: AiTutorConfig,
  after: AiTutorConfig,
): Promise<void> {
  await ensureUsageLoaded();
  const pairs: Array<{ kind: ProviderKind; slot: KeySlot; prev: string; next: string }> = [
    { kind: "brain", slot: "primary", prev: before.brain.primaryKey, next: after.brain.primaryKey },
    { kind: "brain", slot: "secondary", prev: before.brain.secondaryKey, next: after.brain.secondaryKey },
    { kind: "voice", slot: "primary", prev: before.voice.primaryKey, next: after.voice.primaryKey },
    { kind: "voice", slot: "secondary", prev: before.voice.secondaryKey, next: after.voice.secondaryKey },
  ];
  for (const p of pairs) {
    const a = sanitizeKey(p.prev);
    const b = sanitizeKey(p.next);
    if (a !== b) {
      resetSlotHealth(p.kind, p.slot);
      console.log(`[ai-provider] ${p.kind} ${p.slot} key changed — health reset`);
    }
  }
}

function markFailure(kind: ProviderKind, slot: KeySlot, health: KeyHealth, message: string) {
  const st = stateMap(kind)[slot];
  st.failures += 1;
  st.lastFailureAt = Date.now();
  st.lastError = message.slice(0, 200);
  st.status = health;
  if (health === "RATE_LIMITED") st.rateLimitEvents += 1;
  const cool = COOLDOWN_MS[health] || 45_000;
  st.cooldownUntil = Date.now() + cool;
  void persistUsage();
}

function markSuccess(kind: ProviderKind, slot: KeySlot, usage?: {
  inputTokens?: number;
  outputTokens?: number;
  characters?: number;
}) {
  const st = stateMap(kind)[slot];
  st.requests += 1;
  st.lastSuccessAt = Date.now();
  st.lastError = null;
  st.status = "HEALTHY";
  st.cooldownUntil = 0;
  if (usage?.inputTokens) {
    st.inputTokens += usage.inputTokens;
    st.totalTokens += usage.inputTokens;
  }
  if (usage?.outputTokens) {
    st.outputTokens += usage.outputTokens;
    st.totalTokens += usage.outputTokens;
  }
  if (usage?.characters) st.characters += usage.characters;
  void persistUsage();
}

async function maybeWarnThreshold(kind: ProviderKind, cfg: AiTutorConfig) {
  const threshold = kind === "brain" ? cfg.brain.warnThresholdPct : cfg.voice.warnThresholdPct;
  // Application-side soft thresholds (no provider quota API): warn at N requests
  // scaled to threshold — informational only, clearly labeled in UI.
  const softCap = kind === "brain" ? 10_000 : 500_000; // tokens vs characters soft estimate
  const used =
    kind === "brain"
      ? brainState.primary.totalTokens + brainState.secondary.totalTokens
      : voiceState.primary.characters + voiceState.secondary.characters;
  const pct = Math.round((used / softCap) * 100);
  if (pct >= threshold) {
    await pushAiAlert({
      kind,
      severity: "warning",
      title: `${kind === "brain" ? "Brain" : "Voice"} usage threshold`,
      message: `Application-tracked ${kind} usage reached ~${pct}% of the soft monitoring baseline (${threshold}% warn). Provider remaining quota is unavailable via API — this is app-side tracking only.`,
    });
  }
}

/**
 * Run an OpenAI-compatible chat completion with primary→secondary brain key failover.
 * Supports OpenAI and free Groq (auto-detected via gsk_ keys / provider setting).
 */
export async function generateAIResponse(opts: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
  baseUrl?: string;
}): Promise<{
  ok: boolean;
  status: number;
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  usedSlot: KeySlot | null;
  failover: boolean;
  error?: string;
  raw?: string;
}> {
  await ensureUsageLoaded();
  const cfg = await getAiTutorConfig();

  const order: KeySlot[] = ["primary", "secondary"];
  const configured = order.filter((slot) => !!getKey(cfg, "brain", slot));
  if (!configured.length) {
    return {
      ok: false,
      status: 503,
      content: "",
      model: cfg.brain.model,
      inputTokens: 0,
      outputTokens: 0,
      usedSlot: null,
      failover: false,
      error:
        "No brain API keys configured. Add a free Groq key (console.groq.com) or OpenAI key in Admin → AI Tutor.",
    };
  }

  // Prefer healthy keys; if all are cooling down, still try them (last resort)
  // so a new/recovered key is not stuck behind a stale RATE_LIMITED label.
  let attempts = configured.filter((slot) => isUsable(brainState[slot]));
  if (!attempts.length) {
    console.warn("[ai-provider] All brain keys on cooldown — retrying anyway");
    attempts = configured;
  }

  let failover = false;
  let lastError = "Brain provider unavailable";
  let lastModel = cfg.brain.model;

  for (const slot of attempts) {
    const key = getKey(cfg, "brain", slot);
    if (!key) continue;
    const endpoint = opts.baseUrl
      ? { baseUrl: opts.baseUrl, model: cfg.brain.model, provider: cfg.brain.provider }
      : resolveBrainEndpoint(key, cfg);
    lastModel = endpoint.model;

    try {
      const buildBody = (withJson: boolean) =>
        JSON.stringify({
          model: endpoint.model,
          messages: opts.messages,
          max_tokens: opts.maxTokens ?? 160,
          temperature: opts.temperature ?? 0.62,
          ...(withJson && opts.responseFormat
            ? { response_format: opts.responseFormat }
            : {}),
        });

      let r = await fetch(`${endpoint.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: buildBody(true),
      });
      let raw = await r.text();

      // Groq / some models reject JSON mode — retry once as plain text.
      if (
        !r.ok &&
        r.status === 400 &&
        opts.responseFormat &&
        endpoint.provider === "groq"
      ) {
        console.warn(`[ai-provider] Brain ${slot} JSON mode rejected — retrying plain text`);
        r = await fetch(`${endpoint.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: buildBody(false),
        });
        raw = await r.text();
      }

      if (!r.ok) {
        const classified = classifyProviderError(r.status, raw);
        // Model-not-found on Groq with a wrong/deprecated model → try current default once
        if (
          endpoint.provider === "groq" &&
          (r.status === 400 || r.status === 404) &&
          endpoint.model !== DEFAULT_GROQ_MODEL &&
          /model/i.test(raw)
        ) {
          console.warn(`[ai-provider] Brain ${slot} bad model ${endpoint.model} — retrying ${DEFAULT_GROQ_MODEL}`);
          const retry = await fetch(`${endpoint.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: resolveGroqModel(DEFAULT_GROQ_MODEL),
              messages: opts.messages,
              max_tokens: opts.maxTokens ?? 160,
              temperature: opts.temperature ?? 0.62,
            }),
          });
          const retryRaw = await retry.text();
          if (retry.ok) {
            r = retry;
            raw = retryRaw;
            lastModel = DEFAULT_GROQ_MODEL;
          } else {
            markFailure("brain", slot, classified.status, classified.message);
            lastError = classified.message;
            console.warn(`[ai-provider] Brain ${slot} (${endpoint.provider}) failed: ${classified.message}`);
            if (classified.failover && slot === "primary" && attempts.includes("secondary")) {
              failover = true;
              await pushAiAlert({
                kind: "brain",
                severity: "failover",
                title: "Brain failover activated",
                message: `Primary Brain key failed (${classified.message}). Trying Secondary Key.`,
              });
              continue;
            }
            if (!classified.failover) {
              return {
                ok: false,
                status: r.status,
                content: "",
                model: endpoint.model,
                inputTokens: 0,
                outputTokens: 0,
                usedSlot: slot,
                failover,
                error: classified.message,
                raw,
              };
            }
            continue;
          }
        } else if (!r.ok) {
          markFailure("brain", slot, classified.status, classified.message);
          lastError = classified.message;
          console.warn(`[ai-provider] Brain ${slot} (${endpoint.provider}) failed: ${classified.message}`);
          if (classified.failover && slot === "primary" && attempts.includes("secondary")) {
            failover = true;
            await pushAiAlert({
              kind: "brain",
              severity: "failover",
              title: "Brain failover activated",
              message: `Primary Brain key failed (${classified.message}). Trying Secondary Key.`,
            });
            continue;
          }
          if (!classified.failover) {
            return {
              ok: false,
              status: r.status,
              content: "",
              model: endpoint.model,
              inputTokens: 0,
              outputTokens: 0,
              usedSlot: slot,
              failover,
              error: classified.message,
              raw,
            };
          }
          continue;
        }
      }

      let content = "";
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        const json = JSON.parse(raw);
        content = json?.choices?.[0]?.message?.content || "";
        inputTokens = Number(json?.usage?.prompt_tokens || 0);
        outputTokens = Number(json?.usage?.completion_tokens || 0);
      } catch {
        content = raw;
      }

      markSuccess("brain", slot, { inputTokens, outputTokens });
      await maybeWarnThreshold("brain", cfg);
      if (failover) {
        await pushAiAlert({
          kind: "brain",
          severity: "info",
          title: "Brain secondary key succeeded",
          message: "Secondary Brain key completed the request after primary failure.",
        });
      }
      return {
        ok: true,
        status: 200,
        content,
        model: endpoint.model,
        inputTokens,
        outputTokens,
        usedSlot: slot,
        failover,
        raw,
      };
    } catch (err: any) {
      markFailure("brain", slot, "ERROR", err?.message || "network error");
      lastError = err?.message || "network error";
      console.warn(`[ai-provider] Brain ${slot} exception: ${lastError}`);
      if (slot === "primary" && attempts.includes("secondary")) {
        failover = true;
        continue;
      }
    }
  }

  await pushAiAlert({
    kind: "brain",
    severity: "critical",
    title: "Brain keys unavailable",
    message: lastError,
  });

  return {
    ok: false,
    status: 503,
    content: "",
    model: lastModel,
    inputTokens: 0,
    outputTokens: 0,
    usedSlot: null,
    failover,
    error: lastError,
  };
}

/**
 * Generate speech — Edge (free neural), OpenAI TTS (paid), or browser (client).
 */
export async function generateSpeech(opts: {
  text: string;
  /** "Female" | "Male" | "Eva" etc — maps to configured female/male voices */
  personaVoice?: string;
  voiceId?: string | null;
}): Promise<{
  ok: boolean;
  status: number;
  contentType: string;
  body?: ArrayBuffer;
  error?: string;
  usedSlot: KeySlot | null;
  failover: boolean;
  voiceUsed: string;
}> {
  await ensureUsageLoaded();
  const cfg = await getAiTutorConfig();
  // CRITICAL: do not use /male/i — it matches inside "Female".
  const isMale = isMalePersona(opts.personaVoice);
  // Server admin config is authoritative for gender → voice mapping.
  const configured = isMale ? cfg.voice.maleVoice : cfg.voice.femaleVoice;
  const clientVid = typeof opts.voiceId === "string" ? opts.voiceId.trim() : "";
  // Only accept client voiceId when it matches the persona's configured gender voice.
  let voiceName =
    clientVid && clientVid === configured
      ? clientVid
      : configured;
  const model = cfg.voice.model || "tts-1-hd";
  const text = opts.text.trim();
  if (!text) {
    return { ok: false, status: 400, contentType: "", error: "empty text", usedSlot: null, failover: false, voiceUsed: voiceName };
  }

  if (cfg.voice.provider === "browser") {
    return {
      ok: false,
      status: 501,
      contentType: "",
      error: "browser-tts",
      usedSlot: null,
      failover: false,
      voiceUsed: voiceName,
    };
  }

  // ── Free Microsoft Edge neural voices (no API key) ─────────────────────
  if (cfg.voice.provider === "edge") {
    voiceName = resolveEdgeVoiceId(configured, isMale ? "male" : "female");
    const result = await edgeSynthesize(text, voiceName);
    if (result.ok && result.body) {
      markSuccess("voice", "primary", { characters: text.length });
      await maybeWarnThreshold("voice", cfg);
      return {
        ok: true,
        status: 200,
        contentType: result.contentType || "audio/mpeg",
        body: result.body,
        usedSlot: "primary",
        failover: false,
        voiceUsed: voiceName,
      };
    }
    markFailure("voice", "primary", "ERROR", result.error || "edge-tts-failed");
    return {
      ok: false,
      status: 502,
      contentType: "",
      error: result.error || "edge-tts-failed",
      usedSlot: "primary",
      failover: false,
      voiceUsed: voiceName,
    };
  }

  const order: KeySlot[] = ["primary", "secondary"];
  const configuredSlots = order.filter((slot) => !!getKey(cfg, "voice", slot));
  if (!configuredSlots.length) {
    // No OpenAI keys — fall through to Edge free path automatically
    voiceName = resolveEdgeVoiceId(configured, isMale ? "male" : "female");
    const edge = await edgeSynthesize(text, voiceName);
    if (edge.ok && edge.body) {
      return {
        ok: true,
        status: 200,
        contentType: edge.contentType || "audio/mpeg",
        body: edge.body,
        usedSlot: null,
        failover: true,
        voiceUsed: voiceName,
      };
    }
    return {
      ok: false,
      status: 501,
      contentType: "",
      error: "browser-tts",
      usedSlot: null,
      failover: false,
      voiceUsed: voiceName,
    };
  }

  let attempts = configuredSlots.filter((slot) => isUsable(voiceState[slot]));
  if (!attempts.length) attempts = configuredSlots;

  let failover = false;
  let lastError = "No voice API keys configured";

  for (const slot of attempts) {
    const key = getKey(cfg, "voice", slot);
    if (!key) continue;

    const result = await openAiSynthesize(text, voiceName, model, key);
    if (!result.ok) {
      const classified = classifyProviderError(result.status, result.error || "");
      markFailure("voice", slot, classified.status, classified.message);
      lastError = classified.message;
      console.warn(`[ai-provider] Voice ${slot} failed: ${classified.message}`);
      if (classified.failover && slot === "primary" && attempts.includes("secondary")) {
        failover = true;
        await pushAiAlert({
          kind: "voice",
          severity: "failover",
          title: "Voice failover activated",
          message: `Primary Voice key failed (${classified.message}). Trying Secondary Key.`,
        });
        continue;
      }
      if (!classified.failover) {
        return {
          ok: false,
          status: result.status,
          contentType: "",
          error: classified.message,
          usedSlot: slot,
          failover,
          voiceUsed: voiceName,
        };
      }
      continue;
    }

    markSuccess("voice", slot, { characters: text.length });
    await maybeWarnThreshold("voice", cfg);
    if (failover) {
      await pushAiAlert({
        kind: "voice",
        severity: "info",
        title: "Voice secondary key succeeded",
        message: "Secondary Voice key completed TTS after primary failure.",
      });
    }
    return {
      ok: true,
      status: 200,
      contentType: result.contentType || "audio/mpeg",
      body: result.body,
      usedSlot: slot,
      failover,
      voiceUsed: voiceName,
    };
  }

  // Last resort: free Edge neural TTS when OpenAI keys are exhausted
  voiceName = resolveEdgeVoiceId(configured, isMale ? "male" : "female");
  const edgeFallback = await edgeSynthesize(text, voiceName);
  if (edgeFallback.ok && edgeFallback.body) {
    console.warn("[ai-provider] OpenAI voice failed — using free Edge neural TTS");
    await pushAiAlert({
      kind: "voice",
      severity: "failover",
      title: "Voice Edge fallback activated",
      message: "OpenAI voice keys failed. Using free Microsoft Edge neural TTS.",
    });
    return {
      ok: true,
      status: 200,
      contentType: edgeFallback.contentType || "audio/mpeg",
      body: edgeFallback.body,
      usedSlot: null,
      failover: true,
      voiceUsed: voiceName,
    };
  }

  await pushAiAlert({
    kind: "voice",
    severity: "critical",
    title: "Voice keys unavailable",
    message: lastError,
  });

  return {
    ok: false,
    status: 503,
    contentType: "",
    error: lastError,
    usedSlot: null,
    failover,
    voiceUsed: voiceName,
  };
}

/** Lightweight live test for a specific slot (admin Test buttons). */
export async function testBrainKey(slot: KeySlot, overrideKey?: string): Promise<{
  ok: boolean;
  message: string;
  status: KeyHealth;
}> {
  await ensureUsageLoaded();
  const cfg = await getAiTutorConfig();
  const stored = getKey(cfg, "brain", slot);
  const key = sanitizeKey(overrideKey) || stored;
  if (!key) return { ok: false, message: "No API key configured", status: "UNKNOWN" };

  // Probe of an unsaved replacement key must not poison the stored slot's health.
  const probeOnly = !!sanitizeKey(overrideKey) && sanitizeKey(overrideKey) !== stored;
  // Admin is explicitly testing — clear stale cooldown from a previous key.
  if (!probeOnly) {
    brainState[slot].cooldownUntil = 0;
  }

  try {
    const endpoint = resolveBrainEndpoint(key, cfg);
    const r = await fetch(`${endpoint.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (r.ok) {
      if (!probeOnly) {
        markSuccess("brain", slot);
        brainState[slot].status = "HEALTHY";
      }
      return { ok: true, message: `Connection successful (${endpoint.provider})`, status: "HEALTHY" };
    }
    const classified = classifyProviderError(r.status, await r.text().catch(() => ""));
    if (!probeOnly) markFailure("brain", slot, classified.status, classified.message);
    const msg =
      classified.status === "INVALID" ? "Invalid API key" :
      classified.status === "QUOTA_EXHAUSTED" ? "Quota exceeded (billing/credits)" :
      classified.status === "RATE_LIMITED" ? "Rate limited — wait a minute and retry" :
      "Provider unavailable";
    return { ok: false, message: msg, status: classified.status };
  } catch (err: any) {
    if (!probeOnly) markFailure("brain", slot, "ERROR", err?.message || "network");
    return { ok: false, message: "Provider unavailable", status: "ERROR" };
  }
}

export async function testVoiceKey(slot: KeySlot, overrideKey?: string): Promise<{
  ok: boolean;
  message: string;
  status: KeyHealth;
  audio?: ArrayBuffer;
  contentType?: string;
}> {
  await ensureUsageLoaded();
  const cfg = await getAiTutorConfig();

  // Free Edge neural TTS — no API key required
  if (cfg.voice.provider === "edge" || (!sanitizeKey(overrideKey) && !getKey(cfg, "voice", slot) && cfg.voice.provider !== "openai")) {
    const voice = resolveEdgeVoiceId(cfg.voice.femaleVoice, "female");
    const result = await edgeSynthesize(
      "Hello. This is a Vextorn free neural voice test.",
      voice,
    );
    if (result.ok && result.body) {
      markSuccess("voice", slot, { characters: 48 });
      return {
        ok: true,
        message: "Connection successful (Edge neural — free)",
        status: "HEALTHY",
        audio: result.body,
        contentType: result.contentType,
      };
    }
    return { ok: false, message: result.error || "Edge TTS unavailable", status: "ERROR" };
  }

  if (cfg.voice.provider === "browser") {
    return { ok: true, message: "Browser voice (no cloud test needed)", status: "HEALTHY" };
  }

  const stored = getKey(cfg, "voice", slot);
  const key = sanitizeKey(overrideKey) || stored;
  if (!key) return { ok: false, message: "No API key configured", status: "UNKNOWN" };

  const probeOnly = !!sanitizeKey(overrideKey) && sanitizeKey(overrideKey) !== stored;
  if (!probeOnly) {
    voiceState[slot].cooldownUntil = 0;
  }

  const result = await openAiSynthesize(
    "Hello. This is a Vextorn voice configuration test.",
    cfg.voice.femaleVoice || "nova",
    cfg.voice.model || "tts-1",
    key,
  );
  if (result.ok && result.body) {
    if (!probeOnly) markSuccess("voice", slot, { characters: 48 });
    return { ok: true, message: "Connection successful", status: "HEALTHY", audio: result.body, contentType: result.contentType };
  }
  const classified = classifyProviderError(result.status, result.error || "");
  if (!probeOnly) markFailure("voice", slot, classified.status, classified.message);
  const msg =
    classified.status === "INVALID" ? "Invalid API key" :
    classified.status === "QUOTA_EXHAUSTED" ? "Quota exceeded (OpenAI billing/credits)" :
    classified.status === "RATE_LIMITED" ? "Rate limited — wait a minute and retry" :
    "Provider unavailable";
  return { ok: false, message: msg, status: classified.status };
}

export async function getProviderStatusSnapshot() {
  await ensureUsageLoaded();
  const cfg = await getAiTutorConfig();
  return {
    brain: {
      provider: cfg.brain.provider,
      model: cfg.brain.model,
      warnThresholdPct: cfg.brain.warnThresholdPct,
      primary: { ...brainState.primary },
      secondary: { ...brainState.secondary },
      usageLabel: "Usage tracked by application",
      quotaNote: "Provider remaining quota unavailable",
    },
    voice: {
      provider: cfg.voice.provider,
      model: cfg.voice.model,
      femaleVoice: cfg.voice.femaleVoice,
      maleVoice: cfg.voice.maleVoice,
      warnThresholdPct: cfg.voice.warnThresholdPct,
      primary: { ...voiceState.primary },
      secondary: { ...voiceState.secondary },
      usageLabel: "Usage tracked by application",
      quotaNote: "Provider remaining quota unavailable",
    },
  };
}

/** Ordered usable keys for streaming paths (respects cooldown). */
export async function listUsableProviderKeys(
  kind: ProviderKind,
): Promise<Array<{ slot: KeySlot; key: string }>> {
  await ensureUsageLoaded();
  const cfg = await getAiTutorConfig();
  const out: Array<{ slot: KeySlot; key: string }> = [];
  for (const slot of ["primary", "secondary"] as KeySlot[]) {
    const key = getKey(cfg, kind, slot);
    if (!key) continue;
    if (!isUsable(stateMap(kind)[slot])) continue;
    out.push({ slot, key });
  }
  // If every key is cooling down, still return them so a last-resort attempt
  // can happen after cooldowns (caller may try all configured keys).
  if (!out.length) {
    for (const slot of ["primary", "secondary"] as KeySlot[]) {
      const key = getKey(cfg, kind, slot);
      if (key) out.push({ slot, key });
    }
  }
  return out;
}
