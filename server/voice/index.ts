import { SesameCsmProvider } from "./sesame-csm";
import type { VoiceProvider } from "./types";

let sesameSingleton: SesameCsmProvider | null = null;

export function getSesameProvider(): SesameCsmProvider {
  if (!sesameSingleton) sesameSingleton = new SesameCsmProvider();
  return sesameSingleton;
}

export function getVoiceProvider(id: string): VoiceProvider | null {
  if (id === "sesame") return getSesameProvider();
  return null;
}

export type { VoiceProvider, VoiceSynthesizeRequest, VoiceSynthesizeResult } from "./types";
export { SesameCsmProvider } from "./sesame-csm";
export { getSesameHostSnapshot, sesameHostAlertFromSnapshot } from "./sesame-status";
export {
  buildSesameInferPayload,
  resolveSesameSpeaker,
  conversationForAiUtterance,
} from "./sesame-payload";
