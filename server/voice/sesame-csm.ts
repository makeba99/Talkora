import { Client, handle_file } from "@gradio/client";
import {
  SESAME_INFER_API,
  SESAME_UPDATE_AUDIO_A,
  SESAME_UPDATE_AUDIO_B,
  SESAME_UPDATE_TEXT_A,
  SESAME_UPDATE_TEXT_B,
  type VoiceHealth,
  type VoiceProvider,
  type VoiceSynthesizeRequest,
  type VoiceSynthesizeResult,
} from "./types";
import {
  buildSesameInferPayload,
  fileUrlFromPredict,
  resolveSesameSpeaker,
  sesameHfToken,
  sesameSpaceId,
  unwrapPredictData,
} from "./sesame-payload";

const TIMEOUT_MS = 90_000;
const SKIP_AFTER_GPU_MS = 10 * 60 * 1000;

let skipSesameUntil = 0;

function markSesameUnavailable(ms = SKIP_AFTER_GPU_MS) {
  skipSesameUntil = Date.now() + ms;
}

type GradioLike = {
  predict: (endpoint: string, data?: unknown[] | Record<string, unknown>) => Promise<{ data: unknown }>;
};

export type SesameCsmDeps = {
  connect?: (space: string, opts: { token?: string }) => Promise<GradioLike>;
  handleFile?: (url: string) => unknown;
  fetchAudio?: (url: string, headers: Record<string, string>, signal?: AbortSignal) => Promise<{ ok: boolean; status: number; contentType: string; body: ArrayBuffer }>;
};

type PromptCache = {
  speaker: string;
  text: string;
  audio: unknown;
};

const promptCache = new Map<string, PromptCache>();

function fail(status: number, error: string, voiceUsed: string): VoiceSynthesizeResult {
  return { ok: false, status, contentType: "", error, voiceUsed, provider: "sesame" };
}

async function defaultConnect(space: string, opts: { token?: string }): Promise<GradioLike> {
  const token = opts.token;
  const clientOpts: Record<string, unknown> = {};
  if (token) clientOpts.token = token;
  return Client.connect(space, clientOpts as any);
}

async function defaultFetchAudio(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; contentType: string; body: ArrayBuffer }> {
  const res = await fetch(url, { headers, signal });
  const body = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get("content-type") || "audio/wav",
    body,
  };
}

async function loadSpeakerPrompt(
  client: GradioLike,
  speaker: string,
  side: "a" | "b",
): Promise<PromptCache> {
  const cached = promptCache.get(speaker);
  if (cached) return cached;

  const audioApi = side === "a" ? SESAME_UPDATE_AUDIO_A : SESAME_UPDATE_AUDIO_B;
  const textApi = side === "a" ? SESAME_UPDATE_TEXT_A : SESAME_UPDATE_TEXT_B;
  const [audioRes, textRes] = await Promise.all([
    client.predict(audioApi, { speaker }),
    client.predict(textApi, { speaker }),
  ]);
  const textVal = unwrapPredictData(textRes.data);
  const text = typeof textVal === "string" ? textVal : "";
  const entry: PromptCache = { speaker, text, audio: unwrapPredictData(audioRes.data) };
  promptCache.set(speaker, entry);
  return entry;
}

function wrapAudioPrompt(audio: unknown, handleFile: (url: string) => unknown): unknown {
  const url = fileUrlFromPredict(audio);
  if (url) return handleFile(url);
  return audio;
}

export class SesameCsmProvider implements VoiceProvider {
  id = "sesame";
  private deps: Required<Pick<SesameCsmDeps, "connect" | "handleFile" | "fetchAudio">>;
  lastError: string | null = null;

  constructor(deps: SesameCsmDeps = {}) {
    this.deps = {
      connect: deps.connect || defaultConnect,
      handleFile: deps.handleFile || handle_file,
      fetchAudio: deps.fetchAudio || defaultFetchAudio,
    };
  }

  async health(): Promise<VoiceHealth> {
    const token = sesameHfToken();
    if (!token) {
      return { available: false, reachable: false, detail: "HF_TOKEN not configured" };
    }
    try {
      const client = await this.deps.connect(sesameSpaceId(), { token });
      await client.predict(SESAME_UPDATE_TEXT_A, { speaker: "conversational_a" });
      this.lastError = null;
      return { available: true, reachable: true, detail: "Sesame CSM-1B Space reachable" };
    } catch (err: any) {
      this.lastError = err?.message || "sesame-unreachable";
      console.error("[sesame-csm] health failed:", this.lastError);
      return { available: true, reachable: false, detail: "Sesame CSM-1B Space unreachable" };
    }
  }

