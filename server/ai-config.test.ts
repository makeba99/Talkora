import { afterEach, describe, expect, it } from "vitest";
import { normalizeAiTutorConfig, type AiTutorConfig } from "./ai-config";

function staleBrowserConfig(): AiTutorConfig {
  return {
    version: 2,
    brain: {
      provider: "groq",
      primaryKey: "gsk_test",
      secondaryKey: "",
      model: "llama-3.3-70b-versatile",
      warnThresholdPct: 80,
    },
    voice: {
      provider: "browser",
      primaryKey: "",
      secondaryKey: "",
      femaleVoice: "en-US-AvaNeural",
      maleVoice: "en-US-AndrewNeural",
      model: "tts-1-hd",
      warnThresholdPct: 80,
    },
  };
}

describe("normalizeAiTutorConfig sesame lock", () => {
  const prevProvider = process.env.AI_VOICE_PROVIDER;
  afterEach(() => {
    if (prevProvider === undefined) delete process.env.AI_VOICE_PROVIDER;
    else process.env.AI_VOICE_PROVIDER = prevProvider;
  });

  it("Railway AI_VOICE_PROVIDER=sesame overrides a stale browser row and Edge voice ids", () => {
    process.env.AI_VOICE_PROVIDER = "sesame";
    const n = normalizeAiTutorConfig(staleBrowserConfig());
    expect(n.voice.provider).toBe("sesame");
    expect(n.voice.femaleVoice).toBe("conversational_a");
    expect(n.voice.maleVoice).toBe("conversational_b");
  });
});
