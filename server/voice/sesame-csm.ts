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
  classifySesameError,
  fileUrlFromPredict,
  inferViaDeepInfra,
  inferViaFal,
  resolveSesameSpeaker,
  sesameDeepinfraKey,
  sesameErrorText,
  sesameFalKey,
  sesameHfToken,
  sesameSpaceId,
  unwrapPredictData,
} from "./sesame-payload";
import { recordSesameHostResult } from "./sesame-status";

const TIMEOUT_MS = 90_000;

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
  recordSesameHostResult(false, error);
  return { ok: false, status, contentType: "", error, voiceUsed, provider: "sesame" };
}

async function defaultConnect(space: string, opts: { token?: string }): Promise<GradioLike> {
  const token = opts.token;
  const clientOpts: Record<string, unknown> = {};
  if (token) {
    clientOpts.token = token;
    clientOpts.headers = { Authorization: `Bearer ${token}` };
  }
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
  if (audio && typeof audio === "object") {
    const meta = (audio as { meta?: { _type?: string } }).meta;
    if (meta?._type === "gradio.FileData") return audio;
  }
  const url = fileUrlFromPredict(audio);
  if (url) return handleFile(url);
  return audio;
}

async function verifyHfToken(token: string): Promise<"ok" | "unauthorized" | "unknown"> {
  try {
    const res = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return "ok";
    if (res.status === 401 || res.status === 403) return "unauthorized";
    return "unknown";
  } catch {
    return "unknown";
  }
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
    const falKey = sesameFalKey();
    const deepinfraKey = sesameDeepinfraKey();
    if (!token && !falKey && !deepinfraKey) {
      return {
        available: false,
        reachable: false,
        detail: "Set FAL_KEY (fal-ai/csm-1b) or DEEPINFRA_TOKEN — the public HF Space is not used",
      };
    }
    if (falKey) {
      return { available: true, reachable: true, detail: "Sesame CSM-1B via fal.ai (fal-ai/csm-1b)" };
    }
    if (deepinfraKey) {
      return { available: true, reachable: true, detail: "Sesame CSM-1B via DeepInfra" };
    }
    const auth = await verifyHfToken(token);
    if (auth === "unauthorized") {
      return { available: true, reachable: false, detail: "HF_TOKEN rejected" };
    }
    return { available: true, reachable: true, detail: "Sesame CSM-1B via Hugging Face → DeepInfra" };
  }

  async synthesize(req: VoiceSynthesizeRequest): Promise<VoiceSynthesizeResult> {
    const text = (req.text || "").trim();
    const { speakerA, speakerB } = resolveSesameSpeaker(req.voiceId);
    if (!text) return fail(400, "empty text", speakerA);

    const token = sesameHfToken();
    const falKey = sesameFalKey();
    const deepinfraKey = sesameDeepinfraKey();
    const liveGpuPath = this.deps.connect === defaultConnect;
    if (liveGpuPath && !token && !falKey && !deepinfraKey) {
      this.lastError = "FAL_KEY or DEEPINFRA_TOKEN not configured";
      return fail(503, "sesame-no-token", speakerA);
    }

    const succeed = (body: ArrayBuffer, contentType: string): VoiceSynthesizeResult => {
      this.lastError = null;
      recordSesameHostResult(true);
      return {
        ok: true,
        status: 200,
        contentType: contentType || "audio/wav",
        body,
        voiceUsed: speakerA,
        provider: "sesame",
      };
    };

    // Railway live path: paid GPU hosts only. Never open sesame/csm-1b ZeroGPU.
    if (liveGpuPath) {
      if (falKey) {
        const fal = await inferViaFal({
          text,
          speakerA,
          falKey,
          signal: req.signal,
        });
        if (fal.ok) return succeed(fal.body, fal.contentType);
        this.lastError = fal.error;
        console.warn("[sesame-csm] fal.ai CSM failed:", fal.error);
      }
      if (deepinfraKey || token) {
        if (token && !deepinfraKey && !falKey) {
          const auth = await verifyHfToken(token);
          if (auth === "unauthorized") {
            this.lastError = "Hugging Face rejected HF_TOKEN (401/403)";
            return fail(401, "sesame-unauthorized", speakerA);
          }
        }
        const deepinfra = await inferViaDeepInfra({
          text,
          speakerA,
          hfToken: token || undefined,
          deepinfraKey: deepinfraKey || undefined,
          signal: req.signal,
        });
        if (deepinfra.ok) return succeed(deepinfra.body, deepinfra.contentType);
        this.lastError = deepinfra.error;
        console.warn("[sesame-csm] DeepInfra CSM failed:", deepinfra.error);
      }
      if (!falKey && token) {
        const fal = await inferViaFal({
          text,
          speakerA,
          hfToken: token,
          signal: req.signal,
        });
        if (fal.ok) return succeed(fal.body, fal.contentType);
        this.lastError = fal.error;
        console.warn("[sesame-csm] HF→fal CSM failed:", fal.error);
      }
      return fail(502, classifySesameError(this.lastError || "sesame-failed").code, speakerA);
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
      this.lastError = sesameErrorText(err) || err?.message || "sesame-failed";
      console.error("[sesame-csm] synthesize failed:", this.lastError);
      const classified = aborted
        ? { code: "sesame-timeout", status: 504 }
        : classifySesameError(err);
      return fail(classified.status, classified.code, speakerA);
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener("abort", onAbort);
    }
  }
}

export function clearSesamePromptCache(): void {
  promptCache.clear();
}
