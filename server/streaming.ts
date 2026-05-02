import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

interface StreamSession {
  proc: ChildProcessWithoutNullStreams;
  twitchKey?: string;
  youtubeKey?: string;
  userId: string;
  roomId: string;
  startedAt: Date;
  bytesWritten: number;
}

const activeSessions = new Map<string, StreamSession>();

function buildFfmpegArgs(twitchKey?: string, youtubeKey?: string): string[] {
  const videoArgs = [
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-b:v", "2500k",
    "-maxrate", "2500k",
    "-bufsize", "5000k",
    "-pix_fmt", "yuv420p",
    "-g", "60",
    "-keyint_min", "60",
  ];
  const audioArgs = [
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
  ];

  const outputs: string[] = [];
  if (twitchKey) outputs.push(`[f=flv]rtmp://live.twitch.tv/live/${twitchKey}`);
  if (youtubeKey) outputs.push(`[f=flv]rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`);

  if (outputs.length === 2) {
    return [
      "-f", "webm",
      "-i", "pipe:0",
      ...videoArgs,
      ...audioArgs,
      "-f", "tee",
      outputs.join("|"),
    ];
  }

  const rtmpUrl = twitchKey
    ? `rtmp://live.twitch.tv/live/${twitchKey}`
    : `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`;

  return [
    "-f", "webm",
    "-i", "pipe:0",
    ...videoArgs,
    ...audioArgs,
    "-f", "flv",
    rtmpUrl,
  ];
}

export function startStream(opts: {
  streamId: string;
  userId: string;
  roomId: string;
  twitchKey?: string;
  youtubeKey?: string;
}): { ok: boolean; error?: string } {
  const { streamId, userId, roomId, twitchKey, youtubeKey } = opts;
  if (!twitchKey && !youtubeKey) return { ok: false, error: "At least one stream key required" };
  if (activeSessions.has(streamId)) return { ok: false, error: "Stream already active" };

  const args = buildFfmpegArgs(twitchKey, youtubeKey);

  let proc: ChildProcessWithoutNullStreams;
  try {
    proc = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });
  } catch (e: any) {
    return { ok: false, error: `Failed to start FFmpeg: ${e.message}` };
  }

  proc.stderr.on("data", (d) => {
    // FFmpeg logs to stderr — useful for debugging but not surfaced to client
    process.stdout.write(`[stream:${streamId}] ${d}`);
  });

  proc.on("exit", (code) => {
    console.log(`[stream:${streamId}] FFmpeg exited with code ${code}`);
    activeSessions.delete(streamId);
  });

  activeSessions.set(streamId, {
    proc,
    twitchKey,
    youtubeKey,
    userId,
    roomId,
    startedAt: new Date(),
    bytesWritten: 0,
  });

  return { ok: true };
}

export function writeChunk(streamId: string, chunk: Buffer): boolean {
  const session = activeSessions.get(streamId);
  if (!session) return false;
  try {
    session.proc.stdin.write(chunk);
    session.bytesWritten += chunk.length;
    return true;
  } catch {
    return false;
  }
}

export function stopStream(streamId: string): boolean {
  const session = activeSessions.get(streamId);
  if (!session) return false;
  try {
    session.proc.stdin.end();
    setTimeout(() => {
      if (!session.proc.killed) session.proc.kill("SIGTERM");
    }, 2000);
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
    platforms: [s.twitchKey ? "twitch" : null, s.youtubeKey ? "youtube" : null].filter(Boolean),
  };
}

export function stopAllStreamsForUser(userId: string) {
  const toStop: string[] = [];
  activeSessions.forEach((session, id) => {
    if (session.userId === userId) toStop.push(id);
  });
  toStop.forEach(id => stopStream(id));
}
