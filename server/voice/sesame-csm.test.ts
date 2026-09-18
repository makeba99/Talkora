import { afterEach, describe, expect, it } from "vitest";
import {
  buildSesameInferPayload,
  classifySesameError,
  conversationForAiUtterance,
  fileUrlFromPredict,
  parseGradioCallStream,
  resolveSesameSpeaker,
  sanitizeHfToken,
  sesameUserMessage,
} from "./sesame-payload";
import { SESAME_INFER_API } from "./types";
import { clearSesamePromptCache, SesameCsmProvider } from "./sesame-csm";

afterEach(() => {
  clearSesamePromptCache();
});

describe("sesame payload", () => {
  it("maps Maya/Miles onto official /infer fields and a single utterance", () => {
    const maya = resolveSesameSpeaker("maya");
    expect(maya.speakerA).toBe("conversational_a");
    expect(maya.speakerB).toBe("conversational_b");
    const miles = resolveSesameSpeaker("miles");
    expect(miles.speakerA).toBe("conversational_b");

    const payload = buildSesameInferPayload({
      textPromptA: "prompt a",
      textPromptB: "prompt b",
      audioPromptA: { url: "https://example.com/a.wav" },
      audioPromptB: { url: "https://example.com/b.wav" },
      utterance: "Nice! What did you like most about Paris?",
    });

    expect(payload.api_name).toBe(SESAME_INFER_API);
    expect(payload.gen_conversation_input).toBe("Nice! What did you like most about Paris?");
    expect(payload.gen_conversation_input.includes("\n")).toBe(false);
    expect(payload.text_prompt_speaker_a).toBe("prompt a");
    expect(payload.text_prompt_speaker_b).toBe("prompt b");
  });

  it("collapses whitespace and caps utterance length", () => {
    expect(conversationForAiUtterance("  hello\nthere  ")).toBe("hello there");
  });

  it("reads Gradio FileData urls", () => {
    expect(fileUrlFromPredict([{ url: "https://space.example/file.wav" }])).toBe(
      "https://space.example/file.wav",
    );
  });
});

