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

describe("normalizeAiTutorConfig free Edge lock", () => {
  const prev = {
    provider: process.env.AI_VOICE_PROVIDER,
    fal: process.env.FAL_KEY,
    di: process.env.DEEPINFRA_TOKEN,
  };
  afterEach(() => {
    if (prev.provider === undefined) delete process.env.AI_VOICE_PROVIDER;
    else process.env.AI_VOICE_PROVIDER = prev.provider;
    if (prev.fal === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = prev.fal;
    if (prev.di === undefined) delete process.env.DEEPINFRA_TOKEN;
    else process.env.DEEPINFRA_TOKEN = prev.di;
  });

  it("uses free Edge neural when sesame is requested without a paid GPU key", () => {
    process.env.AI_VOICE_PROVIDER = "sesame";
    delete process.env.FAL_KEY;
    delete process.env.DEEPINFRA_TOKEN;
    delete process.env.AI_VOICE_FAL_KEY;
    delete process.env.DEEPINFRA_API_KEY;
    delete process.env.AI_VOICE_DEEPINFRA_TOKEN;
    const n = normalizeAiTutorConfig({
      ...staleBrowserConfig(),
      voice: {
        ...staleBrowserConfig().voice,
        provider: "sesame",
        femaleVoice: "conversational_a",
        maleVoice: "conversational_b",
      },
    });
    expect(n.voice.provider).toBe("edge");
    expect(n.voice.femaleVoice).toBe("en-US-AvaNeural");
    expect(n.voice.maleVoice).toBe("en-US-AndrewNeural");
  });

  it("keeps Sesame when FAL_KEY is set", () => {
    process.env.AI_VOICE_PROVIDER = "sesame";
    process.env.FAL_KEY = "fal_test";
    const n = normalizeAiTutorConfig(staleBrowserConfig());
    expect(n.voice.provider).toBe("sesame");
    expect(n.voice.femaleVoice).toBe("conversational_a");
  });
});
