import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { execFileSync } from "child_process";

interface StreamSession {
  proc: ChildProcessWithoutNullStreams;
  twitchKey?: string;
  youtubeKey?: string;
  twitchUsername?: string;
  youtubeChannelId?: string;
  userId: string;
  roomId: string;
  startedAt: Date;
  bytesWritten: number;
  exitCode: number | null;
  exitError: string | null;
  alive: boolean;
}

// Check FFmpeg is available once at startup
let ffmpegAvailable: boolean | null = null;
function checkFfmpeg(): boolean {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  try { execFileSync("ffmpeg", ["-version"], { timeout: 3000 }); ffmpegAvailable = true; }
  catch { ffmpegAvailable = false; }
  return ffmpegAvailable;
}

const activeSessions = new Map<string, StreamSession>();

// ── Twitch App Access Token cache ────────────────────────────────────────────
let twitchToken: string | null = null;
let twitchTokenExpiry = 0;

async function getTwitchToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: "POST" }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    twitchToken = data.access_token ?? null;
    twitchTokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000;
    return twitchToken;
  } catch {
    return null;
  }
}

async function fetchTwitchViewers(username: string): Promise<number | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return null;
  const token = await getTwitchToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,
      { headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const stream = data.data?.[0];
    return stream ? (stream.viewer_count ?? 0) : 0;
  } catch {
    return null;
  }
}

async function fetchYoutubeViewers(channelId: string): Promise<number | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;
  try {
    // Step 1: find the active live video for this channel
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${encodeURIComponent(channelId)}&eventType=live&type=video&key=${apiKey}`
    );
    if (!searchRes.ok) return null;
    const searchData: any = await searchRes.json();
    const videoId = searchData.items?.[0]?.id?.videoId;
    if (!videoId) return 0;
    // Step 2: get concurrent viewer count
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`
    );
    if (!videoRes.ok) return null;
    const videoData: any = await videoRes.json();
    const viewers = videoData.items?.[0]?.liveStreamingDetails?.concurrentViewers;
    return viewers != null ? parseInt(viewers, 10) : 0;
  } catch {
    return null;
  }
}

export async function getViewerCounts(streamId: string): Promise<{
  twitch: number | null;
  youtube: number | null;
  twitchAvailable: boolean;
  youtubeAvailable: boolean;
}> {
  const s = activeSessions.get(streamId);
  const twitchAvailable = !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
  const youtubeAvailable = !!process.env.YOUTUBE_API_KEY;

  if (!s) return { twitch: null, youtube: null, twitchAvailable, youtubeAvailable };

  const [twitch, youtube] = await Promise.all([
    s.twitchUsername ? fetchTwitchViewers(s.twitchUsername) : Promise.resolve(null),
    s.youtubeChannelId ? fetchYoutubeViewers(s.youtubeChannelId) : Promise.resolve(null),
  ]);

  return { twitch, youtube, twitchAvailable, youtubeAvailable };
}

// ── FFmpeg ───────────────────────────────────────────────────────────────────

export type StreamQuality = "480p" | "720p" | "1080p";

interface QualityPreset {
  videoBitrate: string;
  maxrate: string;
  bufsize: string;
  scaleFilter: string | null;
}

const QUALITY_PRESETS: Record<StreamQuality, QualityPreset> = {
  "480p":  { videoBitrate: "1500k", maxrate: "2500k",  bufsize: "4000k",  scaleFilter: "scale=854:480:flags=lanczos"   },
  "720p":  { videoBitrate: "3000k", maxrate: "4500k",  bufsize: "6000k",  scaleFilter: "scale=1280:720:flags=lanczos"  },
  "1080p": { videoBitrate: "5000k", maxrate: "7000k",  bufsize: "10000k", scaleFilter: null                             },
};

