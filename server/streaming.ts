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

function buildFfmpegArgs(twitchKey?: string, youtubeKey?: string): string[] {
  // Input: fragmented WebM piped from browser MediaRecorder.
  // -analyzeduration 0 -probesize 32  → skip probing (we know the format), start fast
  // -fflags +discardcorrupt+genpts+nobuffer+flush_packets
  //   discardcorrupt → survive malformed packets from network hiccups
  //   genpts         → generate missing PTS (MediaRecorder chunks may omit them)
  //   nobuffer+flush_packets → minimize latency
  // -flags low_delay → low-latency throughout the pipeline
  const inputArgs = [
    "-analyzeduration", "0",
    "-probesize", "32",
    "-fflags", "+discardcorrupt+genpts+nobuffer+flush_packets",
    "-flags", "low_delay",
    "-f", "webm",
    "-i", "pipe:0",
  ];
  const videoArgs = [
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-profile:v", "baseline",  // widest YouTube compatibility
    "-level", "3.1",
    "-b:v", "2500k",
    "-maxrate", "2500k",
    "-bufsize", "5000k",
    "-pix_fmt", "yuv420p",
    "-g", "60",               // 2-second keyframe interval at 30fps (YouTube requirement)
    "-keyint_min", "60",
    "-sc_threshold", "0",     // disable scene-change keyframes (keeps GOP stable)
  ];
  const audioArgs = [
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",               // stereo
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
}): { ok: boolean; error?: string } {
  const { streamId, userId, roomId, twitchKey, youtubeKey, twitchUsername, youtubeChannelId } = opts;
  if (!twitchKey && !youtubeKey) return { ok: false, error: "At least one stream key required" };
  if (activeSessions.has(streamId)) return { ok: false, error: "Stream already active" };
  if (!checkFfmpeg()) return { ok: false, error: "FFmpeg is not installed on this server. Streaming is unavailable." };

  const args = buildFfmpegArgs(twitchKey, youtubeKey);
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
