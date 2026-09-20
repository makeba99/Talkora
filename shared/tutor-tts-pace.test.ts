import { describe, expect, it } from "vitest";
import { TUTOR_TTS_PLAYBACK_RATE, TUTOR_TTS_SPEED, tutorTtsSpeed } from "./tutor-tts-pace";

describe("tutor tts pace", () => {
  it("keeps Miles and Maya on the same slow playback rate", () => {
    expect(TUTOR_TTS_PLAYBACK_RATE).toBe(TUTOR_TTS_SPEED);
    expect(tutorTtsSpeed(1.24)).toBe(TUTOR_TTS_SPEED);
    expect(tutorTtsSpeed(1.18)).toBe(TUTOR_TTS_SPEED);
    expect(tutorTtsSpeed(0.9)).toBe(0.9);
  });
});