function buildFfmpegArgs(twitchKey?: string, youtubeKey?: string, quality: StreamQuality = "720p"): string[] {
  // Input: fragmented WebM piped from browser MediaRecorder (250 ms timeslice).
  // -analyzeduration 2000000 -probesize 1048576  → enough to parse WebM codec headers
  //   reliably without perceptible latency (the 250 ms timeslice means the first
  //   chunk arrives quickly, so probing is cheap).
  // -fflags +discardcorrupt+genpts+nobuffer+flush_packets
  //   discardcorrupt → survive malformed packets from network hiccups
  //   genpts         → generate missing PTS (MediaRecorder chunks may omit them)
  //   nobuffer+flush_packets → minimize end-to-end latency
  // -thread_queue_size 512 → prevent input starvation when the OS scheduler
  //   delays the read thread (common on throttled Replit containers).
  const inputArgs = [
    "-analyzeduration", "2000000",
    "-probesize", "1048576",
    "-fflags", "+discardcorrupt+genpts+nobuffer+flush_packets",
    "-thread_queue_size", "512",
    "-f", "webm",
    "-i", "pipe:0",
  ];
  const preset = QUALITY_PRESETS[quality];
  // H.264 Main profile @ level 4.2 across all quality tiers:
  //   - Main profile gives ~10-15 % better quality than Baseline at the same
  //     bitrate (CABAC entropy coding), and YouTube accepts it on all devices.
  //   - Level 4.2 supports up to 1080p60, removing the 720p@10 Mbps cap that
  //     Baseline/3.1 imposed.
  // Bitrates come from the quality preset selected by the user:
  //   480p → 1500k / 2500k / 4000k   (slow connections / mobile)
  //   720p → 3000k / 4500k / 6000k   (balanced default)
  //   1080p→ 5000k / 7000k / 10000k  (fast fibre / cable)
  // -preset faster: one step above veryfast — ~8 % better SSIM with only ~15 %
  //   more CPU, well within budget for a 1080p30 encode.
  // -x264opts: locks GOP to exactly 2 seconds (keyint=60 at 30 fps) with no
  //   scene-cut keyframes, which is required for stable YouTube RTMP ingest.
  const videoArgs = [
    "-c:v", "libx264",
    "-preset", "faster",
    "-tune", "zerolatency",
    "-profile:v", "main",
    "-level", "4.2",
    ...(preset.scaleFilter ? ["-vf", preset.scaleFilter] : []),
    "-b:v", preset.videoBitrate,
    "-maxrate", preset.maxrate,
    "-bufsize", preset.bufsize,
    "-pix_fmt", "yuv420p",
    "-g", "60",
    "-keyint_min", "60",
    "-sc_threshold", "0",
    "-x264opts", "keyint=60:min-keyint=60:no-scenecut",
  ];
  // AAC 160 kbps stereo — YouTube recommends ≥ 128 kbps; 160 kbps gives
  // noticeably cleaner voice audio at minimal extra bandwidth cost.
  const audioArgs = [
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "44100",
    "-ac", "2",
  ];

  const outputs: string[] = [];
  if (twitchKey) outputs.push(`[f=flv]rtmp://live.twitch.tv/live/${twitchKey}`);
  if (youtubeKey) outputs.push(`[f=flv]rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`);

  if (outputs.length === 2) {
    return [...inputArgs, ...videoArgs, ...audioArgs, "-f", "tee", outputs.join("|")];
  }

  const rtmpUrl = twitchKey
    ? `rtmp://live.twitch.tv/live/${twitchKey}`
    : `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`;

  return [...inputArgs, ...videoArgs, ...audioArgs, "-f", "flv", rtmpUrl];
}