  async synthesize(req: VoiceSynthesizeRequest): Promise<VoiceSynthesizeResult> {
    const text = (req.text || "").trim();
    const { speakerA, speakerB } = resolveSesameSpeaker(req.voiceId);
    if (!text) return fail(400, "empty text", speakerA);

    const token = sesameHfToken();
    const usingLiveSpace = this.deps.connect === defaultConnect;
    // Unauthenticated ZeroGPU callers get ~180s quota; sesame/csm-1b requests
    // 180s up front, so /infer always fails without HF_TOKEN. Skip immediately
    // so in-room tutors fall back to Edge instead of hanging.
    if (usingLiveSpace && !token) {
      this.lastError = "HF_TOKEN not configured";
      return fail(503, "sesame-no-token", speakerA);
    }
    if (usingLiveSpace && Date.now() < skipSesameUntil) {
      this.lastError = "sesame temporarily skipped after GPU quota error";
      return fail(503, "sesame-skipped", speakerA);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = () => controller.abort();
    req.signal?.addEventListener("abort", onAbort);

    try {
      const client = await this.deps.connect(sesameSpaceId(), { token: token || undefined });
      const [promptA, promptB] = await Promise.all([
        loadSpeakerPrompt(client, speakerA, "a"),
        loadSpeakerPrompt(client, speakerB, "b"),
      ]);

      const payload = buildSesameInferPayload({
        textPromptA: promptA.text,
        textPromptB: promptB.text,
        audioPromptA: wrapAudioPrompt(promptA.audio, this.deps.handleFile),
        audioPromptB: wrapAudioPrompt(promptB.audio, this.deps.handleFile),
        utterance: text,
      });

      const combinedLen =
        payload.text_prompt_speaker_a.length +
        payload.text_prompt_speaker_b.length +
        payload.gen_conversation_input.length;
      if (combinedLen >= 2000) {
        return fail(400, "prompt too long", speakerA);
      }

      const infer = await client.predict(SESAME_INFER_API, {
        text_prompt_speaker_a: payload.text_prompt_speaker_a,
        text_prompt_speaker_b: payload.text_prompt_speaker_b,
        audio_prompt_speaker_a: payload.audio_prompt_speaker_a,
        audio_prompt_speaker_b: payload.audio_prompt_speaker_b,
        gen_conversation_input: payload.gen_conversation_input,
      });

      const url = fileUrlFromPredict(infer.data);
      if (!url) {
        this.lastError = "infer returned no audio url";
        console.error("[sesame-csm] missing audio url", typeof infer.data);
        return fail(502, "sesame-no-audio", speakerA);
      }

      const headers: Record<string, string> = { "User-Agent": "Vextorn/1.0 (+talking-partner)" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const audio = await this.deps.fetchAudio(url, headers, controller.signal);
      if (!audio.ok || !audio.body || audio.body.byteLength < 64) {
        this.lastError = `audio download ${audio.status}`;
        return fail(502, "sesame-audio-download-failed", speakerA);
      }

      this.lastError = null;
      return {
        ok: true,
        status: 200,
        contentType: audio.contentType || "audio/wav",
        body: audio.body,
        voiceUsed: speakerA,
        provider: "sesame",
      };
    } catch (err: any) {
      const aborted = err?.name === "AbortError" || controller.signal.aborted;
      this.lastError = err?.message || "sesame-failed";
      console.error("[sesame-csm] synthesize failed:", this.lastError);
      // Hosted sesame/csm-1b ZeroGPU often rejects with
      // "requested GPU duration (180s) is larger than the maximum allowed".
      const userSafe =
        /gpu duration/i.test(this.lastError)
          ? "sesame-gpu-quota"
          : aborted
            ? "sesame-timeout"
            : "sesame-failed";
      if (usingLiveSpace && (userSafe === "sesame-gpu-quota" || userSafe === "sesame-timeout")) {
        markSesameUnavailable();
      }
      return fail(aborted ? 504 : 502, userSafe, speakerA);
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener("abort", onAbort);
    }
  }
}

export function clearSesamePromptCache(): void {
  promptCache.clear();
  skipSesameUntil = 0;
}
