/** Shared Maya/Miles speaking pace — unhurried, same for both tutors. */
export const TUTOR_TTS_SPEED = 0.92;
export const TUTOR_TTS_PLAYBACK_RATE = 0.92;
export const TUTOR_EDGE_RATE = "-12%";
export const SESAME_NATIVE_PLAYBACK_RATE = 1;

export function tutorTtsSpeed(requested?: number): number {
  const s = Number.isFinite(requested) ? Number(requested) : TUTOR_TTS_SPEED;
  return Math.min(0.94, Math.max(0.86, s > 1 ? TUTOR_TTS_SPEED : s));
}

/** CSM wav is already human-paced. Time-stretching it makes it less like Sesame. */
export function tutorPlaybackRate(contentType: string, audio?: ArrayBuffer): number {
  if (/wav/i.test(contentType)) return SESAME_NATIVE_PLAYBACK_RATE;
  if (audio && audio.byteLength >= 4) {
    const b = new Uint8Array(audio);
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
      return SESAME_NATIVE_PLAYBACK_RATE;
    }
  }
  return TUTOR_TTS_PLAYBACK_RATE;
}