export function startStream(opts: {
  streamId: string;
  userId: string;
  roomId: string;
  twitchKey?: string;
  youtubeKey?: string;
  twitchUsername?: string;
  youtubeChannelId?: string;
  quality?: StreamQuality;
}): { ok: boolean; error?: string } {
  const { streamId, userId, roomId, twitchKey, youtubeKey, twitchUsername, youtubeChannelId, quality = "720p" } = opts;
  if (!twitchKey && !youtubeKey) return { ok: false, error: "At least one stream key required" };
  if (activeSessions.has(streamId)) return { ok: false, error: "Stream already active" };
  if (!checkFfmpeg()) return { ok: false, error: "FFmpeg is not installed on this server. Streaming is unavailable." };

  const args = buildFfmpegArgs(twitchKey, youtubeKey, quality);
  let proc: ChildProcessWithoutNullStreams;
  try {
    proc = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });
  } catch (e: any) {
    return { ok: false, error: `Failed to start FFmpeg: ${e.message}` };
  }

  // Guard stdin against EPIPE (FFmpeg exited while we're still writing)
  proc.stdin.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE" && err.code !== "ERR_STREAM_DESTROYED") {
      console.error(`[stream:${streamId}] stdin error:`, err.code);
    }
  });

  // Collect last 2 KB of stderr to surface meaningful error messages
  let stderrTail = "";
  proc.stderr.on("data", (d: Buffer) => {
    const chunk = d.toString();
    process.stdout.write(`[stream:${streamId}] ${chunk}`);
    stderrTail = (stderrTail + chunk).slice(-2048);
  });

  const session: StreamSession = {
    proc, twitchKey, youtubeKey, twitchUsername, youtubeChannelId,
    userId, roomId, startedAt: new Date(), bytesWritten: 0,
    exitCode: null, exitError: null, alive: true,
  };

  proc.on("exit", (code) => {
    session.alive = false;
    session.exitCode = code;
    // Surface a meaningful error if FFmpeg exited non-zero
    if (code !== 0) {
      const rtmpErr = stderrTail.match(/rtmp.*?(error|failed|refused|denied|invalid)[^\n]*/i)?.[0]
        ?? stderrTail.match(/error[^\n]*/i)?.[0]
        ?? null;
      session.exitError = rtmpErr
        ? rtmpErr.slice(0, 200)
        : code === 1
          ? "Stream rejected — check your stream key and try again."
          : `FFmpeg exited with code ${code}.`;
    }
    console.log(`[stream:${streamId}] FFmpeg exited with code ${code}`);
    // Keep the dead session for 60 s so the client can read the error
    setTimeout(() => activeSessions.delete(streamId), 60_000);
  });

  activeSessions.set(streamId, session);
  return { ok: true };
}

export function writeChunk(streamId: string, chunk: Buffer): "ok" | "dead" | "notfound" {
  const session = activeSessions.get(streamId);
  if (!session) return "notfound";
  if (!session.alive) return "dead";
  try {
    const ok = session.proc.stdin.write(chunk);
    session.bytesWritten += chunk.length;
    // If write returns false the buffer is full — drain before continuing.
    // We don't await it here (fire-and-forget) since the next chunk will either
    // succeed or back-pressure the client via 503.
    if (!ok) session.proc.stdin.once("drain", () => {});
    return "ok";
  } catch { return "dead"; }
}

export function stopStream(streamId: string): boolean {
  const session = activeSessions.get(streamId);
  if (!session) return false;
  try {
    session.proc.stdin.end();
    setTimeout(() => { if (!session.proc.killed) session.proc.kill("SIGTERM"); }, 2000);
  } catch {}
  activeSessions.delete(streamId);
  return true;
}

export function getStreamInfo(streamId: string) {
  const s = activeSessions.get(streamId);
  if (!s) return null;
  return {
    streamId,
    userId: s.userId,
    roomId: s.roomId,
    startedAt: s.startedAt,
    bytesWritten: s.bytesWritten,
    twitchUsername: s.twitchUsername,
    youtubeChannelId: s.youtubeChannelId,
    platforms: [s.twitchKey ? "twitch" : null, s.youtubeKey ? "youtube" : null].filter(Boolean),
    alive: s.alive,
    exitCode: s.exitCode,
    exitError: s.exitError,
  };
}

export function stopAllStreamsForUser(userId: string) {
  const toStop: string[] = [];
  activeSessions.forEach((session, id) => { if (session.userId === userId) toStop.push(id); });
  toStop.forEach(id => stopStream(id));
}