describe("SesameCsmProvider", () => {
  it("calls /infer with the five official parameters and returns audio bytes", async () => {
    const calls: Array<{ endpoint: string; data: any }> = [];
    const provider = new SesameCsmProvider({
      connect: async () => ({
        predict: async (endpoint, data) => {
          calls.push({ endpoint, data });
          if (endpoint === "/update_text" || endpoint === "/update_text_1") {
            return { data: "speaker text" };
          }
          if (endpoint === "/update_audio" || endpoint === "/update_audio_1") {
            return { data: { url: "https://example.com/prompt.wav", path: "prompt.wav" } };
          }
          if (endpoint === "/infer") {
            return { data: { url: "https://example.com/out.wav" } };
          }
          throw new Error(`unexpected ${endpoint}`);
        },
      }),
      handleFile: (url) => ({ handled: url }),
      fetchAudio: async (url) => {
        expect(url).toBe("https://example.com/out.wav");
        return { ok: true, status: 200, contentType: "audio/wav", body: new ArrayBuffer(128) };
      },
    });

    const result = await provider.synthesize({ text: "Hello from Maya", voiceId: "maya" });
    expect(result.ok).toBe(true);
    expect(result.body?.byteLength).toBe(128);
    const infer = calls.find((c) => c.endpoint === "/infer");
    expect(infer?.data.text_prompt_speaker_a).toBe("speaker text");
    expect(infer?.data.gen_conversation_input).toBe("Hello from Maya");
    expect(infer?.data.audio_prompt_speaker_a).toEqual({ handled: "https://example.com/prompt.wav" });
  });

  it("skips the live Space immediately when HF_TOKEN is missing", async () => {
    const prev = process.env.HF_TOKEN;
    delete process.env.HF_TOKEN;
    delete process.env.AI_VOICE_HF_TOKEN;
    delete process.env.HUGGINGFACE_TOKEN;
    delete process.env.HUGGING_FACE_HUB_TOKEN;
    delete process.env.HUGGINGFACEHUB_API_TOKEN;
    const provider = new SesameCsmProvider();
    const result = await provider.synthesize({ text: "Hello", voiceId: "maya" });
    if (prev) process.env.HF_TOKEN = prev;
    expect(result.ok).toBe(false);
    expect(result.error).toBe("sesame-no-token");
  });

  it("fails closed when Gradio throws so callers can fall back", async () => {
    const provider = new SesameCsmProvider({
      connect: async () => {
        throw new Error("space unavailable");
      },
    });
    const result = await provider.synthesize({ text: "Hello", voiceId: "maya" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
  });

  it("maps hosted ZeroGPU duration errors to a stable code", async () => {
    const provider = new SesameCsmProvider({
      connect: async () => ({
        predict: async () => {
          throw new Error("The requested GPU duration (180s) is larger than the maximum allowed");
        },
      }),
    });
    const result = await provider.synthesize({ text: "Hello", voiceId: "maya" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("sesame-gpu-quota");
  });

  it("maps ZeroGPU title-only errors (no 'gpu duration' substring)", async () => {
    const provider = new SesameCsmProvider({
      connect: async () => ({
        predict: async () => {
          const err = new Error("") as Error & { title?: string };
          err.title = "ZeroGPU illegal duration";
          throw err;
        },
      }),
    });
    const result = await provider.synthesize({ text: "Hello", voiceId: "maya" });
    expect(result.error).toBe("sesame-gpu-quota");
  });

  it("passes Gradio FileData prompts through without re-wrapping", async () => {
    const fileA = {
      path: "/tmp/gradio/a.wav",
      url: "https://sesame-csm-1b.hf.space/gradio_api/file=/tmp/gradio/a.wav",
      meta: { _type: "gradio.FileData" },
    };
    let inferAudio: unknown;
    const provider = new SesameCsmProvider({
      connect: async () => ({
        predict: async (endpoint, data) => {
          if (endpoint === "/update_text" || endpoint === "/update_text_1") {
            return { data: "speaker text" };
          }
          if (endpoint === "/update_audio" || endpoint === "/update_audio_1") {
            return { data: fileA };
          }
          if (endpoint === "/infer") {
            inferAudio = (data as { audio_prompt_speaker_a: unknown }).audio_prompt_speaker_a;
            return { data: { url: "https://example.com/out.wav" } };
          }
          throw new Error(`unexpected ${endpoint}`);
        },
      }),
      handleFile: () => ({ wrapped: true }),
      fetchAudio: async () => ({
        ok: true,
        status: 200,
        contentType: "audio/wav",
        body: new ArrayBuffer(128),
      }),
    });
    const result = await provider.synthesize({ text: "Hello", voiceId: "maya" });
    expect(result.ok).toBe(true);
    expect(inferAudio).toEqual(fileA);
  });
});

describe("sesame token and error helpers", () => {
  it("strips Bearer and quotes from HF tokens", () => {
    expect(sanitizeHfToken('Bearer hf_abc')).toBe("hf_abc");
    expect(sanitizeHfToken('"hf_abc"')).toBe("hf_abc");
  });

  it("classifies ZeroGPU title as gpu quota", () => {
    expect(classifySesameError({ title: "ZeroGPU illegal duration" }).code).toBe("sesame-gpu-quota");
  });

  it("explains gpu quota in admin copy", () => {
    expect(sesameUserMessage("sesame-gpu-quota")).toMatch(/180s/);
  });

  it("parses Gradio call SSE complete and empty error", () => {
    const ok = parseGradioCallStream(
      'event: complete\ndata: [{"url":"https://example.com/out.wav"}]\n\n',
    );
    expect(fileUrlFromPredict(ok.data)).toBe("https://example.com/out.wav");
    const err = parseGradioCallStream("event: error\ndata: null\n\n");
    expect(err.error).toMatch(/GPU duration/);
  });
});
