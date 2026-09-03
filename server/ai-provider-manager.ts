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
  type AiTutorConfig,
  type KeyHealth,
} from "./ai-config";
import { openAiSynthesize } from "./openai-tts";

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
  if (status === 429) {
    return { failover: true, status: "RATE_LIMITED", message: "rate limited" };
  }
  if (status === 402 || /quota|billing|insufficient|exceeded|credit/i.test(lower)) {
    return { failover: true, status: "QUOTA_EXHAUSTED", message: "quota exhausted" };
  }
  if (status === 404 && /model/i.test(lower)) {
    return { failover: false, status: "ERROR", message: "model not found" };
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
 * Run an OpenAI chat completion with primary→secondary brain key failover.
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
  const baseUrl = opts.baseUrl || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = cfg.brain.model || "gpt-4o";

  const order: KeySlot[] = ["primary", "secondary"];
  let failover = false;
  let lastError = "No brain API keys configured";

  for (const slot of order) {
    const key = getKey(cfg, "brain", slot);
    if (!key) continue;
    const st = brainState[slot];
    if (!isUsable(st) && slot === "primary") {
      // try secondary
      continue;
    }
    if (!isUsable(st) && slot === "secondary") continue;

    try {
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          max_tokens: opts.maxTokens ?? 160,
          temperature: opts.temperature ?? 0.62,
          ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
        }),
      });
      const raw = await r.text();
      if (!r.ok) {
        const classified = classifyProviderError(r.status, raw);
        markFailure("brain", slot, classified.status, classified.message);
        lastError = classified.message;
        console.warn(`[ai-provider] Brain ${slot} failed: ${classified.message}`);
        if (classified.failover && slot === "primary") {
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
            model,
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
        model,
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
      if (slot === "primary") {
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
    model,
    inputTokens: 0,
    outputTokens: 0,
    usedSlot: null,
    failover,
    error: lastError,
  };
}

/**
 * Generate speech with primary→secondary voice key failover (OpenAI TTS).
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
  const isMale = /male|dude|miles/i.test(String(opts.personaVoice || ""));
  const configured = isMale ? cfg.voice.maleVoice : cfg.voice.femaleVoice;
  // Prefer admin-configured voices. Accept a client voiceId only if it matches
  // one of the two admin-selected OpenAI voice names (never secrets).
  const clientVid = typeof opts.voiceId === "string" ? opts.voiceId.trim() : "";
  const voiceName =
    clientVid &&
    (clientVid === cfg.voice.femaleVoice || clientVid === cfg.voice.maleVoice)
      ? clientVid
      : configured;
  const model = cfg.voice.model || "tts-1-hd";
  const text = opts.text.trim();
  if (!text) {
    return { ok: false, status: 400, contentType: "", error: "empty text", usedSlot: null, failover: false, voiceUsed: voiceName };
  }

  const order: KeySlot[] = ["primary", "secondary"];
  let failover = false;
  let lastError = "No voice API keys configured";

  for (const slot of order) {
    const key = getKey(cfg, "voice", slot);
    if (!key) continue;
    if (!isUsable(voiceState[slot]) && slot === "primary") continue;
    if (!isUsable(voiceState[slot]) && slot === "secondary") continue;

    const result = await openAiSynthesize(text, voiceName, model, key);
    if (!result.ok) {
      const classified = classifyProviderError(result.status, result.error || "");
      markFailure("voice", slot, classified.status, classified.message);
      lastError = classified.message;
      console.warn(`[ai-provider] Voice ${slot} failed: ${classified.message}`);
      if (classified.failover && slot === "primary") {
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
  const key = sanitizeKey(overrideKey) || getKey(cfg, "brain", slot);
  if (!key) return { ok: false, message: "No API key configured", status: "UNKNOWN" };

  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (r.ok) {
      markSuccess("brain", slot);
      brainState[slot].status = "HEALTHY";
      return { ok: true, message: "Connection successful", status: "HEALTHY" };
    }
    const classified = classifyProviderError(r.status, await r.text().catch(() => ""));
    markFailure("brain", slot, classified.status, classified.message);
    const msg =
      classified.status === "INVALID" ? "Invalid API key" :
      classified.status === "QUOTA_EXHAUSTED" ? "Quota exceeded" :
      classified.status === "RATE_LIMITED" ? "Rate limited" :
      "Provider unavailable";
    return { ok: false, message: msg, status: classified.status };
  } catch (err: any) {
    markFailure("brain", slot, "ERROR", err?.message || "network");
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
  const key = sanitizeKey(overrideKey) || getKey(cfg, "voice", slot);
  if (!key) return { ok: false, message: "No API key configured", status: "UNKNOWN" };

  const result = await openAiSynthesize(
    "Hello. This is a Vextorn voice configuration test.",
    cfg.voice.femaleVoice || "nova",
    cfg.voice.model || "tts-1",
    key,
  );
  if (result.ok && result.body) {
    markSuccess("voice", slot, { characters: 48 });
    return { ok: true, message: "Connection successful", status: "HEALTHY", audio: result.body, contentType: result.contentType };
  }
  const classified = classifyProviderError(result.status, result.error || "");
  markFailure("voice", slot, classified.status, classified.message);
  const msg =
    classified.status === "INVALID" ? "Invalid API key" :
    classified.status === "QUOTA_EXHAUSTED" ? "Quota exceeded" :
    classified.status === "RATE_LIMITED" ? "Rate limited" :
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
