import { classifySesameError } from "./sesame-payload";
import { sesameDeepinfraKey, sesameFalKey, sesameHfToken } from "./sesame-payload";

export type SesameHostState = "ok" | "credits" | "unauthorized" | "no-key" | "error" | "idle";

export type SesameHostSnapshot = {
  state: SesameHostState;
  message: string;
  hasFalKey: boolean;
  hasDeepinfraKey: boolean;
  hasHfToken: boolean;
  /** True when both paid GPU keys are set so one host can fail without silencing rooms. */
  durableKeys: boolean;
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  lastCode: string | null;
  guidance: string[];
};

export const SESAME_NEVER_EXPIRE_GUIDANCE = [
  "FAL_KEY and DEEPINFRA_TOKEN are account API keys — they do not expire by calendar date.",
  "Set both keys so fal.ai and DeepInfra can fail over. Rooms still speak Edge if both GPU hosts fail.",
  "Turn on auto top-up / a payment method on fal.ai and DeepInfra so HTTP 402 (no credits) never hits.",
  "Do not use Hugging Face fine-grained tokens with an expiry date. Skip HF_TOKEN for live CSM.",
] as const;

let lastOkAt: number | null = null;
let lastErrorAt: number | null = null;
let lastError: string | null = null;
let lastCode: string | null = null;

export function recordSesameHostResult(ok: boolean, error?: string | null) {
  if (ok) {
    lastOkAt = Date.now();
    lastError = null;
    lastCode = null;
    return;
  }
  lastErrorAt = Date.now();
  lastError = (error || "sesame-failed").slice(0, 280);
  lastCode = classifySesameError(lastError).code;
}

export function resetSesameHostSnapshotForTests() {
  lastOkAt = null;
  lastErrorAt = null;
  lastError = null;
  lastCode = null;
}

export function getSesameHostSnapshot(): SesameHostSnapshot {
  const hasFalKey = !!sesameFalKey();
  const hasDeepinfraKey = !!sesameDeepinfraKey();
  const hasHfToken = !!sesameHfToken();
  const hasGpu = hasFalKey || hasDeepinfraKey;
  let state: SesameHostState = "idle";
  if (!hasGpu && !hasHfToken) state = "no-key";
  else if (lastCode === "sesame-credits") state = "credits";
  else if (lastCode === "sesame-unauthorized") state = "unauthorized";
  else if (lastOkAt && (!lastErrorAt || lastOkAt >= lastErrorAt)) state = "ok";
  else if (lastError) state = "error";

  const when = lastOkAt ? new Date(lastOkAt).toISOString() : null;
  const messages: Record<SesameHostState, string> = {
    "no-key": "No FAL_KEY or DEEPINFRA_TOKEN. Rooms use free Edge. GPU keys do not expire by date — they stop when credits run out.",
    idle: "No Sesame call yet this process. Click Test Sesame Voice after a GPU key is set.",
    ok: when
      ? `Sesame GPU last succeeded at ${when}. Keys stay valid until fal.ai / DeepInfra credits run out.`
      : "Sesame GPU is healthy.",
    credits:
      "GPU credits ran out (HTTP 402). fal.ai and DeepInfra keys almost never expire — add billing / auto top-up, then Test Sesame Voice.",
    unauthorized:
      "GPU key was rejected (rotated or invalid). Create a new FAL_KEY and DEEPINFRA_TOKEN with no expiry date. Hugging Face fine-grained tokens can expire if you set a date — do not use them.",
    error: lastError
      ? `Last Sesame error: ${lastError}. If this repeats, check fal.ai / DeepInfra billing.`
      : "Last Sesame call failed.",
  };

  return {
    state,
    message: messages[state],
    hasFalKey,
    hasDeepinfraKey,
    hasHfToken,
    durableKeys: hasFalKey && hasDeepinfraKey,
    lastOkAt,
    lastErrorAt,
    lastError,
    lastCode,
    guidance: [...SESAME_NEVER_EXPIRE_GUIDANCE],
  };
}

export function sesameHostAlertFromSnapshot(snap: SesameHostSnapshot): {
  kind: "voice";
  severity: "critical" | "warning";
  title: string;
  message: string;
} | null {
  if (snap.state === "credits") {
    return {
      kind: "voice",
      severity: "critical",
      title: "Sesame GPU credits ran out",
      message:
        "FAL_KEY and DEEPINFRA_TOKEN did not expire. Add billing or auto top-up at fal.ai and DeepInfra. Rooms keep speaking with Edge until credits return.",
    };
  }
  if (snap.state === "unauthorized") {
    return {
      kind: "voice",
      severity: "critical",
      title: "Sesame GPU key rejected",
      message:
        "Create a new FAL_KEY and DEEPINFRA_TOKEN (account keys have no expiry). Do not use Hugging Face fine-grained tokens with an expiry date.",
    };
  }
  return null;
}
