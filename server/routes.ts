import type { Express } from "express";
import { type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { insertRoomSchema, insertMessageSchema, insertFollowSchema, insertBlockSchema, insertReportSchema, insertUserCommentSchema, insertBadgeApplicationSchema, insertAnnouncementSchema, BADGE_TYPES } from "@shared/schema";
import type { User } from "@shared/schema";
import { z } from "zod";
import multer, { type StorageEngine } from "multer";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import { externalCache } from "./cache";
import { securityBus, logSecurityEvent, authRateLimiter, apiRateLimiter, uploadRateLimiter, threatDetectionMiddleware, privilegeCheckMiddleware } from "./security";
import { setCleanupContext } from "./cleanup";

const onlineUsers = new Set<string>();
const roomParticipants = new Map<string, Map<string, User>>();
const roomVideoStatus = new Map<string, Set<string>>();
const roomScreenShareStatus = new Map<string, string | null>();
const roomYoutubeState = new Map<string, { videoId: string; startedBy: string }>();
const roomBookState = new Map<string, { book: any; hostId: string; scrollPct: number; watchers: Set<string> }>();
const roomRoles = new Map<string, Map<string, string>>();
const roomMuteStatus = new Map<string, Map<string, boolean>>();
const userSockets = new Map<string, string>();
const userCurrentRoom = new Map<string, string>();
const roomDeleteTimers = new Map<string, NodeJS.Timeout>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();
const roomMessageReactions = new Map<string, Map<string, Set<string>>>();
// AI Tutor room state: one active session per room
const roomAiTutorState = new Map<string, { userId: string; username: string; speaking: boolean; avatarId?: string | null; voice?: "Female" | "Male" | null; voiceId?: string | null } | null>();
const roomAiTutorEnabled = new Map<string, boolean>(); // host can disable

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const legacyAssetPattern = /^\/((?:avatar|image|hologram|announcement|welcome)[-_][A-Za-z0-9_.-]+\.(?:png|jpe?g|gif|webp|mp4|webm|mov|ogg))$/i;

function normalizeProfileImageUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:|\/uploads\/)/i.test(trimmed)) return trimmed;
  const filename = path.basename(trimmed);
  if (!/\.(png|jpe?g|gif|webp)$/i.test(filename)) return trimmed.startsWith("/") ? trimmed : `/${filename}`;
  if (fs.existsSync(path.join(uploadsDir, filename))) return `/uploads/${filename}`;
  return trimmed.startsWith("/") ? trimmed : `/${filename}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function roomPublicPayload(room: any, includeAccessKey = false) {
  if (!room) return room;
  return includeAccessKey ? room : { ...room, accessKey: null };
}

function canManageRoomLink(user: User | undefined | null, room: any) {
  return !!user && (
    user.id === room.ownerId ||
    user.role === "admin" ||
    user.role === "superadmin" ||
    user.email === "dj55jggg@gmail.com"
  );
}

const uploadStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

const videoStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `hologram-${Date.now()}${ext}`);
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /mp4|webm|mov|ogg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeAllowed = /video\/(mp4|webm|quicktime|ogg)/.test(file.mimetype);
    cb(null, ext || mimeAllowed);
  },
});

const announcementMediaStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `announcement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const uploadAnnouncementMedia = multer({
  storage: announcementMediaStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(jpe?g|png|gif|webp)$/i.test(file.originalname);
    const allowedMime = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(null, allowedExt && allowedMime);
  },
});

const welcomeMediaStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `welcome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const uploadWelcomeMedia = multer({
  storage: welcomeMediaStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(jpe?g|png|gif|webp)$/i.test(file.originalname);
    const allowedMime = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(null, allowedExt && allowedMime);
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    allowUpgrades: true,
  });

  app.use("/api", apiRateLimiter);
  app.use("/api/auth", authRateLimiter);
  app.use("/api", threatDetectionMiddleware);
  app.use("/api", privilegeCheckMiddleware);

  securityBus.on("security:event", async (event) => {
    try {
      const adminUsers = await storage.getAllUsers();
      const admins = adminUsers.filter(
        (u) => u.role === "admin" || u.role === "superadmin" || u.email === "dj55jggg@gmail.com"
      );
      for (const admin of admins) {
        const socketId = userSockets.get(admin.id);
        if (socketId) {
          io.to(socketId).emit("security:admin_alert", {
            id: event.id,
            eventType: event.eventType,
            severity: event.severity,
            description: event.description,
            requestPath: event.requestPath,
            createdAt: event.createdAt,
          });
        }
      }
    } catch {}
  });

  app.use("/uploads", (_req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    next();
  });
  const expressStatic = (await import("express")).default.static;
  app.use("/uploads", expressStatic(uploadsDir));

  app.get(legacyAssetPattern, (req, res, next) => {
    const filename = req.params[0];
    const filePath = path.join(process.cwd(), filename);
    if (!filePath.startsWith(process.cwd() + path.sep) || !fs.existsSync(filePath)) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath);
  });

  app.get("/api/rooms/participants", async (_req, res) => {
    try {
      const allParticipants: Record<string, User[]> = {};
      for (const [roomId, participants] of Array.from(roomParticipants.entries())) {
        allParticipants[roomId] = Array.from(participants.values());
      }
      res.json(allParticipants);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const mapping: Record<string, string> = {};
      for (const [userId, roomId] of Array.from(userCurrentRoom.entries())) {
        mapping[userId] = roomId;
      }
      res.json(mapping);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/youtube/featured", isAuthenticated, async (req: any, res) => {
    try {
      const categoryQueries: Record<string, string> = {
        conversation: "english conversation practice",
        vocabulary: "english vocabulary lesson",
        grammar: "english grammar lesson",
        pronunciation: "english pronunciation practice",
        music: "english songs with lyrics learning",
        news: "english news for learners",
        movies: "english movie clips with subtitles",
        kids: "english for kids learning",
        ielts: "ielts speaking practice",
        business: "business english lesson",
      };
      const rawCategory = String(req.query.category || "conversation").toLowerCase().trim();
      const category = Object.prototype.hasOwnProperty.call(categoryQueries, rawCategory) ? rawCategory : "conversation";
      const cacheKey = `yt:featured:${category}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);
      const ytSearch = await import("youtube-search-api");
      const featured = await ytSearch.GetListByKeyword(categoryQueries[category], false, 25);
      const videos = (featured.items || [])
        .filter((item: any) => item.type === "video")
        .slice(0, 20)
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
          channelTitle: item.channelTitle || "",
          duration: item.length?.simpleText || "",
        }));
      externalCache.set(cacheKey, videos);
      res.json(videos);
    } catch (err: any) {
      console.error("YouTube featured error:", err);
      res.status(500).json({ message: "Failed to load featured videos" });
    }
  });

  app.get("/api/youtube/search", isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }
      const cacheKey = `yt:search:${query.toLowerCase().trim()}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);
      const ytSearch = await import("youtube-search-api");
      const results = await ytSearch.GetListByKeyword(query, false, 25);
      const videos = (results.items || [])
        .filter((item: any) => item.type === "video")
        .slice(0, 20)
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
          channelTitle: item.channelTitle || "",
          duration: item.length?.simpleText || "",
        }));
      externalCache.set(cacheKey, videos);
      res.json(videos);
    } catch (err: any) {
      console.error("YouTube search error:", err);
      res.status(500).json({ message: "Failed to search YouTube" });
    }
  });

  // ── AI Tutor model routing ─────────────────────────────────────────────────
  // Priority: NVIDIA Nemotron → gpt-4o → gpt-4o-mini → context-aware fallback
  const rawNvidiaApiKey = process.env.NVIDIA_API_KEY?.trim();
  const invalidNvidiaApiKey = rawNvidiaApiKey && /^(postgresql|postgres|mysql|mongodb|redis):\/\//i.test(rawNvidiaApiKey);
  if (invalidNvidiaApiKey) {
    console.warn("[AI Tutor] Ignoring NVIDIA_API_KEY because it looks like a database connection string.");
  }
  const NVIDIA_API_KEY = invalidNvidiaApiKey ? undefined : rawNvidiaApiKey;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  function routeAiModel(messageLen: number, isRepetitive: boolean): { provider: string; model: string; baseUrl: string; key: string | undefined } {
    if (NVIDIA_API_KEY) {
      // Nemotron Nano is fast and free-tier; use Super-49B for repetitive/complex inputs
      const model = (messageLen > 200 || isRepetitive)
        ? 'nvidia/llama-3.3-nemotron-super-49b-v1'
        : 'nvidia/llama-3.1-nemotron-nano-8b-v1';
      return { provider: 'nvidia', model, baseUrl: 'https://integrate.api.nvidia.com/v1', key: NVIDIA_API_KEY };
    }
    if (OPENAI_API_KEY) {
      // Use gpt-4o for better conversation quality; mini only as last resort
      return { provider: 'openai', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', key: OPENAI_API_KEY };
    }
    return { provider: 'none', model: 'fallback', baseUrl: '', key: undefined };
  }

  async function callAiModel(
    route: ReturnType<typeof routeAiModel>,
    systemPrompt: string,
    history: any[],
    message: string,
    temperature: number
  ): Promise<{ raw: string; ok: boolean; status?: number }> {
    if (!route.key) return { raw: '', ok: false };
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((m: any) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      })),
      { role: 'user', content: message },
    ];
    const body: any = {
      model: route.model,
      messages,
      max_tokens: 160,
      temperature,
    };
    // JSON mode: OpenAI supports response_format; NVIDIA models need prompt-level enforcement
    if (route.provider === 'openai') {
      body.response_format = { type: 'json_object' };
    }
    const r = await fetch(`${route.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${route.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    return { raw: text, ok: r.ok, status: r.status };
  }

  function parseAiResponse(raw: string): { reply: string; correction: string | null; correctionFixed: string | null } {
    // Try direct JSON parse first
    try {
      const j = JSON.parse(raw);
      const data = j.choices?.[0]?.message?.content ? JSON.parse(j.choices[0].message.content) : j;
      if (data.reply) return { reply: data.reply, correction: data.correction || null, correctionFixed: data.correctionFixed || null };
    } catch {}
    // Try extracting JSON block from markdown/text (for models that don't follow JSON mode)
    try {
      const jsonMatch = raw.match(/\{[\s\S]*?"reply"[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.reply) return { reply: parsed.reply, correction: parsed.correction || null, correctionFixed: parsed.correctionFixed || null };
      }
    } catch {}
    // Try extracting the choices content as plain text
    try {
      const parsed = JSON.parse(raw);
      const content = parsed.choices?.[0]?.message?.content || '';
      if (content && content.length > 0) return { reply: content, correction: null, correctionFixed: null };
    } catch {}
    return { reply: '', correction: null, correctionFixed: null };
  }
  // ───────────────────────────────────────────────────────────────────────────

  app.post("/api/ai-tutor/chat", isAuthenticated, async (req: any, res) => {
    const startTime = Date.now();
    try {
      const { message, history = [], settings = {}, language = "English", youtubeActive = false, roomId } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message required" });
      }

      // Only the user who owns the active AI session in this room may get responses.
      // This prevents other room participants from hijacking or distracting the session.
      if (roomId) {
        const session = roomAiTutorState.get(roomId);
        const callerId = (req.user as any).id;
        if (!session || session.userId !== callerId) {
          return res.status(403).json({ error: "not-active-session" });
        }
      }

      const correctionMode = settings.correctionMode || "live";
      const personality = settings.personality || "Friendly";
      const teachingStyle = settings.teachingStyle || "Conversation";

      // Anti-repetition: detect same or very similar AI replies in last 4 turns
      const recentAiReplies = (history as any[])
        .filter((m: any) => m.role === 'ai')
        .slice(-4)
        .map((m: any) => (m.text || '').toLowerCase().trim());
      const uniqueReplies = new Set(recentAiReplies);
      const isRepetitive = recentAiReplies.length >= 2 && uniqueReplies.size < recentAiReplies.length;

      const warnings: string[] = [];
      if (isRepetitive) warnings.push('repetitive_responses_detected');
      if (youtubeActive) warnings.push('youtube_active_during_session');

      // Route to the best available model
      const route = routeAiModel(message.length, isRepetitive);
      const temperature = isRepetitive ? 0.82 : 0.62;

      // Build system prompt — engaging, voice-first AI personality
      const correctionLine = correctionMode !== "off"
        ? `When you notice a grammar or vocabulary mistake, weave in the correction naturally mid-reply (e.g., "Oh, you mean...") — brief, light, then keep moving.`
        : `Stay focused on the conversation — never mention or flag any language errors.`;

      const antiRepeatLine = isRepetitive
        ? `CRITICAL: Repetition detected. Completely rephrase — pick up a specific detail from what the user just said, share a quick personal-sounding example, or pivot to a genuinely new angle. Do NOT reuse any phrasing from previous turns.`
        : '';

      const jsonInstruction = route.provider === 'nvidia'
        ? `You MUST reply with ONLY a raw JSON object — no markdown, no explanation, no code fences. Example: {"reply":"You mean the video froze, right? Try refreshing the room first.","correction":null,"correctionFixed":null}`
        : `Reply ONLY in JSON: {"reply":"...","correction":"..."|null,"correctionFixed":"..."|null}`;

      const systemPrompt = [
        `You are a real-time human-like AI avatar and language tutor inside a voice app. You help the user practice ${language}.`,
        `TRANSCRIPTION RULES (critical): The user's message is a literal speech transcription. Do NOT interpret or add emotions, tone indicators, symbols, or emojis. Do NOT guess or add words the user did not say. Do NOT paraphrase their input — respond to exactly the words they used.`,
        `Listen first: extract the user's exact intent, reference their words naturally, and answer that specific point. Never ignore or change the topic.`,
        `Keep replies short and voice-first: usually 1–2 sentences. If the user asks for detail, explanation, or something complex, give a complete, well-structured answer — correctness and completeness matter more than brevity in those cases.`,
        `If the user's speech is genuinely unclear, ask one short clarification question instead of guessing.`,
        personality === 'Formal'
          ? `Your tone is warm but polished — professional without being stiff.`
          : `Your tone is friendly, confident, and slightly playful — like a smart friend who actually enjoys talking.`,
        teachingStyle === 'Grammar'
          ? `Lean into grammar and structure, but keep it warm and encouraging — never lecture.`
          : `Keep it conversational. React to what the person says like a real person would — with curiosity, humor, or a quick take.`,
        `Speak naturally. Avoid markdown, bullet lists, and academic-style explanations.`,
        `Never start with hollow filler like "Great!", "Wow!", "Of course!" or "Certainly!". Just respond.`,
        `Never ask more than one question at a time. Often zero questions is better.`,
        `Never repeat phrasing from previous turns. If the conversation loops, take a completely new angle.`,
        correctionLine,
        antiRepeatLine,
        youtubeActive ? `The user is also watching a YouTube video — you can casually reference it if it fits.` : '',
        `If you correct something, set "correction" to a short natural note and "correctionFixed" to the corrected phrase only (≤5 words). Otherwise both are null.`,
        jsonInstruction,
      ].filter(Boolean).join(' ');

      // Try primary model
      if (route.provider !== 'none') {
        try {
          const { raw, ok, status } = await callAiModel(route, systemPrompt, history, message, temperature);
          if (ok) {
            const parsed = parseAiResponse(raw);
            const latencyMs = Date.now() - startTime;
            if (parsed.reply) {
              console.log(`[AI Tutor] ${route.provider}/${route.model} → ${latencyMs}ms`);
              return res.json({
                reply: parsed.reply,
                correction: parsed.correction,
                correctionFixed: parsed.correctionFixed,
                debug: { source: route.provider, model: route.model, latencyMs, warnings, temperature, historyUsed: Math.min(history.length, 10) },
              });
            }
          } else {
            console.error(`[AI Tutor] ${route.provider} error ${status}: ${raw.slice(0, 200)}`);
            warnings.push(`${route.provider}_error_${status}`);
            // Retry once with gpt-4o-mini if primary was NVIDIA
            if (route.provider === 'nvidia' && OPENAI_API_KEY) {
              warnings.push('nvidia_failed_retrying_openai');
              const fallbackRoute = { provider: 'openai', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', key: OPENAI_API_KEY };
              const fallbackBody = {
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...history.slice(-10).map((m: any) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
                  { role: 'user', content: message },
                ],
                max_tokens: 120,
                temperature,
                response_format: { type: 'json_object' },
              };
              const fbRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(fallbackBody),
              });
              if (fbRes.ok) {
                const fbRaw = await fbRes.text();
                const fbParsed = parseAiResponse(fbRaw);
                const latencyMs = Date.now() - startTime;
                if (fbParsed.reply) {
                  return res.json({
                    reply: fbParsed.reply,
                    correction: fbParsed.correction,
                    correctionFixed: fbParsed.correctionFixed,
                    debug: { source: 'openai-fallback', model: 'gpt-4o-mini', latencyMs, warnings },
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error('[AI Tutor] Model call failed:', err);
          warnings.push('model_call_exception');
        }
      } else {
        if (!NVIDIA_API_KEY) warnings.push('no_nvidia_key');
        if (!OPENAI_API_KEY) warnings.push('no_openai_key');
      }

      // Context-aware fallback — echoes back the user's words so it never feels generic
      const userWords = message.trim().split(/\s+/).slice(0, 4).join(' ');
      const fallbacks = [
        `You said "${userWords}" — tell me more about that.`,
        `Interesting — what do you mean by that exactly?`,
        `I'd love to hear more. What happened next?`,
        `That's worth exploring. How did that make you feel?`,
        `Say more — I'm following along.`,
      ];
      const latencyMs = Date.now() - startTime;
      return res.json({
        reply: fallbacks[Math.floor(Math.random() * fallbacks.length)],
        correction: null,
        correctionFixed: null,
        debug: { source: 'fallback', latencyMs, warnings },
      });

    } catch (err) {
      console.error('[AI Tutor] Unexpected error:', err);
      return res.status(500).json({
        reply: "Let's keep going — what were you saying?",
        correction: null,
        correctionFixed: null,
        debug: { source: 'error', warnings: ['server_error'] },
      });
    }
  });

  // ── AI Tutor Streaming (SSE) ─────────────────────────────────────────────
  // Streams tokens from NVIDIA Nemotron → client for real-time TTS playback.
  // Falls back to OpenAI streaming, then buffered fallback.
  app.post("/api/ai-tutor/stream", isAuthenticated, async (req: any, res) => {
    const startTime = Date.now();
    // Disable compression so SSE tokens flush immediately
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (data: object) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
    };

    try {
      const { message, history = [], settings = {}, language = "English", youtubeActive = false, roomId } = req.body;
      if (!message || typeof message !== 'string') {
        sendEvent({ error: 'message required' });
        return res.end();
      }

      // Only the active AI session holder for this room may receive responses.
      if (roomId) {
        const session = roomAiTutorState.get(roomId);
        const callerId = (req.user as any).id;
        if (!session || session.userId !== callerId) {
          sendEvent({ error: 'not-active-session' });
          return res.end();
        }
      }

      const correctionMode = settings.correctionMode || 'live';
      const personality = settings.personality || 'Friendly';
      const teachingStyle = settings.teachingStyle || 'Conversation';

      const recentAiReplies = (history as any[])
        .filter((m: any) => m.role === 'ai').slice(-4)
        .map((m: any) => (m.text || '').toLowerCase().trim());
      const isRepetitive = recentAiReplies.length >= 2 && new Set(recentAiReplies).size < recentAiReplies.length;
      const temperature = isRepetitive ? 0.82 : 0.62;

      const correctionLine = correctionMode !== 'off'
        ? `When you catch a grammar or vocabulary mistake, weave the fix in naturally mid-reply (e.g., "Oh, you mean...") — quick and light, then keep going.`
        : `Stay in the conversation — never flag or correct any language errors.`;

      const antiRepeatLine = isRepetitive
        ? `CRITICAL: Repetition detected. Completely rephrase — pick up on a specific detail, share a quick personal-sounding example, or pivot to a genuinely new angle. Do NOT reuse any phrasing from earlier turns.`
        : '';

      const systemPrompt = [
        `You are a real-time human-like AI avatar and language tutor inside a voice app. You help the user practice ${language}.`,
        `TRANSCRIPTION RULES (critical): The user's message is a literal speech transcription. Do NOT interpret or add emotions, tone indicators, symbols, or emojis. Do NOT guess or add words the user did not say. Do NOT paraphrase their input — respond to exactly the words they used.`,
        `Listen first: extract the user's exact intent, reference their words naturally, and answer that specific point. Never ignore or change the topic.`,
        `Keep replies short and voice-first: usually 1–2 sentences. If the user asks for detail, explanation, or something complex, give a complete, well-structured answer — correctness and completeness matter more than brevity in those cases.`,
        `If the user's speech is genuinely unclear, ask one short clarification question instead of guessing.`,
        personality === 'Formal'
          ? `Your tone is warm but polished — professional without being stiff.`
          : `Your tone is friendly, confident, and slightly playful — like a smart friend who actually enjoys the conversation.`,
        teachingStyle === 'Grammar'
          ? `Lean into grammar and structure, but keep it warm and encouraging — never lecture.`
          : `Keep it conversational and reactive — respond to what the user actually said, like a real person would.`,
        `Speak naturally. Avoid markdown, bullet lists, and academic-style explanations.`,
        `Never open with hollow filler: no "Great!", "Wow!", "Of course!", "Certainly!". Just respond.`,
        `Never ask more than one question at a time. Often zero questions is better.`,
        `Never repeat phrasing from previous turns. If the conversation loops, pivot to a fresh angle.`,
        correctionLine,
        antiRepeatLine,
        youtubeActive ? `The user is also watching a YouTube video — casually reference it if it fits.` : '',
        `Reply in plain spoken text only — no JSON, no markdown, no lists.`,
      ].filter(Boolean).join(' ');

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(history as any[]).slice(-10).map((m: any) => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text,
        })),
        { role: 'user', content: message },
      ];

      const streamTokens = async (provider: string, model: string, baseUrl: string, key: string): Promise<boolean> => {
        try {
          const nvidiaRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, max_tokens: 160, temperature, stream: true }),
          });
          if (!nvidiaRes.ok || !nvidiaRes.body) return false;

          const reader = nvidiaRes.body.getReader();
          const decoder = new TextDecoder();
          let sseBuffer = '';
          let firstToken = true;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (!raw || raw === '[DONE]') continue;
              try {
                const parsed = JSON.parse(raw);
                const token: string = parsed.choices?.[0]?.delta?.content || '';
                if (token) {
                  if (firstToken) {
                    console.log(`[AI Stream] First token from ${provider}/${model} in ${Date.now() - startTime}ms`);
                    firstToken = false;
                  }
                  sendEvent({ token });
                }
              } catch {}
            }
          }
          return true;
        } catch (err) {
          console.error(`[AI Stream] ${provider} stream error:`, err);
          return false;
        }
      };

      let streamed = false;
      const nvidiaModel = (message.length > 200 || isRepetitive)
        ? 'nvidia/llama-3.3-nemotron-super-49b-v1'
        : 'nvidia/llama-3.1-nemotron-nano-8b-v1';

      if (NVIDIA_API_KEY) {
        streamed = await streamTokens('nvidia', nvidiaModel, 'https://integrate.api.nvidia.com/v1', NVIDIA_API_KEY);
        if (!streamed && OPENAI_API_KEY) {
          console.warn('[AI Stream] NVIDIA failed — retrying with OpenAI gpt-4o-mini');
          sendEvent({ meta: 'switching_to_backup' });
          streamed = await streamTokens('openai', 'gpt-4o-mini', 'https://api.openai.com/v1', OPENAI_API_KEY);
        }
      } else if (OPENAI_API_KEY) {
        streamed = await streamTokens('openai', 'gpt-4o', 'https://api.openai.com/v1', OPENAI_API_KEY);
      }

      const model = NVIDIA_API_KEY ? nvidiaModel : 'gpt-4o';
      if (streamed) {
        sendEvent({ done: true, model, latencyMs: Date.now() - startTime });
      } else {
        // Ultimate fallback: return a context-aware canned reply
        const userWords = message.trim().split(/\s+/).slice(0, 4).join(' ');
        const fallbacks = [
          `You said "${userWords}" — tell me more about that.`,
          `That's interesting — what do you mean exactly?`,
          `I'd love to hear more. What happened next?`,
          `Say more — I'm following along.`,
        ];
        const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        sendEvent({ token: fallback });
        sendEvent({ done: true, model: 'fallback', latencyMs: Date.now() - startTime });
      }
    } catch (err) {
      console.error('[AI Stream] Unexpected error:', err);
      sendEvent({ error: 'Server error — please try again.' });
    }
    res.end();
  });

  const TENOR_KEY = process.env.TENOR_API_KEY || "LIVDSRZULELA";

  function mapTenorResults(items: any[]) {
    return items.map((item: any) => {
      const media = item.media?.[0] || {};
      const gif = media.gif || media.mediumgif || media.tinygif || {};
      const preview = media.tinygif || media.nanogif || media.gif || {};
      return {
        id: item.id,
        url: gif.url || "",
        preview: preview.url || gif.url || "",
        title: item.title || item.h1_title || "",
        width: gif.dims?.[0] || 200,
        height: gif.dims?.[1] || 200,
      };
    });
  }

  app.get("/api/gifs/search", isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        return res.json({ results: [] });
      }
      const cacheKey = `gif:search:${query.toLowerCase().trim()}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);
      const response = await fetch(
        `https://api.tenor.com/v1/search?key=${TENOR_KEY}&q=${encodeURIComponent(query)}&limit=20&contentfilter=low&media_filter=basic`
      );
      if (!response.ok) throw new Error("Tenor API error");
      const data = await response.json();
      const result = { results: mapTenorResults(data.results || []) };
      externalCache.set(cacheKey, result);
      res.json(result);
    } catch (err: any) {
      console.error("GIF search error:", err);
      res.status(500).json({ message: "Failed to search GIFs" });
    }
  });

  app.get("/api/gifs/trending", isAuthenticated, async (_req: any, res) => {
    try {
      const cacheKey = "gif:trending";
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);
      const response = await fetch(
        `https://api.tenor.com/v1/trending?key=${TENOR_KEY}&limit=20&contentfilter=low&media_filter=basic`
      );
      if (!response.ok) throw new Error("Tenor API error");
      const data = await response.json();
      const result = { results: mapTenorResults(data.results || []) };
      externalCache.set(cacheKey, result);
      res.json(result);
    } catch (err: any) {
      console.error("GIF trending error:", err);
      res.status(500).json({ message: "Failed to load trending GIFs" });
    }
  });

  app.get("/api/link-preview", isAuthenticated, async (req: any, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) return res.status(400).json({ message: "Missing url" });

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return res.status(400).json({ message: "Invalid url" });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ message: "Unsupported url" });
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    ) {
      return res.status(403).json({ message: "URL not allowed" });
    }

    const directImage = /\.(gif|webp|png|jpe?g|avif)(\?.*)?$/i.test(parsedUrl.pathname + parsedUrl.search);
    if (directImage) {
      return res.json({ imageUrl: parsedUrl.toString(), url: parsedUrl.toString() });
    }

    const decodeHtml = (value: string) =>
      value
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");

    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          "User-Agent": "Connect2Talk/1.0 link preview",
          Accept: "text/html,application/xhtml+xml,image/*",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) return res.status(response.status).json({ message: "Preview unavailable" });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.startsWith("image/")) {
        return res.json({ imageUrl: parsedUrl.toString(), url: parsedUrl.toString() });
      }

      const html = (await response.text()).slice(0, 250000);
      const patterns = [
        /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*>/i,
        /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]*>/i,
        /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']image["'][^>]*>/i,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) {
          const imageUrl = new URL(decodeHtml(match[1]), parsedUrl).toString();
          return res.json({ imageUrl, url: parsedUrl.toString() });
        }
      }

      res.status(404).json({ message: "No preview image found" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load preview" });
    }
  });

  app.get("/api/book/text", isAuthenticated, async (req: any, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ message: "Missing url" });
    const allowed = ["gutenberg.org", "gutenberg.net", "gutenberg.ca", "pgdp.net", "pglaf.org", "aleph.gutenberg.org"];
    let hostname: string;
    try { hostname = new URL(url).hostname; } catch { return res.status(400).json({ message: "Invalid url" }); }
    if (!allowed.some(h => hostname === h || hostname.endsWith("." + h))) {
      return res.status(403).json({ message: "URL not allowed" });
    }
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Connect2Talk/1.0 (+https://connect2talk.replit.app)" } });
      if (!response.ok) return res.status(response.status).json({ message: "Upstream error" });
      const text = await response.text();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(text);
    } catch (err: any) {
      console.error("Book proxy error:", err);
      res.status(500).json({ message: "Failed to fetch book" });
    }
  });

  app.get("/api/users", isAuthenticated, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      if (userId !== req.params.id) {
        return res.status(403).json({ message: "Cannot update other users" });
      }
      const { displayName, profileImageUrl, avatarRing, flairBadge, bio, profileDecoration, instagramUrl, linkedinUrl, facebookUrl } = req.body;
      const updateData: any = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (profileImageUrl !== undefined) updateData.profileImageUrl = normalizeProfileImageUrl(profileImageUrl);
      if (avatarRing !== undefined) updateData.avatarRing = avatarRing;
      if (flairBadge !== undefined) updateData.flairBadge = flairBadge;
      if (bio !== undefined) updateData.bio = bio;
      if (profileDecoration !== undefined) updateData.profileDecoration = profileDecoration;
      if (instagramUrl !== undefined) updateData.instagramUrl = instagramUrl;
      if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl;
      if (facebookUrl !== undefined) updateData.facebookUrl = facebookUrl;
      const updated = await storage.updateUser(userId, updateData);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/upload/avatar", isAuthenticated, upload.single("avatar"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const userId = (req.user as any).id;
      const imageUrl = `/uploads/${req.file.filename}`;
      await storage.updateUser(userId, { profileImageUrl: imageUrl });
      res.json({ url: imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/upload/chat-image", isAuthenticated, upload.single("image"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/upload/hologram", isAuthenticated, uploadVideo.single("video"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No video file uploaded" });
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/rooms", async (_req, res) => {
    try {
      const allRooms = await storage.getAllRooms();
      res.json(allRooms.map((room) => roomPublicPayload(room)));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rooms/:id/access-link", isAuthenticated, async (req: any, res) => {
    try {
      const roomParam = req.params.id;
      const room = isUuid(roomParam) ? await storage.getRoom(roomParam) : await storage.getRoomByShortId(roomParam);
      if (!room) return res.status(404).json({ message: "Room not found" });
      const requester = await storage.getUser((req.user as any).id);
      const includeKey = !room.isPublic && canManageRoomLink(requester, room);
      if (!room.isPublic && !includeKey) {
        return res.status(403).json({ message: "Only the room host can copy the private room key" });
      }
      const origin = `${req.protocol}://${req.get("host")}`;
      const pathOnly = includeKey
        ? `/room/${room.shortId}?key=${encodeURIComponent(room.accessKey || "")}`
        : `/room/${room.shortId}`;
      res.json({
        roomId: room.id,
        shortId: room.shortId,
        keyRequired: !room.isPublic,
        path: pathOnly,
        url: `${origin}${pathOnly}`,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/rooms/:id", async (req, res) => {
    try {
      const roomParam = req.params.id;
      const room = isUuid(roomParam) ? await storage.getRoom(roomParam) : await storage.getRoomByShortId(roomParam);
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (!room.isPublic && room.accessKey !== req.query.key) {
        return res.status(403).json({ message: "Invalid room link" });
      }
      res.json(roomPublicPayload(room, true));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const createRoomBody = insertRoomSchema.extend({
    ownerId: z.string().min(1),
  });

  const isUserRestricted = (user: User | undefined | null) =>
    !!(user?.restrictedUntil && new Date(user.restrictedUntil).getTime() > Date.now());

  const leaveRoomState = async (roomId: string, userId: string, leavingSocket?: any) => {
    leavingSocket?.leave(roomId);

    if (userCurrentRoom.get(userId) === roomId) {
      userCurrentRoom.delete(userId);
    }

    roomVideoStatus.get(roomId)?.delete(userId);
    roomRoles.get(roomId)?.delete(userId);
    if (roomScreenShareStatus.get(roomId) === userId) {
      roomScreenShareStatus.delete(roomId);
      io.to(roomId).emit("room:screen-share", { userId, active: false });
    }

    const ytState = roomYoutubeState.get(roomId);
    if (ytState && ytState.startedBy === userId) {
      roomYoutubeState.delete(roomId);
    }

    const bkState = roomBookState.get(roomId);
    if (bkState) {
      bkState.watchers.delete(userId);
      if (bkState.hostId === userId) {
        roomBookState.delete(roomId);
        io.to(roomId).emit("room:book", { book: null, hostId: null, scrollPct: 0, watchers: [] });
      } else {
        io.to(roomId).emit("room:book-watchers-update", { userId, watching: false });
      }
    }

    if (!roomParticipants.has(roomId)) return [];

    roomParticipants.get(roomId)!.delete(userId);
    const participants = Array.from(roomParticipants.get(roomId)!.values());
    await storage.updateRoomActiveUsers(roomId, participants.length);
    io.to(roomId).emit("room:user-left", { userId, participants });
    io.emit("room:participants-update", { roomId, participants });

    if (participants.length === 0) {
      roomVideoStatus.delete(roomId);
      roomScreenShareStatus.delete(roomId);
      roomYoutubeState.delete(roomId);
      roomRoles.delete(roomId);
      roomMuteStatus.delete(roomId);
      startRoomDeleteTimer(roomId);
    } else {
      roomMuteStatus.get(roomId)?.delete(userId);
    }

    return participants;
  };

  app.post("/api/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = createRoomBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid room data", errors: parsed.error.flatten() });
      }

      const ownerId = parsed.data.ownerId || (req.user as any).id;
      const owner = await storage.getUser(ownerId);
      if (isUserRestricted(owner)) {
        return res.status(403).json({
          message: owner?.restrictedReason || "Your account is temporarily restricted from creating rooms.",
          restrictedUntil: owner?.restrictedUntil,
        });
      }
      const existingRooms = await storage.getRoomsByOwner(ownerId);
      if (existingRooms.length > 0) {
        return res.status(400).json({ message: "You can only host one room at a time. Please close your existing room first." });
      }

      const room = await storage.createRoom({
        title: parsed.data.title,
        language: parsed.data.language,
        level: parsed.data.level,
        maxUsers: parsed.data.maxUsers ?? 8,
        isPublic: parsed.data.isPublic ?? true,
        roomTheme: parsed.data.roomTheme || "default",
        hologramVideoUrl: parsed.data.hologramVideoUrl || null,
        ownerId,
      });

      io.emit("room:created", room);
      res.json(room);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const roomId = req.params.id;
      const userId = (req.user as any).id;
      const room = await storage.getRoom(roomId);
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (room.ownerId !== userId) return res.status(403).json({ message: "Only the host can edit this room" });

      const { title, language, level, maxUsers, roomTheme, hologramVideoUrl, welcomeMessage, welcomeMediaUrls, welcomeMediaTypes, welcomeMediaPosition, welcomeAccentColor } = req.body;
      const updateData: any = {};
      if (title) updateData.title = title;
      if (language) updateData.language = language;
      if (level) updateData.level = level;
      if (maxUsers) updateData.maxUsers = maxUsers;
      if (roomTheme !== undefined) updateData.roomTheme = roomTheme;
      if (hologramVideoUrl !== undefined) updateData.hologramVideoUrl = hologramVideoUrl;
      if (welcomeMessage !== undefined) updateData.welcomeMessage = welcomeMessage;
      if (welcomeMediaUrls !== undefined) updateData.welcomeMediaUrls = Array.isArray(welcomeMediaUrls) ? welcomeMediaUrls : [];
      if (welcomeMediaTypes !== undefined) updateData.welcomeMediaTypes = Array.isArray(welcomeMediaTypes) ? welcomeMediaTypes : [];
      if (welcomeMediaPosition !== undefined) updateData.welcomeMediaPosition = welcomeMediaPosition;
      if (welcomeAccentColor !== undefined) updateData.welcomeAccentColor = welcomeAccentColor;

      const updated = await storage.updateRoom(roomId, updateData);
      io.emit("room:updated", updated);

      if (updateData.welcomeMessage !== undefined && updateData.welcomeMessage) {
        io.to(roomId).emit("room:welcome-message", {
          welcomeMessage: updateData.welcomeMessage,
          welcomeMediaUrls: updateData.welcomeMediaUrls ?? updated.welcomeMediaUrls ?? [],
          welcomeMediaTypes: updateData.welcomeMediaTypes ?? updated.welcomeMediaTypes ?? [],
          welcomeMediaPosition: updateData.welcomeMediaPosition ?? updated.welcomeMediaPosition ?? "below",
          welcomeAccentColor: updateData.welcomeAccentColor ?? updated.welcomeAccentColor ?? "#8B5CF6",
        });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const roomId = req.params.id;
      const userId = (req.user as any).id;
      const room = await storage.getRoom(roomId);
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (room.ownerId !== userId) return res.status(403).json({ message: "Only the room owner can delete this room" });

      // Notify all connected participants before wiping data
      io.to(roomId).emit("room:host-deleted", { roomId });

      // Evict all participants from in-memory state
      const participants = roomParticipants.get(roomId);
      if (participants) {
        for (const participantId of Array.from(participants.keys())) {
          userCurrentRoom.delete(participantId);
        }
        roomParticipants.delete(roomId);
      }

      // Cancel any pending auto-delete timer
      cancelRoomDeleteTimer(roomId);

      // Clear all in-memory room state
      roomVideoStatus.delete(roomId);
      roomScreenShareStatus.delete(roomId);
      roomYoutubeState.delete(roomId);
      roomBookState.delete(roomId);
      roomRoles.delete(roomId);
      roomMuteStatus.delete(roomId);
      roomMessageReactions.delete(roomId);

      // Delete all persistent data (messages, votes, room record)
      await storage.deleteRoom(roomId);

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rooms/:id/welcome-media", isAuthenticated, uploadWelcomeMedia.single("media"), async (req: any, res) => {
    try {
      const roomId = req.params.id;
      const userId = (req.user as any).id;
      const room = await storage.getRoom(roomId);
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (room.ownerId !== userId) return res.status(403).json({ message: "Only the host can upload welcome media" });
      if (!req.file) return res.status(400).json({ message: "Upload an image or GIF file." });
      const url = `/uploads/${req.file.filename}`;
      const type = req.file.mimetype === "image/gif" ? "gif" : "image";
      res.json({ url, type });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/messages/unread/count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/messages/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/messages/read/:otherUserId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.markConversationRead(userId, req.params.otherUserId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/messages/:userId1/:userId2", isAuthenticated, async (req, res) => {
    try {
      const msgs = await storage.getMessages(Array.isArray(req.params.userId1) ? req.params.userId1[0] : req.params.userId1, Array.isArray(req.params.userId2) ? req.params.userId2[0] : req.params.userId2);
      res.json(msgs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const sendMessageBody = insertMessageSchema;

  app.post("/api/messages", isAuthenticated, async (req, res) => {
    try {
      const parsed = sendMessageBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid message data" });
      }

      const sender = await storage.getUser(parsed.data.fromId);
      if (isUserRestricted(sender)) {
        return res.status(403).json({
          message: sender?.restrictedReason || "Your account is temporarily restricted from sending messages.",
          restrictedUntil: sender?.restrictedUntil,
        });
      }

      const msg = await storage.createMessage(parsed.data);
      const toSocketId = userSockets.get(parsed.data.toId);
      if (toSocketId) {
        io.to(toSocketId).emit("dm:new", msg);
      }
      const fromSocketId = userSockets.get(parsed.data.fromId);
      if (fromSocketId) {
        io.to(fromSocketId).emit("dm:new", msg);
      }
      res.json(msg);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/follows/following/:userId", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.getFollowing(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/follows/followers/:userId", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.getFollowers(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:userId/stats", async (req, res) => {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const [followers, following] = await Promise.all([
        storage.getFollowers(userId),
        storage.getFollowing(userId),
      ]);
      const followerIds = new Set(followers.map((f: any) => f.followerId));
      const followingIds = new Set(following.map((f: any) => f.followingId));
      const friends = [...followerIds].filter((id) => followingIds.has(id)).length;
      res.json({ followers: followers.length, following: following.length, friends });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/follows/counts", async (req, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds)) {
        return res.status(400).json({ message: "userIds must be an array" });
      }
      const counts = await storage.getFollowerCounts(userIds);
      res.json(counts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/follows", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertFollowSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid follow data" });
      }

      const follow = await storage.createFollow(parsed.data);
      await storage.createNotification({
        userId: parsed.data.followingId,
        fromUserId: parsed.data.followerId,
        type: "follow",
      });
      res.json(follow);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/follows/:followerId/:followingId", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteFollow(Array.isArray(req.params.followerId) ? req.params.followerId[0] : req.params.followerId, Array.isArray(req.params.followingId) ? req.params.followingId[0] : req.params.followingId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/blocks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const ids = await storage.getBlockedIds(userId);
      res.json(ids);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/blocks/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const rows = await storage.getBlocksByBlocker(userId);
      const userMap = await storage.getUsersByIds(rows.map(r => r.blockedId));
      const usersWithType = rows
        .map(r => {
          const u = userMap.get(r.blockedId);
          if (!u) return null;
          return { ...u, blockType: r.blockType };
        })
        .filter(Boolean);
      res.json(usersWithType);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/blocks", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertBlockSchema.safeParse({ ...req.body, blockType: req.body.blockType || "ordinary" });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid block data" });
      }
      const block = await storage.createBlock(parsed.data);
      res.json(block);

      const blockerId = (req.user as any).id;
      const blockedId = parsed.data.blockedId;
      const blockType = parsed.data.blockType || "ordinary";

      const blockerSocketId = userSockets.get(blockerId);
      const blockedSocketId = userSockets.get(blockedId);
      if (blockerSocketId) io.to(blockerSocketId).emit("user:blocked", { otherId: blockedId, blockType });
      if (blockedSocketId) io.to(blockedSocketId).emit("user:blocked", { otherId: blockerId, blockType });

      const blockerRoomId = userCurrentRoom.get(blockerId);
      if (blockerRoomId) {
        const [blockerUser, blockedUser] = await Promise.all([
          storage.getUser(blockerId),
          storage.getUser(blockedId),
        ]);
        if (blockerUser && blockedUser) {
          const msg = {
            id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            roomId: blockerRoomId,
            userId: "system",
            text: `${getDisplayName(blockerUser)} blocked ${getDisplayName(blockedUser)}`,
            type: "system",
            createdAt: new Date().toISOString(),
            reactions: {},
            replyTo: null,
          };
          io.to(blockerRoomId).emit("room:chat-message", msg);
        }
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/blocks/:blockedId", isAuthenticated, async (req: any, res) => {
    try {
      const callerId = (req.user as any).id;
      const otherId = Array.isArray(req.params.blockedId) ? req.params.blockedId[0] : req.params.blockedId;
      await storage.deleteBlock(callerId, otherId);
      res.json({ ok: true });

      const callerSocketId = userSockets.get(callerId);
      const otherSocketId = userSockets.get(otherId);
      if (callerSocketId) io.to(callerSocketId).emit("user:unblocked", { otherId });
      if (otherSocketId) io.to(otherSocketId).emit("user:unblocked", { otherId: callerId });

      const callerRoomId = userCurrentRoom.get(callerId);
      if (callerRoomId) {
        const [callerUser, otherUser] = await Promise.all([
          storage.getUser(callerId),
          storage.getUser(otherId),
        ]);
        if (callerUser && otherUser) {
          const msg = {
            id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            roomId: callerRoomId,
            userId: "system",
            text: `${getDisplayName(callerUser)} unblocked ${getDisplayName(otherUser)}`,
            type: "system",
            createdAt: new Date().toISOString(),
            reactions: {},
            replyTo: null,
          };
          io.to(callerRoomId).emit("room:chat-message", msg);
        }
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const SUPER_ADMIN_EMAIL = "dj55jggg@gmail.com";

  const isAdmin = async (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser((req.user as any).id);
    if (user?.email === SUPER_ADMIN_EMAIL && user.role !== "superadmin") {
      await storage.setUserRole(user.id, "superadmin");
      return next();
    }
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  const isSuperAdmin = async (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser((req.user as any).id);
    if (user?.email === SUPER_ADMIN_EMAIL && user.role !== "superadmin") {
      await storage.setUserRole(user.id, "superadmin");
      return next();
    }
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ message: "Super admin access required" });
    }
    next();
  };

  app.post("/api/admin/announcements/media", isAuthenticated, isSuperAdmin, uploadAnnouncementMedia.single("media"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Upload an image or GIF file." });
      const url = `/uploads/${req.file.filename}`;
      const type = req.file.mimetype === "image/gif" ? "gif" : "image";
      res.json({ url, type });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid report data" });
      }
      const { reporterName, reportedName, category, reason } = req.body;
      const report = await storage.createReport({ ...parsed.data, reporterName, reportedName, category });
      try {
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        if (smtpUser && smtpPass) {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: smtpUser, pass: smtpPass },
          });
          await transporter.sendMail({
            from: smtpUser,
            to: "bagpetrosyan@gmail.com",
            subject: `Connect2Talk Report: ${reporterName || "User"} reported ${reportedName || "User"}`,
            html: `
              <h2>New User Report</h2>
              <p><strong>Reporter:</strong> ${reporterName || parsed.data.reporterId}</p>
              <p><strong>Reported:</strong> ${reportedName || parsed.data.reportedId}</p>
              <p><strong>Category:</strong> ${category || "Not specified"}</p>
              <p><strong>Reason:</strong> ${reason || parsed.data.reason || "Not specified"}</p>
              <hr/>
              <p><small>Report ID: ${report.id} | Time: ${new Date().toISOString()}</small></p>
            `,
          });
        }
      } catch (mailErr) {
        console.error("Failed to send report email:", mailErr);
      }
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/reports", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const allReports = await storage.getAllReports();
      res.json(allReports);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/reports/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!["pending", "reviewed", "dismissed"].includes(status)) {
        return res.status(400).json({ message: "Invalid report status" });
      }
      const updated = await storage.updateReport(req.params.id, { status });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/warn/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const admin = await storage.getUser((req.user as any).id);
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.role === "superadmin") {
        return res.status(403).json({ message: "Platform Owner cannot be warned" });
      }
      if (target.role === "admin" && admin?.role !== "superadmin") {
        return res.status(403).json({ message: "Only the Platform Owner can warn admins" });
      }
      const warned = await storage.warnUser(userId);
      await storage.createNotification({
        userId,
        fromUserId: (req.user as any).id,
        type: "admin_warning",
      });
      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("admin:warning", {
          message: req.body.message || "You’ve received a warning from Admin. Continued violations may lead to restrictions.",
        });
        io.to(socketId).emit("admin:notification", { type: "admin_warning" });
      }
      res.json(warned);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/grant", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId, role } = req.body;
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Use 'admin' or 'user'." });
      }
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.email === SUPER_ADMIN_EMAIL && role !== "superadmin") {
        return res.status(403).json({ message: "Platform Owner role cannot be removed" });
      }
      const updated = await storage.setUserRole(userId, role);
      await storage.createNotification({
        userId,
        fromUserId: (req.user as any).id,
        type: role === "admin" ? "admin_promotion" : "admin_removed",
      });
      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("admin:role-updated", { role });
        io.to(socketId).emit("admin:notification", {
          type: role === "admin" ? "admin_promotion" : "admin_removed",
        });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admin = await storage.getUser((req.user as any).id);
      const canSeeEmails = admin?.role === "superadmin" || admin?.email === SUPER_ADMIN_EMAIL;
      const allUsers = await storage.getAllUsers();
      res.json(canSeeEmails ? allUsers : allUsers.map((user) => ({ ...user, email: null })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/users/:userId/restrict", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { days = 1, reason = "Restricted by Platform Owner" } = req.body;
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.role === "superadmin" || target.email === SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Platform Owner cannot be restricted" });
      }
      const restrictionDays = Math.min(365, Math.max(1, Number(days) || 1));
      const restrictedUntil = new Date(Date.now() + restrictionDays * 24 * 60 * 60 * 1000);
      const updated = await storage.restrictUser(userId, {
        restrictedUntil,
        restrictedReason: String(reason).slice(0, 500),
        restrictedById: (req.user as any).id,
      });
      const adminId = (req.user as any).id;
      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("admin:restricted", {
          restrictedUntil,
          reason: updated?.restrictedReason,
        });
        io.to(socketId).emit("admin:notification", { type: "admin_restriction" });
      }
      await storage.createNotification({ userId, fromUserId: adminId, type: "admin_restriction" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/users/:userId/restrict", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const adminId = (req.user as any).id;
      const updated = await storage.restrictUser(userId, {
        restrictedUntil: null,
        restrictedReason: null,
        restrictedById: null,
      });
      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("admin:restriction-lifted");
        io.to(socketId).emit("admin:notification", { type: "admin_restriction_lifted" });
      }
      await storage.createNotification({ userId, fromUserId: adminId, type: "admin_restriction_lifted" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/users/:userId", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const requesterId = (req.user as any).id;
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (userId === requesterId) return res.status(403).json({ message: "You cannot delete your own account here" });
      if (target.role === "admin" || target.role === "superadmin" || target.email === SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Admins and the Platform Owner cannot be deleted" });
      }

      const targetRooms = await storage.getRoomsByOwner(userId);
      for (const room of targetRooms) {
        const timer = roomDeleteTimers.get(room.id);
        if (timer) clearTimeout(timer);
        roomDeleteTimers.delete(room.id);
        roomParticipants.delete(room.id);
        roomVideoStatus.delete(room.id);
        roomScreenShareStatus.delete(room.id);
        roomYoutubeState.delete(room.id);
        roomBookState.delete(room.id);
        roomRoles.delete(room.id);
        roomMuteStatus.delete(room.id);
        roomMessageReactions.delete(room.id);
        io.to(room.id).emit("room:deleted", { roomId: room.id });
      }

      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("admin:account-deleted");
        io.sockets.sockets.get(socketId)?.disconnect(true);
      }
      onlineUsers.delete(userId);
      userSockets.delete(userId);
      userCurrentRoom.delete(userId);
      const timer = disconnectTimers.get(userId);
      if (timer) clearTimeout(timer);
      disconnectTimers.delete(userId);

      await storage.deleteUser(userId);
      io.emit("presence:online", Array.from(onlineUsers));
      io.emit("room:deleted", { userIds: [userId] });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/badges/award", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, badgeType } = req.body;
      if (!userId || !badgeType) return res.status(400).json({ message: "userId and badgeType required" });
      if (!(badgeType in BADGE_TYPES)) return res.status(400).json({ message: "Invalid badge type" });

      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const badge = await storage.awardBadge({
        userId,
        badgeType,
        awardedById: (req.user as any).id,
      });

      const badgeDef = BADGE_TYPES[badgeType as keyof typeof BADGE_TYPES];
      const targetName = target.displayName || [target.firstName, target.lastName].filter(Boolean).join(" ") || target.email || "A user";

      const badgeAwardPayload = {
        badge,
        badgeDef,
        userName: targetName,
        userAvatar: target.profileImageUrl,
        userId: target.id,
        quote: badgeDef.quote,
      };
      io.emit("badge:awarded", badgeAwardPayload);
      emitBadgeChatToAllActiveRooms({
        badgeUserId: target.id,
        badgeUserName: targetName,
        badgeUserAvatar: target.profileImageUrl,
        badgeEmoji: badgeDef.emoji,
        badgeLabel: badgeDef.label,
        badgeColor: badgeDef.color,
        badgeQuote: badgeDef.quote,
      });

      try {
        await storage.createNotification({ userId, fromUserId: (req.user as any).id, type: `badge_awarded:${badgeType}` });
        const userSocketId = userSockets.get(userId);
        if (userSocketId) {
          io.to(userSocketId).emit("admin:notification", { type: "badge_awarded", badge: badgeAwardPayload });
        }
      } catch (_) {}

      res.json(badge);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/badges", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const userIds = allUsers.map(u => u.id);
      const badgesByUser = await storage.getBadgesForUsers(userIds);
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const userBadgeList: any[] = [];
      for (const [uid, badges] of Object.entries(badgesByUser)) {
        if (badges.length === 0) continue;
        const u = userMap.get(uid);
        userBadgeList.push(...badges.map((b) => ({ ...b, userName: u?.displayName || u?.email || uid, userAvatar: u?.profileImageUrl })));
      }
      res.json(userBadgeList);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/badges/:badgeId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.removeBadge(req.params.badgeId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/badges", async (req, res) => {
    try {
      const badges = await storage.getUserBadges(req.params.id);
      res.json(badges);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/users/badges/batch", async (req: any, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds)) return res.status(400).json({ message: "userIds must be an array" });
      const uniqueIds = Array.from(new Set(userIds.filter((id) => typeof id === "string"))).slice(0, 100);
      res.json(await storage.getBadgesForUsers(uniqueIds));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/badge-applications/my", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getBadgeApplications((req.user as any).id));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/badge-applications", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertBadgeApplicationSchema.safeParse({
        ...req.body,
        userId: (req.user as any).id,
      });
      if (!parsed.success) return res.status(400).json({ message: "Invalid badge application data" });
      if (!(parsed.data.badgeType in BADGE_TYPES)) return res.status(400).json({ message: "Invalid badge type" });
      const reason = parsed.data.reason.trim();
      if (reason.length < 10) return res.status(400).json({ message: "Please share a little more about why you are applying." });
      const existing = await storage.getBadgeApplicationByUserAndType(parsed.data.userId, parsed.data.badgeType);
      if (existing?.status === "pending") {
        return res.status(400).json({ message: "You already have a pending application for this badge." });
      }
      const application = await storage.createBadgeApplication({
        ...parsed.data,
        reason: reason.slice(0, 1000),
      });
      res.json(application);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/badge-applications", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const applications = await storage.getBadgeApplications();
      const userMap = await storage.getUsersByIds(applications.map(a => a.userId));
      const enriched = applications.map((application) => {
        const applicant = userMap.get(application.userId);
        return {
          ...application,
          userName: applicant ? getDisplayName(applicant) : "Unknown user",
          userAvatar: applicant?.profileImageUrl ?? null,
        };
      });
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/badge-applications/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status, adminNotes } = req.body;
      if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      const application = await storage.updateBadgeApplication(req.params.id, {
        status,
        adminNotes: adminNotes || null,
        reviewedById: (req.user as any).id,
      });
      if (!application) return res.status(404).json({ message: "Application not found" });
      if (status === "approved") {
        const target = await storage.getUser(application.userId);
        if (target) {
          const badge = await storage.awardBadge({
            userId: application.userId,
            badgeType: application.badgeType,
            awardedById: (req.user as any).id,
          });
          const badgeDef = BADGE_TYPES[application.badgeType as keyof typeof BADGE_TYPES];
          const targetName = getDisplayName(target);
          const appBadgePayload = {
            badge,
            badgeDef,
            userName: targetName,
            userAvatar: target.profileImageUrl,
            userId: target.id,
            quote: badgeDef.quote,
          };
          io.emit("badge:awarded", appBadgePayload);
          emitBadgeChatToAllActiveRooms({
            badgeUserId: target.id,
            badgeUserName: targetName,
            badgeUserAvatar: target.profileImageUrl,
            badgeEmoji: badgeDef.emoji,
            badgeLabel: badgeDef.label,
            badgeColor: badgeDef.color,
            badgeQuote: badgeDef.quote,
          });
          try {
            await storage.createNotification({ userId: application.userId, fromUserId: (req.user as any).id, type: `badge_awarded:${application.badgeType}` });
            const userSocketId = userSockets.get(application.userId);
            if (userSocketId) {
              io.to(userSocketId).emit("admin:notification", { type: "badge_awarded", badge: appBadgePayload });
            }
          } catch (_) {}
        }
      }
      res.json(application);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/security-events", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const unresolvedOnly = req.query.unresolved === "true";
      const limit = Math.min(parseInt(req.query.limit as string ?? "200", 10) || 200, 500);
      const events = await storage.getSecurityEvents(limit, unresolvedOnly);
      const userIds = [...new Set(events.filter(e => e.userId).map(e => e.userId as string))];
      const userMap = userIds.length > 0 ? await storage.getUsersByIds(userIds) : new Map();
      const enriched = events.map((e) => ({
        ...e,
        userName: e.userId ? (userMap.get(e.userId) ? getDisplayName(userMap.get(e.userId)!) : "Unknown user") : null,
        userAvatar: e.userId ? (userMap.get(e.userId)?.profileImageUrl ?? null) : null,
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/security-events/count", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const count = await storage.getUnresolvedSecurityEventCount();
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/security-events/:id/resolve", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const event = await storage.resolveSecurityEvent(req.params.id, (req.user as any).id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/announcements", async (req: any, res) => {
    try {
      const userId = typeof req.isAuthenticated === "function" && req.isAuthenticated() ? (req.user as any).id : undefined;
      res.json(await storage.getPublishedAnnouncements(5, userId, true));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/announcements/viewed", isAuthenticated, async (req: any, res) => {
    try {
      const announcementIds = z.array(z.string()).max(20).safeParse(req.body.announcementIds);
      if (!announcementIds.success) return res.status(400).json({ message: "announcementIds must be an array." });
      const userId = (req.user as any).id;
      const marked: string[] = [];
      for (const announcementId of Array.from(new Set(announcementIds.data))) {
        const announcement = await storage.getAnnouncement(announcementId);
        if (announcement?.status === "published") {
          await storage.markAnnouncementViewed(announcementId, userId);
          marked.push(announcementId);
        }
      }
      res.json({ ok: true, marked });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/announcements/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement || announcement.status !== "published") {
        return res.status(404).json({ message: "Announcement not found" });
      }
      const receipt = await storage.dismissAnnouncement(req.params.id, (req.user as any).id);
      res.json(receipt);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/announcements", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAnnouncements());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const emitAnnouncementChatToAllActiveRooms = (announcement: any) => {
    for (const [roomId, participants] of roomParticipants.entries()) {
      if (participants.size > 0) {
        const msg = {
          id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          roomId,
          userId: "system",
          text: announcement.title || "",
          type: "announcement" as const,
          createdAt: new Date().toISOString(),
          reactions: {},
          replyTo: null,
          announcementTitle: announcement.title,
          announcementBody: announcement.body,
          announcementBodyAfterMedia: announcement.bodyAfterMedia || null,
          announcementMediaUrls: announcement.mediaUrls || [],
          announcementMediaTypes: announcement.mediaTypes || [],
          announcementMediaPosition: announcement.mediaPosition || "below",
          announcementKind: announcement.kind || "platform",
        };
        io.to(roomId).emit("room:chat-message", msg);
      }
    }
  };

  const broadcastAnnouncement = async (announcement: any) => {
    const event = {
      ...announcement,
      message: announcement.body,
      from: "Admin",
      createdAt: announcement.createdAt instanceof Date ? announcement.createdAt.toISOString() : announcement.createdAt,
      publishedAt: announcement.publishedAt instanceof Date ? announcement.publishedAt.toISOString() : announcement.publishedAt,
    };
    io.emit("admin:announcement", event);
    emitAnnouncementChatToAllActiveRooms(announcement);
  };

  app.post("/api/admin/announcements", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const parsed = insertAnnouncementSchema.safeParse({
        ...req.body,
        createdById: (req.user as any).id,
        mediaUrls: Array.isArray(req.body.mediaUrls) ? req.body.mediaUrls : [],
        mediaTypes: Array.isArray(req.body.mediaTypes) ? req.body.mediaTypes : [],
      });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid announcement data" });
      }
      if (parsed.data.mediaUrls.length !== parsed.data.mediaTypes.length) {
        return res.status(400).json({ message: "Each media attachment must include a media type." });
      }
      const announcement = await storage.createAnnouncement(parsed.data);
      if (announcement.status === "published") {
        await broadcastAnnouncement(announcement);
      }
      res.status(201).json(announcement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/announcements/:id", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const existing = await storage.getAnnouncement(req.params.id);
      if (!existing) return res.status(404).json({ message: "Announcement not found" });
      const parsed = insertAnnouncementSchema.partial().safeParse({
        title: req.body.title,
        body: req.body.body,
        bodyAfterMedia: req.body.bodyAfterMedia ?? existing.bodyAfterMedia,
        mediaPosition: req.body.mediaPosition ?? existing.mediaPosition ?? "below",
        kind: req.body.kind,
        status: req.body.status,
        createdById: existing.createdById,
        mediaUrls: Array.isArray(req.body.mediaUrls) ? req.body.mediaUrls : existing.mediaUrls,
        mediaTypes: Array.isArray(req.body.mediaTypes) ? req.body.mediaTypes : existing.mediaTypes,
        showOnLobby: req.body.showOnLobby !== undefined ? Boolean(req.body.showOnLobby) : existing.showOnLobby,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid announcement data" });
      }
      const nextStatus = parsed.data.status || existing.status;
      const wasPublished = existing.status === "published";
      const willPublishNow = nextStatus === "published" && !wasPublished;
      const updated = await storage.updateAnnouncement(req.params.id, {
        ...parsed.data,
        status: nextStatus,
        publishedAt: willPublishNow ? new Date() : existing.publishedAt,
      });
      if (!updated) return res.status(404).json({ message: "Announcement not found" });
      if (willPublishNow) {
        await broadcastAnnouncement(updated);
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/announcements/:id", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      await storage.deleteAnnouncement(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/announcements/broadcast", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const message = String(req.body.message || "").trim();
      const kind = String(req.body.kind || "platform").trim();
      if (!message) return res.status(400).json({ message: "Announcement message is required" });
      const admin = await storage.getUser((req.user as any).id);
      const announcement = {
        id: `announcement-${Date.now()}`,
        message: message.slice(0, 1000),
        kind,
        from: admin ? getDisplayName(admin) : "Platform Owner",
        createdAt: new Date().toISOString(),
      };
      io.emit("admin:announcement", announcement);
      emitSystemChatToAllActiveRooms(`📣 ${announcement.from}: ${announcement.message}`);
      res.json(announcement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/elevate-super", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user || user.email !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const elevated = await storage.setUserRole(user.id, "superadmin");
      res.json(elevated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rooms/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const roomId = req.params.id;
      await storage.addVote(roomId, userId);
      io.emit("room:votes-updated", { roomId });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/rooms/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const roomId = req.params.id;
      await storage.removeVote(roomId, userId);
      io.emit("room:votes-updated", { roomId });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rooms/votes/batch", async (req: any, res) => {
    try {
      const { roomIds } = req.body;
      if (!Array.isArray(roomIds)) return res.status(400).json({ message: "roomIds must be an array" });
      const counts = await storage.getVoteCounts(roomIds);
      const userId = req.user?.id;
      const userVotes = userId ? await storage.getUserVotes(userId, roomIds) : {};
      res.json({ counts, userVotes });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const notifs = await storage.getNotifications(userId);
      res.json(notifs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/notifications/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.markNotificationsRead(userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/notes/:subjectId", isAuthenticated, async (req: any, res) => {
    try {
      const authorId = (req.user as any).id;
      const { subjectId } = req.params;
      const note = await storage.getUserNote(authorId, subjectId);
      res.json({ note: note?.note ?? "" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/notes/:subjectId", isAuthenticated, async (req: any, res) => {
    try {
      const authorId = (req.user as any).id;
      const { subjectId } = req.params;
      const { note } = req.body;
      if (typeof note !== "string") return res.status(400).json({ message: "note must be a string" });
      const result = await storage.upsertUserNote(authorId, subjectId, note.slice(0, 1000));
      res.json({ note: result.note });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/room-messages/:roomId", async (req, res) => {
    try {
      const msgs = await storage.getRoomMessages(Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId);
      res.json(msgs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const getDisplayName = (u: User) =>
    u.displayName || (u.firstName ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}`.trim() : null) || (u.email ? u.email.split("@")[0] : "User");

  const emitSystemChatMsg = (roomId: string, text: string) => {
    const msg = {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      userId: "system",
      text,
      type: "system" as const,
      createdAt: new Date().toISOString(),
      reactions: {},
      replyTo: null,
    };
    io.to(roomId).emit("room:chat-message", msg);
  };

  const emitSystemChatToAllActiveRooms = (text: string) => {
    for (const [roomId, participants] of roomParticipants.entries()) {
      if (participants.size > 0) emitSystemChatMsg(roomId, text);
    }
  };

  const emitBadgeChatToAllActiveRooms = (payload: {
    badgeUserId: string;
    badgeUserName: string;
    badgeUserAvatar?: string | null;
    badgeEmoji: string;
    badgeLabel: string;
    badgeColor: string;
    badgeQuote: string;
  }) => {
    setTimeout(() => {
      for (const [roomId, participants] of roomParticipants.entries()) {
        if (participants.size > 0) {
          const msg = {
            id: `badge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            roomId,
            userId: "system",
            text: `${payload.badgeEmoji} ${payload.badgeUserName} was awarded ${payload.badgeLabel}`,
            type: "badge" as const,
            createdAt: new Date().toISOString(),
            reactions: {},
            replyTo: null,
            badgeUserId: payload.badgeUserId,
            badgeUserName: payload.badgeUserName,
            badgeUserAvatar: payload.badgeUserAvatar || null,
            badgeEmoji: payload.badgeEmoji,
            badgeLabel: payload.badgeLabel,
            badgeColor: payload.badgeColor,
            badgeQuote: payload.badgeQuote,
          };
          io.to(roomId).emit("room:chat-message", msg);
        }
      }
    }, 2500);
  };

  function cancelRoomDeleteTimer(roomId: string) {
    const timer = roomDeleteTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      roomDeleteTimers.delete(roomId);
    }
  }

  function startRoomDeleteTimer(roomId: string) {
    cancelRoomDeleteTimer(roomId);
    const timer = setTimeout(async () => {
      try {
        const participants = roomParticipants.get(roomId);
        if (!participants || participants.size === 0) {
          await storage.deleteRoom(roomId);
          roomParticipants.delete(roomId);
          roomDeleteTimers.delete(roomId);
          io.emit("room:deleted", { roomId });
        }
      } catch (err) {
        console.error("Error auto-deleting room:", err);
      }
    }, 90000);
    roomDeleteTimers.set(roomId, timer);
  }

  // ── Teachers ──────────────────────────────────────────────────────────────
  app.get("/api/teachers", async (_req, res) => {
    try {
      const all = await storage.getAllTeachers();
      res.json(all);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/teachers/:id", async (req, res) => {
    try {
      const teacher = await storage.getTeacher(req.params.id as string);
      if (!teacher) return res.status(404).json({ message: "Teacher not found" });
      res.json(teacher);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/teachers", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { insertTeacherSchema } = await import("@shared/schema");
      const parsed = insertTeacherSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const teacher = await storage.createTeacher(parsed.data);
      res.json(teacher);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/teachers/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateTeacher(req.params.id as string, req.body);
      if (!updated) return res.status(404).json({ message: "Teacher not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/teachers/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteTeacher(req.params.id as string);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Teacher Reviews ────────────────────────────────────────────────────────
  app.get("/api/teachers/:id/reviews", async (req, res) => {
    try {
      const reviews = await storage.getTeacherReviews(req.params.id as string);
      const userMap = await storage.getUsersByIds(reviews.map(r => r.userId));
      const reviewsWithUsers = reviews.map((r) => {
        const user = userMap.get(r.userId);
        return { ...r, user: user ? { id: user.id, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, profileImageUrl: user.profileImageUrl } : null };
      });
      res.json(reviewsWithUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/teachers/:id/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const teacherId = req.params.id as string;
      const already = await storage.hasUserReviewedTeacher(userId, teacherId);
      if (already) return res.status(400).json({ message: "You have already reviewed this teacher" });
      const { rating, comment } = req.body;
      if (typeof rating !== "number" || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      const review = await storage.createTeacherReview({ teacherId, userId, rating, comment });
      res.json(review);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Bookings ───────────────────────────────────────────────────────────────
  app.get("/api/bookings/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const userBookings = await storage.getBookingsByUser(userId);
      const allTeachers = await storage.getAllTeachers();
      const teacherMap = new Map(allTeachers.map(t => [t.id, t]));
      const enriched = userBookings.map((b) => ({ ...b, teacher: teacherMap.get(b.teacherId) ?? null }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { teacherId, scheduledAt, durationMinutes, sessionType, notes } = req.body;
      if (!teacherId || !scheduledAt || !durationMinutes || !sessionType) {
        return res.status(400).json({ message: "Missing required booking fields" });
      }
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) return res.status(404).json({ message: "Teacher not found" });
      if (!teacher.isAvailable) return res.status(400).json({ message: "Teacher is not currently available" });
      const booking = await storage.createBooking({
        teacherId,
        userId,
        scheduledAt: new Date(scheduledAt),
        durationMinutes,
        sessionType,
        notes: notes || null,
      });
      res.json(booking);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/bookings/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const booking = await storage.getBooking(req.params.id as string);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Not authorized" });
      if (booking.status === "cancelled") return res.status(400).json({ message: "Booking already cancelled" });
      await storage.cancelBooking(booking.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Payment Methods ──────────────────────────────────────────────────────────
  app.get("/api/payment-methods", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const methods = await storage.getPaymentMethods(userId);
      res.json(methods);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payment-methods", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const { last4, brand, expMonth, expYear, cardholderName } = req.body;
      if (!last4 || !brand || !expMonth || !expYear || !cardholderName) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const pm = await storage.addPaymentMethod({ userId, last4: String(last4).slice(-4), brand, expMonth: Number(expMonth), expYear: Number(expYear), cardholderName });
      res.json(pm);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/payment-methods/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      await storage.deletePaymentMethod(req.params.id, userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/payment-methods/:id/default", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      await storage.setDefaultPaymentMethod(req.params.id, userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── User Comments ───────────────────────────────────────────────────────────
  app.get("/api/users/:targetUserId/comments", async (req, res) => {
    try {
      const { targetUserId } = req.params;
      const comments = await storage.getUserComments(targetUserId);
      res.json(comments);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/users/:targetUserId/comments", isAuthenticated, async (req: any, res) => {
    try {
      const authorId = (req.user as any).id;
      const { targetUserId } = req.params;
      const parsed = insertUserCommentSchema.safeParse({ ...req.body, authorId, targetUserId });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid comment" });
      const comment = await storage.createUserComment(parsed.data);
      res.status(201).json(comment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/users/:targetUserId/comments/:commentId", isAuthenticated, async (req: any, res) => {
    try {
      const authorId = (req.user as any).id;
      const { commentId } = req.params;
      await storage.deleteUserComment(commentId, authorId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Teacher Applications ───────────────────────────────────────────────────
  app.get("/api/teacher-applications/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const app = await storage.getTeacherApplicationByUser(userId);
      res.json(app || null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/teacher-applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const existing = await storage.getTeacherApplicationByUser(userId);
      if (existing && existing.status === "pending") {
        return res.status(400).json({ message: "You already have a pending application" });
      }
      const { name, bio, languages, levels, specializations, suggestedRate, paypalEmail, experience } = req.body;
      if (!name || !bio || !paypalEmail) {
        return res.status(400).json({ message: "Name, bio, and PayPal email are required" });
      }
      const application = await storage.createTeacherApplication({
        userId,
        name,
        bio,
        languages: languages || [],
        levels: levels || [],
        specializations: specializations || [],
        suggestedRate: Number(suggestedRate) || 0,
        paypalEmail,
        experience: experience || null,
      });
      res.json(application);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/teacher-applications", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admin = await storage.getUser((req.user as any).id);
      const canSeeEmails = admin?.role === "superadmin" || admin?.email === SUPER_ADMIN_EMAIL;
      const applications = await storage.getAllTeacherApplications();
      const enriched = await Promise.all(
        applications.map(async (app) => {
          const user = await storage.getUser(app.userId);
          return { ...app, user: user ? { id: user.id, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, email: canSeeEmails ? user.email : null, profileImageUrl: user.profileImageUrl } : null };
        })
      );
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/teacher-applications/:id/approve", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { approvedRate, adminNotes } = req.body;
      const app = await storage.updateTeacherApplication(req.params.id as string, {
        status: "approved",
        approvedRate: Number(approvedRate) || 0,
        adminNotes: adminNotes || null,
      });
      if (!app) return res.status(404).json({ message: "Application not found" });
      const teacher = await storage.createTeacher({
        name: app.name,
        bio: app.bio,
        languages: app.languages,
        levels: app.levels,
        specializations: app.specializations,
        hourlyRate: Number(approvedRate) || app.suggestedRate,
        sessionDurations: ["30", "60"],
        isAvailable: true,
        userId: app.userId,
        rating: 0,
        reviewCount: 0,
        avatarUrl: null,
      });
      await storage.createNotification({ userId: app.userId, fromUserId: (req.user as any).id, type: "teacher_approved" });
      const socketId = userSockets.get(app.userId);
      if (socketId) {
        io.to(socketId).emit("admin:notification", { type: "teacher_approved" });
      }
      res.json({ application: app, teacher });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/teacher-applications/:id/reject", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { adminNotes } = req.body;
      const app = await storage.updateTeacherApplication(req.params.id as string, {
        status: "rejected",
        adminNotes: adminNotes || null,
      });
      if (!app) return res.status(404).json({ message: "Application not found" });
      await storage.createNotification({ userId: app.userId, fromUserId: (req.user as any).id, type: "teacher_rejected" });
      const socketId = userSockets.get(app.userId);
      if (socketId) io.to(socketId).emit("admin:notification", { type: "teacher_rejected" });
      res.json(app);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/teacher-applications/pending-count", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const count = await storage.getPendingApplicationCount();
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  (async () => {
    try {
      const allRooms = await storage.getAllRooms();
      for (const room of allRooms) {
        const participants = roomParticipants.get(room.id);
        if (!participants || participants.size === 0) {
          startRoomDeleteTimer(room.id);
        }
      }
      console.log(`Startup cleanup: scheduled ${allRooms.filter(r => {
        const p = roomParticipants.get(r.id);
        return !p || p.size === 0;
      }).length} empty rooms for deletion`);
    } catch (err) {
      console.error("Startup room cleanup error:", err);
    }
  })();

  io.on("connection", (socket) => {
    let currentUserId: string | null = null;

    socket.on("user:online", async (userId: string) => {
      currentUserId = userId;

      const timerId = `${userId}-disconnect`;
      const existingTimer = disconnectTimers.get(timerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(timerId);
      }

      onlineUsers.add(userId);
      userSockets.set(userId, socket.id);
      await storage.updateUserStatus(userId, "online");
      io.emit("presence:update", { userId, status: "online" });
      socket.emit("presence:online", Array.from(onlineUsers));

      for (const [roomId, participants] of Array.from(roomParticipants.entries())) {
        if (participants.has(userId)) {
          socket.join(roomId);
        }
      }
    });

    socket.on("user:offline", async (userId: string) => {
      onlineUsers.delete(userId);
      await storage.updateUserStatus(userId, "offline");
      io.emit("presence:update", { userId, status: "offline" });
    });

    socket.on("heartbeat", () => {
    });

    socket.on("room:join", async (data: { roomId: string; userId: string }) => {
      const { roomId, userId } = data;

      const timerId = `${userId}-disconnect`;
      const existingTimer = disconnectTimers.get(timerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(timerId);
      }

      const user = await storage.getUser(userId);
      if (!user) return;
      if (isUserRestricted(user)) {
        socket.emit("admin:restricted", {
          restrictedUntil: user.restrictedUntil,
          reason: user.restrictedReason || "Your account is temporarily restricted from joining rooms.",
        });
        return;
      }

      const room = await storage.getRoom(roomId);
      if (!room) return;

      const existingRoomId = userCurrentRoom.get(userId);
      if (existingRoomId && existingRoomId !== roomId) {
        const previousSocketId = userSockets.get(userId);
        const previousSocket = previousSocketId ? io.sockets.sockets.get(previousSocketId) : undefined;
        if (previousSocketId) {
          io.to(previousSocketId).emit("room:joined-another-room", { oldRoomId: existingRoomId, newRoomId: roomId });
        }
        await leaveRoomState(existingRoomId, userId, previousSocketId === socket.id ? socket : previousSocket);
      }

      cancelRoomDeleteTimer(roomId);

      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Map());
      }

      const currentParticipants = roomParticipants.get(roomId)!;
      const isAdminUser = user.role === "admin" || user.role === "superadmin";
      if (currentParticipants.size >= room.maxUsers && !currentParticipants.has(userId) && !isAdminUser) {
        socket.emit("room:full", { roomId });
        return;
      }

      const isRejoin = currentParticipants.has(userId);
      socket.join(roomId);
      currentParticipants.set(userId, user);
      userSockets.set(userId, socket.id);
      userCurrentRoom.set(userId, roomId);

      if (!roomMuteStatus.has(roomId)) {
        roomMuteStatus.set(roomId, new Map());
      }
      const muteMap = roomMuteStatus.get(roomId)!;
      if (!muteMap.has(userId)) {
        muteMap.set(userId, true);
      }

      if (!roomRoles.has(roomId)) {
        roomRoles.set(roomId, new Map());
      }
      const roles = roomRoles.get(roomId)!;
      if (room.ownerId === userId) {
        roles.set(userId, "host");
      } else if (!roles.has(userId)) {
        roles.set(userId, "guest");
      }

      const participants = Array.from(currentParticipants.values());
      await storage.updateRoomActiveUsers(roomId, participants.length);

      const videoUsers = roomVideoStatus.get(roomId);
      const muteStatusMap = roomMuteStatus.get(roomId);
      const participantsWithStatus = participants.map(p => ({
        ...p,
        hasVideo: videoUsers?.has(p.id) || false,
        role: roles.get(p.id) || "guest",
        isMuted: muteStatusMap?.get(p.id) ?? true,
      }));

      socket.emit("room:participants", participantsWithStatus);
      socket.emit("room:roles", Object.fromEntries(roles));
      if (!isRejoin) {
        socket.to(roomId).emit("room:user-joined", { user, participants: participantsWithStatus });
        if (room.welcomeMessage && room.ownerId !== userId) {
          socket.emit("room:welcome-message", {
            welcomeMessage: room.welcomeMessage,
            welcomeMediaUrls: room.welcomeMediaUrls || [],
            welcomeMediaTypes: room.welcomeMediaTypes || [],
            welcomeMediaPosition: room.welcomeMediaPosition || "below",
            welcomeAccentColor: room.welcomeAccentColor || "#8B5CF6",
          });
        }
      }
      io.emit("room:participants-update", { roomId, participants });

      const ytState = roomYoutubeState.get(roomId);
      if (ytState) {
        socket.emit("room:youtube", { videoId: ytState.videoId, startedBy: ytState.startedBy });
      }

      const bookState = roomBookState.get(roomId);
      if (bookState) {
        socket.emit("room:book", { book: bookState.book, hostId: bookState.hostId, scrollPct: bookState.scrollPct, watchers: Array.from(bookState.watchers) });
      }

      const screenSharer = roomScreenShareStatus.get(roomId);
      if (screenSharer) {
        socket.emit("room:screen-share", { userId: screenSharer, active: true });
      }

      socket.to(roomId).emit("webrtc:new-peer", { peerId: userId });
    });

    socket.on("room:leave", async (data: { roomId: string; userId: string }) => {
      const { roomId, userId } = data;
      await leaveRoomState(roomId, userId, socket);
    });

    socket.on("room:mute", (data: { roomId: string; userId: string; isMuted: boolean }) => {
      if (!roomMuteStatus.has(data.roomId)) {
        roomMuteStatus.set(data.roomId, new Map());
      }
      roomMuteStatus.get(data.roomId)!.set(data.userId, data.isMuted);
      io.to(data.roomId).emit("room:mute-update", {
        userId: data.userId,
        isMuted: data.isMuted,
      });
    });

    socket.on("room:hand", (data: { roomId: string; userId: string; raised: boolean }) => {
      io.to(data.roomId).emit("room:hand-raised", {
        userId: data.userId,
        raised: data.raised,
      });
    });

    socket.on("room:kick", async (data: { roomId: string; targetUserId: string; kickedBy: string }) => {
      const room = await storage.getRoom(data.roomId);
      if (!room || room.ownerId !== data.kickedBy) return;

      userCurrentRoom.delete(data.targetUserId);

      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("room:kicked", { roomId: data.roomId });
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.leave(data.roomId);
        }
      }

      if (roomParticipants.has(data.roomId)) {
        roomParticipants.get(data.roomId)!.delete(data.targetUserId);
        const participants = Array.from(roomParticipants.get(data.roomId)!.values());
        await storage.updateRoomActiveUsers(data.roomId, participants.length);
        io.to(data.roomId).emit("room:user-left", { userId: data.targetUserId, participants });
        io.emit("room:participants-update", { roomId: data.roomId, participants });
      }
    });

    socket.on("room:force-mute", async (data: { roomId: string; targetUserId: string; mutedBy: string }) => {
      const room = await storage.getRoom(data.roomId);
      if (!room || room.ownerId !== data.mutedBy) return;

      io.to(data.roomId).emit("room:mute-update", {
        userId: data.targetUserId,
        isMuted: true,
        forcedBy: data.mutedBy,
      });
    });

    socket.on("room:assign-role", async (data: { roomId: string; targetUserId: string; role: string; assignedBy: string }) => {
      const room = await storage.getRoom(data.roomId);
      if (!room) return;
      const roles = roomRoles.get(data.roomId);
      if (!roles) return;
      const assignerRole = roles.get(data.assignedBy);
      if (data.assignedBy !== room.ownerId && assignerRole !== "co-owner") return;
      if (data.targetUserId === room.ownerId) return;
      if (!["co-owner", "guest"].includes(data.role)) return;

      roles.set(data.targetUserId, data.role);
      io.to(data.roomId).emit("room:roles-update", {
        userId: data.targetUserId,
        role: data.role,
        roles: Object.fromEntries(roles),
      });

      const [targetUser, assignerUser] = await Promise.all([
        storage.getUser(data.targetUserId),
        storage.getUser(data.assignedBy),
      ]);
      if (targetUser && assignerUser) {
        const roleName = data.role === "co-owner" ? "Co-Owner" : "Guest";
        emitSystemChatMsg(data.roomId, `${getDisplayName(assignerUser)} set ${getDisplayName(targetUser)} as ${roleName}`);
      }
    });

    socket.on("room:transfer-host", async (data: { roomId: string; newOwnerId: string; currentOwnerId: string }) => {
      const room = await storage.getRoom(data.roomId);
      if (!room) return;
      if (room.ownerId !== data.currentOwnerId) return;

      const updated = await storage.updateRoom(data.roomId, { ownerId: data.newOwnerId });
      if (!updated) return;

      const roles = roomRoles.get(data.roomId);
      if (roles) {
        roles.set(data.newOwnerId, "host");
        roles.set(data.currentOwnerId, "co-owner");
      }

      io.to(data.roomId).emit("room:updated", updated);
      io.to(data.roomId).emit("room:roles-update", {
        userId: data.newOwnerId,
        role: "host",
        roles: roles ? Object.fromEntries(roles) : {},
      });
      io.to(data.roomId).emit("room:host-transferred", {
        newOwnerId: data.newOwnerId,
        previousOwnerId: data.currentOwnerId,
      });
    });

    socket.on("room:chat", async (data: { roomId: string; userId: string; text: string; messageColor?: string; privateToId?: string | null; replyTo?: { id: string; userId: string; userName: string; text: string } }) => {
      try {
        const safeColor = /^#[0-9a-fA-F]{6}$/.test(data.messageColor || "") ? data.messageColor : undefined;
        const user = await storage.getUser(data.userId);
        if (!user) return;
        if (isUserRestricted(user)) {
          socket.emit("admin:restricted", {
            restrictedUntil: user.restrictedUntil,
            reason: user.restrictedReason || "Your account is temporarily restricted from room chat.",
          });
          return;
        }

        if (data.privateToId && data.privateToId !== data.userId) {
          const participants = roomParticipants.get(data.roomId);
          if (!participants?.has(data.userId) || !participants.has(data.privateToId)) return;
          const targetUser = await storage.getUser(data.privateToId);
          const privateMsg = {
            id: `private-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            roomId: data.roomId,
            userId: data.userId,
            text: data.text,
            createdAt: new Date().toISOString(),
            user,
            messageColor: safeColor,
            privateToId: data.privateToId,
            privateToName: targetUser ? getDisplayName(targetUser) : "User",
            isPrivate: true,
            reactions: {},
            replyTo: data.replyTo || null,
          };
          socket.emit("room:chat-message", privateMsg);
          const targetSocketId = userSockets.get(data.privateToId);
          if (targetSocketId) {
            io.to(targetSocketId).emit("room:chat-message", privateMsg);
          }
          return;
        }

        const msg = await storage.createRoomMessage({
          roomId: data.roomId,
          userId: data.userId,
          text: data.text,
        });
        io.to(data.roomId).emit("room:chat-message", { ...msg, user, messageColor: safeColor, replyTo: data.replyTo || null });
      } catch (err) {
        console.error("Error creating room message:", err);
      }
    });

    socket.on("room:chat-delete", async (data: { roomId: string; messageId: string; deletedBy: string }) => {
      try {
        io.to(data.roomId).emit("room:chat-delete", { messageId: data.messageId });
      } catch (err) {
        console.error("Error deleting room message:", err);
      }
    });

    socket.on("room:clear-chat-global", async (data: { roomId: string; clearedBy: string }) => {
      try {
        const room = await storage.getRoom(data.roomId);
        if (!room) return;
        const roles = roomRoles.get(data.roomId);
        const userRole = roles?.get(data.clearedBy);
        
        if (room.ownerId === data.clearedBy || userRole === "co-owner") {
          io.to(data.roomId).emit("room:chat-cleared-global");
        }
      } catch (err) {
        console.error("Error global clearing chat:", err);
      }
    });

    socket.on("room:react", (data: { roomId: string; messageId: string; emoji: string }) => {
      if (!currentUserId) return;
      if (!roomMessageReactions.has(data.roomId)) {
        roomMessageReactions.set(data.roomId, new Map());
      }
      const msgReactions = roomMessageReactions.get(data.roomId)!;
      const key = `${data.messageId}:${data.emoji}`;
      if (!msgReactions.has(key)) {
        msgReactions.set(key, new Set());
      }
      const users = msgReactions.get(key)!;
      if (users.has(currentUserId)) {
        users.delete(currentUserId);
      } else {
        users.add(currentUserId);
      }
      const reactionMap: Record<string, string[]> = {};
      for (const [k, v] of Array.from(msgReactions.entries())) {
        if (k.startsWith(`${data.messageId}:`)) {
          const emoji = k.slice(data.messageId.length + 1);
          reactionMap[emoji] = Array.from(v);
        }
      }
      io.to(data.roomId).emit("room:reaction-update", {
        messageId: data.messageId,
        reactions: reactionMap,
      });
    });

    socket.on("room:youtube", async (data: { roomId: string; videoId: string | null }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      // Only the room host (owner) can start or stop videos
      const room = await storage.getRoom(data.roomId);
      if (!room || room.ownerId !== currentUserId) return;
      if (data.videoId) {
        roomYoutubeState.set(data.roomId, { videoId: data.videoId, startedBy: currentUserId });
      } else {
        roomYoutubeState.delete(data.roomId);
      }
      socket.to(data.roomId).emit("room:youtube", { videoId: data.videoId, startedBy: currentUserId });
    });

    socket.on("room:youtube-state", (data: { roomId: string; action: string; time?: number; ts?: number }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      // Only the broadcaster (the one who started the video) can emit state changes
      const ytState = roomYoutubeState.get(data.roomId);
      if (ytState && ytState.startedBy !== currentUserId) return;
      socket.to(data.roomId).emit("room:youtube-state", {
        action: data.action,
        time: data.time,
        ts: data.ts,
        from: currentUserId,
      });
    });

    socket.on("room:youtube-watching", (data: { roomId: string; watching: boolean }) => {
      if (!currentUserId) return;
      socket.to(data.roomId).emit("room:youtube-watchers-update", {
        userId: currentUserId,
        watching: data.watching,
      });
    });

    socket.on("room:youtube-time-request", (data: { roomId: string; requesterId: string }) => {
      if (!currentUserId) return;
      const ytState = roomYoutubeState.get(data.roomId);
      if (!ytState) return;
      const broadcasterSocketId = userSockets.get(ytState.startedBy);
      if (broadcasterSocketId) {
        io.to(broadcasterSocketId).emit("room:youtube-time-request", { requesterId: data.requesterId });
      }
    });

    socket.on("room:youtube-time-respond", (data: { roomId: string; time: number; requesterId: string; ts?: number }) => {
      if (!currentUserId) return;
      const requesterSocketId = userSockets.get(data.requesterId);
      if (requesterSocketId) {
        io.to(requesterSocketId).emit("room:youtube-time-responded", { time: data.time, ts: data.ts ?? Date.now() });
      }
    });

    socket.on("room:book", (data: { roomId: string; book: any | null }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      if (data.book) {
        roomBookState.set(data.roomId, { book: data.book, hostId: currentUserId, scrollPct: 0, watchers: new Set([currentUserId]) });
      } else {
        if (roomBookState.get(data.roomId)?.hostId === currentUserId) {
          roomBookState.delete(data.roomId);
        }
      }
      io.to(data.roomId).emit("room:book", { book: data.book, hostId: data.book ? currentUserId : null, scrollPct: 0 });
    });

    socket.on("room:book-scroll", (data: { roomId: string; scrollPct: number }) => {
      if (!currentUserId) return;
      const state = roomBookState.get(data.roomId);
      if (!state || state.hostId !== currentUserId) return;
      state.scrollPct = data.scrollPct;
      socket.to(data.roomId).emit("room:book-scroll", { scrollPct: data.scrollPct });
    });

    socket.on("room:book-watching", (data: { roomId: string; watching: boolean }) => {
      if (!currentUserId) return;
      const bkState = roomBookState.get(data.roomId);
      if (bkState) {
        if (data.watching) bkState.watchers.add(currentUserId);
        else bkState.watchers.delete(currentUserId);
      }
      io.to(data.roomId).emit("room:book-watchers-update", {
        userId: currentUserId,
        watching: data.watching,
      });
    });

    socket.on("room:screen-share", (data: { roomId: string; userId: string; active: boolean }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      if (data.active) {
        roomScreenShareStatus.set(data.roomId, currentUserId);
      } else {
        if (roomScreenShareStatus.get(data.roomId) === currentUserId) {
          roomScreenShareStatus.delete(data.roomId);
        }
      }
      io.to(data.roomId).emit("room:screen-share", { userId: currentUserId, active: data.active });
    });

    socket.on("room:video-status", (data: { roomId: string; active: boolean }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      if (!roomVideoStatus.has(data.roomId)) {
        roomVideoStatus.set(data.roomId, new Set());
      }
      if (data.active) {
        roomVideoStatus.get(data.roomId)!.add(currentUserId);
      } else {
        roomVideoStatus.get(data.roomId)!.delete(currentUserId);
      }
      io.to(data.roomId).emit("room:video-status", { userId: currentUserId, active: data.active });
    });

    socket.on("webrtc:offer", (data: { offer: any; to: string; roomId: string }) => {
      const targetSocketId = userSockets.get(data.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:offer", {
          offer: data.offer,
          from: currentUserId,
        });
      }
    });

    socket.on("webrtc:answer", (data: { answer: any; to: string; roomId: string }) => {
      const targetSocketId = userSockets.get(data.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:answer", {
          answer: data.answer,
          from: currentUserId,
        });
      }
    });

    socket.on("webrtc:ice-candidate", (data: { candidate: any; to: string; roomId: string }) => {
      const targetSocketId = userSockets.get(data.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:ice-candidate", {
          candidate: data.candidate,
          from: currentUserId,
        });
      }
    });

    // ── AI Tutor room session management ──
    socket.on("room:ai-tutor-start", ({ roomId, userId, username, avatarId, voice, voiceId }: { roomId: string; userId: string; username: string; avatarId?: string; voice?: "Female" | "Male"; voiceId?: string | null }) => {
      const enabled = roomAiTutorEnabled.get(roomId);
      if (enabled === false) {
        socket.emit("room:ai-tutor-disabled");
        return;
      }
      const existing = roomAiTutorState.get(roomId);
      if (existing && existing.userId !== userId) {
        socket.emit("room:ai-tutor-busy", { userId: existing.userId, username: existing.username });
        return;
      }
      const safeAvatarId = typeof avatarId === "string" ? avatarId.slice(0, 40) : "aurora";
      const safeVoice = voice === "Male" ? "Male" : "Female";
      const safeVoiceId = typeof voiceId === "string" ? voiceId.slice(0, 120) : null;
      roomAiTutorState.set(roomId, { userId, username, speaking: existing?.speaking || false, avatarId: safeAvatarId, voice: safeVoice, voiceId: safeVoiceId });
      io.to(roomId).emit("room:ai-tutor-state", { active: true, userId, username, speaking: existing?.speaking || false, avatarId: safeAvatarId, voice: safeVoice, voiceId: safeVoiceId });
    });

    socket.on("room:ai-tutor-stop", ({ roomId, userId }: { roomId: string; userId: string }) => {
      const existing = roomAiTutorState.get(roomId);
      if (existing?.userId === userId) {
        roomAiTutorState.delete(roomId);
        io.to(roomId).emit("room:ai-tutor-state", { active: false, userId: null, username: null, speaking: false });
      }
    });

    socket.on("room:ai-tutor-speaking", ({ roomId, userId, speaking }: { roomId: string; userId: string; speaking: boolean }) => {
      const existing = roomAiTutorState.get(roomId);
      if (existing?.userId === userId) {
        existing.speaking = speaking;
        io.to(roomId).emit("room:ai-tutor-state", { active: true, userId: existing.userId, username: existing.username, speaking, avatarId: existing.avatarId || "aurora", voice: existing.voice || "Female", voiceId: existing.voiceId || null });
      }
    });

    socket.on("room:ai-tutor-message", ({ roomId, userId, text, correction, correctionFixed, voice, voiceId, speed, avatarId }: {
      roomId: string;
      userId: string;
      text: string;
      correction?: string | null;
      correctionFixed?: string | null;
      voice?: string;
      voiceId?: string | null;
      speed?: number;
      avatarId?: string;
    }) => {
      const existing = roomAiTutorState.get(roomId);
      if (!existing || existing.userId !== userId || typeof text !== "string" || !text.trim()) return;
      socket.to(roomId).emit("room:ai-tutor-message", {
        userId,
        username: existing.username,
        text: text.trim().slice(0, 1200),
        correction: correction || null,
        correctionFixed: correctionFixed || null,
        voice: voice === "Male" ? "Male" : "Female",
        voiceId: typeof voiceId === "string" ? voiceId.slice(0, 120) : existing.voiceId || null,
        avatarId: typeof avatarId === "string" ? avatarId.slice(0, 40) : existing.avatarId || "aurora",
        speed: typeof speed === "number" ? Math.max(0.5, Math.min(2, speed)) : 0.7,
      });
    });

    socket.on("room:ai-tutor-set-enabled", ({ roomId, userId, enabled }: { roomId: string; userId: string; enabled: boolean }) => {
      // Only host can toggle
      const roles = roomRoles.get(roomId);
      const role = roles?.get(userId) || "participant";
      const participants = roomParticipants.get(roomId);
      const isHost = participants?.has(userId) && (role === "host" || role === "moderator");
      if (!isHost) {
        socket.emit("room:error", { message: "Only the host can change AI Tutor settings." });
        return;
      }
      roomAiTutorEnabled.set(roomId, enabled);
      io.to(roomId).emit("room:ai-tutor-enabled-changed", { enabled });
      // If disabling and someone is using it, kick them off
      if (!enabled) {
        const active = roomAiTutorState.get(roomId);
        if (active) {
          roomAiTutorState.delete(roomId);
          io.to(roomId).emit("room:ai-tutor-state", { active: false, userId: null, username: null, speaking: false });
        }
      }
    });

    socket.on("disconnect", async () => {
      if (currentUserId) {
        const disconnectingUserId = currentUserId;
        const timerId = `${disconnectingUserId}-disconnect`;
        const existingTimer = disconnectTimers.get(timerId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          disconnectTimers.delete(timerId);
        }

        let isInRoom = false;
        for (const [, participants] of Array.from(roomParticipants.entries())) {
          if (participants.has(disconnectingUserId)) {
            isInRoom = true;
            break;
          }
        }

        if (!isInRoom) {
          onlineUsers.delete(disconnectingUserId);
          userSockets.delete(disconnectingUserId);
          await storage.updateUserStatus(disconnectingUserId, "offline");
          io.emit("presence:update", { userId: disconnectingUserId, status: "offline" });
        } else {
          const timer = setTimeout(async () => {
            disconnectTimers.delete(timerId);

            const currentSocketId = userSockets.get(disconnectingUserId);
            if (currentSocketId && currentSocketId !== socket.id) {
              return;
            }

            onlineUsers.delete(disconnectingUserId);
            userSockets.delete(disconnectingUserId);
            userCurrentRoom.delete(disconnectingUserId);
            await storage.updateUserStatus(disconnectingUserId, "offline");
            io.emit("presence:update", { userId: disconnectingUserId, status: "offline" });

            for (const [roomId, participants] of Array.from(roomParticipants.entries())) {
              if (participants.has(disconnectingUserId)) {
                participants.delete(disconnectingUserId);

                // Per-user room state cleanup — identical to manual room:leave
                roomVideoStatus.get(roomId)?.delete(disconnectingUserId);
                roomRoles.get(roomId)?.delete(disconnectingUserId);

                if (roomScreenShareStatus.get(roomId) === disconnectingUserId) {
                  roomScreenShareStatus.delete(roomId);
                  io.to(roomId).emit("room:screen-share", { userId: disconnectingUserId, active: false });
                }

                const aiTutorSession = roomAiTutorState.get(roomId);
                if (aiTutorSession?.userId === disconnectingUserId) {
                  roomAiTutorState.delete(roomId);
                  io.to(roomId).emit("room:ai-tutor-state", { active: false, userId: null, username: null, speaking: false });
                }

                const ytState = roomYoutubeState.get(roomId);
                if (ytState && ytState.startedBy === disconnectingUserId) {
                  roomYoutubeState.delete(roomId);
                }

                const bkState = roomBookState.get(roomId);
                if (bkState) {
                  bkState.watchers.delete(disconnectingUserId);
                  if (bkState.hostId === disconnectingUserId) {
                    roomBookState.delete(roomId);
                    io.to(roomId).emit("room:book", { book: null, hostId: null, scrollPct: 0, watchers: [] });
                  } else {
                    io.to(roomId).emit("room:book-watchers-update", { userId: disconnectingUserId, watching: false });
                  }
                }

                const remainingParticipants = Array.from(participants.values());
                await storage.updateRoomActiveUsers(roomId, remainingParticipants.length);
                io.to(roomId).emit("room:user-left", {
                  userId: disconnectingUserId,
                  participants: remainingParticipants,
                });
                io.emit("room:participants-update", {
                  roomId,
                  participants: remainingParticipants,
                });

                if (remainingParticipants.length === 0) {
                  roomVideoStatus.delete(roomId);
                  roomScreenShareStatus.delete(roomId);
                  roomYoutubeState.delete(roomId);
                  roomRoles.delete(roomId);
                  roomMuteStatus.delete(roomId);
                  startRoomDeleteTimer(roomId);
                } else {
                  roomMuteStatus.get(roomId)?.delete(disconnectingUserId);
                }
              }
            }
          }, 30000);
          disconnectTimers.set(timerId, timer);
        }
      }
    });
  });

  setCleanupContext(io, storage, userSockets);

  return httpServer;
}
