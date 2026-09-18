import { classifySesameError } from "./sesame-payload";
import { sesameDeepinfraKey, sesameFalKey, sesameHfToken } from "./sesame-payload";

export type SesameHostState = "ok" | "credits" | "unauthorized" | "no-key" | "error" | "idle";

export type SesameHostSnapshot = {
  state: SesameHostState;
  message: string;
  hasFalKey: boolean;
  hasDeepinfraKey: boolean;
  hasHfToken: boolean;
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  lastCode: string | null;
};

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
      "GPU credits ran out (HTTP 402). fal.ai and DeepInfra keys almost never expire — add billing, then Test Sesame Voice.",
    unauthorized:
      "GPU key was rejected. Create a new FAL_KEY or DEEPINFRA_TOKEN. Hugging Face fine-grained tokens can expire if you set an expiry date.",
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
    lastOkAt,
    lastErrorAt,
    lastError,
    lastCode,
  };
}
