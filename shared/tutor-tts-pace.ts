/** Shared Maya/Miles speaking pace — unhurried, same for both tutors. */
export const TUTOR_TTS_SPEED = 0.92;
export const TUTOR_TTS_PLAYBACK_RATE = 0.92;
export const TUTOR_EDGE_RATE = "-12%";

export function tutorTtsSpeed(requested?: number): number {
  const s = Number.isFinite(requested) ? Number(requested) : TUTOR_TTS_SPEED;
  return Math.min(0.94, Math.max(0.86, s > 1 ? TUTOR_TTS_SPEED : s));
}
