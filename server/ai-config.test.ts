import { afterEach, describe, expect, it } from "vitest";
import { effectiveVoiceProvider, normalizeAiTutorConfig, type AiTutorConfig } from "./ai-config";

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

describe("normalizeAiTutorConfig admin Sesame save", () => {
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
    delete process.env.AI_VOICE_FAL_KEY;
    delete process.env.DEEPINFRA_API_KEY;
    delete process.env.AI_VOICE_DEEPINFRA_TOKEN;
  });

  it("keeps Sesame + speaker ids when admin saves without a paid GPU key", () => {
    delete process.env.AI_VOICE_PROVIDER;
    delete process.env.FAL_KEY;
    delete process.env.DEEPINFRA_TOKEN;
    const n = normalizeAiTutorConfig({
      ...staleBrowserConfig(),
      voice: {
        ...staleBrowserConfig().voice,
        provider: "sesame",
        femaleVoice: "read_speech_a",
        maleVoice: "read_speech_b",
      },
    });
    expect(n.voice.provider).toBe("sesame");
    expect(n.voice.femaleVoice).toBe("read_speech_a");
    expect(n.voice.maleVoice).toBe("read_speech_b");
    expect(effectiveVoiceProvider(n)).toBe("edge");
  });

  it("does not let AI_VOICE_PROVIDER=edge overwrite a saved Sesame row", () => {
    process.env.AI_VOICE_PROVIDER = "edge";
    process.env.FAL_KEY = "fal_test";
    const n = normalizeAiTutorConfig({
      ...staleBrowserConfig(),
      voice: {
        ...staleBrowserConfig().voice,
        provider: "sesame",
        femaleVoice: "conversational_a",
        maleVoice: "conversational_b",
      },
    });
    expect(n.voice.provider).toBe("sesame");
    expect(n.voice.femaleVoice).toBe("conversational_a");
    expect(effectiveVoiceProvider(n)).toBe("sesame");
  });

  it("keeps Sesame when FAL_KEY is set", () => {
    process.env.AI_VOICE_PROVIDER = "sesame";
    process.env.FAL_KEY = "fal_test";
    const n = normalizeAiTutorConfig(staleBrowserConfig());
    expect(n.voice.provider).toBe("browser");
  });
});
