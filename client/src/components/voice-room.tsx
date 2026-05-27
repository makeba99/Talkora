import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense, Fragment, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AiTutorFace } from "@/components/ai-tutor-face";
import { VextornMark } from "@/components/vextorn-logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Mic, MicOff, PhoneOff, Globe, AlertCircle, MessageSquare,
  UserX, VolumeX, Send, X, Monitor, UserPlus, UserCheck, Users, Settings, Youtube,
  Video, VideoOff, LogIn, LogOut, Search, Play, Pause, Loader2, Pencil, Shield, Crown,
  Volume2, Copy, Flag, Ban, RefreshCw, Trash2, ChevronUp, ChevronsDown, Maximize2, Minimize2,
  Tv, BookOpen, Gamepad2, ExternalLink, Volume1, ChevronLeft, ChevronRight, CornerUpLeft, Eye, Bell, BellOff, LockKeyhole,
  AtSign, TrendingUp, StopCircle, Clock, LayoutGrid, Radio, UsersRound, AlertTriangle, EyeOff, Image as ImageIcon,
  BrainCircuit, Lightbulb, ChevronDown, RotateCcw, ListVideo, Zap, Lock, ThumbsUp, ThumbsDown, SkipForward, SkipBack, Smile,
  Sparkles, Upload, MonitorPlay, Megaphone, Film, Star, AudioLines, CheckCheck, Wand2, SendHorizontal,
  Pin, Languages, Headphones, ListMusic, Captions, AlignJustify
} from "lucide-react";
import { SiInstagram, SiFacebook } from "react-icons/si";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { playMoodSound } from "@/lib/mood-sounds";
import {
  VoiceProcessor,
  VOICE_PRESETS,
  getSavedVoicePresetId,
  saveVoicePresetId,
  previewVoicePreset,
  testVoiceThroughPreset,
  type VoicePresetId,
} from "@/lib/voice-processor";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { LANGUAGES, LEVELS } from "@shared/constants";
import { DmDialog } from "@/components/dm-dialog";
import { ReportDialog } from "@/components/report-dialog";
import { RoomOnboardingTour } from "@/components/room-onboarding-tour";
import { PinnedSocialsButton } from "@/components/pinned-socials-button";
import { EmojiPickerButton, GifPickerButton, ImageUploadButton, renderMessageContent, renderReplyPreview, uploadChatImage } from "@/components/chat-picker";
import { proxyMediaUrl } from "@/lib/media-proxy";
const ChessPanel = lazy(() =>
  import("@/components/chess-panel").then((m) => ({ default: m.ChessPanel }))
);
const CenterChessOverlay = lazy(() =>
  import("@/components/center-chess-overlay").then((m) => ({ default: m.CenterChessOverlay }))
);
const CenterC4Overlay = lazy(() =>
  import("@/components/center-c4-overlay").then((m) => ({ default: m.CenterC4Overlay }))
);
import { getAvatarRingClass } from "@/lib/avatar-ring";
import { ProfileAnimationOverlay } from "@/lib/profile-animations";
import { FlairBadgeDisplay } from "@/components/profile-dropdown";
import { ProfileDecoration, ROOM_THEMES, PRESET_BACKGROUNDS, getRoomThemeStyle, RoomThemeOverlay, getChatPanelStyle } from "@/components/profile-decorations";
import { NeuParticipantSlider } from "@/components/neu-participant-slider";
import { UserNotePopover } from "@/components/social-panel";
import { useAiTutor } from "@/hooks/use-ai-tutor";
import { setYoutubeActive, isYoutubeActive } from "@/lib/perf-bus";
import { checkGrammarAll, applyAllSuggestions, getWordAlternatives, applyWordAlternative, type GrammarSuggestion, CATEGORY_META, SEVERITY_META } from "@/lib/grammar-check";
import type { Room, User, Follow } from "@shared/schema";
import evaAvatarUrl from "@/assets/eva-avatar.webp";

interface VoiceRoomProps {
  room: Room;
  onLeave: (reason?: "joined-another-room") => void;
  watchUserId?: string;
}

// ── Dark Neumorphic persona card (AI tutor "Choose Your Tutor" picker) ──
// Dark single-tone surface (#1a1f2e) with paired highlight + shadow so each
// card looks sculpted out of the panel rather than painted on. Press state
// inverts to inset shadows for tactile feedback. Matches the app's dark
// cyberpunk theme.
const NEUMO_BG = "#1a1f2e";
const NEUMO_SHADOW_DARK = "rgba(0,0,0,0.55)";
const NEUMO_SHADOW_LIGHT = "rgba(60,75,105,0.35)";
const NEUMO_REST = `8px 8px 18px ${NEUMO_SHADOW_DARK}, -8px -8px 18px ${NEUMO_SHADOW_LIGHT}`;
const NEUMO_PRESSED = `inset 5px 5px 12px ${NEUMO_SHADOW_DARK}, inset -5px -5px 12px ${NEUMO_SHADOW_LIGHT}`;
const NEUMO_SMALL_REST = `4px 4px 10px ${NEUMO_SHADOW_DARK}, -4px -4px 10px ${NEUMO_SHADOW_LIGHT}`;
const NEUMO_INSET_SMALL = `inset 3px 3px 7px ${NEUMO_SHADOW_DARK}, inset -3px -3px 7px ${NEUMO_SHADOW_LIGHT}`;

const TRANSLATE_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "hi", label: "Hindi" },
  { code: "tr", label: "Turkish" },
  { code: "hy", label: "Armenian" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
  { code: "id", label: "Indonesian" },
  { code: "th", label: "Thai" },
  { code: "sv", label: "Swedish" },
];

// Layered avatar: outer color halo + raised neumorphic disc + inset color-tinted well.
// Gives every persona that "glowing orb" look from the reference design.
function NeumorphicAvatarRing(props: {
  glowRgb: string; // e.g. "0,225,255" — the persona's signature color
  content: ReactNode;
  intense?: boolean; // brighter halo for the hero (Eva)
}) {
  const halo = props.intense ? 0.70 : 0.45;
  const haloBlur = props.intense ? 10 : 7;
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      {/* Outer color halo (sits behind the disc) */}
      <div
        className="absolute -inset-1.5 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, rgba(${props.glowRgb},${halo}) 0%, rgba(${props.glowRgb},0) 65%)`,
          filter: `blur(${haloBlur}px)`,
        }}
      />
      {/* Raised neumorphic disc */}
      <div
        className="relative w-full h-full rounded-full p-[3px]"
        style={{
          background: NEUMO_BG,
          boxShadow: `4px 4px 12px ${NEUMO_SHADOW_DARK}, -4px -4px 12px ${NEUMO_SHADOW_LIGHT}, 0 0 14px rgba(${props.glowRgb},${props.intense ? 0.30 : 0.15})`,
        }}
      >
        {/* Inset well with subtle color tint + inner color ring */}
        <div
          className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
          style={{
            background: `radial-gradient(circle at 30% 25%, rgba(${props.glowRgb},0.18), ${NEUMO_BG} 75%)`,
            boxShadow: `inset 3px 3px 6px ${NEUMO_SHADOW_DARK}, inset -3px -3px 6px ${NEUMO_SHADOW_LIGHT}, inset 0 0 0 1px rgba(${props.glowRgb},0.40), inset 0 0 8px rgba(${props.glowRgb},0.20)`,
          }}
        >
          {props.content}
        </div>
      </div>
    </div>
  );
}

function NeumorphicPersonaCard(props: {
  testId: string;
  onClick: () => void;
  avatar: ReactNode;
  name: string;
  description: string;
  badge?: string;
  nameColor?: string;
  accentColor?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      data-testid={props.testId}
      onClick={props.onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className="group relative flex items-center gap-4 w-full rounded-2xl px-5 py-4 transition-all"
      style={{
        background: NEUMO_BG,
        boxShadow: pressed ? NEUMO_PRESSED : NEUMO_REST,
        transform: pressed ? "scale(0.99)" : "scale(1)",
      }}
    >
      <div className="flex-shrink-0">{props.avatar}</div>
      <div className="flex flex-col items-start min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-semibold" style={{ color: props.nameColor || "rgba(230,235,245,0.95)" }}>
            {props.name}
          </span>
          {props.badge && (
            <span
              className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: NEUMO_BG,
                color: props.accentColor || "rgba(0,225,255,0.92)",
                boxShadow: NEUMO_INSET_SMALL,
              }}
            >
              {props.badge}
            </span>
          )}
        </div>
        <span className="text-[11px] mt-0.5" style={{ color: "rgba(170,180,200,0.65)" }}>
          {props.description}
        </span>
      </div>
      <div
        className="ml-auto w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          background: NEUMO_BG,
          boxShadow: pressed ? NEUMO_INSET_SMALL : NEUMO_SMALL_REST,
        }}
      >
        <ChevronRight className="w-3.5 h-3.5" style={{ color: props.accentColor || "rgba(0,225,255,0.85)" }} />
      </div>
    </button>
  );
}

const AI_TUTOR_AVATARS = [
  { id: "aurora", label: "Maya", gender: "Female", hairStart: "#f5f8ff", hairMid: "#c4cbe4", hairEnd: "#66718f", bang: "#ffffff", eye: "#58bdf4", suit: "#22d3ee", skinStart: "#ffe8da", skinMid: "#d79a82", skinEnd: "#8b575b" },
  { id: "nova", label: "Noah", gender: "Male", hairStart: "#3a2a22", hairMid: "#19120f", hairEnd: "#070504", bang: "#3a2a22", eye: "#3f5f6f", suit: "#0ea5e9", skinStart: "#f0d4bd", skinMid: "#b9785f", skinEnd: "#68413d" },
  { id: "ember", label: "Elena", gender: "Female", hairStart: "#e9edf8", hairMid: "#aeb9d2", hairEnd: "#48536f", bang: "#f8fbff", eye: "#3fa3d8", suit: "#7c3aed", skinStart: "#f8dac8", skinMid: "#c68670", skinEnd: "#7a4a51" },
  { id: "onyx", label: "Liam", gender: "Male", hairStart: "#4c3a2e", hairMid: "#201712", hairEnd: "#080604", bang: "#4c3a2e", eye: "#5b4635", suit: "#0f766e", skinStart: "#e8c6aa", skinMid: "#a96e55", skinEnd: "#5f3834" },
] as const;

interface Participant extends User {
  isMuted?: boolean;
  isSpeaking?: boolean;
  handRaised?: boolean;
  hasVideo?: boolean;
}

interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  user?: User;
  type?: "message" | "system" | "announcement" | "welcome" | "badge";
  reactions?: Record<string, string[]>;
  replyTo?: { id: string; userId: string; userName: string; text: string } | null;
  messageColor?: string;
  cardColor?: string;
  privateToId?: string | null;
  privateToName?: string;
  isPrivate?: boolean;
  announcementTitle?: string;
  announcementBody?: string;
  announcementBodyAfterMedia?: string | null;
  announcementMediaUrls?: string[];
  announcementMediaTypes?: string[];
  announcementMediaPosition?: "above" | "below" | "between";
  announcementKind?: string;
  welcomeMessage?: string;
  welcomeMediaUrls?: string[];
  welcomeMediaTypes?: string[];
  welcomeMediaPosition?: "above" | "below" | "between";
  welcomeAccentColor?: string;
  badgeUserId?: string;
  badgeUserName?: string;
  badgeUserAvatar?: string | null;
  badgeEmoji?: string;
  badgeLabel?: string;
  badgeColor?: string;
  badgeQuote?: string;
}

const BAR_COUNT = 20;

function WaveformCanvas({ analyserNode }: { analyserNode?: AnalyserNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef<number>(0);
  /* smooth[i] is normalised 0..1 where 0.5 = centre/silence */
  const smoothRef = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0.5));
  const volSmoothRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const CY = H / 2;           // centre line
    const BAR_W = 4;
    const GAP = 2;
    const TOTAL_W = BAR_COUNT * BAR_W + (BAR_COUNT - 1) * GAP;
    const originX = (W - TOTAL_W) / 2;
    const MAX_HALF = CY - 3;    // max bar half-height in px

    /* Tune the analyser for snappier voice response */
    if (analyserNode) {
      analyserNode.smoothingTimeConstant = 0.60;
    }

    const tdBuf  = analyserNode ? new Uint8Array(analyserNode.fftSize) : null;
    const freqBuf = analyserNode ? new Uint8Array(analyserNode.frequencyBinCount) : null;
    const smooth = smoothRef.current;

    const roundedBar = (x: number, y: number, w: number, h: number, r: number) => {
      /* rounded rect helper (top-rounded if h < 0, bottom-rounded if h > 0) */
      if (h < 0) {
        const top = y + h, bot = y;
        ctx.beginPath();
        ctx.moveTo(x, bot);
        ctx.lineTo(x + w, bot);
        ctx.lineTo(x + w, top + r);
        ctx.quadraticCurveTo(x + w, top, x + w - r, top);
        ctx.quadraticCurveTo(x, top, x, top + r);
        ctx.lineTo(x, bot);
        ctx.closePath();
      } else {
        const top = y, bot = y + h;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + w, top);
        ctx.lineTo(x + w, bot - r);
        ctx.quadraticCurveTo(x + w, bot, x + w - r, bot);
        ctx.quadraticCurveTo(x, bot, x, bot - r);
        ctx.lineTo(x, top);
        ctx.closePath();
      }
    };

    const draw = () => {
      const t = tRef.current++;
      ctx.clearRect(0, 0, W, H);

      /* -- Pull fresh audio data -- */
      if (analyserNode && tdBuf)   analyserNode.getByteTimeDomainData(tdBuf);
      if (analyserNode && freqBuf) analyserNode.getByteFrequencyData(freqBuf);

      /* Overall RMS volume across voice-freq range (drives glow) */
      let vol = 0;
      if (freqBuf) {
        const maxBin = Math.min(28, freqBuf.length);
        let sumSq = 0;
        for (let b = 1; b < maxBin; b++) sumSq += (freqBuf[b] / 255) ** 2;
        vol = Math.sqrt(sumSq / (maxBin - 1));
      }
      volSmoothRef.current += (vol - volSmoothRef.current) * 0.25;
      const vSmooth = volSmoothRef.current;

      /* -- Draw bars -- */
      for (let i = 0; i < BAR_COUNT; i++) {
        let targetNorm: number;

        if (analyserNode && tdBuf && tdBuf.length > 0) {
          /* Sample the time-domain waveform at evenly-spaced points.
             tdBuf values: 128 = silence, >128 = positive, <128 = negative.
             We spread across 80% of the buffer to catch a stable segment. */
          const idx = Math.floor(0.1 * tdBuf.length + (i / (BAR_COUNT - 1)) * 0.8 * (tdBuf.length - 1));
          targetNorm = tdBuf[Math.min(idx, tdBuf.length - 1)] / 255; // 0..1, 0.5=silence
        } else {
          /* Idle breathing ripple when no analyser */
          const p = t * 0.024 + i * 0.44;
          targetNorm = 0.5 + Math.sin(p) * 0.055 + Math.sin(p * 1.87 + i * 0.52) * 0.03;
        }

        /* Smooth: faster attack, slower decay */
        const diff = targetNorm - smooth[i];
        const rate = Math.abs(diff) > 0.05 ? 0.55 : 0.16;
        smooth[i] += diff * rate;

        /* Deviation from centre: positive → bar goes UP, negative → DOWN */
        const dev = smooth[i] - 0.5;
        const barH = Math.max(1.5, Math.abs(dev) * MAX_HALF * 2.2);
        const x = originX + i * (BAR_W + GAP);
        const r = Math.min(BAR_W / 2, barH / 2);
        const goesUp = dev >= 0;

        ctx.save();
        ctx.shadowBlur = 5 + vSmooth * 18;
        ctx.shadowColor = goesUp
          ? `rgba(167,139,250,${0.5 + vSmooth * 0.5})`
          : `rgba(251,146,60,${0.5 + vSmooth * 0.5})`;

        if (goesUp) {
          /* Upward bar: amber base → violet tip */
          const gr = ctx.createLinearGradient(x, CY, x, CY - barH);
          gr.addColorStop(0, `rgba(251,146,60,${0.78 + vSmooth * 0.18})`);
          gr.addColorStop(0.6, `rgba(196,130,220,${0.82 + vSmooth * 0.15})`);
          gr.addColorStop(1, `rgba(167,139,250,${0.92 + vSmooth * 0.08})`);
          ctx.fillStyle = gr;
          roundedBar(x, CY, BAR_W, -barH, r);
          ctx.fill();
        } else {
          /* Downward bar: amber base → warm-coral tip */
          const gr = ctx.createLinearGradient(x, CY, x, CY + barH);
          gr.addColorStop(0, `rgba(251,146,60,${0.78 + vSmooth * 0.18})`);
          gr.addColorStop(0.6, `rgba(251,120,80,${0.82 + vSmooth * 0.15})`);
          gr.addColorStop(1, `rgba(239,68,68,${0.88 + vSmooth * 0.12})`);
          ctx.fillStyle = gr;
          roundedBar(x, CY, BAR_W, barH, r);
          ctx.fill();
        }

        ctx.restore();
      }

      /* Subtle centre line */
      ctx.save();
      ctx.globalAlpha = 0.10 + vSmooth * 0.12;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(originX, CY);
      ctx.lineTo(originX + TOTAL_W, CY);
      ctx.stroke();
      ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyserNode]);

  return (
    <div className="absolute bottom-[34px] left-0 right-0 flex justify-center z-20 pointer-events-none">
      <canvas
        ref={canvasRef}
        width={130}
        height={46}
        className="opacity-[0.95]"
        data-testid="waveform-canvas"
      />
    </div>
  );
}

/* ── MicVoiceBar ──────────────────────────────────────────────────────────────
   Tiny vertical VU meter — 7 slender segments, flush bottom-right of card.
   Uses TIME-DOMAIN RMS (deviation from 128) — truly silent streams = 0,
   so background WebRTC noise cannot trigger bars. Hysteresis gate prevents
   flicker at the boundary. Smaller, gentler, more modern look. */
const VU_SEGS       = 7;    // slim column of segments
const VU_SEG_H      = 3;    // px height of each segment
const VU_SEG_GAP    = 2;    // px gap between segments
const VU_OPEN_GATE  = 0.07; // RMS fraction to open gate (~9% deviation = real voice)
const VU_CLOSE_GATE = 0.03; // RMS fraction to close gate

function MicVoiceBar({ analyserNode, isSpeaking }: { analyserNode?: AnalyserNode; isSpeaking?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const levelRef  = useRef<number>(0);
  const gateOpen  = useRef<boolean>(false);
  const tSimRef   = useRef<number>(0); // simulated time for fallback animation

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (analyserNode) {
      analyserNode.fftSize = 512;
      analyserNode.smoothingTimeConstant = 0.0;
    }

    /* Time-domain buffer: silence = all 128, signal = deviation from 128 */
    const timeBuf = analyserNode ? new Uint8Array(analyserNode.fftSize) : null;

    /* Gentle 7-stop palette: soft cyan → periwinkle → lavender → rose */
    const segRGB = (s: number): [number, number, number] => {
      const f = s / (VU_SEGS - 1);
      if (f < 0.35) {
        const t = f / 0.35;
        return [Math.round(80  + t * 40),  Math.round(200 - t * 50), Math.round(240 - t * 20)];
      } else if (f < 0.70) {
        const t = (f - 0.35) / 0.35;
        return [Math.round(120 + t * 60),  Math.round(150 - t * 60), Math.round(220 + t * 10)];
      } else {
        const t = (f - 0.70) / 0.30;
        return [Math.round(180 + t * 55),  Math.round(90  - t * 60), Math.round(230 - t * 90)];
      }
    };

    const drawSegs = (litCount: number, W: number, H: number) => {
      const r = 1.5;
      for (let s = 0; s < litCount; s++) {
        const [rc, gc, bc] = segRGB(s);
        const alpha = 0.55 + (s / (VU_SEGS - 1)) * 0.35;
        const y     = H - (s + 1) * VU_SEG_H - s * VU_SEG_GAP;
        ctx.save();
        ctx.shadowBlur  = 3 + (s / (VU_SEGS - 1)) * 6;
        ctx.shadowColor = `rgba(${rc},${gc},${bc},0.45)`;
        ctx.fillStyle   = `rgba(${rc},${gc},${bc},${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(r, y);
        ctx.lineTo(W - r, y);
        ctx.arcTo(W, y,              W, y + r,              r);
        ctx.lineTo(W, y + VU_SEG_H - r);
        ctx.arcTo(W, y + VU_SEG_H,  W - r, y + VU_SEG_H,  r);
        ctx.lineTo(r, y + VU_SEG_H);
        ctx.arcTo(0, y + VU_SEG_H,  0, y + VU_SEG_H - r,  r);
        ctx.lineTo(0, y + r);
        ctx.arcTo(0, y,              r, y,                  r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    };

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      /* Time-domain RMS: how far samples deviate from the silence midpoint */
      let raw = 0;
      if (analyserNode && timeBuf) {
        analyserNode.getByteTimeDomainData(timeBuf);
        let sumSq = 0;
        for (let i = 0; i < timeBuf.length; i++) {
          const d = (timeBuf[i] - 128) / 128;
          sumSq += d * d;
        }
        raw = Math.sqrt(sumSq / timeBuf.length);
      }

      /* Attack fast (0.80), decay slow (0.18) */
      const prev = levelRef.current;
      levelRef.current = prev + (raw - prev) * (raw > prev ? 0.80 : 0.18);
      const level = levelRef.current;

      /* Hysteresis: open gate when voice detected, close when quiet again */
      if (!gateOpen.current && level >= VU_OPEN_GATE)  gateOpen.current = true;
      if ( gateOpen.current && level <  VU_CLOSE_GATE) gateOpen.current = false;

      if (!gateOpen.current) {
        /* Fallback: if the socket says this user is speaking but the local gate
           hasn't opened yet (analyser level too low, AudioContext suspended, or
           timing lag on remote streams), show a breathing animation so ALL
           participants see the speaking indicator — not just the speaker.
           Dropping the "!analyserNode" guard is the key fix: remote users have
           an analyserNode connected to the incoming WebRTC stream, so the old
           condition was always false for them and the bar never appeared. */
        if (isSpeaking) {
          const t = tSimRef.current++ * 0.035;
          const simLevel = 0.18 + Math.abs(Math.sin(t * 1.7)) * 0.32 + Math.abs(Math.sin(t * 2.9 + 1.2)) * 0.14;
          const normalized = Math.min(1, (simLevel - VU_CLOSE_GATE) / (VU_OPEN_GATE * 6 - VU_CLOSE_GATE));
          const litCount = Math.max(1, Math.round(normalized * VU_SEGS));
          drawSegs(litCount, W, H);
        }
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const normalized = Math.min(1, (level - VU_CLOSE_GATE) / (VU_OPEN_GATE * 6 - VU_CLOSE_GATE));
      const litCount   = Math.max(1, Math.round(normalized * VU_SEGS));
      drawSegs(litCount, W, H);

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserNode, isSpeaking]);

  const H = VU_SEGS * VU_SEG_H + (VU_SEGS - 1) * VU_SEG_GAP; // 7*3 + 6*2 = 33px
  return (
    <canvas
      ref={canvasRef}
      width={8}
      height={H}
      className="pointer-events-none block"
      data-testid="mic-voice-bar"
    />
  );
}

function RemoteVideoPreview({ stream, className }: { stream: MediaStream; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`w-full h-full object-cover ${className || ""}`}
    />
  );
}

function ParticipantCard({
  participant: p,
  isMe,
  isRoomOwner,
  isSpeaking,
  gradient,
  isVideoOn,
  followingIds,
  followMutation,
  unfollowMutation,
  onNavigateDm,
  user,
  hasActiveYoutube,
  participantRole,
  onProfileClick,
  isSharing,
  hasRemoteVideo,
  hasRemoteScreen,
  onWatchVideo,
  onWatchScreen,
  isWatchingVideo,
  isWatchingScreen,
  isCurrentUserHost,
  isCurrentUserCoOwner,
  onAssignRole,
  onTransferHost,
  onNominateHost,
  hasActiveYoutubeGlobal,
  onWatchYoutube,
  isWatchingYoutube,
  allParticipants,
  onForceMute,
  onForceMuteVideo,
  onKick,
  onBlock,
  onReport,
  onClearChatGlobal,
  onClearChatLocal,
  onClearUserChat,
  onReconnect,
  volume,
  onVolumeChange,
  youtubeVideoId,
  remoteVideoStream,
  localVideoFlipped,
  hasActiveBook,
  isYoutubeWatcher,
  isBlocked,
  onUnblock,
  analyserNode,
  mood,
  onClearMood,
  hasActiveMovie,
  moviePosterPath,
  watchingMoviePoster,
  isMovieWatcher,
  onWatchMovie,
  roomLevel,
  cardPx = 128,
  hologramVideoUrl,
  avatarGifUrl,
  onSetAvatarGif,
  fillMode = false,
  notifPrefs,
  onSetNotifPrefs,
  dmUnreadCount = 0,
  dmFirstUnreadSenderId = null,
}: any) {
  const showVideoIcon = isMe ? isVideoOn : (p.hasVideo || hasRemoteVideo);
  const showYoutubeIcon = hasActiveYoutube;
  const showScreenIcon = isSharing || hasRemoteScreen;
  const showBookIcon = !!hasActiveBook;
  const showMovieIcon = !!hasActiveMovie;
  const isWatcher = isYoutubeWatcher && !hasActiveYoutube;
  const isMovieWatcherBadge = !!isMovieWatcher && !hasActiveMovie;

  const ringClass = getAvatarRingClass(p.avatarRing);
  const hasCustomRing = !!ringClass;

  const isBroadcasting = hasActiveYoutube || showScreenIcon;
  const otherParticipants = allParticipants ? allParticipants.filter((p2: any) => p2.id !== p.id) : [];

  const handleCopyId = () => {
    navigator.clipboard.writeText(p.id);
  };

  const isFollowing = followingIds.has(p.id);
  const [roomPresenceStatus, setRoomPresenceStatus] = useState((p as any).status || "online");
  useEffect(() => {
    setRoomPresenceStatus((p as any).status || "online");
  }, [p.id, (p as any).status]);
  const savePresenceMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/users/${p.id}`, { status });
    },
  });

  const gearPopover = (
    <Popover>
      <PopoverTrigger asChild>
        <button className="absolute top-1 right-1 z-30 cursor-pointer pointer-events-auto" onClick={(e) => e.stopPropagation()} data-testid={`button-settings-${p.id}`}>
          <Settings className="w-4 h-4 text-white/80 drop-shadow-md hover:text-white" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(18rem,calc(100vw-1rem))] p-0 bg-card border-border text-card-foreground shadow-xl" align="end" avoidCollisions collisionPadding={8} onClick={(e) => e.stopPropagation()} onInteractOutside={(e) => { const target = e.target as HTMLElement; if (target?.closest('[data-radix-popper-content-wrapper]')) e.preventDefault(); }}>
        <div className="flex flex-col p-3 gap-3 max-h-[85vh] overflow-y-auto">
          <div className="flex gap-3 items-start">
             <Avatar className="w-16 h-16 rounded-md border border-border flex-shrink-0">
                <AvatarImage src={p.profileImageUrl || undefined} alt="" />
                <AvatarFallback className="bg-muted text-lg">{getUserInitials(p)}</AvatarFallback>
             </Avatar>
             <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex justify-between items-center text-xs">
                   <span className="text-muted-foreground">ID: {p.id.slice(0, 10).toUpperCase()}</span>
                   <button className="text-white/50 font-medium hover:underline px-1" onClick={handleCopyId}>Copy ID</button>
                </div>
                <div className="text-sm font-semibold truncate leading-none">Name: {getUserDisplayName(p)}</div>
                <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border w-fit"
                  style={
                    participantRole === "owner" ? { background: "linear-gradient(135deg,hsl(var(--neu-orange-hi)/0.18),hsl(var(--neu-orange-lo)/0.12))", borderColor: "hsl(var(--neu-orange)/0.5)", color: "hsl(var(--neu-orange-hi))" } :
                    participantRole === "co-owner" ? { background: "rgba(56,189,248,0.12)", borderColor: "rgba(56,189,248,0.45)", color: "rgb(125,211,252)" } :
                    participantRole === "guest" ? { background: "rgba(139,92,246,0.10)", borderColor: "rgba(139,92,246,0.35)", color: "rgb(196,181,253)" } :
                    participantRole === "troll" ? { background: "rgba(234,179,8,0.12)", borderColor: "rgba(234,179,8,0.45)", color: "rgb(253,224,71)" } :
                    { background: "rgba(148,163,184,0.06)", borderColor: "rgba(148,163,184,0.18)", color: "rgb(148,163,184)" }
                  }
                  data-testid={`role-room-${p.id}`}>
                  {participantRole === "owner" ? "👑 OWNER" : participantRole === "co-owner" ? "⚡ CO-OWNER" : participantRole === "guest" ? "👤 GUEST" : participantRole === "troll" ? "🧌 TROLL" : <span className="flex items-center gap-0.5"><svg className="w-3 h-3 opacity-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>GUEST</span>}
                </div>
                {(() => {
                  const statusMap: Record<string, { label: string; icon: string; bg: string; border: string; color: string; glow: string }> = {
                    online: { label: "Online",   icon: "●", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.45)",  color: "rgb(110,231,183)", glow: "0 0 8px rgba(16,185,129,0.35)" },
                    busy:   { label: "Busy",     icon: "⛔", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.45)",   color: "rgb(252,165,165)", glow: "0 0 8px rgba(239,68,68,0.35)" },
                    brb:    { label: "BRB",      icon: "⏱", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.45)",  color: "rgb(252,211,77)",  glow: "0 0 8px rgba(245,158,11,0.35)" },
                    afk:    { label: "Away",     icon: "👤", bg: "rgba(56,189,248,0.12)",  border: "rgba(56,189,248,0.45)",  color: "rgb(125,211,252)", glow: "0 0 8px rgba(56,189,248,0.35)" },
                    zz:     { label: "Sleeping", icon: "💤", bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.45)",  color: "rgb(165,180,252)", glow: "0 0 8px rgba(99,102,241,0.35)" },
                  };
                  const s = statusMap[roomPresenceStatus] ?? statusMap.online;
                  return (
                    <div
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full w-fit select-none"
                      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, boxShadow: s.glow }}
                      data-testid={`status-room-presence-${p.id}`}
                    >
                      <span className={roomPresenceStatus === "online" ? "animate-pulse" : ""}>{s.icon}</span>
                      {s.label}
                    </div>
                  );
                })()}
                {isMe && (
                  <div className="space-y-2 mt-2">
                    <Label htmlFor={`room-presence-status-${p.id}`} className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <Select
                      value={roomPresenceStatus}
                      onValueChange={(value) => {
                        setRoomPresenceStatus(value);
                        savePresenceMutation.mutate(value);
                      }}
                    >
                      <SelectTrigger id={`room-presence-status-${p.id}`} data-testid={`select-room-presence-status-${p.id}`} className="h-8">
                        <SelectValue placeholder="Set your status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online"><span className="flex items-center gap-2"><span className="text-emerald-400 animate-pulse">●</span> Online</span></SelectItem>
                        <SelectItem value="brb"><span className="flex items-center gap-2"><span>⏱</span> BRB — Be Right Back</span></SelectItem>
                        <SelectItem value="afk"><span className="flex items-center gap-2"><span>👤</span> Away</span></SelectItem>
                        <SelectItem value="busy"><span className="flex items-center gap-2"><span>⛔</span> Busy — Do Not Disturb</span></SelectItem>
                        <SelectItem value="zz"><span className="flex items-center gap-2"><span>💤</span> Sleeping</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {isMe && (
                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Card GIF
                      </Label>
                      {avatarGifUrl && (
                        <button
                          type="button"
                          className="text-[10px] text-destructive hover:underline flex items-center gap-0.5"
                          onClick={() => onSetAvatarGif && onSetAvatarGif(null)}
                        >
                          <X className="w-2.5 h-2.5" /> Clear
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {avatarGifUrl ? (
                        <img src={avatarGifUrl} alt="Card GIF" width={40} height={40} className="w-10 h-10 rounded-md object-cover border border-border flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-[9px] text-muted-foreground flex-shrink-0">
                          GIF
                        </div>
                      )}
                      <GifPickerButton
                        onGifSelect={(url) => onSetAvatarGif && onSetAvatarGif(url)}
                        side="bottom"
                        align="start"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">Shows as your card background in this room.</p>
                  </div>
                )}
                {(p.instagramUrl || p.linkedinUrl || p.facebookUrl) && (
                  <div className="flex items-center gap-2 mt-1">
                    {p.instagramUrl && (
                      <a href={p.instagramUrl.startsWith("http") ? p.instagramUrl : `https://${p.instagramUrl}`} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:text-pink-400 transition-colors" title="Instagram">
                        <SiInstagram className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {p.linkedinUrl && (
                      <a href={p.linkedinUrl.startsWith("http") ? p.linkedinUrl : `https://${p.linkedinUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 transition-colors" title="LinkedIn">
                        <SiLinkedin className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {p.facebookUrl && (
                      <a href={p.facebookUrl.startsWith("http") ? p.facebookUrl : `https://${p.facebookUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 transition-colors" title="Facebook">
                        <SiFacebook className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}
                {!isMe && (
                  <div className="flex gap-2 mt-1">
                     <Button variant="outline" size="sm" onClick={() => onBlock && onBlock(p.id)} className="flex-1 h-7 text-xs border-border bg-transparent hover:bg-muted px-1">
                       <Ban className="w-3 h-3 mr-1 text-muted-foreground" /> Block
                     </Button>
                     <Button variant="outline" size="sm" onClick={() => onReport && onReport(p.id)} className="flex-1 h-7 text-xs border-border bg-transparent hover:bg-muted px-1">
                       <Flag className="w-3 h-3 mr-1 text-muted-foreground" /> Report
                     </Button>
                  </div>
                )}
             </div>
          </div>

          {!isMe && (
            <div className={`grid gap-2 ${isFollowing ? "grid-cols-5" : "grid-cols-4"}`}>
               <Button variant="outline" size="sm" onClick={() => onNavigateDm && onNavigateDm(p.id)} className="h-12 flex-col text-[10px] leading-tight border-border bg-transparent hover:bg-muted px-1 gap-0.5">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="truncate w-full text-center">PM</span>
               </Button>
               <div className="h-12 rounded-md border border-border bg-transparent hover:bg-muted flex items-center justify-center">
                 <UserNotePopover userId={p.id} />
               </div>
               <Button variant="outline" size="sm" onClick={() => isFollowing ? unfollowMutation.mutate(p.id) : followMutation.mutate(p.id)} className="h-12 flex-col text-[10px] leading-tight border-border bg-transparent hover:bg-muted px-1 gap-0.5">
                  {isFollowing ? <UserCheck className="w-3.5 h-3.5 text-orange-400" /> : <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className="truncate w-full text-center">{isFollowing ? "Unfollow" : "Follow"}</span>
               </Button>
               {/* ── Subscribe / room-join notification toggle ─────────────────── */}
               {/* Only shown when following — orange border = subscribed, muted = off */}
               {isFollowing && (() => {
                 const joinOn = notifPrefs?.notifyRoomJoin !== false;
                 return (
                   <button
                     data-testid={`button-subscribe-notif-${p.id}`}
                     onClick={() => onSetNotifPrefs && onSetNotifPrefs(!joinOn, notifPrefs?.notifyDm !== false)}
                     title={joinOn ? "Turn off room-join notifications" : "Turn on room-join notifications"}
                     className="h-12 flex-col text-[10px] leading-tight px-1 gap-0.5 rounded-md flex items-center justify-center w-full transition-all"
                     style={joinOn ? {
                       border: "1.5px solid rgba(249,115,22,0.75)",
                       background: "rgba(249,115,22,0.08)",
                       color: "rgb(251,146,60)",
                       boxShadow: "0 0 10px rgba(249,115,22,0.30), inset 0 1px 0 rgba(255,255,255,0.06)",
                     } : {
                       border: "1.5px solid rgba(148,163,184,0.18)",
                       background: "transparent",
                       color: "rgba(148,163,184,0.55)",
                     }}
                   >
                     {joinOn
                       ? <Bell className="w-3.5 h-3.5" />
                       : <BellOff className="w-3.5 h-3.5" />}
                     <span className="truncate w-full text-center">{joinOn ? "Alert" : "Muted"}</span>
                   </button>
                 );
               })()}
               <Button variant="outline" size="sm" onClick={() => onReconnect && onReconnect(p.id)} className="h-12 flex-col text-[10px] leading-tight border-border bg-transparent hover:bg-muted px-1 gap-0.5">
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="truncate w-full text-center">Reboot</span>
               </Button>
            </div>
          )}

          {isFollowing && !isMe && (
            <div className="p-2 rounded-md border border-border bg-muted/30 space-y-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 flex items-center gap-1">
                <Bell className="w-3 h-3" /> Notifications from {getUserDisplayName(p)}
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Room joins</span>
                  <button
                    data-testid={`toggle-notif-room-${p.id}`}
                    role="switch"
                    aria-checked={notifPrefs?.notifyRoomJoin !== false}
                    onClick={() => onSetNotifPrefs && onSetNotifPrefs(
                      notifPrefs?.notifyRoomJoin === false ? true : false,
                      notifPrefs?.notifyDm !== false
                    )}
                    className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 focus:outline-none select-none"
                    style={notifPrefs?.notifyRoomJoin !== false
                      ? { backgroundColor: "#10b981", boxShadow: "0 0 10px rgba(52,211,153,0.75)" }
                      : { backgroundColor: "rgba(225,29,72,0.7)", boxShadow: "0 0 8px rgba(225,29,72,0.45)" }}
                  >
                    <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out" style={{ transform: notifPrefs?.notifyRoomJoin !== false ? "translateX(16px)" : "translateX(0)" }} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Direct messages</span>
                  <button
                    data-testid={`toggle-notif-dm-${p.id}`}
                    role="switch"
                    aria-checked={notifPrefs?.notifyDm !== false}
                    onClick={() => onSetNotifPrefs && onSetNotifPrefs(
                      notifPrefs?.notifyRoomJoin !== false,
                      notifPrefs?.notifyDm === false ? true : false
                    )}
                    className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 focus:outline-none select-none"
                    style={notifPrefs?.notifyDm !== false
                      ? { backgroundColor: "#10b981", boxShadow: "0 0 10px rgba(52,211,153,0.75)" }
                      : { backgroundColor: "rgba(225,29,72,0.7)", boxShadow: "0 0 8px rgba(225,29,72,0.45)" }}
                  >
                    <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out" style={{ transform: notifPrefs?.notifyDm !== false ? "translateX(16px)" : "translateX(0)" }} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {(isCurrentUserHost || isCurrentUserCoOwner) && !isMe && p.id !== user?.id && (
            <div className="grid grid-cols-2 gap-2">
               <Button variant="outline" size="sm" onClick={() => onForceMute && onForceMute(p.id)} className="h-8 text-xs border-border bg-transparent hover:bg-muted px-1">
                  <VolumeX className="w-3.5 h-3.5 mr-1" /> Mute Mic
               </Button>
               <Button variant="outline" size="sm" onClick={() => onForceMuteVideo && onForceMuteVideo(p.id)} className="h-8 text-xs border-border bg-transparent hover:bg-muted px-1">
                  <VideoOff className="w-3.5 h-3.5 mr-1" /> Mute Video
               </Button>
               <Button variant="outline" size="sm" onClick={() => onKick && onKick(p.id)} className="h-8 text-xs border-border bg-transparent hover:bg-muted px-1">
                  <UserX className="w-3.5 h-3.5 mr-1" /> Kick
               </Button>
               <Button variant="outline" size="sm" onClick={() => onClearChatGlobal && onClearChatGlobal(true)} className="h-8 text-xs border-border bg-transparent hover:bg-muted px-1">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear Chat
               </Button>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => onClearUserChat && onClearUserChat(p.id)}
                 className="col-span-2 h-8 text-xs border-rose-700/40 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 hover:text-rose-300 px-1"
                 data-testid={`button-clear-user-chat-${p.id}`}
               >
                 <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear {getUserDisplayName(p)}'s Messages
               </Button>
            </div>
          )}

          {(isCurrentUserHost || isCurrentUserCoOwner) && !isMe && !isRoomOwner && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">Set Role <span className="normal-case text-muted-foreground/40 font-normal">(tap active to unset)</span></p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="outline" size="sm"
                  onClick={() => onAssignRole && onAssignRole(participantRole === "guest" ? "member" : "guest")}
                  className={`h-8 text-[11px] font-semibold transition-all ${participantRole === "guest" ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700/60 shadow-[inset_0_1px_0_rgba(165,180,252,0.15),0_0_10px_rgba(99,102,241,0.2)]' : 'bg-transparent border-border text-muted-foreground hover:bg-indigo-950/30 hover:text-indigo-300 hover:border-indigo-800/50'}`}
                  data-testid={`button-role-guest-${p.id}`}>
                  🎫 Guest
                </Button>
                <Button variant="outline" size="sm"
                  onClick={() => onAssignRole && onAssignRole(participantRole === "co-owner" ? "member" : "co-owner")}
                  className={`h-8 text-[11px] font-semibold transition-all ${participantRole === "co-owner" ? 'bg-sky-900/60 text-sky-200 border-sky-600/60 shadow-[inset_0_1px_0_rgba(125,211,252,0.15),0_0_10px_rgba(56,189,248,0.2)]' : 'bg-transparent border-border text-muted-foreground hover:bg-sky-900/30 hover:text-sky-300 hover:border-sky-700/50'}`}
                  data-testid={`button-role-coowner-${p.id}`}>
                  ⚡ Co-Owner
                </Button>
                <Button variant="outline" size="sm"
                  onClick={() => onAssignRole && onAssignRole(participantRole === "troll" ? "member" : "troll")}
                  className={`h-8 text-[11px] font-semibold transition-all ${participantRole === "troll" ? 'bg-yellow-950/60 text-yellow-300 border-yellow-700/60 shadow-[inset_0_1px_0_rgba(253,224,71,0.12),0_0_10px_rgba(234,179,8,0.2)]' : 'bg-transparent border-border text-muted-foreground hover:bg-yellow-950/30 hover:text-yellow-300 hover:border-yellow-800/50'}`}
                  data-testid={`button-role-troll-${p.id}`}>
                  🧌 Troll
                </Button>
                <Button variant="outline" size="sm"
                  onClick={() => onAssignRole && onAssignRole("member")}
                  className={`h-8 text-[11px] font-semibold transition-all ${participantRole === "member" ? 'bg-slate-700/60 text-slate-200 border-slate-500/60 shadow-[inset_0_1px_0_rgba(148,163,184,0.15)]' : 'bg-transparent border-border text-muted-foreground hover:bg-slate-800/40 hover:text-slate-200'}`}
                  data-testid={`button-role-member-${p.id}`}>
                  👤 Member
                </Button>
              </div>
            </div>
          )}
          
          {(!isCurrentUserHost && !isCurrentUserCoOwner && !isMe) && (
             <div className="grid grid-cols-1 gap-2">
               <Button variant="outline" size="sm" onClick={() => onClearChatLocal && onClearChatLocal()} className="h-8 text-xs border-border bg-transparent hover:bg-muted">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear My Chat
               </Button>
             </div>
          )}

          {(!isCurrentUserHost && !isMe && !isRoomOwner) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNominateHost && onNominateHost(p.id)}
              className="w-full h-8 text-xs border-border bg-transparent hover:bg-purple-900/20 text-purple-400 mt-1"
            >
              <Crown className="w-3.5 h-3.5 mr-1" /> Nominate as Host
            </Button>
          )}

          {isCurrentUserHost && !isMe && !isRoomOwner && (
             <Button variant="outline" size="sm" onClick={onTransferHost} className="w-full h-8 text-xs border-border bg-transparent hover:bg-red-900/20 text-red-400 mt-1">
                <Crown className="w-3.5 h-3.5 mr-1" /> Transfer Host
             </Button>
          )}

          {hasRemoteVideo || hasRemoteScreen || hasActiveYoutubeGlobal ? (
             <div className="flex flex-col gap-2 mt-1">
               <div className="h-px bg-border w-full" />
               <p className="text-xs text-muted-foreground font-medium">Available Media</p>
               <div className="grid grid-cols-1 gap-2">
                  {hasRemoteVideo && (
                    <Button size="sm" variant={isWatchingVideo ? "secondary" : "outline"} className={`h-8 text-xs ${isWatchingVideo ? 'bg-muted text-foreground' : 'border-border bg-transparent'}`} onClick={onWatchVideo}>
                      <Video className="w-3.5 h-3.5 mr-1.5" /> {isWatchingVideo ? "Stop Watching Cam" : "Watch Camera"}
                    </Button>
                  )}
                  {hasRemoteScreen && (
                    <Button size="sm" variant={isWatchingScreen ? "secondary" : "outline"} className={`h-8 text-xs ${isWatchingScreen ? 'bg-muted text-foreground' : 'border-border bg-transparent'}`} onClick={onWatchScreen}>
                      <Monitor className="w-3.5 h-3.5 mr-1.5" /> {isWatchingScreen ? "Stop Watching Screen" : "Watch Screen"}
                    </Button>
                  )}
                  {hasActiveYoutubeGlobal && (
                    <Button size="sm" variant={isWatchingYoutube ? "secondary" : "outline"} className={`h-8 text-xs ${isWatchingYoutube ? 'bg-muted text-foreground' : 'border-border bg-transparent'}`} onClick={onWatchYoutube}>
                      <Youtube className="w-3.5 h-3.5 mr-1.5" /> {isWatchingYoutube ? "Stop Youtube" : "Watch Youtube"}
                    </Button>
                  )}
               </div>
             </div>
          ) : null}

          {!isMe && (
            <div className="flex items-center gap-3 mt-1 bg-muted/50 p-2 rounded-md border border-border">
              <Button variant="outline" size="sm" className="h-8 border-orange-500/40 text-orange-400/80 bg-transparent px-2 pointer-events-none">Volume <Volume2 className="w-3.5 h-3.5 ml-1"/></Button>
              <input type="range" min="0" max="1" step="0.05" value={volume ?? 1} onChange={(e) => onVolumeChange && onVolumeChange(p.id, parseFloat(e.target.value))} className="flex-1 accent-orange-500 h-1 cursor-pointer" aria-label="Adjust participant volume" />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative rounded-md overflow-hidden bg-muted/30 border-[3px] border-transparent select-none opacity-70" style={{ width: cardPx, height: cardPx, flexShrink: 0 }}>
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted/60 gap-2">
            <Ban className="w-8 h-8 text-muted-foreground/60" />
            <button
              onClick={(e) => { e.stopPropagation(); onUnblock && onUnblock(p.id); }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all border border-white/20"
            >
              Unblock
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-red-900/70 text-white text-[10px] font-bold px-1.5 py-0.5 text-center z-20">
            Blocked
          </div>
        </div>
        <span className="text-xs text-muted-foreground/60 font-medium text-center max-w-[7rem] truncate">
          {getUserDisplayName(p)}
        </span>
      </div>
    );
  }

  const avatarContent = (
    <div className="flex flex-col items-start gap-1 relative">
      {/* Mood emoji "sticker" — fires when this participant picks an emoji
          from the mood picker. Animation: pop in with a playful bounce, then
          settles above the avatar and gently bobs forever (until cleared).
          Owner of the mood (isMe) sees a small × on hover to dismiss it. */}
      {mood?.emoji && (
        <div
          key={mood.id}
          className="absolute left-1/2 -top-10 sm:-top-12 z-30 select-none group/mood"
          data-testid={`mood-${p.id}`}
          style={{
            animation: "moodFloat 0.9s cubic-bezier(0.22, 0.61, 0.36, 1) forwards, moodBob 3.6s ease-in-out 0.9s infinite",
            transform: "translate(-50%, 0)",
          }}
        >
          <div
            className="text-4xl sm:text-5xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)] pointer-events-none"
            style={{ filter: "drop-shadow(0 0 12px rgba(255,255,255,0.35))" }}
          >
            {mood.emoji}
          </div>
          {isMe && onClearMood && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearMood();
              }}
              className="absolute -top-1 -right-2 w-5 h-5 rounded-full bg-black/70 hover:bg-red-500 text-white text-[11px] leading-none flex items-center justify-center border border-white/30 shadow-md opacity-0 group-hover/mood:opacity-100 transition-opacity"
              data-testid={`button-clear-mood-${p.id}`}
              aria-label="Remove mood"
              title="Remove mood"
            >
              ×
            </button>
          )}
        </div>
      )}
      <div
        className={`relative overflow-hidden bg-muted/20 group border-[3px] select-none ${
          isSpeaking ? "border-[hsl(var(--neu-orange))]/60 shadow-[0_0_14px_hsl(var(--neu-orange)/0.45)]" : "border-transparent hover:border-white/20"
        } transition-all duration-300 ${fillMode ? "w-full h-full rounded-xl" : "rounded-md"}`}
        style={fillMode ? { flexShrink: 0 } : { width: cardPx, height: cardPx, flexShrink: 0 }}
      >
        {/* Profile card animation overlay — renders behind avatar content */}
        <ProfileAnimationOverlay
          animationId={(p as any).profileAnimation}
          isHost={isRoomOwner}
        />
        {hasActiveYoutube && youtubeVideoId ? (
          <>
            <img
              src={`https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`}
              alt="YouTube thumbnail"
              loading="lazy"
              decoding="async"
              width={480}
              height={360}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Gradient scrim so the profile strip is always legible */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-[24]" />
            {/* Profile strip pinned at bottom — avatar + name + role + mute always visible */}
            <div className="absolute inset-x-0 bottom-0 z-[26] flex items-center gap-1.5 px-1.5 pb-2 pt-1">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/70 shadow-lg flex-shrink-0">
                {p.profileImageUrl ? (
                  <img src={p.profileImageUrl} alt={getUserDisplayName(p)} width={36} height={36} className="w-full h-full object-cover" style={{ imageRendering: "auto", backfaceVisibility: "hidden", transform: "translateZ(0)" }} />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <span className="text-[9px] font-bold text-white">{getUserInitials(p)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  {isRoomOwner && <Crown className="w-2.5 h-2.5 text-yellow-300 flex-shrink-0" />}
                  <span className="text-[10px] font-semibold text-white leading-tight truncate drop-shadow-md" data-testid={`text-yt-card-name-${p.id}`}>
                    {isMe ? "You" : getUserDisplayName(p)}
                  </span>
                </div>
                <span className="text-[8px] text-white/60 leading-none truncate">{roomLevel}</span>
              </div>
              <div className="flex-shrink-0 opacity-80">
                {p.isMuted ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
          </>
        ) : hasActiveMovie ? (
          <>
            {moviePosterPath ? (
            <img
              src={moviePosterPath}
              alt="Movie poster"
              loading="lazy"
              decoding="async"
              width={300}
              height={450}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-900 to-indigo-900 flex items-center justify-center">
                <Film className="w-10 h-10 text-violet-300/70" />
              </div>
            )}
            {/* Gradient scrim */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-[24]" />
            {/* Profile strip — always visible at bottom */}
            <div className="absolute inset-x-0 bottom-0 z-[26] flex items-center gap-1.5 px-1.5 pb-2 pt-1">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/70 shadow-lg flex-shrink-0">
                {p.profileImageUrl ? (
                  <img src={p.profileImageUrl} alt={getUserDisplayName(p)} width={36} height={36} className="w-full h-full object-cover" style={{ imageRendering: "auto", backfaceVisibility: "hidden", transform: "translateZ(0)" }} />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <span className="text-[9px] font-bold text-white">{getUserInitials(p)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  {isRoomOwner && <Crown className="w-2.5 h-2.5 text-yellow-300 flex-shrink-0" />}
                  <span className="text-[10px] font-semibold text-white leading-tight truncate drop-shadow-md">
                    {isMe ? "You" : getUserDisplayName(p)}
                  </span>
                </div>
                <span className="text-[8px] text-white/60 leading-none truncate">{roomLevel}</span>
              </div>
              <div className="flex-shrink-0 opacity-80">
                {p.isMuted ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
          </>
        ) : isMovieWatcherBadge ? (
          <>
            {watchingMoviePoster ? (
              <img
                src={watchingMoviePoster}
                alt="Movie poster"
                loading="lazy"
                decoding="async"
                width={300}
                height={450}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-900 to-indigo-900 flex items-center justify-center">
                <Film className="w-10 h-10 text-violet-300/70" />
              </div>
            )}
            {/* Gradient scrim */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-[24]" />
            {/* Profile strip — always visible at bottom */}
            <div className="absolute inset-x-0 bottom-0 z-[26] flex items-center gap-1.5 px-1.5 pb-2 pt-1">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/70 shadow-lg flex-shrink-0">
                {p.profileImageUrl ? (
                  <img src={p.profileImageUrl} alt={getUserDisplayName(p)} width={36} height={36} className="w-full h-full object-cover" style={{ imageRendering: "auto", backfaceVisibility: "hidden", transform: "translateZ(0)" }} />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <span className="text-[9px] font-bold text-white">{getUserInitials(p)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] font-semibold text-white leading-tight truncate drop-shadow-md">
                  {isMe ? "You" : getUserDisplayName(p)}
                </span>
                <span className="text-[8px] text-white/60 leading-none truncate">{roomLevel}</span>
              </div>
              <div className="flex-shrink-0 opacity-80">
                {p.isMuted ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
          </>
        ) : remoteVideoStream ? (
          <>
            <RemoteVideoPreview stream={remoteVideoStream} className={isMe && localVideoFlipped ? "scale-x-[-1]" : ""} />
            {fillMode && (
              <>
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-[24]" />
                <div className="absolute inset-x-0 bottom-0 z-[26] flex items-center gap-1.5 px-2 pb-2 pt-1">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/60 shadow-lg flex-shrink-0">
                    {p.profileImageUrl ? (
                      <img src={p.profileImageUrl} alt={getUserDisplayName(p)} width={32} height={32} className="w-full h-full object-cover" style={{ imageRendering: "auto", backfaceVisibility: "hidden", transform: "translateZ(0)" }} />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                        <span className="text-[9px] font-bold text-white">{getUserInitials(p)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1 min-w-0">
                      {isRoomOwner && <Crown className="w-3 h-3 text-yellow-300 flex-shrink-0" />}
                      <span className="text-[11px] font-semibold text-white leading-tight truncate drop-shadow-md">{isMe ? "You" : getUserDisplayName(p)}</span>
                    </div>
                    {isSpeaking && <span className="text-[9px] text-green-400 font-medium leading-none">Speaking…</span>}
                  </div>
                  <div className="flex-shrink-0 opacity-80">
                    {p.isMuted ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
                  </div>
                </div>
              </>
            )}
          </>
        ) : avatarGifUrl ? (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-0 z-0"
              style={{
                backgroundImage: `url('${proxyMediaUrl(avatarGifUrl)}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: 0.9,
                filter: "brightness(0.88) saturate(0.95)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-[1]" />
            <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center gap-1 px-1.5 pb-1.5 pt-1">
              <div className="w-7 h-7 rounded-full overflow-hidden border border-white/60 shadow-md flex-shrink-0">
                {p.profileImageUrl ? (
                  <img src={p.profileImageUrl} alt={getUserDisplayName(p)} width={28} height={28} className="w-full h-full object-cover" style={{ imageRendering: "auto", backfaceVisibility: "hidden", transform: "translateZ(0)" }} />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <span className="text-[8px] font-bold text-white">{getUserInitials(p)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[9px] font-semibold text-white leading-tight truncate drop-shadow-md">
                  {isMe ? "You" : getUserDisplayName(p)}
                </span>
              </div>
              <div className="flex-shrink-0 opacity-80">
                {p.isMuted ? <MicOff className="w-3 h-3 text-white" /> : <Mic className="w-3 h-3 text-white" />}
              </div>
            </div>
          </>
        ) : hologramVideoUrl ? (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-0 z-0"
              style={{
                backgroundImage: `url('${proxyMediaUrl(hologramVideoUrl)}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: 0.88,
                filter: "brightness(0.82) saturate(0.95)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-[1]" />
            <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center gap-1 px-1.5 pb-1.5 pt-1">
              <div className="w-7 h-7 rounded-full overflow-hidden border border-white/60 shadow-md flex-shrink-0">
                {p.profileImageUrl ? (
                  <img src={p.profileImageUrl} alt={getUserDisplayName(p)} width={28} height={28} className="w-full h-full object-cover" style={{ imageRendering: "auto", backfaceVisibility: "hidden", transform: "translateZ(0)" }} />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <span className="text-[8px] font-bold text-white">{getUserInitials(p)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[9px] font-semibold text-white leading-tight truncate drop-shadow-md">
                  {isMe ? "You" : getUserDisplayName(p)}
                </span>
              </div>
              <div className="flex-shrink-0 opacity-80">
                {p.isMuted ? <MicOff className="w-3 h-3 text-white" /> : <Mic className="w-3 h-3 text-white" />}
              </div>
            </div>
          </>
        ) : p.profileImageUrl ? (
          <img
            src={p.profileImageUrl}
            alt={getUserDisplayName(p)}
            loading="lazy"
            width={200}
            height={200}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ imageRendering: "auto", backfaceVisibility: "hidden", transform: "translateZ(0)" }}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 p-3`}>
            <div className={`${fillMode ? "w-20 h-20 sm:w-24 sm:h-24" : "w-3/4 h-3/4"} max-w-full rounded-full overflow-hidden border-2 border-white/20 shadow-lg flex-shrink-0`}>
              {p.profileImageUrl ? (
                <img src={p.profileImageUrl} alt={getUserDisplayName(p)} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/20">
                  <span className={`font-bold text-white ${fillMode ? "text-3xl sm:text-4xl" : "text-xs"}`}>{getUserInitials(p)}</span>
                </div>
              )}
            </div>
            {fillMode && (
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex items-center gap-1.5">
                  {isRoomOwner && <Crown className="w-3.5 h-3.5 text-yellow-300" />}
                  <span className="text-sm font-semibold text-white drop-shadow-md truncate max-w-[160px]">{isMe ? "You" : getUserDisplayName(p)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/50 text-[11px]">
                  <VideoOff className="w-3.5 h-3.5" />
                  <span>Camera off</span>
                  {p.isMuted && <span className="flex items-center gap-0.5 ml-1"><MicOff className="w-3 h-3" /> Muted</span>}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 z-10 pointer-events-none">
            <div className="text-center bg-black/50 w-full h-full absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 gap-1">
              {showVideoIcon && !isMe ? (
                <>
                  <Video className="w-5 h-5 text-white/80 drop-shadow-md" />
                  <span className="text-[10px] text-white/70 font-semibold drop-shadow-md">Expand</span>
                </>
              ) : (
                <span className="text-xs sm:text-sm font-bold text-white drop-shadow-md leading-tight break-words line-clamp-2 px-2">
                  {getUserDisplayName(p).split(' ').join('\n')}
                </span>
              )}
            </div>
        </div>

        {(() => {
          const overlayMap: Record<string, { icon: string; label: string; bg: string; border: string; color: string; shadow: string }> = {
            busy:   { icon: "⛔", label: "BUSY",     bg: "rgba(20,0,0,0.72)",    border: "rgba(239,68,68,0.55)",   color: "rgb(252,165,165)", shadow: "0 2px 10px rgba(239,68,68,0.4)" },
            afk:    { icon: "👤", label: "AWAY",     bg: "rgba(0,10,20,0.72)",   border: "rgba(56,189,248,0.55)",  color: "rgb(125,211,252)", shadow: "0 2px 10px rgba(56,189,248,0.4)" },
            brb:    { icon: "⏱", label: "BRB",      bg: "rgba(20,12,0,0.72)",   border: "rgba(245,158,11,0.55)",  color: "rgb(252,211,77)",  shadow: "0 2px 10px rgba(245,158,11,0.4)" },
            zz:     { icon: "💤", label: "ZZ",       bg: "rgba(8,4,24,0.72)",    border: "rgba(99,102,241,0.55)",  color: "rgb(165,180,252)", shadow: "0 2px 10px rgba(99,102,241,0.4)" },
          };
          const o = overlayMap[roomPresenceStatus];
          if (!o) return null;
          return (
            <div className="absolute top-1 left-1 z-20 pointer-events-none">
              <div
                className="inline-flex items-center gap-0.5 text-[8px] font-extrabold tracking-widest px-1.5 py-0.5 rounded-full backdrop-blur-sm"
                style={{ background: o.bg, border: `1px solid ${o.border}`, color: o.color, boxShadow: o.shadow }}
              >
                <span>{o.icon}</span>
                <span>{o.label}</span>
              </div>
            </div>
          );
        })()}

        {(showScreenIcon || showYoutubeIcon || showBookIcon || isWatcher || showMovieIcon || isMovieWatcherBadge) && (
          <div className="absolute top-1 right-8 z-20 flex items-center gap-0.5 animate-pulse drop-shadow-md" onClick={(e) => e.stopPropagation()}>
             {showScreenIcon && (
                <div className="bg-orange-600/90 p-1 rounded-sm shadow pointer-events-none">
                   <Monitor className="w-3 h-3 text-white" />
                </div>
             )}
             {showYoutubeIcon && !showScreenIcon && (
                onWatchYoutube && !isMe ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onWatchYoutube(); }}
                    className="bg-red-600 hover:bg-red-500 p-1 rounded-sm shadow cursor-pointer pointer-events-auto transition-colors"
                    title="Tap to watch this video"
                    data-testid={`button-watch-yt-${p.id}`}
                  >
                    <Youtube className="w-3 h-3 text-white" />
                  </button>
                ) : (
                  <div className="bg-red-600 p-1 rounded-sm shadow pointer-events-none">
                    <Youtube className="w-3 h-3 text-white" />
                  </div>
                )
             )}
             {showMovieIcon && !showScreenIcon && !showYoutubeIcon && (
                onWatchMovie && !isMe ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onWatchMovie(); }}
                    className="bg-violet-600 hover:bg-violet-500 p-1 rounded-sm shadow cursor-pointer pointer-events-auto transition-colors"
                    title="Tap to watch this movie"
                    data-testid={`button-watch-movie-${p.id}`}
                  >
                    <Film className="w-3 h-3 text-white" />
                  </button>
                ) : (
                  <div className="bg-violet-600 p-1 rounded-sm shadow pointer-events-none">
                    <Film className="w-3 h-3 text-white" />
                  </div>
                )
             )}
             {isWatcher && !showScreenIcon && !showYoutubeIcon && (
                <div className="bg-red-500/80 p-1 rounded-sm shadow flex items-center gap-0.5 pointer-events-none">
                   <Eye className="w-3 h-3 text-white" />
                </div>
             )}
             {isMovieWatcherBadge && !showScreenIcon && !showYoutubeIcon && !showMovieIcon && (
                <div className="bg-violet-500/80 p-1 rounded-sm shadow flex items-center gap-0.5 pointer-events-none">
                   <Eye className="w-3 h-3 text-white" />
                </div>
             )}
             {showBookIcon && !showScreenIcon && (
                <div className="bg-amber-600 p-1 rounded-sm shadow pointer-events-none">
                   <BookOpen className="w-3 h-3 text-white" />
                </div>
             )}
          </div>
        )}

        {/* DM unread badge on participant card — only shown on the current user's
            own card so they can see all incoming DMs in one place. Displays the
            sender's name and count; clicking opens the DM thread. */}
        {isMe && dmUnreadCount > 0 && (() => {
          const sender = dmFirstUnreadSenderId
            ? allParticipants?.find((p2: any) => p2.id === dmFirstUnreadSenderId)
            : null;
          const senderName = sender ? getUserDisplayName(sender) : null;
          return (
            <button
              className="absolute top-1 left-1 z-30 animate-in fade-in zoom-in-75 pointer-events-auto cursor-pointer flex flex-col items-center gap-[2px]"
              data-testid={`badge-room-dm-unread-${p.id}`}
              title={`${dmUnreadCount} unread message${dmUnreadCount !== 1 ? "s" : ""}${senderName ? ` from ${senderName}` : ""} — click to open`}
              onClick={(e) => {
                e.stopPropagation();
                if (onNavigateDm) onNavigateDm(dmFirstUnreadSenderId ?? p.id);
              }}
            >
              <div
                className="flex items-center gap-[3px] px-[5px] py-[3px] rounded text-white font-bold hover:scale-110 transition-transform active:scale-95"
                style={{
                  background: "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)",
                  boxShadow: "0 0 8px rgba(239,68,68,0.7), 0 0 16px rgba(239,68,68,0.35)",
                  fontSize: "10px",
                  lineHeight: 1,
                  minWidth: "20px",
                  border: "1.5px solid rgba(255,255,255,0.28)",
                }}
              >
                <MessageSquare style={{ width: 10, height: 10, flexShrink: 0 }} />
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{dmUnreadCount > 9 ? "9+" : dmUnreadCount}</span>
              </div>
              {senderName && (
                <div
                  className="px-[4px] py-[1px] rounded text-white font-semibold leading-none truncate max-w-[64px]"
                  style={{
                    background: "rgba(0,0,0,0.72)",
                    fontSize: "8px",
                    border: "1px solid rgba(255,255,255,0.18)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {senderName}
                </div>
              )}
            </button>
          );
        })()}

        {gearPopover}


        {!(hasActiveYoutube && youtubeVideoId) && !hasActiveMovie && !(isMovieWatcherBadge && watchingMoviePoster) && (isRoomOwner ? (
          <div
            className="absolute bottom-0 left-0 text-[10px] font-bold px-1.5 py-0.5 rounded-tr-md shadow-sm z-20 flex items-center gap-0.5"
            style={{
              background: "linear-gradient(145deg, hsl(var(--neu-orange-hi) / 0.95) 0%, hsl(var(--neu-orange-lo) / 0.92) 100%)",
              boxShadow: "0 0 10px hsl(var(--neu-orange) / 0.45), inset 0 1px 0 rgba(220,210,255,0.30)",
              color: "#fff",
            }}
          >
            👑 Owner
          </div>
        ) : participantRole === "co-owner" ? (
          <div
            className="absolute bottom-0 left-0 text-[10px] font-bold px-1.5 py-0.5 rounded-tr-md shadow-sm z-20 flex items-center gap-0.5"
            style={{
              background: "linear-gradient(145deg, rgba(56,189,248,0.85) 0%, rgba(14,165,233,0.82) 100%)",
              boxShadow: "0 0 8px rgba(56,189,248,0.35), inset 0 1px 0 rgba(186,230,253,0.25)",
              color: "#fff",
            }}
          >
            ⚡ Co-Owner
          </div>
        ) : participantRole === "guest" ? (
          <div
            className="absolute bottom-0 left-0 text-[10px] font-bold px-1.5 py-0.5 rounded-tr-md shadow-sm z-20 flex items-center gap-0.5"
            style={{
              background: "linear-gradient(145deg, rgba(99,102,241,0.82) 0%, rgba(67,56,202,0.80) 100%)",
              boxShadow: "0 0 8px rgba(99,102,241,0.35), inset 0 1px 0 rgba(199,210,254,0.20)",
              color: "#fff",
            }}
          >
            🎫 Guest
          </div>
        ) : participantRole === "troll" ? (
          <div
            className="absolute bottom-0 left-0 text-[10px] font-bold px-1.5 py-0.5 rounded-tr-md shadow-sm z-20 flex items-center gap-0.5"
            style={{
              background: "linear-gradient(145deg, rgba(161,124,0,0.88) 0%, rgba(120,90,0,0.85) 100%)",
              boxShadow: "0 0 8px rgba(234,179,8,0.40), inset 0 1px 0 rgba(253,224,71,0.22)",
              color: "#fde047",
            }}
          >
            🧌 Troll
          </div>
        ) : isMe ? (
          <div className="absolute bottom-0 left-0 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-tr-md shadow-sm z-20">
            You
          </div>
        ) : null)}

        {!(hasActiveYoutube && youtubeVideoId) && !hasActiveMovie && !(isMovieWatcherBadge && watchingMoviePoster) && !avatarGifUrl && (
          p.isMuted ? (
            /* Muted: mic-off icon in corner */
            <div className="absolute bottom-1 right-1 z-20 drop-shadow-md">
              <MicOff className="w-4 h-4 text-white/80" />
            </div>
          ) : (
            /* Live mic: stacked VU meter flush at bottom-right, replaces mic icon */
            <div className="absolute bottom-0 right-1 z-20 pointer-events-none">
              <MicVoiceBar analyserNode={analyserNode} isSpeaking={isSpeaking} />
            </div>
          )
        )}

        {/* Note: the old static "raise hand" badge here has been replaced by
            the floating mood emoji that animates above the card (see top of
            avatarContent above). */}

      </div>
    </div>
  );

  return (
    <ProfileDecoration decorationId={(p as any).profileDecoration} size={Math.max(48, cardPx - 16)}>
      <div 
         className="cursor-pointer" 
         onClick={onProfileClick} 
         data-testid={`card-wrapper-${p.id}`}
      >
        {avatarContent}
      </div>
    </ProfileDecoration>
  );
}

// Single neumorphic permission tile shared by mic / camera / screen / youtube.
// One tap cycles through the allowed scopes — far faster than 4 stacked
// dropdowns when the host wants to lock things down quickly.
type PermValue = "everyone" | "members" | "co_owners" | "owner_only" | "muted";
type PermTileProps = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  value: PermValue;
  onChange: (next: PermValue) => void;
  withMuted?: boolean;
  testId?: string;
};
function PermTile({ label, Icon, value, onChange, withMuted, testId }: PermTileProps) {
  const order: PermValue[] = withMuted
    ? ["everyone", "members", "co_owners", "owner_only", "muted"]
    : ["everyone", "members", "co_owners", "owner_only"];
  const i = Math.max(0, order.indexOf(value));
  const next = order[(i + 1) % order.length];
  // Per-scope visual + copy tokens. Long labels make the pill self-explanatory
  // ("Everyone", "Co-hosts only") while the accent colour tells the host at a
  // glance how locked-down each capability is (green = open → red = muted).
  const meta: Record<PermValue, {
    short: string;
    long: string;
    accent: string;     // e.g. "emerald"
    ringFrom: string;
    ringTo: string;
  }> = {
    everyone:   { short: "All",     long: "Everyone",         accent: "emerald", ringFrom: "rgba(16,185,129,0.55)", ringTo: "rgba(16,185,129,0.10)" },
    members:    { short: "Members", long: "Members only",     accent: "violet",  ringFrom: "rgba(139,92,246,0.55)",  ringTo: "rgba(139,92,246,0.10)" },
    co_owners:  { short: "Hosts",   long: "Co-hosts only",   accent: "sky",     ringFrom: "rgba(56,189,248,0.55)",  ringTo: "rgba(56,189,248,0.10)" },
    owner_only: { short: "Host",    long: "Host only",        accent: "amber",   ringFrom: "rgba(251,191,36,0.55)",  ringTo: "rgba(251,191,36,0.10)" },
    muted:      { short: "Muted",   long: "All muted",        accent: "rose",    ringFrom: "rgba(244,63,94,0.55)",   ringTo: "rgba(244,63,94,0.10)" },
  };
  const m = meta[value];
  const nextMeta = meta[next];
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      className="host-perm-tile"
      data-accent={m.accent}
      style={{ ["--perm-ring-from" as any]: m.ringFrom, ["--perm-ring-to" as any]: m.ringTo }}
      title={`${label}: ${m.long} — tap to set to ${nextMeta.long}`}
      aria-label={`${label} permission: ${m.long}. Tap to change to ${nextMeta.long}.`}
      data-testid={testId}
    >
      <span className="host-perm-tile-strip" aria-hidden="true" />
      <span className="host-perm-tile-head">
        <span className="host-perm-tile-icon"><Icon className="w-[16px] h-[16px]" /></span>
        <span className="host-perm-tile-label">{label}</span>
      </span>
      <span className="host-perm-tile-scope">
        <span className="host-perm-tile-dot" aria-hidden="true" />
        <span className="host-perm-tile-scope-text">{m.long}</span>
      </span>
    </button>
  );
}

function YtVideoCard({ video, canPlay, onPlay, onQueue }: {
  video: { id: string; title: string; thumbnail: string; channelTitle?: string; duration?: string };
  canPlay: boolean;
  onPlay: (id: string) => void;
  onQueue: (v: { id: string; title: string; thumbnail: string }) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-border/30 bg-muted/10 hover:border-border/50 transition-all duration-150 group">
      <div className="relative w-full aspect-video bg-muted overflow-hidden cursor-pointer" onClick={() => onPlay(video.id)}>
        <img loading={canPlay ? "eager" : "lazy"} decoding="async" src={video.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {video.duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />{video.duration}
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>
      <div className="p-2.5 pb-2">
        <p className="text-[12px] font-medium line-clamp-2 leading-snug">{video.title}</p>
        {video.channelTitle && (
          <span className="text-[10px] text-muted-foreground/60 mt-1 block truncate">{video.channelTitle}</span>
        )}
        {canPlay && (
          <div className="flex gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => onPlay(video.id)}
              className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-medium hover:bg-red-500/25 transition-colors"
            >
              <Play className="w-2.5 h-2.5 fill-red-400" /> Play Now
            </button>
            <button
              type="button"
              onClick={() => onQueue({ id: video.id, title: video.title, thumbnail: video.thumbnail })}
              className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-muted/20 border border-border/30 text-muted-foreground text-[10px] font-medium hover:bg-muted/40 transition-colors"
            >
              <ListVideo className="w-2.5 h-2.5" /> Add to Queue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DJ Mode sling-animation helper ───────────────────────────────────────────
function getDjSlingStyle(index: number): React.CSSProperties {
  const ANIMS = ["dj-sling-a","dj-sling-b","dj-sling-c","dj-sling-d","dj-sling-e","dj-sling-f"];
  const DURS  = [1.4, 1.7, 1.2, 1.9, 1.5, 1.3];
  const DELS  = [0, 0.25, 0.5, 0.1, 0.38, 0.62];
  const v = index % 6;
  return { animation: `${ANIMS[v]} ${DURS[v]}s cubic-bezier(0.34,1.56,0.64,1) infinite ${DELS[v]}s` };
}

// ── DJ scene → beat-drop color (rgba components, no alpha) ─────────────────
const DJ_SCENE_COLORS: Record<string, string> = {
  spotlight: "255,210,0",
  namestorm: "80,200,255",
  disco:     "255,0,200",
  kiss:      "255,60,120",
  cocktails: "0,255,180",
  boomer:    "255,140,0",
  laser:     "0,255,100",
  fireworks: "255,120,0",
  aurora:    "0,255,200",
  vortex:    "180,0,255",
  matrix:    "0,255,70",
};
function getDjBeatColor(scene: string): string {
  return DJ_SCENE_COLORS[scene] || "200,100,255";
}

// ── DJ auto-cycle order — all 10 styles rotate so cards are visually varied ──
const DJ_AUTO_CYCLE = [
  "sling","wave","bounce","pulse","tilt","orbit","float","wiggle","slam","spin","stretch","shake",
] as const;

// ── DJ Movement styles helper ────────────────────────────────────────────────
function getDjMoveStyle(index: number, style: string): React.CSSProperties {
  if (style === "sling") return getDjSlingStyle(index);
  if (style === "bounce") {
    const durs = [1.0, 1.2, 0.9, 1.1, 0.8, 1.3];
    const dels = [0, 0.2, 0.4, 0.1, 0.3, 0.5];
    return { animation: `dj-bounce ${durs[index % 6]}s ease-in-out infinite ${dels[index % 6]}s` };
  }
  if (style === "spin") {
    const spds = [2.0, 2.5, 1.8, 2.2, 3.0, 2.7];
    return { animation: `dj-spin ${spds[index % 6]}s linear infinite` };
  }
  if (style === "float") {
    const durs = [2.5, 3.0, 2.2, 2.8, 3.5, 2.4];
    const dels = [0, 0.5, 1.0, 0.3, 0.8, 0.2];
    return { animation: `dj-float ${durs[index % 6]}s ease-in-out infinite ${dels[index % 6]}s` };
  }
  if (style === "wave") {
    const durs = [1.3, 1.6, 1.1, 1.8, 1.4, 1.5];
    const dels = [0, 0.22, 0.44, 0.11, 0.33, 0.55];
    return { animation: `dj-wave ${durs[index % 6]}s ease-in-out infinite ${dels[index % 6]}s` };
  }
  if (style === "pulse") {
    const durs = [0.8, 1.0, 0.7, 0.9, 1.1, 0.75];
    const dels = [0, 0.15, 0.32, 0.08, 0.25, 0.42];
    return { animation: `dj-pulse ${durs[index % 6]}s ease-in-out infinite ${dels[index % 6]}s` };
  }
  if (style === "tilt") {
    const durs = [1.2, 1.5, 1.0, 1.4, 1.6, 1.1];
    const dels = [0, 0.28, 0.52, 0.14, 0.38, 0.64];
    return { animation: `dj-tilt ${durs[index % 6]}s ease-in-out infinite ${dels[index % 6]}s` };
  }
  if (style === "orbit") {
    const durs = [2.2, 2.8, 1.9, 2.5, 3.2, 2.1];
    const dels = [0, 0.4, 0.8, 0.2, 0.6, 1.0];
    return { animation: `dj-orbit ${durs[index % 6]}s cubic-bezier(0.4,0,0.6,1) infinite ${dels[index % 6]}s` };
  }
  if (style === "shake") {
    const durs = [0.55, 0.65, 0.50, 0.60, 0.70, 0.58];
    const dels = [0, 0.12, 0.24, 0.06, 0.18, 0.30];
    return { animation: `dj-shake ${durs[index % 6]}s ease-in-out infinite ${dels[index % 6]}s` };
  }
  if (style === "slam") {
    const durs = [1.4, 1.7, 1.2, 1.6, 1.9, 1.3];
    const dels = [0, 0.3, 0.6, 0.15, 0.45, 0.75];
    return { animation: `dj-slam ${durs[index % 6]}s cubic-bezier(0.34,1.56,0.64,1) infinite ${dels[index % 6]}s` };
  }
  if (style === "wiggle") {
    const durs = [0.7, 0.85, 0.6, 0.8, 0.95, 0.72];
    const dels = [0, 0.18, 0.35, 0.09, 0.27, 0.45];
    return { animation: `dj-wiggle ${durs[index % 6]}s ease-in-out infinite ${dels[index % 6]}s` };
  }
  if (style === "stretch") {
    const durs = [1.1, 1.4, 0.95, 1.25, 1.5, 1.05];
    const dels = [0, 0.24, 0.48, 0.12, 0.36, 0.60];
    return { animation: `dj-stretch ${durs[index % 6]}s ease-in-out infinite ${dels[index % 6]}s` };
  }
  return {};
}

// ── DJ Scene Overlay — full-screen effects driven by scene name ──────────────
function DjSceneOverlay({ scene, participants, active }: {
  scene: string;
  participants: Array<{ id: string; displayName?: string | null; firstName?: string | null }>;
  active: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active || scene === "spotlight") { setTick(0); return; }
    const id = setInterval(() => setTick(t => t + 1), 120);
    return () => clearInterval(id);
  }, [active, scene]);

  if (!active || scene === "spotlight") return null;
  const names = participants.map(p => p.displayName || p.firstName || "?").filter(Boolean);
  if (names.length === 0) return null;

  if (scene === "namestorm") {
    return (
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9997, overflow:"hidden" }}>
        {names.map((name, i) => {
          const x = 50 + Math.sin(tick * 0.07 + i * 2.1) * 38;
          const y = 50 + Math.cos(tick * 0.06 + i * 1.8) * 32;
          const rot = Math.sin(tick * 0.04 + i) * 28;
          const sc = 0.75 + Math.abs(Math.sin(tick * 0.09 + i * 0.7)) * 0.7;
          const col = `hsl(${(i * 55 + tick * 2) % 360},100%,65%)`;
          return (
            <div key={i} style={{
              position:"absolute", left:`${x}%`, top:`${y}%`,
              transform:`translate(-50%,-50%) rotate(${rot}deg) scale(${sc})`,
              color:col, fontSize:`${14 + (i % 3) * 9}px`,
              fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase",
              textShadow:`0 0 14px ${col}`,
              opacity:0.65 + Math.abs(Math.sin(tick * 0.08 + i)) * 0.35,
              whiteSpace:"nowrap",
            }}>{name}</div>
          );
        })}
      </div>
    );
  }
  if (scene === "disco") {
    const ballFlash = tick % 8 < 4;
    return (
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9997, overflow:"hidden" }}>
        {/* Disco ball beams — 16 beams rotating */}
        {Array.from({length:16}).map((_, i) => {
          const deg = i * 22.5;
          const hue = (i * 22 + tick * 5) % 360;
          return (
            <div key={i} style={{
              position:"absolute", top:"50%", left:"50%",
              width:2, height:"80vh",
              background:`linear-gradient(to bottom,transparent 0%,hsl(${hue},100%,65%) 55%,transparent 100%)`,
              transformOrigin:"0% 0%",
              transform:`rotate(${deg + tick * 2}deg)`,
              opacity:0.28 + (i % 3) * 0.08,
            }} />
          );
        })}
        {/* Secondary counter-rotating beams */}
        {Array.from({length:8}).map((_, i) => {
          const hue = (i * 45 + tick * 3 + 180) % 360;
          return (
            <div key={`r${i}`} style={{
              position:"absolute", top:"50%", left:"50%",
              width:1.5, height:"60vh",
              background:`linear-gradient(to bottom,transparent 0%,hsl(${hue},100%,75%) 60%,transparent 100%)`,
              transformOrigin:"0% 0%",
              transform:`rotate(${i * 45 - tick * 1.5}deg)`,
              opacity:0.22,
            }} />
          );
        })}
        {/* Disco ball center */}
        <div style={{
          position:"absolute", top:"50%", left:"50%",
          transform:"translate(-50%,-50%)",
          width:60, height:60, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(255,255,255,0.95) 10%,rgba(255,255,255,0) 70%)",
          boxShadow:`0 0 ${ballFlash ? 60 : 30}px ${ballFlash ? 30 : 10}px rgba(255,255,255,0.35)`,
          transition:"box-shadow 0.15s",
        }} />
        {/* Floor glow sweep */}
        <div style={{
          position:"absolute", bottom:0, left:0, right:0, height:"35%",
          background:`linear-gradient(to top,rgba(${(tick*3)%255},0,${(200-tick*2)%255},0.12) 0%,transparent 100%)`,
          mixBlendMode:"screen",
        }} />
      </div>
    );
  }
  if (scene === "kiss") {
    const hearts = ["💋","❤️","💗","💖","💕","😘","💓","💝"];
    return (
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9997, overflow:"hidden" }}>
        {Array.from({length:14}).map((_, i) => {
          const progress = ((tick * 0.6 + i * 22) % 110) / 100;
          return (
            <div key={i} style={{
              position:"absolute",
              left:`${8 + ((i * 7 + tick * 0.3) % 84)}%`,
              bottom:`${progress * 105 - 5}%`,
              fontSize:`${16 + (i % 4) * 8}px`,
              opacity:Math.max(0, 1 - progress * 1.1),
              transform:`rotate(${Math.sin(tick * 0.04 + i) * 22}deg) scale(${0.7 + progress * 0.5})`,
            }}>{hearts[i % hearts.length]}</div>
          );
        })}
      </div>
    );
  }
  if (scene === "cocktails") {
    const items = ["🍹","🥂","🎉","🍸","✨","🎊","🍾","🥳","🎈","🎆"];
    return (
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9997, overflow:"hidden" }}>
        {Array.from({length:18}).map((_, i) => (
          <div key={i} style={{
            position:"absolute",
            left:`${(i * 5.5 + tick * 0.35) % 100}%`,
            top:`${(tick * 0.45 + i * 18) % 115 - 10}%`,
            fontSize:`${14 + (i % 4) * 7}px`, opacity:0.85,
            transform:`rotate(${tick * 1.8 + i * 22}deg)`,
          }}>{items[i % items.length]}</div>
        ))}
        {Array.from({length:22}).map((_, i) => (
          <div key={`cf${i}`} style={{
            position:"absolute",
            left:`${(i * 4.5 + tick * 0.55) % 100}%`,
            top:`${(tick * 0.5 + i * 14) % 110 - 5}%`,
            width:7, height:3, borderRadius:2,
            background:`hsl(${(i * 17 + tick) % 360},100%,60%)`,
            opacity:0.7, transform:`rotate(${tick * 3 + i * 15}deg)`,
          }} />
        ))}
      </div>
    );
  }
  if (scene === "boomer") {
    const words = names.length > 0 ? names : ["OK BOOMER"];
    const idx = Math.floor(tick / 14) % words.length;
    const phase = tick % 14;
    const sc = phase < 7 ? 0.3 + phase * 0.25 : 2.05 - (phase - 7) * 0.25;
    const op = phase < 2 ? phase / 2 : phase > 12 ? (14 - phase) / 2 : 1;
    return (
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9997, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{
          fontSize:"clamp(32px,10vw,90px)", fontWeight:900,
          fontFamily:"'Impact','Arial Black',sans-serif",
          letterSpacing:"0.03em", textTransform:"uppercase",
          color:`hsl(${(idx * 70 + tick * 2) % 360},100%,55%)`,
          textShadow:"3px 3px 0 rgba(0,0,0,0.6), 0 0 40px currentColor",
          transform:`scale(${sc}) rotate(${Math.sin(tick * 0.15) * 6}deg)`,
          opacity:op, whiteSpace:"nowrap",
        }}>{words[idx]}</div>
      </div>
    );
  }

  // ── LASER — diagonal scanning laser beams + grid ────────────────────────────
  if (scene === "laser") {
    return (
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9997, overflow:"hidden" }}>
        {/* Horizontal scanning beams */}
        {Array.from({length:6}).map((_, i) => {
          const y = ((tick * 1.8 + i * 28) % 115) - 5;
          const hue = (i * 60 + tick * 4) % 360;
          return (
            <div key={`h${i}`} style={{
              position:"absolute", left:0, right:0,
              top:`${y}%`, height:2,
              background:`linear-gradient(to right, transparent 0%, hsl(${hue},100%,65%) 30%, hsl(${hue},100%,90%) 50%, hsl(${hue},100%,65%) 70%, transparent 100%)`,
              boxShadow:`0 0 8px 2px hsl(${hue},100%,60%)`,
              opacity:0.85,
            }} />
          );
        })}
        {/* Diagonal beams */}
        {Array.from({length:4}).map((_, i) => {
          const offX = ((tick * 1.2 + i * 30) % 130) - 15;
          const hue = (i * 90 + tick * 6 + 120) % 360;
          return (
            <div key={`d${i}`} style={{
              position:"absolute", top:"-20%", bottom:"-20%",
              left:`${offX}%`, width:1.5,
              background:`linear-gradient(to bottom, transparent 0%, hsl(${hue},100%,70%) 40%, hsl(${hue},100%,90%) 50%, hsl(${hue},100%,70%) 60%, transparent 100%)`,
              boxShadow:`0 0 6px 2px hsl(${hue},100%,55%)`,
              transform:"rotate(15deg)",
              opacity:0.65,
            }} />
          );
        })}
        {/* Grid nodes — laser intersection points */}
        {Array.from({length:16}).map((_, i) => {
          const gx = 10 + (i % 4) * 25;
          const gy = 10 + Math.floor(i / 4) * 30;
          const pulse = Math.abs(Math.sin(tick * 0.12 + i * 0.9));
          return (
            <div key={`g${i}`} style={{
              position:"absolute", left:`${gx}%`, top:`${gy}%`,
              width:5, height:5, borderRadius:"50%",
              background:`hsl(${(i * 22 + tick * 5) % 360},100%,70%)`,
              boxShadow:`0 0 ${8 + pulse * 12}px ${4 + pulse * 6}px hsl(${(i * 22 + tick * 5) % 360},100%,60%)`,
              transform:"translate(-50%,-50%)",
              opacity:0.5 + pulse * 0.5,
            }} />
          );
        })}
      </div>
    );
  }

  // ── FIREWORKS — bursting particle explosions ────────────────────────────────
  if (scene === "fireworks") {
    const BURST_COUNT = 5;
    return (
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9997, overflow:"hidden" }}>
        {Array.from({length:BURST_COUNT}).map((_, b) => {
          const burstTick = (tick + b * 31) % 60;
          const progress = burstTick / 60;
          const cx = 15 + (b * 17 + Math.floor(tick / 60) * 13) % 70;
          const cy = 15 + (b * 23 + Math.floor(tick / 60) * 11) % 55;
          const hue = (b * 72 + Math.floor(tick / 60) * 137) % 360;
          const burst = progress > 0.15;
          const alpha = burst ? Math.max(0, 1 - (progress - 0.15) / 0.85) : progress / 0.15;
          if (!burst) {
            // Rising trail
            return (
              <div key={b} style={{
                position:"absolute", left:`${cx}%`, bottom:`${(1 - progress / 0.15) * 45}%`,
                width:4, height:4, borderRadius:"50%",
                background:`hsl(${hue},100%,90%)`,
                boxShadow:`0 0 6px 3px hsl(${hue},100%,70%)`,
                opacity:alpha,
              }} />
            );
          }
          // Burst particles
          const r = (progress - 0.15) / 0.85 * 22;
          return (
            <div key={b} style={{ position:"absolute", left:`${cx}%`, top:`${cy}%` }}>
              {Array.from({length:18}).map((_, p) => {
                const angle = (p / 18) * Math.PI * 2;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r + (progress - 0.15) * 8;
                const pHue = (hue + p * 20) % 360;
                return (
                  <div key={p} style={{
                    position:"absolute",
                    left:`${px}vw`, top:`${py}vh`,
                    width:5, height:5, borderRadius:"50%",
                    background:`hsl(${pHue},100%,75%)`,
                    boxShadow:`0 0 5px 2px hsl(${pHue},100%,65%)`,
                    transform:"translate(-50%,-50%)",
                    opacity:alpha * (0.6 + (p % 3) * 0.13),
                  }} />
                );
              })}
              {/* Star sparkles */}
              {Array.from({length:8}).map((_, s) => {
                const sa = (s / 8) * Math.PI * 2 + 0.4;
                const sr = (progress - 0.15) / 0.85 * 30;
                return (
                  <div key={`s${s}`} style={{
                    position:"absolute",
                    left:`${Math.cos(sa) * sr}vw`, top:`${Math.sin(sa) * sr}vh`,
                    fontSize:"10px", transform:"translate(-50%,-50%)",
                    opacity:alpha * 0.9,
                  }}>✦</div>
                );
              })}
            </div>
          );
        })}
        {/* Trailing sparkle rain */}
        {Array.from({length:20}).map((_, i) => (
          <div key={`sp${i}`} style={{
            position:"absolute",
            left:`${(i * 5.3 + tick * 0.4) % 100}%`,
            top:`${(tick * 0.7 + i * 19) % 105 - 5}%`,
            width:3, height:3, borderRadius:"50%",
            background:`hsl(${(i * 18 + tick * 3) % 360},100%,80%)`,
            opacity:0.4 + Math.abs(Math.sin(tick * 0.1 + i)) * 0.5,
          }} />
        ))}
      </div>
    );
  }

  // ── AURORA — northern lights flowing curtains ───────────────────────────────
  if (scene === "aurora") {
    return (
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9997, overflow:"hidden" }}>
        {/* Aurora curtains — 8 flowing gradient bands */}
        {Array.from({length:8}).map((_, i) => {
          const baseHue = i % 2 === 0 ? 160 : 280;
          const hue = (baseHue + i * 18 + tick * 0.5) % 360;
          const hue2 = (hue + 40) % 360;
          const xOffset = Math.sin(tick * 0.03 + i * 0.8) * 12;
          const yShift = Math.cos(tick * 0.025 + i * 0.6) * 8;
          const skew = Math.sin(tick * 0.02 + i * 1.1) * 10;
          return (
            <div key={i} style={{
              position:"absolute",
              left:`${i * 13 + xOffset - 2}%`, top:`${-10 + yShift}%`,
              width:"16%", height:"70%",
              background:`linear-gradient(to bottom, transparent 0%, hsla(${hue},90%,65%,0.55) 25%, hsla(${hue2},85%,70%,0.40) 55%, hsla(${hue},80%,60%,0.20) 80%, transparent 100%)`,
              transform:`skewX(${skew}deg)`,
              filter:"blur(18px)",
              mixBlendMode:"screen",
            }} />
          );
        })}
        {/* Stars twinkle */}
        {Array.from({length:30}).map((_, i) => {
          const twinkle = 0.3 + Math.abs(Math.sin(tick * 0.08 + i * 1.3)) * 0.7;
          return (
            <div key={`st${i}`} style={{
              position:"absolute",
              left:`${(i * 3.37 + 1) % 99}%`,
              top:`${(i * 7.11) % 45}%`,
              width:Math.random() > 0.7 ? 3 : 2, height:Math.random() > 0.7 ? 3 : 2,
              borderRadius:"50%", background:"white",
              opacity:twinkle * 0.8,
            }} />
          );
        })}
        {/* Horizon glow */}
        <div style={{
          position:"absolute", bottom:0, left:0, right:0, height:"30%",
          background:"linear-gradient(to top, rgba(0,255,160,0.08) 0%, transparent 100%)",
          mixBlendMode:"screen",
        }} />
      </div>
    );
  }

  // ── VORTEX — spinning color spiral ─────────────────────────────────────────
  if (scene === "vortex") {
    return (
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9997, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {/* Concentric rotating rings */}
        {Array.from({length:12}).map((_, i) => {
          const radius = 40 + i * 30;
          const hue = (i * 30 + tick * 4) % 360;
          const rot = tick * (i % 2 === 0 ? 2.5 : -2) + i * 15;
          const segments = 8 + i * 2;
          return (
            <div key={i} style={{
              position:"absolute",
              width:radius, height:radius, borderRadius:"50%",
              border:`${3 - Math.min(i * 0.15, 1.5)}px solid hsla(${hue},100%,65%,${0.55 - i * 0.03})`,
              boxShadow:`0 0 ${10 + i * 2}px hsla(${hue},100%,65%,0.35), inset 0 0 ${6 + i}px hsla(${hue},100%,65%,0.15)`,
              transform:`translate(-50%,-50%) rotate(${rot}deg) scaleX(${1 + Math.sin(tick * 0.07 + i) * 0.15})`,
              left:"50%", top:"50%",
            }} />
          );
        })}
        {/* Center energy core */}
        <div style={{
          position:"absolute", left:"50%", top:"50%",
          width:30, height:30, borderRadius:"50%",
          background:`radial-gradient(circle, hsl(${(tick * 8) % 360},100%,90%) 0%, hsl(${(tick * 8 + 60) % 360},100%,55%) 60%, transparent 100%)`,
          boxShadow:`0 0 30px 15px hsla(${(tick * 8) % 360},100%,65%,0.7)`,
          transform:"translate(-50%,-50%)",
          animation:"dj-vortex-core 0.8s ease-in-out infinite alternate",
        }} />
        {/* Orbital particles */}
        {Array.from({length:24}).map((_, i) => {
          const angle = (i / 24) * Math.PI * 2 + tick * 0.05;
          const r = 80 + Math.sin(tick * 0.06 + i * 0.5) * 40;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r * 0.55;
          const pHue = (i * 15 + tick * 6) % 360;
          return (
            <div key={`p${i}`} style={{
              position:"absolute", left:"50%", top:"50%",
              width:5, height:5, borderRadius:"50%",
              background:`hsl(${pHue},100%,70%)`,
              boxShadow:`0 0 6px 3px hsl(${pHue},100%,60%)`,
              transform:`translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
              opacity:0.7 + Math.sin(tick * 0.08 + i) * 0.3,
            }} />
          );
        })}
      </div>
    );
  }

  // ── MATRIX — falling digital rain ──────────────────────────────────────────
  if (scene === "matrix") {
    const CHARS = "アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF█▓▒░";
    const COLS = 22;
    return (
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9997, overflow:"hidden", fontFamily:"monospace" }}>
        {Array.from({length:COLS}).map((_, col) => {
          const colSeed = col * 137;
          const speed = 0.8 + (colSeed % 7) * 0.3;
          const length = 6 + (colSeed % 10);
          return Array.from({length}).map((__, row) => {
            const charIdx = (Math.floor(tick * speed) + row + colSeed) % CHARS.length;
            const progress = ((tick * speed + row * 3) % (110 + colSeed % 30)) / 100;
            const isHead = row === 0;
            const brightness = isHead ? "95%" : `${Math.max(25, 75 - row * 8)}%`;
            return (
              <div key={`${col}-${row}`} style={{
                position:"absolute",
                left:`${(col / COLS) * 100 + 2}%`,
                top:`${(progress * 110) - 10 + row * 4.5}%`,
                color: isHead ? `hsl(120,100%,95%)` : `hsl(120,100%,${brightness})`,
                fontSize:14, lineHeight:1,
                textShadow: isHead ? "0 0 10px #00ff44, 0 0 20px #00ff44" : "0 0 4px #00cc33",
                opacity: isHead ? 1 : Math.max(0.08, 1 - row * 0.1),
              }}>{CHARS[charIdx]}</div>
            );
          });
        })}
        {/* Green ambient glow tint */}
        <div style={{
          position:"absolute", inset:0,
          background:"radial-gradient(ellipse at 50% 50%, rgba(0,255,60,0.04) 0%, transparent 70%)",
          mixBlendMode:"screen",
        }} />
      </div>
    );
  }

  return null;
}

const DJ_SPOT_COLS = [
  "255,0,200",   // magenta
  "0,220,255",   // cyan
  "255,200,0",   // gold
  "80,255,0",    // neon green
  "180,0,255",   // purple
  "255,80,0",    // orange
  "0,255,180",   // teal
  "255,0,80",    // hot pink
];

/* Module-level cache so books appear instantly on re-visit within the same session */
let _cachedDefaultBooks: any[] | null = null;
let _cachedDefaultBooksTs = 0;
const DEFAULT_BOOKS_TTL = 10 * 60 * 1000; // 10 min

/* ── Instant classics — shown immediately without any API call ───────────── */
const INSTANT_BOOKS = [
  { id: 1342, title: "Pride and Prejudice", authors: [{ name: "Jane Austen" }], download_count: 94736, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/1342/pg1342.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg" } },
  { id: 11,   title: "Alice's Adventures in Wonderland", authors: [{ name: "Lewis Carroll" }], download_count: 43025, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/11/pg11.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg" } },
  { id: 84,   title: "Frankenstein", authors: [{ name: "Mary Wollstonecraft Shelley" }], download_count: 31620, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/84/pg84.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg" } },
  { id: 1661, title: "The Adventures of Sherlock Holmes", authors: [{ name: "Arthur Conan Doyle" }], download_count: 29021, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/1661/pg1661.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/1661/pg1661.cover.medium.jpg" } },
  { id: 174,  title: "The Picture of Dorian Gray", authors: [{ name: "Oscar Wilde" }], download_count: 24522, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/174/pg174.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/174/pg174.cover.medium.jpg" } },
  { id: 345,  title: "Dracula", authors: [{ name: "Bram Stoker" }], download_count: 28455, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/345/pg345.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/345/pg345.cover.medium.jpg" } },
  { id: 76,   title: "Adventures of Huckleberry Finn", authors: [{ name: "Mark Twain" }], download_count: 17203, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/76/pg76.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/76/pg76.cover.medium.jpg" } },
  { id: 98,   title: "A Tale of Two Cities", authors: [{ name: "Charles Dickens" }], download_count: 22015, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/98/pg98.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/98/pg98.cover.medium.jpg" } },
  { id: 2701, title: "Moby Dick; Or, The Whale", authors: [{ name: "Herman Melville" }], download_count: 15628, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/2701/pg2701.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg" } },
  { id: 1513, title: "Romeo and Juliet", authors: [{ name: "William Shakespeare" }], download_count: 16543, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/1513/pg1513.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/1513/pg1513.cover.medium.jpg" } },
  { id: 5200, title: "Metamorphosis", authors: [{ name: "Franz Kafka" }], download_count: 18246, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/5200/pg5200.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/5200/pg5200.cover.medium.jpg" } },
  { id: 1184, title: "The Count of Monte Cristo", authors: [{ name: "Alexandre Dumas" }], download_count: 17412, formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/1184/pg1184.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/1184/pg1184.cover.medium.jpg" } },
];

export function VoiceRoom({ room: roomProp, onLeave, watchUserId }: VoiceRoomProps) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { toast } = useToast();
  const [roomData, setRoomData] = useState(roomProp);
  const room = roomData;
  const [isMuted, setIsMuted] = useState(true);
  const isMutedRef = useRef(true);
  // Stores the latest RMS level from the VoiceProcessor meter worklet.
  // Updated in the onLevelMeter callback (fires ~18 ms, before the destination
  // output track, so it reads real mic audio regardless of mute state).
  const micRmsRef = useRef<number>(0);
  const [handRaised, setHandRaised] = useState(false);
  // Mood reactions — when any participant fires a mood emoji from the picker,
  // we keep their currently-active emoji here keyed by userId. The floating
  // animation in ParticipantCard re-runs whenever the entry's `id` changes
  // (the `key` prop on the floating div), so picking the same emoji twice in a
  // row still re-triggers the animation. Entries are auto-cleared after the
  // animation duration so the card returns to its normal state.
  const [participantAvatarGifs, setParticipantAvatarGifs] = useState<Record<string, string>>({});
  const [participantMoods, setParticipantMoods] = useState<Record<string, { id: string; emoji: string }>>({}); 
  const [djModeActive, setDjModeActive] = useState(false);
  const djModeActiveRef = useRef(false);
  const djControlsBtnRef = useRef<HTMLButtonElement>(null);
  const [djDropdownPos, setDjDropdownPos] = useState<{ bottom: number; left: number } | null>(null);
  const [djCountdown, setDjCountdown] = useState<number | null>(null);
  const [djBeatDropTick, setDjBeatDropTick] = useState(0);
  const [djSpotlightIdx, setDjSpotlightIdx] = useState(-1);
  const [djCurrentScene, setDjCurrentScene] = useState<string>("spotlight");
  const [djAutoAdvance, setDjAutoAdvance] = useState(false);
  const [djMoveStyle, setDjMoveStyle] = useState<string>("auto");
  const [djMoveTick, setDjMoveTick] = useState(0);
  const [discoOverlaySceneIdx, setDiscoOverlaySceneIdx] = useState(0);
  const [discoHostPanelOpen, setDiscoHostPanelOpen] = useState(false);
  // Client-side dedup: suppress "X joined" messages that arrive within 3s of a
  // previous join for the same user (catches the server-side race before the
  // joiningNow fix takes effect, and handles edge cases like StrictMode mounts).
  const recentJoinsRef = useRef<Map<string, number>>(new Map());
  const moodTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Mood picker open/closed state (for the new emoji bar that replaced the
  // raise-hand button in the bottom control row).
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const [selectedVoicePresetId, setSelectedVoicePresetId] = useState<VoicePresetId>(getSavedVoicePresetId);
  const selectedVoicePresetIdRef = useRef<VoicePresetId>(getSavedVoicePresetId());
  const rawMicStreamRef = useRef<MediaStream | null>(null);
  const voiceProcessorRef = useRef<VoiceProcessor | null>(null);
  // Voice preview: which preset is playing a tone preview right now
  const [previewingPresetId, setPreviewingPresetId] = useState<VoicePresetId | null>(null);
  // Voice test: record & play back user's actual voice through the active preset
  const [voiceTestState, setVoiceTestState] = useState<"idle" | "recording" | "playing" | "done" | "error">("idle");
  const voiceTestCleanupRef = useRef<(() => void) | null>(null);
  // Tracks whether the raw mic stream is currently live — used as reactive
  // state for the "Test voice" button (rawMicStreamRef is a ref, so reading
  // it directly in JSX won't trigger re-renders when the stream arrives).
  const [hasMicStream, setHasMicStream] = useState(false);
  // ── Voice enhancement / noise cancellation ───────────────────────────────
  const [enhancementEnabled, setEnhancementEnabled] = useState(
    () => localStorage.getItem("vextorn:voice-enhance") !== "false"
  );
  const enhancementEnabledRef = useRef(
    localStorage.getItem("vextorn:voice-enhance") !== "false"
  );
  const [noiseCancellationEnabled, setNoiseCancellationEnabled] = useState(
    () => localStorage.getItem("vextorn:voice-denoise") !== "false"
  );
  const noiseCancellationEnabledRef = useRef(
    localStorage.getItem("vextorn:voice-denoise") !== "false"
  );
  // Live mic level meter: rms 0-1, peak 0-1
  const [micLevel, setMicLevel] = useState<{ rms: number; peak: number }>({ rms: 0, peak: 0 });
  const [sayingBye, setSayingBye] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const participantById = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const participant of participants) map.set(participant.id, participant);
    return map;
  }, [participants]);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const speakingUsersRef = useRef<Set<string>>(new Set());
  // Tracks the last emitted speaking state for the LOCAL user so we only
  // fire room:speaking events on transitions (not every 100ms frame).
  const prevLocalSpeakingRef = useRef<boolean>(false);
  const [micError, setMicError] = useState(false);
  const [showMicHelp, setShowMicHelp] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(() => localStorage.getItem("connect2talk-mic-device") || "default");
  const [micSwitching, setMicSwitching] = useState(false);
  const [micPermissionStatus, setMicPermissionStatus] = useState<PermissionState | "unknown">("unknown");
  const [dismissedWelcomeIds, setDismissedWelcomeIds] = useState<Set<string>>(new Set());
  const [welcomeDialogOpen, setWelcomeDialogOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState("chat");
  const [c4OverlayOpen, setC4OverlayOpen] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // ── AI Tutor (modular: STT / TTS / Stream / Avatar) ──────────────────────
  const [aiPersonaPickerOpen, setAiPersonaPickerOpen] = useState(false);
  const [askAiText, setAskAiText] = useState("");
  const [askAiOpen, setAskAiOpen] = useState(false);

  const {
    aiState,
    voiceState,
    mediaState: _aiMediaState,
    currentViseme,
    personaName: aiPersonaName,
    setAiChatPanelOpen,
    setAiControlOpen,
    setAiDebugOpen,
    setAiTranscriptExpanded,
    setAiSettings: setAiTutorSettings,
    clearDebugLog,
    setRoomAiTutorEnabled,
    toggleAiTutor,
    startWithPersona,
    sendAiMessage,
    interruptAi,
    welcomeUser,
    addDebug: addAiDebugEntry,
    enqueueAiRequest,
  } = useAiTutor({
    socket,
    roomId: room.id,
    roomLanguage: room.language,
    userId: user?.id ?? null,
    username: user ? (user.displayName || user.firstName || user.email || "User") : null,
    activeYoutubeId: null,
    showYoutube: false,
  });

  // Backward-compatible aliases so all existing JSX keeps working unchanged
  const aiTutorActive = aiState.active;
  const aiTutorSpeaking = aiState.speaking;
  const aiTutorLoading = aiState.loading;
  const aiListening = voiceState.listening;
  const aiMicError = voiceState.micError;
  const aiTutorControlOpen = aiState.controlOpen;
  const setAiTutorControlOpen = setAiControlOpen;
  const aiChatPanelOpen = aiState.chatPanelOpen;
  const aiConversation = aiState.conversation;
  const aiInterimText = aiState.interimText;
  const aiAcknowledging = aiState.acknowledging;
  const aiDebugLog = aiState.debugLog;
  const aiDebugOpen = aiState.debugOpen;
  const aiTranscriptExpanded = aiState.transcriptExpanded;
  const lastAiBroadcast = aiState.lastBroadcast;
  const aiTutorSettings = aiState.settings;
  const roomAiTutorSession = aiState.roomSession;
  const roomAiTutorEnabled = aiState.roomEnabled;
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; msgId: string } | null>(null);
  const [chatText, setChatText] = useState("");
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [autoTranslateTarget, setAutoTranslateTarget] = useState<string>(() => localStorage.getItem("vx-auto-translate-target") || "en");
  const autoTranslateTargetRef = useRef(autoTranslateTarget);
  const [autoTranslatePreview, setAutoTranslatePreview] = useState<string | null>(null);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false);
  const autoTranslateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chatMessageColor, setChatMessageColor] = useState(() => localStorage.getItem("connect2talk-chat-color") ?? "");
  const [chatCardColor, setChatCardColor] = useState(() => localStorage.getItem("connect2talk-chat-card-color") ?? "");
  const [privateChatToId, setPrivateChatToId] = useState<string>("public");
  const [pasteUploading, setPasteUploading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const welcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const seenMsgIdsRef = useRef(new Set<string>());
  const historyLoadedRef = useRef(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const typingEmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordAltTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingExpireTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const aiInputRef = useRef<HTMLInputElement>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraShareMode, setIsCameraShareMode] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [isFlippingCamera, setIsFlippingCamera] = useState(false);
  const [localVideoStreamObj, setLocalVideoStreamObj] = useState<MediaStream | null>(null);
  const localVideoStreamRef = useRef<MediaStream | null>(null);
  const [miniCameraMode, setMiniCameraMode] = useState(false);
  const [youtubeSearch, setYoutubeSearch] = useState("");
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [youtubeSearching, setYoutubeSearching] = useState(false);
  const [activeYoutubeId, setActiveYoutubeId] = useState<string | null>(null);
  const [youtubeStartedBy, setYoutubeStartedBy] = useState<string | null>(null);
  const [showYoutube, setShowYoutube] = useState(false);
  const [movieSearch, setMovieSearch] = useState("");
  const [movieResults, setMovieResults] = useState<any[]>([]);
  const [movieSearching, setMovieSearching] = useState(false);
  const [activeMovieId, setActiveMovieId] = useState<string | null>(null);
  const [movieYoutubeUrl, setMovieYoutubeUrl] = useState("");
  const [activeMovieTitle, setActiveMovieTitle] = useState<string>("");
  const [activeMoviePoster, setActiveMoviePoster] = useState<string>("");
  const [movieStartedBy, setMovieStartedBy] = useState<string | null>(null);
  const [showMovie, setShowMovie] = useState(false);
  const [movieHosts, setMovieHosts] = useState<Map<string, { movieId: string; movieTitle: string; posterPath: string }>>(new Map());
  const [movieWatchersByHost, setMovieWatchersByHost] = useState<Map<string, Set<string>>>(new Map());
  const [movieHostStartedAt, setMovieHostStartedAt] = useState<Map<string, number>>(new Map());
  const [movieStartOffset, setMovieStartOffset] = useState<number>(0);
  const [movieCurrentTimeByHost, setMovieCurrentTimeByHost] = useState<Map<string, number>>(new Map());
  const [moviePlayingByHost, setMoviePlayingByHost] = useState<Map<string, boolean>>(new Map());
  const [movieHostPlaying, setMovieHostPlaying] = useState(true);
  const [movieSyncKey, setMovieSyncKey] = useState(0);
  const [movieElapsedDisplay, setMovieElapsedDisplay] = useState(0);
  const [movieSubsOpen, setMovieSubsOpen] = useState(false);
  const [movieSettingsOpen, setMovieSettingsOpen] = useState(false);
  const [movieMuted, setMovieMuted] = useState(false);
  const movieVideoRef = useRef<HTMLVideoElement>(null);
  const [movieDirectUrl, setMovieDirectUrl] = useState<string | null>(null);
  const [movieDirectLoading, setMovieDirectLoading] = useState(false);
  const [movieSubtitleTracks, setMovieSubtitleTracks] = useState<Array<{url: string; label: string; srcLang: string}>>([]);
  const [movieActiveSubLang, setMovieActiveSubLang] = useState<string>("");
  const [movieDuration, setMovieDuration] = useState(0);
  const [popularMovies, setPopularMovies] = useState<any[]>([]);
  const [popularMoviesLoading, setPopularMoviesLoading] = useState(false);
  const dailyModernMovieRef = useRef<{ dayKey: string; movieId: string | null }>({ dayKey: "", movieId: null });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTab, setEditTab] = useState<"basics" | "appearance" | "permissions">("basics");
  const [deleteRoomOpen, setDeleteRoomOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(roomProp.title);
  const [editLanguage, setEditLanguage] = useState(roomProp.language);
  const [editLevel, setEditLevel] = useState(roomProp.level);
  const [editMaxUsers, setEditMaxUsers] = useState(roomProp.maxUsers);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [themeDialogOffset, setThemeDialogOffset] = useState(0);
  const [editRoomTheme, setEditRoomTheme] = useState((roomProp as any).roomTheme || "none");
  const [editThemeOffset, setEditThemeOffset] = useState(0);
  const [showThemeRequest, setShowThemeRequest] = useState(false);
  const [themeReqName, setThemeReqName] = useState("");
  const [themeReqDesc, setThemeReqDesc] = useState("");
  const [editTalkPermission, setEditTalkPermission] = useState<"everyone" | "members" | "co_owners" | "owner_only" | "muted">(
    ((roomProp as any).talkPermission as any) || "everyone"
  );
  const [editCameraPermission, setEditCameraPermission] = useState<"everyone" | "members" | "co_owners" | "owner_only">(
    ((roomProp as any).cameraPermission as any) || "everyone"
  );
  const [editScreenPermission, setEditScreenPermission] = useState<"everyone" | "members" | "co_owners" | "owner_only">(
    ((roomProp as any).screenPermission as any) || "everyone"
  );
  const [editYoutubePermission, setEditYoutubePermission] = useState<"everyone" | "members" | "co_owners" | "owner_only">(
    ((roomProp as any).youtubePermission as any) || "everyone"
  );
  const [editChatPermission, setEditChatPermission] = useState<"everyone" | "members" | "co_owners" | "owner_only">(
    ((roomProp as any).chatPermission as any) || "everyone"
  );
  const [editIsPublic, setEditIsPublic] = useState<boolean>(((roomProp as any).isPublic ?? true) as boolean);
  const [editHologramUrl, setEditHologramUrl] = useState<string | null>(((roomProp as any).hologramVideoUrl as string) || null);
  const [editHologramKind, setEditHologramKind] = useState<"gif" | "image" | "video">(() => {
    const u = ((roomProp as any).hologramVideoUrl as string) || "";
    if (!u) return "gif";
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return "video";
    if (/\.(jpe?g|png|webp)(\?|$)/i.test(u)) return "image";
    return "gif";
  });
  const [editHologramUploading, setEditHologramUploading] = useState(false);
  const editHologramFileRef = useRef<HTMLInputElement>(null);
  const [youtubeFeatured, setYoutubeFeatured] = useState<any[]>([]);
  const [youtubeFeaturedLoading, setYoutubeFeaturedLoading] = useState(false);
  const [youtubeCategory, setYoutubeCategory] = useState<string>("conversation");
  type YtHistoryItem = { id: string; title: string; thumbnail: string; channelTitle: string; duration: string; watchedAt: number };
  const [ytHistory, setYtHistory] = useState<YtHistoryItem[]>([]);
  const [ytSuggested, setYtSuggested] = useState<any[]>([]);
  const [ytSuggestedLoading, setYtSuggestedLoading] = useState(false);
  const [ytPanelSection, setYtPanelSection] = useState<"foryou" | "history" | "browse">("browse");
  const [welcomeText, setWelcomeText] = useState((roomProp as any).welcomeMessage || "");
  const [welcomeMediaUrlsState, setWelcomeMediaUrlsState] = useState<string[]>((roomProp as any).welcomeMediaUrls || []);
  const [welcomeMediaTypesState, setWelcomeMediaTypesState] = useState<string[]>((roomProp as any).welcomeMediaTypes || []);
  const [welcomeMediaPositionState, setWelcomeMediaPositionState] = useState<"above" | "below" | "between">((roomProp as any).welcomeMediaPosition || "below");
  const [welcomeAccentColorState, setWelcomeAccentColorState] = useState((roomProp as any).welcomeAccentColor || "#8B5CF6");
  const [uploadingWelcomeMedia, setUploadingWelcomeMedia] = useState(false);
  const [dmUserId, setDmUserId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const [grammarSuggestions, setGrammarSuggestions] = useState<GrammarSuggestion[]>([]);
  const [grammarDismissedIds, setGrammarDismissedIds] = useState<Set<string>>(new Set());
  const [grammarUndo, setGrammarUndo] = useState<string | null>(null);
  const grammarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wordAltInfo, setWordAltInfo] = useState<{ word: string; alternatives: string[]; wordStart: number; wordEnd: number } | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [reportTargetUserId, setReportTargetUserId] = useState<string | null>(null);
  const [blockDialogUserId, setBlockDialogUserId] = useState<string | null>(null);
  const [blockDialogStep, setBlockDialogStep] = useState<"choose" | "forever-confirm">("choose");
  const [blockDialogName, setBlockDialogName] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; userId: string; userName: string; text: string } | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [reactPopoverMsgId, setReactPopoverMsgId] = useState<string | null>(null);
  const [chatContextMenu, setChatContextMenu] = useState<{ msgId: string; msgUserId: string; x: number; y: number; isOwn: boolean; canDelete: boolean } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [justReactedMsgId, setJustReactedMsgId] = useState<string | null>(null);
  const [morePopoverMsgId, setMorePopoverMsgId] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const [seenByMap, setSeenByMap] = useState<Record<string, { userId: string; userName: string; profileImageUrl?: string | null }[]>>({});
  const lastSeenEmittedRef = useRef<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [pinnedMessage, setPinnedMessage] = useState<{ message: ChatMessage; pinnedBy: string; pinnedByName: string; pinnedAt: number } | null>(null);
  const [participantRoles, setParticipantRoles] = useState<Record<string, string>>({});
  const [trollVoteModal, setTrollVoteModal] = useState<{ targetUserId: string; targetName: string; assignedByName: string; totalMembers: number } | null>(null);
  const [trollVoteProgress, setTrollVoteProgress] = useState<{ kickVotes: number; totalVoters: number } | null>(null);
  const [myTrollVote, setMyTrollVote] = useState<boolean | null>(null);
  const [hostVoteModal, setHostVoteModal] = useState<{ nomineeId: string; nomineeName: string; nominatorId: string; nominatorName: string; totalVoters: number } | null>(null);
  const [hostVoteProgress, setHostVoteProgress] = useState<{ yesVotes: number; noVotes: number; totalVoters: number } | null>(null);
  const [myHostVote, setMyHostVote] = useState<"yes" | "no" | null>(null);
  const [remoteVideoUserId, setRemoteVideoUserId] = useState<string | null>(null);
  const [remoteScreenShareUserId, setRemoteScreenShareUserId] = useState<string | null>(null);
  // Tracks whether the remote screen <video> has actually started painting
  // frames. We use this to fade in the screen smoothly and hide the brief
  // moment of black between "stream attached" and "first keyframe arrived"
  // that otherwise reads as a glitchy blink when a viewer first joins.
  const [remoteScreenPlaying, setRemoteScreenPlaying] = useState(false);
  // Persisted per-viewer preference for how the remote screen-share fills the
  // viewer pane: "fit" letterboxes (object-contain) so nothing is cropped,
  // "fill" crops to edge-to-edge (object-cover). Useful when the sharer is on
  // a portrait monitor and the default fit leaves big black bars.
  const [screenFitMode, setScreenFitMode] = useState<"fit" | "fill">(() => {
    if (typeof window === "undefined") return "fit";
    return (localStorage.getItem("vextorn:screenFitMode") as "fit" | "fill") || "fit";
  });
  const toggleScreenFitMode = useCallback(() => {
    setScreenFitMode((prev) => {
      const next = prev === "fit" ? "fill" : "fit";
      try { localStorage.setItem("vextorn:screenFitMode", next); } catch {}
      return next;
    });
  }, []);
  const [availableVideoUsers, setAvailableVideoUsers] = useState<Set<string>>(new Set());
  const [availableScreenUsers, setAvailableScreenUsers] = useState<Set<string>>(new Set());
  const youtubeSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const movieStartedByRef = useRef<string | null>(null);
  const movieSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const movieHostTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const movieHostElapsedRef = useRef<number>(0);
  const movieHostPlayingRef2 = useRef<boolean>(true);
  const localStream = useRef<MediaStream | null>(null);
  const selectedAudioDeviceIdRef = useRef(selectedAudioDeviceId);
  const videoStream = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteScreenRef = useRef<HTMLVideoElement | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteVideoStreams = useRef<Map<string, MediaStream>>(new Map());
  const remoteScreenStreams = useRef<Map<string, MediaStream>>(new Map());
  const videoSenders = useRef<Map<string, RTCRtpSender>>(new Map());
  const screenSenders = useRef<Map<string, RTCRtpSender[]>>(new Map());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const participantsRef = useRef<Participant[]>([]);
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const youtubePlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytMiniContainerRef = useRef<HTMLDivElement | null>(null);
  const ytIframeDirectRef = useRef<HTMLIFrameElement | null>(null);
  const ytPlayheadRef = useRef<{ time: number; wallMs: number }>({ time: 0, wallMs: 0 });
  const ytRemoteAction = useRef(false);
  const ytLastSyncVideoTime = useRef<number>(-999); // last video-time we broadcast a "play" sync
  const ytLastSyncWallTime = useRef<number>(0);     // wall-clock ms when we last broadcast
  const socketRef = useRef<typeof socket>(null);    // always-fresh socket ref (avoids player restart on reconnect)
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null);
  const getParticipantNameById = useCallback((userId: string) => {
    if (userId === user?.id) return "You";
    const participant = participantById.get(userId);
    return participant ? getUserDisplayName(participant) : "Unknown";
  }, [participantById, user?.id]);
  const formatReactionTooltip = useCallback((emoji: string, userIds: string[]) => {
    const names = userIds.map(getParticipantNameById);
    const displayNames = names.length <= 3 ? names : [...names.slice(0, 3), `+${names.length - 3} more`];
    return { heading: `${emoji} ${userIds.length === 1 ? "1 reaction" : `${userIds.length} reactions`}`, names: displayNames.join(", ") };
  }, [getParticipantNameById]);
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
  const [miniPlayerMode, setMiniPlayerMode] = useState(false);
  const [miniPlayerPos, setMiniPlayerPos] = useState({ x: 16, y: 80 });
  const [fullPlayerDragOffset, setFullPlayerDragOffset] = useState({ x: 0, y: 0 });
  const isFullDraggingRef = useRef(false);
  const fullDragStartRef = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });
  const [moviePlayerHeight, setMoviePlayerHeight] = useState<number | null>(null);
  const [ytPlayerHeight, setYtPlayerHeight] = useState<number | null>(null);
  // Reset to full-height (flex-1) whenever a new video/movie starts so the
  // player always opens at maximum size rather than a previously-dragged size.
  useEffect(() => { if (activeYoutubeId) setYtPlayerHeight(null); }, [activeYoutubeId]);
  useEffect(() => { if (activeMovieId) setMoviePlayerHeight(null); }, [activeMovieId]);

  useEffect(() => {
    if (!activeMovieId) { setMovieDirectUrl(null); setMovieSubtitleTracks([]); setMovieDuration(0); setMovieActiveSubLang(""); return; }
    setMovieDirectLoading(true);
    setMovieDirectUrl(null);
    fetch(`/api/movies/info?id=${encodeURIComponent(activeMovieId)}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { setMovieDirectUrl(data.videoUrl || null); setMovieSubtitleTracks(data.subtitles || []); })
      .catch(() => setMovieDirectUrl(null))
      .finally(() => setMovieDirectLoading(false));
  }, [activeMovieId]);

  useEffect(() => {
    if (movieDirectUrl && movieHostTimerRef.current) {
      clearInterval(movieHostTimerRef.current);
      movieHostTimerRef.current = null;
    }
  }, [movieDirectUrl]);
  const ytSlotRef = useRef<HTMLDivElement | null>(null);
  const [ytSlotRect, setYtSlotRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  // Per-host watch-party state. Each user can host their own YouTube video,
  // and other people may pick whose video to watch. youtubeHosts maps
  // hostUserId -> currently-playing videoId; youtubeWatchersByHost maps
  // hostUserId -> set of viewer userIds.
  const [youtubeHosts, setYoutubeHosts] = useState<Map<string, string>>(new Map());
  const [youtubeWatchersByHost, setYoutubeWatchersByHost] = useState<Map<string, Set<string>>>(new Map());
  // Backwards-compatible "watchers of the video I'm currently watching".
  const youtubeWatchers = useMemo(() => {
    if (!activeYoutubeId || !youtubeStartedBy) return new Set<string>();
    return youtubeWatchersByHost.get(youtubeStartedBy) || new Set<string>();
  }, [youtubeWatchersByHost, activeYoutubeId, youtubeStartedBy]);
  // Flat set of every user who is currently watching some host (used to show
  // a "watching" badge on watcher tiles).
  const youtubeWatchersFlat = useMemo(() => {
    const all = new Set<string>();
    youtubeWatchersByHost.forEach((set, hostId) => {
      set.forEach(uid => { if (uid !== hostId) all.add(uid); });
    });
    return all;
  }, [youtubeWatchersByHost]);

  const movieWatchersFlat = useMemo(() => {
    const all = new Set<string>();
    movieWatchersByHost.forEach((set, hostId) => {
      set.forEach(uid => { if (uid !== hostId) all.add(uid); });
    });
    return all;
  }, [movieWatchersByHost]);

  const watcherMoviePosterMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [hostId, watcherSet] of movieWatchersByHost.entries()) {
      const info = movieHosts.get(hostId);
      if (!info) continue;
      for (const watcherId of watcherSet) {
        map.set(watcherId, info.posterPath || "");
      }
    }
    return map;
  }, [movieWatchersByHost, movieHosts]);
  type YtQueueItem = { id: string; videoId: string; title?: string; thumbnail?: string; addedBy: string };
  const [ytQueue, setYtQueue] = useState<YtQueueItem[]>([]);
  const [screenWatchers, setScreenWatchers] = useState<Set<string>>(new Set());
  // Tracks which peer IDs are currently sharing their screen, driven by the
  // socket signal `room:screen-share`. Used as the primary way to classify
  // incoming `ontrack` video tracks as screen vs camera, since track labels
  // are unreliable across browsers (often empty or generic).
  const screenSharingPeerIds = useRef<Set<string>>(new Set());
  const [ytQualityState, setYtQualityState] = useState<"good" | "slow">("good");
  const [ytPlayerLoading, setYtPlayerLoading] = useState(false);
  const [ytPlayerReady, setYtPlayerReady] = useState(false);
  // Error / retry state for the YT player so we never get stuck on the spinner.
  const [ytPlayerError, setYtPlayerError] = useState<null | { code?: number; message: string }>(null);
  const [ytRetryNonce, setYtRetryNonce] = useState(0);
  const ytHostFallbackRef = useRef(false);
  // Tracks whether we've already auto-retried the alternate host for the
  // currently-mounted video. Reset every time activeYoutubeId changes so each
  // new video gets its own one-shot recovery attempt before showing an error.
  const ytHostAutoRetriedRef = useRef(false);
  const ytLoadTimeoutRef = useRef<number | null>(null);

  const [ytFloatingReactions, setYtFloatingReactions] = useState<Array<{ id: string; emoji: string; left: number; userId: string }>>([]);
  const [movieFloatingReactions, setMovieFloatingReactions] = useState<Array<{ id: string; emoji: string; left: number; userId: string }>>([]);
  const [movieReactionsOpen, setMovieReactionsOpen] = useState(false);
  // Reactions panel is collapsed by default — users tap the smiley toggle on the
  // video to reveal the emoji picker + like/dislike/skip vote pills.
  const [ytReactionsOpen, setYtReactionsOpen] = useState(false);
  // Per-user "I closed this video" flag. When true, neither the player nor the
  // watcher preview card render for this user. Resets whenever the room starts
  // a new video so the next one is shown fresh.
  const [userDismissedYoutube, setUserDismissedYoutube] = useState(false);
  // Watch-party voting state — server tallies, client tracks own choice locally.
  const [ytVotes, setYtVotes] = useState<{ likes: number; dislikes: number; skip: number; watchers: number }>({ likes: 0, dislikes: 0, skip: 0, watchers: 0 });
  const [myYtVote, setMyYtVote] = useState<"like" | "dislike" | null>(null);
  const [myYtSkipVote, setMyYtSkipVote] = useState(false);

  const [bookReaders, setBookReaders] = useState<Set<string>>(new Set());
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [goLivePlatform, setGoLivePlatform] = useState<"youtube" | "twitch" | "both">("youtube");
  const [glTwitchKey, setGlTwitchKey] = useState("");
  const [glYoutubeKey, setGlYoutubeKey] = useState("");
  const [glShowTwitchKey, setGlShowTwitchKey] = useState(false);
  const [glShowYoutubeKey, setGlShowYoutubeKey] = useState(false);
  const [glTwitchUsername, setGlTwitchUsername] = useState("");
  const [glYoutubeChannelId, setGlYoutubeChannelId] = useState("");
  const [glStatus, setGlStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [glStreamId, setGlStreamId] = useState<string | null>(null);
  const [glError, setGlError] = useState<string | null>(null);
  const [glDuration, setGlDuration] = useState(0);
  const [glViewers, setGlViewers] = useState<{ twitch: number | null; youtube: number | null; twitchAvailable: boolean; youtubeAvailable: boolean } | null>(null);
  const glMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const glDurationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const glViewerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const glStatusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const glChunkFailRef = useRef(0);
  const ytKeyInputRef = useRef<HTMLInputElement>(null);
  const twKeyInputRef = useRef<HTMLInputElement>(null);
  const [glWaitingForKey, setGlWaitingForKey] = useState<"youtube" | "twitch" | "both" | null>(null);
  const glRafRef = useRef<number | null>(null);
  const glAudioCtxRef = useRef<AudioContext | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [glVidTime, setGlVidTime] = useState(0);
  const [glVidPlaying, setGlVidPlaying] = useState(true);
  const [glPreviewDataUrl, setGlPreviewDataUrl] = useState<string | null>(null);
  const glPreviewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [glCaptureMode, setGlCaptureMode] = useState<"tab" | "canvas">("tab");
  const glTabStreamRef = useRef<MediaStream | null>(null);

  const [readSearch, setReadSearch] = useState("");
  const [readBooks, setReadBooks] = useState<any[]>([]);
  const [readCatalog, setReadCatalog] = useState<any[]>([]);
  const [readAudiobooks, setReadAudiobooks] = useState<any[]>([]);
  const [readVideos, setReadVideos] = useState<any[]>([]);
  /* Discovery content — shown when a search returns zero results */
  const [discoveryBooks, setDiscoveryBooks] = useState<any[]>([]);
  const [discoveryAudiobooks, setDiscoveryAudiobooks] = useState<any[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [audioPlayer, setAudioPlayer] = useState<{
    book: any;
    chapters: Array<{ n: number; title: string; url: string; duration: string | null }>;
    chapterIdx: number;
    loading: boolean;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [readLoading, setReadLoading] = useState(false);
  /* YouTube → Readable Article */
  const [ytArticleUrl, setYtArticleUrl] = useState("");
  const [ytArticleLoading, setYtArticleLoading] = useState(false);
  const [ytArticleError, setYtArticleError] = useState("");
  const [ytConvertStep, setYtConvertStep] = useState(0); // 0=idle 1=connecting 2=captions 3=building
  const [ytConvertingId, setYtConvertingId] = useState<string | null>(null);
  /* YouTube read-search */
  const [ytReadSearch, setYtReadSearch] = useState("");
  const [ytReadResults, setYtReadResults] = useState<Array<{ id: string; title: string; thumbnail: string; channelTitle: string; duration: string }>>([]);
  const [ytReadSearchLoading, setYtReadSearchLoading] = useState(false);
  const [ytReadSectionExpanded, setYtReadSectionExpanded] = useState(false);
  const [readingHistory, setReadingHistory] = useState<Array<{ id: string | number; title: string; author: string; coverUrl: string | null; lastReadAt: string; formats?: Record<string, string>; _isYtArticle?: boolean; content?: string; videoId?: string | null; thumbnailUrl?: string | null }>>(() => {
    try { return JSON.parse(localStorage.getItem("vextorn_reading_history") || "[]"); } catch { return []; }
  });
  const [savedArticles, setSavedArticles] = useState<Array<{ id: string; title: string; content: string; source: string; sourceUrl: string | null; videoId: string | null; thumbnailUrl: string | null; createdAt: string }>>([]);
  const [savedArticlesLoaded, setSavedArticlesLoaded] = useState(false);
  const [savingArticle, setSavingArticle] = useState(false);
  const [articleSaved, setArticleSaved] = useState(false);
  const [ytDirectUrl, setYtDirectUrl] = useState("");
  const [currentYtThumbnail, setCurrentYtThumbnail] = useState<string | null>(null);
  const [libraryTab, setLibraryTab] = useState<"library" | "saved" | "history">("library");
  const [historyFilter, setHistoryFilter] = useState("");
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [bookText, setBookText] = useState("");
  const [bookLoading, setBookLoading] = useState(false);
  const [wordInfo, setWordInfo] = useState<{ word: string; translation: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showEReader, setShowEReader] = useState(false);
  const [eReaderTheme, setEReaderTheme] = useState<"light" | "dark" | "sepia">("sepia");
  const [eReaderFontSize, setEReaderFontSize] = useState(16);
  const [eReaderHeight, setEReaderHeight] = useState<number | null>(null);
  const [eReaderFullscreen, setEReaderFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [eReaderScrollMode, setEReaderScrollMode] = useState(false);

  // ── Paginate book text into pages of ~280 words (scales with font size) ──────
  const bookPages = useMemo(() => {
    if (!bookText) return [] as string[];
    const wordsPerPage = Math.max(120, Math.round(280 * (16 / eReaderFontSize)));
    // Normalize Windows CRLF → LF before splitting (Gutenberg .txt files use \r\n)
    const normalized = bookText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const paragraphs = normalized.split(/\n{2,}/).filter(p => p.trim().length > 0);
    if (paragraphs.length === 0) return [bookText];
    const pages: string[] = [];
    let page = "";
    let pageWords = 0;
    for (const para of paragraphs) {
      const w = para.trim().split(/\s+/).length;
      if (pageWords + w > wordsPerPage && page) {
        pages.push(page.trim());
        page = para;
        pageWords = w;
      } else {
        page += (page ? "\n\n" : "") + para;
        pageWords += w;
      }
    }
    if (page.trim()) pages.push(page.trim());
    return pages.length > 0 ? pages : [bookText];
  }, [bookText, eReaderFontSize]);

  const [translationLang, setTranslationLang] = useState<string>(() => {
    const m: Record<string, string> = { Spanish:"es", French:"fr", German:"de", Arabic:"ar", Japanese:"ja", Korean:"ko", Chinese:"zh", Portuguese:"pt", Hindi:"hi", Italian:"it", Russian:"ru", Turkish:"tr", Dutch:"nl", Polish:"pl", Vietnamese:"vi", Indonesian:"id", Thai:"th" };
    return m[(room as any).language] || "es";
  });
  const [bookHostId, setBookHostId] = useState<string | null>(null);
  const [sharedBook, setSharedBook] = useState<any | null>(null);
  const [isFollowingBook, setIsFollowingBook] = useState(false);
  const [roomDmNotification, setRoomDmNotification] = useState<{ fromId: string; text: string; fromUser?: User } | null>(null);
  const roomDmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bookScrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollEmitRef = useRef(0);
  const [unreadChatBadge, setUnreadChatBadge] = useState(0);
  const [privateUnreadCount, setPrivateUnreadCount] = useState(0);
  const [tabUnreadCount, setTabUnreadCount] = useState(0);
  const [dmUnreadCounts, setDmUnreadCounts] = useState<Record<string, number>>({});

  /* Seed per-sender unread counts from the server on mount so badges
     appear on participant cards even for DMs received before this session. */
  useEffect(() => {
    if (!user) return;
    fetch("/api/messages/conversations", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((convos: { otherUserId: string; unreadCount: number }[]) => {
        const seed: Record<string, number> = {};
        for (const c of convos) {
          if (c.unreadCount > 0) seed[c.otherUserId] = c.unreadCount;
        }
        if (Object.keys(seed).length > 0) {
          setDmUnreadCounts(prev => ({ ...seed, ...prev }));
        }
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (dmUserId) {
      setDmUnreadCounts(prev => { const next = { ...prev }; delete next[dmUserId]; return next; });
    }
  }, [dmUserId]);

  const sidePanelTabRef = useRef(sidePanelTab);
  const ytSyncTimeRef = useRef<number>(0);
  const ytBufferTimerRef = useRef<number | null>(null);
  const youtubeStartedByRef = useRef<string | null>(null);
  const activeYoutubeIdRef = useRef<string | null>(null);
  const ytQueueRef = useRef<YtQueueItem[]>([]);
  const [ytIsPlaying, setYtIsPlaying] = useState(false);
  const [ytCurrentTime, setYtCurrentTime] = useState(0);
  const [ytDuration, setYtDuration] = useState(0);
  const [ytVolume, setYtVolume] = useState(100);
  const [ytSeekDragging, setYtSeekDragging] = useState(false);
  const [ytSeekLocal, setYtSeekLocal] = useState(0);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, playerX: 0, playerY: 0 });

  // ── Chess: spectator overlay control + seated-player tracking ─────────────
  const [chessSpectatorOpen, setChessSpectatorOpen] = useState(false);
  const [chessSeatedIds, setChessSeatedIds] = useState<{ white: string | null; black: string | null; status: string | null }>({ white: null, black: null, status: null });

  // Latest-version refs so socket listeners don't capture stale values
  const aiTutorActiveRef = useRef(false);
  const aiPersonaNameRef = useRef("");
  const welcomeUserRef = useRef<((name: string) => void) | null>(null);
  useEffect(() => { aiTutorActiveRef.current = aiState.active; }, [aiState.active]);
  useEffect(() => { aiPersonaNameRef.current = aiPersonaName; }, [aiPersonaName]);
  useEffect(() => { welcomeUserRef.current = welcomeUser; }, [welcomeUser]);
  useEffect(() => { autoTranslateTargetRef.current = autoTranslateTarget; }, [autoTranslateTarget]);

  // Bridge: when the Eva TTS engine fails (ElevenLabs unreachable), surface
  // a clear toast so the user knows ElevenLabs is unreachable rather than
  // being silently confused by the AI going quiet or sounding wrong.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__vextornOnEvaTtsError = (msg: string) => {
      toast({
        title: "Eva voice unavailable",
        description: msg,
        variant: "destructive",
      });
    };
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__vextornOnEvaTtsError;
      }
    };
  }, [toast]);

  // Track who is seated at the chess board so participant tiles can show a "spectate" badge
  useEffect(() => {
    if (!socket) return;
    const onState = (s: any) => {
      setChessSeatedIds({
        white: s?.white?.userId || null,
        black: s?.black?.userId || null,
        status: s?.status || null,
      });
    };
    socket.on("room:chess-state", onState);
    socket.emit("room:chess-sync-request", { roomId: room.id });
    return () => { socket.off("room:chess-state", onState); };
  }, [socket, room.id]);

  // ── AI Face draggable position (persisted per room) ──────────────────────
  const AI_FACE_POS_KEY = `c2t-ai-face-pos:${room.id}`;
  const [aiFacePos, setAiFacePos] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try { const r = localStorage.getItem(AI_FACE_POS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  });
  const aiFaceDragRef = useRef<{ armed: boolean; dragging: boolean; sx: number; sy: number; bx: number; by: number; pointerId: number }>({
    armed: false, dragging: false, sx: 0, sy: 0, bx: 0, by: 0, pointerId: -1,
  });
  const aiFaceWrapperRef = useRef<HTMLDivElement | null>(null);
  const DRAG_THRESHOLD = 5;
  const onAiFacePointerDown = (e: React.PointerEvent) => {
    if (!aiFaceWrapperRef.current) return;
    // Don't start a drag on interactive controls (buttons, links, inputs, etc.)
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, a, input, textarea, select, [role="button"], [data-no-drag]')) {
      return;
    }
    const r = aiFaceWrapperRef.current.getBoundingClientRect();
    aiFaceDragRef.current = {
      armed: true, dragging: false,
      sx: e.clientX, sy: e.clientY, bx: r.left, by: r.top,
      pointerId: e.pointerId,
    };
  };
  const onAiFacePointerMove = (e: React.PointerEvent) => {
    const s = aiFaceDragRef.current;
    if (!s.armed) return;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    if (!s.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      s.dragging = true;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    }
    const rect = aiFaceWrapperRef.current?.getBoundingClientRect();
    const w = rect?.width || 220;
    const h = rect?.height || 220;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, s.bx + dx));
    const y = Math.max(8, Math.min(window.innerHeight - h - 8, s.by + dy));
    setAiFacePos({ x, y });
  };
  const onAiFacePointerUp = (e: React.PointerEvent) => {
    const s = aiFaceDragRef.current;
    if (!s.armed) return;
    const wasDragging = s.dragging;
    s.armed = false;
    s.dragging = false;
    if (wasDragging) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      if (aiFacePos) { try { localStorage.setItem(AI_FACE_POS_KEY, JSON.stringify(aiFacePos)); } catch {} }
    }
  };
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  // Bumped whenever an analyser is added or removed so participant cards re-render
  // and pick up the fresh AnalyserNode from analysersRef (which is a ref, not state).
  const [analyserVersion, setAnalyserVersion] = useState(0);

  useEffect(() => {
    setRoomData(roomProp);
  }, [roomProp]);

  const isHost = room.ownerId === user?.id;

  // ── Knock-knock prompts (host-only) ──
  // When a non-member clicks the FULL door on the lobby, we receive a
  // `room:knock-request` here so the host can Allow / Deny in-room without
  // ever leaving the conversation. Each entry stays until the host responds.
  type PendingKnock = { id: string; userId: string; userName: string; userAvatar: string | null; ts: number };
  const [pendingKnocks, setPendingKnocks] = useState<PendingKnock[]>([]);

  useEffect(() => {
    if (!socket || !isHost) return;
    const onKnock = (data: { roomId: string; fromUserId: string; fromUserName: string; fromUserAvatar: string | null; ts: number }) => {
      if (!data || data.roomId !== room.id) return;
      if (data.fromUserId === user?.id) return; // shouldn't happen, but guard
      let added = false;
      setPendingKnocks((prev) => {
        // De-dupe — only one pending knock per user at a time.
        if (prev.some((k) => k.userId === data.fromUserId)) return prev;
        added = true;
        return [
          ...prev,
          { id: `${data.fromUserId}-${data.ts}`, userId: data.fromUserId, userName: data.fromUserName, userAvatar: data.fromUserAvatar, ts: data.ts },
        ];
      });
      if (added) {
        import("@/lib/sound-fx").then((m) => m.sfxKnock()).catch(() => {});
      }
    };
    socket.on("room:knock-request", onKnock);
    return () => { socket.off("room:knock-request", onKnock); };
  }, [socket, isHost, room.id, user?.id]);

  const handleAllowKnock = useCallback((knock: PendingKnock) => {
    if (!socket) return;
    socket.emit("room:knock-allow", { roomId: room.id, userId: knock.userId });
    setPendingKnocks((prev) => prev.filter((k) => k.userId !== knock.userId));
    toast({ title: "✅ Allowed", description: `${knock.userName} can now join.` });
    import("@/lib/sound-fx").then((s) => s.sfxKnockAllowed()).catch(() => {});
  }, [socket, room.id, toast]);

  const handleDenyKnock = useCallback((knock: PendingKnock) => {
    if (!socket) return;
    socket.emit("room:knock-deny", { roomId: room.id, userId: knock.userId });
    setPendingKnocks((prev) => prev.filter((k) => k.userId !== knock.userId));
    import("@/lib/sound-fx").then((s) => s.sfxKnockDenied()).catch(() => {});
  }, [socket, room.id]);

  const isAiTutorOwner = aiTutorActive || roomAiTutorSession.userId === user?.id;
  const aiTutorVisible = aiTutorActive || (!!roomAiTutorSession.active && roomAiTutorSession.userId !== user?.id);

  // Close "Ask AI" input when the session ends
  useEffect(() => {
    if (!roomAiTutorSession.active && !aiTutorActive) {
      setAskAiOpen(false);
      setAskAiText("");
    }
  }, [roomAiTutorSession.active, aiTutorActive]);

  const handleSendAskAi = useCallback(() => {
    const q = askAiText.trim();
    if (!q || !socket) return;
    const myName = user ? (user.displayName || user.firstName || user.email || "Someone") : "Someone";
    socket.emit("room:ai-ask", {
      roomId: room.id,
      fromUserId: user?.id ?? "",
      fromUsername: myName,
      question: q,
    });
    setAskAiText("");
    setAskAiOpen(false);
  }, [askAiText, socket, room.id, user]);
  const aiTutorDisplaySpeaking = isAiTutorOwner ? aiTutorSpeaking : roomAiTutorSession.speaking;
  const aiTutorDisplayListening = isAiTutorOwner ? aiListening : (!!roomAiTutorSession.active && !roomAiTutorSession.speaking);
  const aiTutorDisplayName = roomAiTutorSession.userId && roomAiTutorSession.userId !== user?.id
    ? `${roomAiTutorSession.username || "Someone"}'s AI Tutor`
    : aiPersonaName;
  const aiTutorAvatarId = isAiTutorOwner ? aiTutorSettings.avatarId : roomAiTutorSession.avatarId || "aurora";
  const aiTutorAvatar = AI_TUTOR_AVATARS.find(avatar => avatar.id === aiTutorAvatarId) || AI_TUTOR_AVATARS[0];
  const aiTutorFaceStyle = aiTutorAvatar.gender;

  useEffect(() => {
    selectedAudioDeviceIdRef.current = selectedAudioDeviceId;
    localStorage.setItem("connect2talk-mic-device", selectedAudioDeviceId);
  }, [selectedAudioDeviceId]);

  useEffect(() => {
    sidePanelTabRef.current = sidePanelTab;
    if (sidePanelTab === "chat") {
      setUnreadChatBadge(0);
      setPrivateUnreadCount(0);
    }
  }, [sidePanelTab]);

  useEffect(() => {
    localStorage.setItem("connect2talk-chat-color", chatMessageColor);
  }, [chatMessageColor]);

  useEffect(() => {
    localStorage.setItem("connect2talk-chat-card-color", chatCardColor);
  }, [chatCardColor]);

  useEffect(() => {
    youtubeStartedByRef.current = youtubeStartedBy;
  }, [youtubeStartedBy]);

  useEffect(() => {
    activeYoutubeIdRef.current = activeYoutubeId;
  }, [activeYoutubeId]);

  useEffect(() => {
    movieStartedByRef.current = movieStartedBy;
  }, [movieStartedBy]);

  useEffect(() => {
    if (sidePanelTab === "movies" && popularMovies.length === 0 && !popularMoviesLoading) {
      setPopularMoviesLoading(true);
      fetch("/api/movies/popular")
        .then(r => r.ok ? r.json() : [])
        .then(data => { if (Array.isArray(data) && data.length > 0) setPopularMovies(data); })
        .catch(() => {})
        .finally(() => setPopularMoviesLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidePanelTab]);

  useEffect(() => {
    ytQueueRef.current = ytQueue;
  }, [ytQueue]);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const { data: following = [] } = useQuery<Follow[]>({
    queryKey: ["/api/follows/following", user?.id],
    enabled: !!user,
  });

  const { data: followers = [] } = useQuery<Follow[]>({
    queryKey: ["/api/follows/followers", user?.id],
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const { data: availableThemeData } = useQuery<{ themeIds: string[] }>({
    queryKey: ["/api/themes/available"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: themeOrderStats, refetch: refetchThemeOrderStats } = useQuery<{ pendingCount: number; last24hCount: number }>({
    queryKey: ["/api/themes/order-stats"],
    enabled: !!user && showThemeRequest,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (showThemeRequest && user) {
      void refetchThemeOrderStats();
    }
  }, [showThemeRequest]);

  const submitThemeOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/themes/order", { themeName: themeReqName.trim(), description: themeReqDesc.trim() });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Theme request submitted!", description: "We'll review it and notify you when it's approved." });
      setThemeReqName("");
      setThemeReqDesc("");
      setShowThemeRequest(false);
      void refetchThemeOrderStats();
    },
    onError: (err: any) => {
      toast({ title: "Request failed", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const { data: platformFeatures } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/features/active"],
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
  const featVoiceEffects  = platformFeatures ? platformFeatures["voiceEffects"]  === true : false;
  const featAiTutor       = platformFeatures ? platformFeatures["aiTutor"]        !== false : true;
  const featScreenShare   = platformFeatures ? platformFeatures["screenShare"]    !== false : true;
  const featYoutube       = platformFeatures ? platformFeatures["youtubeWatch"]   !== false : true;
  const featMovieParty    = platformFeatures ? platformFeatures["movieParty"]     !== false : true;
  const featGames         = platformFeatures ? platformFeatures["games"]          !== false : true;
  const featGifPicker     = platformFeatures ? platformFeatures["gifPicker"]      !== false : true;
  const featReadTogether  = platformFeatures ? platformFeatures["readTogether"]   !== false : true;
  const visibleThemes = availableThemeData
    ? ROOM_THEMES.filter((t) => availableThemeData.themeIds.includes(t.id))
    : ROOM_THEMES;

  const [peopleSearch, setPeopleSearch] = useState("");
  const [peopleFilter, setPeopleFilter] = useState<"all" | "friends" | "following" | "followers">("all");

  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const blockedIdsRef = useRef<Set<string>>(new Set());
  const [foreverBlockedIds, setForeverBlockedIds] = useState<Set<string>>(new Set());
  const foreverBlockedIdsRef = useRef<Set<string>>(new Set());
  const { data: initialBlockedIds = [] } = useQuery<{ id: string; blockType: string }[]>({
    queryKey: ["/api/blocks"],
    enabled: !!user,
  });
  useEffect(() => {
    const ordinary = new Set(initialBlockedIds.filter(b => b.blockType !== "forever").map(b => b.id));
    const forever = new Set(initialBlockedIds.filter(b => b.blockType === "forever").map(b => b.id));
    setBlockedIds(ordinary);
    blockedIdsRef.current = ordinary;
    setForeverBlockedIds(forever);
    foreverBlockedIdsRef.current = forever;
  }, [initialBlockedIds]);

  const followMutation = useMutation({
    mutationFn: async (targetId: string) => {
      await apiRequest("POST", "/api/follows", {
        followerId: user?.id,
        followingId: targetId,
      });
    },
    onSuccess: (_data, targetId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following", user?.id] });
      import("@/lib/sound-fx").then((s) => s.sfxFollow()).catch(() => {});
      // Auto-subscribe to both notification types on follow
      apiRequest("PATCH", `/api/push/notif-prefs/${targetId}`, { notifyRoomJoin: true, notifyDm: true })
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/push/muted-users"] }))
        .catch(() => {});
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (targetId: string) => {
      await apiRequest("DELETE", `/api/follows/${user?.id}/${targetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following", user?.id] });
      import("@/lib/sound-fx").then((s) => s.sfxUnfollow()).catch(() => {});
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: async (data: { title: string; language: string; level: string; maxUsers: number; roomTheme?: string; isPublic?: boolean; hologramVideoUrl?: string | null; welcomeMessage?: string | null; welcomeMediaUrls?: string[]; welcomeMediaTypes?: string[]; welcomeMediaPosition?: string; welcomeAccentColor?: string; talkPermission?: string; cameraPermission?: string; screenPermission?: string; youtubePermission?: string; chatPermission?: string }) => {
      const res = await apiRequest("PATCH", `/api/rooms/${room.id}`, data);
      return await res.json();
    },
    onSuccess: async (updatedRoom: any) => {
      setRoomData((prev: any) => ({ ...prev, ...updatedRoom }));
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", room.id] });
      // Cancel any in-flight /api/rooms/mine refetch BEFORE patching the
      // cache. Awaiting ensures a stale response on the wire cannot land
      // after setQueryData and overwrite hologramVideoUrl back to null via
      // the myOwnRooms useEffect in lobby.tsx.
      await queryClient.cancelQueries({ queryKey: ["/api/rooms/mine"] });
      // Patch the lobby cache so the GIF background appears immediately.
      // Handle the case where the room is absent (activeUsers=0) by inserting.
      queryClient.setQueryData(["/api/rooms"], (old: any) => {
        if (!Array.isArray(old)) return old;
        const found = old.some((r: any) => r.id === room.id);
        if (found) {
          return old.map((r: any) => r.id === room.id ? { ...r, ...updatedRoom } : r);
        }
        return [{ ...room, ...updatedRoom }, ...old];
      });
      queryClient.setQueryData(["/api/rooms/mine"], (old: any) => {
        if (!Array.isArray(old)) return old;
        const found = old.some((r: any) => r.id === room.id);
        if (found) {
          return old.map((r: any) => r.id === room.id ? { ...r, ...updatedRoom } : r);
        }
        return [{ ...room, ...updatedRoom }, ...old];
      });
      setEditDialogOpen(false);
      if (updatedRoom.welcomeMessage !== undefined) setWelcomeText(updatedRoom.welcomeMessage || "");
      if (updatedRoom.welcomeMediaUrls !== undefined) setWelcomeMediaUrlsState(updatedRoom.welcomeMediaUrls || []);
      if (updatedRoom.welcomeMediaTypes !== undefined) setWelcomeMediaTypesState(updatedRoom.welcomeMediaTypes || []);
      if (updatedRoom.welcomeMediaPosition !== undefined) setWelcomeMediaPositionState(updatedRoom.welcomeMediaPosition || "below");
      if (updatedRoom.welcomeAccentColor !== undefined) setWelcomeAccentColorState(updatedRoom.welcomeAccentColor || "#8B5CF6");
      toast({ title: "Room settings updated" });
      import("@/lib/sound-fx").then((s) => s.sfxSuccess()).catch(() => {});
    },
    onError: () => {
      toast({ title: "Failed to update room settings", variant: "destructive" });
      import("@/lib/sound-fx").then((s) => s.sfxError()).catch(() => {});
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/rooms/${room.id}`);
    },
    onSuccess: () => {
      import("@/lib/sound-fx").then((s) => s.sfxDelete()).catch(() => {});
    },
    onError: () => {
      toast({ title: "Failed to delete room", variant: "destructive" });
      import("@/lib/sound-fx").then((s) => s.sfxError()).catch(() => {});
    },
  });

  const updateRoomThemeMutation = useMutation({
    mutationFn: async (roomTheme: string) => {
      const res = await apiRequest("PATCH", `/api/rooms/${room.id}`, { roomTheme });
      return await res.json();
    },
    onSuccess: (updatedRoom: any) => {
      setRoomData((prev: any) => ({ ...prev, ...updatedRoom }));
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", room.id] });
      setThemeDialogOpen(false);
      toast({ title: "Room theme updated!" });
      import("@/lib/sound-fx").then((s) => s.sfxSuccess()).catch(() => {});
    },
    onError: () => {
      toast({ title: "Failed to update theme", variant: "destructive" });
      import("@/lib/sound-fx").then((s) => s.sfxError()).catch(() => {});
    },
  });

  const updateWelcomeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/rooms/${room.id}`, {
        welcomeMessage: welcomeText || null,
        welcomeMediaUrls: welcomeMediaUrlsState,
        welcomeMediaTypes: welcomeMediaTypesState,
        welcomeMediaPosition: welcomeMediaPositionState,
        welcomeAccentColor: welcomeAccentColorState,
      });
      return await res.json();
    },
    onSuccess: (updatedRoom: any) => {
      setRoomData((prev: any) => ({ ...prev, ...updatedRoom }));
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", room.id] });
      setWelcomeDialogOpen(false);
      toast({ title: "Welcome message saved & sent to all users in the room!" });
      import("@/lib/sound-fx").then((s) => s.sfxSuccess()).catch(() => {});
    },
    onError: () => {
      toast({ title: "Failed to update welcome message", variant: "destructive" });
      import("@/lib/sound-fx").then((s) => s.sfxError()).catch(() => {});
    },
  });

  const followingIds = new Set(following.map((f) => f.followingId));

  const { data: notifPrefsData } = useQuery<Record<string, { notifyRoomJoin: boolean; notifyDm: boolean }>>({ queryKey: ["/api/push/muted-users"] });

  const updateNotifPrefsMutation = useMutation({
    mutationFn: async ({ userId, notifyRoomJoin, notifyDm }: { userId: string; notifyRoomJoin: boolean; notifyDm: boolean }) => {
      await apiRequest("PATCH", `/api/push/notif-prefs/${userId}`, { notifyRoomJoin, notifyDm });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/push/muted-users"] });
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("401")) {
        toast({ title: "Session expired", description: "Please sign in again to manage notifications.", variant: "destructive" });
      } else {
        toast({ title: "Failed to update notification preference", description: msg || undefined, variant: "destructive" });
      }
    },
  });

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ];

  const playNotificationSound = useCallback((type: "join" | "leave") => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.15;
      if (type === "join") {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.2);
      } else {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(500, ctx.currentTime + 0.15);
      }
      osc.type = "sine";
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    } catch (e) {}
  }, []);

  const addSystemMessage = useCallback((text: string) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random()}`,
        userId: "system",
        text,
        createdAt: new Date().toISOString(),
        type: "system",
      },
    ]);
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(peerId);
    }
    const audio = audioElements.current.get(peerId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      audioElements.current.delete(peerId);
    }
    analysersRef.current.delete(peerId);
    setAnalyserVersion(v => v + 1);
    videoSenders.current.delete(peerId);
    screenSenders.current.delete(peerId);
    remoteVideoStreams.current.delete(peerId);
    remoteScreenStreams.current.delete(peerId);
    pendingCandidates.current.delete(peerId);
  }, []);

  const flushPendingCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const candidates = pendingCandidates.current.get(peerId);
    if (candidates && candidates.length > 0) {
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding queued ICE candidate:", err);
        }
      }
      pendingCandidates.current.delete(peerId);
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string, reuseExisting = false) => {
      if (peerConnections.current.has(peerId) && !reuseExisting) {
        cleanupPeer(peerId);
      }
      if (reuseExisting && peerConnections.current.has(peerId)) {
        return peerConnections.current.get(peerId)!;
      }

      const pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("webrtc:ice-candidate", {
            candidate: event.candidate,
            to: peerId,
            roomId: room.id,
          });
        }
      };

      pc.ontrack = (event) => {
        const track = event.track;
        if (track.kind === "audio") {
          let audio = audioElements.current.get(peerId);
          if (!audio) {
            audio = document.createElement("audio");
            audio.autoplay = true;
            (audio as any).playsInline = true;
            audio.volume = 1;
            audio.setAttribute("data-peer-id", peerId);
            document.body.appendChild(audio);
            audioElements.current.set(peerId, audio);
          }
          audio.srcObject = event.streams[0];
          audio.play().catch(() => {});
          
          if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) audioContextRef.current = new AudioContextClass();
          }
          if (audioContextRef.current) {
             try {
                if (audioContextRef.current.state === 'suspended') {
                   audioContextRef.current.resume();
                }
                const source = audioContextRef.current.createMediaStreamSource(event.streams[0]);
                const analyser = audioContextRef.current.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                analysersRef.current.set(peerId, analyser);
                setAnalyserVersion(v => v + 1);
             } catch(e) {}
          }
        } else if (track.kind === "video") {
          const stream = event.streams[0] || new MediaStream([track]);
          // Primary signal: the socket event `room:screen-share` told us this
          // peer is sharing their screen. Treat new tracks from them as the
          // screen unless we already have one (in which case it's the camera).
          // Fallback: best-effort label sniffing for the rare case the track
          // arrives before the socket event.
          const labelSaysScreen =
            track.label?.toLowerCase().includes("screen") ||
            track.label?.toLowerCase().includes("monitor") ||
            track.label?.toLowerCase().includes("window") ||
            track.label?.toLowerCase().includes("tab") ||
            track.label?.toLowerCase().includes("display");
          const isKnownSharer = screenSharingPeerIds.current.has(peerId);
          const alreadyHasCamera = remoteVideoStreams.current.has(peerId);
          const alreadyHasScreen = remoteScreenStreams.current.has(peerId);
          const isScreenTrack =
            (isKnownSharer && !alreadyHasScreen) ||
            labelSaysScreen ||
            (alreadyHasCamera && !alreadyHasScreen);

          if (isScreenTrack) {
            remoteScreenStreams.current.set(peerId, stream);
            setAvailableScreenUsers((prev) => { const n = new Set(Array.from(prev)); n.add(peerId); return n; });
            // If the local user has already chosen to watch this peer's screen
            // (clicked their tile before the WebRTC track had arrived, or this
            // is a renegotiated track replacing an old one), attach the new
            // stream to the visible <video> element so it doesn't stay black.
            setRemoteScreenShareUserId((prev) => {
              const target = prev ?? peerId;
              if (target === peerId && remoteScreenRef.current && remoteScreenRef.current.srcObject !== stream) {
                try { remoteScreenRef.current.srcObject = stream; } catch (e) {}
              }
              return prev;
            });
            track.onended = () => {
              // Only remove if the *currently registered* stream for this peer
              // is the one that ended — guards against renegotiation where a
              // newer track has already replaced this one.
              if (remoteScreenStreams.current.get(peerId) !== stream) return;
              remoteScreenStreams.current.delete(peerId);
              setAvailableScreenUsers((prev) => { const n = new Set(prev); n.delete(peerId); return n; });
              setRemoteScreenShareUserId((prev) => prev === peerId ? null : prev);
              if (remoteScreenRef.current && remoteScreenRef.current.srcObject === stream) {
                remoteScreenRef.current.srcObject = null;
              }
            };
            // NOTE: deliberately no `track.onmute` here. WebRTC mutes tracks
            // briefly during renegotiation (e.g. when a new viewer joins),
            // and reacting to onmute caused existing watchers to lose the
            // shared screen. The track recovers on its own via onunmute.
          } else {
            remoteVideoStreams.current.set(peerId, stream);
            setAvailableVideoUsers((prev) => { const n = new Set(Array.from(prev)); n.add(peerId); return n; });
            setRemoteVideoUserId((prev) => {
              if (prev === peerId && remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
                try { remoteVideoRef.current.srcObject = stream; } catch (e) {}
              }
              return prev;
            });
            track.onended = () => {
              if (remoteVideoStreams.current.get(peerId) !== stream) return;
              remoteVideoStreams.current.delete(peerId);
              setAvailableVideoUsers((prev) => { const n = new Set(prev); n.delete(peerId); return n; });
              setRemoteVideoUserId((prev) => prev === peerId ? null : prev);
              if (remoteVideoRef.current && remoteVideoRef.current.srcObject === stream) {
                remoteVideoRef.current.srcObject = null;
              }
            };
            // NOTE: no onmute for the same reason as above — camera tracks
            // also briefly mute during renegotiation.
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          try { pc.restartIce(); } catch (e) {}
        } else if (pc.iceConnectionState === "disconnected") {
          try { pc.restartIce(); } catch (e) {}
          setTimeout(() => {
            if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
              cleanupPeer(peerId);
              remoteVideoStreams.current.delete(peerId);
              remoteScreenStreams.current.delete(peerId);
              setAvailableVideoUsers((prev) => { const n = new Set(prev); n.delete(peerId); return n; });
              setAvailableScreenUsers((prev) => { const n = new Set(prev); n.delete(peerId); return n; });
              setRemoteVideoUserId((prev) => prev === peerId ? null : prev);
              setRemoteScreenShareUserId((prev) => prev === peerId ? null : prev);
            }
          }, 30000);
        }
      };

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStream.current!);
        });
      }

      if (videoStream.current) {
        videoStream.current.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, videoStream.current!);
          videoSenders.current.set(peerId, sender);
        });
      }

      if (screenStream.current) {
        const senders: RTCRtpSender[] = [];
        screenStream.current.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, screenStream.current!);
          senders.push(sender);
        });
        screenSenders.current.set(peerId, senders);
      }

      peerConnections.current.set(peerId, pc);
      return pc;
    },
    [socket, room.id, cleanupPeer]
  );

  const getAudioConstraints = useCallback((deviceId = selectedAudioDeviceIdRef.current): MediaTrackConstraints => ({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(deviceId && deviceId !== "default" ? { deviceId: { exact: deviceId } } : {}),
  }), []);

  const refreshAudioInputDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === "audioinput");
      setAudioInputDevices(audioInputs);
      const selected = selectedAudioDeviceIdRef.current;
      if (selected !== "default" && !audioInputs.some((device) => device.deviceId === selected)) {
        setSelectedAudioDeviceId("default");
      }
    } catch (err) {
      console.error("Failed to load microphones:", err);
    }
  }, []);

  const updateMicPermissionStatus = useCallback(async () => {
    if (!navigator.permissions?.query) {
      setMicPermissionStatus("unknown");
      return;
    }
    try {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      setMicPermissionStatus(status.state);
      status.onchange = () => setMicPermissionStatus(status.state);
    } catch {
      setMicPermissionStatus("unknown");
    }
  }, []);

  const attachLocalAnalyser = useCallback((stream: MediaStream) => {
    if (!user) return;
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current) {
      try {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analysersRef.current.set(user.id, analyser);
        setAnalyserVersion(v => v + 1);
      } catch (e) {}
    }
  }, [user]);

  const publishLocalAudioStream = useCallback(async (stream: MediaStream) => {
    if (!socket) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    for (const [peerId, pc] of Array.from(peerConnections.current.entries())) {
      try {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        if (sender) {
          await sender.replaceTrack(audioTrack);
          continue;
        }
        pc.addTrack(audioTrack, stream);
        if (pc.signalingState === "stable") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc:offer", { offer, to: peerId, roomId: room.id });
        }
      } catch (err) {
        console.error("Failed to publish microphone to peer:", err);
      }
    }
  }, [socket, room.id]);

  const applyLocalAudioStream = useCallback(async (stream: MediaStream, keepMuteState = false) => {
    const previousRawStream = rawMicStreamRef.current;
    rawMicStreamRef.current = stream;

    // Always route through the AudioEngine so the enhancement chain (noise gate,
    // EQ, compressor, limiter) and the level meter worklet are active even when
    // the voice-effect preset is "natural".
    let processedStream: MediaStream = stream;
    const presetId = selectedVoicePresetIdRef.current;
    if (!audioContextRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) audioContextRef.current = new AC();
    }
    if (audioContextRef.current) {
      if (!voiceProcessorRef.current) {
        voiceProcessorRef.current = new VoiceProcessor(audioContextRef.current);
      }
      voiceProcessorRef.current.onLevelMeter = (rms, peak) => {
        setMicLevel({ rms, peak });
        micRmsRef.current = rms;
      };
      processedStream = await voiceProcessorRef.current.process(
        stream, presetId,
        enhancementEnabledRef.current,
        noiseCancellationEnabledRef.current,
      );
    }

    processedStream.getAudioTracks().forEach((track) => {
      track.enabled = keepMuteState ? !isMutedRef.current : false;
    });
    localStream.current = processedStream;

    // Stop the previous raw mic stream's tracks (not the destination/processed stream)
    if (previousRawStream && previousRawStream !== stream) {
      previousRawStream.getTracks().forEach((track) => track.stop());
    }

    setMicError(false);
    setShowMicHelp(false);
    setHasMicStream(true);
    attachLocalAnalyser(processedStream);
    await publishLocalAudioStream(processedStream);
  }, [attachLocalAnalyser, publishLocalAudioStream]);

  // Keep the preset ref in sync whenever state changes
  useEffect(() => {
    selectedVoicePresetIdRef.current = selectedVoicePresetId;
  }, [selectedVoicePresetId]);

  const handleVoicePresetChange = useCallback(async (presetId: VoicePresetId) => {
    // ── CRITICAL: resume AudioContext SYNCHRONOUSLY within the user-gesture
    // activation window.  If we await anything first, Chrome's transient
    // activation expires and ctx.resume() silently fails — leaving the context
    // suspended so all worklets produce silence (real voice heard by peers).
    if (!audioContextRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) audioContextRef.current = new AC();
    }
    if (audioContextRef.current?.state === "suspended") {
      // Fire-and-forget — we do NOT await so the gesture window is not consumed.
      audioContextRef.current.resume().catch(() => {});
    }

    setSelectedVoicePresetId(presetId);
    selectedVoicePresetIdRef.current = presetId;
    saveVoicePresetId(presetId);
    setVoicePickerOpen(false);

    // Auto-preview the character sound when selected (non-blocking)
    if (presetId !== "natural") {
      const ctx = audioContextRef.current;
      if (ctx) {
        setPreviewingPresetId(presetId);
        previewVoicePreset(ctx, presetId)
          .catch(() => {})
          .finally(() => setPreviewingPresetId(null));
      }
    }

    const rawStream = rawMicStreamRef.current;
    if (!rawStream) return;

    if (!voiceProcessorRef.current) {
      voiceProcessorRef.current = new VoiceProcessor(audioContextRef.current!);
    }
    voiceProcessorRef.current.onLevelMeter = (rms, peak) => setMicLevel({ rms, peak });
    const processedStream = await voiceProcessorRef.current.process(
      rawStream, presetId,
      enhancementEnabledRef.current,
      noiseCancellationEnabledRef.current,
    );

    processedStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMutedRef.current;
    });
    localStream.current = processedStream;
    attachLocalAnalyser(processedStream);
    await publishLocalAudioStream(processedStream);
  }, [attachLocalAnalyser, publishLocalAudioStream]);

  // Ensure the AudioContext exists (creates it lazily if needed) and return it
  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (!audioContextRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) audioContextRef.current = new AC();
    }
    return audioContextRef.current;
  }, []);

  // ── Enhancement / noise-cancellation rebuild helpers ─────────────────────
  const rebuildAudioPipeline = useCallback(async (
    enh: boolean,
    denoise: boolean,
  ) => {
    // Resume synchronously within any user-gesture that calls this
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
    const rawStream = rawMicStreamRef.current;
    if (!rawStream || !audioContextRef.current) return;
    if (!voiceProcessorRef.current) {
      voiceProcessorRef.current = new VoiceProcessor(audioContextRef.current);
    }
    voiceProcessorRef.current.onLevelMeter = (rms, peak) => setMicLevel({ rms, peak });
    const processed = await voiceProcessorRef.current.process(
      rawStream, selectedVoicePresetIdRef.current, enh, denoise,
    );
    processed.getAudioTracks().forEach((t) => { t.enabled = !isMutedRef.current; });
    localStream.current = processed;
    attachLocalAnalyser(processed);
    await publishLocalAudioStream(processed);
  }, [attachLocalAnalyser, publishLocalAudioStream]);

  const handleToggleEnhancement = useCallback(async () => {
    const next = !enhancementEnabledRef.current;
    setEnhancementEnabled(next);
    enhancementEnabledRef.current = next;
    try { localStorage.setItem("vextorn:voice-enhance", next ? "true" : "false"); } catch {}
    await rebuildAudioPipeline(next, noiseCancellationEnabledRef.current);
  }, [rebuildAudioPipeline]);

  const handleToggleNoiseCancellation = useCallback(async () => {
    const next = !noiseCancellationEnabledRef.current;
    setNoiseCancellationEnabled(next);
    noiseCancellationEnabledRef.current = next;
    try { localStorage.setItem("vextorn:voice-denoise", next ? "true" : "false"); } catch {}
    await rebuildAudioPipeline(enhancementEnabledRef.current, next);
  }, [rebuildAudioPipeline]);

  const handleVoicePreview = useCallback(async (presetId: VoicePresetId) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    setPreviewingPresetId(presetId);
    try {
      await previewVoicePreset(ctx, presetId);
    } catch (e) {
      console.warn("[voice-preview] failed:", e);
    } finally {
      setPreviewingPresetId(null);
    }
  }, [ensureAudioContext]);

  const handleVoiceTest = useCallback(() => {
    const rawStream = rawMicStreamRef.current;
    if (!rawStream) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;

    // Cancel any in-flight test
    voiceTestCleanupRef.current?.();
    voiceTestCleanupRef.current = null;

    const cleanup = testVoiceThroughPreset(
      rawStream,
      selectedVoicePresetIdRef.current,
      ctx,
      (state) => {
        setVoiceTestState(state);
        if (state === "done" || state === "error") {
          voiceTestCleanupRef.current = null;
          setTimeout(() => setVoiceTestState("idle"), 1800);
        }
      },
    );
    voiceTestCleanupRef.current = cleanup;
  }, [ensureAudioContext]);

  useEffect(() => {
    updateMicPermissionStatus();
    refreshAudioInputDevices();
    if (!navigator.mediaDevices?.addEventListener) return;
    navigator.mediaDevices.addEventListener("devicechange", refreshAudioInputDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshAudioInputDevices);
  }, [refreshAudioInputDevices, updateMicPermissionStatus]);

  useEffect(() => {
    if (!socket || !user) return;

    let animationFrameId: number;
    let lastCheck = performance.now();
    const checkAudioLevels = (time: number) => {
      const interval = isYoutubeActive() ? 250 : 100;
      if (time - lastCheck > interval) {
        lastCheck = time;
        const currentlySpeaking = new Set<string>();
        
        analysersRef.current.forEach((analyser, peerId) => {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; ++i) {
             sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          if (average > 10) {
             if (peerId === user?.id && isMutedRef.current) {
                // skip local muted
             } else {
                currentlySpeaking.add(peerId);
             }
          }
        });

        // ── Emit local speaking transitions to the server ─────────────────
        // Primary: VoiceProcessor worklet RMS — pre-mute, most accurate.
        // Fallback: local analyser frequency average — same data that drives
        // the local voice bar UI; guarantees broadcast works even when the
        // AudioWorklet is unavailable (e.g. older browsers) and micRmsRef
        // stays 0 while the analyser still shows voice activity.
        // currentlySpeaking already contains user.id when their analyser avg > 10
        // and they are not muted, so reusing it costs zero extra work.
        const localNowSpeaking = !isMutedRef.current && (micRmsRef.current > 0.02 || currentlySpeaking.has(user.id));
        if (localNowSpeaking !== prevLocalSpeakingRef.current) {
          prevLocalSpeakingRef.current = localNowSpeaking;
          socket.emit("room:speaking", {
            roomId: room.id,
            userId: user.id,
            isSpeaking: localNowSpeaking,
          });
        }

        // ── Update LOCAL user's speaking state only ────────────────────────
        // DO NOT replace the whole set here — that would overwrite speaking
        // states received for remote users via room:speaking socket events.
        // Only toggle the current user's own entry based on the local analyser.
        setSpeakingUsers(prev => {
          const wasLocal = prev.has(user.id);
          if (wasLocal === localNowSpeaking) return prev;
          const next = new Set(prev);
          if (localNowSpeaking) next.add(user.id);
          else next.delete(user.id);
          speakingUsersRef.current = next;
          return next;
        });
      }
      animationFrameId = requestAnimationFrame(checkAudioLevels);
    };
    animationFrameId = requestAnimationFrame(checkAudioLevels);

    const initMedia = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints() });
        } catch (err: any) {
          if (selectedAudioDeviceIdRef.current !== "default" && (err?.name === "OverconstrainedError" || err?.name === "NotFoundError")) {
            selectedAudioDeviceIdRef.current = "default";
            setSelectedAudioDeviceId("default");
            stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints("default") });
          } else {
            throw err;
          }
        }
        await applyLocalAudioStream(stream);
        await refreshAudioInputDevices();
      } catch (err) {
        console.error("Failed to get microphone:", err);
        setMicError(true);
        await updateMicPermissionStatus();
        await refreshAudioInputDevices();
      }
      socket.emit("room:join", { roomId: room.id, userId: user.id });
      socket.emit("room:mute", { roomId: room.id, userId: user.id, isMuted: true });
      // Subtle "you're in" chime for the local user.
      import("@/lib/sound-fx").then((m) => m.sfxEnterRoom()).catch(() => {});
      try {
        const bc = new BroadcastChannel(`connect-room-${user.id}`);
        bc.postMessage({ type: "room-joined", roomId: room.id });
        bc.close();
      } catch {}
    };

    initMedia();

    const handleReconnect = () => {
      socket.emit("user:online", user.id);
      socket.emit("room:join", { roomId: room.id, userId: user.id });

      // If this user was an active YouTube host, the server may have deleted
      // their host slot if the disconnect lasted longer than the grace timer
      // (8s). Re-broadcast so other room members can continue watching and
      // the server's per-host state is restored.
      const ytVideoId = activeYoutubeIdRef.current;
      const ytHostId = youtubeStartedByRef.current;
      if (ytVideoId && ytHostId === user.id) {
        socket.emit("room:youtube", { roomId: room.id, hostId: user.id, videoId: ytVideoId });
      }

      peerConnections.current.forEach((pc, peerId) => {
        try {
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
            cleanupPeer(peerId);
          }
        } catch (e) {}
      });
    };
    socket.on("connect", handleReconnect);

    // When the tab returns to the foreground, only re-join if the socket
    // actually dropped — re-emitting on every focus made the server broadcast
    // a global `room:participants-update` to every connected client, which
    // looked to other users like we were rapidly leaving and re-joining.
    // The dedicated `connect` listener above already handles real reconnects.
    const handleVisibilityForRoom = () => {
      if (document.visibilityState === "visible" && !socket.connected) {
        socket.connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityForRoom);

    socket.on("room:participants", (data: Participant[]) => {
      setParticipants(data);
      participantsRef.current = data;
    });

    socket.on("room:user-joined", (data: { user: Participant; participants: Participant[]; isRejoin?: boolean }) => {
      setParticipants(data.participants);
      participantsRef.current = data.participants;
      // Suppress the join announcement and notification sound for socket
      // reconnects (isRejoin=true). A reconnect means the user had a brief
      // network blip and is still in the room — not a new arrival. Without
      // this check the message appeared twice: once on first join, once on
      // every reconnect, causing the doubled "X joined the room" bug.
      if (data.user.id !== user.id && !data.isRejoin) {
        // Client-side dedup: if we already showed a join for this user within
        // the last 3s, swallow the duplicate (race condition safety net).
        const now = Date.now();
        const lastJoin = recentJoinsRef.current.get(data.user.id);
        if (!lastJoin || now - lastJoin > 3000) {
          recentJoinsRef.current.set(data.user.id, now);
          setTimeout(() => recentJoinsRef.current.delete(data.user.id), 3000);
          const name = getUserDisplayName(data.user);
          addSystemMessage(`${name} joined the room`);
          playNotificationSound("join");
          // Afi K personality: only the AI session owner triggers the welcome so it broadcasts once
          if (aiTutorActiveRef.current && /afi\s*k|afik/i.test(aiPersonaNameRef.current)) {
            welcomeUserRef.current?.(name);
          }
        }
      }
    });

    socket.on("room:user-left", (data: { userId: string; participants: Participant[]; displayName?: string | null }) => {
      const leftUser = participantsRef.current.find((p) => p.id === data.userId);
      const name = data.displayName || (leftUser ? getUserDisplayName(leftUser) : null) || "Someone";
      // Subtle departure cue for remaining participants
      if (data.userId !== user.id) {
        import("@/lib/mood-sounds").then((m) => m.playDepartureSound()).catch(() => {});
      }
      setParticipants(data.participants);
      participantsRef.current = data.participants;
      // Clear any active typing indicator for the user who left
      if (typingExpireTimers.current[data.userId]) {
        clearTimeout(typingExpireTimers.current[data.userId]);
        delete typingExpireTimers.current[data.userId];
      }
      setTypingUsers((prev) => {
        if (!prev[data.userId]) return prev;
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
      cleanupPeer(data.userId);
      // Clear the departed user's speaking indicator — if they disconnected
      // abruptly they may never have sent isSpeaking:false, leaving a stale ring.
      setSpeakingUsers((prev) => {
        if (!prev.has(data.userId)) return prev;
        const next = new Set(prev);
        next.delete(data.userId);
        speakingUsersRef.current = next;
        return next;
      });
      setAvailableScreenUsers((prev) => { const n = new Set(prev); n.delete(data.userId); return n; });
      setAvailableVideoUsers((prev) => { const n = new Set(prev); n.delete(data.userId); return n; });
      setRemoteScreenShareUserId((prev) => prev === data.userId ? null : prev);
      setRemoteVideoUserId((prev) => prev === data.userId ? null : prev);
      // Prune the leaving user from every host's watcher set, and clear their
      // own host slot in case the disconnect handler hasn't broadcast yet.
      setYoutubeWatchersByHost((prev) => {
        const next = new Map<string, Set<string>>();
        prev.forEach((set, hostId) => {
          if (hostId === data.userId) return; // their host slot is gone
          if (set.has(data.userId)) {
            const ns = new Set(set);
            ns.delete(data.userId);
            if (ns.size > 0) next.set(hostId, ns);
          } else {
            next.set(hostId, set);
          }
        });
        return next;
      });
      setYoutubeHosts((prev) => {
        if (!prev.has(data.userId)) return prev;
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
      // If I was watching the user who just left, close my view.
      if (youtubeStartedByRef.current === data.userId) {
        setActiveYoutubeId(null);
        setYoutubeStartedBy(null);
        setShowYoutube(false);
        setMiniPlayerMode(false);
      }
      if (data.userId !== user.id) {
        addSystemMessage(`${name} left the room`);
        playNotificationSound("leave");
      }
    });

    socket.on("webrtc:offer", async (data: { offer: RTCSessionDescriptionInit; from: string }) => {
      if (blockedIdsRef.current.has(data.from) || foreverBlockedIdsRef.current.has(data.from)) return;
      try {
        let pc = peerConnections.current.get(data.from);
        if (!pc) {
          pc = createPeerConnection(data.from);
        } else {
          if (pc.signalingState === "have-local-offer") {
            await pc.setLocalDescription({ type: "rollback" } as any);
          }
        }
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushPendingCandidates(data.from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", {
          answer,
          to: data.from,
          roomId: room.id,
        });
      } catch (err) {
        console.error("Error handling WebRTC offer:", err);
      }
    });

    socket.on("webrtc:answer", async (data: { answer: RTCSessionDescriptionInit; from: string }) => {
      try {
        const pc = peerConnections.current.get(data.from);
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await flushPendingCandidates(data.from, pc);
        }
      } catch (err) {
        console.error("Error handling WebRTC answer:", err);
      }
    });

    socket.on("webrtc:ice-candidate", async (data: { candidate: RTCIceCandidateInit; from: string }) => {
      try {
        const pc = peerConnections.current.get(data.from);
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          if (!pendingCandidates.current.has(data.from)) {
            pendingCandidates.current.set(data.from, []);
          }
          pendingCandidates.current.get(data.from)!.push(data.candidate);
        }
      } catch (err) {
        console.error("Error handling ICE candidate:", err);
      }
    });

    socket.on("webrtc:new-peer", async (data: { peerId: string }) => {
      if (blockedIdsRef.current.has(data.peerId) || foreverBlockedIdsRef.current.has(data.peerId)) return;
      try {
        const pc = createPeerConnection(data.peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc:offer", {
          offer,
          to: data.peerId,
          roomId: room.id,
        });
      } catch (err) {
        console.error("Error creating WebRTC offer:", err);
      }
    });

    socket.on("room:speaking", (data: { userId: string; isSpeaking: boolean }) => {
      setSpeakingUsers((prev) => {
        const next = new Set(prev);
        if (data.isSpeaking) next.add(data.userId);
        else next.delete(data.userId);
        speakingUsersRef.current = next;
        return next;
      });
    });

    socket.on("room:hand-raised", (data: { userId: string; raised: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === data.userId ? { ...p, handRaised: data.raised } : p))
      );
    });

    socket.on(
      "user:profile-updated",
      (data: {
        userId: string;
        displayName?: string;
        profileImageUrl?: string | null;
        avatarRing?: string | null;
        flairBadge?: string | null;
        profileDecoration?: string | null;
        profileAnimation?: string | null;
        status?: string | null;
      }) => {
        if (!data?.userId) return;
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === data.userId ? { ...p, ...data } : p
          )
        );
      }
    );

    // Mood reactions broadcast — when anyone in the room (including ourselves)
    // picks an emoji from the mood picker, the server echoes a "room:mood-update"
    // back. We stash the emoji keyed by userId so the corresponding participant
    // card pins the mood emoji above their avatar. The mood now PERSISTS until
    // the owner explicitly removes it (room:mood-clear) or picks a new one.
    // "Say Bye" — someone waved goodbye before leaving. Play the farewell sound
    // for everyone and show a toast. The bye-sender's client handles leaving itself.
    socket.on("room:bye", (data: { userId: string; userName: string; ts?: number }) => {
      if (!data?.userId) return;
      import("@/lib/mood-sounds").then((m) => {
        m.playSayByeSound();
      }).catch(() => {});
      const isMe = data.userId === user.id;
      if (!isMe) {
        toast({
          title: `👋 ${data.userName} said bye!`,
          description: "They're waving goodbye and leaving the room.",
          duration: 3500,
        });
      }
    });

    // Snapshot of all moods already set before this user joined
    socket.on("room:moods-snapshot", (snapshot: Record<string, string>) => {
      if (!snapshot) return;
      setParticipantMoods((prev) => {
        const next = { ...prev };
        for (const [userId, emoji] of Object.entries(snapshot)) {
          if (!next[userId]) {
            const id = `snap-${Date.now()}-${userId}`;
            next[userId] = { id, emoji };
          }
        }
        return next;
      });
    });

    socket.on("room:mood-update", (data: { userId: string; emoji: string; ts?: number }) => {
      if (!data?.userId || !data?.emoji) return;
      // Suppress new mood emojis while DJ mode is running — they clutter DJ visuals
      if (djModeActiveRef.current) return;
      const id = `${data.ts || Date.now()}-${Math.random().toString(36).slice(2, 8)}`; 
      setParticipantMoods((prev) => ({ ...prev, [data.userId]: { id, emoji: data.emoji } }));
      // Subtle audio cue so reactions register even when you're not looking at the screen.
      try { playMoodSound(data.emoji); } catch {}
      // Cancel any leftover auto-clear timer from prior versions; mood is now persistent.
      const existing = moodTimersRef.current[data.userId];
      if (existing) {
        clearTimeout(existing);
        delete moodTimersRef.current[data.userId];
      }
    });

    // Owner explicitly removed their mood sticker — drop it from the local map
    // so their card returns to normal for everyone in the room.
    socket.on("room:mood-clear", (data: { userId: string }) => {
      if (!data?.userId) return;
      setParticipantMoods((prev) => {
        if (!prev[data.userId]) return prev;
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
      const existing = moodTimersRef.current[data.userId];
      if (existing) {
        clearTimeout(existing);
        delete moodTimersRef.current[data.userId];
      }
    });

    socket.on("room:mute-update", (data: { userId: string; isMuted: boolean; forcedBy?: string }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === data.userId ? { ...p, isMuted: data.isMuted } : p))
      );
      if (data.userId === user.id && data.forcedBy) {
        setIsMuted(true);
        if (localStream.current) {
          localStream.current.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
        }
        toast({ title: "You have been muted by the host", variant: "destructive" });
      }
    });

    socket.on("room:video-force-off", (data: { userId: string; mutedBy: string }) => {
      if (data.userId === user.id) {
        setIsVideoOn(false);
        if (videoStream.current) {
          videoStream.current.getVideoTracks().forEach((track) => { track.enabled = false; track.stop(); });
          videoStream.current = null;
        }
        toast({ title: "Your video was turned off by the host", variant: "destructive" });
      }
    });

    socket.on("room:chat-blocked", (data: { reason: string }) => {
      toast({ title: "Chat restricted", description: data.reason, variant: "destructive", duration: 3000 });
    });

    socket.on("room:kicked", (data: { roomId: string }) => {
      if (data.roomId === room.id) {
        toast({ title: "You have been removed from this room", variant: "destructive" });
        handleLeave();
      }
    });

    socket.on("room:host-deleted", (data: { roomId: string }) => {
      if (data.roomId === room.id) {
        toast({ title: "This room has been closed by the host", variant: "destructive" });
        handleLeave();
      }
    });

    socket.on("room:joined-another-room", (data: { oldRoomId: string; newRoomId: string }) => {
      if (data.oldRoomId === room.id) {
        handleLeave("joined-another-room");
      }
    });

    socket.on("room:duplicate-tab", (data: { roomId: string }) => {
      // This is the NEW tab — the user already has an active session in another
      // tab. Redirect back to the room so they land on the existing session.
      toast({
        title: "Already in this room",
        description: "You already have this room open in another tab. Switching back...",
      });
      setTimeout(() => {
        // Try to close this tab (works if opened via window.open / target="_blank").
        // If close is blocked, redirect to the room so the user sees it.
        try { window.close(); } catch (_) {}
        // Fallback: redirect to the room after a short delay
        setTimeout(() => { window.location.href = `/room/${data.roomId}`; }, 400);
      }, 1200);
    });

    socket.on("room:already-in-room", (data: { roomId: string }) => {
      toast({
        title: "Already in another room",
        description: "You can only be in one room at a time. Leave your current room first.",
        variant: "destructive",
      });
    });

    socket.on("room:chat-message", (msg: ChatMessage) => {
      if (msg.userId !== user?.id && (blockedIdsRef.current.has(msg.userId) || foreverBlockedIdsRef.current.has(msg.userId))) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, { ...msg, reactions: msg.reactions || {} }];
      });
      if (sidePanelTabRef.current !== "chat" && (msg as any).type !== "system" && msg.userId !== user?.id) {
        setUnreadChatBadge((prev) => prev + 1);
      }
      // Increment browser-tab unread count when the tab is backgrounded
      if (document.hidden && (msg as any).type !== "system" && msg.userId !== user?.id) {
        setTabUnreadCount((prev) => prev + 1);
      }
      // ── Private message in-room notification ──────────────────────────────
      // Always fire a toast when someone whispers to you, regardless of whether
      // the chat panel is open — private messages deserve explicit attention.
      if (msg.isPrivate && msg.userId !== user?.id) {
        const senderName = msg.user ? getUserDisplayName(msg.user) : "Someone";
        const preview = msg.text.startsWith("[img:")
          ? "📷 Sent you an image"
          : msg.text.length > 72 ? msg.text.slice(0, 69) + "…" : msg.text;
        setPrivateUnreadCount((prev) => prev + 1);
        toast({
          title: `🔒 Whisper from ${senderName}`,
          description: preview,
          duration: 7000,
          action: (
            <ToastAction
              altText="Reply privately"
              onClick={() => {
                setSidePanelOpen(true);
                setSidePanelTab("chat");
                setPrivateChatToId(msg.userId);
              }}
            >
              Reply
            </ToastAction>
          ),
        });
      }
      // Clear typing indicator as soon as the message arrives
      if (msg.userId !== user?.id) {
        if (typingExpireTimers.current[msg.userId]) {
          clearTimeout(typingExpireTimers.current[msg.userId]);
          delete typingExpireTimers.current[msg.userId];
        }
        setTypingUsers((prev) => {
          if (!prev[msg.userId]) return prev;
          const next = { ...prev };
          delete next[msg.userId];
          return next;
        });
      }
    });

    socket.on("room:chat-delete", (data: { messageId: string }) => {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, text: "This message was deleted.", type: "deleted" as any, reactions: {}, replyTo: null }
            : m
        )
      );
    });

    socket.on("room:chat-edit", (data: { messageId: string; newText: string }) => {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, text: data.newText, edited: true }
            : m
        )
      );
    });

    socket.on("room:pinned-message", (data: { message: ChatMessage; pinnedBy: string; pinnedByName: string; pinnedAt: number } | null) => {
      setPinnedMessage(data || null);
    });

    socket.on("room:chat-seen", (data: { userId: string; messageId: string; userName: string; profileImageUrl?: string | null }) => {
      setSeenByMap(prev => {
        const next = { ...prev };
        // Remove this user from whatever message they previously "seen"
        Object.keys(next).forEach(msgId => {
          next[msgId] = next[msgId].filter(u => u.userId !== data.userId);
          if (next[msgId].length === 0) delete next[msgId];
        });
        // Add them to the new message
        next[data.messageId] = [
          ...(next[data.messageId] || []),
          { userId: data.userId, userName: data.userName, profileImageUrl: data.profileImageUrl },
        ];
        return next;
      });
    });

    const clearTypingUser = (userId: string) => {
      if (typingExpireTimers.current[userId]) {
        clearTimeout(typingExpireTimers.current[userId]);
        delete typingExpireTimers.current[userId];
      }
      setTypingUsers((prev) => {
        if (!prev[userId]) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    socket.on("room:typing", (data: { userId: string; displayName: string; profileImageUrl: string | null }) => {
      if (data.userId === user?.id) return;
      setTypingUsers((prev) => ({
        ...prev,
        [data.userId]: { name: data.displayName, avatar: data.profileImageUrl },
      }));
      // Auto-expire after 3.5 s in case typing-stop is never received
      if (typingExpireTimers.current[data.userId]) clearTimeout(typingExpireTimers.current[data.userId]);
      typingExpireTimers.current[data.userId] = setTimeout(() => {
        clearTypingUser(data.userId);
      }, 3500);
    });

    socket.on("room:typing-stop", (data: { userId: string }) => {
      clearTypingUser(data.userId);
    });

    socket.on("room:reaction-update", (data: { messageId: string; reactions: Record<string, string[]> }) => {
      setChatMessages((prev) =>
        prev.map((m) => m.id === data.messageId ? { ...m, reactions: data.reactions } : m)
      );
    });

    socket.on("room:movie", (data: { hostId?: string; movieId: string | null; movieTitle?: string; posterPath?: string; startedBy?: string; startedAt?: number; currentTime?: number; playing?: boolean }) => {
      const hostId = data.hostId || data.startedBy || "";
      if (!hostId) return;
      if (data.movieId) {
        setMovieHosts(prev => {
          const next = new Map(prev);
          next.set(hostId, { movieId: data.movieId!, movieTitle: data.movieTitle || "", posterPath: data.posterPath || "" });
          return next;
        });
        if (data.startedAt) {
          setMovieHostStartedAt(prev => { const next = new Map(prev); next.set(hostId, data.startedAt as number); return next; });
        }
        if (typeof data.currentTime === "number") {
          setMovieCurrentTimeByHost(prev => { const next = new Map(prev); next.set(hostId, data.currentTime!); return next; });
        }
        if (typeof data.playing === "boolean") {
          setMoviePlayingByHost(prev => { const next = new Map(prev); next.set(hostId, data.playing!); return next; });
        }
        if (hostId === user.id) {
          setShowYoutube(false);
          setMiniPlayerMode(false);
          setActiveMovieId(data.movieId);
          setActiveMovieTitle(data.movieTitle || "");
          setActiveMoviePoster(data.posterPath || "");
          setMovieStartedBy(hostId);
          setShowMovie(true);
        } else if (movieStartedByRef.current === hostId) {
          setActiveMovieId(data.movieId);
          setActiveMovieTitle(data.movieTitle || "");
          setActiveMoviePoster(data.posterPath || "");
        }
      } else {
        setMovieHosts(prev => { const next = new Map(prev); next.delete(hostId); return next; });
        setMovieWatchersByHost(prev => { const next = new Map(prev); next.delete(hostId); return next; });
        setMovieHostStartedAt(prev => { const next = new Map(prev); next.delete(hostId); return next; });
        if (hostId === user.id || movieStartedByRef.current === hostId) {
          setActiveMovieId(null);
          setActiveMovieTitle("");
          setActiveMoviePoster("");
          setMovieStartedBy(null);
          setShowMovie(false);
        }
      }
    });

    // Real-time movie sync — mirrors room:youtube-state. Host emits, watchers resync.
    socket.on("room:movie-state", (data: { hostId: string; action: string; time?: number; from: string }) => {
      if (data.from === user.id) return;
      // Update stored state for this host
      if (typeof data.time === "number") {
        setMovieCurrentTimeByHost(prev => { const n = new Map(prev); n.set(data.hostId, data.time!); return n; });
      }
      setMoviePlayingByHost(prev => { const n = new Map(prev); n.set(data.hostId, data.action === "play"); return n; });
      // If we're actively watching this host, resync our player
      if (movieStartedByRef.current === data.hostId && typeof data.time === "number") {
        const newOffset = Math.floor(data.time);
        const v = movieVideoRef.current;
        if (v) {
          v.currentTime = newOffset;
          if (data.action === "play") v.play().catch(() => {});
          else v.pause();
        } else {
          setMovieStartOffset(newOffset);
          setMovieSyncKey(k => k + 1);
        }
      }
    });

    socket.on("room:movie-watchers-update", (data: { hostId?: string; userId: string; watching: boolean }) => {
      const hostId = data.hostId || "";
      if (!hostId) return;
      setMovieWatchersByHost(prev => {
        const next = new Map(prev);
        const set = new Set(next.get(hostId) || []);
        if (data.watching) set.add(data.userId);
        else set.delete(data.userId);
        if (set.size > 0) next.set(hostId, set);
        else next.delete(hostId);
        return next;
      });
    });

    socket.on("room:youtube", (data: { hostId?: string; videoId: string | null; startedBy?: string }) => {
      // Per-host watch parties: each host owns their own slot. We must NOT
      // change MY active video just because someone else started/stopped a
      // video — only update my view if this is my own host slot, or if it's
      // the host I'm currently watching (e.g. a queue advance).
      const hostId = data.hostId || data.startedBy || "";
      if (!hostId) return;

      // Update the global hosts map.
      setYoutubeHosts(prev => {
        const next = new Map(prev);
        if (data.videoId) next.set(hostId, data.videoId);
        else next.delete(hostId);
        return next;
      });
      // Clear per-host watcher set when a host stops broadcasting.
      if (!data.videoId) {
        setYoutubeWatchersByHost(prev => {
          const next = new Map(prev);
          next.delete(hostId);
          return next;
        });
      }

      const isMine = hostId === user.id;
      const watchingThisHost = youtubeStartedByRef.current === hostId;

      if (!data.videoId) {
        // The host I was watching (or my own slot) is now empty — close my view.
        if (isMine || watchingThisHost) {
          setActiveYoutubeId(null);
          setYoutubeStartedBy(null);
          setShowYoutube(false);
          setMiniPlayerMode(false);
          setUserDismissedYoutube(false);
          setMyYtVote(null);
          setMyYtSkipVote(false);
          setYtVotes({ likes: 0, dislikes: 0, skip: 0, watchers: 0 });
        }
        return;
      }

      if (isMine) {
        // I just (re)started my own broadcast — open the player automatically.
        setActiveYoutubeId(data.videoId);
        setYoutubeStartedBy(hostId);
        setShowYoutube(true);
        setUserDismissedYoutube(false);
        setMyYtVote(null);
        setMyYtSkipVote(false);
        setYtVotes({ likes: 0, dislikes: 0, skip: 0, watchers: 0 });
      } else if (watchingThisHost) {
        // The host I'm watching switched videos (e.g. queue advanced).
        setActiveYoutubeId(data.videoId);
        setUserDismissedYoutube(false);
        setMyYtVote(null);
        setMyYtSkipVote(false);
        setYtVotes({ likes: 0, dislikes: 0, skip: 0, watchers: 0 });
      }
    });

    socket.on("room:book", (data: { book: any | null; hostId: string | null; scrollPct: number; watchers?: string[] }) => {
      if (data.book && data.hostId) {
        if (data.hostId !== user.id) {
          setBookHostId(data.hostId);
          setSharedBook(data.book);
          // A new book session just started — reset follow state so stale
          // isFollowingBook from a previous session doesn't gate the close emit.
          setIsFollowingBook(false);
        }
        // Always reset bookReaders to the authoritative list from the server.
        // Using additive logic here caused old-session watcher IDs to linger
        // in bookReaders when a new session replaced the previous one.
        if (data.watchers && data.watchers.length > 0) {
          setBookReaders(new Set(data.watchers));
        } else if (data.hostId !== user.id) {
          // Fallback (legacy server): reset to just the new host.
          setBookReaders(new Set([data.hostId]));
        }
      } else if (!data.book) {
        setBookHostId(null);
        setSharedBook(null);
        setIsFollowingBook(false);
        setBookReaders(new Set());
        // Close the e-reader for everyone except the host who triggered the close
        // (they already closed it locally in handleCloseBook before emitting).
        if (data.hostId !== user.id) {
          setShowEReader(false);
          setSelectedBook(null);
          setBookText("");
        }
      }
    });

    socket.on("room:book-scroll", (data: { scrollPct?: number; page?: number }) => {
      if (data.page != null) {
        setCurrentPage(data.page);
        return;
      }
      const el = bookScrollRef.current;
      if (!el) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll > 0 && data.scrollPct != null) {
        el.scrollTop = data.scrollPct * maxScroll;
      }
    });

    socket.on("room:book-watchers-update", (data: { userId: string; watching: boolean }) => {
      setBookReaders(prev => {
        const next = new Set(prev);
        if (data.watching) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    });

    socket.on("room:youtube-watchers-update", (data: { hostId?: string; userId: string; watching: boolean }) => {
      const hostId = data.hostId || "";
      if (!hostId) return;
      setYoutubeWatchersByHost(prev => {
        const next = new Map(prev);
        const set = new Set(next.get(hostId) || []);
        if (data.watching) set.add(data.userId);
        else set.delete(data.userId);
        if (set.size > 0) next.set(hostId, set);
        else next.delete(hostId);
        return next;
      });
    });

    socket.on("room:youtube-queue-update", (data: { queue: YtQueueItem[] }) => {
      setYtQueue(data.queue ?? []);
    });

    // Host has force-stopped my screen share — stop it immediately and let everyone know.
    socket.on("room:screen-share-force-stop", () => {
      if (screenStream.current) {
        try { stopMyScreenShare(); } catch (_) {}
        toast({ title: "Screen sharing stopped", description: "The room host stopped your screen share." });
      }
    });

    socket.on("room:screen-watchers-update", (data: { userId: string; watching: boolean; sharerId: string }) => {
      setScreenWatchers(prev => {
        const next = new Set(prev);
        if (data.watching) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    });

    socket.on("room:screen-share", (data: { userId: string; active: boolean }) => {
      if (data.userId === user.id) return;
      if (data.active) {
        // Mark this peer as actively sharing — primary signal used by the
        // ontrack handler so future video tracks from this peer are routed
        // to the screen slot regardless of label heuristics.
        screenSharingPeerIds.current.add(data.userId);
        setAvailableScreenUsers((prev) => { const n = new Set(Array.from(prev)); n.add(data.userId); return n; });
        // A screen share from another user does NOT affect an active YouTube
        // session. YouTube continues uninterrupted — the room can watch both
        // independently. YouTube only gets hidden if the YouTube starter
        // explicitly clicks on the screen-sharer's tile to watch their screen.
      } else {
        screenSharingPeerIds.current.delete(data.userId);
        remoteScreenStreams.current.delete(data.userId);
        setAvailableScreenUsers((prev) => { const n = new Set(prev); n.delete(data.userId); return n; });
        setRemoteScreenShareUserId((prev) => prev === data.userId ? null : prev);
        if (remoteScreenRef.current) {
          remoteScreenRef.current.srcObject = null;
        }
      }
    });

    socket.on("room:video-status", (data: { userId: string; active: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === data.userId ? { ...p, hasVideo: data.active } : p))
      );
      if (!data.active && data.userId !== user.id) {
        remoteVideoStreams.current.delete(data.userId);
        setAvailableVideoUsers((prev) => { const n = new Set(prev); n.delete(data.userId); return n; });
        setRemoteVideoUserId((prev) => prev === data.userId ? null : prev);
      }
    });

    // Synced playback: when the host plays/pauses/seeks, watchers follow.
    // Only applied to non-hosts to prevent feedback loops.
    socket.on("room:youtube-state", (data: { action: string; time?: number; ts?: number; senderId?: string }) => {
      if (!data?.action) return;
      // Ignore if we are the host (we drove the action)
      if (user?.id === youtubeStartedByRef.current) return;
      const player = youtubePlayerRef.current;
      if (!player) return;
      const networkDelay = data.ts ? Math.min((Date.now() - data.ts) / 1000, 3) : 0.15;
      ytRemoteAction.current = true;
      setTimeout(() => { ytRemoteAction.current = false; }, 3500);
      try {
        if (data.action === "play") {
          const target = (data.time ?? 0) + networkDelay;
          player.seekTo(target, true);
          player.playVideo();
        } else if (data.action === "pause") {
          player.pauseVideo();
          if (data.time !== undefined) player.seekTo(data.time, true);
        } else if (data.action === "seek") {
          const target = (data.time ?? 0) + networkDelay;
          player.seekTo(target, true);
          player.playVideo();
        }
      } catch (_) {}
    });

    // Server may still emit a denial in rare edge cases (e.g. trying to close
    // someone else's video for everyone). Show a generic message.
    socket.on("room:youtube-denied", (data: { reason?: string }) => {
      toast({
        title: "Can't do that",
        description: data?.reason || "That action isn't allowed for this video.",
        variant: "destructive",
      });
    });

    socket.on("room:youtube-votes", (data: { hostId?: string; videoId?: string; likes: number; dislikes: number; skip: number; watchers: number }) => {
      // Per-host votes — only update my UI if this update is for the host I'm watching.
      if (data.hostId && youtubeStartedByRef.current && data.hostId !== youtubeStartedByRef.current) return;
      setYtVotes({ likes: data.likes || 0, dislikes: data.dislikes || 0, skip: data.skip || 0, watchers: data.watchers || 0 });
    });

    socket.on("room:youtube-skipped", (data: { hostId?: string }) => {
      if (data?.hostId && youtubeStartedByRef.current && data.hostId !== youtubeStartedByRef.current) return;
      // Server advanced past this video — reset our local vote toggles.
      setMyYtVote(null);
      setMyYtSkipVote(false);
    });

    // Floating watch-party reactions — anyone in the room can fire emojis on the video.
    socket.on("room:youtube-reaction", (data: { userId: string; emoji: string; ts: number }) => {
      const id = `${data.ts}-${data.userId}-${Math.random().toString(36).slice(2, 7)}`;
      const left = 8 + Math.random() * 84; // % across the player width
      setYtFloatingReactions(prev => [...prev, { id, emoji: data.emoji, left, userId: data.userId }]);
      window.setTimeout(() => {
        setYtFloatingReactions(prev => prev.filter(r => r.id !== id));
      }, 2600);
    });

    socket.on("room:movie-reaction", (data: { userId: string; emoji: string; ts: number }) => {
      const id = `${data.ts}-${data.userId}-${Math.random().toString(36).slice(2, 7)}`;
      const left = 8 + Math.random() * 84;
      setMovieFloatingReactions(prev => [...prev, { id, emoji: data.emoji, left, userId: data.userId }]);
      window.setTimeout(() => {
        setMovieFloatingReactions(prev => prev.filter(r => r.id !== id));
      }, 2600);
    });

    socket.on("room:roles", (roles: Record<string, string>) => {
      setParticipantRoles(roles);
    });

    socket.on("room:roles-update", (data: { userId: string; role: string; roles: Record<string, string> }) => {
      setParticipantRoles(data.roles);
    });

    socket.on("room:host-vote-start", (data: { nomineeId: string; nomineeName: string; nominatorId: string; nominatorName: string; totalVoters: number; yesVotes: number; noVotes: number }) => {
      setHostVoteModal({ nomineeId: data.nomineeId, nomineeName: data.nomineeName, nominatorId: data.nominatorId, nominatorName: data.nominatorName, totalVoters: data.totalVoters });
      setHostVoteProgress({ yesVotes: data.yesVotes, noVotes: data.noVotes, totalVoters: data.totalVoters });
      setMyHostVote(null);
    });

    socket.on("room:host-vote-progress", (data: { nomineeId: string; yesVotes: number; noVotes: number; totalVoters: number }) => {
      setHostVoteProgress({ yesVotes: data.yesVotes, noVotes: data.noVotes, totalVoters: data.totalVoters });
    });

    socket.on("room:host-vote-end", (data: { nomineeId: string; transferred: boolean; reason: string }) => {
      setHostVoteModal(null);
      setHostVoteProgress(null);
      setMyHostVote(null);
    });

    socket.on("room:troll-vote-start", (data: { targetUserId: string; targetName: string; assignedByName: string; totalMembers: number }) => {
      setTrollVoteModal(data);
      setTrollVoteProgress({ kickVotes: 0, totalVoters: Math.max(1, data.totalMembers - 1) });
      setMyTrollVote(null);
    });

    socket.on("room:troll-vote-progress", (data: { targetUserId: string; kickVotes: number; totalVoters: number }) => {
      setTrollVoteProgress({ kickVotes: data.kickVotes, totalVoters: data.totalVoters });
    });

    socket.on("room:troll-vote-end", (data: { targetUserId: string; kicked: boolean; reason: string }) => {
      setTrollVoteModal(null);
      setTrollVoteProgress(null);
      setMyTrollVote(null);
    });

    socket.on("room:troll-restricted", (data: { reason: string }) => {
      toast({ variant: "destructive", title: "🧌 Troll Restriction", description: data.reason, duration: 3000 });
    });

    // Snapshot of all avatar GIFs already set before this user joined
    socket.on("room:avatar-gifs-snapshot", (snapshot: Record<string, string>) => {
      if (!snapshot) return;
      setParticipantAvatarGifs((prev) => ({ ...snapshot, ...prev }));
    });

    socket.on("room:avatar-gif", (data: { userId: string; gifUrl: string | null }) => {
      if (!data?.userId) return;
      setParticipantAvatarGifs((prev) => {
        if (data.gifUrl) return { ...prev, [data.userId]: data.gifUrl };
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
    });

    // ── DJ Mode — host toggles disco sling animations for all participants ──
    socket.on("room:dj-mode", (data: { active: boolean; scene?: string; moveStyle?: string; overlaySceneIdx?: number }) => {
      setDjModeActive(!!data?.active);
      if (data?.active) {
        setDjCurrentScene(data.scene || "spotlight");
        if (data.moveStyle) setDjMoveStyle(data.moveStyle);
        else setDjMoveStyle("auto");
        setDjMoveTick(0);
        if (data.overlaySceneIdx !== undefined) setDiscoOverlaySceneIdx(data.overlaySceneIdx);
        // Clear all floating emojis and reaction particles when DJ mode turns on
        setParticipantMoods({});
        setYtFloatingReactions([]);
        setMovieFloatingReactions([]);
        // Start the 3-2-1 intro countdown for all users
        setDjCountdown(3);
        // Fire the intro beat-drop pulse on all cards (after countdown)
        setTimeout(() => setDjBeatDropTick(t => t + 1), 3000);
      } else {
        setDjSpotlightIdx(-1);
        setDjCurrentScene("spotlight");
        setDjMoveTick(0);
      }
    });
    // ── DJ Skip — server sends the next scene name, all clients sync together ──
    socket.on("room:dj-skip", (data?: { scene?: string }) => {
      if (data?.scene) setDjCurrentScene(data.scene);
      // Clear mood emojis on every scene change so they don't clutter DJ visuals
      setParticipantMoods({});
      // Fire the beat-drop pulse on all participant cards
      setDjBeatDropTick(t => t + 1);
    });
    // ── DJ Move — host changes movement style for all participant cards ──
    socket.on("room:dj-move", (data: { moveStyle: string }) => {
      if (data?.moveStyle) setDjMoveStyle(data.moveStyle);
    });
    // ── Disco Overlay Advance — server broadcasts new scene index so all clients stay in sync ──
    socket.on("room:disco-advance", (data: { sceneIdx: number }) => {
      if (typeof data?.sceneIdx === "number") setDiscoOverlaySceneIdx(data.sceneIdx);
    });

    socket.on("room:updated", (updatedRoom: any) => {
      if (updatedRoom && updatedRoom.id === room.id) {
        setRoomData((prev: any) => {
          const prevTheme = (prev as any).roomTheme;
          const newTheme = updatedRoom.roomTheme;
          // When theme changes away from disco, turn off DJ mode immediately for all users
          if (prevTheme === "disco" && newTheme && newTheme !== "disco") {
            setDjModeActive(false);
            setDjSpotlightIdx(-1);
            setDjCurrentScene("spotlight");
            setDiscoOverlaySceneIdx(0);
          }
          return { ...prev, ...updatedRoom };
        });
      }
    });

    socket.on("room:host-transferred", (data: { newOwnerId: string; previousOwnerId: string }) => {
      setRoomData((prev: any) => ({ ...prev, ownerId: data.newOwnerId }));
    });

    socket.on("user:blocked", ({ otherId, blockType }: { otherId: string; blockType?: string }) => {
      if (blockType === "forever") {
        setForeverBlockedIds(prev => { const n = new Set(prev); n.add(otherId); foreverBlockedIdsRef.current = n; return n; });
        setParticipants(prev => prev.filter(p => p.id !== otherId));
        cleanupPeer(otherId);
      } else {
        setBlockedIds(prev => { const n = new Set(prev); n.add(otherId); blockedIdsRef.current = n; return n; });
        cleanupPeer(otherId);
      }
    });

    socket.on("user:unblocked", ({ otherId }: { otherId: string }) => {
      setBlockedIds(prev => { const n = new Set(prev); n.delete(otherId); blockedIdsRef.current = n; return n; });
      setForeverBlockedIds(prev => { const n = new Set(prev); n.delete(otherId); foreverBlockedIdsRef.current = n; return n; });
      queryClient.invalidateQueries({ queryKey: ["/api/blocks"] });
    });

    socket.on("room:welcome-message", (data: { welcomeMessage: string; welcomeMediaUrls: string[]; welcomeMediaTypes: string[]; welcomeMediaPosition: string; welcomeAccentColor: string }) => {
      const welcomeMsg: ChatMessage = {
        id: `welcome-${Date.now()}`,
        userId: "system",
        text: data.welcomeMessage,
        createdAt: new Date().toISOString(),
        type: "welcome",
        reactions: {},
        replyTo: null,
        welcomeMessage: data.welcomeMessage,
        welcomeMediaUrls: data.welcomeMediaUrls || [],
        welcomeMediaTypes: data.welcomeMediaTypes || [],
        welcomeMediaPosition: (data.welcomeMediaPosition as "above" | "below" | "between") || "below",
        welcomeAccentColor: data.welcomeAccentColor || "#8B5CF6",
      };
      setChatMessages(prev => [welcomeMsg, ...prev.filter(m => m.type !== "welcome")]);
    });

    // AI tutor socket events are handled by the useAiTutor hook.

    let roomBc: BroadcastChannel | null = null;
    try {
      roomBc = new BroadcastChannel(`connect-room-${user.id}`);
      roomBc.onmessage = (ev) => {
        if (ev.data?.type === "room-joined" && ev.data?.roomId !== room.id) {
          window.close();
          setTimeout(() => handleLeave("joined-another-room"), 50);
        }
      };
    } catch {}

    return () => {
      roomBc?.close();
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener("visibilitychange", handleVisibilityForRoom);
      socket.emit("room:leave", { roomId: room.id, userId: user.id });
      socket.off("connect", handleReconnect);
      socket.off("room:participants");
      socket.off("room:user-joined");
      socket.off("room:user-left");
      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice-candidate");
      socket.off("webrtc:new-peer");
      socket.off("room:speaking");
      socket.off("room:hand-raised");
      socket.off("user:profile-updated");
      socket.off("room:bye");
      socket.off("room:moods-snapshot");
      socket.off("room:mood-update");
      socket.off("room:avatar-gifs-snapshot");
      socket.off("room:dj-mode");
      socket.off("room:dj-skip");
      socket.off("room:dj-move");
      // Cancel any in-flight mood-clear timers so they don't fire after unmount.
      Object.values(moodTimersRef.current).forEach((t) => clearTimeout(t));
      moodTimersRef.current = {};
      socket.off("room:mute-update");
      socket.off("room:video-force-off");
      socket.off("room:chat-blocked");
      socket.off("room:kicked");
      socket.off("room:host-deleted");
      socket.off("room:joined-another-room");
      socket.off("room:duplicate-tab");
      socket.off("room:already-in-room");
      socket.off("room:chat-message");
      socket.off("room:chat-delete");
      socket.off("room:chat-edit");
      socket.off("room:typing");
      socket.off("room:typing-stop");
      Object.values(typingExpireTimers.current).forEach((t) => clearTimeout(t));
      typingExpireTimers.current = {};
      socket.off("room:reaction-update");
      socket.off("room:movie");
      socket.off("room:movie-state");
      socket.off("room:movie-watchers-update");
      socket.off("room:youtube");
      socket.off("room:youtube-watchers-update");
      socket.off("room:youtube-queue-update");
      socket.off("room:book-watchers-update");
      socket.off("room:screen-share");
      socket.off("room:screen-share-force-stop");
      socket.off("room:screen-watchers-update");
      socket.off("room:video-status");
      socket.off("room:youtube-state");
      socket.off("room:roles");
      socket.off("room:roles-update");
      socket.off("room:host-vote-start");
      socket.off("room:host-vote-progress");
      socket.off("room:host-vote-end");
      socket.off("room:troll-vote-start");
      socket.off("room:troll-vote-progress");
      socket.off("room:troll-vote-end");
      socket.off("room:troll-restricted");
      socket.off("room:updated");
      socket.off("room:host-transferred");
      socket.off("user:blocked");
      socket.off("user:unblocked");
      socket.off("room:welcome-message");
      // AI tutor socket.off handled by useAiTutor hook cleanup.
      rawMicStreamRef.current?.getTracks().forEach((t) => t.stop());
      voiceProcessorRef.current?.destroy();
      voiceProcessorRef.current = null;
      localStream.current?.getTracks().forEach((t) => t.stop());
      screenStream.current?.getTracks().forEach((t) => t.stop());
      videoStream.current?.getTracks().forEach((t) => t.stop());
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      audioElements.current.forEach((audio) => {
        audio.srcObject = null;
        audio.remove();
      });
      audioElements.current.clear();
    };
  }, [socket, user, room.id, createPeerConnection, cleanupPeer, flushPendingCandidates, addSystemMessage, playNotificationSound, getAudioConstraints, applyLocalAudioStream, refreshAudioInputDevices, updateMicPermissionStatus]);

  // ── DJ Spotlight cycling — illuminates one participant at a time every 1.8s ─
  useEffect(() => {
    if (!djModeActive || djCurrentScene !== "spotlight") {
      setDjSpotlightIdx(-1);
      return;
    }
    let cur = 0;
    setDjSpotlightIdx(cur);
    const id = setInterval(() => {
      cur = (cur + 1) % 20;
      setDjSpotlightIdx(cur);
    }, 1800);
    return () => clearInterval(id);
  }, [djModeActive, djCurrentScene]);

  // ── Keep djModeActiveRef in sync so socket handlers can read current value ───
  useEffect(() => { djModeActiveRef.current = djModeActive; }, [djModeActive]);

  // ── DJ Intro countdown — ticks 3→2→1→null every 0.9s ────────────────────────
  useEffect(() => {
    if (djCountdown === null || djCountdown <= 0) { setDjCountdown(null); return; }
    const id = setTimeout(() => setDjCountdown(n => (n !== null && n > 1) ? n - 1 : null), 900);
    return () => clearTimeout(id);
  }, [djCountdown]);

  // ── DJ Auto-advance — host automatically cycles scenes every 20s ────────────
  useEffect(() => {
    if (!djModeActive || !djAutoAdvance || !isHost) return;
    const id = setInterval(() => {
      socket?.emit("room:dj-skip", { roomId: room.id });
    }, 20000);
    return () => clearInterval(id);
  }, [djModeActive, djAutoAdvance, isHost, socket, room.id]);

  // ── DJ Move auto-cycle — advances movement style every 5s when "auto" mode ──
  // All clients reset tick to 0 on dj-mode activate (in the socket handler),
  // so they all stay in sync without any additional socket traffic.
  useEffect(() => {
    if (!djModeActive || djMoveStyle !== "auto") return;
    const id = setInterval(() => setDjMoveTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [djModeActive, djMoveStyle]);

  useEffect(() => {
    if (!socket || !user) return;
    const handleRoomDm = (msg: any) => {
      if (msg.fromId === user.id) return;
      if (msg.toId !== user.id) return;
      if (blockedIdsRef.current.has(msg.fromId) || foreverBlockedIdsRef.current.has(msg.fromId)) return;
      // Don't badge if the DM panel is already open for this sender
      if (dmUserId === msg.fromId) return;
      const fromUser = participants.find(p => p.id === msg.fromId) as User | undefined;
      if (roomDmTimerRef.current) clearTimeout(roomDmTimerRef.current);
      setRoomDmNotification({ fromId: msg.fromId, text: msg.text, fromUser });
      roomDmTimerRef.current = setTimeout(() => setRoomDmNotification(null), 7000);
      setDmUnreadCounts(prev => ({ ...prev, [msg.fromId]: (prev[msg.fromId] || 0) + 1 }));
    };
    // Clears a sender's badge when messages are read from anywhere — the lobby
    // header, the room's own DM panel, or another open tab. The server emits
    // "dm:read-self" to the reader's socket whenever POST /api/messages/read/:id
    // is called, regardless of which surface triggered the read.
    const handleDmReadSelf = (data: { otherUserId: string }) => {
      setDmUnreadCounts(prev => {
        if (!prev[data.otherUserId]) return prev;
        const next = { ...prev };
        delete next[data.otherUserId];
        return next;
      });
    };
    socket.on("dm:new", handleRoomDm);
    socket.on("dm:read-self", handleDmReadSelf);
    return () => {
      socket.off("dm:new", handleRoomDm);
      socket.off("dm:read-self", handleDmReadSelf);
      if (roomDmTimerRef.current) clearTimeout(roomDmTimerRef.current);
    };
  }, [socket, user, participants, dmUserId]);

  useEffect(() => {
    if (!socket || !user) return;
    const handleTimeRequest = ({ requesterId }: { requesterId: string }) => {
      if (user.id !== youtubeStartedByRef.current) return;
      try {
        const time = youtubePlayerRef.current?.getCurrentTime?.() || 0;
        socket.emit("room:youtube-time-respond", { roomId: room.id, time, requesterId, ts: Date.now() });
      } catch (_) {}
    };
    const handleTimeResponded = ({ time, ts }: { time: number; ts?: number }) => {
      // Dynamic one-way latency compensation using broadcaster timestamp
      const networkDelay = ts ? Math.min((Date.now() - ts) / 1000, 3) : 0.15;
      const compensated = time + networkDelay;
      ytSyncTimeRef.current = compensated;
      try {
        if (youtubePlayerRef.current?.seekTo) {
          ytRemoteAction.current = true;
          youtubePlayerRef.current.seekTo(compensated, true);
          youtubePlayerRef.current.playVideo();
          // 3500ms covers buffering after seek — prevents broadcaster re-emit loop
          setTimeout(() => { ytRemoteAction.current = false; }, 3500);
        }
      } catch (_) {}
    };
    socket.on("room:youtube-time-request", handleTimeRequest);
    socket.on("room:youtube-time-responded", handleTimeResponded);
    return () => {
      socket.off("room:youtube-time-request", handleTimeRequest);
      socket.off("room:youtube-time-responded", handleTimeResponded);
    };
  }, [socket, user, room.id]);

  // Independent playback: opening the player no longer auto-syncs to the starter.
  // Users start watching from the beginning (or whatever YouTube resumes at) and
  // can press the "Sync with starter" button if they want to jump to the
  // starter's current position.

  const handleYtSyncToStarter = useCallback(() => {
    if (!socket || !user || !activeYoutubeId) return;
    if (user.id === youtubeStartedByRef.current) return;
    const hostId = youtubeStartedByRef.current;
    if (!hostId) return;
    socket.emit("room:youtube-time-request", { roomId: room.id, hostId, requesterId: user.id });
  }, [socket, user, activeYoutubeId, room.id]);

  useEffect(() => {
    if (sidePanelTab === "read") {
      if (readBooks.length === 0 && !readLoading) loadDefaultBooks();
      if (!savedArticlesLoaded) loadSavedArticles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidePanelTab]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Emit seen receipt when chat tab is active and new messages arrive
  useEffect(() => {
    if (!socket || !user || sidePanelTab !== "chat") return;
    const visibleMsgs = chatMessages.filter(m => m.type !== "system" && (m as any).type !== "deleted");
    if (visibleMsgs.length === 0) return;
    const lastMsg = visibleMsgs[visibleMsgs.length - 1];
    if (lastMsg.id === lastSeenEmittedRef.current) return;
    lastSeenEmittedRef.current = lastMsg.id;
    socket.emit("room:chat-seen", {
      roomId: room.id,
      userId: user.id,
      messageId: lastMsg.id,
      userName: user.firstName || user.email || "User",
      profileImageUrl: user.profileImageUrl ?? null,
    });
  }, [chatMessages, sidePanelTab, socket, user, room.id]);

  // Dynamic favicon badge — redesigned for maximum visibility.
  //
  // Key design decisions:
  //   • 128×128 canvas — 2× previous resolution so badge details survive
  //     browser downscaling to 16 or 32 px actual display pixels.
  //   • Badge radius=38 on 128px canvas → ~19 px diameter at 32 px display,
  //     ~9.5 px diameter at 16 px display. Both are impossible to miss.
  //   • 5 px pure-white border ring gives maximum contrast against dark
  //     Chrome tabs AND light Safari/Edge tab bars.
  //   • Icon drawn at 80×80 in the bottom-left so badge occupies its own
  //     unobstructed top-right quadrant.
  //   • Title "(N) Room — Vextorn" as a text fallback for browsers that
  //     do not re-render canvas favicons mid-session.
  //
  // We must update ALL favicon <link> elements (SVG + PNG) because browsers
  // prefer SVG and will ignore a PNG data-URL update when an SVG link exists.
  useEffect(() => {
    const S = 128; // canvas size
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Collect original hrefs so we can restore them on cleanup
    const allIconLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='shortcut icon']")
    );
    const origHrefs = allIconLinks.map((l) => l.href);
    const origTypes = allIconLinks.map((l) => l.type);

    // Update the document title as a text-fallback for browsers that cache
    // the canvas favicon between renders.
    const roomName = room?.title || "Room";
    if (tabUnreadCount > 0) {
      document.title = `(${tabUnreadCount}) ${roomName} — Vextorn`;
    } else {
      document.title = `${roomName} — Vextorn`;
    }

    const applyFavicon = (dataUrl: string) => {
      if (allIconLinks.length > 0) {
        allIconLinks.forEach((link) => {
          link.type = "image/png";
          link.href = dataUrl;
        });
      } else {
        const link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/png";
        link.setAttribute("sizes", "128x128");
        link.href = dataUrl;
        document.head.appendChild(link);
      }
    };

    const drawBadge = (img: HTMLImageElement | null, badgeOpacity = 1) => {
      ctx.clearRect(0, 0, S, S);

      if (tabUnreadCount > 0) {
        // ── Icon: 68×68 anchored to bottom-left, with rounded clip ──────
        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(0, S - 68, 68, 68, 12);
          ctx.clip();
          ctx.drawImage(img, 0, S - 68, 68, 68);
          ctx.restore();
        }

        // ── Badge: top-right quadrant, radius=48 ─────────────────────────
        const label = tabUnreadCount > 99 ? "99+" : String(tabUnreadCount);
        const badgeR = 48;
        const cx = S - badgeR - 2; // 78
        const cy = badgeR + 2;     // 50

        // All badge layers share the same pulsed opacity
        ctx.save();
        ctx.globalAlpha = badgeOpacity;

        // Layer 1: subtle drop shadow (dark transparent ring)
        ctx.beginPath();
        ctx.arc(cx, cy, badgeR + 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.30)";
        ctx.fill();

        // Layer 2: thick pure-white border — contrast against any tab bar
        ctx.beginPath();
        ctx.arc(cx, cy, badgeR + 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        // Layer 3: dark-red ring (separation from white border)
        ctx.beginPath();
        ctx.arc(cx, cy, badgeR + 1, 0, Math.PI * 2);
        ctx.fillStyle = "#a30010";
        ctx.fill();

        // Layer 4: vivid red fill — Material Red A400 (#ff1744) to #e00020
        ctx.beginPath();
        ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(cx - 10, cy - 10, 5, cx, cy, badgeR);
        grad.addColorStop(0, "#ff4d63");
        grad.addColorStop(0.55, "#ff1744");
        grad.addColorStop(1, "#c8001a");
        ctx.fillStyle = grad;
        ctx.fill();

        // Layer 5: white count number
        const digits = label.length;
        const fontSize = digits === 1 ? 54 : digits === 2 ? 40 : 30;
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${fontSize}px system-ui,Arial,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.60)";
        ctx.shadowBlur = 4;
        ctx.fillText(label, cx, cy + 2);
        ctx.shadowBlur = 0;

        ctx.restore(); // end badge opacity group
      } else {
        // ── No unread — full icon + green "in-room" presence dot ─────────
        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(0, 0, S, S, 22);
          ctx.clip();
          ctx.drawImage(img, 0, 0, S, S);
          ctx.restore();
        }

        // Green dot: bottom-right, radius=20
        const cx = S - 22, cy = S - 22, r = 20;

        // Shadow
        ctx.beginPath();
        ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fill();

        // White border
        ctx.beginPath();
        ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        // Dark green ring
        ctx.beginPath();
        ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
        ctx.fillStyle = "#15803d";
        ctx.fill();

        // Bright green fill
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        const gGrad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, r);
        gGrad.addColorStop(0, "#4ade80");
        gGrad.addColorStop(1, "#16a34a");
        ctx.fillStyle = gGrad;
        ctx.fill();
      }

      applyFavicon(canvas.toDataURL("image/png"));
    };

    // Load the base icon; if it fails, still draw badge without background
    const img = new Image();
    img.src = "/vextorn-icon-192.png";

    // Pulse interval — only active while there are unread messages.
    // Alternates between full (1.0) and dimmed (0.38) badge opacity on a
    // 700 ms cycle so the tab catches the eye even when it isn't focused.
    let pulseInterval: ReturnType<typeof setInterval> | null = null;

    const startPulse = (loadedImg: HTMLImageElement | null) => {
      drawBadge(loadedImg, 1);
      if (tabUnreadCount > 0) {
        let bright = false;
        pulseInterval = setInterval(() => {
          bright = !bright;
          drawBadge(loadedImg, bright ? 1 : 0.38);
        }, 700);
      }
    };

    img.onload = () => startPulse(img);
    img.onerror = () => startPulse(null);

    return () => {
      if (pulseInterval !== null) clearInterval(pulseInterval);
      // Restore all original favicon links and title
      allIconLinks.forEach((link, i) => {
        link.href = origHrefs[i];
        link.type = origTypes[i] || (origHrefs[i]?.endsWith(".svg") ? "image/svg+xml" : "image/png");
      });
      document.title = `${roomName} — Vextorn`;
    };
  }, [tabUnreadCount, room?.title]);

  // Reset tab unread count as soon as the user returns to this tab
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) setTabUnreadCount(0);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Auto-focus the stream key input when user returns to tab after clicking a dashboard button
  useEffect(() => {
    if (!glWaitingForKey) return;
    const handleFocus = () => {
      if (document.hidden) return;
      setTimeout(() => {
        if (glWaitingForKey === "twitch") {
          twKeyInputRef.current?.focus();
        } else {
          ytKeyInputRef.current?.focus();
        }
      }, 300);
    };
    document.addEventListener("visibilitychange", handleFocus);
    return () => document.removeEventListener("visibilitychange", handleFocus);
  }, [glWaitingForKey]);

  useEffect(() => {
    if (!historyLoadedRef.current) {
      if (chatMessages.length > 0) {
        historyLoadedRef.current = true;
        chatMessages.forEach(m => seenMsgIdsRef.current.add(String(m.id)));
      }
      return;
    }
    chatMessages.forEach(m => seenMsgIdsRef.current.add(String(m.id)));
  }, [chatMessages]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (isVideoOn && videoStream.current && el && el.srcObject !== videoStream.current) {
      el.srcObject = videoStream.current;
    }
  }, [isVideoOn]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (remoteVideoUserId && el) {
      const stream = remoteVideoStreams.current.get(remoteVideoUserId);
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
      }
    }
  }, [remoteVideoUserId]);

  useEffect(() => {
    const el = remoteScreenRef.current;
    if (remoteScreenShareUserId && el) {
      const stream = remoteScreenStreams.current.get(remoteScreenShareUserId);
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
      }
    }
    // Whenever we switch who we're watching (or stop watching), reset the
    // "playing" flag so the loading placeholder shows for the new viewer
    // until the first frame actually arrives.
    setRemoteScreenPlaying(false);
  }, [remoteScreenShareUserId]);

  // Stable ref callbacks for the remote-video and screen-share <video> elements.
  // Inline `ref={(el) => ...}` arrow functions are recreated on every render,
  // which makes React call the previous callback with `null` and the new one
  // with the same element on EVERY parent re-render. If that callback assigns
  // `el.srcObject = stream`, the video re-attaches its MediaStream and flickers
  // to black for a frame. Using stable callbacks (and guarding srcObject sets
  // with `!==`) means the stream is attached exactly once per change.
  const attachRemoteScreen = useCallback((el: HTMLVideoElement | null) => {
    remoteScreenRef.current = el;
    if (el && remoteScreenShareUserId) {
      const stream = remoteScreenStreams.current.get(remoteScreenShareUserId);
      if (stream && el.srcObject !== stream) el.srcObject = stream;
    }
  }, [remoteScreenShareUserId]);

  const attachRemoteVideo = useCallback((el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el && remoteVideoUserId) {
      const stream = remoteVideoStreams.current.get(remoteVideoUserId);
      if (stream && el.srcObject !== stream) el.srcObject = stream;
    }
  }, [remoteVideoUserId]);

  // Sharer's own local screen preview. Same stability rule applies — the
  // previous implementation used an inline arrow function as `ref`, which
  // React recreates on every render. Each parent re-render (someone joins,
  // someone speaks, mention popover toggles, etc.) caused the ref to be
  // called with `null` then the element again, re-assigning `srcObject` and
  // visibly flashing a black frame to the sharer. A stable callback fixes it.
  const attachLocalScreen = useCallback((el: HTMLVideoElement | null) => {
    screenVideoRef.current = el;
    if (el && screenStream.current && el.srcObject !== screenStream.current) {
      el.srcObject = screenStream.current;
    }
  }, []);

  // Track the YT slot's bounding rect so the persistent (fixed-position) player can
  // overlay it perfectly. Re-measures on resize, scroll, and layout-affecting state changes.
  useEffect(() => {
    if (!activeYoutubeId || !showYoutube || miniPlayerMode) {
      setYtSlotRect(null);
      return;
    }
    let rafId = 0;
    const measure = () => {
      const el = ytSlotRef.current;
      if (!el) { setYtSlotRect(null); return; }
      const r = el.getBoundingClientRect();
      setYtSlotRect(prev => {
        if (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) return prev;
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      });
    };
    // rAF-throttle so a burst of scroll/resize events coalesces to one measure per frame.
    const scheduleMeasure = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        measure();
      });
    };
    measure();
    // Observe only the slot itself — observing document.body fires on every layout change in the app.
    const ro = new ResizeObserver(scheduleMeasure);
    if (ytSlotRef.current) ro.observe(ytSlotRef.current);
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    window.addEventListener("scroll", scheduleMeasure, { capture: true, passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [activeYoutubeId, showYoutube, miniPlayerMode, sidePanelOpen, sidePanelTab, mobileSheetOpen]);

  useEffect(() => {
    // Opt-in playback: the YouTube iframe is created ONLY for users who have
    // actually opened the player (showYoutube) or have it in the floating
    // mini-player. Non-watchers get no iframe at all, which means no audio
    // leaks to people who never clicked "Join Watch Party". When the user
    // closes their view, the player is destroyed and audio stops immediately.
    let effectCancelled = false;
    const isActivelyWatching = showYoutube || miniPlayerMode;
    if (!activeYoutubeId || !isActivelyWatching) {
      if (youtubePlayerRef.current) {
        try { youtubePlayerRef.current.destroy(); } catch (_) {}
        youtubePlayerRef.current = null;
      }
      if (ytContainerRef.current) ytContainerRef.current.innerHTML = "";
      setYtPlayerLoading(false);
      setYtPlayerReady(false);
      setYtPlayerError(null);
      setYtIsPlaying(false);
      setYoutubeActive(false);
      ytHostFallbackRef.current = false;
      ytHostAutoRetriedRef.current = false;
      if (ytLoadTimeoutRef.current) { clearTimeout(ytLoadTimeoutRef.current); ytLoadTimeoutRef.current = null; }
      return;
    }
    setYtPlayerLoading(true);
    setYtPlayerReady(false);
    setYtPlayerError(null);

    // Hard timeout: if onReady never fires within 12s, surface an error so the
    // user sees a retry button instead of a forever spinner. Common causes:
    // ad-blocker blocking youtube-nocookie.com, blocked third-party scripts,
    // or a non-embeddable video that fails silently before onError fires.
    if (ytLoadTimeoutRef.current) { clearTimeout(ytLoadTimeoutRef.current); }
    ytLoadTimeoutRef.current = window.setTimeout(() => {
      console.warn("[YT] Load timeout — onReady never fired in 12s");
      setYtPlayerLoading(false);
      setYtPlayerError({ message: "Video took too long to load. Try again or open it on YouTube." });
    }, 12000);

    // Network-aware autoplay + quality strategy:
    // - Fast networks (4g / unknown / wifi-class): NO quality cap → let YT auto-pick HD for the smoothest experience.
    // - Slow networks (3g / 2g / save-data): cap to 240p so playback starts instantly.
    const conn: any = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const effType: string = conn?.effectiveType || "4g";
    const saveData: boolean = !!conn?.saveData;
    const downlink: number = typeof conn?.downlink === "number" ? conn.downlink : 10;
    const isSlowNet = saveData || effType === "slow-2g" || effType === "2g" || effType === "3g" || downlink < 1.5;
    const initialQuality: string | null = isSlowNet ? "small" : null; // null = let YT auto-pick

    const buildStateChangeHandler = (player: any, YT: any) => (event: any) => {
      const state = event.data;
      // Free4talk-style: anyone in the room can drive playback
      const isBroadcaster = !!user?.id;
      const sock = socketRef.current;
      if (state === YT.PlayerState.ENDED) {
        setYtIsPlaying(false);
        setYoutubeActive(false);
        // Independent playback: only the starter drives queue advance (so the next
        // video is broadcast to everyone). When no queue, every user simply loops
        // their own local player — no broadcast involved.
        if (user?.id === youtubeStartedByRef.current) {
          const currentQueue = ytQueueRef.current;
          if (currentQueue && currentQueue.length > 0) {
            sock?.emit("room:youtube-queue-next", { roomId: room.id });
            return;
          }
        }
        try { player.seekTo(0, true); player.playVideo(); } catch (_) {}
        return;
      }
      if (state === YT.PlayerState.PLAYING) {
        setYtIsPlaying(true);
        setYoutubeActive(true);
        try { const d = player.getDuration(); if (d > 0) setYtDuration(d); } catch (_) {}
        // Host broadcasts play + current time so watchers sync
        if (!ytRemoteAction.current && user?.id === youtubeStartedByRef.current && socketRef.current) {
          try {
            const t = player.getCurrentTime() || 0;
            socketRef.current.emit("room:youtube-state", { roomId: room.id, action: "play", time: t, ts: Date.now() });
          } catch (_) {}
        }
      } else if (state === YT.PlayerState.PAUSED) {
        setYtIsPlaying(false);
        setYoutubeActive(false);
        try { setYtCurrentTime(player.getCurrentTime() || 0); } catch (_) {}
        // Host broadcasts pause so watchers pause too
        if (!ytRemoteAction.current && user?.id === youtubeStartedByRef.current && socketRef.current) {
          try {
            const t = player.getCurrentTime() || 0;
            socketRef.current.emit("room:youtube-state", { roomId: room.id, action: "pause", time: t, ts: Date.now() });
          } catch (_) {}
        }
      } else if (state === YT.PlayerState.BUFFERING) {
        // Slow-internet adaptation: if buffering lasts >4s, downgrade quality one step.
        // Repeat every 5s of continuous buffering until we hit "small" (the lowest tier).
        if (ytBufferTimerRef.current) window.clearTimeout(ytBufferTimerRef.current);
        const downgrade = () => {
          try {
            const levels = ["hd1080", "hd720", "large", "medium", "small"];
            const cur = player.getPlaybackQuality?.() || "default";
            const idx = levels.indexOf(cur);
            const next = idx >= 0 && idx < levels.length - 1
              ? levels[idx + 1]
              : (cur === "default" || cur === "auto") ? "medium" : "small";
            if (next && next !== cur) {
              player.setPlaybackQuality?.(next);
              console.log(`[YT] slow internet — quality ${cur} → ${next}`);
              setYtQualityState("slow");
            }
          } catch (_) {}
          ytBufferTimerRef.current = window.setTimeout(downgrade, 5000);
        };
        ytBufferTimerRef.current = window.setTimeout(downgrade, 4000);
      } else {
        // Any non-buffering state cancels the downgrade timer
        if (ytBufferTimerRef.current) {
          window.clearTimeout(ytBufferTimerRef.current);
          ytBufferTimerRef.current = null;
        }
        // After 10 seconds of uninterrupted playback, mark connection as good again.
        if (state === YT.PlayerState.PLAYING) {
          ytBufferTimerRef.current = window.setTimeout(() => {
            setYtQualityState("good");
          }, 10000);
        }
      }
      // IMPORTANT (free4talk-style sync): we deliberately do NOT broadcast state from
      // auto-fired YT.PlayerState events. Auto play/pause/buffering events on each client
      // would otherwise create an emit cascade (one client buffers → emits pause → all
      // pause → recovers → emits play → all seek → buffers again, forever).
      // Only explicit user actions (handleYtPlayPause, handleYtSeek, video click) emit.
    };

    const createPlayer = (targetContainer?: HTMLDivElement | null) => {
      const container = targetContainer ?? ytContainerRef.current;
      console.log("[YT] createPlayer — container:", !!container, "videoId:", activeYoutubeId, "mini:", miniPlayerMode);
      if (!container) { console.warn("[YT] container ref is null, aborting"); return; }
      const YT = (window as any).YT;
      if (!YT || !YT.Player) { console.warn("[YT] YT.Player not ready"); return; }

      // Destroy old player if any
      if (youtubePlayerRef.current) {
        try { youtubePlayerRef.current.destroy(); } catch (_) {}
        youtubePlayerRef.current = null;
      }

      // Create an unmanaged inner element with a stable ID so YT API can reference it
      container.innerHTML = "";
      const innerId = "yt-inner-player";
      const innerDiv = document.createElement("div");
      innerDiv.id = innerId;
      innerDiv.style.width = "100%";
      innerDiv.style.height = "100%";
      container.appendChild(innerDiv);

      // Host fallback: start with privacy-friendly youtube-nocookie.com.
      // If that fails (blocker / restriction), we retry on www.youtube.com.
      const ytHost = ytHostFallbackRef.current
        ? "https://www.youtube.com"
        : "https://www.youtube-nocookie.com";
      console.log("[YT] Constructing YT.Player for", innerId, "video:", activeYoutubeId, "host:", ytHost);
      try {
        const player = new YT.Player(innerId, {
          videoId: activeYoutubeId,
          width: "100%",
          height: "100%",
          host: ytHost,
          playerVars: {
            autoplay: isSlowNet ? 0 : 1,
            mute: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            controls: user?.id === youtubeStartedByRef.current ? 1 : 0,
            fs: 1,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              console.log("[YT] onReady fired — quality:", initialQuality, "slowNet:", isSlowNet);
              if (ytLoadTimeoutRef.current) { clearTimeout(ytLoadTimeoutRef.current); ytLoadTimeoutRef.current = null; }
              setYtPlayerError(null);
              try {
                // Apply network-aware quality cap only on slow networks; on fast networks let YT auto-pick HD
                if (initialQuality) {
                  try { event.target.setPlaybackQuality?.(initialQuality); } catch (_) {}
                }
                if (ytSyncTimeRef.current > 0) {
                  event.target.seekTo(ytSyncTimeRef.current, true);
                  ytSyncTimeRef.current = 0;
                }
                event.target.playVideo();
                // Unmute immediately — starts muted to satisfy browser autoplay policy,
                // then unmutes right away so the user hears the video
                event.target.unMute();
                event.target.setVolume(100);
                setYtVolume(100);
                const d = event.target.getDuration();
                if (d > 0) setYtDuration(d);
                setYtPlayerLoading(false);
                setYtPlayerReady(true);
                if (isSlowNet) setYtQualityState("slow");
                // Auto-sync on join: a watcher who just opened the player jumps
                // straight to the starter's current playhead. After that, their
                // playback is fully independent — local play/pause/seek don't
                // affect anyone else, and they can press "Sync" again any time
                // to re-catch-up to the starter.
                if (user?.id !== youtubeStartedByRef.current && socketRef.current) {
                  const _hostId = youtubeStartedByRef.current;
                  if (_hostId) {
                    socketRef.current.emit("room:youtube-time-request", { roomId: room.id, hostId: _hostId, requesterId: user?.id });
                  }
                }
              } catch (err) { console.error("[YT] playVideo/unMute error:", err); }
            },
            onError: (e: any) => {
              console.warn("[YT] player error code:", e.data);
              if (ytLoadTimeoutRef.current) { clearTimeout(ytLoadTimeoutRef.current); ytLoadTimeoutRef.current = null; }
              // YT error codes:
              //   2   – invalid video id
              //   5   – HTML5 player error
              //   100 – video not found / private / removed
              //   101 / 150 – embed disabled by owner
              const code = Number(e?.data);
              // Auto-retry once on the *other* host before showing an error.
              // Some videos are blocked on youtube-nocookie.com but work on
              // www.youtube.com (and vice-versa for ad-blockers). This avoids
              // making every user click "Retry" by hand.
              const isRecoverable = code === 5 || code === 101 || code === 150;
              if (isRecoverable && !ytHostAutoRetriedRef.current) {
                console.log("[YT] auto-retry on alternate host");
                ytHostAutoRetriedRef.current = true;
                ytHostFallbackRef.current = !ytHostFallbackRef.current;
                setYtPlayerLoading(true);
                setYtPlayerReady(false);
                setYtRetryNonce((n) => n + 1);
                return;
              }
              const messages: Record<number, string> = {
                2:   "Invalid video ID.",
                5:   "Playback error in this browser. Try a refresh.",
                15:  "The owner of this video has disabled embedded playback.",
                100: "Video not found or has been removed.",
                101: "The owner of this video has disabled embedded playback.",
                150: "The owner of this video has disabled embedded playback.",
                153: "The owner of this video has disabled embedded playback.",
              };
              const msg = messages[code] ?? `Video could not be played (code ${code || "?"}).`;
              setYtPlayerLoading(false);
              setYtPlayerReady(false);
              setYtPlayerError({ code, message: msg });
            },
            onStateChange: (event: any) => {
              console.log("[YT] state change:", event.data);
              // Belt-and-suspenders unmute: in case onReady unmute didn't take effect
              if (event.data === YT.PlayerState.PLAYING) {
                try {
                  if (event.target.isMuted()) {
                    event.target.unMute();
                    event.target.setVolume(100);
                  }
                } catch (_) {}
              }
              buildStateChangeHandler(player, YT)(event);
            },
          },
        });
        youtubePlayerRef.current = player;
        console.log("[YT] Player instance created");
      } catch (e) {
        console.error("[YT] YT.Player constructor threw:", e);
      }
    };

    // Save current playhead before destroying so a full↔mini mode switch resumes
    // from the same position instead of restarting the video from 0.
    if (youtubePlayerRef.current) {
      try { ytSyncTimeRef.current = youtubePlayerRef.current.getCurrentTime() || 0; } catch (_) {}
    }

    // Route the YT API player into whichever container is currently visible:
    // mini-player div when floating, or the in-panel div when watching full-size.
    const targetContainer = miniPlayerMode ? ytMiniContainerRef.current : ytContainerRef.current;

    const YT = (window as any).YT;
    console.log("[YT] effect — YT loaded:", !!YT, "YT.Player:", !!(YT?.Player), "videoId:", activeYoutubeId, "mini:", miniPlayerMode);
    if (YT && YT.Player) {
      createPlayer(targetContainer);
    } else {
      let tag = document.getElementById("yt-api-script") as HTMLScriptElement | null;
      if (!tag) {
        tag = document.createElement("script");
        tag.id = "yt-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        tag.async = true;
        // If the IFrame API script itself fails to load (ad blocker, network),
        // surface an error instead of leaving the spinner forever.
        tag.onerror = () => {
          console.warn("[YT] IFrame API script failed to load");
          if (ytLoadTimeoutRef.current) { clearTimeout(ytLoadTimeoutRef.current); ytLoadTimeoutRef.current = null; }
          setYtPlayerLoading(false);
          setYtPlayerError({ message: "Couldn't load YouTube player. Disable ad blocker for this site or open the video on YouTube." });
        };
        document.head.appendChild(tag);
        console.log("[YT] Added YT API script tag");
      }
      (window as any).onYouTubeIframeAPIReady = () => {
        if (effectCancelled) return;
        console.log("[YT] onYouTubeIframeAPIReady fired");
        createPlayer(targetContainer);
      };
    }

    return () => {
      effectCancelled = true;
      if (youtubePlayerRef.current) {
        try { youtubePlayerRef.current.destroy(); } catch (_) {}
        youtubePlayerRef.current = null;
      }
      if (ytContainerRef.current) ytContainerRef.current.innerHTML = "";
      if (ytMiniContainerRef.current) ytMiniContainerRef.current.innerHTML = "";
      setYtIsPlaying(false);
      setYtCurrentTime(0);
      setYtDuration(0);
      setYoutubeActive(false);
    };
    // The player mount/unmount is now driven by:
    //   - activeYoutubeId    → which video the room is currently playing
    //   - showYoutube        → has the user opened the watch panel
    //   - miniPlayerMode     → is the floating mini-player visible
    //   - ytRetryNonce       → user pressed Retry after a load error
    // Closing the watch view destroys the iframe so audio stops for users who
    // are not actively watching, fixing audio leakage to non-watchers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYoutubeId, showYoutube, miniPlayerMode, ytRetryNonce]);

  // User-facing retry: switch host on second attempt to dodge ad-blockers, then rebuild.
  const handleRetryYoutube = () => {
    ytHostFallbackRef.current = !ytHostFallbackRef.current;
    setYtPlayerError(null);
    setYtRetryNonce((n) => n + 1);
  };

  // Poll current playback time every second — but ONLY for the broadcaster (the only one who
  // sees the seek bar). Watchers don't need state updates that re-render the whole room.
  useEffect(() => {
    if (!ytIsPlaying || (!showYoutube && !miniPlayerMode)) return;
    const id = setInterval(() => {
      try {
        const t = youtubePlayerRef.current?.getCurrentTime?.() || 0;
        const d = youtubePlayerRef.current?.getDuration?.() || 0;
        setYtCurrentTime(t);
        if (d > 0) setYtDuration(d);
      } catch (_) {}
    }, 1000);
    return () => clearInterval(id);
  }, [ytIsPlaying, showYoutube, miniPlayerMode, user?.id, youtubeStartedBy]);

  // Tracks the last (hostId, watching) pair we told the server about, so we
  // can always clean up properly — even when the user fully closes YouTube
  // (activeYoutubeId → null) and the effect would otherwise early-return
  // before emitting `watching: false`. Without this, hosts saw "fake
  // presence": stale watcher chips for users who already left the watch party.
  const lastYtWatchEmitRef = useRef<{ hostId: string; watching: boolean } | null>(null);

  useEffect(() => {
    if (!socket) return;
    const hostId = activeYoutubeId ? youtubeStartedByRef.current : null;
    const desired = hostId ? { hostId, watching: showYoutube } : null;
    const last = lastYtWatchEmitRef.current;

    // If the host we were last watching changed (or we left the watch party
    // entirely), tell the previous host we're no longer watching them.
    if (last && (!desired || last.hostId !== desired.hostId) && last.watching) {
      socket.emit("room:youtube-watching", { roomId: room.id, hostId: last.hostId, watching: false });
      const prevHost = last.hostId;
      setYoutubeWatchersByHost(prev => {
        const next = new Map(prev);
        const set = new Set(next.get(prevHost) || []);
        set.delete(user?.id || "");
        if (set.size > 0) next.set(prevHost, set);
        else next.delete(prevHost);
        return next;
      });
      lastYtWatchEmitRef.current = null;
    }

    if (!desired) return;

    // Only emit when the watching flag actually flips for this host — avoids
    // redundant socket chatter on unrelated state churn.
    if (last && last.hostId === desired.hostId && last.watching === desired.watching) {
      return;
    }

    socket.emit("room:youtube-watching", { roomId: room.id, hostId: desired.hostId, watching: desired.watching });
    lastYtWatchEmitRef.current = desired;

    if (desired.watching) {
      setYoutubeWatchersByHost(prev => {
        const next = new Map(prev);
        const set = new Set(next.get(desired.hostId) || []);
        set.add(user?.id || "");
        next.set(desired.hostId, set);
        return next;
      });
      // Pre-fetch the host's current playhead the moment a watcher opens the
      // panel — BEFORE the iframe even mounts. The response populates
      // ytSyncTimeRef so that when the player's onReady fires moments later,
      // it can seek directly to the correct position. This eliminates the
      // "starts at 0, then jumps" flash that happened when we waited until
      // onReady to ask for the time.
      if (user?.id && user.id !== desired.hostId) {
        ytSyncTimeRef.current = 0;
        socket.emit("room:youtube-time-request", { roomId: room.id, hostId: desired.hostId, requesterId: user.id });
      }
    } else {
      setYoutubeWatchersByHost(prev => {
        const next = new Map(prev);
        const set = new Set(next.get(desired.hostId) || []);
        set.delete(user?.id || "");
        if (set.size > 0) next.set(desired.hostId, set);
        else next.delete(desired.hostId);
        return next;
      });
    }
  }, [showYoutube, activeYoutubeId, youtubeStartedBy, socket, room.id, user?.id]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;
        const newX = Math.max(0, Math.min(window.innerWidth - 220, dragStartRef.current.playerX + dx));
        const newY = Math.max(0, Math.min(window.innerHeight - 130, dragStartRef.current.playerY + dy));
        setMiniPlayerPos({ x: newX, y: newY });
      }
      if (isFullDraggingRef.current) {
        const dx = e.clientX - fullDragStartRef.current.mouseX;
        const dy = e.clientY - fullDragStartRef.current.mouseY;
        setFullPlayerDragOffset({ x: fullDragStartRef.current.offsetX + dx, y: fullDragStartRef.current.offsetY + dy });
      }
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      isFullDraggingRef.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleMiniPlayerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, playerX: miniPlayerPos.x, playerY: miniPlayerPos.y };
  };

  const handleFullPlayerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isFullDraggingRef.current = true;
    fullDragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, offsetX: fullPlayerDragOffset.x, offsetY: fullPlayerDragOffset.y };
  };

  const toggleMute = () => {
    // If the host has restricted talking and we're trying to UNMUTE, block.
    // Re-muting is always allowed (going silent never violates a restriction).
    if (isMuted && !canUseTalkControls) {
      toast({ title: "Mic locked", description: talkLockReason || "Talking is disabled in this room.", variant: "destructive" });
      return;
    }
    // Unmuting is a user gesture — resume AudioContext synchronously here so
    // the worklet effect chain activates before the first audio frame is sent.
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
    const newMuted = !isMuted;
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted;
      });
    }
    // Keep screen-share system audio in sync with the mute state so peers
    // never hear screen audio while the user's mic is muted.
    if (screenStream.current) {
      screenStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted;
      });
    }
    setIsMuted(newMuted);
    socket?.emit("room:mute", { roomId: room.id, userId: user?.id, isMuted: newMuted });
  };

  const retryMicPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: "Microphone unavailable", description: "This browser does not support microphone access.", variant: "destructive" });
      return;
    }
    setMicSwitching(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints() });
      } catch (err: any) {
        if (selectedAudioDeviceIdRef.current !== "default" && (err?.name === "OverconstrainedError" || err?.name === "NotFoundError")) {
          selectedAudioDeviceIdRef.current = "default";
          setSelectedAudioDeviceId("default");
          stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints("default") });
        } else {
          throw err;
        }
      }
      await applyLocalAudioStream(stream);
      setIsMuted(true);
      socket?.emit("room:mute", { roomId: room.id, userId: user?.id, isMuted: true });
      await updateMicPermissionStatus();
      await refreshAudioInputDevices();
      toast({ title: "Microphone enabled", description: "You can now unmute to speak." });
    } catch (err: any) {
      setMicError(true);
      setShowMicHelp(true);
      await updateMicPermissionStatus();
      const isDenied = err?.name === "NotAllowedError" || micPermissionStatus === "denied";
      toast({
        title: isDenied ? "Microphone is blocked" : "Could not open microphone",
        description: isDenied ? "Use the mic/camera icon in the address bar and set microphone to Allow, then click Allow Microphone again." : "Check that another app is not using the selected microphone.",
        variant: "destructive",
      });
    } finally {
      setMicSwitching(false);
    }
  };

  const handleMicrophoneSelect = async (deviceId: string) => {
    const previousDeviceId = selectedAudioDeviceIdRef.current;
    setSelectedAudioDeviceId(deviceId);
    selectedAudioDeviceIdRef.current = deviceId;
    if (!navigator.mediaDevices?.getUserMedia) return;
    setMicSwitching(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getAudioConstraints(deviceId),
      });
      await applyLocalAudioStream(stream, true);
      await updateMicPermissionStatus();
      await refreshAudioInputDevices();
      toast({ title: "Microphone switched", description: "Your selected microphone is now active." });
    } catch (err: any) {
      setSelectedAudioDeviceId(previousDeviceId);
      selectedAudioDeviceIdRef.current = previousDeviceId;
      setMicError(true);
      setShowMicHelp(true);
      toast({
        title: "Could not switch microphone",
        description: err?.name === "NotAllowedError" ? "Allow microphone access in your browser first." : "Try a different microphone or reset to Default.",
        variant: "destructive",
      });
    } finally {
      setMicSwitching(false);
    }
  };

  const toggleHand = () => {
    setHandRaised(!handRaised);
    socket?.emit("room:hand", { roomId: room.id, userId: user?.id, raised: !handRaised });
  };

  // Mood reactions — fired from the new emoji picker that replaced the old
  // "raise hand" button. Anyone in the room can pick a mood (sleepy, angry,
  // wave, clap, etc.) and every participant — including the sender — sees it
  // animate above the sender's avatar card. We close the picker immediately
  // for a snappy feel, and rely on the server echo to drive the animation
  // (so the sender's own card animates in lockstep with everyone else's).
  const sendMood = (emoji: string) => {
    if (!socket || !user?.id) return;
    socket.emit("room:mood", { roomId: room.id, userId: user.id, emoji });
    setMoodPickerOpen(false);
  };

  // Clear my own mood sticker — only the owner of a mood can call this from
  // the × button on their card. Server relays room:mood-clear to everyone.
  const clearMyMood = () => {
    if (!socket || !user?.id) return;
    socket.emit("room:mood-clear", { roomId: room.id, userId: user.id });
  };

  // AI tutor logic is now fully handled by the useAiTutor hook above.

  // "Say Bye" — broadcasts a farewell to the room (everyone hears the sound
  // + sees a toast), then leaves after a short pause. This is also wired to
  // the Leave button so pressing Leave always plays the bye sound first.
  const handleSayBye = () => {
    if (sayingBye) return;
    setSayingBye(true);
    import("@/lib/mood-sounds").then((m) => m.playSayByeSound()).catch(() => {});
    if (socket && user) {
      const userName = getUserDisplayName(user as any) || (user as any).username || "Someone";
      socket.emit("room:say-bye", { roomId: room.id, userId: user.id, userName });
    }
    setTimeout(() => {
      handleLeave();
    }, 1600);
  };

  const handleLeave = (reason?: "joined-another-room") => {
    // If AI Tutor is active, stop it cleanly (same as if the user clicked the AI off button).
    // This cancels TTS, stops mic listening, and emits room:ai-tutor-stop so the avatar
    // closes for everyone in the room — no orphaned AI session left behind.
    try { if (aiState.active) toggleAiTutor(); } catch (_) {}
    localStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current?.getTracks().forEach((t) => t.stop());
    videoStream.current?.getTracks().forEach((t) => t.stop());
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    audioElements.current.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
    audioElements.current.clear();
    socket?.emit("room:leave", { roomId: room.id, userId: user?.id });
    import("@/lib/sound-fx").then((m) => m.sfxLeaveRoom()).catch(() => {});
    onLeave(reason);
  };

  // Also stop AI Tutor automatically if the voice-room component unmounts for any reason
  // (e.g. user closes the browser tab or navigates away without clicking "Leave").
  // We use refs to ensure the cleanup sees the latest state, not the initial closure.
  const aiActiveRef = useRef(false);
  const toggleAiTutorRef = useRef(toggleAiTutor);
  useEffect(() => { aiActiveRef.current = aiState.active; }, [aiState.active]);
  useEffect(() => { toggleAiTutorRef.current = toggleAiTutor; }, [toggleAiTutor]);
  useEffect(() => {
    return () => {
      try { if (aiActiveRef.current) toggleAiTutorRef.current?.(); } catch (_) {}
    };
  }, []);

  // Treat closing the browser tab / window the same as clicking the Leave button.
  // We can't run async work here, but we can synchronously stop local media tracks,
  // close peer connections, and emit room:leave so the server removes us from the
  // room IMMEDIATELY (instead of waiting the 8s disconnect grace period). This
  // means other participants see us leave instantly when we close the tab.
  const handleLeaveRef = useRef(handleLeave);
  useEffect(() => { handleLeaveRef.current = handleLeave; });
  useEffect(() => {
    const onPageHide = () => {
      try {
        // Stop local tracks first so the mic/camera light turns off immediately.
        localStream.current?.getTracks().forEach((t) => t.stop());
        screenStream.current?.getTracks().forEach((t) => t.stop());
        videoStream.current?.getTracks().forEach((t) => t.stop());
        peerConnections.current.forEach((pc) => pc.close());
        peerConnections.current.clear();
      } catch (_) {}
      try {
        // Best-effort: tell the server we left. socket.emit on pagehide is
        // reliable in modern browsers because Socket.IO uses persistent
        // connections — the frame is flushed before the page actually unloads.
        socket?.emit("room:leave", { roomId: room.id, userId: user?.id });
      } catch (_) {}
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, [socket, room.id, user?.id]);

  const renderMicSettingsContent = () => (
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-400/20 flex items-center justify-center flex-shrink-0">
          <Mic className="w-4 h-4 text-orange-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Microphone Settings</p>
          <p className="text-[11px] text-white/45 leading-relaxed">
            Allow access and choose which mic you want to use.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-white/65">Source</Label>
        <Select value={selectedAudioDeviceId} onValueChange={handleMicrophoneSelect} disabled={micSwitching}>
          <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white" data-testid="select-microphone-source">
            <SelectValue placeholder="Default microphone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default microphone</SelectItem>
            {audioInputDevices.filter((device) => device.deviceId).map((device, index) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {micPermissionStatus === "denied" && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/80 leading-relaxed" data-testid="status-mic-blocked">
          Your browser is blocking the mic. Click the mic/camera icon in the address bar, choose Allow, then retry.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={retryMicPermission}
          disabled={micSwitching}
          data-testid="button-audio-allow"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          {micSwitching ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Mic className="w-3.5 h-3.5 mr-1.5" />}
          Allow
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshAudioInputDevices}
          disabled={micSwitching}
          data-testid="button-refresh-microphones"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>
    </div>
  );

  const renderControlDock = () => {
    const ghostStyle: React.CSSProperties = {
      background: "linear-gradient(145deg, hsl(228 14% 15%) 0%, hsl(228 14% 12%) 100%)",
      border: "1px solid rgba(255,255,255,0.05)",
      color: "rgba(255,255,255,0.55)",
      boxShadow: "-3px -3px 8px rgba(255,255,255,0.025), 4px 4px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
    };
    const activeStyle: React.CSSProperties = {
      background: "linear-gradient(145deg, hsl(var(--neu-orange-hi)) 0%, hsl(var(--neu-orange-lo)) 100%)",
      border: "1px solid hsl(var(--neu-orange) / 0.45)",
      color: "#fff",
      boxShadow: "0 0 20px hsl(var(--neu-orange) / 0.42), 0 0 38px hsl(var(--neu-orange) / 0.16), -3px -3px 8px rgba(255,255,255,0.05), 4px 4px 12px rgba(0,0,0,0.62), inset 0 1px 0 rgba(220,210,255,0.40)",
    };
    const micLiveStyle: React.CSSProperties = {
      background: "linear-gradient(145deg, rgba(34,197,94,0.18) 0%, rgba(22,163,74,0.10) 100%)",
      border: "1px solid rgba(34,197,94,0.30)",
      color: "rgba(74,222,128,0.96)",
      boxShadow: "0 0 18px rgba(34,197,94,0.22), 0 4px 16px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
    };
    const videoActiveStyle: React.CSSProperties = {
      background: "linear-gradient(145deg, rgba(59,130,246,0.28) 0%, rgba(37,99,235,0.18) 100%)",
      border: "1px solid rgba(96,165,250,0.50)",
      color: "rgba(147,197,253,0.97)",
      boxShadow: "0 0 22px rgba(59,130,246,0.35), 0 4px 16px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)",
    };
    const screenShareActiveStyle: React.CSSProperties = {
      background: "linear-gradient(145deg, hsla(var(--neu-orange) / 0.32) 0%, hsla(var(--neu-orange-lo) / 0.22) 100%)",
      border: "1px solid hsla(var(--neu-orange-hi) / 0.50)",
      color: "hsla(var(--neu-orange-hi) / 0.97)",
      boxShadow: "0 0 22px hsla(var(--neu-orange) / 0.38), 0 4px 16px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)",
    };
    const handRaisedStyle: React.CSSProperties = {
      background: "linear-gradient(145deg, rgba(251,191,36,0.22) 0%, rgba(217,119,6,0.13) 100%)",
      border: "1px solid rgba(251,191,36,0.40)",
      color: "rgba(251,191,36,0.97)",
      boxShadow: "0 0 22px rgba(251,191,36,0.30), 0 4px 16px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)",
    };
    const leaveStyle: React.CSSProperties = {
      background: "linear-gradient(145deg, rgba(239,68,68,0.90) 0%, rgba(185,28,28,0.88) 100%)",
      border: "1px solid rgba(248,113,113,0.40)",
      color: "#fff",
      boxShadow: "0 0 24px rgba(239,68,68,0.28), 0 4px 16px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.16)",
    };

    const btnBase = "relative w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-[14px] sm:rounded-[18px] flex items-center justify-center transition-all duration-200 ease-out hover:-translate-y-[3px] hover:scale-[1.04] active:translate-y-0 active:scale-[0.97]";
    const labelBase = "hidden sm:block text-[9px] font-semibold leading-none tracking-wider uppercase";

    return (
      <div
        className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 select-none"
        style={{
          background: "linear-gradient(145deg, hsl(228 14% 12%) 0%, hsl(228 14% 9%) 100%)",
          backdropFilter: "blur(40px) saturate(1.35)",
          WebkitBackdropFilter: "blur(40px) saturate(1.35)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: "32px",
          boxShadow: "-8px -8px 22px rgba(255,255,255,0.030), 12px 12px 32px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.45)",
          padding: "10px 12px",
        }}
        data-testid="toolbar-room-controls"
      >
        {/* Mute */}
        <div className="flex flex-col items-center gap-[5px] sm:gap-[7px]">
          <div className="relative group">
            <button
              onClick={toggleMute}
              disabled={micError || (isMuted && !canUseTalkControls)}
              data-testid="button-toggle-mute"
              title={(isMuted && !canUseTalkControls) ? talkLockReason : (isMuted ? "Unmute mic" : "Mute mic")}
              className={`${btnBase} disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100`}
              style={isMuted ? ghostStyle : micLiveStyle}
            >
              {(isMuted && !canUseTalkControls)
                ? (
                  <span className="relative flex items-center justify-center">
                    <MicOff className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
                    <Lock className="absolute -bottom-[2px] -right-[2px] w-[8px] h-[8px] text-rose-300" />
                  </span>
                )
                : isMuted
                ? <MicOff className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
                : (
                  <span className="relative flex items-center justify-center">
                    <Mic className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
                    <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-green-400 border border-black/30 shadow-sm" />
                  </span>
                )
              }
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  data-testid="button-mic-inline-settings"
                  title="Microphone settings"
                  className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center border shadow-lg transition-all duration-150 focus:opacity-100 focus:scale-100 ${micError ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"}`}
                  style={micError
                    ? { background: "rgba(245,158,11,0.95)", borderColor: "rgba(251,191,36,0.95)", color: "#111827" }
                    : { background: "rgba(15,23,42,0.94)", borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.85)" }
                  }
                >
                  <Settings className="w-3 h-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 p-0 border-0 shadow-2xl overflow-hidden"
                style={{ background: "hsl(228 14% 10%)" }}
                align="center"
                side="bottom"
                sideOffset={12}
                data-testid="popover-audio-settings"
              >
                {renderMicSettingsContent()}
              </PopoverContent>
            </Popover>
          </div>
          <span className={labelBase} style={isMuted ? { color: "rgba(255,255,255,0.32)" } : { color: "rgba(74,222,128,0.82)" }}>
            {isMuted ? "Unmute" : "Mute"}
          </span>
        </div>

        {/* Camera + flip camera (mobile-friendly: flip shown inline in toolbar when cam is on) */}
        <div className="flex flex-col items-center gap-[5px] sm:gap-[7px]">
          <div className="flex items-center gap-1">
            <button
              onClick={toggleVideo}
              disabled={!isVideoOn && !canOpenCameraByPerm}
              data-testid="button-toggle-video"
              title={(!isVideoOn && !canOpenCameraByPerm) ? cameraLockReason : (isVideoOn ? "Stop Camera" : "Camera")}
              className={`${btnBase} disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100`}
              style={isVideoOn ? videoActiveStyle : ghostStyle}
            >
              {(!isVideoOn && !canOpenCameraByPerm) ? (
                <span className="relative flex items-center justify-center">
                  <VideoOff className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
                  <Lock className="absolute -bottom-[2px] -right-[2px] w-[8px] h-[8px] text-rose-300" />
                </span>
              ) : isVideoOn ? <Video className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" /> : <VideoOff className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />}
            </button>
            {isVideoOn && (
              <button
                onClick={handleFlipCamera}
                disabled={isFlippingCamera}
                data-testid="button-flip-camera-toolbar"
                title={cameraFacing === "user" ? "Switch to back camera" : "Switch to front camera"}
                aria-label="Flip camera"
                className="w-6 h-6 rounded-full flex items-center justify-center border border-white/20 bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow"
              >
                <RotateCcw className={`w-3 h-3 text-white ${isFlippingCamera ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
          <span className={labelBase} style={isVideoOn ? { color: "rgba(147,197,253,0.85)" } : { color: "rgba(255,255,255,0.32)" }}>
            Camera
          </span>
        </div>


        {/* Share — hidden on mobile, screen share is not supported on mobile browsers */}
        {featScreenShare && <div className="hidden sm:flex flex-col items-center gap-[5px] sm:gap-[7px]">
          <button
            onClick={handleScreenShare}
            disabled={!isScreenSharing && !canShareScreenByPerm}
            data-testid="button-screen-share"
            title={(!isScreenSharing && !canShareScreenByPerm) ? screenLockReason : (isScreenSharing ? "Stop Share" : "Share Screen")}
            className={`${btnBase} disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100`}
            style={isScreenSharing ? screenShareActiveStyle : ghostStyle}
          >
            {(!isScreenSharing && !canShareScreenByPerm) ? (
              <span className="relative flex items-center justify-center">
                <Monitor className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
                <Lock className="absolute -bottom-[2px] -right-[2px] w-[8px] h-[8px] text-rose-300" />
              </span>
            ) : isCameraShareMode ? (
              <Video className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
            ) : (
              <Monitor className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
            )}
          </button>
          <span className={labelBase} style={isScreenSharing ? { color: "rgba(196,181,253,0.85)" } : { color: "rgba(255,255,255,0.32)" }}>
            {isScreenSharing && isCameraShareMode ? "Cam Share" : "Share"}
          </span>
        </div>}

        {/* Voice preset picker */}
        {featVoiceEffects && <div className="flex flex-col items-center gap-[5px] sm:gap-[7px] relative">
          <div className="relative">
            {voicePickerOpen && (
              <span
                className="absolute inset-0 rounded-[14px] sm:rounded-[18px] animate-ping"
                style={{ background: "rgba(99,102,241,0.28)", animationDuration: "1.4s" }}
              />
            )}
            <button
              onClick={() => {
                // Opening the picker is a user gesture — resume AudioContext now
                // so worklets are ready by the time the user picks a preset.
                if (audioContextRef.current?.state === "suspended") {
                  audioContextRef.current.resume().catch(() => {});
                }
                setVoicePickerOpen((v) => !v);
              }}
              data-testid="button-toggle-voice"
              title={voicePickerOpen ? "Close voice effects" : "Voice effects"}
              className={btnBase}
              style={voicePickerOpen ? { background: "rgba(99,102,241,0.22)", borderColor: "rgba(99,102,241,0.55)", color: "rgba(165,180,252,0.95)" } : (selectedVoicePresetId !== "natural" ? { background: "rgba(99,102,241,0.18)", borderColor: "rgba(99,102,241,0.45)", color: "rgba(165,180,252,0.9)" } : ghostStyle)}
            >
              <AudioLines className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
            </button>
            {voicePickerOpen && createPortal(
              <>
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={() => { setVoicePickerOpen(false); voiceTestCleanupRef.current?.(); }}
                  data-testid="voice-picker-backdrop"
                />
                <div
                  data-testid="voice-picker"
                  className="fixed left-1/2 -translate-x-1/2 z-[9999] rounded-2xl shadow-2xl border border-white/[0.12] overflow-hidden"
                  style={{
                    bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
                    background: "linear-gradient(180deg, rgba(18,14,36,0.98), rgba(8,6,22,0.98))",
                    backdropFilter: "blur(18px)",
                    width: "min(360px, 94vw)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-white/[0.07]">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Voice Settings</p>
                    {/* Test your voice button — records 2s & plays back through active preset */}
                    {hasMicStream ? (
                      <button
                        data-testid="button-voice-test"
                        onClick={handleVoiceTest}
                        disabled={voiceTestState === "recording" || voiceTestState === "playing"}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all duration-150 disabled:opacity-50"
                        style={
                          voiceTestState === "recording"
                            ? { background: "rgba(239,68,68,0.18)", borderColor: "rgba(239,68,68,0.45)", color: "rgba(252,165,165,0.95)" }
                            : voiceTestState === "playing"
                            ? { background: "rgba(99,102,241,0.18)", borderColor: "rgba(99,102,241,0.45)", color: "rgba(165,180,252,0.95)" }
                            : voiceTestState === "done"
                            ? { background: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.4)", color: "rgba(134,239,172,0.95)" }
                            : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }
                        }
                        title="Record 2s of your voice and play it back through the active effect"
                      >
                        {voiceTestState === "recording" ? (
                          <><span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />Recording…</>
                        ) : voiceTestState === "playing" ? (
                          <><Volume2 className="w-3 h-3" />Playing…</>
                        ) : voiceTestState === "done" ? (
                          <><span className="text-[10px]">✓</span>Done</>
                        ) : voiceTestState === "error" ? (
                          <>⚠ Retry</>
                        ) : (
                          <><Mic className="w-3 h-3" />Test voice</>
                        )}
                      </button>
                    ) : (
                      <span className="text-[10px] text-white/25 italic">Join mic to test</span>
                    )}
                  </div>

                  {/* ── Enhancement controls ─────────────────────────────── */}
                  <div className="px-3 pt-2.5 pb-2 border-b border-white/[0.07] space-y-2">
                    {/* Live mic level meter — only shown while mic is active */}
                    {hasMicStream && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white/25">Signal</span>
                          <span className="text-[9px] text-white/20 tabular-nums">
                            {micLevel.peak > 0.88 ? "🔴 Hot" : micLevel.peak > 0.52 ? "🟡 Good" : micLevel.peak > 0.05 ? "🟢 OK" : "⚫ Quiet"}
                          </span>
                        </div>
                        {/* RMS bar */}
                        <div
                          className="h-[5px] rounded-full overflow-hidden relative"
                          style={{ background: "rgba(255,255,255,0.05)" }}
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: `${Math.min(100, micLevel.rms * 420)}%`,
                              background: micLevel.peak > 0.88
                                ? "linear-gradient(90deg,#22c55e 50%,#ef4444)"
                                : micLevel.peak > 0.52
                                ? "linear-gradient(90deg,#22c55e 60%,#eab308)"
                                : "linear-gradient(90deg,#22c55e,#6366f1)",
                              transition: "width 70ms linear",
                            }}
                          />
                          {/* Peak hold indicator */}
                          <div
                            className="absolute inset-y-0 w-0.5 rounded-full"
                            style={{
                              left: `${Math.min(99, micLevel.peak * 420)}%`,
                              background: micLevel.peak > 0.88 ? "#ef4444" : micLevel.peak > 0.52 ? "#eab308" : "#6366f1",
                              opacity: micLevel.peak > 0.04 ? 0.9 : 0,
                              transition: "left 120ms ease-out, opacity 200ms",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Enhancement toggle row */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {/* Voice Enhancement */}
                      <button
                        data-testid="button-toggle-enhancement"
                        onClick={handleToggleEnhancement}
                        title={enhancementEnabled ? "Voice Enhancement ON — EQ, compressor, limiter active" : "Voice Enhancement OFF"}
                        className="flex items-center gap-1.5 px-2 py-[7px] rounded-xl border text-[10.5px] font-semibold transition-all duration-150 select-none"
                        style={enhancementEnabled
                          ? { background: "rgba(34,197,94,0.11)", borderColor: "rgba(34,197,94,0.38)", color: "rgba(134,239,172,0.95)" }
                          : { background: "rgba(255,255,255,0.035)", borderColor: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.32)" }
                        }
                      >
                        <span className="text-[14px] leading-none">🎚</span>
                        <span className="flex-1 text-left leading-tight">Enhance</span>
                        <span
                          className="text-[8.5px] font-bold px-1 py-0.5 rounded-md"
                          style={enhancementEnabled
                            ? { background: "rgba(34,197,94,0.2)", color: "rgba(134,239,172,0.9)" }
                            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }
                          }
                        >{enhancementEnabled ? "ON" : "OFF"}</span>
                      </button>

                      {/* Noise Cancellation */}
                      <button
                        data-testid="button-toggle-noise"
                        onClick={handleToggleNoiseCancellation}
                        title={noiseCancellationEnabled ? "Noise Gate ON — keyboard/fan noise gated" : "Noise Gate OFF"}
                        className="flex items-center gap-1.5 px-2 py-[7px] rounded-xl border text-[10.5px] font-semibold transition-all duration-150 select-none"
                        style={noiseCancellationEnabled
                          ? { background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.38)", color: "rgba(165,180,252,0.95)" }
                          : { background: "rgba(255,255,255,0.035)", borderColor: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.32)" }
                        }
                      >
                        <span className="text-[14px] leading-none">🤫</span>
                        <span className="flex-1 text-left leading-tight">De-noise</span>
                        <span
                          className="text-[8.5px] font-bold px-1 py-0.5 rounded-md"
                          style={noiseCancellationEnabled
                            ? { background: "rgba(99,102,241,0.2)", color: "rgba(165,180,252,0.9)" }
                            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }
                          }
                        >{noiseCancellationEnabled ? "ON" : "OFF"}</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Characters grid ──────────────────────────────────── */}
                  <div className="p-2.5 space-y-2.5">
                    {/* Natural */}
                    <div>
                      <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/25 mb-1.5 px-0.5">Original</p>
                      <div className="grid grid-cols-4 gap-1">
                        {VOICE_PRESETS.filter(p => p.category === "natural").map((preset) => {
                          const isActive = selectedVoicePresetId === preset.id;
                          return (
                            <button
                              key={preset.id}
                              data-testid={`voice-preset-${preset.id}`}
                              onClick={() => handleVoicePresetChange(preset.id)}
                              className="w-full flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-xl border transition-all duration-150 text-center"
                              style={isActive
                                ? { background: "rgba(99,102,241,0.28)", borderColor: "rgba(99,102,241,0.65)", color: "rgba(199,210,254,1)", boxShadow: "0 0 0 1px rgba(99,102,241,0.35) inset" }
                                : { background: "rgba(255,255,255,0.035)", borderColor: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.7)" }
                              }
                            >
                              <span className="text-lg leading-none">{preset.emoji}</span>
                              <span className="text-[10.5px] font-semibold leading-tight">{preset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Characters */}
                    <div>
                      <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/25 mb-1.5 px-0.5">Characters</p>
                      <div className="grid grid-cols-4 gap-1">
                        {VOICE_PRESETS.filter(p => p.category === "character").map((preset) => {
                          const isActive = selectedVoicePresetId === preset.id;
                          const isPreviewing = previewingPresetId === preset.id;
                          return (
                            <button
                              key={preset.id}
                              data-testid={`voice-preset-${preset.id}`}
                              onClick={() => handleVoicePresetChange(preset.id)}
                              className="w-full flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-xl border transition-all duration-150 text-center relative"
                              style={isActive
                                ? { background: "rgba(99,102,241,0.28)", borderColor: "rgba(99,102,241,0.65)", color: "rgba(199,210,254,1)", boxShadow: "0 0 0 1px rgba(99,102,241,0.35) inset" }
                                : { background: "rgba(255,255,255,0.035)", borderColor: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.7)" }
                              }
                            >
                              {isPreviewing && (
                                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-300 animate-ping" />
                              )}
                              <span className="text-lg leading-none">{preset.emoji}</span>
                              <span className="text-[10.5px] font-semibold leading-tight">{preset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Footer hint */}
                  <div className="px-3.5 pb-2.5 pt-0.5">
                    <p className="text-[9px] text-white/20 text-center">
                      Click a character to apply · preview plays on select
                    </p>
                  </div>
                </div>
              </>,
              document.body
            )}
          </div>
          <span
            className={labelBase}
            style={selectedVoicePresetId !== "natural"
              ? { color: "rgba(165,180,252,0.85)" }
              : { color: "rgba(255,255,255,0.32)" }
            }
          >
            {selectedVoicePresetId !== "natural"
              ? (VOICE_PRESETS.find(p => p.id === selectedVoicePresetId)?.label ?? "Voice")
              : "Voice"}
          </span>
        </div>}

        {/* Mood — replaces the old "raise hand" button.
            Tap to open a mini emoji bar with quick mood reactions (sleepy,
            angry, wave, clap, applause, etc). Picking one broadcasts to the
            whole room; the chosen emoji animates floating above the sender's
            avatar card so everyone sees who's reacting and what they feel. */}
        <div className="flex flex-col items-center gap-[5px] sm:gap-[7px] relative">
          <div className="relative">
            {moodPickerOpen && (
              <span
                className="absolute inset-0 rounded-[14px] sm:rounded-[18px] animate-ping"
                style={{ background: "rgba(251,191,36,0.28)", animationDuration: "1.4s" }}
              />
            )}
            <button
              onClick={() => setMoodPickerOpen((v) => !v)}
              data-testid="button-toggle-mood"
              title={moodPickerOpen ? "Close moods" : "Send a mood"}
              className={btnBase}
              style={moodPickerOpen ? handRaisedStyle : ghostStyle}
            >
              <Smile
                className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]"
                style={moodPickerOpen ? { filter: "drop-shadow(0 0 4px rgba(251,191,36,0.6))" } : undefined}
              />
            </button>
            {moodPickerOpen && createPortal(
              <>
                {/* backdrop catches outside taps to close the picker */}
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={() => setMoodPickerOpen(false)}
                  data-testid="mood-picker-backdrop"
                />
                <div
                  data-testid="mood-picker"
                  className="fixed left-1/2 -translate-x-1/2 z-[9999] grid grid-cols-6 gap-1.5 p-3 rounded-2xl shadow-2xl border border-white/15"
                  style={{
                    top: "calc(env(safe-area-inset-top, 0px) + 56px)",
                    background: "linear-gradient(180deg, rgba(20,16,40,0.97), rgba(8,6,24,0.97))",
                    backdropFilter: "blur(14px)",
                    width: "min(360px, 92vw)",
                    maxHeight: "70vh",
                    overflowY: "auto",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    { e: "✋", label: "Raise hand" },
                    { e: "👋", label: "Wave hi" },
                    { e: "👍", label: "Yes" },
                    { e: "👎", label: "No" },
                    { e: "👏", label: "Clap" },
                    { e: "🙏", label: "Thanks" },
                    { e: "❤️", label: "Love it" },
                    { e: "🔥", label: "Fire" },
                    { e: "💯", label: "100" },
                    { e: "🎉", label: "Party" },
                    { e: "🥳", label: "Celebrate" },
                    { e: "🤯", label: "Mind blown" },
                    { e: "😂", label: "Laughing" },
                    { e: "🤣", label: "ROFL" },
                    { e: "😆", label: "Giggle" },
                    { e: "😮", label: "Wow" },
                    { e: "😱", label: "Shocked" },
                    { e: "🤔", label: "Thinking" },
                    { e: "🙄", label: "Eye roll" },
                    { e: "😴", label: "Sleepy" },
                    { e: "🥱", label: "Yawn" },
                    { e: "😡", label: "Angry" },
                    { e: "🤬", label: "Furious" },
                    { e: "🤡", label: "Clown" },
                    { e: "💩", label: "Poop" },
                    { e: "👻", label: "Boo!" },
                    { e: "🤖", label: "Robot" },
                    { e: "🐸", label: "Frog" },
                    { e: "🦄", label: "Unicorn" },
                    { e: "🚀", label: "Let's go!" },
                  ].map(({ e, label }) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => sendMood(e)}
                      title={label}
                      aria-label={label}
                      data-testid={`mood-emoji-${e}`}
                      className="w-11 h-11 flex items-center justify-center rounded-xl text-2xl hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
                      style={{ color: "white", WebkitTextFillColor: "initial" }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </>,
              document.body
            )}
          </div>
          <span className={labelBase} style={moodPickerOpen ? { color: "rgba(251,191,36,0.86)" } : { color: "rgba(255,255,255,0.32)" }}>
            Mood
          </span>
        </div>

        {/* AI Tutor */}
        {featAiTutor && <div className="flex flex-col items-center gap-[5px] sm:gap-[7px]">
          <div className="relative">
            {!aiTutorActive && (
              <span
                className="absolute inset-0 rounded-[14px] sm:rounded-[18px] animate-ping"
                style={{ background: "hsl(var(--neu-orange) / 0.18)", animationDuration: "2.2s" }}
              />
            )}
            {aiTutorActive && (
              <span
                className="absolute inset-0 rounded-[14px] sm:rounded-[18px] animate-ping"
                style={{ background: "hsl(var(--neu-orange) / 0.26)", animationDuration: "1.4s" }}
              />
            )}
            <button
              onClick={aiTutorActive ? toggleAiTutor : () => setAiPersonaPickerOpen(true)}
              data-testid="button-toggle-ai-tutor"
              title={aiTutorActive ? `Dismiss ${aiPersonaName}` : "Call AI Tutor"}
              className={btnBase}
              style={aiTutorActive ? {
                background: "linear-gradient(145deg, hsl(var(--neu-orange-hi)) 0%, hsl(var(--neu-orange-lo)) 100%)",
                border: "1px solid hsl(var(--neu-orange) / 0.55)",
                color: "#fff",
                boxShadow: "0 0 24px hsl(var(--neu-orange) / 0.45), 0 0 48px hsl(var(--neu-orange) / 0.18), -3px -3px 8px rgba(255,255,255,0.05), 4px 4px 12px rgba(0,0,0,0.62), inset 0 1px 0 rgba(220,210,255,0.40)",
              } : {
                background: "linear-gradient(145deg, hsl(228 14% 15%) 0%, hsl(228 14% 12%) 100%)",
                border: "1px solid hsl(var(--neu-orange) / 0.25)",
                color: "hsl(var(--neu-orange-hi))",
                boxShadow: "-3px -3px 8px rgba(255,255,255,0.025), 4px 4px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <span className="absolute -top-1 -left-1 text-[8px] uppercase tracking-[0.18em] font-bold px-1.5 py-0.25 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200 pointer-events-none leading-none">
                Demo
              </span>
              <BrainCircuit className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" style={aiTutorActive ? { filter: "drop-shadow(0 0 6px hsl(var(--neu-orange-hi) / 0.85))" } : undefined} />
            </button>
          </div>
          <span className={labelBase} style={{ color: aiTutorActive ? "hsl(var(--neu-orange-hi) / 0.95)" : "hsl(var(--neu-orange-hi) / 0.72)" }}>
            {aiTutorActive ? aiPersonaName : "AI Tutor"}
          </span>
        </div>}

        <div className="mx-0.5 h-7 sm:h-10 w-px self-center" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.11) 50%, transparent 100%)" }} />

        {/* Leave (with embedded Say Bye) */}
        <div className="flex flex-col items-center gap-[5px] sm:gap-[7px]">
          <button
            onClick={handleSayBye}
            disabled={sayingBye}
            data-testid="button-leave-room"
            title={sayingBye ? "Saying bye…" : "Say bye and leave"}
            className={btnBase}
            style={sayingBye ? { ...leaveStyle, opacity: 0.65, cursor: "not-allowed" } : leaveStyle}
          >
            {sayingBye
              ? <span className="text-[15px] sm:text-[18px] leading-none" style={{ filter: "drop-shadow(0 0 5px rgba(251,191,36,0.7))" }}>👋</span>
              : <PhoneOff className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
            }
          </button>
          <span className={labelBase} style={{ color: sayingBye ? "rgba(251,191,36,0.86)" : "rgba(252,165,165,0.72)" }}>
            {sayingBye ? "Bye…" : "Leave"}
          </span>
        </div>
      </div>
    );
  };

  const unlockAudio = useCallback(() => {
    if (audioUnlocked) return;
    const ctx = new AudioContext();
    ctx.resume().then(() => {
      audioElements.current.forEach((audio) => {
        audio.play().catch(() => {});
      });
      setAudioUnlocked(true);
    }).catch(() => {});
  }, [audioUnlocked]);

  useEffect(() => {
    const handler = () => unlockAudio();
    document.addEventListener("click", handler, { once: true });
    document.addEventListener("keydown", handler, { once: true });
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [unlockAudio]);

  const handleKick = (targetUserId: string) => {
    socket?.emit("room:kick", { roomId: room.id, targetUserId, kickedBy: user?.id });
  };

  const handleForceMute = (targetUserId: string) => {
    socket?.emit("room:force-mute", { roomId: room.id, targetUserId, mutedBy: user?.id });
  };

  const handleForceMuteVideo = (targetUserId: string) => {
    socket?.emit("room:force-mute-video", { roomId: room.id, targetUserId, mutedBy: user?.id });
  };

  const handleAssignRole = (targetUserId: string, role: string) => {
    socket?.emit("room:assign-role", { roomId: room.id, targetUserId, role, assignedBy: user?.id });
  };

  const handleBlock = (targetUserId: string) => {
    const target = participants.find(p => p.id === targetUserId);
    setBlockDialogName(target?.username || target?.displayName || "this user");
    setBlockDialogStep("choose");
    setBlockDialogUserId(targetUserId);
  };

  const executeBlock = async (targetUserId: string, blockType: "ordinary" | "forever") => {
    try {
      await apiRequest("POST", "/api/blocks", { blockerId: user?.id, blockedId: targetUserId, blockType });
      setBlockDialogUserId(null);
      toast({ title: blockType === "forever" ? "User permanently hidden." : "User blocked." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to block user" });
    }
  };

  const handleUnblock = async (targetUserId: string) => {
    try {
      await apiRequest("DELETE", `/api/blocks/${targetUserId}`);
      toast({ title: "User unblocked." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to unblock user" });
    }
  };

  const handleReport = (targetUserId: string) => {
    setReportTargetUserId(targetUserId);
  };

  const handleClearChat = (global: boolean) => {
    const myRole = participantRoles[user?.id || ""] || "";
    if (global && (isHost || myRole === "co-owner")) {
      socket?.emit("room:clear-chat-global", { roomId: room.id, clearedBy: user?.id });
    } else {
      setChatMessages([]);
    }
  };

  const handleClearUserChat = (targetUserId: string) => {
    socket?.emit("room:clear-user-chat", { roomId: room.id, clearedBy: user?.id, targetUserId });
  };

  // Dismiss context menu on outside click or scroll
  useEffect(() => {
    if (!chatContextMenu) return;
    const dismiss = () => setChatContextMenu(null);
    window.addEventListener("click", dismiss, { capture: true });
    window.addEventListener("keydown", dismiss, { capture: true });
    window.addEventListener("scroll", dismiss, { capture: true, passive: true });
    return () => {
      window.removeEventListener("click", dismiss, { capture: true });
      window.removeEventListener("keydown", dismiss, { capture: true });
      window.removeEventListener("scroll", dismiss, { capture: true });
    };
  }, [chatContextMenu]);

  useEffect(() => {
    if (!socket) return;
    const globalClearHandler = () => {
      setChatMessages([]);
      toast({ title: "Chat cleared by moderator." });
    };
    const userClearHandler = ({ targetUserId }: { targetUserId: string }) => {
      setChatMessages(prev => prev.filter(m => m.userId !== targetUserId));
      toast({ title: "Messages removed", description: "A participant's messages were removed by a moderator." });
    };
    socket.on("room:chat-cleared-global", globalClearHandler);
    socket.on("room:user-chat-cleared", userClearHandler);
    return () => {
      socket.off("room:chat-cleared-global", globalClearHandler);
      socket.off("room:user-chat-cleared", userClearHandler);
    };
  }, [socket, toast]);

  const handleVolumeChange = (targetUserId: string, value: number) => {
    setParticipantVolumes(prev => ({ ...prev, [targetUserId]: value }));
    const audioEl = audioElements.current.get(targetUserId);
    if (audioEl) {
      audioEl.volume = value;
    }
  };

  const handleReconnect = (targetUserId: string) => {
    toast({ title: "Reconnecting peer..." });
    const pc = peerConnections.current.get(targetUserId);
    if (pc && typeof pc.restartIce === "function") {
      pc.restartIce();
    }
  };

  const myRole = participantRoles[user?.id || ""] || "";
  const isTroll = myRole === "troll";
  const TROLL_MAX_CHARS = 50;
  const CHAT_MAX_CHARS = 500;
  const canAssignRoles = isHost || myRole === "co-owner";

  // ----- Talk-permission gating -----
  // The host can restrict who can use mic / camera / screen-share. Modes:
  //   everyone    — anyone may speak (default)
  //   co_owners   — owner + co-owners only
  //   owner_only  — owner only
  //   muted       — silent room (text only); host stays unrestricted so they
  //                 can broadcast announcements without unlocking the room.
  const talkPermission = ((room as any).talkPermission as
    | "everyone" | "members" | "co_owners" | "owner_only" | "muted" | undefined) || "everyone";
  const isGuestOrTroll = myRole === "guest" || myRole === "troll";
  const canUseTalkControls = (() => {
    if (isHost) return true;
    if (talkPermission === "everyone") return true;
    if (talkPermission === "members") return !isGuestOrTroll;
    if (talkPermission === "co_owners") return myRole === "co-owner";
    return false;
  })();
  const talkLockReason = (() => {
    if (canUseTalkControls) return "";
    if (talkPermission === "muted") return "Silent room — only text chat is allowed.";
    if (talkPermission === "owner_only") return "Only the host can use mic, camera or screen-share.";
    if (talkPermission === "co_owners") return "Only the host and co-hosts can use mic, camera or screen-share.";
    if (talkPermission === "members") return "Guests and trolls cannot use mic, camera or screen-share in this room.";
    return "Talk is disabled for your role.";
  })();
  const talkBadge = (() => {
    if (talkPermission === "everyone") return null;
    if (talkPermission === "muted") return { label: "Silent Room", tone: "tone-mute" as const, icon: VolumeX };
    if (talkPermission === "owner_only") return { label: "Host Only", tone: "tone-warn" as const, icon: Crown };
    if (talkPermission === "co_owners") return { label: "Hosts & Co-hosts", tone: "" as const, icon: Shield };
    if (talkPermission === "members") return { label: "Members Only", tone: "" as const, icon: Shield };
    return null;
  })();
  // Per-feature host permissions. The host configures who can share screen and
  // who can play YouTube from Edit Room Settings. Each save is announced in
  // the chat as a system message (server-side).
  const cameraPermission = ((room as any).cameraPermission as
    | "everyone" | "members" | "co_owners" | "owner_only" | undefined) || "everyone";
  const screenPermission = ((room as any).screenPermission as
    | "everyone" | "members" | "co_owners" | "owner_only" | undefined) || "everyone";
  const youtubePermission = ((room as any).youtubePermission as
    | "everyone" | "members" | "co_owners" | "owner_only" | undefined) || "everyone";
  const checkPerm = (perm: "everyone" | "members" | "co_owners" | "owner_only") => {
    if (isHost) return true;
    if (perm === "everyone") return true;
    if (perm === "members") return !isGuestOrTroll;
    if (perm === "co_owners") return myRole === "co-owner";
    return false;
  };
  // Camera and screen-share are decoupled from mic/talk permission so a
  // "silent room" or "owner-only mic" room can still allow guests to use
  // their camera and share their screen, gated by their own perm fields.
  const canOpenCameraByPerm = checkPerm(cameraPermission);
  const cameraLockReason = (() => {
    if (canOpenCameraByPerm) return "";
    if (cameraPermission === "owner_only") return "Only the host can open the camera.";
    if (cameraPermission === "co_owners") return "Only the host and co-hosts can open the camera.";
    if (cameraPermission === "members") return "Guests and trolls cannot open the camera in this room.";
    return "Camera is locked.";
  })();
  const canShareScreenByPerm = checkPerm(screenPermission);
  const screenLockReason = (() => {
    if (canShareScreenByPerm) return "";
    if (screenPermission === "owner_only") return "Only the host can share screen.";
    if (screenPermission === "co_owners") return "Only the host and co-hosts can share screen.";
    if (screenPermission === "members") return "Guests and trolls cannot share screen in this room.";
    return "Screen-share is locked.";
  })();
  const canPlayYoutube = checkPerm(youtubePermission);
  const youtubeLockReason = (() => {
    if (canPlayYoutube) return "";
    if (youtubePermission === "owner_only") return "Only the host can play YouTube videos.";
    if (youtubePermission === "co_owners") return "Only the host and co-hosts can play YouTube videos.";
    if (youtubePermission === "members") return "Guests and trolls cannot play YouTube in this room.";
    return "YouTube is locked.";
  })();

  const removeScreenTracksFromPeers = async () => {
    peerConnections.current.forEach((pc, peerId) => {
      const senders = screenSenders.current.get(peerId);
      if (senders) {
        senders.forEach((sender) => {
          try { pc.removeTrack(sender); } catch (e) {}
        });
        screenSenders.current.delete(peerId);
      }
    });
    const entries = Array.from(peerConnections.current.entries());
    for (const [peerId, pc] of entries) {
      try {
        if (pc.signalingState !== "stable") continue;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit("webrtc:offer", { offer, to: peerId, roomId: room.id });
      } catch (e) {}
    }
  };

  const stopMyScreenShare = async () => {
    await removeScreenTracksFromPeers();
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    setIsScreenSharing(false);
    setIsCameraShareMode(false);
    socket?.emit("room:screen-share", { roomId: room.id, userId: user?.id, active: false });
  };

  // ── Keep localVideoStreamRef in sync with state (used in canvas draw loop) ──
  useEffect(() => { localVideoStreamRef.current = localVideoStreamObj; }, [localVideoStreamObj]);

  // ── Go Live: tutorial "video" timer ─────────────────────────────────────
  useEffect(() => {
    const ytVisible = (sidePanelTab === "golive" || goLiveOpen) &&
      (goLivePlatform === "youtube" || goLivePlatform === "both");
    if (!ytVisible || !glVidPlaying) return;
    const t = setInterval(() => setGlVidTime(s => (s >= 35 ? 0 : s + 1)), 1000);
    return () => clearInterval(t);
  }, [sidePanelTab, goLiveOpen, goLivePlatform, glVidPlaying]);

  // ── Go Live: canvas preview snapshots (every 1.5 s while connecting/live) ──
  useEffect(() => {
    if (glStatus === "connecting" || glStatus === "live") {
      // Capture immediately then on interval
      const capture = () => {
        const canvas = glCanvasRef.current;
        if (!canvas) return;
        try { setGlPreviewDataUrl(canvas.toDataURL("image/jpeg", 0.55)); } catch { /* tainted canvas */ }
      };
      capture();
      glPreviewIntervalRef.current = setInterval(capture, 1500);
    } else {
      if (glPreviewIntervalRef.current) {
        clearInterval(glPreviewIntervalRef.current);
        glPreviewIntervalRef.current = null;
      }
      // Keep last frame visible for a moment after stream ends then clear
      if (glStatus === "idle") setGlPreviewDataUrl(null);
    }
    return () => {
      if (glPreviewIntervalRef.current) {
        clearInterval(glPreviewIntervalRef.current);
        glPreviewIntervalRef.current = null;
      }
    };
  }, [glStatus]);

  // ── Go Live: direct browser-to-RTMP streaming ──────────────────────────
  const formatGlDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const startGoLive = useCallback(async () => {
    const twitchKey = goLivePlatform === "youtube" ? "" : glTwitchKey.trim();
    const youtubeKey = goLivePlatform === "twitch" ? "" : glYoutubeKey.trim();
    if (goLivePlatform === "youtube" && !youtubeKey) { toast({ title: "Paste your YouTube stream key first", variant: "destructive" }); return; }
    if (goLivePlatform === "twitch" && !twitchKey) { toast({ title: "Paste your Twitch stream key first", variant: "destructive" }); return; }
    if (goLivePlatform === "both" && !twitchKey && !youtubeKey) { toast({ title: "Enter at least one stream key", variant: "destructive" }); return; }

    setGlStatus("connecting");
    setGlError(null);

    // ── Audio: mic (optional) + all room peer streams mixed together ──────────
    let micStream: MediaStream | null = null;
    try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); } catch { /* mic optional */ }

    const audioCtx = new AudioContext({ sampleRate: 44100 });
    glAudioCtxRef.current = audioCtx;
    const audioDest = audioCtx.createMediaStreamDestination();
    if (micStream) audioCtx.createMediaStreamSource(micStream).connect(audioDest);
    // Tap every remote peer's audio stream — no screen-share dialog needed
    audioElements.current.forEach((el) => {
      const s = el.srcObject as MediaStream | null;
      if (s?.getAudioTracks().length) try { audioCtx.createMediaStreamSource(s).connect(audioDest); } catch {}
    });

    // ── Video: tab capture (exact room) or canvas fallback ────────────────────
    let tabCaptureStream: MediaStream | null = null;
    if (glCaptureMode === "tab") {
      try {
        tabCaptureStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 30 },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            displaySurface: "browser",
          },
          audio: false,
          preferCurrentTab: true,
          selfBrowserSurface: "include",
          surfaceSwitching: "exclude",
          systemAudio: "exclude",
        });
        glTabStreamRef.current = tabCaptureStream;
        // Build a pass-through canvas for preview snapshots from the tab video
        const previewCanvas = document.createElement("canvas");
        previewCanvas.width = 1280; previewCanvas.height = 720;
        glCanvasRef.current = previewCanvas;
        const pCtx = previewCanvas.getContext("2d")!;
        const tabVid = document.createElement("video");
        tabVid.srcObject = tabCaptureStream; tabVid.muted = true; tabVid.autoplay = true; tabVid.playsInline = true;
        tabVid.play().catch(() => {});
        const renderPreview = () => {
          if (tabVid.readyState >= 2) pCtx.drawImage(tabVid, 0, 0, 1280, 720);
          glRafRef.current = requestAnimationFrame(renderPreview);
        };
        renderPreview();
        // If user stops screen share from browser UI, treat it as end-stream
        tabCaptureStream.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (glMediaRecorderRef.current?.state !== "inactive") stopGoLive();
        });
      } catch (err: any) {
        // User denied or browser doesn't support → fall through to canvas
        tabCaptureStream = null;
        glTabStreamRef.current = null;
        if (err?.name === "NotAllowedError") {
          audioCtx.close().catch(() => {}); glAudioCtxRef.current = null;
          micStream?.getTracks().forEach(t => t.stop());
          setGlStatus("error"); setGlError("Screen capture was denied. Switch to Canvas mode or allow the permission and try again."); return;
        }
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    if (!tabCaptureStream) glCanvasRef.current = canvas;
    const c = canvas.getContext("2d")!;

    // ── Avatar image cache ────────────────────────────────────────────────
    const avatarCache = new Map<string, HTMLImageElement>();
    const loadImg = (url: string) => {
      if (avatarCache.has(url)) return;
      const img = new Image(); img.crossOrigin = "anonymous"; img.src = url; avatarCache.set(url, img);
    };
    participantsRef.current.forEach(p => { if (p.profileImageUrl) loadImg(p.profileImageUrl); });

    // ── Video element cache for camera streams ────────────────────────────
    const videoElCache = new Map<string, HTMLVideoElement>();
    const getOrCreateVideoEl = (id: string, stream: MediaStream) => {
      let el = videoElCache.get(id);
      if (!el) { el = document.createElement("video"); videoElCache.set(id, el); }
      if (el.srcObject !== stream) {
        el.srcObject = stream; el.autoplay = true; el.muted = true; el.playsInline = true;
        el.play().catch(() => {});
      }
      return el;
    };

    // ── Safe rounded-rect helper ──────────────────────────────────────────
    const rrect = (x: number, y: number, w: number, h: number, r: number) => {
      const cr = Math.min(r, w/2, h/2);
      c.beginPath(); c.moveTo(x+cr,y); c.lineTo(x+w-cr,y);
      c.quadraticCurveTo(x+w,y,x+w,y+cr); c.lineTo(x+w,y+h-cr);
      c.quadraticCurveTo(x+w,y+h,x+w-cr,y+h); c.lineTo(x+cr,y+h);
      c.quadraticCurveTo(x,y+h,x,y+h-cr); c.lineTo(x,y+cr);
      c.quadraticCurveTo(x,y,x+cr,y); c.closePath();
    };

    const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#0ea5e9","#ef4444","#f97316"];

    const drawFrame = (sec: number) => {
      const W = 1280, H = 720;
      const pts = participantsRef.current;
      const spk = speakingUsersRef.current;

      // ── Background ───────────────────────────────────────────────────────
      c.fillStyle = "#080814"; c.fillRect(0, 0, W, H);
      const bgGrad = c.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.65);
      bgGrad.addColorStop(0, "rgba(70,30,130,0.20)"); bgGrad.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = bgGrad; c.fillRect(0, 0, W, H);
      // Dot grid
      c.fillStyle = "rgba(255,255,255,0.022)";
      for (let gx = 50; gx < W; gx += 60) for (let gy = 50; gy < H; gy += 60) {
        c.beginPath(); c.arc(gx,gy,1,0,Math.PI*2); c.fill();
      }

      // ── Top bar ──────────────────────────────────────────────────────────
      const topGrad = c.createLinearGradient(0,0,0,60);
      topGrad.addColorStop(0,"rgba(8,8,22,0.96)"); topGrad.addColorStop(1,"rgba(8,8,22,0.78)");
      c.fillStyle = topGrad; c.fillRect(0,0,W,60);
      c.strokeStyle = "rgba(255,255,255,0.08)"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0,60); c.lineTo(W,60); c.stroke();

      // LIVE badge
      const pulse = 0.78 + 0.22*Math.sin(sec*Math.PI*2);
      c.fillStyle = `rgba(220,38,38,${pulse})`; rrect(16,15,66,28,6); c.fill();
      c.fillStyle = "#fff"; c.font = "bold 12px Arial,sans-serif";
      c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("● LIVE", 24,29);

      // Duration
      const h2=Math.floor(sec/3600), m2=Math.floor((sec%3600)/60), s2=sec%60;
      const dur=`${h2>0?h2+":":""}${String(m2).padStart(2,"0")}:${String(s2).padStart(2,"0")}`;
      c.fillStyle="rgba(255,255,255,0.5)"; c.font="13px Arial,sans-serif"; c.fillText(dur,92,29);

      // Room title (centre)
      c.fillStyle="#fff"; c.font="bold 17px Arial,sans-serif"; c.textAlign="center";
      c.fillText(room.title||"Vextorn Room", W/2, 29);

      // Participant count right of title
      const titleW = c.measureText(room.title||"Vextorn Room").width;
      c.fillStyle="rgba(255,255,255,0.35)"; c.font="12px Arial,sans-serif";
      c.fillText(`${pts.length} online`, W/2+titleW/2+14, 29);

      // Vextorn brand (right)
      c.fillStyle="rgba(255,165,60,0.9)"; c.font="bold 15px Arial,sans-serif"; c.textAlign="right";
      c.fillText("Vextorn", W-18, 29); c.textBaseline="alphabetic";

      // ── Participant grid ─────────────────────────────────────────────────
      const vis = pts.slice(0,12);
      const n = vis.length;
      if (n === 0) {
        c.fillStyle="rgba(255,255,255,0.2)"; c.font="20px Arial,sans-serif";
        c.textAlign="center"; c.textBaseline="middle";
        c.fillText("Waiting for participants…", W/2, H/2); c.textBaseline="alphabetic";
      } else {
        const cols = n<=1?1:n<=2?2:n<=4?2:n<=6?3:n<=9?3:4;
        const rows = Math.ceil(n/cols);
        const PAD=18, TOP=68, BOT=54, IGAP=8;
        const gW=W-PAD*2, gH=H-TOP-BOT;
        const cW=gW/cols, cH=gH/rows;

        vis.forEach((p, i) => {
          const col=i%cols, row=Math.floor(i/cols);
          const cardX=PAD+col*cW+IGAP/2, cardY=TOP+row*cH+IGAP/2;
          const cardW=cW-IGAP, cardH=cH-IGAP;
          const cx=cardX+cardW/2, cy=cardY+cardH*0.42;
          const R=Math.min(cardW*0.26, cardH*0.30, 88);
          const isSpeaking=spk.has(p.id);
          const isHost=(p as any).id===room.hostId;

          // Card background
          rrect(cardX,cardY,cardW,cardH,14);
          const cbg = c.createLinearGradient(cardX,cardY,cardX,cardY+cardH);
          if (isSpeaking) {
            cbg.addColorStop(0,"rgba(200,110,20,0.24)"); cbg.addColorStop(1,"rgba(120,60,5,0.18)");
            c.fillStyle=cbg; c.fill();
            rrect(cardX,cardY,cardW,cardH,14);
            c.strokeStyle="rgba(255,165,60,0.50)"; c.lineWidth=1.5; c.stroke();
          } else {
            cbg.addColorStop(0,"rgba(255,255,255,0.055)"); cbg.addColorStop(1,"rgba(255,255,255,0.022)");
            c.fillStyle=cbg; c.fill();
            rrect(cardX,cardY,cardW,cardH,14);
            c.strokeStyle="rgba(255,255,255,0.09)"; c.lineWidth=1; c.stroke();
          }

          // Speaking outer rings
          if (isSpeaking) {
            const a=0.38+0.42*Math.sin(sec*Math.PI*3.5);
            c.strokeStyle=`rgba(255,165,60,${a})`; c.lineWidth=4;
            c.beginPath(); c.arc(cx,cy,R+11,0,Math.PI*2); c.stroke();
            c.strokeStyle=`rgba(255,165,60,${a*0.22})`; c.lineWidth=2;
            c.beginPath(); c.arc(cx,cy,R+22,0,Math.PI*2); c.stroke();
          }

          // ── Avatar: try camera video → profile photo → initials ─────────
          c.save(); c.beginPath(); c.arc(cx,cy,R,0,Math.PI*2); c.clip();
          let drawn=false;

          const vidStream = p.id===user?.id ? localVideoStreamRef.current : remoteVideoStreams.current.get(p.id);
          if (vidStream && vidStream.getVideoTracks().some(t=>t.enabled && t.readyState==="live")) {
            const vel=getOrCreateVideoEl(p.id, vidStream);
            if (vel.readyState>=2 && vel.videoWidth>0) {
              const vAR=vel.videoWidth/vel.videoHeight;
              let sw=vel.videoWidth, sh=vel.videoHeight;
              if (vAR>1) { sw=sh; } else { sh=sw; }
              c.drawImage(vel, (vel.videoWidth-sw)/2,(vel.videoHeight-sh)/2, sw,sh, cx-R,cy-R, R*2,R*2);
              drawn=true;
            }
          }

          if (!drawn) {
            const img = p.profileImageUrl ? avatarCache.get(p.profileImageUrl) : undefined;
            if (img?.complete && img.naturalWidth>0) {
              const iAR=img.naturalWidth/img.naturalHeight;
              let sw=img.naturalWidth, sh=img.naturalHeight;
              if (iAR>1) { sw=sh; } else { sh=sw; }
              c.drawImage(img, (img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2, sw,sh, cx-R,cy-R, R*2,R*2);
              drawn=true;
            }
            if (p.profileImageUrl && !avatarCache.has(p.profileImageUrl)) loadImg(p.profileImageUrl);
          }

          if (!drawn) {
            const ci=(p.displayName?.charCodeAt(0)||p.firstName?.charCodeAt(0)||65)%AVATAR_COLORS.length;
            const ag=c.createRadialGradient(cx-R*0.2,cy-R*0.2,R*0.08, cx,cy,R);
            ag.addColorStop(0,AVATAR_COLORS[(ci+1)%AVATAR_COLORS.length]);
            ag.addColorStop(1,AVATAR_COLORS[ci]);
            c.fillStyle=ag; c.fillRect(cx-R,cy-R,R*2,R*2);
            c.fillStyle="rgba(255,255,255,0.92)";
            c.font=`bold ${Math.round(R*0.52)}px Arial,sans-serif`;
            c.textAlign="center"; c.textBaseline="middle";
            c.fillText(((p.displayName||p.firstName||"?")[0]).toUpperCase(), cx, cy);
          }
          c.restore();

          // Avatar border ring
          c.strokeStyle=isSpeaking?"rgba(255,165,60,0.85)":"rgba(255,255,255,0.20)";
          c.lineWidth=isSpeaking?2.5:1.5;
          c.beginPath(); c.arc(cx,cy,R,0,Math.PI*2); c.stroke();

          // Host crown (top-right)
          if (isHost) {
            c.fillStyle="rgba(8,8,22,0.75)";
            const bx=cx+R*0.72, by=cy-R*0.72, br=R*0.22;
            c.beginPath(); c.arc(bx,by,br,0,Math.PI*2); c.fill();
            c.fillStyle="rgba(255,195,40,0.95)";
            c.font=`${Math.max(10,Math.round(br*1.6))}px Arial,sans-serif`;
            c.textAlign="center"; c.textBaseline="middle"; c.fillText("♛",bx,by+1);
          }

          // Muted indicator (bottom-right)
          if (p.isMuted) {
            const bx=cx+R*0.72, by=cy+R*0.72, br=R*0.22;
            c.fillStyle="rgba(200,30,30,0.92)";
            c.beginPath(); c.arc(bx,by,br,0,Math.PI*2); c.fill();
            c.fillStyle="#fff"; c.font=`bold ${Math.max(8,Math.round(br*1.1))}px Arial,sans-serif`;
            c.textAlign="center"; c.textBaseline="middle"; c.fillText("✕",bx,by);
          }

          // Name label
          const name=(p.displayName||p.firstName||"User");
          const ns=name.length>18?name.slice(0,17)+"…":name;
          c.fillStyle=isSpeaking?"rgba(255,185,80,1.0)":"rgba(255,255,255,0.88)";
          c.font=`${Math.max(11,Math.round(R*0.24))}px Arial,sans-serif`;
          c.textAlign="center"; c.textBaseline="alphabetic";
          c.fillText(ns, cx, cardY+cardH-12);

          // Speaking label
          if (isSpeaking) {
            c.fillStyle="rgba(255,155,40,0.62)";
            c.font=`${Math.max(8,Math.round(R*0.17))}px Arial,sans-serif`;
            c.fillText("speaking…", cx, cardY+cardH-12-Math.max(12,Math.round(R*0.28)));
          }
        });

        if (pts.length>12) {
          c.fillStyle="rgba(255,255,255,0.30)"; c.font="13px Arial,sans-serif";
          c.textAlign="center"; c.textBaseline="alphabetic";
          c.fillText(`+${pts.length-12} more in room`, W/2, H-56);
        }
      }

      // ── Bottom bar ───────────────────────────────────────────────────────
      const botGrad=c.createLinearGradient(0,H-52,0,H);
      botGrad.addColorStop(0,"rgba(8,8,22,0.78)"); botGrad.addColorStop(1,"rgba(8,8,22,0.94)");
      c.fillStyle=botGrad; c.fillRect(0,H-52,W,52);
      c.strokeStyle="rgba(255,255,255,0.07)"; c.lineWidth=1;
      c.beginPath(); c.moveTo(0,H-52); c.lineTo(W,H-52); c.stroke();
      const meta=[(room as any).language,(room as any).skillLevel,`${pts.length} in room`].filter(Boolean).join("  ·  ");
      c.fillStyle="rgba(255,255,255,0.38)"; c.font="13px Arial,sans-serif";
      c.textAlign="left"; c.textBaseline="middle"; c.fillText(meta,20,H-26);
      c.fillStyle="rgba(255,165,60,0.48)"; c.textAlign="right";
      c.fillText("vextorn.com  ·  Talk. Share. Belong.", W-20, H-26);
      c.textBaseline="alphabetic";
    };

    // Only run canvas loop when NOT using tab capture
    if (!tabCaptureStream) {
      let t0 = Date.now();
      const loop = () => { drawFrame(Math.floor((Date.now()-t0)/1000)); glRafRef.current = requestAnimationFrame(loop); };
      loop();
    }

    // Combine video + mixed audio → MediaRecorder → FFmpeg → RTMP
    const videoTracks = tabCaptureStream
      ? tabCaptureStream.getVideoTracks()
      : canvas.captureStream(30).getVideoTracks();
    const combined = new MediaStream([...videoTracks, ...audioDest.stream.getAudioTracks()]);

    // Start server-side FFmpeg
    let startRes: Response;
    try {
      startRes = await fetch("/api/stream/start", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          twitchKey: twitchKey || undefined, youtubeKey: youtubeKey || undefined,
          roomId: room.id, twitchUsername: glTwitchUsername.trim() || undefined,
          youtubeChannelId: glYoutubeChannelId.trim() || undefined,
        }),
      });
    } catch {
      if (glRafRef.current) { cancelAnimationFrame(glRafRef.current); glRafRef.current = null; }
      audioCtx.close().catch(()=>{}); glAudioCtxRef.current = null; glCanvasRef.current = null;
      micStream?.getTracks().forEach(t=>t.stop());
      setGlStatus("error"); setGlError("Could not reach streaming server. Try again."); return;
    }
    if (!startRes.ok) {
      const err = await startRes.json().catch(()=>({}));
      if (glRafRef.current) { cancelAnimationFrame(glRafRef.current); glRafRef.current = null; }
      audioCtx.close().catch(()=>{}); glAudioCtxRef.current = null; glCanvasRef.current = null;
      micStream?.getTracks().forEach(t=>t.stop());
      setGlStatus("error"); setGlError((err as any).message || "Failed to start stream."); return;
    }
    const { streamId } = await startRes.json();
    setGlStreamId(streamId);

    // Codec priority: VP9 > VP8 > plain WebM.
    // VP9 delivers significantly better quality than VP8 at the same bitrate
    // (≈ 30–50 % bitrate saving for equivalent visual quality). FFmpeg can
    // transcode either to H.264 for RTMP ingest.
    const mimeType =
      MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";
    // 4 Mbps matches the FFmpeg -b:v target on the server side. Giving the
    // browser encoder a matching ceiling ensures it actually produces enough
    // data for FFmpeg to fill the RTMP pipe at 4 Mbps.
    const mr = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 4_000_000 });
    glMediaRecorderRef.current = mr;

    // Helper: stop everything and surface an error message to the user
    const crashStop = (msg: string) => {
      if (glMediaRecorderRef.current?.state !== "inactive") { try { glMediaRecorderRef.current?.stop(); } catch {} }
      glMediaRecorderRef.current = null;
      if (glRafRef.current) { cancelAnimationFrame(glRafRef.current); glRafRef.current = null; }
      if (glAudioCtxRef.current) { glAudioCtxRef.current.close().catch(()=>{}); glAudioCtxRef.current = null; }
      glCanvasRef.current = null;
      if (glDurationRef.current) { clearInterval(glDurationRef.current); glDurationRef.current = null; }
      if (glViewerPollRef.current) { clearInterval(glViewerPollRef.current); glViewerPollRef.current = null; }
      if (glStatusPollRef.current) { clearInterval(glStatusPollRef.current); glStatusPollRef.current = null; }
      micStream?.getTracks().forEach(t => t.stop());
      fetch(`/api/stream/${streamId}/stop`, { method: "POST", credentials: "include" }).catch(()=>{});
      setGlStreamId(null); setGlStatus("error"); setGlError(msg);
    };

    glChunkFailRef.current = 0;

    mr.ondataavailable = async (e) => {
      if (!e.data.size) return;
      try {
        const buf = await e.data.arrayBuffer();
        const res = await fetch(`/api/stream/${streamId}/chunk`, {
          method: "POST", headers: { "Content-Type": "application/octet-stream" },
          credentials: "include", body: buf,
        });
        if (res.status === 410 || res.status === 404) {
          // FFmpeg died — grab the error message from the server and surface it
          const body = await res.json().catch(() => ({})) as any;
          const msg = body.exitError || body.message || "Stream disconnected — check your stream key and try again.";
          crashStop(msg); return;
        }
        if (!res.ok) {
          glChunkFailRef.current++;
          if (glChunkFailRef.current >= 4) crashStop("Connection to streaming server lost after repeated errors.");
        } else {
          glChunkFailRef.current = 0; // reset on success
        }
      } catch {
        glChunkFailRef.current++;
        if (glChunkFailRef.current >= 4) crashStop("Connection to streaming server lost.");
      }
    };

    mr.onerror = (e) => { crashStop(`Recording error: ${(e as any)?.error?.message ?? "unknown"}`); };

    mr.onstop = () => {
      micStream?.getTracks().forEach(t=>t.stop());
      audioCtx.close().catch(()=>{}); glAudioCtxRef.current = null;
      if (glRafRef.current) { cancelAnimationFrame(glRafRef.current); glRafRef.current = null; }
      glCanvasRef.current = null;
    };

    // 250 ms timeslice: feeds FFmpeg 4× per second instead of once every 1.5 s.
    // The old 1500 ms value left FFmpeg's stdin pipe starved for ~1.3 s between
    // bursts, causing the encoder to produce near-zero output (≈138 Kbps) and
    // YouTube to warn about low bitrate. At 250 ms the data flow is continuous,
    // letting FFmpeg sustain the full 4 Mbps target.
    mr.start(250);
    setGlStatus("live"); setGlDuration(0); setGlViewers(null);
    glDurationRef.current = setInterval(() => setGlDuration(d => d+1), 1000);

    // ── Poll stream status every 10 s to detect silent FFmpeg crashes ────────
    const pollStatus = async () => {
      try {
        const r = await fetch(`/api/stream/${streamId}/status`, { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json() as any;
        if (data.alive === false && glMediaRecorderRef.current?.state !== "inactive") {
          const msg = data.exitError || "Stream ended unexpectedly — check your stream key and try again.";
          crashStop(msg);
        }
      } catch {}
    };
    glStatusPollRef.current = setInterval(pollStatus, 10_000);

    const pollViewers = async () => {
      try {
        const r = await fetch(`/api/stream/${streamId}/viewers`, { credentials: "include" });
        if (r.ok) setGlViewers(await r.json());
      } catch {}
    };
    pollViewers();
    glViewerPollRef.current = setInterval(pollViewers, 30_000);
  }, [goLivePlatform, glTwitchKey, glYoutubeKey, glTwitchUsername, glYoutubeChannelId, room.id, room.title, room.language, glCaptureMode]);

  const stopGoLive = useCallback(async (sid?: string) => {
    const id = sid ?? glStreamId;
    if (glMediaRecorderRef.current && glMediaRecorderRef.current.state !== "inactive") {
      glMediaRecorderRef.current.stop(); // triggers mr.onstop → cleans up audioCtx + RAF
    }
    glMediaRecorderRef.current = null;
    // Stop tab capture tracks if active
    if (glTabStreamRef.current) { glTabStreamRef.current.getTracks().forEach(t => t.stop()); glTabStreamRef.current = null; }
    // Fallback cleanup if onstop didn't fire
    if (glRafRef.current) { cancelAnimationFrame(glRafRef.current); glRafRef.current = null; }
    if (glAudioCtxRef.current) { glAudioCtxRef.current.close().catch(()=>{}); glAudioCtxRef.current = null; }
    glCanvasRef.current = null;
    if (glDurationRef.current) { clearInterval(glDurationRef.current); glDurationRef.current = null; }
    if (glViewerPollRef.current) { clearInterval(glViewerPollRef.current); glViewerPollRef.current = null; }
    if (glStatusPollRef.current) { clearInterval(glStatusPollRef.current); glStatusPollRef.current = null; }
    glChunkFailRef.current = 0;
    setGlStatus("idle"); setGlDuration(0); setGlViewers(null);
    if (id) { setGlStreamId(null); fetch(`/api/stream/${id}/stop`, { method: "POST", credentials: "include" }).catch(()=>{}); }
  }, [glStreamId]);
  // ─────────────────────────────────────────────────────────────────────────

  // Activates a stream (native screen capture or camera fallback) through the
  // existing screen-share WebRTC infrastructure. Called by handleScreenShare.
  const _activateShareStream = async (stream: MediaStream, cameraFallback = false) => {
    screenStream.current = stream;
    // Respect the current mute state: if the user is muted when they start
    // sharing, disable the screen-share audio track immediately so peers
    // never hear system audio while the sharer's mic is silenced.
    if (isMutedRef.current) {
      stream.getAudioTracks().forEach((t) => { t.enabled = false; });
    }
    setIsScreenSharing(true);
    setIsCameraShareMode(cameraFallback);
    socket?.emit("room:screen-share", { roomId: room.id, userId: user?.id, active: true });
    if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
    const peerEntries = Array.from(peerConnections.current.entries());
    for (const [peerId, pc] of peerEntries) {
      try {
        const senders: RTCRtpSender[] = [];
        stream.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, stream);
          senders.push(sender);
        });
        screenSenders.current.set(peerId, senders);
        if (pc.signalingState === "stable") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit("webrtc:offer", { offer, to: peerId, roomId: room.id });
        }
      } catch (e) {
        console.error("Error adding share track to peer:", peerId, e);
      }
    }
    // When the track ends (user stops from browser UI), clean up.
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        removeScreenTracksFromPeers();
        screenStream.current?.getTracks().forEach((t) => t.stop());
        screenStream.current = null;
        setIsScreenSharing(false);
        setIsCameraShareMode(false);
        socket?.emit("room:screen-share", { roomId: room.id, userId: user?.id, active: false });
      };
    }
  };

  // Camera-as-share fallback: broadcasts the camera through the screen-share
  // channel. Works on ALL mobile browsers regardless of getDisplayMedia support.
  // If the camera is already on (isVideoOn), we clone that stream instead of
  // requesting a new one — iOS only allows one camera stream at a time so
  // calling getUserMedia again while video is live silently fails.
  const _startCameraShareFallback = async () => {
    // Reuse the live camera stream when video is already on.
    if (isVideoOn && videoStream.current) {
      try {
        // Clone so the share track lifecycle is independent of the video track.
        const cloned = videoStream.current.clone();
        await _activateShareStream(cloned, true);
        toast({
          title: "Camera sharing started",
          description: "Your camera feed is now shared with everyone in the room.",
        });
        return;
      } catch (_) {
        // Fall through to fresh getUserMedia attempt below.
      }
    }

    toast({
      title: "Screen share not available",
      description: "Your browser doesn't support screen capture. Opening your camera to share instead.",
    });

    // iOS: stop the existing video track first so the camera is free to use.
    const hadVideo = isVideoOn && !!videoStream.current;
    if (hadVideo) {
      videoStream.current?.getVideoTracks().forEach((t) => t.stop());
    }

    const attempts: MediaTrackConstraints[] = [
      { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      { facingMode: { ideal: "environment" } },
      {},
    ];
    let camStream: MediaStream | null = null;
    for (const constraints of attempts) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
        break;
      } catch (_) {}
    }
    if (!camStream) {
      toast({ title: "Camera unavailable", description: "Could not open camera for sharing.", variant: "destructive" });
      return;
    }
    await _activateShareStream(camStream, true);
    toast({ title: "Camera sharing started", description: "Your camera is now visible to everyone in the room as a share." });
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      await stopMyScreenShare();
      return;
    }
    if (!canShareScreenByPerm) {
      toast({ title: "Screen-share locked", description: screenLockReason || "Sharing is disabled in this room.", variant: "destructive" });
      return;
    }

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // ── Native screen capture path ────────────────────────────────────────
    // getDisplayMedia must be called as close to the user gesture as possible
    // (iOS Safari requirement). We call it immediately with no async gaps.
    if (navigator.mediaDevices?.getDisplayMedia && window.isSecureContext) {
      try {
        let stream: MediaStream;

        if (isMobile) {
          // Mobile-optimised: video-only first. iOS Safari throws NotSupportedError
          // when audio is requested in getDisplayMedia. Android Chrome works with
          // audio but video-only is universally supported.
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          } catch (firstErr: any) {
            // If user denied/dismissed — don't fallback, respect their choice.
            if (firstErr?.name === "NotAllowedError" || firstErr?.name === "AbortError") throw firstErr;
            // Any other error (NotSupportedError, etc.) → try minimal constraints.
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          }
        } else {
          // Desktop: prefer audio+video, fall back to video-only.
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
          } catch (audioErr: any) {
            if (
              audioErr?.name === "NotSupportedError" ||
              audioErr?.name === "OverconstrainedError" ||
              audioErr?.name === "TypeError"
            ) {
              stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            } else {
              throw audioErr;
            }
          }
        }

        await _activateShareStream(stream, false);
        return;

      } catch (err: any) {
        console.error("Screen share failed:", err);
        const userDismissed = err?.name === "NotAllowedError" || err?.name === "AbortError";

        if (userDismissed) {
          // On mobile, user dismissed the system picker — offer camera fallback.
          if (isMobile) {
            await _startCameraShareFallback();
          }
          // On desktop, user deliberately cancelled — no toast needed.
          return;
        }

        // Unexpected failure on mobile → try camera fallback automatically.
        if (isMobile) {
          await _startCameraShareFallback();
          return;
        }

        toast({
          title: "Screen share failed",
          description: "Could not capture your screen. Check browser permissions and try again.",
          variant: "destructive",
        });
        return;
      }
    }

    // ── No getDisplayMedia support ────────────────────────────────────────
    if (isMobile) {
      // Mobile browser without getDisplayMedia → camera fallback.
      await _startCameraShareFallback();
      return;
    }

    const reason = !window.isSecureContext
      ? "Screen sharing requires a secure connection (HTTPS)."
      : "Your browser doesn't support screen sharing. Try Chrome, Edge, or Safari 16.4+.";
    toast({ title: "Screen sharing not supported", description: reason, variant: "destructive" });
  };

  const toggleVideo = async () => {
    // Turning the camera OFF is always permitted. Turning it ON is gated by
    // the room's camera permission only — independent from mic/talk perms,
    // so a "silent room" can still allow video.
    if (!isVideoOn && !canOpenCameraByPerm) {
      toast({ title: "Camera locked", description: cameraLockReason || "Camera is disabled in this room.", variant: "destructive" });
      return;
    }
    if (isVideoOn) {
      peerConnections.current.forEach((pc, peerId) => {
        const sender = videoSenders.current.get(peerId);
        if (sender) {
          try { pc.removeTrack(sender); } catch (e) {}
          videoSenders.current.delete(peerId);
        }
      });
      const renegEntries1 = Array.from(peerConnections.current.entries());
      for (let i = 0; i < renegEntries1.length; i++) {
        const [peerId, pc] = renegEntries1[i];
        try {
          if (pc.signalingState !== "stable") continue;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit("webrtc:offer", { offer, to: peerId, roomId: room.id });
        } catch (e) {}
      }
      videoStream.current?.getTracks().forEach((t) => t.stop());
      videoStream.current = null;
      setIsVideoOn(false);
      setLocalVideoStreamObj(null);
      setMiniCameraMode(false);
      setCameraFacing("user");
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      socket?.emit("room:video-status", { roomId: room.id, active: false });
      return;
    }
    try {
      // Mobile-safe camera open: use a fallback chain because combining
      // facingMode + width/height as hard constraints throws OverconstrainedError
      // on iOS Safari and many Android browsers (especially for the front camera).
      // 1. Full constraints with facingMode as ideal (never hard-fails)
      // 2. facingMode only, no size
      // 3. Any video (last resort)
      let stream: MediaStream | null = null;
      const attempts: MediaTrackConstraints[] = [
        { facingMode: { ideal: cameraFacing }, width: { ideal: 640 }, height: { ideal: 480 } },
        { facingMode: { ideal: cameraFacing } },
        {},
      ];
      let lastErr: unknown;
      for (const videoConstraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!stream) throw lastErr;

      videoStream.current = stream;
      if (activeYoutubeId) {
        handleStopYoutube();
      }
      if (showEReader || selectedBook) {
        handleCloseBook();
      }
      setIsVideoOn(true);
      setLocalVideoStreamObj(stream);
      requestAnimationFrame(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      });
      socket?.emit("room:video-status", { roomId: room.id, active: true });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const renegEntries2 = Array.from(peerConnections.current.entries());
        for (let i = 0; i < renegEntries2.length; i++) {
          const [peerId, pc] = renegEntries2[i];
          try {
            const sender = pc.addTrack(videoTrack, stream);
            videoSenders.current.set(peerId, sender);
            if (pc.signalingState !== "stable") continue;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket?.emit("webrtc:offer", { offer, to: peerId, roomId: room.id });
          } catch (e) {
            console.error("Error adding video to peer:", e);
          }
        }
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      const isPermission = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      const isNotFound = err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError";
      toast({
        title: "Camera unavailable",
        description: isPermission
          ? "Allow camera access in your browser settings and try again."
          : isNotFound
          ? "No camera found on this device."
          : "Could not open camera. Try reloading or check your browser permissions.",
        variant: "destructive",
      });
    }
  };

  const handleFlipCamera = async () => {
    if (!isVideoOn || isFlippingCamera) return;
    setIsFlippingCamera(true);
    const newFacing = cameraFacing === "user" ? "environment" : "user";
    const isMobileDev = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Snapshot the current state before we change anything so we can restore.
    const oldStream = videoStream.current;
    const oldFacing = cameraFacing;

    try {
      let newStream: MediaStream | null = null;
      const currentDeviceId = oldStream?.getVideoTracks()[0]?.getSettings().deviceId;

      // ── iOS Safari MUST release the current camera before opening the other ──
      // iOS only allows one camera open at a time. Trying to getUserMedia while
      // the old track is still live → NotReadableError: "Could not start video
      // source". Stopping first is safe because we replaceTrack() into the peer
      // connections after we have the new stream.
      if (isMobileDev) {
        oldStream?.getVideoTracks().forEach((t) => t.stop());
        videoStream.current = null;
      }

      // Strategy 1 — facingMode: { exact } (forces the OS camera switcher).
      // Preferred on mobile because it's unambiguous about which lens to open.
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: newFacing } },
        });
      } catch (_) {}

      // Strategy 2 — deviceId switch (most reliable on multi-camera Android).
      // On desktop Chrome enumerateDevices returns labelled devices so we can
      // pick the exact physical camera. Skip on mobile — labels are often blank
      // and we already tried exact facingMode above.
      if (!newStream && !isMobileDev && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === "videoinput" && d.deviceId !== "");
          if (videoDevices.length >= 2) {
            const frontHints = /front|face|selfie/i;
            const backHints = /back|rear|environment|main|wide|ultra/i;
            const target =
              videoDevices.find((d) => {
                if (d.deviceId === currentDeviceId) return false;
                return newFacing === "user" ? frontHints.test(d.label) : backHints.test(d.label);
              }) ?? videoDevices.find((d) => d.deviceId !== currentDeviceId);

            if (target) {
              try {
                const s = await navigator.mediaDevices.getUserMedia({
                  video: { deviceId: { exact: target.deviceId }, width: { ideal: 640 }, height: { ideal: 480 } },
                });
                if (s.getVideoTracks()[0]?.getSettings().deviceId !== currentDeviceId) {
                  newStream = s;
                } else {
                  s.getTracks().forEach((t) => t.stop());
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // Strategy 3 — facingMode: { ideal } + size hints (never throws OverconstrainedError).
      if (!newStream) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: newFacing }, width: { ideal: 640 }, height: { ideal: 480 } },
          });
        } catch (_) {}
      }

      // Strategy 4 — facingMode: { ideal } only (old iOS rejects width/height with facingMode).
      if (!newStream) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: newFacing } },
          });
        } catch (_) {}
      }

      // Strategy 5 — any video (absolute last resort).
      if (!newStream) {
        newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      const newTrack = newStream.getVideoTracks()[0];

      // Swap the track in every active peer connection (no renegotiation needed).
      for (const sender of videoSenders.current.values()) {
        try { await sender.replaceTrack(newTrack); } catch (_) {}
      }

      // Stop non-mobile old tracks here (mobile already stopped them above).
      if (!isMobileDev) {
        oldStream?.getTracks().forEach((t) => t.stop());
      }

      videoStream.current = newStream;
      setLocalVideoStreamObj(newStream);
      if (localVideoRef.current) localVideoRef.current.srcObject = newStream;

      // Use track settings when available; fall back to what we requested so
      // the CSS mirror stays correct even when the browser returns "" for facing.
      const actualFacing = newTrack.getSettings().facingMode;
      setCameraFacing(
        actualFacing === "environment" ? "environment"
        : actualFacing === "user" ? "user"
        : newFacing
      );

    } catch (err: any) {
      const isPermission = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      toast({
        title: "Camera flip failed",
        description: isPermission
          ? "Allow camera access in your browser settings to switch cameras."
          : "Could not switch camera. Your device may only have one camera.",
        variant: "destructive",
      });

      // On mobile we already stopped the old stream. Try to restore it so the
      // user doesn't end up with a black camera after a failed flip.
      if (isMobileDev && !videoStream.current) {
        try {
          const restored = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: oldFacing } },
          });
          videoStream.current = restored;
          setLocalVideoStreamObj(restored);
          if (localVideoRef.current) localVideoRef.current.srcObject = restored;
          for (const sender of videoSenders.current.values()) {
            try { await sender.replaceTrack(restored.getVideoTracks()[0]); } catch (_) {}
          }
          setCameraFacing(oldFacing);
        } catch (_) {
          // Couldn't restore either — give up and turn video off cleanly.
          setIsVideoOn(false);
          setLocalVideoStreamObj(null);
          socket?.emit("room:video-status", { roomId: room.id, active: false });
        }
      }
    } finally {
      setIsFlippingCamera(false);
    }
  };

  useEffect(() => {
    if (sidePanelTab !== "youtube") return;
    setYoutubeFeaturedLoading(true);
    fetch(`/api/youtube/featured?category=${encodeURIComponent(youtubeCategory)}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (!Array.isArray(data)) { setYoutubeFeatured([]); return; }
        // Shuffle for variety — each session sees a different order
        const arr = [...data];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        setYoutubeFeatured(arr);
      })
      .catch(() => {})
      .finally(() => setYoutubeFeaturedLoading(false));
  }, [sidePanelTab, youtubeCategory]);

  // Load watch history from localStorage on mount
  useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = localStorage.getItem(`vx_yt_history_${user.id}`);
      if (stored) setYtHistory(JSON.parse(stored));
    } catch {}
  }, [user?.id]);

  // Fetch personalised suggestions when the panel opens and history exists
  useEffect(() => {
    if (sidePanelTab !== "youtube" || ytHistory.length === 0) return;
    const recentTerms = ytHistory.slice(0, 4)
      .map(h => h.title.split(" ").slice(0, 5).join(" "))
      .join(" ");
    setYtSuggestedLoading(true);
    const historyIds = new Set(ytHistory.slice(0, 20).map(h => h.id));
    fetch(`/api/youtube/suggestions?q=${encodeURIComponent(recentTerms)}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setYtSuggested(Array.isArray(data) ? data.filter((v: any) => !historyIds.has(v.id)) : []))
      .catch(() => {})
      .finally(() => setYtSuggestedLoading(false));
  }, [sidePanelTab, ytHistory]);

  const extractYoutubeVideoId = (value: string) => {
    const trimmed = value.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?.*?[?&]v=([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  };

  const getYoutubeEmbedUrl = (videoId: string) => {
    const origin = typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1${origin ? `&origin=${origin}` : ""}`;
  };

  const handleYoutubeSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setYoutubeResults([]);
      return;
    }
    const directVideoId = extractYoutubeVideoId(query);
    if (directVideoId) {
      setYoutubeResults([{
        id: directVideoId,
        title: "Play pasted YouTube video",
        thumbnail: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
        channelTitle: "YouTube link",
        duration: "",
      }]);
      setYoutubeSearching(false);
      return;
    }
    setYoutubeSearching(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setYoutubeResults(data);
      }
    } catch (e) {
    } finally {
      setYoutubeSearching(false);
    }
  }, []);

  const handleYoutubeSearchInput = (value: string) => {
    setYoutubeSearch(value);
    if (youtubeSearchTimeout.current) clearTimeout(youtubeSearchTimeout.current);
    youtubeSearchTimeout.current = setTimeout(() => {
      handleYoutubeSearch(value);
    }, 400);
  };

  const handleSelectYoutubeVideo = (videoId: string) => {
    if (!canPlayYoutube) {
      toast({ title: "YouTube locked", description: youtubeLockReason || "YouTube is disabled in this room.", variant: "destructive" });
      return;
    }
    if (showEReader || selectedBook) {
      handleCloseBook();
    }
    setShowMovie(false);
    // I become the host of my own video. Other people in the room can choose
    // to watch it from my participant tile, but my selection no longer
    // hijacks anyone else's player.
    setActiveYoutubeId(videoId);
    setYoutubeStartedBy(user?.id || null);
    setShowYoutube(true);
    setYoutubeHosts(prev => {
      const next = new Map(prev);
      if (user?.id) next.set(user.id, videoId);
      return next;
    });
    socket?.emit("room:youtube", { roomId: room.id, hostId: user?.id, videoId });
    setYoutubeSearch("");
    setYoutubeResults([]);

    // Record in watch history
    const videoInfo =
      youtubeResults.find((v: any) => v.id === videoId) ||
      youtubeFeatured.find((v: any) => v.id === videoId) ||
      ytSuggested.find((v: any) => v.id === videoId) ||
      ytHistory.find((v: any) => v.id === videoId);
    if (videoInfo && user?.id) {
      const key = `vx_yt_history_${user.id}`;
      setYtHistory(prev => {
        const filtered = prev.filter(h => h.id !== videoId);
        const next = [{ id: videoInfo.id, title: videoInfo.title || "Video", thumbnail: videoInfo.thumbnail || "", channelTitle: videoInfo.channelTitle || "", duration: videoInfo.duration || "", watchedAt: Date.now() }, ...filtered].slice(0, 50);
        try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
        return next;
      });
    }
  };

  const formatYtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleStopYoutube = () => {
    const wasMyOwnHost = !!user?.id && youtubeStartedByRef.current === user.id;
    setActiveYoutubeId(null);
    setYoutubeStartedBy(null);
    setShowYoutube(false);
    setMiniPlayerMode(false);
    setFocusedUserId(null);
    setYtIsPlaying(false);
    setYtCurrentTime(0);
    setYtDuration(0);
    youtubePlayerRef.current?.destroy();
    youtubePlayerRef.current = null;
    if (wasMyOwnHost) {
      // Tear down MY broadcast for everyone watching me.
      setYtQueue([]);
      setYoutubeHosts(prev => {
        const next = new Map(prev);
        next.delete(user!.id);
        return next;
      });
      socket?.emit("room:youtube", { roomId: room.id, hostId: user!.id, videoId: null });
    }
    // If I was just watching someone else, the watching=false signal already
    // goes out via the showYoutube effect — no broadcast needed here.
  };

  const handleAddToQueue = (video: { id: string; title?: string; thumbnail?: string }) => {
    const item: YtQueueItem = {
      id: crypto.randomUUID(),
      videoId: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      addedBy: user?.id ?? "",
    };
    // If nothing is playing, just start it directly
    if (!activeYoutubeId) {
      handleSelectYoutubeVideo(video.id);
      return;
    }
    socket?.emit("room:youtube-queue-add", { roomId: room.id, item });
    toast({ title: "Added to queue", description: video.title ? `"${video.title}" added to the queue` : "Video added to queue" });
  };

  const handleRemoveFromQueue = (itemId: string) => {
    socket?.emit("room:youtube-queue-remove", { roomId: room.id, id: itemId });
  };

  // ── Movie handlers ─────────────────────────────────────────────────────────
  const handleMovieSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setMovieResults([]); return; }
    setMovieSearching(true);
    try {
      const res = await fetch(`/api/movies/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (res.ok) setMovieResults(await res.json());
    } catch (_) {}
    finally { setMovieSearching(false); }
  }, []);

  const handleMovieSearchInput = (value: string) => {
    setMovieSearch(value);
    if (movieSearchTimeout.current) clearTimeout(movieSearchTimeout.current);
    movieSearchTimeout.current = setTimeout(() => handleMovieSearch(value), 400);
  };

  const handleSelectMovie = (movie: { id: number | string; title: string; poster?: string | null }) => {
    const movieId = String(movie.id);
    setShowYoutube(false);
    setMiniPlayerMode(false);
    setActiveMovieId(movieId);
    setActiveMovieTitle(movie.title);
    setActiveMoviePoster(movie.poster || "");
    setMovieStartedBy(user?.id || null);
    setMovieStartOffset(0);
    setMovieHostPlaying(true);
    setShowMovie(true);
    setMovieHosts(prev => {
      const next = new Map(prev);
      if (user?.id) next.set(user.id, { movieId, movieTitle: movie.title, posterPath: movie.poster || "" });
      return next;
    });
    socket?.emit("room:movie", { roomId: room.id, movieId, movieTitle: movie.title, posterPath: movie.poster || "" });
    // Start host-side elapsed timer for sync
    movieHostElapsedRef.current = 0;
    movieHostPlayingRef2.current = true;
    if (movieHostTimerRef.current) clearInterval(movieHostTimerRef.current);
    movieHostTimerRef.current = setInterval(() => {
      if (movieHostPlayingRef2.current) movieHostElapsedRef.current += 1;
    }, 1000);
    setMovieSearch("");
    setMovieResults([]);
    toast({ title: "🎬 Now Watching", description: movie.title });
  };

  const handleStopMovie = () => {
    const wasMyOwnHost = !!user?.id && movieStartedByRef.current === user.id;
    setActiveMovieId(null);
    setActiveMovieTitle("");
    setActiveMoviePoster("");
    setMovieStartedBy(null);
    setShowMovie(false);
    if (movieHostTimerRef.current) { clearInterval(movieHostTimerRef.current); movieHostTimerRef.current = null; }
    movieHostElapsedRef.current = 0;
    movieHostPlayingRef2.current = false;
    if (wasMyOwnHost) {
      setMovieHosts(prev => {
        const next = new Map(prev);
        next.delete(user!.id);
        return next;
      });
      socket?.emit("room:movie", { roomId: room.id, movieId: null });
    }
  };

  const handleMoviePause = () => {
    if (movieVideoRef.current) movieVideoRef.current.pause();
    movieHostPlayingRef2.current = false;
    setMovieHostPlaying(false);
    const t = movieVideoRef.current ? Math.floor(movieVideoRef.current.currentTime) : movieHostElapsedRef.current;
    socket?.emit("room:movie-state", { roomId: room.id, action: "pause", time: t, ts: Date.now() });
  };

  const handleMoviePlay = () => {
    const t = movieVideoRef.current ? Math.floor(movieVideoRef.current.currentTime) : movieHostElapsedRef.current;
    if (movieVideoRef.current) { movieVideoRef.current.currentTime = t; movieVideoRef.current.play().catch(() => {}); }
    movieHostPlayingRef2.current = true;
    setMovieHostPlaying(true);
    socket?.emit("room:movie-state", { roomId: room.id, action: "play", time: t, ts: Date.now() });
    if (!movieVideoRef.current) { setMovieStartOffset(t); setMovieSyncKey(k => k + 1); }
  };

  const handleMovieResync = () => {
    if (!movieStartedBy) return;
    const currentTime = movieCurrentTimeByHost.get(movieStartedBy);
    if (typeof currentTime === "number") {
      const v = movieVideoRef.current;
      if (v) { v.currentTime = Math.floor(currentTime); v.play().catch(() => {}); }
      else { setMovieStartOffset(Math.floor(currentTime)); setMovieSyncKey(k => k + 1); }
    }
  };

  useEffect(() => {
    if (!showMovie || !activeMovieId) { setMovieElapsedDisplay(0); return; }
    const id = setInterval(() => { setMovieElapsedDisplay(movieHostElapsedRef.current); }, 500);
    return () => clearInterval(id);
  }, [showMovie, activeMovieId]);

  const loadPopularMovies = useCallback(async () => {
    if (popularMovies.length > 0) return;
    setPopularMoviesLoading(true);
    try {
      const res = await fetch("/api/movies/popular", { credentials: "include" });
      if (res.ok) {
        const movies = await res.json();
        if (Array.isArray(movies) && movies.length > 0) {
          const dayKey = new Date().toISOString().slice(0, 10);
          if (dailyModernMovieRef.current.dayKey !== dayKey) {
            const modernMovies = movies.filter((movie: any) => {
              const title = `${movie.title || ""} ${movie.original_title || ""}`.toLowerCase();
              return !/documentary|classic|retro|old|silent/.test(title);
            });
            const pool = modernMovies.length > 0 ? modernMovies : movies;
            let hash = 0;
            for (const ch of dayKey) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
            dailyModernMovieRef.current = { dayKey, movieId: pool[hash % pool.length]?.id ?? null };
          }
          const preferredMovieId = dailyModernMovieRef.current.movieId;
          if (preferredMovieId) {
            const preferredIndex = movies.findIndex((movie: any) => movie.id === preferredMovieId);
            if (preferredIndex > 0) {
              const [preferredMovie] = movies.splice(preferredIndex, 1);
              movies.unshift(preferredMovie);
            }
          }
          setPopularMovies(movies);
        }
      }
    } catch (_) {}
    finally { setPopularMoviesLoading(false); }
  }, [popularMovies.length]);

  // Send a command to the YouTube player using two independent channels:
  //   1. The YT.Player JS API (may be gated behind onReady)
  //   2. Raw postMessage directly to the iframe (bypasses the ready-gate entirely)
  // Using both guarantees the command reaches the player even when the YT.Player
  // ready-gate has stalled (common in deeply-nested iframe environments like Replit).
  const sendYtCommand = useCallback((funcName: string, args: any[] = []) => {
    // Channel 1 — YT.Player API
    const player = youtubePlayerRef.current;
    if (player) {
      try { (player as any)[funcName]?.(...args); } catch (_) {}
    }
    // Channel 2 — direct postMessage to the YouTube iframe (check both full and mini containers)
    const iframe = ytIframeDirectRef.current
      ?? (ytContainerRef.current?.querySelector("iframe") as HTMLIFrameElement | null)
      ?? (ytMiniContainerRef.current?.querySelector("iframe") as HTMLIFrameElement | null);
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: funcName, args }),
          "*"
        );
      } catch (_) {}
    }
  }, []);

  // Independent playback: play / pause / seek operate only on this user's local
  // YouTube player. Nothing is broadcast to other participants, so each user has
  // full local control without affecting anyone else.
  const handleYtPlayPause = useCallback(() => {
    const willPause = ytIsPlaying;
    setYtIsPlaying(!willPause);
    sendYtCommand(willPause ? "pauseVideo" : "playVideo");
  }, [ytIsPlaying, sendYtCommand]);

  const handleYtSeek = useCallback((seconds: number) => {
    setYtCurrentTime(seconds);
    setYtSeekDragging(false);
    sendYtCommand("seekTo", [seconds, true]);
    // Host broadcasts seek so watchers jump to same position
    if (socket && user?.id === youtubeStartedByRef.current) {
      socket.emit("room:youtube-state", { roomId: room.id, action: "seek", time: seconds, ts: Date.now() });
    }
  }, [sendYtCommand, socket, user, room.id]);

  const handleYtVolume = useCallback((vol: number) => {
    setYtVolume(vol);
    if (vol === 0) {
      sendYtCommand("mute");
    } else {
      sendYtCommand("unMute");
      sendYtCommand("setVolume", [vol]);
    }
  }, [sendYtCommand]);

  const handleParticipantClick = (peerId: string) => {
    const isClickingOther = peerId !== user?.id;

    // If the clicked participant is currently playing chess (and we're not them and not seated),
    // open the centered chess overlay so we can spectate the game.
    const isChessPlayer = peerId === chessSeatedIds.white || peerId === chessSeatedIds.black;
    const meSeated = user?.id === chessSeatedIds.white || user?.id === chessSeatedIds.black;
    const liveGame = chessSeatedIds.status === "playing" || chessSeatedIds.status === "ended";
    if (isClickingOther && isChessPlayer && liveGame && !meSeated) {
      setChessSpectatorOpen(true);
      return;
    }



    // If the clicked participant is sharing their screen, open the screen
    // viewer for me — same one-tap flow as joining a YouTube watch party.
    // Tapping the same person again toggles the viewer back off.
    if (isClickingOther && availableScreenUsers.has(peerId) && !isScreenSharing) {
      // If the local user has YouTube open and actively chooses to watch
      // someone's screen, hide their YouTube panel so the screen is visible.
      // YouTube keeps playing for everyone else — this is purely a local view switch.
      if (activeYoutubeId && (showYoutube || miniPlayerMode)) {
        setShowYoutube(false);
        setMiniPlayerMode(false);
      }
      handleWatchScreen(peerId);
      return;
    }

    // If the clicked participant has their camera on, expand it like YouTube view
    if (isClickingOther && availableVideoUsers.has(peerId) && !activeYoutubeId && !isScreenSharing && !remoteScreenShareUserId) {
      const stream = remoteVideoStreams.current.get(peerId);
      if (remoteVideoUserId === peerId) {
        setRemoteVideoUserId(null);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      } else {
        setRemoteVideoUserId(peerId);
        if (stream && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      }
      return;
    }

    // If the clicked participant is hosting a YouTube video and we're not
    // watching anyone yet, tap-to-join their watch party just like book/screen.
    if (isClickingOther && youtubeHosts.has(peerId) && !activeYoutubeId && !remoteScreenShareUserId) {
      handleJoinYoutubeParty(peerId);
      return;
    }

    // If the clicked participant is hosting a movie and we're not already watching
    // it, join the movie party — same one-tap pattern as YouTube / book / screen.
    if (isClickingOther && movieHosts.has(peerId) && !showMovie) {
      const info = movieHosts.get(peerId);
      if (info) {
        // Prefer server-computed currentTime; fall back to elapsed since startedAt
        const _serverTime = movieCurrentTimeByHost.get(peerId);
        const _startedAt = movieHostStartedAt.get(peerId);
        const _offset = typeof _serverTime === "number"
          ? Math.floor(_serverTime)
          : (_startedAt ? Math.floor((Date.now() - _startedAt) / 1000) : 0);
        setShowYoutube(false);
        setMiniPlayerMode(false);
        setActiveMovieId(info.movieId);
        setActiveMovieTitle(info.movieTitle);
        setActiveMoviePoster(info.posterPath);
        setMovieStartedBy(peerId);
        setMovieStartOffset(_offset);
        setMovieSyncKey(k => k + 1);
        setShowMovie(true);
        socket?.emit("room:movie-watching", { roomId: room.id, hostId: peerId, watching: true });
      }
      return;
    }

    if (activeYoutubeId) {
      const isBroadcaster = user?.id === youtubeStartedBy;
      const clickedBroadcaster = peerId === youtubeStartedBy;
      const clickedWatcher = youtubeWatchers.has(peerId);

      if (!showYoutube) {
        if (clickedBroadcaster || clickedWatcher) {
          if (showEReader || selectedBook) {
            handleCloseBook();
          }
          setShowYoutube(true);
        } else {
          setFocusedUserId(prev => prev === peerId ? null : peerId);
        }
        return;
      }

      if (isBroadcaster) {
        if (!clickedBroadcaster) {
          setShowYoutube(false);
          setMiniPlayerMode(true);
          setFocusedUserId(peerId);
        }
        return;
      }

      // Watcher: keep video alive in mini-player while they look at someone else.
      setShowYoutube(false);
      setMiniPlayerMode(true);
      if (!clickedBroadcaster) {
        setFocusedUserId(peerId);
      }
      return;
    }

    if (isVideoOn && isClickingOther) {
      const newFocus = focusedUserId === peerId ? null : peerId;
      setFocusedUserId(newFocus);
      setMiniCameraMode(!!newFocus);
      return;
    }

    // Clicking your own card while watching a movie (as a watcher, not host)
    // closes the movie just for you — same as pressing the X button.
    if (!isClickingOther && activeMovieId && showMovie && user?.id !== movieStartedBy) {
      setShowMovie(false);
      setActiveMovieId(null);
      setMovieStartedBy(null);
      socket?.emit("room:movie-watching", { roomId: room.id, hostId: movieStartedBy, watching: false });
      return;
    }

    setFocusedUserId(prev => prev === peerId ? null : peerId);
  };

  const handleExpandMiniPlayer = () => {
    setMiniPlayerMode(false);
    setShowYoutube(true);
    setFocusedUserId(null);
  };

  const handleWatchVideo = (peerId: string) => {
    if (remoteVideoUserId === peerId) {
      setRemoteVideoUserId(null);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    } else {
      const stream = remoteVideoStreams.current.get(peerId);
      setRemoteVideoUserId(peerId);
      if (stream && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    }
  };

  const handleWatchScreen = (peerId: string) => {
    if (remoteScreenShareUserId === peerId) {
      setRemoteScreenShareUserId(null);
      if (remoteScreenRef.current) remoteScreenRef.current.srcObject = null;
      socket?.emit("room:screen-watching", { roomId: room.id, watching: false, sharerId: peerId });
    } else {
      // If we were already watching someone else, mark ourselves no longer watching them.
      if (remoteScreenShareUserId) {
        socket?.emit("room:screen-watching", { roomId: room.id, watching: false, sharerId: remoteScreenShareUserId });
      }
      const stream = remoteScreenStreams.current.get(peerId);
      setRemoteScreenShareUserId(peerId);
      if (stream && remoteScreenRef.current) {
        remoteScreenRef.current.srcObject = stream;
      }
      socket?.emit("room:screen-watching", { roomId: room.id, watching: true, sharerId: peerId });
    }
  };

  const handleTransferHost = (newOwnerId: string) => {
    socket?.emit("room:transfer-host", {
      roomId: room.id,
      newOwnerId,
      currentOwnerId: user?.id,
    });
  };

  const handleNominateHost = (nomineeId: string) => {
    if (!user) return;
    socket?.emit("room:nominate-host", {
      roomId: room.id,
      nominatorId: user.id,
      nomineeId,
    });
  };

  const handleWatchYoutube = () => {
    setShowYoutube((prev) => !prev);
  };

  // Auto-watch: if the room was opened with ?watch=<userId>, automatically
  // join that user's YouTube party once their host slot becomes visible.
  const autoWatchedRef = useRef(false);
  useEffect(() => {
    if (!watchUserId || autoWatchedRef.current || !user || watchUserId === user.id) return;
    const videoId = youtubeHosts.get(watchUserId);
    if (!videoId) return;
    autoWatchedRef.current = true;
    handleJoinYoutubeParty(watchUserId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchUserId, youtubeHosts, user]);

  // Join a specific host's YouTube watch party from their participant card.
  const handleJoinYoutubeParty = useCallback((hostPeerId: string) => {
    const videoId = youtubeHosts.get(hostPeerId);
    if (!videoId || !socket || !user) return;
    // If already watching this host, just show the panel.
    if (youtubeStartedByRef.current === hostPeerId) {
      setShowYoutube(true);
      setShowMovie(false);
      return;
    }
    // Leave any previous watch party.
    const prevHost = youtubeStartedByRef.current;
    if (prevHost && prevHost !== user.id) {
      socket.emit("room:youtube-watching", { roomId: room.id, hostId: prevHost, watching: false });
    }
    setShowMovie(false);
    setYoutubeStartedBy(hostPeerId);
    setActiveYoutubeId(videoId);
    setShowYoutube(true);
    setUserDismissedYoutube(false);
    setMyYtVote(null);
    setMyYtSkipVote(false);
    setYtVotes({ likes: 0, dislikes: 0, skip: 0, watchers: 0 });
    socket.emit("room:youtube-watching", { roomId: room.id, hostId: hostPeerId, watching: true });
    // Request a time sync so we start near where the host is.
    setTimeout(() => {
      socket?.emit("room:youtube-time-request", { roomId: room.id, hostId: hostPeerId, requesterId: user.id });
    }, 800);
  }, [socket, user, room.id, youtubeHosts]);

  const mentionFilteredParticipants = mentionQuery !== null
    ? participants.filter((p) => {
        const name = getUserDisplayName(p).toLowerCase();
        return name.includes(mentionQuery.toLowerCase());
      })
    : [];

  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const [showMentionsOnly, setShowMentionsOnly] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);

  const isMentionedInMessage = useCallback((text: string) => {
    if (!user) return false;
    const names = [
      user.firstName,
      user.lastName,
      user.displayName,
      user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null,
    ].filter(Boolean) as string[];
    return names.some(name =>
      text.includes(`@[${name}]`) || text.toLowerCase().includes(`@${name.toLowerCase().replace(/\s+/g, "")}`)
    );
  }, [user]);

  const handleScroll = useCallback(() => {
    if (chatScrollRef.current) {
      const viewport = chatScrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const { scrollTop, scrollHeight, clientHeight } = viewport;
        const atBottom = scrollHeight - scrollTop <= clientHeight + 50;
        isAtBottomRef.current = atBottom;
        setIsAtBottom(atBottom);
        if (atBottom) {
          setUnreadCount(0);
        }
      }
    }
  }, []);

  useEffect(() => {
    const viewport = chatScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [handleScroll, sidePanelTab, sidePanelOpen, mobileSheetOpen]);

  useEffect(() => {
    if (chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    const isOwnMessage = lastMsg.userId === user?.id;
    const viewport = chatScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;
    if (isAtBottomRef.current || isOwnMessage) {
      viewport.scrollTop = viewport.scrollHeight;
      setUnreadCount(0);
      if (!isAtBottomRef.current && isOwnMessage) {
        isAtBottomRef.current = true;
        setIsAtBottom(true);
      }
    } else if (lastMsg.type !== "system") {
      setUnreadCount(prev => prev + 1);
    }
  }, [chatMessages, user?.id]);

  const scrollToBottom = useCallback(() => {
    const viewport = chatScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      setUnreadCount(0);
      setIsAtBottom(true);
    }
  }, []);

  const scrollToMessage = useCallback((msgId: string) => {
    const viewport = chatScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const target = chatScrollRef.current?.querySelector(`[data-testid="room-chat-${msgId}"]`) as HTMLElement | null;
    if (!viewport || !target) return;
    const targetOffsetTop = target.offsetTop - viewport.offsetTop;
    const centerOffset = targetOffsetTop - viewport.clientHeight / 2 + target.clientHeight / 2;
    viewport.scrollTo({ top: Math.max(0, centerOffset), behavior: 'smooth' });
    setHighlightedMsgId(msgId);
    setTimeout(() => setHighlightedMsgId(null), 2200);
  }, []);

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setChatText(val);
    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
    // Word alternatives — debounced 150ms so it never blocks the keystroke render loop
    const altCursorPos = (e.target as HTMLTextAreaElement)?.selectionStart ?? val.length;
    if (wordAltTimerRef.current) clearTimeout(wordAltTimerRef.current);
    if (val.trim().length >= 2) {
      wordAltTimerRef.current = setTimeout(() => {
        const altInfo = getWordAlternatives(val, altCursorPos);
        setWordAltInfo(altInfo);
      }, 150);
    } else {
      setWordAltInfo(null);
    }
    // Real-time grammar check — debounced 800ms, returns all ranked suggestions
    if (grammarTimerRef.current) clearTimeout(grammarTimerRef.current);
    if (val.trim().length >= 3) {
      grammarTimerRef.current = setTimeout(() => {
        const suggestions = checkGrammarAll(val);
        setGrammarSuggestions(suggestions);
    
    if (suggestions.length > 0) setGrammarDismissedIds(new Set());
      }, 800);
    } else {
      setGrammarSuggestions([]);
      setGrammarDismissedIds(new Set());
    }
    // Emit typing signal — throttled to at most once per 2 s while typing,
    // immediately stopped when the input is cleared.
    if (socket && user) {
      if (val.trim()) {
        if (!typingEmitTimerRef.current) {
          socket.emit("room:typing", {
            roomId: room.id,
            userId: user.id,
            displayName: getUserDisplayName(user),
            profileImageUrl: (user as any).profileImageUrl ?? null,
          });
          typingEmitTimerRef.current = setTimeout(() => {
            typingEmitTimerRef.current = null;
          }, 2000);
        }
      } else {
        if (typingEmitTimerRef.current) {
          clearTimeout(typingEmitTimerRef.current);
          typingEmitTimerRef.current = null;
        }
        socket.emit("room:typing-stop", { roomId: room.id, userId: user.id });
      }
    }
    // Auto-translate preview — debounced 900ms so it doesn't fire on every keystroke
    if (autoTranslateTimerRef.current) clearTimeout(autoTranslateTimerRef.current);
    if (autoTranslate && val.trim().length >= 2) {
      setIsAutoTranslating(true);
      autoTranslateTimerRef.current = setTimeout(async () => {
        const translated = await translateToEnglish(val);
        setAutoTranslatePreview(translated !== val.trim() ? translated : null);
        setIsAutoTranslating(false);
      }, 900);
    } else {
      setAutoTranslatePreview(null);
      setIsAutoTranslating(false);
    }
  };

  const insertMention = (p: Participant) => {
    const name = getUserDisplayName(p);
    const cursorPos = chatInputRef.current?.selectionStart || chatText.length;
    const textBeforeCursor = chatText.slice(0, cursorPos);
    const textAfterCursor = chatText.slice(cursorPos);
    const beforeAt = textBeforeCursor.replace(/@(\w*)$/, "");
    const newText = `${beforeAt}@[${name}] ${textAfterCursor}`;
    setChatText(newText);
    setMentionQuery(null);
    chatInputRef.current?.focus();
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionFilteredParticipants.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => Math.min(prev + 1, mentionFilteredParticipants.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionFilteredParticipants[mentionIndex]);
      } else if (e.key === "Escape") {
        setMentionQuery(null);
      }
    }
  };

  const chatPermission = ((room as any).chatPermission as "everyone" | "members" | "co_owners" | "owner_only" | undefined) || "everyone";
  const isChatBlocked = (() => {
    if (isHost) return false;
    if (chatPermission === "everyone") return false;
    if (chatPermission === "members") return isGuestOrTroll;
    if (chatPermission === "co_owners") return myRole !== "co-owner";
    if (chatPermission === "owner_only") return true;
    return false;
  })();
  const chatBlockReason = (() => {
    if (!isChatBlocked) return "";
    if (chatPermission === "owner_only") return "Only the host can send messages in this room.";
    if (chatPermission === "co_owners") return "Only the host and co-hosts can send messages.";
    if (chatPermission === "members") return "Guests and trolls cannot send messages in this room.";
    return "Chat is restricted in this room.";
  })();

  const translateToEnglish = async (text: string): Promise<string> => {
    const clean = text.trim();
    if (!clean || clean.length < 2) return clean;
    const target = autoTranslateTargetRef.current || "en";
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=autodetect|${target}`
      );
      const data = await res.json();
      const translated: string = data.responseData?.translatedText || clean;
      // MyMemory returns this error when source === target (e.g. typing English → translate to English)
      if (translated.toUpperCase().includes("PLEASE SELECT") || translated.trim() === clean.trim()) return clean;
      return translated;
    } catch {
      return clean;
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mentionQuery !== null && mentionFilteredParticipants.length > 0) {
      insertMention(mentionFilteredParticipants[mentionIndex]);
      return;
    }
    if (!chatText.trim() || !socket || !user) return;
    if (isChatBlocked) {
      toast({ variant: "destructive", title: "Chat restricted", description: chatBlockReason, duration: 3000 });
      return;
    }
    if (isTroll && chatText.trim().length > TROLL_MAX_CHARS) {
      toast({ variant: "destructive", title: "🧌 Troll Restriction", description: `Messages limited to ${TROLL_MAX_CHARS} characters.`, duration: 2500 });
      return;
    }
    // Stop typing indicator immediately when the message is sent
    if (typingEmitTimerRef.current) {
      clearTimeout(typingEmitTimerRef.current);
      typingEmitTimerRef.current = null;
    }
    socket.emit("room:typing-stop", { roomId: room.id, userId: user.id });

    let textToSend = chatText.trim();
    if (autoTranslate) {
      if (autoTranslateTimerRef.current) clearTimeout(autoTranslateTimerRef.current);
      setAutoTranslatePreview(null);
      setIsAutoTranslating(true);
      try {
        textToSend = await translateToEnglish(textToSend);
      } finally {
        setIsAutoTranslating(false);
      }
    }

    socket.emit("room:chat", {
      roomId: room.id,
      userId: user.id,
      text: textToSend,
      messageColor: chatMessageColor,
      cardColor: chatCardColor,
      privateToId: privateChatToId === "public" ? null : privateChatToId,
      replyTo: replyingTo || undefined,
    });
    import("@/lib/sound-fx").then((s) => s.sfxSend()).catch(() => {});
    setChatText("");
    setAutoTranslatePreview(null);
    setMentionQuery(null);
    setReplyingTo(null);
  };

  const handleReact = (messageId: string, emoji: string) => {
    if (!socket || !user) return;
    socket.emit("room:react", { roomId: room.id, messageId, emoji });
    import("@/lib/sound-fx").then((s) => s.sfxLike()).catch(() => {});
  };

  const avatarGradients = [
    "from-amber-500 to-orange-700",
    "from-orange-500 to-amber-700",
    "from-yellow-600 to-orange-700",
    "from-amber-600 to-yellow-800",
    "from-orange-600 to-red-800",
    "from-amber-700 to-orange-900",
    "from-yellow-500 to-amber-700",
    "from-orange-400 to-amber-600",
  ];

  const getAvatarGradient = (index: number) => avatarGradients[index % avatarGradients.length];

  const extractYtId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const buildYtEmbed = (id: string) =>
    `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0`;

  const handleEditRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Card background editing has moved to the lobby room card. In-room
    // settings only manage live theme/animations and host control permissions.
    updateRoomMutation.mutate({
      title: editTitle.trim(),
      language: editLanguage,
      level: editLevel,
      maxUsers: editMaxUsers,
      roomTheme: editRoomTheme,
      isPublic: editIsPublic,
      hologramVideoUrl: editHologramUrl,
      talkPermission: editTalkPermission,
      cameraPermission: editCameraPermission,
      screenPermission: editScreenPermission,
      youtubePermission: editYoutubePermission,
      chatPermission: editChatPermission,
    });
  };

  const handleEditHologramFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File too large", description: "Pick a file under 25 MB.", variant: "destructive" });
      return;
    }
    setEditHologramUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", file);
      const res = await fetch("/api/upload/hologram", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upload failed");
      setEditHologramUrl(data.url);
      setEditHologramKind(file.type.startsWith("video/") ? "video" : file.type === "image/gif" ? "gif" : "image");
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setEditHologramUploading(false);
    }
  };

  const languages = LANGUAGES.filter((l) => l !== "All");

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  };

  const loadDefaultBooks = async () => {
    if (readLoading) return;
    /* 1. Seed with instant classics — zero latency, shown immediately */
    if (readBooks.length === 0) {
      if (_cachedDefaultBooks && Date.now() - _cachedDefaultBooksTs < DEFAULT_BOOKS_TTL) {
        setReadBooks(_cachedDefaultBooks);
        setReadCatalog([]); setReadAudiobooks([]); setReadVideos([]);
        return;
      }
      setReadBooks(INSTANT_BOOKS as any[]);
      setReadCatalog([]); setReadAudiobooks([]); setReadVideos([]);
    }
    /* 2. Fetch Gutenberg API in background to get richer/updated list */
    try {
      const res = await fetch(`/api/library/search`, { credentials: "include" });
      const data = await res.json();
      const apiBooks = data.books || [];
      if (apiBooks.length > 0) {
        _cachedDefaultBooks = apiBooks;
        _cachedDefaultBooksTs = Date.now();
        setReadBooks(apiBooks);
      }
    } catch { /* silently keep the instant list */ }
  };

  const loadSavedArticles = async () => {
    if (savedArticlesLoaded) return;
    try {
      const res = await fetch("/api/saved-articles", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSavedArticles(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ } finally { setSavedArticlesLoaded(true); }
  };

  const saveCurrentArticle = async () => {
    if (!selectedBook || !bookText || savingArticle) return;
    setSavingArticle(true);
    try {
      const res = await fetch("/api/saved-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: selectedBook.title,
          content: bookText,
          source: "youtube",
          sourceUrl: selectedBook.videoId ? `https://www.youtube.com/watch?v=${selectedBook.videoId}` : null,
          videoId: selectedBook.videoId || null,
          thumbnailUrl: currentYtThumbnail || null,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setSavedArticles(prev => [saved, ...prev]);
        setArticleSaved(true);
      }
    } catch { /* silent */ } finally { setSavingArticle(false); }
  };

  const deleteSavedArticle = async (id: string) => {
    try {
      await fetch(`/api/saved-articles/${id}`, { method: "DELETE", credentials: "include" });
      setSavedArticles(prev => prev.filter(a => a.id !== id));
    } catch { /* silent */ }
  };

  const handleYtToArticle = async (videoId: string, durationStr = "", sourceId?: string) => {
    if (!videoId) return;

    // Warn the user if the video is long before starting
    if (durationStr) {
      const parts = durationStr.split(":").map(Number).reverse();
      const totalMins = (parts[2] || 0) * 60 + (parts[1] || 0) + (parts[0] || 0) / 60;
      if (totalMins > 20) {
        toast({
          title: "Long video detected",
          description: `"${durationStr}" — extracting the transcript may take up to 30 seconds. Starting now…`,
          duration: 8000,
        });
      }
    }

    setYtArticleLoading(true);
    setYtArticleError("");
    setYtConvertStep(1);
    setYtConvertingId(sourceId || videoId);
    setArticleSaved(false);
    setCurrentYtThumbnail(null);

    // Simulate visible preparation steps so the user sees progress
    const step2Timer = setTimeout(() => setYtConvertStep(2), 900);
    const step3Timer = setTimeout(() => setYtConvertStep(3), 2200);

    try {
      const res = await fetch(`/api/yt-to-article?url=${encodeURIComponent(videoId)}`, { credentials: "include" });
      const data = await res.json();
      clearTimeout(step2Timer); clearTimeout(step3Timer);
      if (!res.ok) {
        setYtArticleError(data.message || "Could not extract article");
        setYtConvertStep(0);
        return;
      }
      setYtConvertStep(3);
      await new Promise(r => setTimeout(r, 400));

      const thumb = data.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      setCurrentYtThumbnail(thumb);
      const bookObj = { title: data.title, authors: [{ name: "YouTube" }], _isYtArticle: true, videoId, thumbnailUrl: thumb };
      setSelectedBook(bookObj);
      setBookText(data.text);
      setCurrentPage(1);
      setWordInfo(null);
      setShowEReader(true);
      setYtReadResults([]);
      setYtReadSearch("");
      setYtDirectUrl("");
      setYtConvertStep(0);

      // Share article with the room so others can join reading
      if (activeYoutubeId) handleStopYoutube();
      socket?.emit("room:book", { roomId: room.id, book: bookObj });
      setBookReaders(prev => { const n = new Set(prev); n.add(user?.id || ""); return n; });
      setBookHostId(user?.id || null);
    } catch {
      clearTimeout(step2Timer); clearTimeout(step3Timer);
      setYtArticleError("Failed to connect. Please try again.");
      setYtConvertStep(0);
    }
    finally { setYtArticleLoading(false); setYtConvertingId(null); }
  };

  const searchYtRead = async (q: string) => {
    if (!q.trim()) { setYtReadResults([]); return; }
    setYtReadSearchLoading(true);
    setYtArticleError("");
    // Always surface results in the library tab
    setLibraryTab("library");
    try {
      const res = await fetch(`/api/youtube/read-search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (!res.ok) {
        setYtArticleError("YouTube search failed. Please try again.");
        setYtReadResults([]);
        return;
      }
      const data = await res.json();
      const results = Array.isArray(data) ? data.slice(0, 8) : [];
      setYtReadResults(results);
      if (results.length === 0) {
        setYtArticleError("No videos found for that search. Try different keywords.");
      }
    } catch {
      setYtReadResults([]);
      setYtArticleError("Could not reach YouTube. Check your connection and try again.");
    }
    finally { setYtReadSearchLoading(false); }
  };

  const loadDiscovery = async () => {
    if (discoveryBooks.length > 0 || discoveryLoading) return;
    setDiscoveryLoading(true);
    try {
      /* Fetch popular books and audiobooks in parallel */
      const [booksRes, audioRes] = await Promise.all([
        fetch(`/api/library/search`, { credentials: "include" }),
        fetch(`/api/library/search?q=classic+literature`, { credentials: "include" }),
      ]);
      const [booksData, audioData] = await Promise.all([booksRes.json(), audioRes.json()]);
      setDiscoveryBooks((booksData.books || []).slice(0, 6));
      setDiscoveryAudiobooks((audioData.audiobooks || []).slice(0, 4));
    } catch { /* silent — UI stays empty */ } finally { setDiscoveryLoading(false); }
  };

  const searchGutenberg = async (query: string) => {
    if (!query.trim()) {
      setReadBooks([]);
      setReadCatalog([]);
      setReadAudiobooks([]);
      setReadVideos([]);
      return;
    }
    setReadLoading(true);
    try {
      const res = await fetch(`/api/library/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      const data = await res.json();
      const books = data.books || [];
      const audiobooks = data.audiobooks || [];
      const videos = data.videos || [];
      // If the search returned nothing at all, fall back to popular books so the
      // view is never empty — clear the search term so the "Popular Classics" heading shows.
      if (books.length === 0 && audiobooks.length === 0 && videos.length === 0) {
        setReadBooks([]);
        setReadCatalog([]);
        setReadAudiobooks([]);
        setReadVideos([]);
        setReadSearch("");
        // loadDefaultBooks guard checks readBooks.length > 0; reset it first then call
        const fallbackRes = await fetch(`/api/library/search`, { credentials: "include" });
        const fallbackData = await fallbackRes.json();
        setReadBooks(fallbackData.books || []);
        setReadCatalog([]);
        setReadAudiobooks([]);
        setReadVideos([]);
      } else {
        setReadBooks(books);
        setReadCatalog(data.openLibrary || []);
        setReadAudiobooks(audiobooks);
        setReadVideos(videos);
      }
    } catch {
      setReadBooks([]); setReadCatalog([]); setReadAudiobooks([]); setReadVideos([]);
    } finally { setReadLoading(false); }
  };

  const saveToReadingHistory = (book: any) => {
    const entry = {
      id: book._isYtArticle ? `yt-${book.videoId || book.title}` : String(book.id),
      title: book.title,
      author: book.authors?.map((a: any) => a.name).join(", ") || "",
      coverUrl: book.formats?.["image/jpeg"] || book.thumbnailUrl || null,
      lastReadAt: new Date().toISOString(),
      formats: book.formats || undefined,
      _isYtArticle: book._isYtArticle || false,
      videoId: book.videoId || null,
      thumbnailUrl: book.thumbnailUrl || null,
    };
    setReadingHistory(prev => {
      const filtered = prev.filter(h => h.id !== entry.id);
      const updated = [entry, ...filtered].slice(0, 20);
      try { localStorage.setItem("vextorn_reading_history", JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const loadBookText = async (book: any, fromShared = false) => {
    if (activeYoutubeId) {
      handleStopYoutube();
    }
    setSelectedBook(book);
    setBookText("");
    setCurrentPage(1);
    setWordInfo(null);
    setBookLoading(true);
    setShowEReader(true);
    if (!fromShared) saveToReadingHistory(book);
    if (!fromShared) {
      socket?.emit("room:book", { roomId: room.id, book });
      setBookReaders(prev => { const n = new Set(prev); n.add(user?.id || ""); return n; });
      setBookHostId(user?.id || null);
    }
    try {
      // Bug 3 fix: YT article books (converted by any user) have _isYtArticle: true
      // and no `formats` field — fetch the transcript via the same API endpoint
      // that the converting user used, so watchers who join mid-session can load it.
      if (book._isYtArticle && book.videoId) {
        const res = await fetch(`/api/yt-to-article?url=${encodeURIComponent(book.videoId)}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Could not load article");
        if (!data.text) throw new Error("No content in article");
        setBookText(data.text);
      } else {
        const formats = book.formats || {};
        const textUrl =
          formats["text/plain; charset=utf-8"] ||
          formats["text/plain; charset=us-ascii"] ||
          formats["text/plain"];
        if (!textUrl) throw new Error("No text URL available for this book.");
        const res = await fetch(`/api/book/text?url=${encodeURIComponent(textUrl)}`, { credentials: "include" });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const rawText = await res.text();
        if (!rawText || rawText.length < 50) throw new Error("Empty response from server");
        let startIdx = 0;
        const startMarker = rawText.indexOf("*** START OF");
        if (startMarker > -1) {
          const lineEnd = rawText.indexOf("\n", startMarker);
          startIdx = lineEnd > -1 ? lineEnd + 1 : startMarker;
          const extraNewlines = rawText.slice(startIdx).match(/^[\r\n]*/)?.[0].length ?? 0;
          startIdx += extraNewlines;
        } else {
          const altMarker = rawText.indexOf("***\r\n\r\n");
          if (altMarker > -1) startIdx = altMarker + 6;
        }
        const extracted = rawText.slice(startIdx, startIdx + 20000).trim();
        if (!extracted) throw new Error("No readable text found after header");
        setBookText(extracted);
      }
    } catch (err: any) {
      setBookText("Could not load this book. Please try another title.");
    } finally {
      setBookLoading(false);
    }
  };

  const handleJoinReadTogether = async (book: any) => {
    setIsFollowingBook(true);
    setBookReaders(prev => { const n = new Set(prev); n.add(user?.id || ""); return n; });
    socket?.emit("room:book-watching", { roomId: room.id, watching: true });
    await loadBookText(book, true);
  };

  const goToPage = useCallback((page: number) => {
    if (!bookPages.length) return;
    const p = Math.max(1, Math.min(bookPages.length, page));
    setCurrentPage(p);
    if (bookHostId === user?.id && socket) {
      socket.emit("room:book-scroll", { roomId: room.id, page: p });
    }
  }, [bookPages.length, bookHostId, user?.id, socket, room.id]);

  // Bug 2 fix: when bookPages is recomputed (new book loaded or font size changed),
  // clamp currentPage to valid bounds. This handles the race where a watcher receives
  // a room:book-scroll event BEFORE their bookText has finished loading — the socket
  // sets currentPage to e.g. 5, but bookPages only has 3 pages once text arrives.
  useEffect(() => {
    if (bookPages.length > 0 && currentPage > bookPages.length) {
      setCurrentPage(bookPages.length);
    }
  }, [bookPages.length]); // intentionally omit currentPage to avoid a re-render loop

  useEffect(() => {
    if (!showEReader) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goToPage(currentPage + 1);
      if (e.key === "ArrowLeft"  || e.key === "PageUp")   goToPage(currentPage - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEReader, currentPage, goToPage]);

  const handleCloseBook = () => {
    setSelectedBook(null);
    setBookText("");
    setCurrentPage(1);
    setWordInfo(null);
    setShowEReader(false);
    const amIBookHost = bookHostId === user?.id;
    if (amIBookHost) {
      socket?.emit("room:book", { roomId: room.id, book: null });
      setBookReaders(new Set());
      setBookHostId(null);
    } else {
      // Always notify the server when a non-host closes the reader.
      // The old `if (isFollowingBook)` gate caused the emit to be skipped
      // whenever isFollowingBook was stale (e.g. a new session had started
      // mid-session), leaving this user's badge visible on everyone else's
      // client until they disconnected from the room entirely.
      socket?.emit("room:book-watching", { roomId: room.id, watching: false });
      setIsFollowingBook(false);
      setBookReaders(prev => { const n = new Set(prev); n.delete(user?.id || ""); return n; });
    }
  };

  const handleOpenAudiobook = async (audiobook: any) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    setAudioPlayer({ book: audiobook, chapters: [], chapterIdx: 0, loading: true });
    try {
      const archiveId = audiobook.archiveId;
      if (archiveId) {
        const res = await fetch(`/api/audiobook/chapters?id=${encodeURIComponent(archiveId)}`, { credentials: "include" });
        const data = await res.json();
        if (data.chapters?.length > 0) {
          setAudioPlayer(prev => prev ? { ...prev, chapters: data.chapters, loading: false } : null);
          return;
        }
      }
      setAudioPlayer(prev => prev ? { ...prev, loading: false } : null);
    } catch {
      setAudioPlayer(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const handleAudioChapter = (idx: number) => {
    setAudioPlayer(prev => prev ? { ...prev, chapterIdx: idx } : null);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
      }
    }, 50);
  };

  const handleOpenCatalogBook = async (catalogBook: any) => {
    if (activeYoutubeId) handleStopYoutube();
    setSelectedBook({ ...catalogBook, _isCatalog: true });
    setBookText("");
    setWordInfo(null);
    setBookLoading(true);
    setShowEReader(true);
    try {
      const title = encodeURIComponent(catalogBook.title || "");
      const author = encodeURIComponent(catalogBook.author || "");
      const findRes = await fetch(`/api/book/find-text?title=${title}&author=${author}`, { credentials: "include" });
      if (findRes.ok) {
        const findData = await findRes.json();
        if (findData.found && findData.source === "gutenberg" && findData.book) {
          const gutBook = findData.book;
          setSelectedBook({ ...gutBook, _isCatalog: false });
          const formats = gutBook.formats || {};
          const textUrl = formats["text/plain; charset=utf-8"] || formats["text/plain; charset=us-ascii"] || formats["text/plain"];
          if (textUrl) {
            const textRes = await fetch(`/api/book/text?url=${encodeURIComponent(textUrl)}`);
            if (textRes.ok) {
              const text = await textRes.text();
              const startIdx = text.indexOf("*** START OF") > -1
                ? text.indexOf("\n", text.indexOf("*** START OF")) + 1
                : text.indexOf("***\r\n\r\n") > -1 ? text.indexOf("***\r\n\r\n") + 6 : 0;
              setBookText(text.slice(startIdx, startIdx + 12000));
              setBookLoading(false);
              return;
            }
          }
        }
        if (findData.found && findData.source === "wikisource" && findData.wikisourceTitle) {
          const wsRes = await fetch(`/api/book/wikisource?title=${encodeURIComponent(findData.wikisourceTitle)}`);
          if (wsRes.ok) {
            const text = await wsRes.text();
            setBookText(text);
            setBookLoading(false);
            return;
          }
        }
      }
      setBookText(
        `"${catalogBook.title}"` +
        (catalogBook.author ? `\nby ${catalogBook.author}` : "") +
        (catalogBook.year ? `  (${catalogBook.year})` : "") +
        `\n\n─────────────────────────\n\n` +
        `This title is not available as free text in our library.\n\n` +
        `It may be available through:\n` +
        `  • Your local public library\n` +
        `  • An online lending service (e.g. Open Library borrow)\n` +
        `  • Purchase from a bookstore\n\n` +
        `Tip: search for a similar public-domain title using the search bar above.`
      );
    } catch {
      setBookText("Could not look up this book. Please try again.");
    } finally {
      setBookLoading(false);
    }
  };

  const handleTextTranslate = async (text: string) => {
    const clean = text.trim().replace(/\s+/g, " ");
    if (!clean || clean.length < 2) return;
    setWordInfo({ word: clean, translation: "" });
    setTranslating(true);
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|${translationLang}`);
      const data = await res.json();
      const translated = data.responseData?.translatedText || clean;
      setWordInfo({ word: clean, translation: translated });
    } catch { setWordInfo({ word: clean, translation: "(unavailable)" }); }
    finally { setTranslating(false); }
  };

  const handleReaderMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length >= 2) {
      handleTextTranslate(text);
    }
  };

  const speakWord = (word: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(word);
      utter.lang = "en-US";
      window.speechSynthesis.speak(utter);
    }
  };

  const currentTheme = (room as any).roomTheme || "none";

  // Only the host drives the disco overlay auto-advance so all clients see
  // the same scene at the same time.  Non-host clients receive room:disco-advance
  // from the server and update their local discoOverlaySceneIdx accordingly.
  const handleDiscoAdvance = isHost && currentTheme === "disco"
    ? () => { socket?.emit("room:disco-advance", { roomId: room.id }); }
    : undefined;

  const handleDiscoGoto = isHost && currentTheme === "disco"
    ? (idx: number) => { socket?.emit("room:disco-goto", { roomId: room.id, sceneIdx: idx }); setDiscoHostPanelOpen(false); }
    : undefined;

  const DISCO_SCENES_LIST = [
    { id: 0, name: "Rainbow Rave",    emoji: "🌈" },
    { id: 1, name: "Red Alert",       emoji: "🔴" },
    { id: 2, name: "Ocean Club",      emoji: "🌊" },
    { id: 3, name: "Purple Rain",     emoji: "💜" },
    { id: 4, name: "Golden Fever",    emoji: "✨" },
    { id: 5, name: "Blackout Strobe", emoji: "⚡" },
    { id: 6, name: "Shadow Dancer",   emoji: "💃" },
  ];

  const sidePanelContent = (
    <div className="flex flex-col h-full">
      {/* ── Tab bar — neumorphic raised tray ──────────────────────────── */}
      <div className="chat-header-tabs shrink-0">
        {/* Chat */}
        <div className="relative">
          <button
            onClick={() => setSidePanelTab("chat")}
            data-testid="tab-chat"
            title="Chat"
            className="room-tab-btn"
            data-accent="primary"
            data-active={sidePanelTab === "chat"}
          >
            <MessageSquare className="w-[20px] h-[20px]" />
          </button>
          {/* General unread badge — only shown when no private unread (private takes priority) */}
          {unreadChatBadge > 0 && privateUnreadCount === 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center leading-none pointer-events-none" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.60), inset 0 1px 0 rgba(255,255,255,0.40)" }}>
              {unreadChatBadge > 99 ? "99+" : unreadChatBadge}
            </span>
          )}
          {/* Private / whisper unread badge — purple, pulsing */}
          {privateUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 animate-pulse bg-purple-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center leading-none pointer-events-none" style={{ boxShadow: "0 0 8px rgba(168,85,247,0.80), inset 0 1px 0 rgba(255,255,255,0.40)" }} title="Unread private messages">
              🔒
            </span>
          )}
        </div>
        {featYoutube && <button onClick={() => setSidePanelTab("youtube")} data-testid="tab-youtube" title="YouTube" className="room-tab-btn" data-accent="youtube" data-active={sidePanelTab === "youtube"}>
          <Youtube className="w-[20px] h-[20px]" />
        </button>}
        {featMovieParty && <button onClick={() => setSidePanelTab("movies")} data-testid="tab-movies" title="Movies" className="room-tab-btn" data-accent="movies" data-active={sidePanelTab === "movies"}>
          <Film className="w-[20px] h-[20px]" />
        </button>}
        {featReadTogether && <button onClick={() => setSidePanelTab("read")} data-testid="tab-read" title="Read" className="room-tab-btn" data-accent="read" data-active={sidePanelTab === "read"}>
          <BookOpen className="w-[20px] h-[20px]" />
        </button>}
        {featGames && <button onClick={() => setSidePanelTab("chess")} data-testid="tab-chess" title="Games" className="room-tab-btn" data-accent="chess" data-active={sidePanelTab === "chess"}>
          <Gamepad2 className="w-[20px] h-[20px]" />
        </button>}
        <button onClick={() => setSidePanelTab("golive")} data-testid="tab-golive" title="Go Live" className="room-tab-btn" data-accent="golive" data-active={sidePanelTab === "golive"}>
          <Radio className="w-[20px] h-[20px]" />
        </button>
        <button onClick={() => setSidePanelTab("people")} data-testid="tab-people" title="People" className="room-tab-btn" data-accent="people" data-active={sidePanelTab === "people"}>
          <UsersRound className="w-[20px] h-[20px]" />
        </button>
      </div>

      <div className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" style={{ display: sidePanelTab === "chat" ? "flex" : "none" }}>
        {/* ── Filter row — All / @Mentions / Welcome / Search ─────────── */}
        <div className="chat-header-filters">
          <button
            onClick={() => setShowMentionsOnly(false)}
            className="room-filter-pill"
            data-active={!showMentionsOnly}
            data-testid="filter-all-messages"
          >
            All
          </button>
          <button
            onClick={() => setShowMentionsOnly(true)}
            className="room-filter-pill"
            data-active={showMentionsOnly}
            data-testid="filter-mentions"
          >
            <AtSign className="w-2.5 h-2.5" /> Mentions
          </button>
          {isHost && (
            <button
              onClick={() => setWelcomeDialogOpen(true)}
              data-testid="button-chat-welcome"
              title={welcomeText ? "Edit welcome message" : "Set welcome message"}
              className="room-welcome-pill ml-auto"
              data-active={!!welcomeText}
            >
              <span className="text-[12px] leading-none">👋</span>
              <span>{welcomeText ? "Welcome" : "Add Welcome"}</span>
            </button>
          )}
          <button
            onClick={() => { setShowChatSearch(s => !s); if (showChatSearch) setChatSearch(""); }}
            className="room-filter-pill"
            data-active={showChatSearch}
            data-testid="button-chat-search-toggle"
            title="Search messages"
            style={{ marginLeft: isHost ? "0" : "auto" }}
          >
            <Search className="w-2.5 h-2.5" />
          </button>
        </div>
        {showChatSearch && (
          <div className="chat-search-bar" data-testid="chat-search-bar">
            <Search className="w-3 h-3 chat-search-icon" />
            <input
              autoFocus
              type="text"
              value={chatSearch}
              onChange={e => setChatSearch(e.target.value)}
              placeholder="Search messages…"
              className="chat-search-input"
              data-testid="input-chat-search"
            />
            {chatSearch && (
              <button
                type="button"
                onClick={() => setChatSearch("")}
                className="chat-search-clear"
                aria-label="Clear search"
                data-testid="button-chat-search-clear"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {/* ── Pinned message banner ─────────────────────────────────────── */}
        {pinnedMessage && (() => {
          const pinAuthorObj = pinnedMessage.message.user || participantById.get(pinnedMessage.message.userId);
          const pinAuthorName = pinAuthorObj
            ? getUserDisplayName(pinAuthorObj)
            : (pinnedMessage.message as any).userName || "Unknown";
          const pinAuthorAvatar = pinAuthorObj?.profileImageUrl;
          const pinAuthorInitial = (pinAuthorName?.[0] || "?").toUpperCase();

          const txt = pinnedMessage.message.text.trim();
          const isGif = txt.startsWith("[gif:") && txt.endsWith("]");
          const isImg = txt.startsWith("[img:") && txt.endsWith("]");
          const isMedia = isGif || isImg;
          const mediaUrl = isGif ? txt.slice(5, -1) : isImg ? txt.slice(5, -1) : null;

          const handleJump = () => {
            const el = document.querySelector(`[data-testid="room-chat-${pinnedMessage.message.id}"]`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("pin-jump-highlight");
              setTimeout(() => el.classList.remove("pin-jump-highlight"), 1400);
            }
          };

          return (
            <div className="chat-pin-banner" data-testid="chat-pinned-banner">
              <div className="chat-pin-icon">📌</div>
              <div className="chat-pin-body" onClick={handleJump}>
                <span className="chat-pin-label">
                  {pinAuthorAvatar ? (
                    <img
                      src={pinAuthorAvatar}
                      alt=""
                      width={14}
                      height={14}
                      className="chat-pin-author-avatar"
                    />
                  ) : (
                    <span className="chat-pin-author-initials">{pinAuthorInitial}</span>
                  )}
                  <span className="chat-pin-author-name">{pinAuthorName}</span>
                  <span className="chat-pin-pinned-by">· pinned by {pinnedMessage.pinnedByName}</span>
                </span>
                {isMedia && mediaUrl ? (
                  <img
                    src={isGif ? proxyMediaUrl(mediaUrl) : mediaUrl}
                    alt={isGif ? "GIF" : "Image"}
                    className="chat-pin-media-preview"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxMedia({ url: mediaUrl, msgId: pinnedMessage.message.id });
                    }}
                  />
                ) : (
                  <span className="chat-pin-text">
                    {renderReplyPreview(pinnedMessage.message.text)}
                  </span>
                )}
              </div>
              {(isHost || participantRoles[user?.id || ""] === "co-owner") && (
                <button
                  onClick={() => socket?.emit("room:unpin-message", { roomId: room.id })}
                  className="chat-pin-dismiss"
                  title="Unpin"
                  data-testid="button-unpin-message"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })()}


        <div className="chat-scroll-well flex-1 min-h-0">
        <ScrollArea className="h-full" ref={chatScrollRef} onScroll={handleScroll}>
          <div className="pl-2 pr-3 py-2 flex flex-col">
            {/* Spacer — grows to fill any empty space above messages so the
                first message always appears at the bottom of the viewport.
                This replaces the fragile "min-h-full + justify-end" pattern
                which breaks inside Radix ScrollArea's display:table wrapper. */}
            <div style={{ flex: 1, minHeight: 0 }} aria-hidden="true" />
            {(() => {
              let displayedMessages = showMentionsOnly
                ? chatMessages.filter(msg => msg.type !== "system" && (msg as any).type !== "deleted" && isMentionedInMessage(msg.text))
                : chatMessages;
              if (chatSearch.trim()) {
                const q = chatSearch.trim().toLowerCase();
                displayedMessages = displayedMessages.filter(msg =>
                  msg.type !== "system" && (msg as any).type !== "deleted" &&
                  msg.text?.toLowerCase().includes(q)
                );
              }
              return displayedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 mt-auto">
                <div className="w-11 h-11 rounded-full bg-muted/30 border border-border/30 flex items-center justify-center">
                  {showMentionsOnly
                    ? <AtSign className="w-5 h-5 text-muted-foreground/40" />
                    : <MessageSquare className="w-5 h-5 text-muted-foreground/40" />
                  }
                </div>
                <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed max-w-[140px]">
                  {showMentionsOnly ? "No mentions yet." : "No messages yet.\nStart the conversation!"}
                </p>
              </div>
            ) : (
              displayedMessages.map((msg, msgIdx) => {
                if (msg.type === "announcement" && !showMentionsOnly) {
                  const kindColors: Record<string, { border: string; bg: string; accent: string; pill: string }> = {
                    platform:    { border: "border-orange-500/40", bg: "bg-orange-950/40", accent: "text-orange-200",  pill: "bg-orange-500/20 text-orange-200 border-orange-500/40" },
                    maintenance: { border: "border-amber-500/40",  bg: "bg-amber-950/40",  accent: "text-amber-300",   pill: "bg-amber-500/20 text-amber-200 border-amber-500/40" },
                    safety:      { border: "border-red-500/40",    bg: "bg-red-950/40",    accent: "text-red-300",     pill: "bg-red-500/20 text-red-200 border-red-500/40" },
                    celebration: { border: "border-rose-500/40",   bg: "bg-rose-950/40",   accent: "text-rose-200",    pill: "bg-rose-500/20 text-rose-200 border-rose-500/40" },
                  };
                  const theme = kindColors[msg.announcementKind || "platform"] ?? kindColors.platform;
                  const mediaUrls = msg.announcementMediaUrls || [];
                  const mediaTypes = msg.announcementMediaTypes || [];
                  const position = msg.announcementMediaPosition || "below";

                  const mediaBlock = mediaUrls.length > 0 ? (
                    <div className={`grid gap-1.5 ${mediaUrls.length === 1 ? "" : "grid-cols-2"}`}>
                      {mediaUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={mediaTypes[i] === "gif" ? "Announcement GIF" : "Announcement image"}
                          loading="lazy"
                          decoding="async"
                          width={480}
                          height={192}
                          className="w-full rounded-lg object-cover max-h-48"
                          data-testid={`img-announcement-media-chat-${msg.id}-${i}`}
                        />
                      ))}
                    </div>
                  ) : null;

                  const bodyBlock = msg.announcementBody ? (
                    <p className="text-[12px] text-white/75 leading-relaxed whitespace-pre-wrap">{msg.announcementBody}</p>
                  ) : null;

                  const bodyAfterBlock = msg.announcementBodyAfterMedia ? (
                    <p className="text-[12px] text-white/75 leading-relaxed whitespace-pre-wrap">{msg.announcementBodyAfterMedia}</p>
                  ) : null;

                  return (
                    <div key={msg.id} className={`rounded-xl border ${theme.border} ${theme.bg} p-3 space-y-2.5 my-1`} data-testid={`room-chat-${msg.id}`}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${theme.pill}`}>
                          📣 Admin
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">{formatTime(msg.createdAt)}</span>
                      </div>
                      {msg.announcementTitle && (
                        <p className={`text-[13px] font-bold leading-snug ${theme.accent}`}>{msg.announcementTitle}</p>
                      )}
                      {position === "above" && mediaBlock}
                      {position === "above" ? bodyBlock : null}
                      {position !== "above" && bodyBlock}
                      {position !== "above" && position !== "between" && mediaBlock}
                      {position === "between" && mediaBlock}
                      {position === "between" && bodyAfterBlock}
                      {position === "above" && bodyAfterBlock}
                      {position === "below" && bodyAfterBlock}
                    </div>
                  );
                }

                if (msg.type === "welcome" && !showMentionsOnly) {
                  if (dismissedWelcomeIds.has(msg.id)) return null;
                  const wAccent = msg.welcomeAccentColor || "#8B5CF6";
                  const wMediaUrls = msg.welcomeMediaUrls || [];
                  const wMediaTypes = msg.welcomeMediaTypes || [];
                  const wPosition = msg.welcomeMediaPosition || "below";
                  const mediaBlock = wMediaUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {wMediaUrls.map((url, i) => (
                        <img loading="lazy" decoding="async" key={i} src={url} alt="welcome" className="max-h-40 rounded-lg object-cover" data-testid={`img-welcome-media-${msg.id}-${i}`} />
                      ))}
                    </div>
                  ) : null;
                  const bodyBlock = msg.welcomeMessage ? (
                    <p className="text-[12px] text-white/80 leading-relaxed whitespace-pre-wrap">{msg.welcomeMessage}</p>
                  ) : null;
                  return (
                    <div
                      key={msg.id}
                      className="mx-2 mb-3 overflow-hidden"
                      style={{
                        borderRadius: "14px",
                        border: `1px solid ${wAccent}38`,
                        background: `linear-gradient(135deg, ${wAccent}12 0%, rgba(14,18,40,0.88) 55%, ${wAccent}07 100%)`,
                        backdropFilter: "blur(24px) saturate(1.3)",
                        WebkitBackdropFilter: "blur(24px) saturate(1.3)",
                        boxShadow: `inset 0 1px 0 ${wAccent}20, 0 6px 24px rgba(0,0,0,0.45), 0 0 28px ${wAccent}0d`,
                      }}
                      data-testid={`room-chat-${msg.id}`}
                    >
                      {/* Header bar */}
                      <div
                        className="px-3 py-2 flex items-center gap-2"
                        style={{
                          borderBottom: `1px solid ${wAccent}25`,
                          background: `linear-gradient(90deg, ${wAccent}18 0%, transparent 80%)`,
                          position: "relative",
                        }}
                      >
                        {/* Left accent stripe */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-[3px]"
                          style={{
                            background: `linear-gradient(180deg, ${wAccent} 0%, ${wAccent}60 100%)`,
                            borderRadius: "14px 0 0 0",
                          }}
                        />
                        <span className="text-sm ml-1" style={{ filter: `drop-shadow(0 0 5px ${wAccent}99)` }}>👋</span>
                        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: wAccent, letterSpacing: "0.06em" }}>Welcome Message</span>
                        <button
                          onClick={() => setDismissedWelcomeIds(prev => { const next = new Set(Array.from(prev)); next.add(msg.id); return next; })}
                          className="ml-auto flex items-center justify-center w-5 h-5 rounded-full transition-all"
                          style={{
                            color: "rgba(255,255,255,0.35)",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.09)",
                          }}
                          title="Close"
                          data-testid={`button-dismiss-welcome-${msg.id}`}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${wAccent}28`; (e.currentTarget as HTMLElement).style.color = wAccent; (e.currentTarget as HTMLElement).style.borderColor = `${wAccent}50`; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)"; }}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      {/* Body */}
                      <div className="px-3.5 py-2.5 flex flex-col gap-2">
                        {wPosition === "above" && mediaBlock}
                        {bodyBlock}
                        {wPosition === "below" && mediaBlock}
                        {wPosition === "between" && mediaBlock}
                      </div>
                    </div>
                  );
                }

                if (msg.type === "badge" && !showMentionsOnly) {
                  const bColor = msg.badgeColor || "#8B5CF6";
                  const bInitials = (msg.badgeUserName || "U").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
                  return (
                    <div
                      key={msg.id}
                      className="rounded-xl border my-1.5 overflow-hidden"
                      style={{ borderColor: `${bColor}40`, background: `${bColor}0d` }}
                      data-testid={`room-chat-badge-${msg.id}`}
                    >
                      <div className="px-3 py-1.5 flex items-center gap-1.5 border-b" style={{ borderColor: `${bColor}25`, background: `${bColor}15` }}>
                        <span className="text-sm">{msg.badgeEmoji}</span>
                        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: bColor }}>Achievement Unlocked</span>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="relative flex-shrink-0">
                          <Avatar className="w-10 h-10 ring-2" style={{ "--ring-color": bColor } as any}>
                            <AvatarImage src={msg.badgeUserAvatar ?? undefined} alt="" />
                            <AvatarFallback className="text-sm font-bold" style={{ background: `${bColor}25`, color: bColor }}>{bInitials}</AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">{msg.badgeEmoji}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-white/90 truncate">{msg.badgeUserName}</p>
                          <p className="text-[10px] text-white/50">was awarded</p>
                          <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: `${bColor}20`, border: `1px solid ${bColor}45`, color: bColor }}>
                            {msg.badgeEmoji} {msg.badgeLabel}
                          </span>
                        </div>
                      </div>
                      {msg.badgeQuote && (
                        <p className="px-3 pb-2.5 text-[11px] text-white/40 italic leading-relaxed">"{msg.badgeQuote}"</p>
                      )}
                    </div>
                  );
                }

                if (msg.type === "system" && !showMentionsOnly) {
                  const isSysNew = historyLoadedRef.current && !seenMsgIdsRef.current.has(String(msg.id));
                  return (
                    <div key={msg.id} className="chat-system-msg" data-new={isSysNew ? "true" : undefined} data-testid={`room-chat-${msg.id}`}>
                      <div className="chat-system-line" />
                      <div className="chat-system-pill">
                        {msg.text.includes("joined") ? (
                          <LogIn className="w-2.5 h-2.5 chat-system-icon-join" />
                        ) : msg.text.includes("left") ? (
                          <LogOut className="w-2.5 h-2.5 chat-system-icon-leave" />
                        ) : (
                          <Shield className="w-2.5 h-2.5 chat-system-icon-system" />
                        )}
                        <span>{msg.text}</span>
                      </div>
                      <div className="chat-system-line" />
                    </div>
                  );
                }

                if ((msg as any).type === "deleted") {
                  return (
                    <div key={msg.id} className="flex items-center gap-2 py-0.5 px-1" data-testid={`room-chat-${msg.id}`}>
                      <Trash2 className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground/50 italic">This message was deleted.</span>
                    </div>
                  );
                }

                const msgParticipant = participantById.get(msg.userId);
                const msgUser = msg.user || msgParticipant;
                const pIndex = participants.findIndex((p) => p.id === msg.userId);
                const gradient = getAvatarGradient(pIndex >= 0 ? pIndex : 0);
                const reactions = msg.reactions || {};
                const hasReactions = Object.keys(reactions).some((e) => reactions[e].length > 0);
                const QUICK_EMOJIS = ["👍", "❤️", "😢", "😠", "💔", "😂", "😮", "👏"];
                const isOwn = msg.userId === user?.id;
                const myRoleInRoom = participantRoles[user?.id || ""] || "";
                const canDeleteMsg = isOwn || isHost || myRoleInRoom === "co-owner";

                /* Per-user ring colour palette — 8 distinct hues */
                const ringPalette = [
                  { bg: "linear-gradient(135deg,rgba(251,191,36,.90) 0%,rgba(194,115,10,.55) 100%)", glow: "rgba(245,158,11,.36)" },
                  { bg: "linear-gradient(135deg,rgba(52,211,153,.90) 0%,rgba(4,120,87,.55) 100%)",   glow: "rgba(16,185,129,.30)" },
                  { bg: "linear-gradient(135deg,rgba(99,102,241,.90) 0%,rgba(67,56,202,.55) 100%)",  glow: "rgba(99,102,241,.30)" },
                  { bg: "linear-gradient(135deg,rgba(251,113,133,.90) 0%,rgba(190,18,60,.55) 100%)", glow: "rgba(244,63,94,.30)"  },
                  { bg: "linear-gradient(135deg,rgba(34,211,238,.90) 0%,rgba(14,116,144,.55) 100%)", glow: "rgba(6,182,212,.30)"  },
                  { bg: "linear-gradient(135deg,rgba(167,139,250,.90) 0%,rgba(109,40,217,.55) 100%)",glow: "rgba(139,92,246,.30)" },
                  { bg: "linear-gradient(135deg,rgba(251,146,60,.90) 0%,rgba(154,52,18,.55) 100%)",  glow: "rgba(234,88,12,.30)"  },
                  { bg: "linear-gradient(135deg,rgba(163,230,53,.90) 0%,rgba(77,124,15,.55) 100%)",  glow: "rgba(101,163,13,.30)" },
                ];
                const rc = ringPalette[(pIndex >= 0 ? pIndex : 0) % ringPalette.length];

                const isNew = historyLoadedRef.current && !seenMsgIdsRef.current.has(String(msg.id));
                const msgDate = new Date(msg.createdAt);
                const prevMsg = displayedMessages[msgIdx - 1];
                const prevMsgDate = prevMsg ? new Date(prevMsg.createdAt) : null;
                const showDateSep = !prevMsgDate || prevMsgDate.toDateString() !== msgDate.toDateString();
                const isGrouped = !showDateSep &&
                  !!prevMsg &&
                  prevMsg.type !== "system" &&
                  (prevMsg as any).type !== "deleted" &&
                  prevMsg.type !== "announcement" &&
                  prevMsg.type !== "badge" &&
                  prevMsg.userId === msg.userId &&
                  (msgDate.getTime() - prevMsgDate!.getTime()) < 2 * 60 * 1000;
                const _today = new Date();
                const _yesterday = new Date(_today); _yesterday.setDate(_today.getDate() - 1);
                const dateSepLabel = msgDate.toDateString() === _today.toDateString() ? "Today"
                  : msgDate.toDateString() === _yesterday.toDateString() ? "Yesterday"
                  : msgDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: msgDate.getFullYear() !== _today.getFullYear() ? "numeric" : undefined });
                return (
                  <Fragment key={msg.id}>
                    {showDateSep && (
                      <div className="chat-date-sep">
                        <div className="chat-date-sep-line" />
                        <span className="chat-date-sep-label">{dateSepLabel}</span>
                        <div className="chat-date-sep-line" />
                      </div>
                    )}
                  <div
                    className="group chat-msg-row"
                    data-own={isOwn ? "true" : undefined}
                    data-new={isNew ? "true" : undefined}
                    data-grouped={isGrouped ? "true" : undefined}
                    data-highlighted={highlightedMsgId === msg.id ? "true" : undefined}
                    data-just-reacted={justReactedMsgId === msg.id ? "true" : undefined}
                    data-testid={`room-chat-${msg.id}`}
                    onContextMenu={(e) => {
                      if (msg.type === "deleted" || (msg as any).type === "system") return;
                      e.preventDefault();
                      e.stopPropagation();
                      const pad = 8;
                      const menuW = 200;
                      const menuH = 160;
                      const x = Math.min(e.clientX + pad, window.innerWidth - menuW - pad);
                      const y = Math.min(e.clientY + pad, window.innerHeight - menuH - pad);
                      setChatContextMenu({ msgId: msg.id, msgUserId: msg.userId, x, y, isOwn, canDelete: canDeleteMsg });
                    }}
                    onTouchStart={(e) => {
                      if (msg.type === "deleted" || (msg as any).type === "system") return;
                      const touch = e.touches[0];
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = setTimeout(() => {
                        const pad = 8;
                        const menuW = 200;
                        const menuH = 160;
                        const x = Math.min(touch.clientX + pad, window.innerWidth - menuW - pad);
                        const y = Math.min(touch.clientY - menuH - pad, window.innerHeight - menuH - pad);
                        setChatContextMenu({ msgId: msg.id, msgUserId: msg.userId, x, y, isOwn, canDelete: canDeleteMsg });
                      }, 500);
                    }}
                    onTouchEnd={() => {
                      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
                    }}
                    onTouchMove={() => {
                      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
                    }}
                  >
                    {/* Bubble layout — own=right, others=left */}
                    {/* Bubble column — avatar lives inside card header */}
                    <div className={`chat-bubble-col ${isOwn ? "items-end" : "items-start"}`}>

                      {/* Private whisper badge — own only, above bubble */}
                      {isOwn && msg.isPrivate && (
                        <div className="flex items-center justify-end mb-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-purple-400/40 text-purple-300" data-testid={`badge-private-message-${msg.id}`}>
                            <LockKeyhole className="w-2 h-2 mr-0.5" />
                            Whisper
                          </Badge>
                        </div>
                      )}

                      {/* Reply quote block */}
                      {msg.replyTo && (
                        <div
                          className="chat-reply-block chat-reply-block--jumpable"
                          data-testid={`reply-chip-${msg.id}`}
                          onClick={() => scrollToMessage(msg.replyTo!.id)}
                          title="Click to jump to original message"
                        >
                          <span className="chat-reply-block-name">↩ {msg.replyTo.userName}</span>
                          <div className="chat-reply-block-body">{renderReplyPreview(msg.replyTo.text)}</div>
                        </div>
                      )}

                      {/* Wrapper — relative anchor for floating action bar */}
                      <div style={{ position: "relative" }}>
                        {/* Floating action bar — Discord-style, no size impact */}
                        {editingMsgId !== msg.id && msg.type !== "deleted" && (msg as any).type !== "system" && (
                          <div className={`chat-actions-bar ${isOwn ? "chat-actions-bar--own" : "chat-actions-bar--other"}`}>
                            {/* ↩ Reply */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo({ id: msg.id, userId: msg.userId, userName: getUserDisplayName(msgUser) || "Unknown", text: msg.text });
                                    chatInputRef.current?.focus();
                                  }}
                                  className="chat-quick-btn"
                                  data-testid={`button-reply-inline-${msg.id}`}
                                >
                                  <CornerUpLeft className="w-3 h-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6} className="text-[10px] px-1.5 py-0.5">Reply</TooltipContent>
                            </Tooltip>
                            {/* ✎ Edit — own only */}
                            {isOwn && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => { setEditingMsgId(msg.id); setEditingText(msg.text); }}
                                    className="chat-quick-btn chat-quick-btn--edit"
                                    data-testid={`button-edit-inline-${msg.id}`}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={6} className="text-[10px] px-1.5 py-0.5">Edit</TooltipContent>
                              </Tooltip>
                            )}
                            {/* 😊 React */}
                            <Popover open={reactPopoverMsgId === msg.id} onOpenChange={(open) => setReactPopoverMsgId(open ? msg.id : null)}>
                              <PopoverTrigger asChild>
                                <button className="chat-quick-btn chat-quick-btn--emoji" data-testid={`button-react-open-${msg.id}`} title="React">
                                  <Smile className="w-3 h-3" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="p-2 w-auto" side="top" align="start" sideOffset={6}>
                                <div className="flex items-center gap-0.5 flex-wrap" style={{ maxWidth: "196px" }}>
                                  {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => {
                                        handleReact(msg.id, emoji);
                                        setReactPopoverMsgId(null);
                                        setJustReactedMsgId(msg.id);
                                        setTimeout(() => setJustReactedMsgId(null), 2500);
                                      }}
                                      className="text-base hover:scale-125 active:scale-95 transition-transform flex items-center justify-center rounded-md hover:bg-white/10"
                                      style={{ minWidth: "28px", minHeight: "28px", lineHeight: 1 }}
                                      data-testid={`quick-react-${msg.id}-${emoji}`}
                                      title={`React with ${emoji}`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                            {/* 📌 Pin — host / co-owner */}
                            {(isHost || participantRoles[user?.id || ""] === "co-owner") && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (pinnedMessage?.message?.id === msg.id) {
                                        socket?.emit("room:unpin-message", { roomId: room.id });
                                      } else {
                                        socket?.emit("room:pin-message", { roomId: room.id, message: msg, pinnedBy: user?.id, pinnedByName: getUserDisplayName(user) || "Host" });
                                      }
                                    }}
                                    className="chat-quick-btn"
                                    style={pinnedMessage?.message?.id === msg.id ? { color: "rgba(251,191,36,.90)" } : {}}
                                    data-testid={`button-pin-${msg.id}`}
                                  >
                                    <Pin className="w-3 h-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={6} className="text-[10px] px-1.5 py-0.5">
                                  {pinnedMessage?.message?.id === msg.id ? "Unpin" : "Pin"}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {/* 🗑 Delete — own message, or owner/co-owner deleting any message */}
                            {canDeleteMsg && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      socket?.emit("room:chat-delete", { roomId: room.id, messageId: msg.id, deletedBy: user!.id, messageUserId: msg.userId });
                                      setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, text: "This message was deleted.", type: "deleted" as any, reactions: {}, replyTo: null } : m));
                                    }}
                                    className="chat-quick-btn chat-quick-btn--delete"
                                    data-testid={`button-delete-${msg.id}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={6} className="text-[10px] px-1.5 py-0.5">
                                  {isOwn ? "Delete" : "Delete (mod)"}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        )}

                        {/* The bubble card */}
                        <div
                          className="chat-msg-card"
                          data-own={isOwn ? "true" : undefined}
                          data-grouped={isGrouped ? "true" : undefined}
                          data-private={msg.isPrivate ? "true" : undefined}
                          style={msg.cardColor ? {
                            background: `linear-gradient(158deg, ${msg.cardColor}72 0%, ${msg.cardColor}52 52%, ${msg.cardColor}38 100%)`,
                            borderColor: `${msg.cardColor}55`,
                            borderTopColor: `${msg.cardColor}88`,
                            boxShadow: `0 8px 24px rgba(0,0,0,0.68), 0 2px 7px rgba(0,0,0,0.48), inset 0 1px 0 ${msg.cardColor}44, 0 0 28px ${msg.cardColor}22`,
                          } : undefined}
                        >

                        {/* Card header: avatar + name + roles — others, every message */}
                        {!isOwn && (
                          <div className="chat-card-header">
                            <div className="relative flex-shrink-0 group/avatar">
                              <Avatar
                                className="w-[26px] h-[26px]"
                                style={{
                                  boxShadow: `0 2px 8px rgba(0,0,0,.70), 0 0 10px ${rc.glow}`,
                                  border: "1.5px solid rgba(255,255,255,0.10)",
                                }}
                              >
                                <AvatarImage src={msgUser?.profileImageUrl || undefined} alt="" />
                                <AvatarFallback className={`text-[9px] font-bold bg-gradient-to-br ${gradient} text-white`}>
                                  {getUserInitials(msgUser)}
                                </AvatarFallback>
                              </Avatar>
                              <span
                                className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full border pointer-events-none"
                                style={{ background: "#34d399", borderColor: "#0a0b1e", borderWidth: "1.5px" }}
                              />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="chat-bubble-sender-name">{getUserDisplayName(msgUser)}</span>
                                {msg.userId !== "system" && (
                                  <button
                                    className={`chat-dm-whisper-btn${privateChatToId === msg.userId ? " chat-dm-whisper-btn--active" : ""}`}
                                    onClick={() => {
                                      setPrivateChatToId(privateChatToId === msg.userId ? "public" : msg.userId);
                                      chatInputRef.current?.focus();
                                    }}
                                    title={privateChatToId === msg.userId ? "Stop whispering to " + getUserDisplayName(msgUser) : `Whisper to ${getUserDisplayName(msgUser)}`}
                                    data-testid={`button-dm-name-${msg.id}`}
                                  >
                                    <MessageSquare className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {msg.userId === room.ownerId && (
                                  <span className="chat-role-pill chat-role-pill--owner">Owner</span>
                                )}
                                {msg.userId !== room.ownerId && participantRoles[msg.userId] === "co-owner" && (
                                  <span className="chat-role-pill chat-role-pill--coowner">Co-Owner</span>
                                )}
                                {msgUser?.role === "admin" && (
                                  <span className="chat-role-pill chat-role-pill--admin">Admin</span>
                                )}
                                {msg.userId !== room.ownerId && participantRoles[msg.userId] === "troll" && (
                                  <span className="chat-role-pill chat-role-pill--troll">🧌 Troll</span>
                                )}
                                {msg.isPrivate && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-purple-400/40 text-purple-300" data-testid={`badge-private-message-${msg.id}`}>
                                    <LockKeyhole className="w-2 h-2 mr-0.5" />
                                    Whisper
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Card header — own messages: avatar + name right-aligned */}
                        {isOwn && (
                          <div className="chat-card-header" style={{ flexDirection: "row-reverse" }}>
                            <div className="relative flex-shrink-0">
                              <Avatar
                                className="w-[26px] h-[26px]"
                                style={{
                                  boxShadow: `0 2px 8px rgba(0,0,0,.70), 0 0 10px ${rc.glow}`,
                                  border: "1.5px solid rgba(255,255,255,0.10)",
                                }}
                              >
                                <AvatarImage src={user?.profileImageUrl || undefined} alt="" />
                                <AvatarFallback className={`text-[9px] font-bold bg-gradient-to-br ${gradient} text-white`}>
                                  {getUserInitials(user)}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="flex flex-col min-w-0 items-end">
                              <div className="flex items-center gap-1 flex-row-reverse flex-wrap">
                                <span className="chat-bubble-sender-name">{getUserDisplayName(user)}</span>
                                {msg.userId === room.ownerId && (
                                  <span className="chat-role-pill chat-role-pill--owner">Owner</span>
                                )}
                                {msg.userId !== room.ownerId && participantRoles[msg.userId] === "co-owner" && (
                                  <span className="chat-role-pill chat-role-pill--coowner">Co-Owner</span>
                                )}
                                {user?.role === "admin" && (
                                  <span className="chat-role-pill chat-role-pill--admin">Admin</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Body / edit mode */}
                        {editingMsgId === msg.id ? (
                          <div className="flex flex-col gap-1.5">
                            <textarea
                              autoFocus
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  const trimmed = editingText.trim();
                                  if (trimmed && trimmed !== msg.text) {
                                    socket?.emit("room:chat-edit", { roomId: room.id, messageId: msg.id, newText: trimmed, editedBy: user!.id });
                                    setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, text: trimmed, edited: true } : m));
                                  }
                                  setEditingMsgId(null);
                                  setEditingText("");
                                } else if (e.key === "Escape") {
                                  setEditingMsgId(null);
                                  setEditingText("");
                                }
                              }}
                              className="w-full rounded-lg px-2 py-1.5 text-[13px] resize-none bg-white/5 border border-white/15 text-white/90 focus:outline-none focus:border-blue-400/50 min-h-[52px]"
                              rows={2}
                              data-testid={`input-edit-msg-${msg.id}`}
                            />
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <button
                                onClick={() => {
                                  const trimmed = editingText.trim();
                                  if (trimmed && trimmed !== msg.text) {
                                    socket?.emit("room:chat-edit", { roomId: room.id, messageId: msg.id, newText: trimmed, editedBy: user!.id });
                                    setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, text: trimmed, edited: true } : m));
                                  }
                                  setEditingMsgId(null);
                                  setEditingText("");
                                }}
                                className="px-2 py-0.5 rounded bg-blue-500/25 text-blue-300 hover:bg-blue-500/40 transition-colors font-medium"
                                data-testid={`button-save-edit-${msg.id}`}
                              >Save</button>
                              <button
                                onClick={() => { setEditingMsgId(null); setEditingText(""); }}
                                className="px-2 py-0.5 rounded text-white/35 hover:text-white/60 transition-colors"
                                data-testid={`button-cancel-edit-${msg.id}`}
                              >Cancel</button>
                              <span className="text-white/20">↵ Enter · Esc cancel</span>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="chat-msg-body whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full"
                            style={{ color: msg.messageColor || undefined }}
                            data-testid={`text-room-chat-${msg.id}`}
                          >
                            {renderMessageContent(msg.text, (url) => setLightboxMedia({ url, msgId: msg.id }), (id) => handleSelectYoutubeVideo(id))}
                            {(msg as any).edited && (
                              <span className="text-[9px] text-white/25 ml-1 italic">(edited)</span>
                            )}
                          </div>
                        )}
                        {/* Timestamp — at end of card, no action bar here */}
                        {editingMsgId !== msg.id && (
                          <div className={`flex mt-1.5 ${isOwn ? "justify-end" : "justify-start"}`}>
                            <span className="chat-msg-time">{formatTime(msg.createdAt)}</span>
                          </div>
                        )}
                        </div>{/* close: bubble card */}
                      </div>{/* close: wrapper */}

                      {/* ── Reactions: float below card, Telegram-style overlap ── */}
                      {hasReactions && msg.type !== "deleted" && (msg as any).type !== "system" && (
                        <div className={`chat-reactions-float flex items-center gap-1 flex-wrap ${isOwn ? "flex-row-reverse" : ""}`} data-testid={`reactions-${msg.id}`}>
                          {Object.entries(reactions).filter(([, uids]) => uids.length > 0).map(([emoji, uids]) => {
                            const tooltip = formatReactionTooltip(emoji, uids);
                            return (
                              <Tooltip key={emoji}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleReact(msg.id, emoji)}
                                    className="chat-reaction-pill"
                                    data-self={uids.includes(user?.id || "") ? "true" : undefined}
                                    data-testid={`reaction-${msg.id}-${emoji}`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="font-medium">{uids.length}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={8} avoidCollisions className="text-xs max-w-[260px] text-center z-[9999]">
                                  <p className="font-semibold mb-0.5">{tooltip.heading}</p>
                                  <p className="opacity-70">{tooltip.names}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}

                    </div>{/* close: bubble-col */}

                    {/* Seen avatars — show who has seen up to this message */}
                    {seenByMap[msg.id] && seenByMap[msg.id].length > 0 && (
                      <div className={`flex items-center gap-0.5 mt-0.5 flex-wrap ${isOwn ? "justify-end" : "justify-start"}`}>
                        {seenByMap[msg.id].slice(0, 6).map(seenUser => (
                          <Tooltip key={seenUser.userId}>
                            <TooltipTrigger asChild>
                              <div
                                className="chat-seen-avatar"
                                data-testid={`seen-avatar-${msg.id}-${seenUser.userId}`}
                              >
                                {seenUser.profileImageUrl ? (
                                  <img src={seenUser.profileImageUrl} alt={seenUser.userName} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[7px] font-bold text-white/80 leading-none">
                                    {seenUser.userName.slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px] px-2 py-1">
                              {seenUser.userName} saw this
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {seenByMap[msg.id].length > 6 && (
                          <span className="text-[9px] text-white/30 ml-0.5">+{seenByMap[msg.id].length - 6}</span>
                        )}
                      </div>
                    )}

                  </div>
                  </Fragment>
                );
              })
            );
            })()}
          </div>
        </ScrollArea>
        </div>

        {/* Typing indicator — shown between messages and the input */}
        {Object.keys(typingUsers).length > 0 && (
          <div
            className="chat-typing-indicator"
            aria-live="polite"
            aria-atomic="true"
            data-testid="typing-indicator"
          >
            <div className="chat-typing-dots" aria-hidden="true">
              <span /><span /><span />
            </div>
            <span className="chat-typing-label">
              {(() => {
                const names = Object.values(typingUsers).map((u) => u.name);
                if (names.length === 1) return `${names[0]} is typing…`;
                if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
                return `${names.length} people are typing…`;
              })()}
            </span>
          </div>
        )}

        <form onSubmit={handleSendChat} className="chat-form-area flex flex-col gap-2 relative flex-shrink-0 mt-auto">
          {replyingTo && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/60 rounded-md border-l-2 border-primary/50" data-testid="reply-preview">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-primary font-medium block mb-0.5">Replying to {replyingTo.userName}</span>
                {renderReplyPreview(replyingTo.text)}
              </div>
              <button type="button" onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0" data-testid="button-cancel-reply">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {privateChatToId !== "public" && (() => {
            const whisperTarget = participants.find(p => p.id === privateChatToId);
            return (
              <div className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-lg border border-amber-400/30 bg-amber-400/8" data-testid="whisper-indicator">
                <LockKeyhole className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span className="text-[11px] text-amber-300 font-medium flex-1 truncate">
                  Whispering to {getUserDisplayName(whisperTarget)}
                </span>
                <button
                  type="button"
                  onClick={() => setPrivateChatToId("public")}
                  className="text-amber-400/60 hover:text-amber-300 transition-colors flex-shrink-0 rounded p-0.5 hover:bg-amber-400/10"
                  aria-label="Switch to public chat"
                  data-testid="button-clear-whisper"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })()}

          {mentionQuery !== null && mentionFilteredParticipants.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto z-50" data-testid="mention-dropdown">
              {mentionFilteredParticipants.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${i === mentionIndex ? "bg-accent" : "hover-elevate"}`}
                  onClick={() => insertMention(p)}
                  data-testid={`mention-option-${p.id}`}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={p.profileImageUrl || ""} alt="" />
                    <AvatarFallback className="text-[10px]">{getUserInitials(p)}</AvatarFallback>
                  </Avatar>
                  <span>{getUserDisplayName(p)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Right-click / long-press context menu for individual messages */}
          {chatContextMenu && (
            <div
              className="fixed z-[9999] rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100"
              style={{
                top: chatContextMenu.y,
                left: chatContextMenu.x,
                minWidth: 192,
                background: "rgba(13,14,26,0.97)",
                border: "1px solid rgba(255,255,255,0.10)",
                backdropFilter: "blur(16px)",
              }}
              onClick={(e) => e.stopPropagation()}
              data-testid="chat-context-menu"
            >
              {/* Reply */}
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-slate-200 hover:bg-white/8 transition-colors text-left"
                data-testid="ctx-reply"
                onClick={() => {
                  const msg = chatMessages.find(m => m.id === chatContextMenu.msgId);
                  if (msg) {
                    const msgUser = participants.find(p => p.id === msg.userId);
                    setReplyingTo({ id: msg.id, userId: msg.userId, userName: getUserDisplayName(msgUser) || "Unknown", text: msg.text });
                    chatInputRef.current?.focus();
                  }
                  setChatContextMenu(null);
                }}
              >
                <CornerUpLeft className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                Reply
              </button>

              {/* Copy text */}
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-slate-200 hover:bg-white/8 transition-colors text-left"
                data-testid="ctx-copy"
                onClick={() => {
                  const msg = chatMessages.find(m => m.id === chatContextMenu.msgId);
                  if (msg?.text) navigator.clipboard.writeText(msg.text).catch(() => {});
                  setChatContextMenu(null);
                  toast({ title: "Copied to clipboard" });
                }}
              >
                <Copy className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                Copy Text
              </button>

              {/* Pin / Unpin — host / co-owner */}
              {(isHost || participantRoles[user?.id || ""] === "co-owner") && (
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-slate-200 hover:bg-white/8 transition-colors text-left"
                  data-testid="ctx-pin"
                  onClick={() => {
                    const msg = chatMessages.find(m => m.id === chatContextMenu.msgId);
                    if (!msg) { setChatContextMenu(null); return; }
                    if (pinnedMessage?.message?.id === msg.id) {
                      socket?.emit("room:unpin-message", { roomId: room.id });
                    } else {
                      socket?.emit("room:pin-message", { roomId: room.id, message: msg, pinnedBy: user?.id, pinnedByName: getUserDisplayName(user) || "Host" });
                    }
                    setChatContextMenu(null);
                  }}
                >
                  <Pin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  {pinnedMessage?.message?.id === chatContextMenu.msgId ? "Unpin Message" : "Pin Message"}
                </button>
              )}

              {/* Delete — own or mod */}
              {chatContextMenu.canDelete && (
                <>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "2px 0" }} />
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-rose-400 hover:bg-rose-500/12 transition-colors text-left font-medium"
                    data-testid="ctx-delete"
                    onClick={() => {
                      socket?.emit("room:chat-delete", { roomId: room.id, messageId: chatContextMenu.msgId, deletedBy: user!.id, messageUserId: chatContextMenu.msgUserId });
                      setChatMessages(prev => prev.map(m => m.id === chatContextMenu.msgId ? { ...m, text: "This message was deleted.", type: "deleted" as any, reactions: {}, replyTo: null } : m));
                      setChatContextMenu(null);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                    {chatContextMenu.isOwn ? "Delete Message" : "Delete (mod)"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Auto-translate preview strip */}
          {autoTranslate && chatText.trim().length >= 2 && (
            <div
              className="mx-1 mb-1 px-2.5 py-1.5 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1"
              style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)" }}
              data-testid="auto-translate-preview"
            >
              <Languages className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "rgba(56,189,248,0.75)" }} />
              {isAutoTranslating ? (
                <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.6)" }}>Translating…</span>
              ) : autoTranslatePreview ? (
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(56,189,248,0.55)" }}>
                    Will send as ({TRANSLATE_LANGUAGES.find(l => l.code === autoTranslateTarget)?.label ?? autoTranslateTarget})
                  </span>
                  <span className="text-[11px] leading-snug break-words" style={{ color: "rgba(226,232,240,0.85)" }}>{autoTranslatePreview}</span>
                </div>
              ) : (
                <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.5)" }}>No translation needed — will send as-is</span>
              )}
            </div>
          )}

          <div className="relative">
            {!isAtBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute -top-12 right-1 rounded-full shadow-lg flex items-center gap-1.5 z-20 animate-in fade-in slide-in-from-bottom-2 transition-all px-3 py-1.5 text-[11px] font-semibold hover:scale-[1.02] active:scale-95"
                style={{ background: "linear-gradient(135deg, hsl(var(--neu-orange-hi)) 0%, hsl(var(--neu-orange-lo)) 100%)", color: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.32), 0 0 18px hsla(var(--neu-orange) / 0.38), inset 0 1px 0 rgba(255,255,255,0.18)" }}
                data-testid="button-new-messages-indicator"
                aria-label="Scroll to latest messages"
              >
                <ChevronsDown className="w-3.5 h-3.5" />
                <span data-testid="text-new-message-count">
                  {unreadCount > 0 ? `${unreadCount} new ${unreadCount === 1 ? "message" : "messages"}` : "Jump to latest"}
                </span>
              </button>
            )}
            <textarea
              ref={chatInputRef}
              aria-label="Type a message"
              value={chatText}
              onChange={handleChatInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (chatText.trim()) {
                    handleSendChat(e as any);
                  }
                }
                handleChatKeyDown(e as any);
              }}
              onPaste={async (e) => {
                const items = Array.from(e.clipboardData.items);
                const imageItem = items.find(item => item.type.startsWith("image/"));
                if (imageItem) {
                  e.preventDefault();
                  const file = imageItem.getAsFile();
                  if (!file || !socket || !user) return;
                  setPasteUploading(true);
                  try {
                    const imgUrl = await uploadChatImage(file);
                    socket.emit("room:chat", {
                      roomId: room.id,
                      userId: user.id,
                      text: `[img:${imgUrl}]`,
                      messageColor: chatMessageColor,
                      privateToId: privateChatToId === "public" ? null : privateChatToId,
                      replyTo: replyingTo || undefined,
                    });
                    setReplyingTo(null);
                  } catch (err) {
                    console.error("Paste image upload failed:", err);
                  } finally {
                    setPasteUploading(false);
                  }
                }
              }}
              placeholder={pasteUploading ? "Uploading image..." : isChatBlocked ? chatBlockReason : isTroll ? "🧌 Troll mode — 50 chars max, 10s cooldown…" : privateChatToId === "public" ? "Message the room…" : "Private message…"}
              disabled={pasteUploading || isChatBlocked}
              className="room-composer"
              data-whisper={privateChatToId !== "public"}
              rows={2}
              data-testid="input-room-chat"
              maxLength={isTroll ? TROLL_MAX_CHARS : CHAT_MAX_CHARS}
              style={{ paddingRight: "3.2rem" }}
            />
            {/* Character counter — troll mode always shown; normal mode fades in above 70% */}
            {(() => {
              const limit = isTroll ? TROLL_MAX_CHARS : CHAT_MAX_CHARS;
              const len   = chatText.length;
              const pct   = len / limit;
              const show  = isTroll || pct >= 0.70;
              if (!show) return null;
              const color = pct >= 1
                ? "rgb(248,113,113)"
                : pct >= 0.90
                ? "rgb(253,224,71)"
                : pct >= 0.80
                ? "rgba(253,224,71,0.65)"
                : "rgba(255,255,255,0.25)";
              return (
                <div
                  className="absolute bottom-1.5 right-10 text-[9px] font-bold tabular-nums pointer-events-none select-none"
                  style={{
                    color,
                    transition: "color 0.2s ease",
                    opacity: pct >= 0.70 ? 1 : 0,
                  }}
                >
                  {len}/{limit}
                </div>
              );
            })()}
            {/* Send button — always visible, no Enter-only UX trap */}
            <button
              type="submit"
              disabled={!chatText.trim() || pasteUploading || isChatBlocked}
              data-testid="button-send-chat"
              aria-label="Send message"
              className="absolute bottom-1.5 right-1.5 flex items-center justify-center w-9 h-9 rounded-full transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: chatText.trim() && !isChatBlocked
                  ? "linear-gradient(135deg, rgba(110,88,245,0.92) 0%, rgba(80,60,200,0.85) 100%)"
                  : "rgba(255,255,255,0.06)",
                border: chatText.trim() && !isChatBlocked
                  ? "1px solid rgba(140,120,255,0.45)"
                  : "1px solid rgba(255,255,255,0.08)",
                boxShadow: chatText.trim() && !isChatBlocked
                  ? "0 2px 10px rgba(100,80,240,0.35), inset 0 1px 0 rgba(255,255,255,0.18)"
                  : "none",
              }}
            >
              <SendHorizontal className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* ── Word alternatives chips — instant, per word ──────────────── */}
          {wordAltInfo && wordAltInfo.alternatives.length > 0 && (
            <div className="grammar-alt-row" data-testid="grammar-word-alternatives">
              <span className="grammar-alt-label">
                <Wand2 className="w-2.5 h-2.5" />
                &ldquo;{wordAltInfo.word}&rdquo;
              </span>
              <div className="grammar-alt-chips">
                {wordAltInfo.alternatives.slice(0, 5).map((alt) => (
                  <button
                    key={alt}
                    type="button"
                    className="grammar-alt-chip"
                    data-testid={`button-word-alt-${alt}`}
                    onClick={() => {
                      const next = applyWordAlternative(chatText, wordAltInfo.wordStart, wordAltInfo.wordEnd, alt);
                      setGrammarUndo(chatText);
                      setChatText(next);
                      setWordAltInfo(null);
                    }}
                  >
                    {alt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Grammar suggestion panel ───────────────────────────────── */}
          {(() => {
            const visible = grammarSuggestions.filter(
              s => !grammarDismissedIds.has(s.id) && s.corrected !== chatText.trim()
            );
            const shown = visible.slice(0, 4);
            const extra = visible.length - shown.length;
            if (visible.length === 0 && !grammarUndo) return null;
            return (
              <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-1" data-testid="grammar-suggestion-panel">
                {/* Undo bar */}
                {grammarUndo && (
                  <div
                    className="flex items-center gap-2 px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.22)" }}
                    data-testid="grammar-undo-bar"
                  >
                    <span className="text-[10px] text-emerald-300 font-medium flex-1">Correction applied</span>
                    <button
                      type="button"
                      onClick={() => { setChatText(grammarUndo!); setGrammarUndo(null); }}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors"
                      style={{ background: "rgba(52,211,153,0.18)", color: "rgba(110,231,183,0.95)" }}
                      data-testid="button-grammar-undo"
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      onClick={() => setGrammarUndo(null)}
                      className="text-white/30 hover:text-white/60 transition-colors p-0.5"
                      aria-label="Dismiss undo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {/* Apply All — only when 2+ suggestions visible */}
                {visible.length >= 2 && (
                  <button
                    type="button"
                    className="grammar-apply-all"
                    data-testid="button-grammar-apply-all"
                    onClick={() => {
                      const fixed = applyAllSuggestions(chatText);
                      setGrammarUndo(chatText);
                      setChatText(fixed);
                      setGrammarSuggestions([]);
                      setGrammarDismissedIds(new Set());
                    }}
                  >
                    <Wand2 className="w-3 h-3" />
                    Fix all {visible.length} suggestion{visible.length > 1 ? "s" : ""}
                  </button>
                )}
                {/* Suggestion rows */}
                {shown.map((s) => {
                  const catMeta = CATEGORY_META[s.category];
                  const sevMeta = SEVERITY_META[s.severity];
                  return (
                    <div
                      key={s.id}
                      className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg"
                      style={{ background: catMeta.bg, border: `1px solid ${catMeta.color}30` }}
                      data-testid={`grammar-suggestion-${s.id}`}
                    >
                      <Wand2 className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: catMeta.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sevMeta.dot}`} />
                          <span
                            className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded"
                            style={{ background: `${catMeta.color}22`, color: catMeta.color }}
                          >
                            {catMeta.label}
                          </span>
                          <span className="text-[10px] font-medium leading-tight" style={{ color: catMeta.color }}>
                            {s.message}
                          </span>
                        </div>
                        {/* Diff preview — show corrected text */}
                        <div className="text-[11px] text-white/60 truncate mt-0.5 font-mono leading-snug">
                          <span className="text-white/30">→ </span>
                          <span style={{ color: `${catMeta.color}cc` }}>{s.corrected}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setGrammarUndo(chatText);
                            setChatText(s.corrected);
                            setGrammarSuggestions([]);
                            setGrammarDismissedIds(new Set());
                          }}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded transition-colors hover:opacity-90"
                          style={{ background: `${catMeta.color}28`, color: catMeta.color }}
                          data-testid={`button-grammar-apply-${s.id}`}
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => setGrammarDismissedIds(prev => new Set([...Array.from(prev), s.id]))}
                          className="text-white/30 hover:text-white/60 transition-colors p-0.5"
                          aria-label="Dismiss suggestion"
                          data-testid={`button-grammar-dismiss-${s.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {extra > 0 && (
                  <div className="text-[10px] text-white/35 text-center py-0.5" data-testid="grammar-extra-count">
                    +{extra} more suggestion{extra > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="chat-toolbar-slab">
            <div className="chat-tools-group">
              <EmojiPickerButton onEmojiSelect={(emoji) => setChatText((prev) => prev + emoji)} />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="room-tool-btn"
                    data-active={privateChatToId !== "public"}
                    data-testid="button-chat-mode-toggle"
                    aria-label={privateChatToId === "public" ? "Switch to private" : "Switch to public"}
                  >
                    {privateChatToId === "public" ? <Globe className="w-3.5 h-3.5" /> : <LockKeyhole className="w-3.5 h-3.5" />}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-1.5" side="top" align="start" data-testid="popover-chat-mode">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1 pt-0.5">Chat mode</p>
                  <button
                    type="button"
                    onClick={() => setPrivateChatToId("public")}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-left transition-colors ${privateChatToId === "public" ? "bg-primary/10 text-primary" : "hover:bg-muted/60"}`}
                    data-testid="button-public-chat-mode"
                  >
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-[12px] font-medium">Public chat</span>
                    {privateChatToId === "public" && <span className="ml-auto text-[10px] text-primary">✓</span>}
                  </button>
                  {participants.filter(p => p.id !== user?.id).length > 0 && (
                    <>
                      <div className="h-px bg-border/40 my-1" />
                      <p className="text-[10px] text-muted-foreground px-2 pb-0.5">Whisper privately to</p>
                      {participants.filter(p => p.id !== user?.id).map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPrivateChatToId(p.id)}
                          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors ${privateChatToId === p.id ? "bg-amber-400/10 text-amber-300" : "hover:bg-muted/60"}`}
                          data-testid={`button-private-to-${p.id}`}
                        >
                          <Avatar className="w-5 h-5 flex-shrink-0">
                            <AvatarImage src={p.profileImageUrl || ""} alt="" />
                            <AvatarFallback className="text-[8px]">{getUserInitials(p)}</AvatarFallback>
                          </Avatar>
                          <span className="text-[12px] font-medium truncate">{getUserDisplayName(p)}</span>
                          {privateChatToId === p.id && <span className="ml-auto text-[10px] text-amber-400">✓</span>}
                        </button>
                      ))}
                    </>
                  )}
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="room-tool-btn" data-testid="button-chat-color-picker" aria-label="Message color" title="Message color">
                    {chatMessageColor
                      ? <span className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: chatMessageColor, boxShadow: `0 0 6px ${chatMessageColor}55, inset 0 1px 0 rgba(255,255,255,0.4)` }} />
                      : <span className="chat-color-none-dot" />
                    }
                  </button>
                </PopoverTrigger>
                <PopoverContent className="chat-color-pop w-[17.5rem] p-3" side="top" align="start">
                  <div className="chat-color-pop-inner">

                    {/* ── Message color section ── */}
                    <div className="chat-color-pop-head">
                      <span className="chat-color-pop-title">MESSAGE COLOR</span>
                      <span
                        className="chat-color-pop-preview chat-color-pop-preview--text"
                        style={chatMessageColor ? {
                          color: chatMessageColor,
                          textShadow: `0 0 14px ${chatMessageColor}99`,
                          borderColor: `${chatMessageColor}44`,
                          background: `radial-gradient(ellipse at 60% 30%, ${chatMessageColor}18, hsl(248 38% 9% / 0.95))`,
                        } : {}}
                        aria-hidden="true"
                      >
                        Aa
                      </span>
                    </div>
                    <div className="chat-color-grid" role="radiogroup" aria-label="Chat message color">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={chatMessageColor === ""}
                        onClick={() => setChatMessageColor("")}
                        className={`chat-color-swatch chat-color-swatch--none ${chatMessageColor === "" ? "is-selected" : ""}`}
                        data-testid="button-chat-color-none"
                        aria-label="Default color"
                        title="Default (no override)"
                      >
                        {chatMessageColor === "" && (
                          <svg viewBox="0 0 12 12" className="chat-color-check" aria-hidden="true" style={{ color: "rgba(200,185,255,0.9)" }}>
                            <path d="M2.5 6.2 L5 8.7 L9.5 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      {[
                        "#c4b5fd", "#a78bfa", "#60a5fa",
                        "#22d3ee", "#34d399", "#facc15",
                        "#fb923c", "#f87171", "#e879f9",
                        "#ffffff",
                      ].map((color) => {
                        const selected = chatMessageColor === color;
                        const isDark = ["#facc15","#34d399","#22d3ee","#ffffff"].includes(color);
                        return (
                          <button
                            key={color}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setChatMessageColor(color)}
                            className={`chat-color-swatch ${selected ? "is-selected" : ""}`}
                            style={{ ["--swatch" as any]: color, backgroundColor: color }}
                            data-testid={`button-chat-color-${color.replace("#", "")}`}
                            aria-label={`Set chat color ${color}`}
                          >
                            {selected && (
                              <svg viewBox="0 0 12 12" className="chat-color-check" aria-hidden="true" style={{ color: isDark ? "rgba(20,10,40,0.85)" : "rgba(255,255,255,0.9)" }}>
                                <path d="M2.5 6.2 L5 8.7 L9.5 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setChatMessageColor("")}
                      className="chat-color-reset-btn"
                      disabled={!chatMessageColor}
                      data-testid="button-chat-color-reset"
                    >
                      RESET TEXT COLOR
                    </button>

                    {/* ── Section divider ── */}
                    <div className="chat-color-section-divider" />

                    {/* ── Card background color section ── */}
                    <div className="chat-color-pop-head">
                      <span className="chat-color-pop-title">CARD COLOR</span>
                      <span
                        className="chat-color-pop-preview chat-color-pop-preview--card"
                        style={chatCardColor ? {
                          background: `linear-gradient(135deg, ${chatCardColor}55 0%, ${chatCardColor}35 100%)`,
                          borderColor: `${chatCardColor}66`,
                          boxShadow: `inset 0 1px 0 ${chatCardColor}44, 0 0 10px ${chatCardColor}30`,
                        } : {}}
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 16 12" fill="none" width="14" height="10" aria-hidden="true">
                          <rect x="0.75" y="0.75" width="14.5" height="10.5" rx="2.5" stroke="currentColor" strokeWidth="1.4" fill={chatCardColor ? `${chatCardColor}55` : "none"} />
                          <line x1="3" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
                          <line x1="3" y1="6.5" x2="10" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
                        </svg>
                      </span>
                    </div>
                    <div className="chat-color-grid" role="radiogroup" aria-label="Card background color">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={chatCardColor === ""}
                        onClick={() => setChatCardColor("")}
                        className={`chat-color-swatch chat-color-swatch--none ${chatCardColor === "" ? "is-selected" : ""}`}
                        data-testid="button-card-color-none"
                        aria-label="Default card color"
                        title="Default (no tint)"
                      >
                        {chatCardColor === "" && (
                          <svg viewBox="0 0 12 12" className="chat-color-check" aria-hidden="true" style={{ color: "rgba(200,185,255,0.9)" }}>
                            <path d="M2.5 6.2 L5 8.7 L9.5 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      {[
                        "#8b5cf6", "#4f46e5", "#2563eb",
                        "#0891b2", "#059669", "#d97706",
                        "#dc2626", "#db2777", "#7c3aed",
                        "#0d9488",
                      ].map((color) => {
                        const selected = chatCardColor === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setChatCardColor(color)}
                            className={`chat-color-swatch ${selected ? "is-selected" : ""}`}
                            style={{ ["--swatch" as any]: color, backgroundColor: color }}
                            data-testid={`button-card-color-${color.replace("#", "")}`}
                            aria-label={`Set card color ${color}`}
                          >
                            {selected && (
                              <svg viewBox="0 0 12 12" className="chat-color-check" aria-hidden="true" style={{ color: "rgba(255,255,255,0.90)" }}>
                                <path d="M2.5 6.2 L5 8.7 L9.5 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setChatCardColor("")}
                      className="chat-color-reset-btn"
                      disabled={!chatCardColor}
                      data-testid="button-card-color-reset"
                    >
                      RESET CARD COLOR
                    </button>

                    {/* ── Live preview of next message ── */}
                    {(chatMessageColor || chatCardColor) && (
                      <div className="chat-color-live-preview">
                        <div className="chat-color-live-preview-label">PREVIEW</div>
                        <div
                          className="chat-color-live-preview-bubble"
                          style={chatCardColor ? {
                            background: `linear-gradient(158deg, ${chatCardColor}72 0%, ${chatCardColor}52 52%, ${chatCardColor}38 100%)`,
                            borderColor: `${chatCardColor}55`,
                            borderTopColor: `${chatCardColor}88`,
                            boxShadow: `0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 ${chatCardColor}44`,
                          } : {}}
                        >
                          <span
                            className="chat-color-live-preview-text"
                            style={{ color: chatMessageColor || undefined }}
                          >
                            Hello! Your next message will look like this.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {featGifPicker && <GifPickerButton onGifSelect={(gifUrl) => {
                if (socket && user) {
                  socket.emit("room:chat", {
                    roomId: room.id,
                    userId: user.id,
                    text: `[gif:${gifUrl}]`,
                    messageColor: chatMessageColor,
                    cardColor: chatCardColor,
                    privateToId: privateChatToId === "public" ? null : privateChatToId,
                    replyTo: replyingTo || undefined,
                  });
                  setReplyingTo(null);
                }
              }} />}
              <ImageUploadButton onImageSelect={(imgUrl) => {
                if (socket && user) {
                  socket.emit("room:chat", {
                    roomId: room.id,
                    userId: user.id,
                    text: `[img:${imgUrl}]`,
                    messageColor: chatMessageColor,
                    cardColor: chatCardColor,
                    privateToId: privateChatToId === "public" ? null : privateChatToId,
                    replyTo: replyingTo || undefined,
                  });
                  setReplyingTo(null);
                }
              }} />

              {/* Auto-translate toggle + target language picker */}
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoTranslate(v => !v);
                        setAutoTranslatePreview(null);
                        setIsAutoTranslating(false);
                        if (autoTranslateTimerRef.current) clearTimeout(autoTranslateTimerRef.current);
                      }}
                      className="room-tool-btn"
                      data-active={autoTranslate}
                      data-testid="button-auto-translate-toggle"
                      aria-label={autoTranslate ? "Disable auto-translate" : "Enable auto-translate"}
                      aria-pressed={autoTranslate}
                    >
                      <Languages className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6} className="text-[11px]">
                    {autoTranslate
                      ? `Auto-translate ON → ${TRANSLATE_LANGUAGES.find(l => l.code === autoTranslateTarget)?.label ?? autoTranslateTarget} — click to disable`
                      : "Translate messages before sending"}
                  </TooltipContent>
                </Tooltip>
                {autoTranslate && (
                  <select
                    value={autoTranslateTarget}
                    onChange={e => {
                      setAutoTranslateTarget(e.target.value);
                      localStorage.setItem("vx-auto-translate-target", e.target.value);
                      setAutoTranslatePreview(null);
                    }}
                    className="h-6 text-[10px] rounded-md px-1 border cursor-pointer outline-none focus:ring-1 focus:ring-sky-400/40 transition-all"
                    style={{
                      background: "rgba(30,41,59,0.85)",
                      color: "rgba(148,213,252,0.9)",
                      borderColor: "rgba(56,189,248,0.3)",
                      maxWidth: "90px",
                    }}
                    data-testid="select-auto-translate-target"
                    aria-label="Translate to language"
                    title="Translate to language"
                  >
                    {TRANSLATE_LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>→ {l.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>


      <div className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" style={{ display: sidePanelTab === "youtube" ? "flex" : "none" }}>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* ── Search + close-for-everyone (starter-only) ── */}
          <div className="p-3 pb-2.5 border-b border-border/40 bg-muted/5 flex-shrink-0 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                value={youtubeSearch}
                onChange={(e) => handleYoutubeSearchInput(e.target.value)}
                placeholder="Search YouTube…"
                className="pl-9 text-[13px] rounded-xl bg-muted/30 border-border/50 placeholder:text-muted-foreground/40 focus-visible:ring-red-400/30 focus-visible:border-red-400/40 h-9"
                data-testid="input-youtube-search"
              />
              {youtubeSearching && (
                <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 animate-spin" />
              )}
            </div>
            {activeYoutubeId && user?.id === youtubeStartedBy && (
              <button
                onClick={handleStopYoutube}
                title="Close this video for everyone (only you, the starter, can close it)"
                data-testid="button-stop-youtube-panel"
                className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5" />
                Close video for everyone
              </button>
            )}
            {activeYoutubeId && user?.id !== youtubeStartedBy && showYoutube && (
              <button
                onClick={() => { setShowYoutube(false); setUserDismissedYoutube(true); setMiniPlayerMode(false); }}
                title="Hide this video — just for you. Others keep watching."
                data-testid="button-hide-youtube-panel"
                className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-muted/30 border border-border/40 text-muted-foreground text-[11px] font-medium hover:bg-muted/50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Hide video (just for me)
              </button>
            )}
            {activeYoutubeId && user?.id !== youtubeStartedBy && !showYoutube && (() => {
              const broadcaster = youtubeStartedBy ? participantById.get(youtubeStartedBy) : undefined;
              return (
                <button
                  onClick={() => {
                    setShowYoutube(true);
                    setUserDismissedYoutube(false);
                    setSidePanelOpen(false);
                    // Multiple sync attempts to reliably catch up to the starter,
                    // even on slow connections where the player needs time to load.
                    setTimeout(() => { try { handleYtSyncToStarter(); } catch (_) {} }, 1200);
                    setTimeout(() => { try { handleYtSyncToStarter(); } catch (_) {} }, 3200);
                    setTimeout(() => { try { handleYtSyncToStarter(); } catch (_) {} }, 6500);
                  }}
                  data-testid="button-join-watch-party"
                  className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-semibold hover:bg-red-500/25 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-red-400" />
                  {broadcaster ? `Watch ${getUserDisplayName(broadcaster)}'s video` : "Watch the video"}
                </button>
              );
            })()}
          </div>

          {/* ── Queue ── */}
          {ytQueue.length > 0 && (
            <div className="mx-3 mb-1 mt-1 rounded-xl border border-border/30 bg-muted/5 overflow-hidden flex-shrink-0" data-testid="youtube-queue-section">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/20">
                <ListVideo className="w-3.5 h-3.5 text-red-400/80" />
                <p className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wide">Up Next ({ytQueue.length})</p>
              </div>
              <div className="divide-y divide-border/20">
                {ytQueue.map((item, idx) => {
                  const adder = participants.find(p => p.id === item.addedBy);
                  return (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/20 transition-colors group" data-testid={`queue-item-${item.id}`}>
                      <span className="text-[10px] text-muted-foreground/50 font-mono w-3 flex-shrink-0">{idx + 1}</span>
                      {item.thumbnail ? (
                        <img loading="lazy" decoding="async" src={item.thumbnail} alt="" className="w-12 h-8 rounded object-cover flex-shrink-0 bg-muted" />
                      ) : (
                        <div className="w-12 h-8 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                          <Youtube className="w-3 h-3 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium line-clamp-1 leading-tight">{item.title || "Video"}</p>
                        {adder && (
                          <p className="text-[9px] text-muted-foreground/50 mt-0.5">by {getUserDisplayName(adder)}</p>
                        )}
                      </div>
                      {canPlayYoutube && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleSelectYoutubeVideo(item.videoId)}
                            className="p-1 rounded hover:bg-red-500/15 text-red-400/70 hover:text-red-400 transition-colors"
                            title="Play now"
                            data-testid={`button-queue-play-${item.id}`}
                          >
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                          <button
                            onClick={() => handleRemoveFromQueue(item.id)}
                            className="p-1 rounded hover:bg-muted/40 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                            title="Remove from queue"
                            data-testid={`button-queue-remove-${item.id}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── EVERYONE: search results + trending ── */}
          {true && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-3 overflow-x-hidden">
                {youtubeResults.length > 0 && (
                  <div className="space-y-2" data-testid="youtube-search-results">
                    <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest px-0.5">Results</p>
                    {youtubeResults.map((video: any) => (
                      <div
                        key={video.id}
                        className="rounded-xl overflow-hidden border border-border/30 bg-muted/10 hover:border-border/50 transition-all duration-150 group"
                        data-testid={`button-youtube-result-${video.id}`}
                      >
                        <div className="relative w-full aspect-video bg-muted overflow-hidden cursor-pointer" onClick={() => handleSelectYoutubeVideo(video.id)}>
                          <img loading="lazy" decoding="async" src={video.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          {video.duration && (
                            <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />{video.duration}
                            </span>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <div className="p-2.5 pb-2">
                          <p className="text-[12px] font-medium line-clamp-2 leading-snug">{video.title}</p>
                          {video.channelTitle && (
                            <span className="text-[10px] text-muted-foreground/60 mt-1 block truncate">{video.channelTitle}</span>
                          )}
                          {canPlayYoutube && (
                            <div className="flex gap-1.5 mt-2">
                              <button
                                onClick={() => handleSelectYoutubeVideo(video.id)}
                                className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-medium hover:bg-red-500/25 transition-colors"
                                data-testid={`button-play-now-${video.id}`}
                              >
                                <Play className="w-2.5 h-2.5 fill-red-400" /> Play Now
                              </button>
                              <button
                                onClick={() => handleAddToQueue({ id: video.id, title: video.title, thumbnail: video.thumbnail })}
                                className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-muted/20 border border-border/30 text-muted-foreground text-[10px] font-medium hover:bg-muted/40 transition-colors"
                                data-testid={`button-add-queue-${video.id}`}
                              >
                                <ListVideo className="w-2.5 h-2.5" /> Add to Queue
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {youtubeSearch.trim() && !youtubeSearching && youtubeResults.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <Youtube className="w-8 h-8 text-muted-foreground/20" />
                    <p className="text-[11px] text-muted-foreground/50">No results found</p>
                  </div>
                )}
                {!youtubeSearch.trim() && (
                  <div className="space-y-2">
                    {/* ── Section tabs ── */}
                    <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted/20 border border-border/30">
                      {([
                        { id: "foryou", label: "For You", icon: <Sparkles className="w-3 h-3" /> },
                        { id: "history", label: "History", icon: <Clock className="w-3 h-3" /> },
                        { id: "browse", label: "Browse", icon: <TrendingUp className="w-3 h-3" /> },
                      ] as const).map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setYtPanelSection(tab.id)}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                            ytPanelSection === tab.id
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tab.icon}{tab.label}
                        </button>
                      ))}
                    </div>

                    {/* ── For You ── */}
                    {ytPanelSection === "foryou" && (
                      <div className="space-y-2">
                        {ytSuggestedLoading && (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
                          </div>
                        )}
                        {!ytSuggestedLoading && ytSuggested.length > 0 && (
                          <>
                            <div className="flex items-center gap-1.5 px-0.5">
                              <Sparkles className="w-3 h-3 text-amber-400/80" />
                              <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest">Suggested for you</p>
                            </div>
                            {ytSuggested.map((video: any) => (
                              <YtVideoCard key={video.id} video={video} canPlay={canPlayYoutube} onPlay={handleSelectYoutubeVideo} onQueue={handleAddToQueue} />
                            ))}
                            <div className="flex items-center gap-1.5 px-0.5 pt-2 border-t border-border/20">
                              <TrendingUp className="w-3 h-3 text-red-400/70" />
                              <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest">Trending</p>
                            </div>
                          </>
                        )}
                        {!ytSuggestedLoading && ytSuggested.length === 0 && ytHistory.length === 0 && (
                          <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                            <Sparkles className="w-7 h-7 text-muted-foreground/20" />
                            <p className="text-[11px] text-muted-foreground/50">Watch a few videos and we'll personalise this for you</p>
                          </div>
                        )}
                        {youtubeFeaturedLoading && (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
                          </div>
                        )}
                        {!youtubeFeaturedLoading && youtubeFeatured.map((video: any) => (
                          <YtVideoCard key={video.id} video={video} canPlay={canPlayYoutube} onPlay={handleSelectYoutubeVideo} onQueue={handleAddToQueue} />
                        ))}
                      </div>
                    )}

                    {/* ── History ── */}
                    {ytPanelSection === "history" && (
                      <div className="space-y-2">
                        {ytHistory.length === 0 ? (
                          <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                            <Clock className="w-7 h-7 text-muted-foreground/20" />
                            <p className="text-[11px] text-muted-foreground/50">Videos you play will appear here</p>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between px-0.5">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-muted-foreground/60" />
                                <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest">Recently Watched</p>
                              </div>
                              <button
                                onClick={() => {
                                  if (!user?.id) return;
                                  setYtHistory([]);
                                  try { localStorage.removeItem(`vx_yt_history_${user.id}`); } catch {}
                                }}
                                className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                              >
                                Clear all
                              </button>
                            </div>
                            {ytHistory.map((video) => (
                              <div key={video.id} className="flex flex-col gap-1.5 p-2 rounded-xl border border-border/25 bg-muted/8 hover:bg-muted/20 transition-colors group overflow-hidden">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="relative w-14 h-9 rounded-md overflow-hidden flex-shrink-0 bg-muted cursor-pointer" onClick={() => handleSelectYoutubeVideo(video.id)}>
                                    {video.thumbnail ? (
                                      <img loading="lazy" decoding="async" src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center"><Youtube className="w-4 h-4 text-muted-foreground/30" /></div>
                                    )}
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Play className="w-3 h-3 text-white fill-white" />
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-medium line-clamp-2 leading-snug">{video.title}</p>
                                    {video.channelTitle && <p className="text-[9px] text-muted-foreground/50 mt-0.5 truncate">{video.channelTitle}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 w-full">
                                  {canPlayYoutube && (
                                    <button
                                      onClick={() => handleSelectYoutubeVideo(video.id)}
                                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-red-500/15 border border-red-500/25 text-red-400 text-[9px] font-semibold hover:bg-red-500/25 transition-colors"
                                    >
                                      <Play className="w-2.5 h-2.5 fill-current" /> Play
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (!user?.id) return;
                                      setYtHistory(prev => {
                                        const next = prev.filter(h => h.id !== video.id);
                                        try { localStorage.setItem(`vx_yt_history_${user.id}`, JSON.stringify(next)); } catch {}
                                        return next;
                                      });
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-muted/20 border border-border/20 text-muted-foreground/50 text-[9px] font-medium hover:text-muted-foreground/80 hover:bg-muted/40 transition-colors"
                                  >
                                    <X className="w-2.5 h-2.5" /> Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}

                    {/* ── Browse ── */}
                    {ytPanelSection === "browse" && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1" data-testid="youtube-category-filter">
                          {[
                            { id: "conversation", label: "Conversation" },
                            { id: "vocabulary", label: "Vocabulary" },
                            { id: "grammar", label: "Grammar" },
                            { id: "pronunciation", label: "Pronunciation" },
                            { id: "music", label: "Music" },
                            { id: "news", label: "News" },
                            { id: "movies", label: "Movies" },
                            { id: "kids", label: "Kids" },
                            { id: "ielts", label: "IELTS" },
                            { id: "business", label: "Business" },
                          ].map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setYoutubeCategory(c.id)}
                              className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                                youtubeCategory === c.id
                                  ? "border-red-500/50 bg-red-500/15 text-red-400"
                                  : "border-border/40 bg-muted/15 text-muted-foreground hover:bg-muted/30"
                              }`}
                              data-testid={`button-yt-category-${c.id}`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                        {youtubeFeaturedLoading && (
                          <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
                          </div>
                        )}
                        {!youtubeFeaturedLoading && youtubeFeatured.map((video: any) => (
                          <YtVideoCard key={video.id} video={video} canPlay={canPlayYoutube} onPlay={handleSelectYoutubeVideo} onQueue={handleAddToQueue} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

        </div>
      </div>

      {/* ── Movies Panel ── */}
      <div className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" style={{ display: sidePanelTab === "movies" ? "flex" : "none" }}>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Search bar */}
          <div className="p-3 pb-2.5 border-b border-border/40 bg-muted/5 flex-shrink-0 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                value={movieSearch}
                onChange={(e) => handleMovieSearchInput(e.target.value)}
                placeholder="Search movies…"
                className="pl-9 text-[13px] rounded-xl bg-muted/30 border-border/50 placeholder:text-muted-foreground/40 focus-visible:ring-violet-400/30 focus-visible:border-violet-400/40 h-9"
                data-testid="input-movie-search"
              />
              {movieSearching && (
                <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 animate-spin" />
              )}
            </div>
            {activeMovieId && user?.id === movieStartedBy && (
              <button
                onClick={handleStopMovie}
                data-testid="button-stop-movie-panel"
                className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5" />
                Close movie for everyone
              </button>
            )}
            {activeMovieId && user?.id !== movieStartedBy && showMovie && (
              <button
                onClick={() => { setShowMovie(false); setMovieStartedBy(null); setActiveMovieId(null); }}
                data-testid="button-hide-movie-panel"
                className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-muted/30 border border-border/40 text-muted-foreground text-[11px] font-medium hover:bg-muted/50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Hide movie (just for me)
              </button>
            )}
            {activeMovieId && user?.id !== movieStartedBy && !showMovie && (() => {
              const broadcaster = movieStartedBy ? participantById.get(movieStartedBy) : undefined;
              return (
                <button
                  onClick={() => {
                    const _serverTime = movieStartedBy ? movieCurrentTimeByHost.get(movieStartedBy) : undefined;
                    const _startedAt = movieStartedBy ? movieHostStartedAt.get(movieStartedBy) : undefined;
                    const _offset = typeof _serverTime === "number"
                      ? Math.floor(_serverTime)
                      : (_startedAt ? Math.floor((Date.now() - _startedAt) / 1000) : 0);
                    setShowYoutube(false);
                    setMiniPlayerMode(false);
                    setMovieStartOffset(_offset);
                    setMovieSyncKey(k => k + 1);
                    setShowMovie(true);
                    socket?.emit("room:movie-watching", { roomId: room.id, hostId: movieStartedBy, watching: true });
                  }}
                  data-testid="button-join-movie"
                  className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 text-[11px] font-semibold hover:bg-violet-500/25 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-violet-400" />
                  {broadcaster ? `Watch ${getUserDisplayName(broadcaster)}'s movie` : "Watch the movie"}
                </button>
              );
            })()}
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-3">
              {/* Search results */}
              {movieResults.length > 0 && (
                <div className="space-y-2" data-testid="movie-search-results">
                  <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest px-0.5">Results</p>
                  {movieResults.map((movie: any) => (
                    <div
                      key={movie.id}
                      className="rounded-xl overflow-hidden border border-border/30 bg-muted/10 hover:border-border/50 transition-all duration-150 group"
                      data-testid={`button-movie-result-${movie.id}`}
                    >
                      <div className="flex gap-3 p-2.5">
                        {movie.poster ? (
                          <img
                            loading="lazy"
                            decoding="async"
                            src={movie.poster}
                            alt={movie.title}
                            width={56}
                            height={84}
                            className="w-14 h-[84px] rounded-lg object-cover flex-shrink-0 bg-muted group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-14 h-[84px] rounded-lg bg-muted flex-shrink-0 flex items-center justify-center">
                            <Film className="w-5 h-5 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <p className="text-[12px] font-semibold line-clamp-2 leading-snug">{movie.title}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {movie.year && <span className="text-[10px] text-muted-foreground/60">{movie.year}</span>}
                              {movie.rating && movie.rating !== "0.0" && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-400/80">
                                  <Star className="w-2.5 h-2.5 fill-amber-400/80" />{movie.rating}
                                </span>
                              )}
                            </div>
                            {movie.overview && (
                              <p className="text-[10px] text-muted-foreground/50 mt-1 line-clamp-2 leading-relaxed">{movie.overview}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleSelectMovie(movie)}
                            className="mt-2 flex items-center justify-center gap-1 py-1 rounded-md bg-violet-500/15 border border-violet-500/25 text-violet-400 text-[10px] font-medium hover:bg-violet-500/25 transition-colors"
                            data-testid={`button-watch-movie-${movie.id}`}
                          >
                            <Play className="w-2.5 h-2.5 fill-violet-400" /> Watch Now
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {movieSearch.trim() && !movieSearching && movieResults.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10">
                  <Film className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-[11px] text-muted-foreground/50">No movies found</p>
                </div>
              )}

              {/* Popular movies */}
              {!movieSearch.trim() && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-0.5">
                    <TrendingUp className="w-3 h-3 text-violet-400/70" />
                    <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest">Popular Movies</p>
                  </div>
                  {popularMoviesLoading && (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
                    </div>
                  )}
                  {!popularMoviesLoading && popularMovies.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-10">
                      <Film className="w-8 h-8 text-muted-foreground/20" />
                      <p className="text-[11px] text-muted-foreground/50">Search for a movie to get started</p>
                    </div>
                  )}
                  {popularMovies.map((movie: any) => (
                    <div
                      key={movie.id}
                      className="rounded-xl overflow-hidden border border-border/30 bg-muted/10 hover:border-violet-500/30 hover:bg-muted/20 transition-all duration-150 group"
                      data-testid={`button-popular-movie-${movie.id}`}
                    >
                      <div className="flex gap-3 p-2.5">
                        {movie.poster ? (
                          <img
                            loading="lazy"
                            decoding="async"
                            src={movie.poster}
                            alt={movie.title}
                            width={48}
                            height={72}
                            className="w-12 h-[72px] rounded-lg object-cover flex-shrink-0 bg-muted group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-12 h-[72px] rounded-lg bg-muted flex-shrink-0 flex items-center justify-center">
                            <Film className="w-4 h-4 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <p className="text-[11px] font-semibold line-clamp-2 leading-snug">{movie.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {movie.year && <span className="text-[10px] text-muted-foreground/60">{movie.year}</span>}
                              {movie.rating && movie.rating !== "0.0" && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-400/80">
                                  <Star className="w-2.5 h-2.5 fill-amber-400/80" />{movie.rating}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleSelectMovie(movie)}
                            className="mt-1.5 flex items-center justify-center gap-1 py-1 rounded-md bg-violet-500/15 border border-violet-500/25 text-violet-400 text-[10px] font-medium hover:bg-violet-500/25 transition-colors"
                            data-testid={`button-watch-popular-${movie.id}`}
                          >
                            <Play className="w-2.5 h-2.5 fill-violet-400" /> Watch
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Active movie hosts in room */}
              {movieHosts.size > 0 && !activeMovieId && (
                <div className="space-y-1.5 mt-2">
                  <div className="flex items-center gap-1.5 px-0.5">
                    <Film className="w-3 h-3 text-violet-400/70" />
                    <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest">Watching Now in Room</p>
                  </div>
                  {Array.from(movieHosts.entries()).map(([hostId, info]) => {
                    const host = participants.find(p => p.id === hostId);
                    if (!host) return null;
                    return (
                      <div key={hostId} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-violet-500/20 bg-violet-500/5">
                        <Avatar className="w-7 h-7 flex-shrink-0">
                          <AvatarImage src={host.profileImageUrl || undefined} />
                          <AvatarFallback className="text-[10px] bg-violet-500/20">{getUserInitials(host)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate">{getUserDisplayName(host)}</p>
                          <p className="text-[10px] text-muted-foreground/60 truncate">watching: {info.movieTitle}</p>
                        </div>
                        <button
                          onClick={() => {
                            const _serverTime = movieCurrentTimeByHost.get(hostId);
                            const _startedAt = movieHostStartedAt.get(hostId);
                            const _offset = typeof _serverTime === "number"
                              ? Math.floor(_serverTime)
                              : (_startedAt ? Math.floor((Date.now() - _startedAt) / 1000) : 0);
                            setShowYoutube(false);
                            setMiniPlayerMode(false);
                            setActiveMovieId(info.movieId);
                            setActiveMovieTitle(info.movieTitle);
                            setActiveMoviePoster(info.posterPath);
                            setMovieStartedBy(hostId);
                            setMovieStartOffset(_offset);
                            setMovieSyncKey(k => k + 1);
                            setShowMovie(true);
                            socket?.emit("room:movie-watching", { roomId: room.id, hostId, watching: true });
                          }}
                          className="flex-shrink-0 px-2 py-1 rounded-md bg-violet-500/15 border border-violet-500/25 text-violet-400 text-[10px] font-medium hover:bg-violet-500/25 transition-colors"
                          data-testid={`button-join-movie-${hostId}`}
                        >
                          Join
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" style={{ display: sidePanelTab === "read" ? "flex" : "none" }}>
        {sharedBook && !selectedBook && (
          <div className="m-3 p-3 rounded-xl border border-green-500/30 bg-green-500/5 space-y-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-green-600">Read Together Invite</p>
            </div>
            <div className="flex items-start gap-2">
              {sharedBook.formats?.["image/jpeg"] && (
                <img loading="lazy" decoding="async" src={sharedBook.formats["image/jpeg"]} alt="" className="w-8 h-11 rounded object-cover flex-shrink-0 bg-muted" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium line-clamp-2">{sharedBook.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {sharedBook.authors?.map((a: any) => a.name).join(", ")}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full bg-green-600 hover:bg-green-500 text-white"
              onClick={() => handleJoinReadTogether(sharedBook)}
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Read Together
            </Button>
          </div>
        )}

        {audioPlayer !== null ? (
          /* ── In-platform audiobook player ─────────────────────────── */
          <div className="flex flex-col flex-1 min-h-0">
            {/* Player header */}
            <div className="flex items-start gap-2.5 p-3 border-b flex-shrink-0">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "hsla(var(--neu-orange) / 0.16)", border: "1px solid hsla(var(--neu-orange) / 0.28)" }}>
                <Headphones className="w-5 h-5" style={{ color: "hsla(var(--neu-orange-hi) / 0.9)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold line-clamp-2 leading-tight">{audioPlayer.book.title}</p>
                {audioPlayer.book.author && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{audioPlayer.book.author}</p>
                )}
                {audioPlayer.chapters.length > 0 && !audioPlayer.loading && (
                  <p className="text-[10px] mt-0.5" style={{ color: "hsla(var(--neu-orange-hi) / 0.7)" }}>
                    Chapter {audioPlayer.chapterIdx + 1} of {audioPlayer.chapters.length}
                  </p>
                )}
              </div>
              <button
                onClick={() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; } setAudioPlayer(null); }}
                className="p-1 rounded hover:opacity-70 transition-opacity flex-shrink-0 mt-0.5"
                data-testid="button-close-audioplayer"
                aria-label="Close audio player"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Loading state */}
            {audioPlayer.loading && (
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading chapters…</span>
              </div>
            )}

            {/* No chapters fallback */}
            {!audioPlayer.loading && audioPlayer.chapters.length === 0 && (
              <div className="p-4 text-center space-y-2">
                <p className="text-[11px] text-muted-foreground">Chapter audio unavailable for this book.</p>
                {audioPlayer.book.url && (
                  <a href={audioPlayer.book.url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                    Open on LibriVox <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Audio controls + chapter list */}
            {!audioPlayer.loading && audioPlayer.chapters.length > 0 && (
              <>
                {/* Controls */}
                <div className="flex flex-col gap-2 px-3 py-2.5 border-b flex-shrink-0">
                  <p className="text-[10px] font-medium truncate" style={{ color: "hsla(var(--neu-orange-hi) / 0.85)" }}>
                    {audioPlayer.chapters[audioPlayer.chapterIdx]?.title}
                    {audioPlayer.chapters[audioPlayer.chapterIdx]?.duration && (
                      <span className="text-muted-foreground ml-1">· {audioPlayer.chapters[audioPlayer.chapterIdx].duration}</span>
                    )}
                  </p>
                  <audio
                    ref={audioRef}
                    src={audioPlayer.chapters[audioPlayer.chapterIdx]?.url || ""}
                    controls
                    onEnded={() => {
                      if (audioPlayer.chapterIdx < audioPlayer.chapters.length - 1) {
                        handleAudioChapter(audioPlayer.chapterIdx + 1);
                      }
                    }}
                    preload="metadata"
                    className="w-full h-8"
                    style={{ accentColor: "hsla(var(--neu-orange-hi) / 0.9)" }}
                    data-testid="audio-player-controls"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => audioPlayer.chapterIdx > 0 && handleAudioChapter(audioPlayer.chapterIdx - 1)}
                      disabled={audioPlayer.chapterIdx === 0}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                      data-testid="button-prev-chapter"
                    >
                      <SkipBack className="w-3 h-3" /> Prev
                    </button>
                    <span className="text-[10px] text-muted-foreground">{audioPlayer.chapterIdx + 1} / {audioPlayer.chapters.length}</span>
                    <button
                      onClick={() => audioPlayer.chapterIdx < audioPlayer.chapters.length - 1 && handleAudioChapter(audioPlayer.chapterIdx + 1)}
                      disabled={audioPlayer.chapterIdx === audioPlayer.chapters.length - 1}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                      data-testid="button-next-chapter"
                    >
                      Next <SkipForward className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Chapter list */}
                <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 flex-shrink-0">
                  <ListMusic className="w-3 h-3 text-muted-foreground" />
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Chapters</p>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="px-3 pb-3 space-y-0.5">
                    {audioPlayer.chapters.map((ch, i) => (
                      <button
                        key={i}
                        onClick={() => handleAudioChapter(i)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${i === audioPlayer.chapterIdx ? "bg-orange-500/15 text-orange-300" : "hover:bg-muted/50 text-foreground/80"}`}
                        data-testid={`button-chapter-${i}`}
                      >
                        <span className="text-[9px] w-4 text-center opacity-50 flex-shrink-0">{ch.n}</span>
                        <span className="text-[11px] flex-1 min-w-0 truncate">{ch.title}</span>
                        {ch.duration && <span className="text-[9px] text-muted-foreground flex-shrink-0">{ch.duration}</span>}
                        {i === audioPlayer.chapterIdx && <Volume1 className="w-3 h-3 flex-shrink-0" style={{ color: "hsla(var(--neu-orange-hi) / 0.8)" }} />}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        ) : selectedBook && showEReader ? (
          <div className="flex flex-col flex-1 min-h-0 p-3 gap-3">
            <div className="p-3 rounded-xl border space-y-3">
              <div className="flex items-start gap-2">
                {(selectedBook.formats?.["image/jpeg"] || selectedBook.coverUrl) ? (
                  <img loading="lazy" decoding="async" src={selectedBook.formats?.["image/jpeg"] || selectedBook.coverUrl} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0 bg-muted" />
                ) : (
                  <div className="w-10 h-14 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-tight line-clamp-2">{selectedBook.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {selectedBook.authors?.map((a: any) => a.name).join(", ") || selectedBook.author}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 font-medium">
                      {isFollowingBook ? "Following Host" : "Reading"}
                    </span>
                    {bookReaders.size > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {bookReaders.size} reading
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {isHost && !isFollowingBook && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <BookOpen className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <p className="text-[10px] text-green-600 font-medium">Shared with room — scroll is synced</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Reader Theme</p>
                <div className="flex gap-2">
                  {(["sepia", "light", "dark"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setEReaderTheme(t)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium border-2 transition-all ${eReaderTheme === t ? "border-primary" : "border-border opacity-60 hover:opacity-90"}`}
                      style={{ background: t === "sepia" ? "#f5ead5" : t === "light" ? "#f8f8f8" : "#1a1a1a", color: t === "dark" ? "#d4c9b0" : "#333" }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Font Size</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEReaderFontSize(s => Math.max(12, s - 2))}
                    className="flex-1 py-1.5 rounded-md border text-sm font-bold hover:bg-muted/50 transition-colors"
                  >A−</button>
                  <span className="text-xs text-muted-foreground w-10 text-center">{eReaderFontSize}px</span>
                  <button
                    onClick={() => setEReaderFontSize(s => Math.min(28, s + 2))}
                    className="flex-1 py-1.5 rounded-md border text-sm font-bold hover:bg-muted/50 transition-colors"
                  >A+</button>
                </div>
              </div>
            </div>
            {selectedBook?._isYtArticle && (
              <Button
                size="sm"
                className="w-full"
                disabled={savingArticle || articleSaved}
                onClick={saveCurrentArticle}
                style={articleSaved ? { background: "hsla(var(--neu-green, 142 76% 36%) / 0.18)", borderColor: "hsla(var(--neu-green, 142 76% 36%) / 0.4)", color: "#22c55e" } : {}}
              >
                {savingArticle ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
                ) : articleSaved ? (
                  <><svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Saved to Library</>
                ) : (
                  <><BookOpen className="w-3.5 h-3.5 mr-1.5" />Save to My Library</>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleCloseBook}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> {isHost ? "Close & Stop Sharing" : "Close Book"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* ── Library tab switcher ───────────────────────────────── */}
            <div className="flex items-center gap-0.5 px-3 pt-2.5 pb-0 flex-shrink-0">
              {([
                ["library", "Library", <BookOpen key="lib" className="w-3 h-3" />],
                ["saved", "Saved", <svg key="sav" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>],
                ["history", "History", <Clock key="his" className="w-3 h-3" />],
              ] as [string, string, React.ReactNode][]).map(([tab, label, icon]) => (
                <button
                  key={tab}
                  onClick={() => setLibraryTab(tab as "library" | "saved" | "history")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-t-md text-[11px] font-semibold transition-all flex-1 justify-center"
                  style={libraryTab === tab
                    ? { background: "hsla(var(--neu-orange)/0.14)", color: "hsla(var(--neu-orange-hi)/0.92)", borderBottom: "2px solid hsla(var(--neu-orange)/0.7)" }
                    : { color: "hsla(var(--foreground)/0.45)", borderBottom: "2px solid transparent" }
                  }
                  data-testid={`tab-library-${tab}`}
                >
                  {icon}{label}
                  {tab === "saved" && savedArticles.length > 0 && (
                    <span className="ml-0.5 rounded-full px-1 text-[9px] font-bold" style={{ background: "hsla(var(--neu-orange)/0.22)", color: "hsla(var(--neu-orange-hi)/0.9)" }}>{savedArticles.length}</span>
                  )}
                  {tab === "history" && readingHistory.length > 0 && (
                    <span className="ml-0.5 rounded-full px-1 text-[9px] font-bold" style={{ background: "hsla(220 14% 50%/0.18)", color: "hsla(var(--muted-foreground)/0.8)" }}>{readingHistory.length}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="border-b flex-shrink-0 mb-0" />

            {/* ── Library tab: book search + YouTube search inputs ───────── */}
            {libraryTab === "library" && (
            <div className="border-b flex-shrink-0">
              {/* Book search */}
              <div className="p-3 pb-2 space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={readSearch}
                      onChange={(e) => { setReadSearch(e.target.value); if (!e.target.value.trim()) { setReadBooks([]); loadDefaultBooks(); } }}
                      placeholder="Search books by title or author…"
                      className="pl-8 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") searchGutenberg(readSearch); }}
                      data-testid="input-book-search"
                    />
                  </div>
                  <Button size="sm" onClick={() => searchGutenberg(readSearch)} disabled={readLoading || !readSearch.trim()} data-testid="button-book-search">
                    {readLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                  </Button>
                </div>

                {/* YouTube section toggle — collapsed by default so the book list gets full height */}
                <button
                  onClick={() => setYtReadSectionExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors hover:bg-muted/40"
                  style={{ color: "hsla(var(--neu-orange-hi) / 0.80)" }}
                  data-testid="button-yt-section-toggle"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                    Read from YouTube
                  </span>
                  <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${ytReadSectionExpanded ? "rotate-90" : ""}`} />
                </button>
              </div>

              {/* YouTube inputs — only visible when expanded */}
              {ytReadSectionExpanded && (
                <div className="px-3 pb-3 space-y-1.5">
                  {/* Direct URL paste */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <svg className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-red-400/70" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                      <Input
                        value={ytDirectUrl}
                        onChange={(e) => { setYtDirectUrl(e.target.value); setYtArticleError(""); }}
                        placeholder="Paste YouTube URL to extract transcript…"
                        className="pl-7 text-xs"
                        onKeyDown={(e) => { if (e.key === "Enter" && ytDirectUrl.trim()) handleYtToArticle(ytDirectUrl.trim()); }}
                        data-testid="input-yt-direct-url"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleYtToArticle(ytDirectUrl.trim())}
                      disabled={ytArticleLoading || !ytDirectUrl.trim()}
                      data-testid="button-yt-extract"
                      style={{ background: "hsla(var(--neu-orange) / 0.18)", borderColor: "hsla(var(--neu-orange) / 0.32)", color: "hsla(var(--neu-orange-hi) / 0.92)" }}
                      className="border hover:opacity-90 transition-opacity flex-shrink-0"
                    >
                      {ytArticleLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Read"}
                    </Button>
                  </div>
                  {/* YouTube search */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                      <Input
                        value={ytReadSearch}
                        onChange={(e) => { setYtReadSearch(e.target.value); setYtArticleError(""); if (!e.target.value.trim()) setYtReadResults([]); }}
                        placeholder="Or search YouTube videos to read…"
                        className="pl-7 text-xs"
                        onKeyDown={(e) => { if (e.key === "Enter") searchYtRead(ytReadSearch); }}
                        data-testid="input-yt-read-search"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => searchYtRead(ytReadSearch)}
                      disabled={ytReadSearchLoading || !ytReadSearch.trim()}
                      data-testid="button-yt-read-search"
                      style={{ background: "hsla(var(--neu-orange) / 0.10)", borderColor: "hsla(var(--neu-orange) / 0.25)", color: "hsla(var(--neu-orange-hi) / 0.80)" }}
                      className="border hover:opacity-90 transition-opacity flex-shrink-0"
                    >
                      {ytReadSearchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Search"}
                    </Button>
                  </div>
                  {ytArticleError && (
                    <p className="text-[10px] text-red-400/90 px-0.5" data-testid="text-yt-article-error">{ytArticleError}</p>
                  )}
                </div>
              )}
            </div>
            )}

            {/* YouTube conversion preparation progress */}
            {ytArticleLoading && (
              <div className="mx-3 mt-2 mb-0 p-3 rounded-xl border border-orange-500/25 bg-orange-500/5 space-y-2.5 flex-shrink-0" data-testid="section-yt-converting">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" style={{ color: "hsla(var(--neu-orange-hi)/0.85)" }} />
                  <p className="text-[11px] font-semibold" style={{ color: "hsla(var(--neu-orange-hi)/0.9)" }}>
                    {ytConvertStep === 1 ? "Connecting to YouTube…" : ytConvertStep === 2 ? "Extracting captions…" : "Building article…"}
                  </p>
                </div>
                <div className="space-y-1">
                  {[
                    { step: 1, label: "Fetch video info" },
                    { step: 2, label: "Extract captions" },
                    { step: 3, label: "Build readable article" },
                  ].map(({ step, label }) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${ytConvertStep > step ? "bg-green-500" : ytConvertStep === step ? "bg-orange-400 animate-pulse" : "bg-muted/40"}`}>
                        {ytConvertStep > step && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                      <p className={`text-[10px] transition-colors ${ytConvertStep >= step ? "text-foreground/80" : "text-muted-foreground/40"}`}>{label}</p>
                    </div>
                  ))}
                </div>
                <div className="w-full h-1 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${ytConvertStep === 1 ? 15 : ytConvertStep === 2 ? 55 : 90}%`,
                      background: "linear-gradient(90deg, hsla(var(--neu-orange)/0.7), hsla(var(--neu-orange-hi)/0.9))",
                    }}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground/50 text-center">This may take a few seconds</p>
              </div>
            )}

            {/* ── Library tab: YT search results + books ─────────────── */}
            {libraryTab === "library" && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 space-y-2">
                  {(readLoading || ytReadSearchLoading) && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      {ytReadSearchLoading && <p className="text-[10px] text-muted-foreground/60">Searching YouTube…</p>}
                    </div>
                  )}
                  {ytReadResults.length > 0 && !ytReadSearchLoading && (
                    <div className="space-y-1.5 pb-1" data-testid="section-yt-results">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-1">
                        <svg className="w-3 h-3 flex-shrink-0 text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                        Videos — click to read
                      </p>
                      {ytReadResults.map((v) => {
                        const isThisConverting = ytConvertingId === v.id;
                        const isOtherConverting = ytArticleLoading && !isThisConverting;
                        return (
                        <button
                          key={v.id}
                          onClick={() => {
                            if (!ytArticleLoading) {
                              setYtArticleError("");
                              handleYtToArticle(`https://www.youtube.com/watch?v=${v.id}`, v.duration, v.id);
                            }
                          }}
                          disabled={ytArticleLoading}
                          className="w-full flex items-start gap-2.5 p-2 rounded-lg border border-border/50 hover:bg-muted/40 text-left transition-colors group disabled:opacity-50"
                          style={isThisConverting ? { borderColor: "hsla(var(--neu-orange)/0.5)", background: "hsla(var(--neu-orange)/0.06)" } : undefined}
                          data-testid={`button-yt-result-${v.id}`}
                        >
                          <div className="relative flex-shrink-0 w-16 h-10 rounded overflow-hidden bg-muted">
                            <img loading="lazy" decoding="async" src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                            {isThisConverting ? (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/60"><Loader2 className="w-3 h-3 animate-spin text-white" /></div>
                            ) : isOtherConverting ? null : (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"><BookOpen className="w-3.5 h-3.5 text-white" /></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold line-clamp-2 leading-tight">{v.title}</p>
                            {v.channelTitle && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{v.channelTitle}</p>}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {v.duration && <p className="text-[9px] text-muted-foreground/60">{v.duration}</p>}
                              {isThisConverting && <p className="text-[9px]" style={{ color: "hsla(var(--neu-orange-hi)/0.85)" }}>Converting…</p>}
                            </div>
                          </div>
                        </button>
                        );
                      })}
                      <button onClick={() => { setYtReadResults([]); setYtReadSearch(""); }} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground w-full text-center pt-0.5 transition-colors">Clear results</button>
                    </div>
                  )}
                  {readBooks.length > 0 && ytReadResults.length === 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-emerald-400/90 uppercase tracking-wide px-1 pb-0.5 flex items-center gap-1" data-testid="text-section-free">
                        <BookOpen className="w-3 h-3" /> Free Classics — Project Gutenberg
                      </p>
                      {readBooks.map((book: any) => (
                        <button key={book.id} onClick={() => loadBookText(book)} className="w-full flex items-start gap-2 p-2 rounded-lg border hover:bg-muted/50 text-left transition-colors" data-testid={`button-book-${book.id}`}>
                          {book.formats?.["image/jpeg"] ? (
                            <img loading="lazy" decoding="async" src={book.formats["image/jpeg"]} alt="" className="w-12 h-16 rounded object-cover flex-shrink-0 bg-muted" />
                          ) : (
                            <div className="w-12 h-16 rounded bg-muted flex-shrink-0 flex items-center justify-center"><BookOpen className="w-5 h-5 text-muted-foreground" /></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold line-clamp-2">{book.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{book.authors?.map((a: any) => a.name).join(", ")}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{book.download_count?.toLocaleString()} downloads</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {readBooks.length === 0 && ytReadResults.length === 0 && !readLoading && !ytReadSearchLoading && (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center" data-testid="section-empty-state">
                      <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center"><BookOpen className="w-5 h-5 text-muted-foreground/50" /></div>
                      <div className="space-y-1">
                        <p className="text-[12px] font-medium text-muted-foreground/80">{readSearch.trim() ? `No books found for "${readSearch}"` : "Searching library…"}</p>
                        <p className="text-[10px] text-muted-foreground/50">Books from Project Gutenberg</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* ── Saved tab: YouTube articles ──────────────────────────── */}
            {libraryTab === "saved" && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 space-y-2">
                  {savedArticles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "hsla(var(--neu-orange)/0.10)" }}>
                        <svg className="w-5 h-5" style={{ color: "hsla(var(--neu-orange-hi)/0.50)" }} viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[12px] font-medium text-muted-foreground/80">No saved articles yet</p>
                        <p className="text-[10px] text-muted-foreground/50">Extract a YouTube transcript and save it for later</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5" data-testid="section-saved-articles">
                      {savedArticles.map((article) => (
                        <div key={article.id} className="w-full flex items-start gap-2 p-2 rounded-lg border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 text-left transition-colors group">
                          <button
                            className="flex items-start gap-2 flex-1 min-w-0 text-left"
                            onClick={() => {
                              const bookObj = { title: article.title, authors: [{ name: "YouTube" }], _isYtArticle: true, videoId: article.videoId, thumbnailUrl: article.thumbnailUrl };
                              setSelectedBook(bookObj);
                              setBookText(article.content);
                              setCurrentYtThumbnail(article.thumbnailUrl);
                              setArticleSaved(true);
                              setWordInfo(null);
                              setShowEReader(true);
                              saveToReadingHistory({ ...bookObj, coverUrl: article.thumbnailUrl });
                            }}
                          >
                            {article.thumbnailUrl ? (
                              <img loading="lazy" decoding="async" src={article.thumbnailUrl} alt="" className="w-14 h-10 rounded object-cover flex-shrink-0 bg-muted" />
                            ) : (
                              <div className="w-14 h-10 rounded flex-shrink-0 flex items-center justify-center" style={{ background: "hsla(var(--neu-orange)/0.12)" }}>
                                <svg className="w-4 h-4 text-orange-400/60" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold line-clamp-2 leading-tight">{article.title}</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(article.createdAt).toLocaleDateString()} · {Math.ceil(article.content.split(" ").length / 200)} min read</p>
                            </div>
                          </button>
                          <button onClick={() => deleteSavedArticle(article.id)} className="p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground hover:text-red-400 flex-shrink-0 mt-0.5" aria-label="Delete article">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* ── History tab: all read items with filter ───────────────── */}
            {libraryTab === "history" && (
              <div className="flex flex-col flex-1 min-h-0">
                {readingHistory.length > 0 && (
                  <div className="px-3 pt-2.5 pb-2 flex-shrink-0 flex items-center gap-2 border-b">
                    <div className="relative flex-1">
                      <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                      <Input value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)} placeholder="Filter history…" className="pl-6 text-xs h-7" data-testid="input-history-filter" />
                    </div>
                    <button onClick={() => { setReadingHistory([]); try { localStorage.removeItem("vextorn_reading_history"); } catch {} }} className="text-[9px] text-muted-foreground/50 hover:text-red-400 transition-colors flex-shrink-0" data-testid="button-clear-history">Clear all</button>
                  </div>
                )}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-3 space-y-1.5" data-testid="section-reading-history">
                    {readingHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                        <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center"><Clock className="w-5 h-5 text-muted-foreground/50" /></div>
                        <div className="space-y-1">
                          <p className="text-[12px] font-medium text-muted-foreground/80">No reading history yet</p>
                          <p className="text-[10px] text-muted-foreground/50">Books and articles you open will appear here</p>
                        </div>
                      </div>
                    ) : (
                      readingHistory
                        .filter(h => !historyFilter.trim() || h.title.toLowerCase().includes(historyFilter.toLowerCase()) || (h.author || "").toLowerCase().includes(historyFilter.toLowerCase()))
                        .map((h) => (
                          <button
                            key={h.id}
                            className="w-full flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/40 text-left transition-colors group"
                            onClick={() => {
                              if (h._isYtArticle && h.videoId) {
                                // Load YT article directly via the conversion API — same path
                                // as a fresh conversion, so the content reliably appears.
                                const bookObj = { title: h.title, authors: [{ name: "YouTube" }], _isYtArticle: true, videoId: h.videoId, thumbnailUrl: h.thumbnailUrl || null };
                                loadBookText(bookObj);
                              } else if (h.formats) {
                                loadBookText({ ...h, id: h.id, authors: [{ name: h.author }] });
                              }
                            }}
                            data-testid={`button-history-${h.id}`}
                          >
                            {h.coverUrl || h.thumbnailUrl ? (
                              <img loading="lazy" decoding="async" src={(h.coverUrl || h.thumbnailUrl) as string} alt="" className="w-8 h-11 rounded object-cover flex-shrink-0 bg-muted" />
                            ) : (
                              <div className="w-8 h-11 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                                {h._isYtArticle
                                  ? <svg className="w-3.5 h-3.5 text-red-400/60" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                                  : <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                                }
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium line-clamp-2 leading-tight">{h.title}</p>
                              {h.author && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{h.author}</p>}
                              <p className="text-[9px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 inline" />{new Date(h.lastReadAt).toLocaleDateString()}
                                {h._isYtArticle && <span className="ml-1 rounded px-1 text-[8px] text-red-400/70 border border-red-400/20">YT</span>}
                              </p>
                            </div>
                            {(h.formats || h._isYtArticle) && <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 flex-shrink-0 transition-colors" />}
                          </button>
                        ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Games tab: Chess · Tic-Tac-Toe · Connect Four · Lichess ──────── */}
      <div className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" style={{ display: sidePanelTab === "chess" ? "flex" : "none" }}>
        <div className="flex-1 overflow-hidden" style={{ display: "flex", flexDirection: "column" }}>
          {user?.id && socket && (
            <Suspense fallback={null}>
              <ChessPanel
                socket={socket}
                roomId={room.id}
                userId={user.id}
                participants={participants}
                onOpenC4Board={() => setC4OverlayOpen(true)}
              />
            </Suspense>
          )}
        </div>
      </div>

      {false && (<div className="hidden">
        <div className="p-3 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Legacy</p>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col p-4 gap-4 overflow-y-auto">
          <div className="flex flex-col items-center gap-3 p-4 rounded-xl border bg-muted/30">
            <div className="w-16 h-16 rounded-2xl bg-[#769656] flex items-center justify-center shadow-md">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold">Play Chess Together</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Open Chess.com, log in with your account, create a game, and share the link in the room chat.</p>
            </div>
            <a
              href="https://www.chess.com/play/online"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button className="w-full bg-[#769656] hover:bg-[#5f7a40] text-white">
                <ExternalLink className="w-4 h-4 mr-2" /> Open Chess.com
              </Button>
            </a>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">How to play together</p>
            {[
              { step: "1", text: "Open Chess.com and sign in to your account" },
              { step: "2", text: "Create a new game — choose time control and color" },
              { step: "3", text: "Copy the challenge link and paste it in room chat" },
              { step: "4", text: "Your opponent clicks the link to join — game starts!" },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/30">
                <div className="w-5 h-5 rounded-full bg-[#769656] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-white">{step}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Quick Links</p>
            {[
              { label: "New Game", href: "https://www.chess.com/play/online", desc: "Play vs. friend or computer" },
              { label: "Puzzles", href: "https://www.chess.com/puzzles", desc: "Train your chess skills" },
              { label: "Analysis Board", href: "https://www.chess.com/analysis", desc: "Analyze positions together" },
            ].map(({ label, href, desc }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>)}

      {/* ── Go Live Panel ── */}
      <div className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" style={{ display: sidePanelTab === "golive" ? "flex" : "none" }}>
        {/* Header */}
        <div className="p-3 pb-2 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${glStatus === "live" ? "bg-red-600" : "bg-white/10"}`}>
                <div className={`w-2 h-2 rounded-full bg-white ${glStatus === "live" ? "animate-pulse" : "opacity-40"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold">Go Live</p>
                <p className="text-[10px] text-muted-foreground">
                  {glStatus === "live" ? `🔴 LIVE · ${formatGlDuration(glDuration)}` : "Stream direct — no software needed"}
                </p>
              </div>
            </div>
            {glStatus === "live" && (
              <button onClick={() => stopGoLive()} className="text-[10px] font-semibold px-2 py-1 rounded-md bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-colors">End</button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">

          {/* Live status bar */}
          {glStatus === "live" && (
            <div className="p-2.5 rounded-lg bg-red-600/10 border border-red-600/25 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-400">You are LIVE · {formatGlDuration(glDuration)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {goLivePlatform === "both" ? "YouTube + Twitch" : goLivePlatform === "youtube" ? "YouTube" : "Twitch"}
                  </p>
                </div>
              </div>
              {glViewers && (
                <div className="flex items-center gap-2 pt-0.5 border-t border-red-600/15">
                  {glViewers.twitch !== null && (
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span className="text-[10px] text-purple-300 font-semibold">{glViewers.twitch.toLocaleString()}</span>
                      <span className="text-[9px] text-muted-foreground">viewers</span>
                    </div>
                  )}
                  {glViewers.youtube !== null && (
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span className="text-[10px] text-red-300 font-semibold">{glViewers.youtube.toLocaleString()}</span>
                      <span className="text-[9px] text-muted-foreground">viewers</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {glStatus === "error" && glError && (
            <div className="p-2.5 rounded-lg bg-red-900/20 border border-red-600/25">
              <p className="text-xs text-red-400">{glError}</p>
            </div>
          )}

          {glStatus === "connecting" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-red-400" />
              <p className="text-sm text-muted-foreground">Connecting to RTMP server…</p>
            </div>
          )}

          {/* ── Live canvas preview ── */}
          {glPreviewDataUrl && (glStatus === "live" || glStatus === "connecting") && (
            <div className="rounded-xl overflow-hidden border border-white/[0.10] bg-black relative" style={{ aspectRatio: "16/9" }}>
              <img
                src={glPreviewDataUrl}
                alt="Stream preview"
                className="w-full h-full object-cover"
                style={{ display: "block" }}
              />
              {glStatus === "live" && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600/90 rounded-md px-2 py-0.5 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-[9px] font-bold text-white tracking-wide">LIVE</span>
                </div>
              )}
              {glStatus === "connecting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 bg-black/60 rounded-lg px-3 py-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-white/70" />
                    <span className="text-[10px] text-white/70">Connecting…</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-1.5 right-2 text-[8px] text-white/30 font-mono">preview</div>
            </div>
          )}

          {(glStatus === "idle" || glStatus === "error") && (<>

            {/* Capture mode toggle */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 space-y-2">
              <p className="text-[10px] font-bold text-white/45 uppercase tracking-wider">What to stream</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setGlCaptureMode("tab")}
                  className="flex-1 py-2 px-2.5 rounded-lg text-[11px] font-semibold transition-all duration-150 text-left flex flex-col gap-0.5"
                  style={glCaptureMode === "tab"
                    ? { background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.35)", color: "#fc8181" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}
                  data-testid="button-gl-mode-tab"
                >
                  <span className="flex items-center gap-1.5">
                    <MonitorPlay className="w-3.5 h-3.5 flex-shrink-0" />
                    Broadcast Room
                    {glCaptureMode === "tab" && <span className="ml-auto text-[9px] font-bold tracking-wide opacity-70">✓</span>}
                  </span>
                  <span className="text-[9px] opacity-55 font-normal leading-tight pl-5">Streams exactly what you see — real profiles, video, animations</span>
                </button>
                <button
                  onClick={() => setGlCaptureMode("canvas")}
                  className="flex-1 py-2 px-2.5 rounded-lg text-[11px] font-semibold transition-all duration-150 text-left flex flex-col gap-0.5"
                  style={glCaptureMode === "canvas"
                    ? { background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}
                  data-testid="button-gl-mode-canvas"
                >
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0" />
                    Canvas Overlay
                    {glCaptureMode === "canvas" && <span className="ml-auto text-[9px] font-bold tracking-wide opacity-70">✓</span>}
                  </span>
                  <span className="text-[9px] opacity-55 font-normal leading-tight pl-5">Custom branded frame with avatars — no permission needed</span>
                </button>
              </div>
              {glCaptureMode === "tab" && (
                <p className="text-[9px] text-white/30 leading-relaxed">
                  Your browser will ask which tab to share. Select <span className="text-white/55 font-semibold">this tab</span> to broadcast the room exactly as it appears.
                </p>
              )}
            </div>

            {/* Platform picker */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
              {(["youtube", "twitch", "both"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => { setGoLivePlatform(p); setGlWaitingForKey(null); }}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150"
                  style={goLivePlatform === p
                    ? { background: p === "youtube" ? "rgba(239,68,68,0.22)" : p === "twitch" ? "rgba(145,70,255,0.22)" : "rgba(80,160,80,0.22)", color: p === "youtube" ? "#fc6464" : p === "twitch" ? "#bf94ff" : "#6ee86e", border: "1px solid " + (p === "youtube" ? "rgba(239,68,68,0.30)" : p === "twitch" ? "rgba(145,70,255,0.30)" : "rgba(80,200,80,0.30)") }
                    : { color: "rgba(255,255,255,0.38)", border: "1px solid transparent" }
                  }
                >
                  {p === "both" ? "Both" : p === "youtube" ? "YouTube" : "Twitch"}
                </button>
              ))}
            </div>

            {/* YouTube section */}
            {(goLivePlatform === "youtube" || goLivePlatform === "both") && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">
                  {goLivePlatform === "both" ? "Step 1 of 2 — YouTube" : "Step 1 — Open YouTube Studio"}
                </p>
                <a
                  href="https://studio.youtube.com/channel/UC/livestreaming"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setGlWaitingForKey(goLivePlatform)}
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)", boxShadow: "0 4px 14px rgba(239,68,68,0.35)" }}
                >
                  <span className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    Open YouTube Studio → Go Live
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
                {/* Step-by-step visual guide */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 space-y-1.5">
                  <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1">How to find your stream key:</p>
                  {[
                    { n: "1", text: 'Click "Go Live" in YouTube Studio (top right)' },
                    { n: "2", text: 'Choose "Streaming software" tab' },
                    { n: "3", text: 'Click "Copy" next to Stream Key' },
                    { n: "4", text: "Come back here and paste it below" },
                  ].map(({ n, text }) => (
                    <div key={n} className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-red-600/30 text-red-400 text-[9px] font-bold flex items-center justify-center mt-0.5">{n}</span>
                      <p className="text-[10px] text-white/55 leading-snug">{text}</p>
                    </div>
                  ))}
                </div>
                {/* Screen-recording-style video player — always works, no external embed needed */}
                {(() => {
                  const TOTAL = 36;
                  const scene = Math.min(3, Math.floor(glVidTime / 9));
                  const progress = (glVidTime / TOTAL) * 100;
                  const fmtT = (s: number) => `0:${String(Math.min(s, 35)).padStart(2, "0")}`;
                  const ytLogoPath = "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z";
                  const sceneContent = [
                    // Scene 0: YouTube Studio → Create → Go Live
                    <div key="s0" style={{ background: "#fff", height: "100%", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderBottom: "1px solid #e5e5e5", background: "#fff" }}>
                        <svg viewBox="0 0 24 24" width={12} height={12} style={{ fill: "#ff0000", flexShrink: 0 }}><path d={ytLogoPath}/></svg>
                        <span style={{ color: "#444", fontSize: 7, fontWeight: 700 }}>YouTube Studio</span>
                        <div style={{ flex: 1 }} />
                        <div style={{ position: "relative" }}>
                          <div style={{ background: "#065fd4", color: "#fff", borderRadius: 3, padding: "2px 7px", fontSize: 7, fontWeight: 700, boxShadow: "0 0 0 3px rgba(6,95,212,0.25)", cursor: "pointer" }}>+ Create ▾</div>
                          <div style={{ position: "absolute", top: "110%", right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: 4, minWidth: 80, boxShadow: "0 3px 10px rgba(0,0,0,0.18)", zIndex: 10 }}>
                            <div style={{ padding: "4px 10px", color: "#333", fontSize: 7, fontWeight: 700, background: "#e8f0fe", borderRadius: "4px 4px 0 0" }}>📡 Go Live</div>
                            <div style={{ padding: "4px 10px", color: "#888", fontSize: 7 }}>⬆ Upload</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: "5px 8px 2px", background: "#fffde7", borderBottom: "1px solid #fff9c4" }}>
                        <span style={{ fontSize: 7, color: "#795548", fontWeight: 600 }}>① Click "+ Create" in the top-right, then select "Go Live"</span>
                      </div>
                      <div style={{ padding: "4px 8px", display: "flex", gap: 8, color: "#888", fontSize: 6 }}>
                        <span>📊 Dashboard</span><span>📝 Content</span><span style={{ color: "#065fd4", fontWeight: 700 }}>📡 Live</span>
                      </div>
                    </div>,
                    // Scene 1: Choose Streaming software
                    <div key="s1" style={{ background: "#f5f5f5", height: "100%", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "4px 8px" }}>
                      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 6, padding: "6px 8px", width: "100%", boxShadow: "0 1px 5px rgba(0,0,0,0.08)" }}>
                        <div style={{ fontSize: 7, fontWeight: 700, color: "#222", marginBottom: 5 }}>How do you want to go live?</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <div style={{ flex: 1, padding: "4px 4px", border: "1px solid #e0e0e0", borderRadius: 4, textAlign: "center", color: "#888", fontSize: 6 }}>📷 Webcam</div>
                          <div style={{ flex: 1, padding: "4px 4px", border: "2px solid #065fd4", borderRadius: 4, textAlign: "center", color: "#065fd4", fontSize: 6, fontWeight: 700, background: "#e8f0fe" }}>💻 Streaming software</div>
                        </div>
                        <div style={{ fontSize: 6, color: "#065fd4", textAlign: "right", marginTop: 3 }}>② Select this tab ↑</div>
                      </div>
                    </div>,
                    // Scene 2: Stream key → Copy
                    <div key="s2" style={{ background: "#fff", height: "100%", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", padding: "4px 8px", gap: 3 }}>
                      <div style={{ padding: "3px 8px", background: "#fffde7", borderRadius: 3, marginBottom: 2 }}>
                        <span style={{ fontSize: 6, color: "#795548", fontWeight: 600 }}>③ Find "Stream key" — click Copy to copy it</span>
                      </div>
                      <div style={{ fontSize: 7, color: "#555" }}>Stream name</div>
                      <div style={{ background: "#f5f5f5", borderRadius: 3, padding: "2px 6px", fontSize: 7, color: "#333", border: "1px solid #ddd", marginBottom: 2 }}>My Stream</div>
                      <div style={{ fontSize: 7, color: "#555" }}>Stream key <span style={{ color: "#999", fontSize: 6 }}>(keep private)</span></div>
                      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                        <div style={{ flex: 1, background: "#f5f5f5", borderRadius: 3, padding: "2px 6px", fontSize: 7, border: "1px solid #ddd", letterSpacing: 2, color: "#555" }}>••••••••••••</div>
                        <div style={{ background: "#065fd4", color: "#fff", borderRadius: 3, padding: "3px 10px", fontSize: 7, fontWeight: 700, boxShadow: "0 0 0 3px rgba(6,95,212,0.3)", whiteSpace: "nowrap", cursor: "pointer" }}>Copy ←</div>
                      </div>
                    </div>,
                    // Scene 3: Copied!
                    <div key="s3" style={{ background: "#fff", height: "100%", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", padding: "4px 8px", gap: 3 }}>
                      <div style={{ fontSize: 7, color: "#555" }}>Stream name</div>
                      <div style={{ background: "#f5f5f5", borderRadius: 3, padding: "2px 6px", fontSize: 7, color: "#333", border: "1px solid #ddd", marginBottom: 2 }}>My Stream</div>
                      <div style={{ fontSize: 7, color: "#555" }}>Stream key <span style={{ color: "#999", fontSize: 6 }}>(keep private)</span></div>
                      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                        <div style={{ flex: 1, background: "#f5f5f5", borderRadius: 3, padding: "2px 6px", fontSize: 7, border: "1px solid #ddd", letterSpacing: 2, color: "#555" }}>••••••••••••</div>
                        <div style={{ background: "#1a7f37", color: "#fff", borderRadius: 3, padding: "3px 10px", fontSize: 7, fontWeight: 700, whiteSpace: "nowrap" }}>✓ Copied!</div>
                      </div>
                      <div style={{ textAlign: "center", marginTop: 3, fontSize: 7, color: "#1a7f37", fontWeight: 700 }}>④ Now paste it into Vextorn below ↓</div>
                    </div>,
                  ];
                  return (
                    <div className="rounded-xl overflow-hidden border border-white/[0.08]" style={{ background: "#0a0a0a" }}>
                      {/* "Screen" — the simulated recording content */}
                      <div style={{ height: 112, overflow: "hidden", position: "relative", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ width: "100%", height: "100%", transition: "opacity 0.3s" }}>
                          {sceneContent[scene]}
                        </div>
                        <div style={{ position: "absolute", top: 4, left: 5, background: "rgba(0,0,0,0.55)", borderRadius: 3, padding: "1px 5px", display: "flex", alignItems: "center", gap: 3 }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff4444", animation: "pulse 1.5s infinite" }} />
                          <span style={{ color: "#fff", fontSize: 6, fontWeight: 600 }}>SCREEN RECORDING</span>
                        </div>
                      </div>
                      {/* Controls bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "#111" }}>
                        <button
                          onClick={() => setGlVidPlaying(v => !v)}
                          style={{ color: "#fff", background: "none", border: "none", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1, flexShrink: 0 }}
                          aria-label={glVidPlaying ? "Pause" : "Play"}
                        >{glVidPlaying ? "⏸" : "▶"}</button>
                        <div
                          style={{ flex: 1, height: 3, background: "#333", borderRadius: 2, cursor: "pointer", position: "relative" }}
                          onClick={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setGlVidTime(Math.round(((e.clientX - r.left) / r.width) * TOTAL));
                          }}
                        >
                          <div style={{ width: `${progress}%`, height: "100%", background: "#ff0000", borderRadius: 2, transition: "width 0.9s linear" }} />
                        </div>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 7, whiteSpace: "nowrap", flexShrink: 0 }}>{fmtT(glVidTime)} / 0:35</span>
                      </div>
                      {/* Footer with title + open link */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 8px 4px" }}>
                        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 7 }}>YouTube Studio — How to find your Stream Key</span>
                        <a href="https://studio.youtube.com/channel/UC/livestreaming" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.25)", fontSize: 7 }}>Open Studio ↗</a>
                      </div>
                    </div>
                  );
                })()}
                {glWaitingForKey && (
                  <p className="text-[10px] text-amber-400/80 text-center animate-pulse">
                    ✓ Come back here and paste your stream key below
                  </p>
                )}
                <div className="space-y-1">
                  <label htmlFor="vr-go-live-yt-key-a" className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">
                    {goLivePlatform === "both" ? "YouTube stream key" : "Step 2 — Paste your stream key"}
                  </label>
                  <div className="relative">
                    <input
                      ref={ytKeyInputRef}
                      id="vr-go-live-yt-key-a"
                      type={glShowYoutubeKey ? "text" : "password"}
                      value={glYoutubeKey}
                      onChange={e => setGlYoutubeKey(e.target.value)}
                      placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                      className="w-full px-2.5 py-2 pr-8 rounded-lg text-xs bg-white/[0.05] border text-white placeholder:text-white/20 focus:outline-none transition-all"
                      style={{ borderColor: glYoutubeKey ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.12)" }}
                    />
                    <button onClick={() => setGlShowYoutubeKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60" aria-label={glShowYoutubeKey ? "Hide key" : "Show key"}>
                      {glShowYoutubeKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Twitch section */}
            {(goLivePlatform === "twitch" || goLivePlatform === "both") && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">
                  {goLivePlatform === "both" ? "Step 2 of 2 — Twitch" : "Step 1 — Open your Twitch dashboard"}
                </p>
                <a
                  href="https://dashboard.twitch.tv/settings/stream"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setGlWaitingForKey(goLivePlatform)}
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#9146ff,#6523b0)", boxShadow: "0 4px 14px rgba(145,70,255,0.35)" }}
                >
                  <span className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                    Open Twitch Dashboard
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
                {glWaitingForKey && (
                  <p className="text-[10px] text-amber-400/80 text-center animate-pulse">
                    Copy your Primary Stream Key, then come back here
                  </p>
                )}
                <div className="space-y-1">
                  <label htmlFor="vr-go-live-tw-key-a" className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">
                    {goLivePlatform === "both" ? "Twitch stream key" : "Step 2 — Paste your stream key"}
                  </label>
                  <div className="relative">
                    <input
                      ref={twKeyInputRef}
                      id="vr-go-live-tw-key-a"
                      type={glShowTwitchKey ? "text" : "password"}
                      value={glTwitchKey}
                      onChange={e => setGlTwitchKey(e.target.value)}
                      placeholder="Paste stream key here…"
                      className="w-full px-2.5 py-2 pr-8 rounded-lg text-xs bg-white/[0.05] border border-white/[0.10] text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/60 focus:bg-white/[0.08] transition-all"
                    />
                    <button onClick={() => setGlShowTwitchKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60" aria-label={glShowTwitchKey ? "Hide key" : "Show key"}>
                      {glShowTwitchKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Go Live button */}
            <button
              onClick={() => { setGlWaitingForKey(null); startGoLive(); }}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{
                background: goLivePlatform === "twitch"
                  ? "linear-gradient(135deg,rgba(145,70,255,0.9),rgba(100,40,200,0.9))"
                  : goLivePlatform === "youtube"
                    ? "linear-gradient(135deg,rgba(239,68,68,0.9),rgba(180,30,30,0.9))"
                    : "linear-gradient(135deg,rgba(239,68,68,0.8),rgba(145,70,255,0.8))",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              <Radio className="w-4 h-4" />
              {goLivePlatform === "both" ? "Go Live on Both" : goLivePlatform === "youtube" ? "Go Live on YouTube" : "Go Live on Twitch"}
            </button>

            {/* Optional: viewer count */}
            <details className="group">
              <summary className="text-[10px] text-white/30 cursor-pointer hover:text-white/50 select-none list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span> Advanced — live viewer count
              </summary>
              <div className="mt-2 space-y-2 pl-2 border-l border-white/[0.06]">
                {(goLivePlatform === "youtube" || goLivePlatform === "both") && (
                  <div>
                    <label htmlFor="vr-go-live-yt-channel-a" className="text-[9px] text-white/40 uppercase tracking-wide">YouTube Channel ID (optional)</label>
                    <input
                      id="vr-go-live-yt-channel-a"
                      type="text"
                      value={glYoutubeChannelId}
                      onChange={e => setGlYoutubeChannelId(e.target.value)}
                      placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 focus:outline-none"
                    />
                  </div>
                )}
                {(goLivePlatform === "twitch" || goLivePlatform === "both") && (
                  <div>
                    <label htmlFor="vr-go-live-tw-user-a" className="text-[9px] text-white/40 uppercase tracking-wide">Twitch Username (optional)</label>
                    <input
                      id="vr-go-live-tw-user-a"
                      type="text"
                      value={glTwitchUsername}
                      onChange={e => setGlTwitchUsername(e.target.value)}
                      placeholder="yourchannelname"
                      className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </details>

          </>)}
        </div>
      </div>

      {/* ── People Panel ── */}
      <div className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" style={{ display: sidePanelTab === "people" ? "flex" : "none" }}>
        <div className="p-3 pb-2 flex-shrink-0">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
            <input
              type="text"
              aria-label="Search participants"
              placeholder="Search users..."
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
              data-testid="input-people-search"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-150 neu-search-input"
              style={{
                background: "linear-gradient(145deg, hsl(228 16% 9%) 0%, hsl(228 16% 12%) 100%)",
                border: "1px solid hsla(var(--neu-orange) / 0.20)",
                boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.55), inset -2px -2px 5px rgba(255,255,255,0.025), 0 0 0 1px rgba(0,0,0,0.4)",
              }}
            />
          </div>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 px-3 pb-2 flex-shrink-0">
          {(["all", "friends", "following", "followers"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPeopleFilter(f)}
              data-testid={`filter-people-${f}`}
              className="flex-1 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all duration-150"
              style={peopleFilter === f
                ? { background: "hsla(var(--neu-orange) / 0.22)", color: "hsla(var(--neu-orange-hi) / 0.95)", border: "1px solid hsla(var(--neu-orange) / 0.36)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }
                : { color: "rgba(255,255,255,0.38)", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }
              }
            >
              {f === "friends" ? "Friends" : f === "following" ? "Following" : f === "followers" ? "Followers" : "All"}
            </button>
          ))}
        </div>
        {/* People list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 pb-3 space-y-1">
            {(() => {
              const followingSet = new Set(following.map((f) => f.followingId));
              const followerSet = new Set(followers.map((f) => f.followerId));
              const friendSet = new Set([...following.map((f) => f.followingId)].filter((id) => followerSet.has(id)));

              const connectedSet = new Set([...Array.from(followingSet), ...Array.from(followerSet)]);
              let filtered = allUsers.filter((u) => u.id !== user?.id && connectedSet.has(u.id));
              if (peopleFilter === "following") filtered = filtered.filter((u) => followingSet.has(u.id));
              else if (peopleFilter === "followers") filtered = filtered.filter((u) => followerSet.has(u.id));
              else if (peopleFilter === "friends") filtered = filtered.filter((u) => friendSet.has(u.id));

              if (peopleSearch.trim()) {
                const q = peopleSearch.toLowerCase();
                filtered = filtered.filter((u) =>
                  getUserDisplayName(u).toLowerCase().includes(q)
                );
              }

              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "hsla(var(--neu-orange) / 0.14)", border: "1px solid hsla(var(--neu-orange) / 0.24)" }}>
                      <UsersRound className="w-6 h-6" style={{ color: "hsla(var(--neu-orange-hi) / 0.70)" }} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-muted-foreground/80">No connections yet</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Follow someone to see them here.</p>
                    </div>
                  </div>
                );
              }

              return filtered.map((u) => {
                const isFollowingUser = followingSet.has(u.id);
                return (
                  <div
                    key={u.id}
                    data-testid={`row-person-${u.id}`}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.04] transition-colors duration-150 group"
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={u.profileImageUrl ?? undefined} alt="" />
                        <AvatarFallback className="text-[10px] font-semibold" style={{ background: "hsla(var(--neu-orange-lo) / 0.40)", color: "hsla(var(--neu-orange-hi) / 0.95)" }}>
                          {getUserInitials(u)}
                        </AvatarFallback>
                      </Avatar>
                      {u.status === "online" && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-background" />
                      )}
                      {(dmUnreadCounts[u.id] || 0) > 0 && (
                        <span
                          data-testid={`badge-dm-unread-${u.id}`}
                          className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 border border-background flex items-center justify-center text-[9px] font-bold text-white leading-none z-10"
                        >
                          {dmUnreadCounts[u.id] > 9 ? "9+" : dmUnreadCounts[u.id]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate leading-tight">{getUserDisplayName(u)}</p>
                      <p className="text-[10px] text-muted-foreground/60 truncate leading-tight">{u.bio || (u.status === "online" ? "Online" : "Offline")}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        data-testid={`button-dm-${u.id}`}
                        onClick={() => {
                          setDmUserId(u.id);
                          setDmUnreadCounts(prev => { const next = { ...prev }; delete next[u.id]; return next; });
                        }}
                        className="p-1.5 rounded-lg transition-all duration-150"
                        style={{ background: "hsla(var(--neu-orange) / 0.18)", color: "hsla(var(--neu-orange-hi) / 0.92)", border: "1px solid hsla(var(--neu-orange) / 0.30)" }}
                        title={`Message ${getUserDisplayName(u)}`}
                      >
                        <MessageSquare className="w-3 h-3" />
                      </button>
                      <UserNotePopover userId={u.id} />
                      <button
                        data-testid={`button-follow-${u.id}`}
                        onClick={() => isFollowingUser ? unfollowMutation.mutate(u.id) : followMutation.mutate(u.id)}
                        className="p-1.5 rounded-lg transition-all duration-150"
                        title={isFollowingUser ? `Unfollow ${getUserDisplayName(u)}` : `Follow ${getUserDisplayName(u)}`}
                        style={isFollowingUser
                          ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)", border: "1px solid rgba(255,255,255,0.10)" }
                          : { background: "hsla(var(--neu-orange) / 0.22)", color: "hsla(var(--neu-orange-hi) / 0.95)", border: "1px solid hsla(var(--neu-orange) / 0.34)" }
                        }
                      >
                        {isFollowingUser ? <UserCheck className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </ScrollArea>
      </div>

    </div>
  );

  return (
    <div className="flex flex-1 min-h-0 w-full relative overflow-hidden" style={getRoomThemeStyle(currentTheme)}>
      <RoomThemeOverlay themeId={currentTheme} discoSceneIdx={discoOverlaySceneIdx} onDiscoAdvance={handleDiscoAdvance} />


      {/* Knock-knock prompts — floats top-center for the host only */}
      {isHost && pendingKnocks.length > 0 && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none"
          data-testid="knock-prompts"
        >
          {pendingKnocks.map((knock) => (
            <div
              key={knock.id}
              className="pointer-events-auto flex items-center gap-3 rounded-xl px-3 py-2 shadow-2xl border border-amber-400/40 bg-[hsl(228_18%_10%)]/95 backdrop-blur-md min-w-[280px] animate-in fade-in slide-in-from-top-2"
              style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(251,191,36,0.25), 0 0 24px rgba(251,191,36,0.15)" }}
              data-testid={`knock-prompt-${knock.userId}`}
            >
              <div className="text-lg leading-none animate-bounce" aria-hidden="true">🚪</div>
              <Avatar className="w-9 h-9 flex-shrink-0">
                <AvatarImage src={knock.userAvatar || undefined} alt="" />
                <AvatarFallback className="text-xs bg-amber-500/20 text-amber-200">
                  {(knock.userName || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug">
                  <span className="font-semibold text-amber-300">{knock.userName}</span>
                  <span className="text-white/70"> wants to join</span>
                </p>
              </div>
              <button
                onClick={() => handleAllowKnock(knock)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
                data-testid={`button-knock-allow-${knock.userId}`}
              >
                Allow
              </button>
              <button
                onClick={() => handleDenyKnock(knock)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                data-testid={`button-knock-deny-${knock.userId}`}
              >
                Deny
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── VOX PRIME themed ticker banner ── */}
      {(currentTheme === "trap-gold" || currentTheme === "skeleton-gangsta") && (() => {
        const isGold = currentTheme === "trap-gold";
        const quotes = isGold ? [
          "Jay-Z: \"I am not a businessman, I am a business, man\"",
          "Drake: \"Started from the bottom, now we're here\"",
          "Lil Wayne: \"Real Gs move in silence like lasagna\"",
          "DJ Khaled: \"We the best! Another one!\"",
          "Kendrick Lamar: \"Sit down, be humble\"",
          "Biggie: \"Stay far from timid, only make moves when your heart's in it\"",
          "Nas: \"Sleep is the cousin of death\"",
          "Rick Ross: \"Every day I'm hustlin'\"",
        ] : [
          "2Pac: \"Death before dishonor\"",
          "2Pac: \"All eyez on me\"",
          "Biggie: \"Ready to die\"",
          "Eazy-E: \"Fear no man, fear no evil\"",
          "2Pac: \"Only God can judge me\"",
          "Biggie: \"Born alone, die alone\"",
          "NWA: \"Straight outta Compton\"",
          "2Pac: \"I see no changes — wake up in the morning and I ask myself\"",
        ];
        const tickerText = quotes.join("   ✦   ");
        const accent    = isGold ? "rgba(245,158,11,1)"   : "rgba(200,192,176,1)";
        const accentDim = isGold ? "rgba(245,158,11,0.35)": "rgba(200,192,176,0.20)";
        const bg        = isGold
          ? "linear-gradient(90deg, rgba(10,6,0,0.97) 0%, rgba(20,12,0,0.95) 50%, rgba(10,6,0,0.97) 100%)"
          : "linear-gradient(90deg, rgba(4,4,4,0.98) 0%, rgba(8,8,8,0.96) 50%, rgba(4,4,4,0.98) 100%)";
        return (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0, zIndex:9,
            height:30, overflow:"hidden",
            background: bg,
            borderTop:`1px solid ${accentDim}`,
            display:"flex", alignItems:"center",
            boxShadow: isGold ? "0 -4px 20px rgba(245,158,11,0.12)" : "0 -4px 20px rgba(200,192,176,0.06)",
          }}>
            {/* VOX PRIME brand badge */}
            <div style={{
              flexShrink:0, display:"flex", alignItems:"center", gap:5,
              padding:"0 10px 0 12px",
              borderRight:`1px solid ${accentDim}`,
              height:"100%",
            }}>
              <span style={{
                fontSize:9, fontWeight:900, letterSpacing:"0.18em",
                color: accent,
                textShadow: isGold
                  ? "0 0 12px rgba(245,158,11,0.9), 0 0 24px rgba(245,158,11,0.4)"
                  : "0 0 12px rgba(200,192,176,0.7), 0 0 24px rgba(200,192,176,0.3)",
                textTransform:"uppercase",
              }}>VOX PRIME</span>
              <span style={{ fontSize:8, color: accent, opacity:0.75 }}>{isGold ? "🥇" : "💀"}</span>
            </div>
            {/* scrolling quotes */}
            <div style={{ flex:1, overflow:"hidden", position:"relative", height:"100%" }}>
              <div style={{
                position:"absolute", top:0, bottom:0,
                display:"flex", alignItems:"center",
                whiteSpace:"nowrap",
                animation:"vx-ticker-scroll 55s linear infinite",
                paddingLeft:"100%",
              }}>
                <span style={{
                  fontSize:9, fontWeight:600, letterSpacing:"0.04em",
                  color: isGold ? "rgba(255,215,0,0.88)" : "rgba(210,205,195,0.85)",
                  textShadow: isGold ? "0 0 8px rgba(245,158,11,0.5)" : "0 0 8px rgba(200,192,176,0.35)",
                }}>{tickerText}</span>
              </div>
            </div>
          </div>
        );
      })()}

      <Suspense fallback={null}>
        <CenterChessOverlay
          socket={socket}
          roomId={room.id}
          userId={user?.id ?? ""}
          forceOpen={chessSpectatorOpen}
          onClose={() => setChessSpectatorOpen(false)}
          onGameEnded={({ winner, whiteName, blackName, reason }) => {
            const text = winner === "draw"
              ? `♟️ Chess game ended in a draw between ${whiteName} and ${blackName} (${reason}).`
              : `♟️ ${winner === "white" ? whiteName : blackName} defeated ${winner === "white" ? blackName : whiteName} at chess by ${reason}!`;
            addSystemMessage(text);
            setChessSpectatorOpen(false);
          }}
        />
      </Suspense>

      {socket && user?.id && (
        <Suspense fallback={null}>
          <CenterC4Overlay
            socket={socket}
            roomId={room.id}
            userId={user.id}
            forceOpen={c4OverlayOpen}
            onClose={() => setC4OverlayOpen(false)}
          />
        </Suspense>
      )}

      <Dialog open={goLiveOpen} onOpenChange={(o) => { if (!o && glStatus === "live") stopGoLive(); setGoLiveOpen(o); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${glStatus === "live" ? "bg-red-600" : "bg-white/10"}`}>
                <div className={`w-2.5 h-2.5 rounded-full bg-white ${glStatus === "live" ? "animate-pulse" : "opacity-50"}`} />
              </div>
              Go Live
            </DialogTitle>
          </DialogHeader>

          {/* Live status */}
          {glStatus === "live" && (
            <div className="p-3 rounded-xl bg-red-600/10 border border-red-600/25 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-400">You are LIVE · {formatGlDuration(glDuration)}</p>
                  <p className="text-xs text-muted-foreground">
                    {goLivePlatform === "both" ? "YouTube + Twitch" : goLivePlatform === "youtube" ? "YouTube" : "Twitch"}
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => stopGoLive()}>End Stream</Button>
              </div>
              {glViewers && (
                <div className="flex items-center gap-3 pt-2 border-t border-red-600/20">
                  {glViewers.twitch !== null ? (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-sm font-bold text-purple-300">{glViewers.twitch.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">on Twitch</span>
                    </div>
                  ) : glViewers.twitchAvailable && goLivePlatform !== "youtube" ? (
                    <span className="text-xs text-muted-foreground/50">Add Twitch username for live count</span>
                  ) : null}
                  {glViewers.youtube !== null ? (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-sm font-bold text-red-300">{glViewers.youtube.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">on YouTube</span>
                    </div>
                  ) : glViewers.youtubeAvailable && goLivePlatform !== "twitch" ? (
                    <span className="text-xs text-muted-foreground/50">Add Channel ID for live count</span>
                  ) : null}
                  {!glViewers.twitchAvailable && !glViewers.youtubeAvailable && (
                    <span className="text-xs text-muted-foreground/50 italic">Viewer counts require API credentials — see docs</span>
                  )}
                </div>
              )}
            </div>
          )}
          {glStatus === "error" && glError && (
            <div className="p-3 rounded-xl bg-red-900/20 border border-red-600/25">
              <p className="text-sm text-red-400">{glError}</p>
            </div>
          )}

          {glStatus === "connecting" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Connecting to RTMP server…</p>
            </div>
          )}

          {/* ── Live canvas preview ── */}
          {glPreviewDataUrl && (glStatus === "live" || glStatus === "connecting") && (
            <div className="rounded-xl overflow-hidden border bg-black relative" style={{ aspectRatio: "16/9" }}>
              <img
                src={glPreviewDataUrl}
                alt="Stream preview"
                className="w-full h-full object-cover"
                style={{ display: "block" }}
              />
              {glStatus === "live" && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600/90 rounded-md px-2 py-1 backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-[10px] font-bold text-white tracking-wide">LIVE</span>
                </div>
              )}
              {glStatus === "connecting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 bg-black/60 rounded-lg px-3 py-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white/80" />
                    <span className="text-xs text-white/80">Connecting…</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 right-2.5 text-[9px] text-white/30 font-mono">stream preview</div>
            </div>
          )}

          {(glStatus === "idle" || glStatus === "error") && (<>
            {/* Platform selector */}
            <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border">
              {(["youtube", "twitch", "both"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => { setGoLivePlatform(p); setGlWaitingForKey(null); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${goLivePlatform === p ? (p === "youtube" ? "bg-red-600/20 text-red-400 border border-red-600/30" : p === "twitch" ? "bg-purple-600/20 text-purple-400 border border-purple-600/30" : "bg-green-600/15 text-green-400 border border-green-600/25") : "text-muted-foreground hover:text-foreground"}`}
                >
                  {p === "both" ? "Both" : p === "youtube" ? "YouTube" : "Twitch"}
                </button>
              ))}
            </div>

            {/* YouTube section */}
            {(goLivePlatform === "youtube" || goLivePlatform === "both") && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {goLivePlatform === "both" ? "YouTube — Step 1 of 2" : "Step 1 — Open YouTube Studio"}
                </p>
                <a
                  href="https://studio.youtube.com/channel/UC/livestreaming"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setGlWaitingForKey(goLivePlatform)}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)", boxShadow: "0 4px 16px rgba(239,68,68,0.3)" }}
                >
                  <span className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    Open YouTube Studio → Go Live
                  </span>
                  <ExternalLink className="w-4 h-4 opacity-70" />
                </a>
                {/* Step-by-step visual guide */}
                <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">How to find your stream key:</p>
                  {[
                    { n: "1", text: 'Click "Go Live" in YouTube Studio (top right)' },
                    { n: "2", text: 'Select the "Streaming software" tab' },
                    { n: "3", text: 'Click "Copy" next to your Stream key' },
                    { n: "4", text: "Come back here and paste it in the field below" },
                  ].map(({ n, text }) => (
                    <div key={n} className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-600/20 text-red-400 text-[10px] font-bold flex items-center justify-center mt-0.5 border border-red-600/30">{n}</span>
                      <p className="text-xs text-muted-foreground leading-snug">{text}</p>
                    </div>
                  ))}
                </div>
                {/* Screen-recording-style video player (dialog size) */}
                {(() => {
                  const TOTAL = 36;
                  const scene = Math.min(3, Math.floor(glVidTime / 9));
                  const progress = (glVidTime / TOTAL) * 100;
                  const fmtT = (s: number) => `0:${String(Math.min(s, 35)).padStart(2, "0")}`;
                  const ytLogoPath = "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z";
                  const sceneContent = [
                    <div key="d0" style={{ background: "#fff", height: "100%", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderBottom: "1px solid #e5e5e5" }}>
                        <svg viewBox="0 0 24 24" width={14} height={14} style={{ fill: "#ff0000", flexShrink: 0 }}><path d={ytLogoPath}/></svg>
                        <span style={{ color: "#444", fontSize: 9, fontWeight: 700 }}>YouTube Studio</span>
                        <div style={{ flex: 1 }} />
                        <div style={{ position: "relative" }}>
                          <div style={{ background: "#065fd4", color: "#fff", borderRadius: 4, padding: "3px 10px", fontSize: 8, fontWeight: 700, boxShadow: "0 0 0 3px rgba(6,95,212,0.25)" }}>+ Create ▾</div>
                          <div style={{ position: "absolute", top: "115%", right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: 5, minWidth: 100, boxShadow: "0 4px 14px rgba(0,0,0,0.15)", zIndex: 10 }}>
                            <div style={{ padding: "5px 12px", color: "#065fd4", fontSize: 8, fontWeight: 700, background: "#e8f0fe", borderRadius: "5px 5px 0 0" }}>📡 Go Live</div>
                            <div style={{ padding: "5px 12px", color: "#888", fontSize: 8 }}>⬆ Upload video</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: "6px 10px", background: "#fffde7", borderBottom: "1px solid #fff9c4" }}>
                        <span style={{ fontSize: 8, color: "#795548", fontWeight: 600 }}>① Click "+ Create" top-right → then click "Go Live"</span>
                      </div>
                      <div style={{ padding: "5px 10px", display: "flex", gap: 12, color: "#888", fontSize: 8 }}>
                        <span>📊 Dashboard</span><span>📝 Content</span><span style={{ color: "#065fd4", fontWeight: 700 }}>📡 Live</span>
                      </div>
                    </div>,
                    <div key="d1" style={{ background: "#f5f5f5", height: "100%", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 12px" }}>
                      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "8px 10px", width: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#222", marginBottom: 6 }}>How do you want to go live?</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <div style={{ flex: 1, padding: "5px", border: "1px solid #e0e0e0", borderRadius: 5, textAlign: "center", color: "#888", fontSize: 8 }}>📷 Webcam</div>
                          <div style={{ flex: 1, padding: "5px", border: "2.5px solid #065fd4", borderRadius: 5, textAlign: "center", color: "#065fd4", fontSize: 8, fontWeight: 700, background: "#e8f0fe" }}>💻 Streaming software ✓</div>
                        </div>
                        <div style={{ fontSize: 8, color: "#065fd4", textAlign: "right", marginTop: 4, fontWeight: 600 }}>② Select "Streaming software" ↑</div>
                      </div>
                    </div>,
                    <div key="d2" style={{ background: "#fff", height: "100%", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", padding: "6px 12px", gap: 4 }}>
                      <div style={{ padding: "4px 8px", background: "#fffde7", borderRadius: 4, marginBottom: 3 }}>
                        <span style={{ fontSize: 8, color: "#795548", fontWeight: 600 }}>③ Find "Stream key" — click Copy to copy it</span>
                      </div>
                      <div style={{ fontSize: 8, color: "#555" }}>Stream name</div>
                      <div style={{ background: "#f5f5f5", borderRadius: 4, padding: "3px 8px", fontSize: 8, color: "#333", border: "1px solid #ddd", marginBottom: 3 }}>My Vextorn Stream</div>
                      <div style={{ fontSize: 8, color: "#555" }}>Stream key <span style={{ color: "#999", fontSize: 7 }}>(keep private)</span></div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <div style={{ flex: 1, background: "#f5f5f5", borderRadius: 4, padding: "3px 8px", fontSize: 8, border: "1px solid #ddd", letterSpacing: 3, color: "#555" }}>••••••••••••••</div>
                        <div style={{ background: "#065fd4", color: "#fff", borderRadius: 4, padding: "4px 14px", fontSize: 8, fontWeight: 700, boxShadow: "0 0 0 3px rgba(6,95,212,0.3)", cursor: "pointer", whiteSpace: "nowrap" }}>Copy ←</div>
                      </div>
                    </div>,
                    <div key="d3" style={{ background: "#fff", height: "100%", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", padding: "6px 12px", gap: 4 }}>
                      <div style={{ fontSize: 8, color: "#555" }}>Stream name</div>
                      <div style={{ background: "#f5f5f5", borderRadius: 4, padding: "3px 8px", fontSize: 8, color: "#333", border: "1px solid #ddd", marginBottom: 3 }}>My Vextorn Stream</div>
                      <div style={{ fontSize: 8, color: "#555" }}>Stream key <span style={{ color: "#999", fontSize: 7 }}>(keep private)</span></div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <div style={{ flex: 1, background: "#f5f5f5", borderRadius: 4, padding: "3px 8px", fontSize: 8, border: "1px solid #ddd", letterSpacing: 3, color: "#555" }}>••••••••••••••</div>
                        <div style={{ background: "#1a7f37", color: "#fff", borderRadius: 4, padding: "4px 14px", fontSize: 8, fontWeight: 700, whiteSpace: "nowrap" }}>✓ Copied!</div>
                      </div>
                      <div style={{ textAlign: "center", marginTop: 5, fontSize: 9, color: "#1a7f37", fontWeight: 700 }}>④ Paste the key into Vextorn below ↓</div>
                    </div>,
                  ];
                  return (
                    <div className="rounded-xl overflow-hidden border" style={{ background: "#0a0a0a" }}>
                      <div style={{ height: 138, overflow: "hidden", position: "relative", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ width: "100%", height: "100%", transition: "opacity 0.3s" }}>{sceneContent[scene]}</div>
                        <div style={{ position: "absolute", top: 5, left: 6, background: "rgba(0,0,0,0.6)", borderRadius: 3, padding: "2px 6px", display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4444" }} />
                          <span style={{ color: "#fff", fontSize: 7, fontWeight: 600 }}>SCREEN RECORDING</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", background: "#111" }}>
                        <button onClick={() => setGlVidPlaying(v => !v)} style={{ color: "#fff", background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0 }} aria-label={glVidPlaying ? "Pause" : "Play"}>{glVidPlaying ? "⏸" : "▶"}</button>
                        <div style={{ flex: 1, height: 3, background: "#333", borderRadius: 2, cursor: "pointer", position: "relative" }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setGlVidTime(Math.round(((e.clientX - r.left) / r.width) * TOTAL)); }}>
                          <div style={{ width: `${progress}%`, height: "100%", background: "#ff0000", borderRadius: 2, transition: "width 0.9s linear" }} />
                        </div>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, whiteSpace: "nowrap", flexShrink: 0 }}>{fmtT(glVidTime)} / 0:35</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 5px" }}>
                        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 8 }}>YouTube Studio — How to find your Stream Key</span>
                        <a href="https://studio.youtube.com/channel/UC/livestreaming" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.25)", fontSize: 8 }}>Open Studio ↗</a>
                      </div>
                    </div>
                  );
                })()}
                {glWaitingForKey && (
                  <p className="text-[11px] text-amber-500 text-center animate-pulse font-medium">
                    ✓ Stream key copied? Paste it below to go live!
                  </p>
                )}
                <div className="space-y-1">
                  <label htmlFor="vr-go-live-yt-key-b" className="text-xs font-semibold text-muted-foreground">
                    {goLivePlatform === "both" ? "YouTube stream key" : "Step 2 — Paste your stream key"}
                  </label>
                  <div className="relative">
                    <input
                      id="vr-go-live-yt-key-b"
                      type={glShowYoutubeKey ? "text" : "password"}
                      value={glYoutubeKey}
                      onChange={e => setGlYoutubeKey(e.target.value)}
                      placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                      className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm bg-background border focus:outline-none focus:ring-2 focus:ring-red-500/40 placeholder:text-muted-foreground/40 transition-all"
                      style={{ borderColor: glYoutubeKey ? "rgba(239,68,68,0.5)" : undefined }}
                    />
                    <button onClick={() => setGlShowYoutubeKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={glShowYoutubeKey ? "Hide key" : "Show key"}>
                      {glShowYoutubeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Twitch section */}
            {(goLivePlatform === "twitch" || goLivePlatform === "both") && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {goLivePlatform === "both" ? "Twitch — Step 2 of 2" : "Step 1 — Open your Twitch dashboard"}
                </p>
                <a
                  href="https://dashboard.twitch.tv/settings/stream"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setGlWaitingForKey(goLivePlatform)}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#9146ff,#6523b0)", boxShadow: "0 4px 16px rgba(145,70,255,0.3)" }}
                >
                  <span className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                    Open Twitch Dashboard
                  </span>
                  <ExternalLink className="w-4 h-4 opacity-70" />
                </a>
                {glWaitingForKey && (
                  <p className="text-[11px] text-amber-500/80 text-center animate-pulse">
                    Copy your Primary Stream Key → come back here and paste it below
                  </p>
                )}
                <div className="space-y-1">
                  <label htmlFor="vr-go-live-tw-key-b" className="text-xs font-semibold text-muted-foreground">
                    {goLivePlatform === "both" ? "Twitch stream key" : "Step 2 — Paste your stream key"}
                  </label>
                  <div className="relative">
                    <input
                      id="vr-go-live-tw-key-b"
                      type={glShowTwitchKey ? "text" : "password"}
                      value={glTwitchKey}
                      onChange={e => setGlTwitchKey(e.target.value)}
                      placeholder="Paste stream key here…"
                      className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm bg-background border focus:outline-none focus:ring-2 focus:ring-purple-500/40 placeholder:text-muted-foreground/40 transition-all"
                    />
                    <button onClick={() => setGlShowTwitchKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={glShowTwitchKey ? "Hide key" : "Show key"}>
                      {glShowTwitchKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced (optional viewer count) */}
            <details className="group">
              <summary className="text-[11px] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground select-none list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span> Advanced — live viewer count
              </summary>
              <div className="mt-2 space-y-2 pl-3 border-l">
                {(goLivePlatform === "youtube" || goLivePlatform === "both") && (
                  <div className="space-y-1">
                    <label htmlFor="vr-go-live-yt-channel-b" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">YouTube Channel ID (optional)</label>
                    <input
                      id="vr-go-live-yt-channel-b"
                      type="text"
                      value={glYoutubeChannelId}
                      onChange={e => setGlYoutubeChannelId(e.target.value)}
                      placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 rounded-lg text-sm bg-background border focus:outline-none placeholder:text-muted-foreground/40"
                    />
                  </div>
                )}
                {(goLivePlatform === "twitch" || goLivePlatform === "both") && (
                  <div className="space-y-1">
                    <label htmlFor="vr-go-live-tw-user-b" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Twitch Username (optional)</label>
                    <input
                      id="vr-go-live-tw-user-b"
                      type="text"
                      value={glTwitchUsername}
                      onChange={e => setGlTwitchUsername(e.target.value)}
                      placeholder="yourchannelname"
                      className="w-full px-3 py-2 rounded-lg text-sm bg-background border focus:outline-none placeholder:text-muted-foreground/40"
                    />
                  </div>
                )}
              </div>
            </details>

            <Button
              className="w-full font-bold text-white"
              style={{
                background: goLivePlatform === "twitch"
                  ? "linear-gradient(135deg,#9146ff,#6523b0)"
                  : goLivePlatform === "youtube"
                    ? "linear-gradient(135deg,#ef4444,#b91c1c)"
                    : "linear-gradient(135deg,#ef4444 0%,#9146ff 100%)",
              }}
              onClick={() => { setGlWaitingForKey(null); startGoLive(); }}
            >
              <Radio className="w-4 h-4 mr-2" />
              {goLivePlatform === "both" ? "Go Live on Both" : goLivePlatform === "youtube" ? "Go Live on YouTube" : "Go Live on Twitch"}
            </Button>
          </>)}
        </DialogContent>
      </Dialog>

      <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>🎨 Room Theme</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Choose a visual theme for your room. All participants will see it.</p>
          <div className="space-y-2 mt-2">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Selected</span>
                <span className="text-xs font-medium text-foreground" data-testid="text-theme-dialog-selected">
                  {visibleThemes.find((t) => t.id === editRoomTheme)?.label || "Default"}
                </span>
              </div>
              {(() => {
                const desc = visibleThemes.find((t) => t.id === editRoomTheme)?.description;
                return desc ? (
                  <p className="text-[11px] text-primary/70 text-right leading-snug italic">{desc}</p>
                ) : null;
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setThemeDialogOffset((o) => Math.max(0, o - 4))}
                disabled={themeDialogOffset === 0}
                className="flex-shrink-0 w-7 h-12 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                data-testid="button-theme-dialog-prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 grid grid-cols-4 gap-2">
                {visibleThemes.slice(themeDialogOffset, themeDialogOffset + 4).map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setEditRoomTheme(theme.id)}
                    className={`relative rounded-lg overflow-hidden transition-all border-2 ${editRoomTheme === theme.id ? "border-white shadow-lg" : "border-transparent opacity-70 hover:opacity-100"}`}
                    title={theme.label}
                    data-testid={`button-theme-dialog-${theme.id}`}
                  >
                    <img
                      src={theme.img}
                      alt={theme.label}
                      width={120}
                      height={52}
                      className="w-full h-[52px] object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        const fallback = e.currentTarget.nextSibling as HTMLElement;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                    <div className={`w-full h-[52px] bg-gradient-to-br ${theme.preview} hidden items-center justify-center`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-semibold text-white leading-none px-0.5 truncate">
                      {theme.label}
                    </span>
                    {editRoomTheme === theme.id && (
                      <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-white flex items-center justify-center">
                        <svg className="w-1.5 h-1.5" viewBox="0 0 12 12" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setThemeDialogOffset((o) => Math.min(Math.max(0, visibleThemes.length - 4), o + 4))}
                disabled={themeDialogOffset + 4 >= visibleThemes.length}
                className="flex-shrink-0 w-7 h-12 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                data-testid="button-theme-dialog-next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center gap-1">
              {Array.from({ length: Math.ceil(visibleThemes.length / 4) }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setThemeDialogOffset(i * 4)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${themeDialogOffset === i * 4 ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"}`}
                  data-testid={`button-theme-dialog-page-${i}`}
                />
              ))}
            </div>
          </div>
          <Button
            className="w-full mt-3"
            onClick={() => updateRoomThemeMutation.mutate(editRoomTheme)}
            disabled={updateRoomThemeMutation.isPending}
          >
            {updateRoomThemeMutation.isPending ? "Applying..." : "Apply Theme"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setDeleteRoomOpen(false); setEditTab("basics"); } }}>
        <DialogContent
          className="sm:max-w-lg flex flex-col gap-0 p-0"
          style={{ maxHeight: "min(92svh, 600px)" }}
          aria-describedby={undefined}
        >
          {/* Sticky header */}
          <DialogHeader className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-border/40">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4 text-primary/70" />
              Edit Room Settings
            </DialogTitle>
          </DialogHeader>

          {/* Tab bar */}
          <div className="flex-shrink-0 flex gap-1 px-5 pt-3 pb-1">
            {(["basics", "appearance", "permissions"] as const).map((tab) => {
              const labels: Record<string, string> = { basics: "Room Info", appearance: "Appearance", permissions: "Permissions" };
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setEditTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    editTab === tab
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
                  }`}
                  data-testid={`button-edit-tab-${tab}`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleEditRoomSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Scrollable tab content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 min-h-0">

              {/* ── Tab: Room Info ── */}
              {editTab === "basics" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-room-title" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Room Name</Label>
                    <Input
                      id="edit-room-title"
                      data-testid="input-edit-room-title"
                      placeholder="e.g. English Beginners Chat"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={50}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Language</Label>
                      <Select value={editLanguage} onValueChange={setEditLanguage}>
                        <SelectTrigger data-testid="select-edit-language"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {languages.map((lang) => (
                            <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Level</Label>
                      <Select value={editLevel} onValueChange={setEditLevel}>
                        <SelectTrigger data-testid="select-edit-level"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEVELS.map((lvl) => (
                            <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Max Participants</Label>
                    <NeuParticipantSlider value={editMaxUsers} onChange={setEditMaxUsers} testId="slider-edit-max-users" />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium leading-none">Public Room</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Anyone can find and join</p>
                    </div>
                    <Switch
                      id="edit-public-toggle"
                      data-testid="switch-edit-public"
                      checked={editIsPublic}
                      onCheckedChange={setEditIsPublic}
                      className="neu-switch"
                    />
                  </div>
                </div>
              )}

              {/* ── Tab: Appearance ── */}
              {editTab === "appearance" && (
                <div className="space-y-4">
                  {/* Card Theme */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Card Theme</Label>
                      <span className="text-xs text-primary font-medium" data-testid="text-edit-theme-selected">
                        {visibleThemes.find((t) => t.id === editRoomTheme)?.label || "Default"}
                      </span>
                    </div>
                    {/* Default / clear theme option */}
                    <button
                      type="button"
                      onClick={() => setEditRoomTheme("none")}
                      data-testid="button-edit-theme-none"
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${editRoomTheme === "none" ? "border-white/60 bg-white/10 text-white font-semibold" : "border-border/30 bg-muted/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground"}`}
                    >
                      <span className="text-sm opacity-60">✕</span>
                      <span className="text-[12px]">No Theme (Default)</span>
                      {editRoomTheme === "none" && (
                        <span className="ml-auto text-[10px] text-primary font-bold">✓ SELECTED</span>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditThemeOffset((o) => Math.max(0, o - 4))}
                        disabled={editThemeOffset === 0}
                        className="flex-shrink-0 w-7 h-12 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        data-testid="button-edit-theme-prev"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        {visibleThemes.slice(editThemeOffset, editThemeOffset + 4).map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setEditRoomTheme(theme.id)}
                            className={`relative rounded-lg overflow-hidden transition-all border-2 ${editRoomTheme === theme.id ? "border-white shadow-lg" : "border-transparent opacity-70 hover:opacity-100"}`}
                            title={theme.label}
                            data-testid={`button-edit-theme-${theme.id}`}
                          >
                            <img
                              src={theme.img}
                              alt={theme.label}
                              width={120}
                              height={52}
                              className="w-full h-[52px] object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                const fallback = e.currentTarget.nextSibling as HTMLElement;
                                if (fallback) fallback.style.display = "flex";
                              }}
                            />
                            <div className={`w-full h-[52px] bg-gradient-to-br ${theme.preview} hidden items-center justify-center`} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                            <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-semibold text-white leading-none px-0.5 truncate">{theme.label}</span>
                            {editRoomTheme === theme.id && (
                              <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-white flex items-center justify-center">
                                <svg className="w-1.5 h-1.5" viewBox="0 0 12 12" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 6l3 3 5-5" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditThemeOffset((o) => Math.min(Math.max(0, visibleThemes.length - 4), o + 4))}
                        disabled={editThemeOffset + 4 >= visibleThemes.length}
                        className="flex-shrink-0 w-7 h-12 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        data-testid="button-edit-theme-next"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-center gap-1">
                      {Array.from({ length: Math.ceil(visibleThemes.length / 4) }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setEditThemeOffset(i * 4)}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${editThemeOffset === i * 4 ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"}`}
                          data-testid={`button-edit-theme-page-${i}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Request New Theme */}
                  <div className="space-y-2">
                    {!showThemeRequest ? (
                      <button
                        type="button"
                        onClick={() => setShowThemeRequest(true)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/8 text-amber-300 text-[12px] font-semibold hover:bg-amber-500/20 transition-colors"
                        data-testid="button-show-theme-request"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Request a New Theme
                      </button>
                    ) : (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                            <Sparkles className="w-3.5 h-3.5" />
                            Request a New Theme
                          </span>
                          <div className="flex items-center gap-2">
                            {(themeOrderStats?.last24hCount ?? 0) > 0 && (
                              <span className="text-[10px] text-amber-400/70">{3 - (themeOrderStats?.last24hCount ?? 0)} left today</span>
                            )}
                            <button
                              type="button"
                              onClick={() => { setShowThemeRequest(false); setThemeReqName(""); setThemeReqDesc(""); }}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              data-testid="button-close-theme-request"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {(themeOrderStats?.pendingCount ?? 0) >= 1 && (
                          <p className="text-[11px] text-amber-400/80 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> You have a pending request — wait for it to be reviewed.
                          </p>
                        )}
                        {(themeOrderStats?.last24hCount ?? 0) >= 3 && (themeOrderStats?.pendingCount ?? 0) === 0 && (
                          <p className="text-[11px] text-red-400 flex items-center gap-1">
                            <X className="w-3 h-3" /> Daily limit reached (3 per 24h).
                          </p>
                        )}
                        <div className="space-y-2">
                          <div>
                            <Label className="text-[11px] mb-1 block text-muted-foreground">Theme name</Label>
                            <Input
                              placeholder="e.g. Retro Wave, Jungle Night…"
                              value={themeReqName}
                              onChange={(e) => setThemeReqName(e.target.value)}
                              className="text-sm h-8"
                              maxLength={60}
                              disabled={(themeOrderStats?.pendingCount ?? 0) >= 1 || (themeOrderStats?.last24hCount ?? 0) >= 3}
                              data-testid="input-new-theme-name"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] mb-1 block text-muted-foreground">Description &amp; inspiration</Label>
                            <textarea
                              placeholder="Describe the vibe, colors, atmosphere…"
                              value={themeReqDesc}
                              onChange={(e) => setThemeReqDesc(e.target.value)}
                              className="w-full min-h-[64px] resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                              maxLength={400}
                              disabled={(themeOrderStats?.pendingCount ?? 0) >= 1 || (themeOrderStats?.last24hCount ?? 0) >= 3}
                              data-testid="input-new-theme-description"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => { setShowThemeRequest(false); setThemeReqName(""); setThemeReqDesc(""); }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="text-xs h-7 bg-amber-500/20 text-amber-200 border border-amber-500/30 hover:bg-amber-500/30"
                            disabled={
                              !themeReqName.trim() ||
                              themeReqDesc.trim().length < 3 ||
                              (themeOrderStats?.pendingCount ?? 0) >= 1 ||
                              (themeOrderStats?.last24hCount ?? 0) >= 3 ||
                              submitThemeOrderMutation.isPending
                            }
                            onClick={() => submitThemeOrderMutation.mutate()}
                            data-testid="button-submit-new-theme-request"
                          >
                            <Send className="w-3 h-3 mr-1" />
                            {submitThemeOrderMutation.isPending ? "Submitting…" : "Submit Request"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Media */}
                  <div className="space-y-2 rounded-lg border border-border/40 bg-muted/10 p-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        <Sparkles className="w-3.5 h-3.5 text-primary/80" />
                        Card Media
                        <span className="text-[10px] font-normal text-muted-foreground normal-case">(optional)</span>
                      </Label>
                      {editHologramUrl && !editHologramUploading && (
                        <button
                          type="button"
                          onClick={() => { setEditHologramUrl(null); setEditHologramKind("gif"); }}
                          className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                          data-testid="button-clear-edit-card-media"
                        >
                          <X className="w-3 h-3" /> Clear
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {editHologramUrl ? (
                        editHologramKind === "video" ? (
                          <video src={editHologramUrl} autoPlay loop muted playsInline className="w-14 h-14 rounded-md object-cover border-2 border-primary/60 flex-shrink-0" data-testid="video-edit-card-media-preview" />
                        ) : (
                          <img src={proxyMediaUrl(editHologramUrl)} alt="Selected media" width={56} height={56} referrerPolicy="no-referrer" className="w-14 h-14 rounded-md object-cover border-2 border-primary/60 flex-shrink-0" data-testid="img-edit-card-media-preview" />
                        )
                      ) : (
                        <div className="w-14 h-14 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px] text-muted-foreground font-medium flex-shrink-0">
                          {editHologramUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Empty"}
                        </div>
                      )}
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <GifPickerButton onGifSelect={(url) => { setEditHologramUrl(url); setEditHologramKind("gif"); }} side="bottom" align="start" />
                        <button
                          type="button"
                          onClick={() => editHologramFileRef.current?.click()}
                          disabled={editHologramUploading}
                          className="neu-upload-btn flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50"
                          data-testid="button-upload-edit-card-media"
                        >
                          {editHologramUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {editHologramUploading ? "Uploading..." : "Upload"}
                        </button>
                        <input
                          ref={editHologramFileRef}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          onChange={handleEditHologramFilePick}
                          data-testid="input-edit-card-media-file"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Pick a GIF, upload your own picture / short video, or tap Clear to remove the current card background.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Tab: Permissions ── */}
              {editTab === "permissions" && (
                <div className="space-y-3">
                  <p className="text-[12px] text-muted-foreground leading-snug">
                    Tap a tile to cycle through permission levels. Changes are announced in room chat.
                  </p>
                  <div className="host-perm-section">
                    <div className="host-perm-grid">
                      <PermTile label="Mic" Icon={Mic} value={editTalkPermission} onChange={(v) => setEditTalkPermission(v as any)} withMuted testId="tile-perm-talk" />
                      <PermTile label="Camera" Icon={Video} value={editCameraPermission} onChange={(v) => setEditCameraPermission(v as any)} testId="tile-perm-camera" />
                      <PermTile label="Screen" Icon={MonitorPlay} value={editScreenPermission} onChange={(v) => setEditScreenPermission(v as any)} testId="tile-perm-screen" />
                      <PermTile label="YouTube" Icon={Youtube} value={editYoutubePermission} onChange={(v) => setEditYoutubePermission(v as any)} testId="tile-perm-youtube" />
                      <PermTile label="Chat" Icon={MessageSquare} value={editChatPermission} onChange={(v) => setEditChatPermission(v as any)} testId="tile-perm-chat" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pinned footer — always visible */}
            <div className="flex-shrink-0 px-5 py-3 border-t border-border/40 space-y-2">
              <Button
                type="submit"
                className="w-full"
                disabled={updateRoomMutation.isPending}
                data-testid="button-submit-edit-room"
              >
                {updateRoomMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>

              {!deleteRoomOpen ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-[13px]"
                  onClick={() => setDeleteRoomOpen(true)}
                  data-testid="button-delete-room-start"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete Room
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[12px] text-destructive text-center">This will permanently close the room for everyone. Are you sure?</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-[12px]"
                      onClick={() => setDeleteRoomOpen(false)}
                      disabled={deleteRoomMutation.isPending}
                      data-testid="button-delete-room-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="flex-1 text-[12px]"
                      onClick={() => deleteRoomMutation.mutate()}
                      disabled={deleteRoomMutation.isPending}
                      data-testid="button-delete-room-confirm"
                    >
                      {deleteRoomMutation.isPending ? "Deleting..." : "Yes, Delete"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Welcome Message Dialog (Host Only) ── */}
      <Dialog open={welcomeDialogOpen} onOpenChange={setWelcomeDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">👋</span> Welcome Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-[12px] text-muted-foreground">Write a message shown to users when they join your room. Saving will immediately send it to all users currently in the room.</p>
            <div className="space-y-2">
              <Label htmlFor="vr-welcome-msg">Message</Label>
              <textarea
                id="vr-welcome-msg"
                ref={welcomeTextareaRef}
                value={welcomeText}
                onChange={(e) => setWelcomeText(e.target.value)}
                placeholder="Write a greeting for your room…"
                className="w-full resize-none rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[96px]"
                maxLength={500}
                data-testid="input-welcome-message"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-primary/70 flex items-center gap-1">
                  <button
                    type="button"
                    title="Click to insert @username placeholder"
                    onClick={() => {
                      const ta = welcomeTextareaRef.current;
                      if (!ta) { setWelcomeText(prev => prev + "@username"); return; }
                      const start = ta.selectionStart ?? welcomeText.length;
                      const end = ta.selectionEnd ?? welcomeText.length;
                      const newText = welcomeText.slice(0, start) + "@username" + welcomeText.slice(end);
                      setWelcomeText(newText);
                      requestAnimationFrame(() => {
                        ta.focus();
                        const pos = start + "@username".length;
                        ta.setSelectionRange(pos, pos);
                      });
                    }}
                    className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/15 border border-primary/25 font-mono text-[9px] text-primary hover:bg-primary/30 hover:border-primary/50 transition-colors cursor-pointer"
                    data-testid="button-insert-username"
                  >@username</button>
                  <span className="text-muted-foreground">→ click to insert, replaced with each joiner's name</span>
                </span>
                <p className="text-[10px] text-muted-foreground">{welcomeText.length}/500</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Accent color:</span>
              {["#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setWelcomeAccentColorState(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${welcomeAccentColorState === c ? "scale-125 border-white" : "border-transparent hover:scale-110"}`}
                  style={{ background: c }}
                  data-testid={`button-welcome-color-${c.replace("#", "")}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Media position:</span>
              {(["above", "below", "between"] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setWelcomeMediaPositionState(pos)}
                  className={`px-2 py-0.5 rounded-md text-[10px] border transition-colors capitalize ${welcomeMediaPositionState === pos ? "border-primary/60 bg-primary/20 text-primary" : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"}`}
                  data-testid={`button-welcome-position-${pos}`}
                >{pos}</button>
              ))}
            </div>
            {welcomeMediaUrlsState.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">Attached media</span>
                  <span className="text-[10px] text-muted-foreground" data-testid="text-welcome-media-count">{welcomeMediaUrlsState.length} attached</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {welcomeMediaUrlsState.map((url, i) => (
                    <div key={i} className="relative group overflow-hidden rounded-lg border border-border/50 bg-background/60" data-testid={`card-welcome-media-${i}`}>
                      <img loading="lazy" decoding="async" src={url} alt={`welcome media ${i + 1}`} className="h-20 w-full object-cover" data-testid={`img-welcome-media-${i}`} />
                      {welcomeMediaTypesState[i] === "gif" && (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-pink-500/90 text-white text-[9px] font-bold uppercase tracking-wide">gif</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setWelcomeMediaUrlsState(prev => prev.filter((_, j) => j !== i));
                          setWelcomeMediaTypesState(prev => prev.filter((_, j) => j !== i));
                        }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-welcome-media-${i}`}
                      ><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <label className={`inline-flex items-center gap-1.5 text-[11px] cursor-pointer px-2 py-1 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors ${uploadingWelcomeMedia ? "opacity-50 pointer-events-none" : ""}`}>
                {uploadingWelcomeMedia ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                {uploadingWelcomeMedia ? "Uploading…" : "Upload Image"}
                <input
                  type="file"
                  accept="image/*,image/gif"
                  className="hidden"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    setUploadingWelcomeMedia(true);
                    try {
                      for (const file of files) {
                        const fd = new FormData();
                        fd.append("media", file);
                        const res = await fetch(`/api/rooms/${room.id}/welcome-media`, { method: "POST", body: fd, credentials: "include" });
                        if (res.ok) {
                          const data = await res.json();
                          setWelcomeMediaUrlsState(prev => [...prev, data.url]);
                          setWelcomeMediaTypesState(prev => [...prev, data.type]);
                        }
                      }
                    } finally {
                      setUploadingWelcomeMedia(false);
                      e.target.value = "";
                    }
                  }}
                  data-testid="input-welcome-media-upload"
                />
              </label>
              <div className="flex items-center gap-1.5 text-[11px] border border-border/40 bg-muted/20 rounded-lg overflow-hidden">
                <span className="pl-2 text-muted-foreground flex items-center gap-1">GIF</span>
                <GifPickerButton
                  onGifSelect={(gifUrl) => {
                    setWelcomeMediaUrlsState(prev => [...prev, gifUrl]);
                    setWelcomeMediaTypesState(prev => [...prev, "gif"]);
                  }}
                  side="bottom"
                  align="start"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setWelcomeDialogOpen(false)}
                data-testid="button-cancel-welcome"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => updateWelcomeMutation.mutate()}
                disabled={updateWelcomeMutation.isPending || uploadingWelcomeMedia}
                data-testid="button-save-welcome"
              >
                {updateWelcomeMutation.isPending ? "Saving…" : "Save & Send to All"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div
          className="border-b px-3 py-2"
          style={{
            background: "linear-gradient(180deg, hsl(228 14% 10% / 0.97) 0%, hsl(228 14% 8% / 0.94) 100%)",
            backdropFilter: "blur(24px) saturate(1.3)",
            borderColor: "rgba(255,255,255,0.06)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.04), 0 -1px 0 rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex flex-wrap items-center gap-2">

            {/* ── Left: Title ── */}
            <div className="flex items-center gap-3 min-w-0 flex-1 basis-0">
              {/* Icon — deep neumorphic gem */}
              <div className="relative flex-shrink-0">
                <div
                  className="brand-room-mark"
                  data-testid="brand-room-mark"
                >
                  <VextornMark size={22} />
                </div>
                {/* Live dot — double ring pulse */}
                <span className="absolute -top-[3px] -right-[3px] flex items-center justify-center">
                  <span className="absolute w-3 h-3 rounded-full bg-green-400/30 animate-ping" style={{ animationDuration: "1.6s" }} />
                  <span className="relative w-[8px] h-[8px] rounded-full bg-green-400" style={{ boxShadow: "0 0 6px rgba(74,222,128,0.9), 0 0 12px rgba(74,222,128,0.4)", border: "1.5px solid rgba(0,0,0,0.5)" }} />
                </span>
              </div>

              {/* Text block */}
              <div className="min-w-0 flex flex-col gap-[2px]">

                {/* Brand name — gradient, always dominant */}
                <span
                  style={{
                    fontWeight: 900,
                    letterSpacing: "-0.04em",
                    fontFamily: '"Space Grotesk", system-ui, sans-serif',
                    fontSize: "22px",
                    lineHeight: 1,
                    background: "linear-gradient(110deg, #fff 0%, rgba(220,210,255,0.96) 40%, rgba(160,130,255,0.88) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 0 12px rgba(160,130,255,0.35))",
                  }}
                >
                  Vextorn
                </span>

                {/* Room title — styled like a premium subtitle */}
                {room.title && (
                  <h2
                    className="truncate"
                    style={{
                      fontWeight: 600,
                      fontSize: "12px",
                      letterSpacing: "0.005em",
                      lineHeight: 1,
                      marginTop: "3px",
                      color: "transparent",
                      background: "linear-gradient(90deg, rgba(255,200,100,0.95) 0%, rgba(255,160,80,0.80) 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      maxWidth: "240px",
                    }}
                    data-testid="text-voice-room-title"
                  >
                    {room.title}
                  </h2>
                )}

                {/* Metadata row */}
                <div className="flex items-center gap-[5px] mt-[4px]">
                  <span
                    className="text-[10px] font-semibold tracking-wide"
                    style={{ color: "rgba(200,185,255,0.70)" }}
                  >
                    {room.language}
                  </span>
                  <span style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(255,255,255,0.18)", flexShrink: 0, display: "inline-block" }} />
                  <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.30)" }}>{room.level}</span>
                  <span style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(255,255,255,0.18)", flexShrink: 0, display: "inline-block" }} />
                  <span
                    className="text-[10px] font-semibold tabular-nums"
                    style={{ color: "rgba(90,220,150,0.75)" }}
                  >
                    {participants.length}<span style={{ color: "rgba(255,255,255,0.20)" }}>/{room.maxUsers === 0 ? "∞" : room.maxUsers}</span>
                  </span>
                  {/* Tiny share icon inline next to participant count */}
                  <button
                    type="button"
                    onClick={() => setShareDialogOpen(true)}
                    title="Share room"
                    data-testid="button-share-room-inline"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 4, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)", color: "rgba(196,181,253,0.8)", flexShrink: 0, marginLeft: 2 }}
                    className="transition-opacity hover:opacity-80 active:scale-95"
                  >
                    <Copy className="w-[9px] h-[9px]" />
                  </button>
                </div>

                {/* Talk-mode badge */}
                {talkBadge && (() => {
                  const TalkIcon = talkBadge.icon;
                  const toneClass = talkBadge.tone ? ` talk-mode-badge--${talkBadge.tone}` : "";
                  return (
                    <span
                      className={`talk-mode-badge${toneClass}`}
                      style={{ marginTop: "3px", alignSelf: "flex-start" }}
                      title={talkLockReason || talkBadge.label}
                      data-testid="badge-talk-mode"
                    >
                      <TalkIcon className="w-[9px] h-[9px]" />
                      {talkBadge.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* ── Center: Control dock ── */}
            <div className="order-3 flex w-full justify-center md:order-none md:w-auto md:flex-shrink-0">
              {renderControlDock()}
            </div>

            {/* ── Right: Unified action pill ── */}
            <div className="flex items-center justify-end flex-1 basis-0">
              <div className="room-header-pill">
                {/* Panel toggle */}
                <div className="relative">
                  <button
                    onClick={() => {
                      const isMobile = window.innerWidth < 768;
                      if (isMobile) { setMobileSheetOpen(!mobileSheetOpen); }
                      else { setSidePanelOpen(!sidePanelOpen); }
                    }}
                    data-testid="button-panel-social"
                    title="Social Panel"
                    className="room-header-pill-btn"
                    data-active={sidePanelOpen}
                  >
                    <LayoutGrid className="w-[18px] h-[18px]" />
                  </button>
                  {unreadChatBadge > 0 && privateUnreadCount === 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center leading-none pointer-events-none z-10" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.6), inset 0 1px 0 rgba(255,255,255,0.3)" }}>
                      {unreadChatBadge > 99 ? "99+" : unreadChatBadge}
                    </span>
                  )}
                  {privateUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 animate-pulse bg-purple-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center leading-none pointer-events-none z-10" style={{ boxShadow: "0 0 8px rgba(168,85,247,0.80), inset 0 1px 0 rgba(255,255,255,0.40)" }} title="Unread private messages">
                      🔒
                    </span>
                  )}
                </div>

                {/* Separator */}
                <div className="room-header-pill-sep" />

                {/* Settings (host) */}
                {isHost && (
                  <button
                    onClick={() => {
                      setEditTitle(room.title);
                      setEditLanguage(room.language);
                      setEditLevel(room.level);
                      setEditMaxUsers(room.maxUsers);
                      setEditIsPublic(((room as any).isPublic ?? true) as boolean);
                      const currentHologram = ((room as any).hologramVideoUrl as string) || null;
                      setEditHologramUrl(currentHologram);
                      setEditHologramKind(
                        currentHologram
                          ? (/\.(mp4|webm|mov)(\?|$)/i.test(currentHologram)
                              ? "video"
                              : /\.(jpe?g|png|webp)(\?|$)/i.test(currentHologram)
                              ? "image"
                              : "gif")
                          : "gif"
                      );
                      const currentEditTheme = (room as any).roomTheme || "none";
                      const themeIndex = ROOM_THEMES.findIndex((theme) => theme.id === currentEditTheme);
                      setEditRoomTheme(currentEditTheme);
                      setEditThemeOffset(Math.max(0, Math.floor(Math.max(0, themeIndex) / 4) * 4));
                      setEditDialogOpen(true);
                    }}
                    data-testid="button-host-settings"
                    title="Room Settings"
                    className="room-header-pill-btn room-header-pill-btn--host"
                    style={{ color: "rgba(167,139,250,0.9)" }}
                  >
                    <Settings className="w-[18px] h-[18px]" />
                  </button>
                )}

                {/* Room Info (non-host) */}
                {!isHost && (() => {
                  const ownerUser = participantById.get(room.ownerId);
                  const ownerName = ownerUser ? getUserDisplayName(ownerUser) : room.ownerId.slice(0, 8).toUpperCase();
                  const ownerAvatar = ownerUser?.profileImageUrl || undefined;
                  const ownerInitials = ownerUser ? getUserInitials(ownerUser) : "?";
                  const createdAtStr = room.createdAt
                    ? new Date(room.createdAt).toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
                    : "—";
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          data-testid="button-non-host-settings"
                          title="Room Info"
                          className="room-header-pill-btn"
                        >
                          <Settings className="w-[18px] h-[18px]" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-60 p-0 border-0 shadow-2xl overflow-hidden"
                        style={{ background: "hsl(228 14% 10%)" }}
                        align="end"
                      >
                        <div className="flex flex-col">
                          <div className="pt-4 pb-1 text-center">
                            <p className="text-sm font-semibold text-white">Group Owner</p>
                          </div>
                          <div className="flex flex-col items-center gap-1.5 pb-3">
                            <Avatar className="w-16 h-16 rounded-full border-2 border-white/10" style={{ filter: "grayscale(100%)" }}>
                              <AvatarImage src={ownerAvatar} alt="" />
                              <AvatarFallback className="bg-zinc-700 text-white text-lg">{ownerInitials}</AvatarFallback>
                            </Avatar>
                            <p className="text-sm font-medium text-white">{ownerName}</p>
                          </div>
                          <div className="border-t border-white/10" />
                          <button
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-white w-full text-left transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(room.ownerId);
                              toast({ description: "Owner ID copied!" });
                            }}
                            data-testid="button-copy-owner-id"
                          >
                            <Copy className="w-4 h-4 text-white/50" />
                            Copy Owner ID
                          </button>
                          <button
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-white w-full text-left transition-colors"
                            data-testid="button-report-bad-topic"
                          >
                            <Bell className="w-4 h-4 text-white/50" />
                            Report Bad Topic
                          </button>
                          <div className="border-t border-white/10" />
                          <div className="px-4 py-3 text-center">
                            <p className="text-xs text-white/40 mb-0.5">Created At</p>
                            <p className="text-sm font-medium text-white">{createdAtStr}</p>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })()}
              </div>
            </div>
          </div>

          {micError && (
            <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-[12px] font-medium text-amber-200">Microphone access needed</span>
              </div>
              <p className="text-[11px] text-amber-200/70 leading-relaxed">
                You can listen but not speak. Allow microphone access to participate.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={retryMicPermission}
                  disabled={micSwitching}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-200 text-[11px] font-medium transition-colors"
                  data-testid="button-retry-mic"
                >
                  {micSwitching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mic className="w-3 h-3" />}
                  {micSwitching ? "Opening…" : "Allow Microphone"}
                </button>
                <button
                  onClick={() => setShowMicHelp(!showMicHelp)}
                  className="text-[11px] text-amber-300/60 hover:text-amber-200 transition-colors underline underline-offset-2"
                  data-testid="button-mic-help"
                >
                  How to enable
                </button>
              </div>
              <div className="max-w-sm space-y-1.5">
                <Label className="text-[10px] text-amber-200/70">Microphone source</Label>
                <Select value={selectedAudioDeviceId} onValueChange={handleMicrophoneSelect} disabled={micSwitching}>
                  <SelectTrigger className="h-8 bg-black/25 border-amber-500/25 text-amber-100 text-[11px]" data-testid="select-microphone-source-inline">
                    <SelectValue placeholder="Default microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default microphone</SelectItem>
                    {audioInputDevices.filter((device) => device.deviceId).map((device, index) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showMicHelp && (
                <div className="rounded-lg bg-black/30 border border-amber-500/20 px-3 py-2.5 space-y-1.5">
                  <p className="text-[11px] font-semibold text-amber-200">Enable microphone in your browser:</p>
                  <ol className="space-y-1 text-[10px] text-amber-200/60 leading-relaxed list-decimal list-inside">
                    <li>Look for the <strong className="text-amber-200/80">camera/mic icon</strong> in your browser's address bar</li>
                    <li>Click it and choose <strong className="text-amber-200/80">"Always allow"</strong> for this site</li>
                    <li>Click <strong className="text-amber-200/80">Allow Microphone</strong> above to retry</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden relative" style={{ paddingBottom: ((activeYoutubeId && showYoutube) || (activeMovieId && showMovie) || showEReader || isScreenSharing || !!remoteScreenShareUserId || !!remoteVideoUserId) ? 210 : 0 }}>

          {focusedUserId && !(activeYoutubeId && showYoutube) && !showEReader && !isScreenSharing && !remoteScreenShareUserId && (!isVideoOn || miniCameraMode) && !remoteVideoUserId && (() => {
            const _isOverlay = (activeYoutubeId && showYoutube) || (activeMovieId && showMovie) || showEReader || isScreenSharing || !!remoteScreenShareUserId || !!remoteVideoUserId || !!(room as any).hologramVideoUrl || (currentTheme && currentTheme !== "none");
            return (
              <div
                className="flex-1 min-h-0 relative flex items-center justify-center p-4 cursor-pointer"
                style={_isOverlay ? { paddingBottom: "clamp(160px, 22vh, 220px)" } : undefined}
                onClick={() => { setFocusedUserId(null); setMiniCameraMode(false); setMiniPlayerMode(false); }}
              >
                <div className="w-[40vw] max-w-[160px] sm:max-w-[200px] aspect-square relative rounded-full overflow-hidden shadow-2xl flex flex-col items-center justify-center cursor-default transition-all duration-300 pointer-events-none" onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const fP = focusedUserId ? participantById.get(focusedUserId) : undefined;
                    if (!fP) return null;
                    return fP.profileImageUrl ? (
                      <img loading="lazy" decoding="async" src={fP.profileImageUrl} alt={getUserDisplayName(fP)} className="w-full h-full object-cover pointer-events-auto" />
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center pointer-events-auto">
                        <span className="text-7xl font-bold bg-transparent text-primary">{getUserInitials(fP as Participant)}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

          {/* Watcher preview is intentionally NOT auto-shown. Watchers in the room
              see nothing extra in the main media area when a host plays a video —
              they tap the red YouTube badge on the host's avatar (or the side panel)
              to opt in to the watch party. */}
          {false && activeYoutubeId && !showYoutube && !userDismissedYoutube && (() => {
            const broadcaster = youtubeStartedBy ? participantById.get(youtubeStartedBy) : undefined;
            const thumb = `https://img.youtube.com/vi/${activeYoutubeId}/hqdefault.jpg`;
            const handleJoinWatch = () => {
              setShowYoutube(true);
              setSidePanelOpen(false);
              if (user?.id !== youtubeStartedBy) {
                setTimeout(() => { try { handleYtSyncToStarter(); } catch (_) {} }, 1200);
                setTimeout(() => { try { handleYtSyncToStarter(); } catch (_) {} }, 2800);
              }
            };
            return (
              <div
                className="flex-1 min-h-0 bg-black relative flex items-center justify-center cursor-pointer group/ytpreview"
                onClick={handleJoinWatch}
                data-testid="yt-watch-preview"
              >
                <img
                  src={thumb}
                  alt="Now playing"
                  width={480}
                  height={360}
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover/ytpreview:opacity-75 transition-opacity"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/55" />
                <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-600/90 group-hover/ytpreview:bg-red-500 flex items-center justify-center shadow-2xl border-2 border-white/30 transition-colors">
                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-white text-sm font-semibold drop-shadow-lg">
                      {broadcaster ? `${getUserDisplayName(broadcaster)} is playing a video` : "A video is playing"}
                    </p>
                    <p className="text-white/80 text-xs drop-shadow-md">
                      Click to join the watch party
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Movie Player (Internet Archive embed) ── */}
          {activeMovieId && showMovie && (
            <div
              className="bg-black relative flex flex-col overflow-hidden group/movieplayer"
              style={moviePlayerHeight ? { height: moviePlayerHeight, flexShrink: 0 } : { flex: 1, minHeight: 0 }}
              data-testid="media-main-movie"
            >
              {/* Title bar — hover-revealed gradient overlay */}
              <div
                className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-4 py-3 opacity-0 group-hover/movieplayer:opacity-100 pointer-events-none group-hover/movieplayer:pointer-events-auto transition-opacity duration-200"
                style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, transparent 100%)" }}
              >
                <Film className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span className="text-white text-sm font-semibold truncate">{activeMovieTitle}</span>
                {movieStartedBy && movieStartedBy !== user?.id && (() => {
                  const host = participantById.get(movieStartedBy);
                  return host ? (
                    <span className="text-white/40 text-xs shrink-0">· shared by {getUserDisplayName(host)}</span>
                  ) : null;
                })()}
              </div>

              {/* Direct video player */}
              {movieDirectLoading ? (
                <div className="flex-1 flex items-center justify-center bg-black min-h-0">
                  <Loader2 className="w-8 h-8 animate-spin text-white/30" />
                </div>
              ) : movieDirectUrl ? (
                <video
                  ref={movieVideoRef}
                  key={`${activeMovieId}_${movieStartOffset}_${movieSyncKey}`}
                  src={movieDirectUrl}
                  className="flex-1 w-full min-h-0 object-contain bg-black"
                  crossOrigin="anonymous"
                  autoPlay
                  muted={movieMuted}
                  onLoadedMetadata={() => {
                    const v = movieVideoRef.current;
                    if (!v) return;
                    setMovieDuration(Math.floor(v.duration) || 0);
                    if (movieStartOffset > 0) v.currentTime = movieStartOffset;
                    if (!movieHostPlaying && user?.id !== movieStartedBy) v.pause();
                  }}
                  onTimeUpdate={() => {
                    const v = movieVideoRef.current;
                    if (!v) return;
                    movieHostElapsedRef.current = Math.floor(v.currentTime);
                  }}
                  data-testid="video-movie-player"
                >
                  {movieSubtitleTracks.map(track => (
                    <track
                      key={track.url}
                      kind="subtitles"
                      src={`/api/movies/subtitle-proxy?url=${encodeURIComponent(track.url)}`}
                      srcLang={track.srcLang}
                      label={track.label}
                    />
                  ))}
                </video>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-black p-6 min-h-0">
                  <Film className="w-10 h-10 text-white/20" />
                  <p className="text-white/40 text-sm text-center leading-snug">This film isn't available for direct playback.<br/>Try opening it on Archive.org for full access.</p>
                  <a
                    href={`https://archive.org/details/${activeMovieId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 text-xs underline transition-colors"
                  >Open on Archive.org ↗</a>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────────
                  REDESIGNED BOTTOM CONTROL BAR
                  Layout: [■ Stop] [▶/⏸] [━━━━ time ━━━━] [🔊] [CC] [⚙] [😊] ··· [✕]
              ───────────────────────────────────────────────────────────────── */}
              <div
                className="absolute bottom-0 left-0 right-0 z-30"
                data-testid="movie-control-bar"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Resize drag handle at very top of bar */}
                <div
                  className="flex items-center justify-center h-3 cursor-ns-resize group/resize-movie transition-colors hover:bg-white/8"
                  data-testid="movie-player-resize-handle"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const container = e.currentTarget.parentElement!.parentElement!;
                    const startH = container.getBoundingClientRect().height;
                    const onMove = (me: MouseEvent) => {
                      const outerH = container.parentElement?.getBoundingClientRect().height ?? 600;
                      setMoviePlayerHeight(Math.max(180, Math.min(outerH - 80, startH + (me.clientY - startY))));
                    };
                    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                >
                  <div className="w-10 h-0.5 rounded-full bg-white/20 group-hover/resize-movie:bg-white/55 transition-colors" />
                </div>

                {/* Main row */}
                <div
                  className="flex items-center gap-1 px-2 pb-2.5 pt-1"
                  style={{ background: "linear-gradient(to top, rgba(4,4,10,0.98) 0%, rgba(4,4,10,0.80) 100%)" }}
                >
                  {/* ── LEFT: Stop + Play/Pause ── */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Stop */}
                    <button
                      type="button"
                      onClick={user?.id === movieStartedBy
                        ? handleStopMovie
                        : () => { setShowMovie(false); setActiveMovieId(null); setMovieStartedBy(null); socket?.emit("room:movie-watching", { roomId: room.id, hostId: movieStartedBy, watching: false }); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:text-red-400 hover:bg-red-500/14 transition-all duration-150 active:scale-90"
                      title={user?.id === movieStartedBy ? "Stop movie for everyone" : "Stop watching"}
                      data-testid="button-movie-stop"
                    >
                      <StopCircle className="w-[17px] h-[17px]" />
                    </button>

                    {/* Play / Pause — host syncs all; watcher resyncs */}
                    {user?.id === movieStartedBy ? (
                      movieHostPlaying ? (
                        <button
                          type="button"
                          onClick={handleMoviePause}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white hover:bg-white/12 transition-all duration-150 active:scale-90"
                          title="Pause for all watchers"
                          data-testid="button-movie-pause"
                        >
                          <Pause className="w-[18px] h-[18px]" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleMoviePlay}
                          className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/25 transition-all duration-150 active:scale-90"
                          title="Resume for all watchers"
                          data-testid="button-movie-play"
                        >
                          <Play className="w-[17px] h-[17px] ml-0.5" />
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={handleMovieResync}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:text-white hover:bg-white/12 transition-all duration-150 active:scale-90"
                        title="Resync to host's current position"
                        data-testid="button-movie-resync-bar"
                      >
                        <RotateCcw className="w-[15px] h-[15px]" />
                      </button>
                    )}
                  </div>

                  {/* ── DIVIDER ── */}
                  <div className="w-px h-5 bg-white/10 shrink-0 mx-1" />

                  {/* ── CENTRE: Elapsed time + progress track ── */}
                  <div className="flex-1 flex items-center gap-2.5 min-w-0">
                    <span className="text-white/45 text-[11px] font-mono tabular-nums shrink-0 select-none">
                      {(() => {
                        const secs = user?.id === movieStartedBy
                          ? movieElapsedDisplay
                          : Math.floor(movieCurrentTimeByHost.get(movieStartedBy ?? "") ?? movieElapsedDisplay);
                        const m = Math.floor(secs / 60);
                        const s = secs % 60;
                        return `${m}:${String(s).padStart(2, "0")}`;
                      })()}
                    </span>
                    {/* Track — indeterminate pulse (total duration unknown for archive.org) */}
                    <div
                      className="flex-1 h-[3px] rounded-full bg-white/10 overflow-hidden min-w-0 relative"
                      title="Elapsed playback time"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          movieHostPlaying || user?.id !== movieStartedBy
                            ? "bg-gradient-to-r from-amber-600/80 via-amber-400 to-amber-500/80"
                            : "bg-white/25"
                        }`}
                        style={{ width: "100%", transform: "translateX(-88%)", animation: (movieHostPlaying || user?.id !== movieStartedBy) ? "movie-bar-slide 2.8s ease-in-out infinite" : "none" }}
                      />
                    </div>
                  </div>

                  {/* ── DIVIDER ── */}
                  <div className="w-px h-5 bg-white/10 shrink-0 mx-1" />

                  {/* ── RIGHT: Volume + CC + Settings + Reactions + X ── */}
                  <div className="flex items-center gap-0.5 shrink-0">

                    {/* Volume */}
                    <button
                      type="button"
                      onClick={() => setMovieMuted(v => !v)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-all duration-150 active:scale-90"
                      title={movieMuted ? "Unmute" : "Mute"}
                      data-testid="button-movie-mute"
                    >
                      {movieMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    {/* Subtitles (CC) */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setMovieSubsOpen(v => !v); setMovieSettingsOpen(false); setMovieReactionsOpen(false); }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 ${movieSubsOpen ? "text-amber-400 bg-amber-500/15" : "text-white/55 hover:text-white hover:bg-white/10"}`}
                        title="Subtitles / CC"
                        data-testid="button-movie-subtitles"
                      >
                        <Captions className="w-4 h-4" />
                      </button>
                      {movieSubsOpen && (
                        <div className="absolute bottom-full right-0 mb-2 w-52 rounded-xl bg-[#0d0d14]/96 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/70 p-2 animate-in fade-in slide-in-from-bottom-2 duration-150" data-testid="movie-subs-menu">
                          <p className="text-white/75 text-[11px] font-semibold uppercase tracking-wider px-2 py-1 mb-0.5">Subtitles</p>
                          <button
                            type="button"
                            onClick={() => {
                              setMovieActiveSubLang("");
                              if (movieVideoRef.current) Array.from(movieVideoRef.current.textTracks).forEach(t => { t.mode = "disabled"; });
                              setMovieSubsOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${movieActiveSubLang === "" ? "bg-amber-500/15 text-amber-400" : "text-white/55 hover:bg-white/8 hover:text-white"}`}
                          >Off</button>
                          {movieSubtitleTracks.length > 0 ? movieSubtitleTracks.map(track => (
                            <button
                              key={track.url}
                              type="button"
                              onClick={() => {
                                setMovieActiveSubLang(track.srcLang);
                                if (movieVideoRef.current) Array.from(movieVideoRef.current.textTracks).forEach(t => { t.mode = t.label === track.label ? "showing" : "disabled"; });
                                setMovieSubsOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${movieActiveSubLang === track.srcLang ? "bg-amber-500/15 text-amber-400" : "text-white/55 hover:bg-white/8 hover:text-white"}`}
                            >{track.label}</button>
                          )) : (
                            <div className="px-2.5 py-2 text-white/35 text-xs leading-snug">No subtitles available for this film</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Settings */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setMovieSettingsOpen(v => !v); setMovieSubsOpen(false); setMovieReactionsOpen(false); }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 ${movieSettingsOpen ? "text-amber-400 bg-amber-500/15" : "text-white/55 hover:text-white hover:bg-white/10"}`}
                        title="Settings"
                        data-testid="button-movie-settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      {movieSettingsOpen && (
                        <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl bg-[#0d0d14]/96 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/70 p-2 animate-in fade-in slide-in-from-bottom-2 duration-150" data-testid="movie-settings-menu">
                          <p className="text-white/75 text-[11px] font-semibold uppercase tracking-wider px-2 py-1 mb-0.5">Playback</p>
                          {user?.id !== movieStartedBy && (
                            <button
                              type="button"
                              onClick={() => { handleMovieResync(); setMovieSettingsOpen(false); }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-white/65 hover:bg-white/8 hover:text-white transition-colors text-left"
                              data-testid="button-movie-resync-settings"
                            >
                              <RotateCcw className="w-3.5 h-3.5 shrink-0" /> Resync to host
                            </button>
                          )}
                          {user?.id !== movieStartedBy && (
                            <button
                              type="button"
                              onClick={() => { handleMovieResync(); setMovieSettingsOpen(false); }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-white/65 hover:bg-white/8 hover:text-white transition-colors text-left"
                              data-testid="button-movie-resync-settings-2"
                            >
                              <RotateCcw className="w-3.5 h-3.5 shrink-0" /> Sync to current time
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reactions */}
                    <div className="relative">
                      {movieReactionsOpen && (
                        <div className="absolute bottom-full right-0 mb-2 flex items-center gap-1 bg-[#0d0d14]/96 backdrop-blur-xl rounded-full border border-white/10 px-2 py-1.5 shadow-2xl shadow-black/70 animate-in fade-in slide-in-from-bottom-2 duration-150" data-testid="movie-reactions-panel">
                          {["❤️", "🍿", "😂", "😮", "👏", "🔥", "🤯"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => { if (socket) socket.emit("room:movie-reaction", { roomId: room.id, emoji }); }}
                              className="w-7 h-7 rounded-full hover:bg-white/12 flex items-center justify-center text-sm transition-transform hover:scale-125 active:scale-90"
                              title={`React ${emoji}`}
                              data-testid={`button-movie-react-${emoji}`}
                            >{emoji}</button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { setMovieReactionsOpen(v => !v); setMovieSubsOpen(false); setMovieSettingsOpen(false); }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 ${movieReactionsOpen ? "text-amber-400 bg-amber-500/15" : "text-white/55 hover:text-white hover:bg-white/10"}`}
                        title={movieReactionsOpen ? "Hide reactions" : "Reactions"}
                        data-testid="button-movie-reactions-toggle"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Divider before X */}
                    <div className="w-px h-5 bg-white/10 mx-1" />

                    {/* X Close — always hides panel locally; use ■ to end for everyone */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowMovie(false);
                        if (user?.id !== movieStartedBy) {
                          socket?.emit("room:movie-watching", { roomId: room.id, hostId: movieStartedBy, watching: false });
                        }
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 transition-all duration-150 active:scale-90"
                      title="Hide player (movie continues for others)"
                      data-testid="button-movie-close-bar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeYoutubeId && showYoutube && (() => {
            const isYoutubeHost = user?.id === youtubeStartedBy;
            const broadcaster = youtubeStartedBy ? participantById.get(youtubeStartedBy) : undefined;
            const bIndex = participants.findIndex(p => p.id === youtubeStartedBy);
            const bGradient = getAvatarGradient(bIndex >= 0 ? bIndex : 0);
            return (
              <div
                className="bg-black flex flex-col group/ytplayer overflow-hidden"
                style={ytPlayerHeight ? { height: ytPlayerHeight, flexShrink: 0 } : { flex: 1, minHeight: 0 }}
                data-testid="media-main-youtube"
                data-yt-slot="true"
              >
                {/* ── Video area: takes all remaining height — ref'd so the persistent
                    fixed-position player can match exactly this rect, not the whole container */}
                <div ref={ytSlotRef} className="relative flex-1 min-h-0 overflow-hidden">

                  {/* Connection quality badge */}
                  <div
                    className={`absolute top-3 left-3 z-20 flex items-center gap-1.5 backdrop-blur-sm text-[10px] font-medium px-2 py-1 rounded-full border shadow-md transition-colors ${
                      ytQualityState === "slow"
                        ? "bg-amber-500/85 border-amber-300/50 text-white"
                        : "bg-emerald-600/70 border-emerald-300/40 text-white"
                    }`}
                    data-testid="badge-yt-connection"
                    title={ytQualityState === "slow" ? "Slow connection — quality reduced to keep playing" : "Connection good"}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${ytQualityState === "slow" ? "bg-white animate-pulse" : "bg-white"}`} />
                    {ytQualityState === "slow" ? "Slow" : "Good"}
                  </div>

                  {/* YT API container — always visible; YT.Player injects its <iframe> here */}
                  <div
                    ref={ytContainerRef}
                    className="absolute inset-0 w-full h-full z-[1]"
                    style={{ opacity: 1 }}
                    data-testid="div-youtube-container"
                  />

                  {/* Error overlay — shown when YT API fires onError (e.g. embed disabled) */}
                  {ytPlayerError && (
                    <div className="absolute inset-0 z-[25] flex items-center justify-center bg-black/95 px-4" data-testid="youtube-error-overlay">
                      <div className="flex flex-col items-center gap-3 text-center max-w-xs">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                        <p className="text-sm text-white/90 leading-snug">{ytPlayerError.message}</p>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-3 py-1.5 text-[12px] font-semibold bg-blue-500 hover:bg-blue-400 text-white rounded-full transition-colors"
                            onClick={() => { setYtPlayerError(null); setYtRetryNonce(n => n + 1); }}
                            data-testid="button-youtube-retry"
                          >Retry</button>
                          <a
                            className="px-3 py-1.5 text-[12px] font-semibold bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                            href={`https://www.youtube.com/watch?v=${activeYoutubeId}`}
                            target="_blank" rel="noopener noreferrer"
                            data-testid="link-youtube-open"
                          >Watch on YouTube ↗</a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top-right cluster: close button — z-[30] clears the iframe (z-[1]) */}
                  <div className="absolute top-3 right-3 z-[30] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (user?.id === youtubeStartedBy) {
                          handleStopYoutube();
                        } else {
                          setShowYoutube(false);
                          setUserDismissedYoutube(true);
                          setMiniPlayerMode(false);
                        }
                      }}
                      className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm hover:bg-red-500/80 border border-white/20 flex items-center justify-center text-white shadow-md transition-colors"
                      title={user?.id === youtubeStartedBy ? "Close video for everyone" : "Hide video (just for you)"}
                      data-testid="button-yt-corner-close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* ── Emoji / reactions bar — pinned to bottom-right corner of the video ── */}
                  <div
                    className="absolute bottom-3 right-3 z-[30] flex items-center gap-2"
                    data-testid="youtube-host-controls"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Expanded emoji + vote panel */}
                    {ytReactionsOpen && (
                      <div
                        className="flex items-center gap-1 bg-black/75 backdrop-blur-md rounded-full border border-white/15 px-2 py-1.5 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150"
                        data-testid="yt-reactions-panel"
                      >
                        {["❤️", "🔥", "😂", "😮", "👏", "👍", "🤯"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); if (socket) socket.emit("room:youtube-reaction", { roomId: room.id, emoji }); }}
                            className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center text-lg transition-transform hover:scale-125 active:scale-90"
                            title={`Send ${emoji}`}
                            data-testid={`button-yt-react-${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        <div className="w-px h-5 bg-white/20 mx-0.5" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!socket) return;
                            const next = myYtVote === "like" ? null : "like";
                            setMyYtVote(next);
                            socket.emit("room:youtube-vote", { roomId: room.id, hostId: youtubeStartedBy, kind: next || "none" });
                          }}
                          className={`h-8 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-semibold transition-colors ${myYtVote === "like" ? "bg-emerald-500/85 text-white" : "bg-white/10 text-white/80 hover:bg-white/20"}`}
                          title="Like this video"
                          data-testid="button-yt-vote-like"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span className="tabular-nums">{ytVotes.likes}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!socket) return;
                            const next = myYtVote === "dislike" ? null : "dislike";
                            setMyYtVote(next);
                            socket.emit("room:youtube-vote", { roomId: room.id, hostId: youtubeStartedBy, kind: next || "none" });
                          }}
                          className={`h-8 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-semibold transition-colors ${myYtVote === "dislike" ? "bg-red-500/85 text-white" : "bg-white/10 text-white/80 hover:bg-white/20"}`}
                          title="Dislike this video"
                          data-testid="button-yt-vote-dislike"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span className="tabular-nums">{ytVotes.dislikes}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!socket) return;
                            const next = !myYtSkipVote;
                            setMyYtSkipVote(next);
                            socket.emit("room:youtube-skip-vote", { roomId: room.id, hostId: youtubeStartedBy, vote: next });
                          }}
                          className={`h-8 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-semibold transition-colors ${myYtSkipVote ? "bg-amber-500/85 text-white" : "bg-white/10 text-white/80 hover:bg-white/20"}`}
                          title={`Vote to skip — auto-advances when ${Math.max(2, Math.ceil((ytVotes.watchers || participants.length) / 2))} people agree`}
                          data-testid="button-yt-vote-skip"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                          <span className="tabular-nums">{ytVotes.skip}</span>
                        </button>
                        {/* Close / collapse the emoji bar */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setYtReactionsOpen(false); }}
                          className="w-7 h-7 ml-0.5 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                          title="Close emoji bar"
                          data-testid="button-yt-reactions-close"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {/* Toggle button — always visible so users can open/close the bar */}
                    {!ytReactionsOpen && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setYtReactionsOpen(true); }}
                        className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/75 shadow-md transition-colors"
                        title="Reactions & votes"
                        data-testid="button-yt-reactions-toggle"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Resize handle — drag to resize the player height */}
                <div
                  className="relative z-[40] flex-shrink-0 h-2.5 flex items-center justify-center cursor-ns-resize group/resize-yt hover:bg-white/10 transition-colors"
                  data-testid="youtube-player-resize-handle"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const container = e.currentTarget.parentElement!;
                    const startH = container.getBoundingClientRect().height;
                    const onMove = (me: MouseEvent) => {
                      const outerH = container.parentElement?.getBoundingClientRect().height ?? 600;
                      setYtPlayerHeight(Math.max(180, Math.min(outerH - 80, startH + (me.clientY - startY))));
                    };
                    const onUp = () => {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                >
                  <div className="w-14 h-1 rounded-full bg-white/25 group-hover/resize-yt:bg-white/60 transition-colors" />
                </div>
              </div>
            );
          })()}

          {showEReader && selectedBook && (
            <div
              className={eReaderFullscreen ? "fixed inset-0 z-[90] flex flex-col" : "flex flex-col relative"}
              style={eReaderFullscreen
                ? { background: eReaderTheme === "sepia" ? "#f5ead5" : eReaderTheme === "light" ? "#ffffff" : "#1a1a1a", color: eReaderTheme === "dark" ? "#d4c9b0" : "#1a1008" }
                : eReaderHeight
                  ? { height: eReaderHeight, flexShrink: 0, minHeight: 140, background: eReaderTheme === "sepia" ? "#f5ead5" : eReaderTheme === "light" ? "#ffffff" : "#1a1a1a", color: eReaderTheme === "dark" ? "#d4c9b0" : "#1a1008" }
                  : { height: "clamp(180px, 38vh, 420px)", flexShrink: 0, minHeight: 140, background: eReaderTheme === "sepia" ? "#f5ead5" : eReaderTheme === "light" ? "#ffffff" : "#1a1a1a", color: eReaderTheme === "dark" ? "#d4c9b0" : "#1a1008" }
              }
              data-testid="media-main-ereader"
            >

              {/* Drag-to-resize handle at the BOTTOM — drag DOWN to grow, drag UP to shrink */}
              {!eReaderFullscreen && (
                <div
                  className="flex-shrink-0 h-5 flex items-center justify-center cursor-s-resize group/resize-reader select-none z-10"
                  data-testid="ereader-resize-handle"
                  title="Drag down to expand · Drag up to shrink"
                  style={{
                    background: eReaderTheme === "sepia" ? "#ece0c5" : eReaderTheme === "light" ? "#e8e8e8" : "#111111",
                    borderTop: `1px solid ${eReaderTheme === "dark" ? "#333" : "#d4c4a0"}`,
                    borderBottom: `2px solid ${eReaderTheme === "dark" ? "#555" : "#b8a880"}`,
                    touchAction: "none",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const container = e.currentTarget.parentElement!;
                    const startH = container.getBoundingClientRect().height;
                    const onMove = (me: MouseEvent) => {
                      const outerH = container.parentElement?.getBoundingClientRect().height ?? window.innerHeight;
                      const delta = me.clientY - startY;
                      setEReaderHeight(Math.max(140, Math.min(outerH - 60, startH + delta)));
                    };
                    const onUp = () => {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const startY = touch.clientY;
                    const container = e.currentTarget.parentElement!;
                    const startH = container.getBoundingClientRect().height;
                    const onMove = (te: TouchEvent) => {
                      te.preventDefault();
                      const t = te.touches[0];
                      const outerH = container.parentElement?.getBoundingClientRect().height ?? window.innerHeight;
                      const delta = t.clientY - startY;
                      setEReaderHeight(Math.max(140, Math.min(outerH - 60, startH + delta)));
                    };
                    const onUp = () => {
                      document.removeEventListener("touchmove", onMove);
                      document.removeEventListener("touchend", onUp);
                    };
                    document.addEventListener("touchmove", onMove, { passive: false });
                    document.addEventListener("touchend", onUp);
                  }}
                >
                  <div
                    className="w-20 h-1.5 rounded-full opacity-50 group-hover/resize-reader:opacity-90 transition-opacity"
                    style={{ background: eReaderTheme === "dark" ? "#d4c9b0" : "#8b6914" }}
                  />
                </div>
              )}

              {/* Reader toolbar */}
              <div
                className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0 flex-wrap gap-y-1.5"
                style={{
                  background: eReaderTheme === "sepia" ? "#ece0c5" : eReaderTheme === "light" ? "#f0f0f0" : "#111111",
                  borderColor: eReaderTheme === "dark" ? "#333" : "#d4c4a0",
                }}
              >
                <button
                  onClick={handleCloseBook}
                  className="flex-shrink-0 p-1 rounded hover:opacity-70 transition-opacity"
                  title="Close book"
                >
                  <X className="w-4 h-4" />
                </button>
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                <span className="text-xs font-semibold truncate flex-1 min-w-0 max-w-[120px] sm:max-w-[200px]">{selectedBook.title}</span>

                <div className="flex items-center gap-1 ml-auto flex-shrink-0 flex-wrap justify-end">
                  {/* Font size */}
                  <button onClick={() => setEReaderFontSize(s => Math.max(12, s - 2))} className="px-1.5 py-0.5 rounded text-xs font-bold hover:opacity-70 transition-opacity" title="Smaller">A−</button>
                  <span className="text-[10px] opacity-60 w-7 text-center">{eReaderFontSize}</span>
                  <button onClick={() => setEReaderFontSize(s => Math.min(28, s + 2))} className="px-1.5 py-0.5 rounded text-xs font-bold hover:opacity-70 transition-opacity" title="Larger">A+</button>
                  {/* Fullscreen / collapse toggle */}
                  <button
                    onClick={() => { setEReaderFullscreen(v => !v); setEReaderHeight(null); }}
                    className="p-1 rounded hover:opacity-70 transition-opacity ml-0.5"
                    title={eReaderFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
                    data-testid="button-ereader-fullscreen"
                  >
                    {eReaderFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>

                  {/* Theme dots */}
                  <div className="flex items-center gap-1 ml-1">
                    {(["sepia", "light", "dark"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setEReaderTheme(t)}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${eReaderTheme === t ? "border-primary scale-110" : "border-transparent opacity-50 hover:opacity-80"}`}
                        style={{ background: t === "sepia" ? "#f5ead5" : t === "light" ? "#ffffff" : "#1a1a1a", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)" }}
                        title={t}
                      />
                    ))}
                  </div>

                  {/* Translation language picker */}
                  <select
                    value={translationLang}
                    onChange={e => { setTranslationLang(e.target.value); setWordInfo(null); }}
                    className="ml-1 text-[10px] rounded px-1 py-0.5 border cursor-pointer"
                    style={{
                      background: eReaderTheme === "sepia" ? "#f5ead5" : eReaderTheme === "light" ? "#fff" : "#222",
                      color: eReaderTheme === "dark" ? "#d4c9b0" : "#333",
                      borderColor: eReaderTheme === "dark" ? "#555" : "#c4b48a",
                    }}
                    aria-label="Translation language"
                    title="Translation language"
                  >
                    <option value="hy">→ Armenian</option>
                    <option value="es">→ Spanish</option>
                    <option value="fr">→ French</option>
                    <option value="de">→ German</option>
                    <option value="it">→ Italian</option>
                    <option value="pt">→ Portuguese</option>
                    <option value="ru">→ Russian</option>
                    <option value="ar">→ Arabic</option>
                    <option value="zh">→ Chinese</option>
                    <option value="ja">→ Japanese</option>
                    <option value="ko">→ Korean</option>
                    <option value="hi">→ Hindi</option>
                    <option value="tr">→ Turkish</option>
                    <option value="nl">→ Dutch</option>
                    <option value="pl">→ Polish</option>
                    <option value="uk">→ Ukrainian</option>
                    <option value="vi">→ Vietnamese</option>
                    <option value="id">→ Indonesian</option>
                    <option value="th">→ Thai</option>
                    <option value="sv">→ Swedish</option>
                    <option value="en">→ English</option>
                  </select>

                  {bookReaders.size > 0 && (
                    <div className="flex items-center gap-1 ml-1.5 pl-1.5 border-l border-current/20 flex-shrink-0" data-testid="ereader-readers-pill">
                      <div className="flex items-center">
                        {Array.from(bookReaders).slice(0, 3).map((readerId, ri) => {
                          const reader = participants.find(rp => rp.id === readerId);
                          const rIndex = participants.findIndex(rp => rp.id === readerId);
                          const rGrad = getAvatarGradient(rIndex >= 0 ? rIndex : ri);
                          return (
                            <div
                              key={readerId}
                              className="w-4 h-4 rounded-full border border-background/60 overflow-hidden flex items-center justify-center flex-shrink-0"
                              style={{ marginLeft: ri === 0 ? 0 : -4, zIndex: 3 - ri }}
                              title={reader ? getUserDisplayName(reader) : readerId}
                            >
                              {reader?.profileImageUrl ? (
                                <img loading="lazy" decoding="async" src={reader.profileImageUrl} alt={reader ? getUserDisplayName(reader) : ""} className="w-full h-full object-cover" />
                              ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${rGrad} flex items-center justify-center`}>
                                  <span className="text-[6px] font-bold text-white">{reader ? getUserInitials(reader) : "?"}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {bookReaders.size > 3 && (
                          <div className="w-4 h-4 rounded-full border border-background/60 bg-amber-700 flex items-center justify-center flex-shrink-0 text-[6px] font-bold text-white" style={{ marginLeft: -4 }}>
                            +{bookReaders.size - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] opacity-60 ml-1 whitespace-nowrap">
                        {bookReaders.size === 1 ? "1 reading" : `${bookReaders.size} reading`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Translation result panel */}
              {(wordInfo || translating) && (
                <div
                  className="flex items-start gap-2 px-4 py-2.5 border-b flex-shrink-0"
                  style={{
                    background: eReaderTheme === "sepia" ? "#f0e4c8" : eReaderTheme === "light" ? "#f8f8f2" : "#1e1e14",
                    borderColor: eReaderTheme === "dark" ? "#333" : "#d4c4a0",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold leading-tight line-clamp-2 opacity-80"
                      style={{ fontStyle: "italic" }}>
                      "{wordInfo?.word}"
                    </p>
                    {translating ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Loader2 className="w-3 h-3 animate-spin opacity-50" />
                        <span className="text-[10px] opacity-50">Translating…</span>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold mt-0.5" style={{ color: eReaderTheme === "dark" ? "#e6a830" : "#8b6914" }}>
                        {wordInfo?.translation}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {wordInfo && (
                      <button onClick={() => speakWord(wordInfo.word)} className="p-1 rounded hover:opacity-70 transition-opacity" title="Pronounce">
                        <Volume1 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => setWordInfo(null)} className="p-1 rounded hover:opacity-70 transition-opacity" aria-label="Close word info">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Reader hint */}
              {!wordInfo && !translating && (
                <div
                  className="px-4 py-1 text-center flex-shrink-0"
                  style={{ background: eReaderTheme === "sepia" ? "#ece0c5" : eReaderTheme === "light" ? "#f0f0f0" : "#111111" }}
                >
                  <p className="text-[10px] opacity-40">Select any word or sentence to translate it</p>
                </div>
              )}

              {/* Book content — scrollable within each page */}
              <div
                className="flex-1 min-h-0 overflow-y-auto relative"
                style={{ scrollbarWidth: "thin", scrollbarColor: eReaderTheme === "dark" ? "#444 #1a1a1a" : "#c4b48a #f5ead5" }}
                onMouseUp={handleReaderMouseUp}
                data-testid="ereader-content-area"
              >
                {bookLoading ? (
                  <div className="flex items-center justify-center h-full min-h-[80px]">
                    <Loader2 className="w-6 h-6 animate-spin opacity-40" />
                  </div>
                ) : bookPages.length > 0 ? (() => {
                  const visibleText = eReaderScrollMode
                    ? bookPages.slice(currentPage - 1, currentPage + 4).join("\n\n───\n\n")
                    : (bookPages[currentPage - 1] || "");
                  const lines = visibleText.split("\n").filter(l => l.trim().length > 0);
                  const avgLen = lines.length > 0 ? lines.reduce((s, l) => s + l.trim().length, 0) / lines.length : 999;
                  const isPoetry = lines.length >= 3 && avgLen < 55;
                  return (
                    <div className="px-4 sm:px-10 md:px-16 py-5">
                      <div className="w-full max-w-2xl mx-auto">
                        <div
                          className="leading-relaxed whitespace-pre-wrap select-text"
                          style={{
                            fontSize: eReaderFontSize,
                            lineHeight: 1.9,
                            fontFamily: "Georgia, 'Palatino Linotype', Palatino, 'Times New Roman', serif",
                            letterSpacing: "0.02em",
                            color: eReaderTheme === "dark" ? "#d4c9b0" : eReaderTheme === "sepia" ? "#3a2a14" : "#1a1008",
                            textAlign: isPoetry ? "center" : "left",
                          }}
                        >
                          {visibleText}
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="flex items-center justify-center h-full min-h-[80px] opacity-50">
                    <p className="text-sm" style={{ fontFamily: "Georgia, serif" }}>Could not load content. Try another title.</p>
                  </div>
                )}

                {/* Floating side-arrow navigation — always visible, vertically centred */}
                {!bookLoading && bookPages.length > 0 && (
                  <>
                    <button
                      onClick={() => { goToPage(currentPage - 1); }}
                      disabled={currentPage <= 1}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded-full shadow-md transition-all duration-150 disabled:opacity-0 disabled:pointer-events-none active:scale-90 hover:scale-110 select-none"
                      style={{
                        background: eReaderTheme === "dark"
                          ? "rgba(30,24,14,0.82)"
                          : eReaderTheme === "sepia"
                          ? "rgba(236,224,197,0.92)"
                          : "rgba(255,255,255,0.88)",
                        border: `1px solid ${eReaderTheme === "dark" ? "rgba(200,180,120,0.18)" : "rgba(0,0,0,0.10)"}`,
                        color: eReaderTheme === "dark" ? "#c8b890" : "#7a5c2a",
                        backdropFilter: "blur(6px)",
                        boxShadow: eReaderTheme === "dark"
                          ? "0 2px 12px rgba(0,0,0,0.55)"
                          : "0 2px 10px rgba(0,0,0,0.14)",
                      }}
                      data-testid="button-ereader-prev-page"
                      title="Previous page (← key)"
                    >
                      <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                    </button>

                    <button
                      onClick={() => { goToPage(currentPage + 1); }}
                      disabled={currentPage >= bookPages.length}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded-full shadow-md transition-all duration-150 disabled:opacity-0 disabled:pointer-events-none active:scale-90 hover:scale-110 select-none"
                      style={{
                        background: eReaderTheme === "dark"
                          ? "rgba(30,24,14,0.82)"
                          : eReaderTheme === "sepia"
                          ? "rgba(236,224,197,0.92)"
                          : "rgba(255,255,255,0.88)",
                        border: `1px solid ${eReaderTheme === "dark" ? "rgba(200,180,120,0.18)" : "rgba(0,0,0,0.10)"}`,
                        color: eReaderTheme === "dark" ? "#c8b890" : "#7a5c2a",
                        backdropFilter: "blur(6px)",
                        boxShadow: eReaderTheme === "dark"
                          ? "0 2px 12px rgba(0,0,0,0.55)"
                          : "0 2px 10px rgba(0,0,0,0.14)",
                      }}
                      data-testid="button-ereader-next-page"
                      title="Next page (→ key)"
                    >
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom status bar — page counter + mode toggle only */}
              {!bookLoading && bookPages.length > 0 && (
                <div
                  className="flex-shrink-0 flex items-center justify-center gap-3 px-3 py-1.5 border-t select-none"
                  style={{
                    background: eReaderTheme === "sepia" ? "#ece0c5" : eReaderTheme === "light" ? "#efefef" : "#111111",
                    borderColor: eReaderTheme === "dark" ? "#333" : "#d4c4a0",
                  }}
                >
                  <span
                    className="text-[10px] font-medium tabular-nums"
                    style={{ color: eReaderTheme === "dark" ? "rgba(200,184,144,0.55)" : "rgba(90,60,20,0.45)", letterSpacing: "0.06em", fontFamily: "Georgia, serif" }}
                    data-testid="text-ereader-page-info"
                  >
                    {currentPage} / {bookPages.length}
                  </span>
                  <button
                    onClick={() => setEReaderScrollMode(v => !v)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all"
                    style={{
                      background: eReaderScrollMode
                        ? (eReaderTheme === "dark" ? "rgba(180,140,60,0.25)" : "rgba(139,105,20,0.15)")
                        : (eReaderTheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
                      color: eReaderScrollMode
                        ? (eReaderTheme === "dark" ? "#e6a830" : "#7a4e10")
                        : (eReaderTheme === "dark" ? "#c8b890" : "#7a5c2a"),
                      border: `1px solid ${eReaderScrollMode ? (eReaderTheme === "dark" ? "rgba(200,150,40,0.3)" : "rgba(139,105,20,0.25)") : "transparent"}`,
                    }}
                    title={eReaderScrollMode ? "Switch to page mode" : "Switch to scroll mode"}
                    data-testid="button-ereader-mode-toggle"
                  >
                    {eReaderScrollMode ? <AlignJustify className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                    {eReaderScrollMode ? "Scroll" : "Pages"}
                  </button>
                </div>
              )}


            </div>
          )}

          {isScreenSharing && !(activeYoutubeId && showYoutube) && !showEReader && (
            <div className="flex-1 min-h-0 bg-black relative" data-testid="media-main-screen">
              <video
                ref={attachLocalScreen}
                autoPlay
                muted
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 backdrop-blur-sm border border-green-500/40 rounded-full px-4 py-1.5 shadow-lg z-10">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                <Monitor className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                <span className="text-white text-xs font-semibold">You are sharing your screen</span>
                <button
                  onClick={handleScreenShare}
                  className="ml-1 text-[10px] text-red-400 hover:text-red-300 font-medium border border-red-500/40 hover:border-red-400/60 rounded-full px-2 py-0.5 transition-colors"
                  data-testid="button-stop-screen-share-overlay"
                >
                  Stop
                </button>
              </div>
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full pl-1 pr-3 py-1 shadow-lg border border-white/10 z-10">
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-green-500/70 bg-green-700 flex items-center justify-center">
                  {user?.profileImageUrl ? (
                    <img loading="lazy" decoding="async" src={user.profileImageUrl} alt={getUserDisplayName(user as any)} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-[10px] font-bold text-white">{getUserInitials(user as any)}</span>
                  )}
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-white text-[11px] font-semibold">{getUserDisplayName(user as any)}</span>
                  <span className="text-green-400 text-[9px] font-medium">Sharing screen</span>
                </div>
              </div>
            </div>
          )}

          {remoteScreenShareUserId && !isScreenSharing && !(activeYoutubeId && showYoutube) && !showEReader && (
            <div className="flex-1 min-h-0 bg-black relative" data-testid="media-remote-screen">
              <video
                ref={attachRemoteScreen}
                autoPlay
                playsInline
                onPlaying={() => setRemoteScreenPlaying(true)}
                onLoadedData={() => setRemoteScreenPlaying(true)}
                onEmptied={() => setRemoteScreenPlaying(false)}
                className={`w-full h-full transition-opacity duration-300 ${remoteScreenPlaying ? "opacity-100" : "opacity-0"} ${screenFitMode === "fill" ? "object-cover" : "object-contain"}`}
              />
              {!remoteScreenPlaying && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black" data-testid="overlay-screen-loading">
                  <div className="flex flex-col items-center gap-3 text-white/80">
                    <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                    <span className="text-xs font-medium tracking-wide">Loading screen…</span>
                  </div>
                </div>
              )}
              <button
                onClick={toggleScreenFitMode}
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/70 hover:bg-black/85 backdrop-blur-sm border border-white/15 rounded-full px-2.5 py-1 shadow-lg text-white text-[11px] font-medium transition-colors"
                title={screenFitMode === "fit" ? "Switch to edge-to-edge (crop)" : "Switch to fit (no crop)"}
                aria-label={screenFitMode === "fit" ? "Switch to fill mode" : "Switch to fit mode"}
                data-testid="button-screen-fit-toggle"
              >
                {screenFitMode === "fit" ? (
                  <>
                    <Maximize2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Fill</span>
                  </>
                ) : (
                  <>
                    <Minimize2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Fit</span>
                  </>
                )}
              </button>
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-white/15 rounded-full px-3 py-1 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                  <Monitor className="w-3 h-3 text-orange-400 flex-shrink-0" />
                  <span className="text-white text-xs">{getUserDisplayName(remoteScreenShareUserId ? participantById.get(remoteScreenShareUserId) : undefined)} is sharing screen</span>
                </div>
                {isHost && remoteScreenShareUserId && (
                  <button
                    onClick={() => {
                      socket?.emit("room:screen-share-force-stop", { roomId: room.id, targetUserId: remoteScreenShareUserId });
                      toast({ title: "Stopping share", description: "Asked the participant to stop sharing." });
                    }}
                    className="flex items-center gap-1.5 bg-red-600/90 hover:bg-red-500 text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg border border-red-300/30 transition-colors"
                    title="Stop sharing for everyone (host)"
                    data-testid="button-host-force-stop-screen"
                  >
                    <StopCircle className="w-3 h-3" />
                    Stop Sharing
                  </button>
                )}
              </div>
              {(() => {
                const sharer = remoteScreenShareUserId ? participantById.get(remoteScreenShareUserId) : undefined;
                return sharer ? (
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full pl-1 pr-3 py-1 shadow-lg border border-white/10 z-10">
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-orange-500/60 bg-orange-900/60 flex items-center justify-center">
                      {(sharer as any).profileImageUrl ? (
                        <img loading="lazy" decoding="async" src={(sharer as any).profileImageUrl} alt={getUserDisplayName(sharer as any)} className="w-full h-full object-cover rounded-full" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <span className="text-[10px] font-bold text-white">{getUserInitials(sharer as any)}</span>
                      )}
                    </div>
                    <div className="flex flex-col leading-none">
                      <span className="text-white text-[11px] font-semibold">{getUserDisplayName(sharer as any)}</span>
                      <span className="text-orange-400/80 text-[9px] font-medium">Sharing screen</span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {remoteVideoUserId && !(activeYoutubeId && showYoutube) && !showEReader && !isScreenSharing && !remoteScreenShareUserId && (
            <div className="flex-1 min-h-0 bg-black relative" data-testid="media-remote-video">
              <video
                ref={attachRemoteVideo}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/70 backdrop-blur-sm rounded-full px-3 py-1 text-xs">
                {getUserDisplayName(remoteVideoUserId ? participantById.get(remoteVideoUserId) : undefined)}
              </div>
            </div>
          )}

          {false && isVideoOn && localVideoStreamObj && !miniCameraMode && !isScreenSharing && !(activeYoutubeId && showYoutube) && !showEReader && !remoteVideoUserId && (
            <div className="flex-1 min-h-0 bg-black relative" data-testid="media-local-camera">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
              />
              {/* Flip camera button — overlaid on the camera preview for easy mobile access */}
              <button
                onClick={handleFlipCamera}
                disabled={isFlippingCamera}
                data-testid="button-flip-camera"
                title={cameraFacing === "user" ? "Switch to back camera" : "Switch to front camera"}
                aria-label="Flip camera"
                className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className={`w-4 h-4 text-white ${isFlippingCamera ? "animate-spin" : ""}`} />
              </button>
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full pl-1 pr-3 py-1 shadow-lg border border-white/10 z-10">
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-orange-500/60 bg-orange-900/60 flex items-center justify-center">
                  {user?.profileImageUrl ? (
                    <img loading="lazy" decoding="async" src={user.profileImageUrl} alt={getUserDisplayName(user as any)} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-[10px] font-bold text-white">{getUserInitials(user as any)}</span>
                  )}
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-white text-[11px] font-semibold">{getUserDisplayName(user as any)}</span>
                  <span className="text-blue-400 text-[9px] flex items-center gap-0.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                    Camera On
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── DJ Scene full-screen overlay (position:fixed, covers whole viewport) ── */}
          <DjSceneOverlay scene={djCurrentScene} participants={participants} active={djModeActive} />

          {/* ── DJ Intro Countdown — 3→2→1 fullscreen overlay before first scene ── */}
          {djCountdown !== null && (
            <div
              style={{
                position: "fixed", inset: 0, zIndex: 10000,
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
                background: "radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.40) 60%, transparent 100%)",
              }}
              aria-hidden="true"
            >
              <div
                key={djCountdown}
                style={{
                  fontSize: "clamp(100px,22vw,220px)",
                  fontWeight: 900,
                  fontFamily: "'Space Grotesk','Impact','Arial Black',sans-serif",
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  color: "#fff",
                  textShadow: `0 0 60px rgba(${getDjBeatColor(djCurrentScene)},0.95), 0 0 120px rgba(${getDjBeatColor(djCurrentScene)},0.55), 0 8px 32px rgba(0,0,0,0.80)`,
                  animation: "dj-countdown-pop 0.88s cubic-bezier(0.22,1,0.36,1) forwards",
                }}
              >
                {djCountdown}
              </div>
            </div>
          )}

          {(() => {
            const visibleCount = participants.filter(p => !foreverBlockedIds.has(p.id)).length;
            const cardPx =
              visibleCount <= 2 ? 128 :
              visibleCount <= 4 ? 110 :
              visibleCount <= 6 ? 94 :
              visibleCount <= 8 ? 82 :
              visibleCount <= 10 ? 72 :
              visibleCount <= 14 ? 64 :
              56;
            const gapPx = cardPx <= 72 ? 6 : 8;
            const isInOverlayMode = (activeYoutubeId && showYoutube) || (activeMovieId && showMovie) || showEReader || isScreenSharing || !!remoteScreenShareUserId || !!remoteVideoUserId || !!(room as any).hologramVideoUrl || (currentTheme && currentTheme !== "none");
            const gridCols = visibleCount === 1 ? 1 : visibleCount <= 4 ? 2 : visibleCount <= 9 ? 3 : 4;
          return (
          <div
            className={isInOverlayMode ? "flex items-end justify-center p-2 pb-4 absolute bottom-0 left-0 right-0 z-20 pt-16 overflow-visible" : "flex-1 min-h-0 p-2 pt-14 overflow-hidden"}
            style={isInOverlayMode ? {} : { display: "grid", gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gridAutoRows: "1fr", gap: 8 }}
          >
            <div
              className={isInOverlayMode ? "overflow-x-auto w-full" : "contents"}
              style={isInOverlayMode ? { scrollbarWidth: "none" as const } : {}}
            >
            <div className={isInOverlayMode ? "flex flex-nowrap items-end justify-center pt-14" : "contents"} style={isInOverlayMode ? { gap: gapPx, minWidth: "max-content", margin: "0 auto" } : {}}>
              {participants.map((p, index) => {
                if (foreverBlockedIds.has(p.id) && p.id !== user?.id) return null;
                const isBlockedUser = blockedIds.has(p.id) && p.id !== user?.id;
                const isSpeaking = speakingUsers.has(p.id);
                const isMe = p.id === user?.id;
                const isRoomOwner = p.id === room.ownerId;
                const gradient = getAvatarGradient(index);

                return (
                  <div
                    key={p.id}
                    className={isInOverlayMode ? "flex flex-col items-center gap-2 group relative" : "relative min-h-0"}
                    data-testid={`card-participant-${p.id}`}
                    style={{
                      ...(djModeActive && !isRoomOwner ? (() => {
                        const resolvedStyle = djMoveStyle === "auto"
                          ? DJ_AUTO_CYCLE[(djMoveTick + index * 3) % DJ_AUTO_CYCLE.length]
                          : djMoveStyle;
                        return getDjMoveStyle(index, resolvedStyle);
                      })() : {}),
                      ...(djModeActive && djCurrentScene === "spotlight" && djSpotlightIdx === index
                        ? { filter: `drop-shadow(0 0 18px rgba(${DJ_SPOT_COLS[djSpotlightIdx % DJ_SPOT_COLS.length]},0.95)) drop-shadow(0 0 36px rgba(${DJ_SPOT_COLS[djSpotlightIdx % DJ_SPOT_COLS.length]},0.55))` }
                        : {}),
                    }}
                  >
                    {/* ── DJ Beat-drop pulse — fires on every scene transition ── */}
                    {djModeActive && djBeatDropTick > 0 && (
                      <div
                        key={djBeatDropTick}
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: -6,
                          borderRadius: 18,
                          background: `radial-gradient(ellipse at 50% 60%, rgba(${getDjBeatColor(djCurrentScene)},0.72) 0%, rgba(${getDjBeatColor(djCurrentScene)},0.18) 55%, transparent 80%)`,
                          boxShadow: `0 0 32px 8px rgba(${getDjBeatColor(djCurrentScene)},0.55), 0 0 60px 20px rgba(${getDjBeatColor(djCurrentScene)},0.22)`,
                          animation: "dj-beat-drop 0.72s cubic-bezier(0.22,1,0.36,1) forwards",
                          pointerEvents: "none",
                          zIndex: 28,
                        }}
                      />
                    )}

                    {/* DJ spotlight beam from above */}
                    {djModeActive && djCurrentScene === "spotlight" && djSpotlightIdx === index && (
                      <>
                        <div style={{
                          position:"absolute", bottom:"100%", left:"50%",
                          transform:"translateX(-50%)",
                          width:70, height:220,
                          background:`linear-gradient(to bottom, transparent 0%, rgba(${DJ_SPOT_COLS[djSpotlightIdx % DJ_SPOT_COLS.length]},0.55) 80%, rgba(${DJ_SPOT_COLS[djSpotlightIdx % DJ_SPOT_COLS.length]},0.85) 100%)`,
                          clipPath:"polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)",
                          filter:"blur(5px)",
                          pointerEvents:"none",
                          zIndex:20,
                          animation:"rt-disco-bass-slam 1.8s ease-out infinite",
                        }} />
                        <div style={{
                          position:"absolute", inset:-6,
                          borderRadius:16,
                          border:`2px solid rgba(${DJ_SPOT_COLS[djSpotlightIdx % DJ_SPOT_COLS.length]},0.90)`,
                          boxShadow:`0 0 16px 4px rgba(${DJ_SPOT_COLS[djSpotlightIdx % DJ_SPOT_COLS.length]},0.60), 0 0 40px 10px rgba(${DJ_SPOT_COLS[djSpotlightIdx % DJ_SPOT_COLS.length]},0.28)`,
                          pointerEvents:"none",
                          zIndex:20,
                          animation:"rt-disco-participant-glow 0.9s ease-in-out infinite",
                        }} />
                      </>
                    )}
                    {/* Screen-share watcher pills — same look as YouTube watchers */}
                    {(remoteScreenShareUserId === p.id || (isMe && isScreenSharing)) && screenWatchers.size > 0 && (
                      <div className="flex flex-col items-center gap-0.5 mb-1" data-testid={`screen-watchers-card-${p.id}`}>
                        <div className="flex items-center">
                          {Array.from(screenWatchers).slice(0, 4).map((watcherId, wi) => {
                            const watcher = participants.find(wp => wp.id === watcherId);
                            const wIndex = participants.findIndex(wp => wp.id === watcherId);
                            const wGrad = getAvatarGradient(wIndex >= 0 ? wIndex : wi);
                            return (
                              <div
                                key={watcherId}
                                className="w-5 h-5 rounded-full border border-background overflow-hidden flex items-center justify-center shadow-sm"
                                style={{ marginLeft: wi === 0 ? 0 : -6, zIndex: 4 - wi }}
                                title={watcher ? getUserDisplayName(watcher) : watcherId}
                              >
                                {watcher?.profileImageUrl ? (
                                  <img loading="lazy" decoding="async" src={watcher.profileImageUrl} alt={watcher ? getUserDisplayName(watcher) : ""} className="w-full h-full object-cover" />
                                ) : (
                                  <div className={`w-full h-full bg-gradient-to-br ${wGrad} flex items-center justify-center`}>
                                    <span className="text-[7px] font-bold text-white">{watcher ? getUserInitials(watcher) : "?"}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {screenWatchers.size > 4 && (
                            <div className="w-5 h-5 rounded-full border border-background bg-slate-700 flex items-center justify-center shadow-sm text-[7px] font-bold text-white" style={{ marginLeft: -6, zIndex: 0 }}>
                              +{screenWatchers.size - 4}
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] text-muted-foreground">{screenWatchers.size} watching</span>
                      </div>
                    )}

                    {/* Movie watchers stacked above the host's tile */}
                    {movieHosts.has(p.id) && (() => {
                      const watchers = movieWatchersByHost.get(p.id) || new Set<string>();
                      const watcherIds = Array.from(watchers).filter(uid => uid !== p.id);
                      if (watcherIds.length === 0) return null;
                      return (
                        <div className="flex flex-col items-center gap-0.5 mb-1" data-testid={`movie-watchers-card-${p.id}`}>
                          <div className="flex items-center">
                            {watcherIds.slice(0, 4).map((watcherId, wi) => {
                              const watcher = participants.find(rp => rp.id === watcherId);
                              const wIndex = participants.findIndex(rp => rp.id === watcherId);
                              const wGrad = getAvatarGradient(wIndex >= 0 ? wIndex : wi);
                              return (
                                <div
                                  key={watcherId}
                                  className="w-5 h-5 rounded-full border border-background overflow-hidden flex items-center justify-center shadow-sm"
                                  style={{ marginLeft: wi === 0 ? 0 : -6, zIndex: 4 - wi }}
                                  title={watcher ? getUserDisplayName(watcher) : watcherId}
                                  data-testid={`movie-watcher-avatar-${p.id}-${watcherId}`}
                                >
                                  {watcher?.profileImageUrl ? (
                                    <img loading="lazy" decoding="async" src={watcher.profileImageUrl} alt={watcher ? getUserDisplayName(watcher) : ""} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className={`w-full h-full bg-gradient-to-br ${wGrad} flex items-center justify-center`}>
                                      <span className="text-[7px] font-bold text-white">{watcher ? getUserInitials(watcher) : "?"}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {watcherIds.length > 4 && (
                              <div className="w-5 h-5 rounded-full border border-background bg-violet-700 flex items-center justify-center shadow-sm text-[7px] font-bold text-white" style={{ marginLeft: -6, zIndex: 0 }}>
                                +{watcherIds.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-[8px] text-violet-300/85">{watcherIds.length} watching</span>
                        </div>
                      );
                    })()}

                    {/* Watch-party watchers stacked above the host's tile.
                        Each user can host their own video, so this only renders
                        for participants who are currently broadcasting. */}
                    {youtubeHosts.has(p.id) && (() => {
                      const watchers = youtubeWatchersByHost.get(p.id) || new Set<string>();
                      const watcherIds = Array.from(watchers).filter(uid => uid !== p.id);
                      if (watcherIds.length === 0) return null;
                      return (
                        <div className="flex flex-col items-center gap-0.5 mb-1" data-testid={`yt-watchers-card-${p.id}`}>
                          <div className="flex items-center">
                            {watcherIds.slice(0, 4).map((watcherId, wi) => {
                              const watcher = participants.find(rp => rp.id === watcherId);
                              const wIndex = participants.findIndex(rp => rp.id === watcherId);
                              const wGrad = getAvatarGradient(wIndex >= 0 ? wIndex : wi);
                              return (
                                <div
                                  key={watcherId}
                                  className="w-5 h-5 rounded-full border border-background overflow-hidden flex items-center justify-center shadow-sm"
                                  style={{ marginLeft: wi === 0 ? 0 : -6, zIndex: 4 - wi }}
                                  title={watcher ? getUserDisplayName(watcher) : watcherId}
                                  data-testid={`yt-watcher-avatar-${p.id}-${watcherId}`}
                                >
                                  {watcher?.profileImageUrl ? (
                                    <img loading="lazy" decoding="async" src={watcher.profileImageUrl} alt={watcher ? getUserDisplayName(watcher) : ""} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className={`w-full h-full bg-gradient-to-br ${wGrad} flex items-center justify-center`}>
                                      <span className="text-[7px] font-bold text-white">{watcher ? getUserInitials(watcher) : "?"}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {watcherIds.length > 4 && (
                              <div className="w-5 h-5 rounded-full border border-background bg-rose-700 flex items-center justify-center shadow-sm text-[7px] font-bold text-white" style={{ marginLeft: -6, zIndex: 0 }}>
                                +{watcherIds.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-[8px] text-rose-300/85">{watcherIds.length} watching</span>
                        </div>
                      );
                    })()}

                    {bookReaders.has(p.id) && (
                      <div className="flex flex-col items-center gap-0.5 mb-1" data-testid={`book-readers-card-${p.id}`}>
                        {p.id === bookHostId ? (
                          <>
                            <div className="flex items-center">
                              {Array.from(bookReaders).slice(0, 4).map((readerId, ri) => {
                                const reader = participants.find(rp => rp.id === readerId);
                                const rIndex = participants.findIndex(rp => rp.id === readerId);
                                const rGrad = getAvatarGradient(rIndex >= 0 ? rIndex : ri);
                                return (
                                  <div
                                    key={readerId}
                                    className="w-5 h-5 rounded-full border border-background overflow-hidden flex items-center justify-center shadow-sm"
                                    style={{ marginLeft: ri === 0 ? 0 : -6, zIndex: 4 - ri }}
                                    title={reader ? getUserDisplayName(reader) : readerId}
                                  >
                                    {reader?.profileImageUrl ? (
                                      <img loading="lazy" decoding="async" src={reader.profileImageUrl} alt={reader ? getUserDisplayName(reader) : ""} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className={`w-full h-full bg-gradient-to-br ${rGrad} flex items-center justify-center`}>
                                        <span className="text-[7px] font-bold text-white">{reader ? getUserInitials(reader) : "?"}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {bookReaders.size > 4 && (
                                <div className="w-5 h-5 rounded-full border border-background bg-amber-700 flex items-center justify-center shadow-sm text-[7px] font-bold text-white" style={{ marginLeft: -6, zIndex: 0 }}>
                                  +{bookReaders.size - 4}
                                </div>
                              )}
                            </div>
                            <span className="text-[8px] text-amber-400/80">{bookReaders.size} reading</span>
                          </>
                        ) : (
                          <div className="flex items-center gap-0.5 bg-amber-900/60 border border-amber-700/50 rounded-full px-1.5 py-0.5">
                            <BookOpen className="w-2.5 h-2.5 text-amber-400" />
                            <span className="text-[8px] text-amber-300 font-medium">reading</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── DJ Mode controls (host card, disco theme only) ──────── */}
                    {currentTheme === "disco" && isRoomOwner && (
                      <div className="flex flex-col items-center gap-1 mb-1 relative z-30">
                        {/* Badge visible to everyone when DJ mode is on */}
                        {djModeActive && !isMe && (
                          <div style={{
                            display:"flex", alignItems:"center", gap:4,
                            background:"rgba(255,0,200,0.18)", border:"1px solid rgba(255,0,200,0.50)",
                            borderRadius:999, padding:"2px 8px",
                            color:"rgba(255,160,255,0.95)", fontSize:9, fontWeight:800,
                            letterSpacing:"0.08em", textTransform:"uppercase",
                            animation:"dj-badge-pulse 1.2s ease-in-out infinite",
                            pointerEvents:"none",
                          }}>
                            🎧 DJ MODE
                          </div>
                        )}
                        {/* Host-only DJ controls */}
                        {isMe && (
                          <div className="flex flex-col items-center gap-1">
                            {/* Compact trigger: ⏭ skip + 🎧 toggle */}
                            <div style={{ position: "relative", overflow: "visible" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                {/* ⏭ skips the disco background scene */}
                                <button
                                  type="button"
                                  data-testid="button-disco-scene-skip"
                                  onClick={() => handleDiscoAdvance?.()}
                                  title="Next scene"
                                  style={{ padding: "2px 6px", borderRadius: 999, fontSize: 10, fontWeight: 800, cursor: "pointer", background: "rgba(0,220,255,0.18)", border: "1px solid rgba(0,220,255,0.50)", color: "rgba(100,240,255,0.95)", lineHeight: 1.2 }}
                                >⏭</button>
                                {/* 🎧 opens DJ controls dropdown */}
                                <button
                                  ref={djControlsBtnRef}
                                  type="button"
                                  data-testid="button-dj-controls-toggle"
                                  onClick={() => {
                                    const rect = djControlsBtnRef.current?.getBoundingClientRect();
                                    if (rect) {
                                      setDjDropdownPos({
                                        bottom: window.innerHeight - rect.top + 6,
                                        left: rect.left + rect.width / 2,
                                      });
                                    }
                                    setDiscoHostPanelOpen(o => !o);
                                  }}
                                  title="DJ controls"
                                  style={{ padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 800, cursor: "pointer", transition: "all 0.15s", background: discoHostPanelOpen ? "rgba(255,100,255,0.30)" : "rgba(255,100,255,0.14)", border: "1px solid rgba(255,100,255,0.50)", color: "rgba(255,180,255,0.95)", lineHeight: 1.2 }}
                                >🎧</button>
                              </div>

                              {/* DJ controls dropdown — fixed-positioned so no overflow:hidden ancestor clips it */}
                              {discoHostPanelOpen && djDropdownPos && (
                                <div style={{ position: "fixed", bottom: djDropdownPos.bottom, left: djDropdownPos.left, transform: "translateX(-50%)", background: "rgba(10,0,18,0.95)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,100,255,0.28)", borderRadius: 10, padding: "8px", boxShadow: "0 -6px 24px rgba(0,0,0,0.70), 0 0 16px rgba(255,0,200,0.15)", width: 200, zIndex: 99999, display: "flex", flexDirection: "column", gap: 5 }}>
                                  {/* DJ ON / Off — top row */}
                                  <button
                                    type="button"
                                    data-testid="button-dj-mode-toggle"
                                    onClick={() => {
                                      const next = !djModeActive;
                                      setDjModeActive(next);
                                      if (next) { setDjCurrentScene("spotlight"); setDjAutoAdvance(false); }
                                      else { setDiscoHostPanelOpen(false); }
                                      socket?.emit("room:dj-mode", { roomId: room.id, active: next, moveStyle: djMoveStyle });
                                    }}
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "4px 8px", borderRadius: 7, cursor: "pointer", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", transition: "all 0.15s", background: djModeActive ? "linear-gradient(135deg,rgba(255,0,200,0.35),rgba(120,0,255,0.35))" : "rgba(255,0,200,0.10)", border: djModeActive ? "1px solid rgba(255,0,200,0.65)" : "1px solid rgba(255,0,200,0.28)", color: djModeActive ? "rgba(255,180,255,1)" : "rgba(255,120,255,0.80)", animation: djModeActive ? "dj-btn-glow 1.0s ease-in-out infinite" : "none" }}
                                  >
                                    🎧 {djModeActive ? "DJ ON — Stop" : "Start DJ"}
                                  </button>

                                  {djModeActive && (
                                    <>
                                      {/* Scene row: emoji + name + skip */}
                                      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "1px 2px" }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(200,180,255,0.80)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {({"spotlight":"🔦","namestorm":"🌪","disco":"🪩","kiss":"💋","cocktails":"🍹","boomer":"💥","laser":"⚡","fireworks":"🎆","aurora":"🌌","vortex":"🌀","matrix":"💻"} as Record<string,string>)[djCurrentScene] ?? "🎧"} {djCurrentScene}
                                        </span>
                                        <button
                                          type="button"
                                          data-testid="button-dj-skip"
                                          onClick={() => { socket?.emit("room:dj-skip", { roomId: room.id }); }}
                                          style={{ padding: "2px 7px", borderRadius: 999, background: "rgba(0,220,255,0.18)", border: "1px solid rgba(0,220,255,0.50)", color: "rgba(100,240,255,0.95)", fontSize: 8, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                                        >⏭</button>
                                      </div>

                                      {/* Auto toggle + divider */}
                                      <button
                                        type="button"
                                        data-testid="button-dj-auto"
                                        onClick={() => setDjAutoAdvance(a => !a)}
                                        style={{ padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", background: djAutoAdvance ? "rgba(34,197,94,0.20)" : "rgba(255,255,255,0.06)", border: djAutoAdvance ? "1px solid rgba(34,197,94,0.50)" : "1px solid rgba(255,255,255,0.12)", color: djAutoAdvance ? "rgba(134,239,172,0.95)" : "rgba(255,255,255,0.40)" }}
                                      >
                                        ⏱ {djAutoAdvance ? "Auto: ON" : "Auto: OFF"}
                                      </button>

                                      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

                                      {/* Sling styles — compact 4-column grid */}
                                      <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.10em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase" }}>SLING STYLE</span>
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
                                        {(["auto","sling","wave","bounce","pulse","tilt","orbit","float","wiggle","slam","spin","stretch","shake","static"] as const).map(s => (
                                          <button type="button" key={s} data-testid={`button-dj-move-${s}`}
                                            onClick={() => { setDjMoveStyle(s as any); if (s !== "auto") { socket?.emit("room:dj-move", { roomId: room.id, moveStyle: s }); } else { setDjMoveTick(0); socket?.emit("room:dj-move", { roomId: room.id, moveStyle: "auto" }); } }}
                                            style={{ padding: "2px 0", borderRadius: 5, fontSize: 7, fontWeight: 700, cursor: "pointer", textAlign: "center", textTransform: "uppercase", background: djMoveStyle === s ? (s === "auto" ? "rgba(0,220,180,0.30)" : "rgba(255,200,0,0.25)") : "rgba(255,255,255,0.05)", border: djMoveStyle === s ? (s === "auto" ? "1px solid rgba(0,220,180,0.70)" : "1px solid rgba(255,200,0,0.60)") : "1px solid rgba(255,255,255,0.10)", color: djMoveStyle === s ? (s === "auto" ? "rgba(120,255,220,1)" : "rgba(255,230,100,0.95)") : "rgba(255,255,255,0.45)" }}>{s === "auto" ? "✦auto" : s}</button>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* DJ ON badge — shown when active, outside dropdown */}
                            {djModeActive && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: "linear-gradient(135deg,rgba(255,0,200,0.30),rgba(120,0,255,0.30))", border: "1px solid rgba(255,0,200,0.55)", animation: "dj-btn-glow 1.0s ease-in-out infinite" }}>
                                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,180,255,1)" }}>🎧 DJ ON</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 🎧 Headphones crown on host avatar when DJ mode active */}
                    {djModeActive && isRoomOwner && (
                      <div style={{
                        position:"absolute",
                        top: 28,
                        left:"50%",
                        transform:"translateX(-50%)",
                        zIndex:30,
                        fontSize:22,
                        lineHeight:1,
                        pointerEvents:"none",
                        filter:"drop-shadow(0 0 8px rgba(255,0,200,0.95)) drop-shadow(0 0 18px rgba(255,0,200,0.60))",
                        animation:"dj-crown-spin 1.6s ease-in-out infinite",
                      }}>
                        🎧
                      </div>
                    )}

                    <ParticipantCard
                      participant={p}
                      allParticipants={participants}
                      isMe={isMe}
                      isRoomOwner={isRoomOwner}
                      isSpeaking={isSpeaking}
                      gradient={gradient}
                      isVideoOn={isVideoOn}
                      followingIds={followingIds}
                      followMutation={followMutation}
                      unfollowMutation={unfollowMutation}
                      onNavigateDm={(userId: string) => { setDmUserId(userId); setDmUnreadCounts(prev => { const next = { ...prev }; delete next[userId]; return next; }); }}
                      user={user}
                      hasActiveYoutube={youtubeHosts.has(p.id)}
                      roomLevel={room.level}
                      hasActiveBook={bookReaders.has(p.id)}
                      participantRole={participantRoles[p.id] || ""}
                      onProfileClick={() => handleParticipantClick(p.id)}
                      isYoutubeWatcher={youtubeWatchersFlat.has(p.id) && !youtubeHosts.has(p.id)}
                      isSharing={isMe && isScreenSharing}
                      hasRemoteVideo={!isMe && availableVideoUsers.has(p.id)}
                      hasRemoteScreen={!isMe && availableScreenUsers.has(p.id)}
                      onWatchVideo={() => handleWatchVideo(p.id)}
                      onWatchScreen={() => handleWatchScreen(p.id)}
                      isWatchingVideo={remoteVideoUserId === p.id}
                      isWatchingScreen={remoteScreenShareUserId === p.id}
                      isCurrentUserHost={isHost}
                      isCurrentUserCoOwner={myRole === "co-owner"}
                      onAssignRole={(role: string) => handleAssignRole(p.id, role)}
                      onTransferHost={() => handleTransferHost(p.id)}
                      onNominateHost={() => handleNominateHost(p.id)}
                      hasActiveYoutubeGlobal={!!activeYoutubeId}
                      onWatchYoutube={() => handleJoinYoutubeParty(p.id)}
                      isWatchingYoutube={showYoutube}
                      onForceMute={handleForceMute}
                      onForceMuteVideo={handleForceMuteVideo}
                      onKick={handleKick}
                      onBlock={handleBlock}
                      onReport={handleReport}
                      onClearChatGlobal={handleClearChat}
                      onClearChatLocal={() => setChatMessages([])}
                      onClearUserChat={handleClearUserChat}
                      onReconnect={handleReconnect}
                      notifPrefs={notifPrefsData?.[p.id] ?? null}
                      onSetNotifPrefs={(notifyRoomJoin: boolean, notifyDm: boolean) => updateNotifPrefsMutation.mutate({ userId: p.id, notifyRoomJoin, notifyDm })}
                      dmUnreadCount={isMe
                        ? (Object.values(dmUnreadCounts) as number[]).reduce((s, n) => s + n, 0)
                        : (dmUnreadCounts[p.id] || 0)}
                      dmFirstUnreadSenderId={isMe
                        ? (Object.entries(dmUnreadCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)
                        : p.id}
                      volume={participantVolumes[p.id] ?? 1}
                      onVolumeChange={handleVolumeChange}
                      youtubeVideoId={youtubeHosts.get(p.id) || null}
                      remoteVideoStream={isMe && isVideoOn && (!isInOverlayMode || miniCameraMode) ? localVideoStreamObj : (!isMe && availableVideoUsers.has(p.id) ? remoteVideoStreams.current.get(p.id) : undefined)}
                      localVideoFlipped={isMe ? cameraFacing === "user" : false}
                      isBlocked={isBlockedUser}
                      onUnblock={handleUnblock}
                      analyserNode={analyserVersion >= 0 ? analysersRef.current.get(p.id) : undefined}
                      mood={djModeActive ? undefined : participantMoods[p.id]}
                      onClearMood={isMe ? clearMyMood : undefined}
                      hasActiveMovie={movieHosts.has(p.id)}
                      moviePosterPath={movieHosts.get(p.id)?.posterPath || null}
                      isMovieWatcher={movieWatchersFlat.has(p.id) && !movieHosts.has(p.id)}
                      watchingMoviePoster={watcherMoviePosterMap.get(p.id) || null}
                      onWatchMovie={!isMe && movieHosts.has(p.id) ? () => {
                        const info = movieHosts.get(p.id);
                        if (!info) return;
                        const _startedAt = movieHostStartedAt.get(p.id);
                        const _offset = _startedAt ? Math.floor((Date.now() - _startedAt) / 1000) : 0;
                        setShowYoutube(false);
                        setMiniPlayerMode(false);
                        setActiveMovieId(info.movieId);
                        setActiveMovieTitle(info.movieTitle);
                        setActiveMoviePoster(info.posterPath);
                        setMovieStartedBy(p.id);
                        setMovieStartOffset(_offset);
                        setShowMovie(true);
                        socket?.emit("room:movie-watching", { roomId: room.id, hostId: p.id, watching: true });
                      } : undefined}
                      cardPx={cardPx}
                      fillMode={!isInOverlayMode}
                      hologramVideoUrl={null}
                      avatarGifUrl={participantAvatarGifs[p.id] || null}
                      onSetAvatarGif={isMe ? (gifUrl: string | null) => {
                        setParticipantAvatarGifs((prev) => {
                          if (gifUrl) return { ...prev, [user!.id]: gifUrl };
                          const next = { ...prev };
                          delete next[user!.id];
                          return next;
                        });
                        socket?.emit("room:avatar-gif", { roomId: room.id, userId: user?.id, gifUrl });
                      } : undefined}
                    />
                  </div>
                );
              })}

              {/* ── AI Tutor participant card ── (shown in centered overlay instead) */}
              {aiTutorActive && false && (
                <div
                  className="flex flex-col items-center gap-2 group relative"
                  data-testid="card-ai-tutor"
                >
                  <div className="relative flex flex-col items-center">
                    {/* Outer ping when speaking */}
                    {aiTutorSpeaking && (
                      <span
                        className="absolute inset-0 rounded-full animate-ping"
                        style={{ background: "rgba(0,225,255,0.18)", animationDuration: "1.2s", borderRadius: "50%" }}
                      />
                    )}

                    {/* Holographic face circle */}
                    <div
                      className="relative rounded-full overflow-hidden flex items-center justify-center"
                      style={{
                        width: 88, height: 88,
                        background: aiTutorSettings.voice === "Male"
                          ? "radial-gradient(ellipse at 45% 38%, rgba(10,50,100,0.96) 0%, rgba(4,10,30,0.98) 70%)"
                          : "radial-gradient(ellipse at 45% 38%, rgba(30,15,70,0.96) 0%, rgba(4,8,28,0.98) 70%)",
                        border: aiTutorSpeaking
                          ? "2.5px solid rgba(0,225,255,0.90)"
                          : "2px solid rgba(0,225,255,0.45)",
                        boxShadow: aiTutorSpeaking
                          ? "0 0 28px rgba(0,225,255,0.60), 0 0 55px rgba(0,100,255,0.22), inset 0 0 22px rgba(0,120,255,0.14)"
                          : "0 0 14px rgba(0,225,255,0.28), inset 0 0 12px rgba(0,80,200,0.10)",
                      }}
                    >
                      {/* Holographic scan line overlay */}
                      <div className="absolute inset-0 pointer-events-none" style={{
                        background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,225,255,0.025) 3px, rgba(0,225,255,0.025) 4px)",
                        borderRadius: "50%",
                      }} />
                      {/* Top shine */}
                      <div className="absolute pointer-events-none" style={{
                        top: 0, left: "10%", right: "10%", height: "35%",
                        background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)",
                        borderRadius: "50%",
                      }} />

                      {/* SVG Face */}
                      {aiTutorSettings.voice === "Male" ? (
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="80" height="80">
                          {/* Short dark hair */}
                          <ellipse cx="50" cy="30" rx="28" ry="20" fill="#221a12"/>
                          <rect x="22" y="32" width="56" height="10" fill="#221a12"/>
                          <rect x="22" y="38" width="10" height="16" rx="4" fill="#1a1410"/>
                          <rect x="68" y="38" width="10" height="16" rx="4" fill="#1a1410"/>
                          {/* Face - warmer, square-ish */}
                          <ellipse cx="50" cy="62" rx="21" ry="25" fill="#e8c0a0"/>
                          {/* Square jaw hint */}
                          <path d="M31 72 Q33 84 50 88 Q67 84 69 72 Q60 80 50 80 Q40 80 31 72 Z" fill="#d8a882"/>
                          {/* Jaw shadow / stubble */}
                          <ellipse cx="50" cy="78" rx="18" ry="9" fill="rgba(80,50,25,0.18)"/>
                          {/* Eyebrows — thick, flat, masculine */}
                          <path d="M33 46 Q39 43 45 44.5" stroke="#1a1008" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
                          <path d="M55 44.5 Q61 43 67 46" stroke="#1a1008" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
                          {/* Eyes — steely blue, slightly smaller */}
                          <ellipse cx="40" cy="54" rx="5" ry="4.5" fill="white"/>
                          <ellipse cx="40" cy="54" rx="4" ry="4" fill="#3a6080"/>
                          <circle cx="40" cy="54" r="2.4" fill="#0c1c28"/>
                          <circle cx="42" cy="52" r="1.3" fill="white" opacity="0.85"/>
                          <path d="M35 51 Q40 47.5 45 51" stroke="#0e0c08" strokeWidth="1.9" fill="none" strokeLinecap="round"/>
                          <ellipse cx="60" cy="54" rx="5" ry="4.5" fill="white"/>
                          <ellipse cx="60" cy="54" rx="4" ry="4" fill="#3a6080"/>
                          <circle cx="60" cy="54" r="2.4" fill="#0c1c28"/>
                          <circle cx="62" cy="52" r="1.3" fill="white" opacity="0.85"/>
                          <path d="M55 51 Q60 47.5 65 51" stroke="#0e0c08" strokeWidth="1.9" fill="none" strokeLinecap="round"/>
                          {/* Nose */}
                          <path d="M47 64 Q50 69 53 64" stroke="#b88060" strokeWidth="1.2" fill="none" opacity="0.7"/>
                          {/* Mouth — thinner, neutral */}
                          <path d="M44 74 Q50 77 56 74" stroke="#a86850" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                          {/* Headphones — teal */}
                          <path d="M27 52 Q27 30 50 29 Q73 30 73 52" fill="none" stroke="#10a0b8" strokeWidth="4" strokeLinecap="round"/>
                          <rect x="22" y="48" width="10" height="12" rx="4" fill="#0a7888"/>
                          <rect x="68" y="48" width="10" height="12" rx="4" fill="#0a7888"/>
                          <rect x="24" y="50" width="6" height="8" rx="2" fill="#20d0e8"/>
                          <rect x="70" y="50" width="6" height="8" rx="2" fill="#20d0e8"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="80" height="80">
                          {/* Long silver hair back */}
                          <ellipse cx="50" cy="32" rx="28" ry="22" fill="#c8d0e4"/>
                          <path d="M24 48 Q20 70 26 90" stroke="#c8d0e4" strokeWidth="9" fill="none" strokeLinecap="round"/>
                          <path d="M76 48 Q80 70 74 90" stroke="#c8d0e4" strokeWidth="9" fill="none" strokeLinecap="round"/>
                          {/* Hair shine */}
                          <path d="M38 28 Q44 22 52 22" stroke="#eef4ff" strokeWidth="1.5" fill="none" opacity="0.6"/>
                          {/* Face — oval, light, feminine */}
                          <ellipse cx="50" cy="60" rx="21" ry="26" fill="#f8e0d0"/>
                          {/* Soft chin */}
                          <ellipse cx="50" cy="82" rx="14" ry="6" fill="#f8e0d0"/>
                          {/* Bangs */}
                          <path d="M23 48 Q26 24 50 20 Q74 24 77 48 Q64 34 50 33 Q36 34 23 48 Z" fill="#c8d0e4" opacity="0.9"/>
                          {/* Eyebrows — thin, arched */}
                          <path d="M34 46 Q40 43 45.5 44.5" stroke="#7888a8" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                          <path d="M54.5 44.5 Q60 43 66 46" stroke="#7888a8" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                          {/* Eyes — large, blue */}
                          <ellipse cx="40" cy="54.5" rx="6" ry="6" fill="white"/>
                          <ellipse cx="40" cy="54.5" rx="5" ry="5" fill="#2568da"/>
                          <circle cx="40" cy="54.5" r="2.8" fill="#0a1e60"/>
                          <circle cx="42.5" cy="52" r="1.7" fill="white" opacity="0.9"/>
                          <path d="M34 51 Q40 47 46 51" stroke="#0e0c12" strokeWidth="1.7" fill="none" strokeLinecap="round"/>
                          <path d="M34 51 L33 48.5" stroke="#0e0c12" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
                          <path d="M46 51 L47 48.5" stroke="#0e0c12" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
                          <ellipse cx="60" cy="54.5" rx="6" ry="6" fill="white"/>
                          <ellipse cx="60" cy="54.5" rx="5" ry="5" fill="#2568da"/>
                          <circle cx="60" cy="54.5" r="2.8" fill="#0a1e60"/>
                          <circle cx="62.5" cy="52" r="1.7" fill="white" opacity="0.9"/>
                          <path d="M54 51 Q60 47 66 51" stroke="#0e0c12" strokeWidth="1.7" fill="none" strokeLinecap="round"/>
                          <path d="M54 51 L53 48.5" stroke="#0e0c12" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
                          <path d="M66 51 L67 48.5" stroke="#0e0c12" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
                          {/* Blush */}
                          <ellipse cx="31" cy="63" rx="6" ry="3" fill="#ff8080" opacity="0.28"/>
                          <ellipse cx="69" cy="63" rx="6" ry="3" fill="#ff8080" opacity="0.28"/>
                          {/* Nose hint */}
                          <path d="M47 66 Q50 70.5 53 66" stroke="#c89878" strokeWidth="0.9" fill="none" opacity="0.55"/>
                          {/* Mouth — full lips, pink */}
                          <path d="M43 75 Q50 80 57 75" stroke="#c06870" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                          {/* Headphones — purple/blue */}
                          <path d="M27 51 Q27 30 50 29 Q73 30 73 51" fill="none" stroke="#5060cc" strokeWidth="4" strokeLinecap="round"/>
                          <rect x="22" y="47" width="10" height="12" rx="4" fill="#3848a8"/>
                          <rect x="68" y="47" width="10" height="12" rx="4" fill="#3848a8"/>
                          <rect x="24" y="49" width="6" height="8" rx="2" fill="#7088ff"/>
                          <rect x="70" y="49" width="6" height="8" rx="2" fill="#7088ff"/>
                        </svg>
                      )}
                    </div>

                    {/* Audio waveform bars */}
                    {aiTutorSpeaking && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-[2px]">
                        {[3, 5, 4, 7, 4, 5, 3].map((h, i) => (
                          <div
                            key={i}
                            className="w-[2px] rounded-full"
                            style={{
                              height: h * 2,
                              background: "rgba(0,225,255,0.85)",
                              animation: `pulse ${0.45 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
                              animationDelay: `${i * 0.08}s`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>AI Tutor</span>
                      <span className="text-[10px]" style={{ color: "rgba(0,225,255,0.60)" }}>
                        {aiTutorSettings.voice === "Male" ? "♂" : "♀"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[10px]" style={{ color: "rgba(0,225,255,0.75)" }}>
                        {aiTutorSpeaking ? "Speaking" : "Listening"}
                      </span>
                    </div>
                  </div>

                  {/* Settings gear on hover */}
                  <button
                    onClick={() => setAiTutorControlOpen(!aiTutorControlOpen)}
                    data-testid="button-ai-tutor-gear"
                    className="absolute -top-2 right-0 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    style={{ background: "rgba(15,23,42,0.92)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.75)" }}
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
          );})()}

          {/* ── Unified floating watch-party reactions overlay ──
               Rendered at the content-area level so emojis float freely
               OVER the player AND the participant strip without being clipped.
               z-[60] ensures it sits above the strip (z-10) and host controls (z-20). */}
          {!djModeActive && (ytFloatingReactions.length > 0 || movieFloatingReactions.length > 0) && (
            <div className="absolute inset-0 pointer-events-none z-[60]" aria-hidden="true" data-testid="watch-party-reactions-overlay">
              {[...ytFloatingReactions, ...movieFloatingReactions].map(r => {
                const sender = participants.find(p => p.id === r.userId);
                const senderName = sender ? getUserDisplayName(sender) : "";
                return (
                  <div
                    key={r.id}
                    className="absolute flex flex-col items-center gap-1 select-none"
                    style={{
                      left: `${r.left}%`,
                      bottom: 210,
                      animation: "ytReactionFloat 2.8s ease-out forwards",
                    }}
                  >
                    <span className="text-3xl" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>
                      {r.emoji}
                    </span>
                    {sender && (
                      <div className="flex items-center gap-1 bg-black/65 backdrop-blur-sm rounded-full pl-0.5 pr-2 py-0.5 border border-white/15 shadow-md">
                        <Avatar className="w-4 h-4">
                          <AvatarImage src={sender.profileImageUrl || undefined} alt="" />
                          <AvatarFallback className="text-[8px] bg-violet-500/40 text-white">
                            {senderName.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[9px] text-white/95 font-medium leading-none whitespace-nowrap">
                          {senderName}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── AI Tutor "in use" indicator for other participants ── */}
          {!aiTutorActive && roomAiTutorSession?.active && roomAiTutorSession.userId !== user?.id && (
            <div
              className="fixed top-20 left-1/2 z-[58] -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full pointer-events-none"
              style={{
                background: "rgba(8,12,32,0.88)",
                border: "1px solid rgba(0,225,255,0.25)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.40)",
              }}
              data-testid="ai-tutor-in-use-badge"
            >
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: roomAiTutorSession.speaking ? "rgba(0,225,255,0.90)" : "rgba(0,200,100,0.80)", boxShadow: roomAiTutorSession.speaking ? "0 0 6px rgba(0,225,255,0.70)" : "none", animation: "pulse 1.2s ease-in-out infinite" }} />
              <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.70)" }}>
                <span style={{ color: "rgba(0,225,255,0.90)" }}>{roomAiTutorSession.username}</span>
                {" "}is practicing with AI Tutor
              </span>
            </div>
          )}

          {/* ── AI Tutor Persona Picker Overlay ── */}
          {aiPersonaPickerOpen && !aiTutorActive && (
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center"
              style={{ background: "rgba(8,12,22,0.78)", backdropFilter: "blur(14px)" }}
              data-testid="ai-persona-picker-overlay"
              onClick={() => setAiPersonaPickerOpen(false)}
            >
              {/* Dark neumorphic surface — sculpted out of the dark theme */}
              <div
                className="relative flex flex-col items-center rounded-[28px] mx-4"
                style={{
                  background: NEUMO_BG,
                  boxShadow: `14px 14px 36px ${NEUMO_SHADOW_DARK}, -14px -14px 36px ${NEUMO_SHADOW_LIGHT}`,
                  width: "min(90vw, 440px)",
                  padding: "30px 26px 26px",
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Close (neumorphic round button) */}
                <button
                  onClick={() => setAiPersonaPickerOpen(false)}
                  className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95"
                  style={{
                    background: NEUMO_BG,
                    boxShadow: NEUMO_SMALL_REST,
                    color: "rgba(180,190,210,0.70)",
                  }}
                  onMouseDown={e => { e.currentTarget.style.boxShadow = NEUMO_INSET_SMALL; }}
                  onMouseUp={e => { e.currentTarget.style.boxShadow = NEUMO_SMALL_REST; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = NEUMO_SMALL_REST; }}
                  data-testid="button-persona-picker-close"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header pill (inset) */}
                <div
                  className="flex items-center gap-2 mb-1.5 px-4 py-2 rounded-full"
                  style={{
                    background: NEUMO_BG,
                    boxShadow: NEUMO_INSET_SMALL,
                  }}
                >
                  <BrainCircuit className="w-4 h-4" style={{ color: "rgba(0,225,255,0.92)" }} />
                  <span className="text-[14px] font-semibold" style={{ color: "rgba(230,235,245,0.95)" }}>Choose Your Tutor</span>
                </div>
                <p className="text-[12px] text-center mb-7 mt-3" style={{ color: "rgba(170,180,200,0.65)" }}>
                  Pick a tutor — your choice is locked for the session.
                </p>

                {/* Persona cards (dark neumorphic) */}
                <div className="flex flex-col gap-4 w-full">
                  {/* Afi K — Funny, flirty, browser voice */}
                  <NeumorphicPersonaCard
                    testId="button-persona-female"
                    onClick={() => { setAiPersonaPickerOpen(false); startWithPersona("Female", "Afi K"); }}
                    avatar={<NeumorphicAvatarRing glowRgb="255,140,210" content={<span className="text-2xl font-light leading-none" style={{ color: "rgba(255,200,230,0.98)", textShadow: "0 0 10px rgba(255,140,210,0.55)" }}>♀</span>} />}
                    name="Afi K"
                    description="Funny · flirty · welcomes joiners by name"
                    nameColor="rgba(255,180,220,0.95)"
                    accentColor="rgba(255,140,210,0.90)"
                  />

                  {/* Eva — ElevenLabs, warm & emotionally present */}
                  <NeumorphicPersonaCard
                    testId="button-persona-eva"
                    onClick={() => { setAiPersonaPickerOpen(false); startWithPersona("Eva", "Eva"); }}
                    avatar={<NeumorphicAvatarRing glowRgb="0,225,255" intense content={<img loading="lazy" decoding="async" src={evaAvatarUrl} alt="Eva avatar" className="w-full h-full object-cover rounded-full" data-testid="img-eva-avatar" />} />}
                    name="Eva"
                    badge="BEST AI"
                    description="ElevenLabs · Warm · Emotionally present"
                    nameColor="rgba(160,235,255,0.97)"
                    accentColor="rgba(0,225,255,0.95)"
                  />
                </div>

                <p className="text-[10px] mt-6" style={{ color: "rgba(170,180,200,0.45)" }}>
                  Voice selection is locked once the session starts
                </p>
              </div>
            </div>
          )}

          {/* ── AI Tutor: Face draggable (defaults to screen center) ── */}
          {aiTutorVisible && (
            <div
              ref={aiFaceWrapperRef}
              className={`fixed z-[60] flex items-center justify-center ai-overlay-isolate${(ytIsPlaying && showYoutube) ? " ai-overlay-quiet" : ""}`}
              style={aiFacePos
                ? { left: aiFacePos.x, top: aiFacePos.y, pointerEvents: "none" }
                : { inset: 0, pointerEvents: "none" }}
              data-testid="ai-tutor-overlay"
            >
              <div
                className="pointer-events-auto flex flex-col items-center gap-3 cursor-grab active:cursor-grabbing touch-none"
                style={{ marginTop: aiFacePos ? 0 : -40 }}
                onPointerDown={onAiFacePointerDown}
                onPointerMove={onAiFacePointerMove}
                onPointerUp={onAiFacePointerUp}
                title="Drag to move"
              >
                <div className="flex flex-col items-center gap-4 ai-float" style={{ marginTop: 20 }}>
                  <div className="relative ai-face-size">

                    {/* Outer listen/speak pulse ring */}
                    {(aiTutorDisplaySpeaking || aiTutorDisplayListening) && (
                      <div className="absolute inset-0 rounded-full animate-ping pointer-events-none"
                        style={{
                          background: aiTutorDisplaySpeaking ? "rgba(0,225,255,0.12)" : "rgba(0,255,160,0.10)",
                          animationDuration: aiTutorDisplaySpeaking ? "1.3s" : "2s"
                        }} />
                    )}

                    {/* Rotating gradient ring */}
                    <div className="absolute rounded-full holo-ring-rotate pointer-events-none" style={{
                      inset: -3,
                      background: "conic-gradient(rgba(0,225,255,0.9) 0deg, rgba(80,120,255,0.4) 120deg, rgba(160,80,255,0.5) 200deg, rgba(0,225,255,0.9) 360deg)",
                      borderRadius: "50%",
                      padding: 2,
                    }}>
                      <div className="w-full h-full rounded-full" style={{ background: "rgba(6,10,30,0.95)" }} />
                    </div>

                    {/* Static glow border */}
                    <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                      boxShadow: aiTutorDisplaySpeaking
                        ? "0 0 40px rgba(0,225,255,0.65), 0 0 80px rgba(0,100,255,0.28), inset 0 0 30px rgba(0,120,255,0.15)"
                        : aiTutorDisplayListening
                          ? "0 0 28px rgba(0,255,160,0.40), inset 0 0 20px rgba(0,180,120,0.10)"
                          : "0 0 20px rgba(0,225,255,0.32), inset 0 0 18px rgba(0,80,200,0.12)",
                      border: `2px solid ${aiTutorDisplaySpeaking ? "rgba(0,225,255,0.90)" : aiTutorDisplayListening ? "rgba(0,255,160,0.60)" : "rgba(0,225,255,0.45)"}`,
                      borderRadius: "50%",
                    }} />

                    {/* Face container — photo-based realistic avatar */}
                    <div className="absolute inset-0 rounded-full overflow-hidden">

                      {/* ── Gender-distinct SVG face with integrated lip-sync mouth ── */}
                      <AiTutorFace gender={aiTutorFaceStyle} viseme={currentViseme} speaking={aiTutorDisplaySpeaking} personaName={aiPersonaName} />

                      {/* Speaking shimmer glow */}
                      {aiTutorDisplaySpeaking && (
                        <div className="absolute inset-0 pointer-events-none rounded-full" style={{
                          background: "radial-gradient(ellipse at 50% 70%, rgba(0,225,255,0.16) 0%, transparent 58%)",
                          animation: "pulse 0.5s ease-in-out infinite alternate",
                        }} />
                      )}
                    </div>

                    {/* Speaking waveform */}
                    {aiTutorDisplaySpeaking && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-[3px]">
                        {[4,6,8,10,8,6,4].map((h,i) => (
                          <div key={i} className="rounded-full" style={{
                            width: 3, height: h * 2,
                            background: "rgba(0,225,255,0.85)",
                            animation: `pulse ${0.4+(i%3)*0.15}s ease-in-out infinite alternate`,
                            animationDelay: `${i*0.08}s`,
                          }} />
                        ))}
                      </div>
                    )}
                    {/* Listening indicator */}
                    {aiTutorDisplayListening && !aiTutorDisplaySpeaking && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-[3px]">
                        {[3,5,4,6,4,5,3].map((h,i) => (
                          <div key={i} className="rounded-full" style={{
                            width: 3, height: h * 2,
                            background: "rgba(0,255,160,0.80)",
                            animation: `pulse ${0.5+(i%4)*0.12}s ease-in-out infinite alternate`,
                            animationDelay: `${i*0.09}s`,
                          }} />
                        ))}
                      </div>
                    )}
                  </div>

                    {/* Label + chat toggle button */}
                  <div className="flex flex-col items-center gap-2">
                    {/* Platform glow */}
                    <div className="holo-platform rounded-full" style={{
                      width: 140, height: 10,
                      background: "radial-gradient(ellipse at center, rgba(0,225,255,0.45) 0%, rgba(0,100,255,0.15) 60%, transparent 100%)",
                      filter: "blur(5px)",
                    }} />
                    {/* Clickable AI Tutor button — opens/closes chat */}
                    <button
                      onClick={() => setAiChatPanelOpen(v => !v)}
                      data-testid="button-ai-chat-toggle"
                      className="flex items-center gap-2 px-5 py-2 rounded-full transition-all hover:scale-105 active:scale-95"
                      disabled={!isAiTutorOwner}
                      style={{
                        background: aiChatPanelOpen
                          ? "rgba(0,80,180,0.80)"
                          : "rgba(0,50,120,0.70)",
                        border: `1.5px solid ${aiChatPanelOpen ? "rgba(0,225,255,0.70)" : "rgba(0,225,255,0.35)"}`,
                        backdropFilter: "blur(10px)",
                        boxShadow: aiChatPanelOpen
                          ? "0 0 20px rgba(0,225,255,0.35), 0 4px 20px rgba(0,0,0,0.40)"
                          : "0 4px 20px rgba(0,0,0,0.40)",
                      }}
                    >
                      <BrainCircuit className="w-4 h-4" style={{ color: "rgba(0,225,255,0.90)" }} />
                      <span className="text-[13px] font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>{aiTutorDisplayName}</span>
                      {isAiTutorOwner && (aiChatPanelOpen
                        ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "rgba(0,225,255,0.70)" }} />
                        : <ChevronDown className="w-3.5 h-3.5" style={{ color: "rgba(0,225,255,0.70)" }} />)}
                    </button>
                    {lastAiBroadcast && (
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          onClick={() => setAiTranscriptExpanded(v => !v)}
                          data-testid="button-ai-transcript-toggle"
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-colors hover:bg-white/10 text-[10px]"
                          style={{
                            color: aiTranscriptExpanded ? "rgba(0,225,255,0.80)" : "rgba(255,255,255,0.35)",
                            border: `1px solid ${aiTranscriptExpanded ? "rgba(0,225,255,0.25)" : "rgba(255,255,255,0.10)"}`,
                          }}
                        >
                          {aiTranscriptExpanded
                            ? <><ChevronUp className="w-3 h-3" /><span>Hide</span></>
                            : <><ChevronDown className="w-3 h-3" /><span>Show last message</span></>}
                        </button>
                        {aiTranscriptExpanded && (
                          <div
                            className="max-w-[80vw] sm:max-w-[280px] rounded-2xl px-3 py-2 text-center text-[12px] leading-relaxed"
                            style={{
                              background: "rgba(8,12,32,0.76)",
                              border: "1px solid rgba(0,225,255,0.18)",
                              color: "rgba(255,255,255,0.82)",
                              backdropFilter: "blur(14px)",
                              boxShadow: "0 8px 24px rgba(0,0,0,0.32)",
                            }}
                            data-testid="text-ai-tutor-live-caption"
                          >
                            {lastAiBroadcast}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Status line */}
                    <div className="flex items-center gap-1.5">
                      {aiTutorDisplaySpeaking ? (
                        <div className="flex items-end gap-[2px]">
                          {[3,5,4,6,3,5,4].map((h,i) => (
                            <div key={i} className="rounded-full" style={{
                              width: 2.5, height: h,
                              background: "rgba(0,225,255,0.85)",
                              animation: `pulse ${0.3+(i%3)*0.1}s ease-in-out infinite alternate`,
                              animationDelay: `${i*0.07}s`,
                            }} />
                          ))}
                        </div>
                      ) : aiTutorDisplayListening ? (
                        <div className="flex items-end gap-[2px]">
                          {[3,4,3,5,3,4,3].map((h,i) => (
                            <div key={i} className="rounded-full" style={{
                              width: 2.5, height: h,
                              background: "rgba(0,255,160,0.85)",
                              animation: `pulse ${0.4+(i%3)*0.12}s ease-in-out infinite alternate`,
                              animationDelay: `${i*0.09}s`,
                            }} />
                          ))}
                        </div>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      )}
                      <span className="text-[11px] font-medium" style={{
                        color: aiTutorDisplaySpeaking ? "rgba(0,225,255,0.80)" : aiTutorDisplayListening ? "rgba(0,255,160,0.85)" : "rgba(0,225,255,0.60)"
                      }}>
                        {aiTutorDisplaySpeaking ? "Speaking…" : aiTutorDisplayListening ? "Listening…" : "Ready"}
                      </span>
                    </div>
                    {/* Mic error warning */}
                    {isAiTutorOwner && aiMicError && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: "rgba(255,60,60,0.15)", border: "1px solid rgba(255,80,80,0.30)" }}>
                        <MicOff className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,120,120,0.90)" }} />
                        <span className="text-[10px] leading-tight" style={{ color: "rgba(255,160,160,0.90)" }}>
                          {aiMicError}
                        </span>
                      </div>
                    )}
                    {/* Dismiss link */}
                    {isAiTutorOwner && <button
                      onClick={toggleAiTutor}
                      data-testid="button-dismiss-ai-tutor-label"
                      className="text-[10px] mt-0.5 transition-colors hover:opacity-80"
                      style={{ color: "rgba(255,120,120,0.60)" }}
                    >
                      Dismiss
                    </button>}

                    {/* Ask AI — visible to non-owners when an AI session is active */}
                    {!isAiTutorOwner && roomAiTutorSession.active && (
                      <div className="flex flex-col items-center gap-2 mt-2">
                        {askAiOpen ? (
                          <div className="flex items-center gap-1.5" style={{ pointerEvents: "auto" }}>
                            <input
                              className="rounded-full text-[12px] px-3 py-1.5 outline-none w-[160px] sm:w-[200px]"
                              style={{
                                background: "rgba(8,18,48,0.88)",
                                border: "1.5px solid rgba(0,225,255,0.40)",
                                color: "rgba(230,240,255,0.95)",
                              }}
                              value={askAiText}
                              onChange={e => setAskAiText(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && askAiText.trim()) handleSendAskAi(); }}
                              placeholder="Ask something…"
                              autoFocus
                              data-testid="input-ask-ai"
                            />
                            <button
                              onClick={handleSendAskAi}
                              disabled={!askAiText.trim()}
                              data-testid="button-ask-ai-send"
                              className="flex items-center justify-center w-7 h-7 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                              style={{ background: "rgba(0,180,255,0.75)", border: "1.5px solid rgba(0,225,255,0.55)" }}
                            >
                              <Send className="w-3.5 h-3.5" style={{ color: "#fff" }} />
                            </button>
                            <button
                              onClick={() => { setAskAiOpen(false); setAskAiText(""); }}
                              data-testid="button-ask-ai-cancel"
                              className="flex items-center justify-center w-7 h-7 rounded-full transition-all hover:scale-105 active:scale-95"
                              style={{ background: "rgba(40,20,60,0.70)", border: "1px solid rgba(255,255,255,0.12)" }}
                            >
                              <X className="w-3.5 h-3.5" style={{ color: "rgba(200,180,255,0.80)" }} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAskAiOpen(true)}
                            data-testid="button-ask-ai-open"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all hover:scale-105 active:scale-95"
                            style={{
                              background: "rgba(0,60,140,0.65)",
                              border: "1.5px solid rgba(0,225,255,0.35)",
                              color: "rgba(160,235,255,0.92)",
                              backdropFilter: "blur(8px)",
                            }}
                          >
                            <BrainCircuit className="w-3.5 h-3.5" />
                            Ask AI
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── AI Tutor Chat Panel — floats independently to the right of center ── */}
          {aiTutorActive && aiChatPanelOpen && (
            <div
              className="fixed z-[61] flex flex-col rounded-2xl overflow-hidden shadow-2xl ai-chat-panel-responsive"
              style={{
                background: "rgba(8,12,32,0.93)",
                border: "1px solid rgba(0,225,255,0.18)",
                backdropFilter: "blur(24px)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.70), 0 0 40px rgba(0,80,255,0.08)",
              }}
              data-testid="ai-tutor-chat-panel"
            >
              {/* Chat header */}
              <div
                className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
                style={{ borderColor: "rgba(0,225,255,0.12)" }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                    style={{ border: "1.5px solid rgba(0,225,255,0.50)", boxShadow: "0 0 8px rgba(0,225,255,0.30)" }}>
                    <img loading="lazy" decoding="async" src="/ai-face.webp" alt="AI" className="w-full h-full object-cover object-top" width={32} height={32} />
                  </div>
                  <div>
                    <span className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.92)" }}>AI Tutor Chat</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[10px]" style={{ color: "rgba(0,225,255,0.70)" }}>
                        {aiTutorSpeaking ? "Speaking…" : aiAcknowledging ? "Processing…" : aiListening ? "Listening…" : "Ready"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setAiDebugOpen(v => !v)}
                    data-testid="button-ai-debug-toggle"
                    className="h-5 rounded-full px-2 flex items-center gap-1 transition-colors hover:bg-white/10 text-[9px] font-mono"
                    style={{
                      color: aiDebugOpen ? "rgba(100,255,180,0.90)" : "rgba(255,255,255,0.30)",
                      border: `1px solid ${aiDebugOpen ? "rgba(100,255,180,0.35)" : "rgba(255,255,255,0.10)"}`,
                    }}
                    title="Show AI Thoughts / Debug Script"
                  >
                    <span>{aiDebugOpen ? "▲" : "▼"}</span>
                    <span>Debug</span>
                  </button>
                  <button onClick={() => setAiTutorControlOpen(v => !v)}
                    data-testid="button-ai-tutor-gear"
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                    style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.10)" }} title="Settings">
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setAiChatPanelOpen(false)}
                    data-testid="button-close-chat"
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                    style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.10)" }} title="Close chat">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="px-4 py-2 border-b border-amber-400/15 bg-amber-400/10 text-[10px] font-medium text-amber-100/90">
                AI Tutor is a demo and may still change.
              </div>

              {/* Messages + Input */}
              <div className="flex flex-col">
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 180, maxHeight: 260 }} data-testid="ai-tutor-conversation">
                  {aiConversation.slice(-6).map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === "ai" ? "items-start" : "items-end"}`}>
                      <div
                        className="rounded-2xl px-3 py-2 text-[12px] leading-relaxed max-w-[240px]"
                        style={msg.role === "ai" ? {
                          background: "rgba(10,20,55,0.90)",
                          border: "1px solid rgba(0,225,255,0.18)",
                          color: "rgba(255,255,255,0.92)",
                        } : {
                          background: "rgba(40,50,100,0.85)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          color: "rgba(255,255,255,0.90)",
                        }}
                      >
                        {msg.text}
                      </div>
                      {msg.correction && aiTutorSettings.correctionMode !== "off" && (
                        <div
                          className="mt-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium"
                          style={{
                            background: "rgba(30,15,60,0.88)",
                            border: "1px solid rgba(180,100,255,0.35)",
                            color: "rgba(220,180,255,0.92)",
                          }}
                        >
                          <Lightbulb className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,200,60,0.90)" }} />
                          {msg.correctionFixed && (
                            <span style={{ color: "rgba(100,255,180,0.95)", fontStyle: "italic" }}>{msg.correctionFixed}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Interim transcript — shows what mic is hearing in real-time */}
                  {aiInterimText && !aiTutorLoading && (
                    <div className="flex flex-col items-end">
                      <div
                        className="rounded-2xl px-3 py-2 text-[12px] leading-relaxed max-w-[240px] italic"
                        style={{
                          background: "rgba(40,50,100,0.50)",
                          border: "1px dashed rgba(255,255,255,0.18)",
                          color: "rgba(255,255,255,0.50)",
                        }}
                      >
                        Heard: {aiInterimText}
                      </div>
                    </div>
                  )}
                  {aiTutorLoading && (
                    <div className="flex flex-col items-start gap-1">
                      {aiAcknowledging && (
                        <div
                          className="text-[10px] px-2 mb-0.5"
                          style={{ color: "rgba(0,225,255,0.55)" }}
                        >
                          Got it, thinking…
                        </div>
                      )}
                      <div className="flex gap-1.5 px-3 py-2 rounded-2xl w-fit"
                        style={{ background: "rgba(10,20,55,0.90)", border: "1px solid rgba(0,225,255,0.18)" }}>
                        {[0,1,2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                            style={{ animation: "pulse 0.6s ease-in-out infinite alternate", animationDelay: `${i*0.2}s` }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div
                  className="flex items-center gap-2 px-3 py-3 border-t flex-shrink-0"
                  style={{ borderColor: "rgba(0,225,255,0.10)" }}
                  data-testid="ai-tutor-input"
                >
                  <input
                    ref={aiInputRef}
                    aria-label="Reply to AI Tutor"
                    data-testid="input-ai-tutor-reply"
                    className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/25 rounded-xl px-3 py-2"
                    style={{
                      color: "rgba(255,255,255,0.90)",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(0,225,255,0.15)",
                    }}
                    placeholder="Reply to AI Tutor…"
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        const val = aiInputRef.current?.value.trim();
                        if (val) {
                          sendAiMessage(val);
                          if (aiInputRef.current) aiInputRef.current.value = "";
                        }
                      }
                    }}
                  />
                  <button
                    data-testid="button-ai-tutor-send"
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 flex-shrink-0"
                    style={{ background: "rgba(0,180,255,0.25)", border: "1px solid rgba(0,225,255,0.40)" }}
                    onClick={() => {
                      const val = aiInputRef.current?.value.trim();
                      if (val) {
                        sendAiMessage(val);
                        if (aiInputRef.current) aiInputRef.current.value = "";
                      }
                    }}
                  >
                    <Send className="w-3.5 h-3.5" style={{ color: "rgba(0,225,255,0.90)" }} />
                  </button>
                </div>

                {/* Debug / AI Thoughts panel — hidden by default, shown on toggle */}
                {aiDebugOpen && (
                  <div
                    className="border-t px-3 py-2 flex flex-col gap-1"
                    data-testid="ai-debug-panel"
                    style={{
                      borderColor: "rgba(100,255,180,0.15)",
                      background: "rgba(0,0,0,0.40)",
                      maxHeight: 160,
                      overflowY: "auto",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: "rgba(100,255,180,0.70)" }}>
                        AI Thoughts / Debug Script
                      </span>
                      <button
                        onClick={() => clearDebugLog()}
                        className="text-[8px] font-mono px-1.5 py-0.5 rounded transition-colors hover:bg-white/10"
                        style={{ color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}
                        data-testid="button-clear-debug-log"
                      >
                        Clear
                      </button>
                    </div>
                    {/* System state snapshot */}
                    <div className="text-[9px] font-mono leading-relaxed mb-1 rounded px-2 py-1"
                      style={{ background: "rgba(0,180,255,0.07)", color: "rgba(180,230,255,0.60)" }}>
                      mic:{aiListening ? "on" : "off"}
                      {" · "}speak:{aiTutorSpeaking ? "on" : "off"}
                      {" · "}loading:{aiTutorLoading ? "on" : "off"}
                      {" · "}yt:{(!!activeYoutubeId && showYoutube) ? "active⚠" : "idle"}
                      {" · "}turns:{aiConversation.length}
                    </div>
                    {aiDebugLog.length === 0 && (
                      <div className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.20)" }}>
                        No events yet — start a conversation to see real-time reasoning.
                      </div>
                    )}
                    {[...aiDebugLog].reverse().map((entry, i) => (
                      <div key={i} className="flex gap-1.5 text-[9px] font-mono leading-relaxed">
                        <span style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>{entry.timestamp}</span>
                        <span style={{
                          flexShrink: 0,
                          color: entry.type === 'error' ? "rgba(255,100,100,0.90)"
                            : entry.type === 'warn' ? "rgba(255,200,60,0.90)"
                            : entry.type === 'yt' ? "rgba(255,80,80,0.85)"
                            : "rgba(100,255,180,0.80)",
                        }}>
                          {entry.type === 'error' ? '✖' : entry.type === 'warn' ? '⚠' : entry.type === 'yt' ? '▶' : '●'}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.55)", wordBreak: "break-word" }}>{entry.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── AI Tutor Control Panel (settings) ── */}
          {aiTutorActive && aiTutorControlOpen && (
            <div
              className="fixed right-4 bottom-28 z-[62]"
              data-testid="ai-tutor-control-panel"
            >
              <div
                className="rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background: "rgba(10,14,35,0.94)",
                  border: "1px solid rgba(0,225,255,0.18)",
                  backdropFilter: "blur(24px)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)",
                  width: 260,
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: "rgba(0,225,255,0.12)" }}
                >
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4" style={{ color: "rgba(0,225,255,0.80)" }} />
                    <span className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.90)" }}>
                      AI Tutor <span style={{ color: "rgba(0,225,255,0.75)" }}>Settings</span>
                    </span>
                  </div>
                  <button
                    onClick={() => setAiTutorControlOpen(false)}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                    style={{ color: "rgba(255,255,255,0.40)" }}
                    data-testid="button-ai-control-close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-4 flex flex-col gap-4">
                  {/* Correction Mode */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.70)" }}>Correction Mode</span>
                      <div className="w-9 h-5 rounded-full relative cursor-pointer transition-colors"
                        style={{ background: aiTutorSettings.correctionMode !== "off" ? "linear-gradient(90deg, rgba(0,200,100,0.85) 0%, rgba(0,160,80,0.80) 100%)" : "rgba(80,80,100,0.50)", border: "1px solid rgba(255,255,255,0.15)" }}
                        onClick={() => setAiTutorSettings(s => ({ ...s, correctionMode: s.correctionMode === "off" ? "live" : "off" }))}
                        data-testid="toggle-correction-mode">
                        <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
                          style={{ background: "rgba(255,255,255,0.95)", left: aiTutorSettings.correctionMode !== "off" ? "calc(100% - 18px)" : "2px", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {(["live", "after", "off"] as const).map(mode => (
                        <button key={mode} onClick={() => setAiTutorSettings(s => ({ ...s, correctionMode: mode }))}
                          data-testid={`button-correction-${mode}`}
                          className="flex-1 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all"
                          style={aiTutorSettings.correctionMode === mode ? { background: "rgba(0,180,255,0.20)", border: "1px solid rgba(0,225,255,0.45)", color: "rgba(0,225,255,0.95)" } : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }}>
                          {mode === "after" ? "After" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Teaching Style */}
                  <div>
                    <span className="text-[11px] font-semibold mb-2 block" style={{ color: "rgba(255,255,255,0.70)" }}>Teaching Style</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {["Conversation", "Structured", "Roleplay", "Exam Prep"].map(style => (
                        <button key={style} onClick={() => setAiTutorSettings(s => ({ ...s, teachingStyle: style }))}
                          data-testid={`button-style-${style.toLowerCase().replace(" ", "-")}`}
                          className="py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                          style={aiTutorSettings.teachingStyle === style ? { background: "rgba(0,180,255,0.20)", border: "1px solid rgba(0,225,255,0.45)", color: "rgba(0,225,255,0.95)" } : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }}>
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Tutor Voice — locked during active session */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.70)" }}>Tutor Voice</span>
                      {aiTutorActive && <span className="text-[9px] mt-0.5" style={{ color: "rgba(255,200,80,0.65)" }}>Locked for this session</span>}
                    </div>
                    <button
                      onClick={() => !aiTutorActive && setAiTutorSettings(s => ({
                        ...s,
                        // Cycle Female → Male → Eva → Female
                        voice: s.voice === "Female" ? "Male" : s.voice === "Male" ? "Eva" : "Female",
                        voiceId: null,
                      }))}
                      data-testid="button-voice-toggle"
                      disabled={aiTutorActive}
                      className="text-[11px] font-semibold px-3 py-1 rounded-md transition-all"
                      style={aiTutorActive
                        ? { background: "rgba(80,80,100,0.30)", border: "1px solid rgba(255,200,80,0.25)", color: "rgba(255,200,80,0.70)", cursor: "not-allowed" }
                        : { background: "rgba(0,180,255,0.15)", border: "1px solid rgba(0,225,255,0.35)", color: "rgba(0,225,255,0.90)", cursor: "pointer" }}>
                      {aiTutorActive
                        ? (aiTutorSettings.voice === "Female" ? `♀ ${aiPersonaName}` : aiTutorSettings.voice === "Male" ? `♂ ${aiPersonaName}` : `✨ ${aiPersonaName}`)
                        : (aiTutorSettings.voice === "Female" ? "♀ Female" : aiTutorSettings.voice === "Male" ? "♂ Male" : "✨ Eva")}
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.70)" }}>Avatar</span>
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.38)" }}>LivePortrait</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {AI_TUTOR_AVATARS.filter(avatar => avatar.gender === "Female" || aiTutorSettings.voice === "Eva").map(avatar => (
                        <button
                          key={avatar.id}
                          onClick={() => setAiTutorSettings(s => ({ ...s, avatarId: avatar.id }))}
                          data-testid={`button-avatar-${avatar.id}`}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all"
                          style={aiTutorSettings.avatarId === avatar.id ? { background: "rgba(0,180,255,0.20)", border: "1px solid rgba(0,225,255,0.45)", color: "rgba(0,225,255,0.95)" } : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.48)" }}
                        >
                          <span
                            className="w-5 h-5 rounded-full flex-shrink-0"
                            style={{
                              background: `radial-gradient(circle at 40% 34%, ${avatar.hairStart} 0%, ${avatar.hairMid} 46%, ${avatar.hairEnd} 100%)`,
                              boxShadow: aiTutorSettings.avatarId === avatar.id ? `0 0 10px ${avatar.eye}` : "none",
                            }}
                          />
                          <span className="text-[10px] font-semibold">{avatar.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Personality */}
                  <div>
                    <span className="text-[11px] font-semibold mb-2 block" style={{ color: "rgba(255,255,255,0.70)" }}>Personality</span>
                    <div className="flex gap-1.5">
                      {["Friendly", "Strict", "Fun"].map(p => (
                        <button key={p} onClick={() => setAiTutorSettings(s => ({ ...s, personality: p }))}
                          data-testid={`button-personality-${p.toLowerCase()}`}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                          style={aiTutorSettings.personality === p ? { background: "rgba(0,180,255,0.20)", border: "1px solid rgba(0,225,255,0.45)", color: "rgba(0,225,255,0.95)" } : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Host-only: Enable/Disable AI Tutor for room */}
                  {isHost && (
                    <div
                      className="pt-2 border-t"
                      style={{ borderColor: "rgba(255,255,255,0.08)" }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-semibold block" style={{ color: "rgba(255,200,80,0.90)" }}>Room AI Access</span>
                          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.40)" }}>Allow others to use AI Tutor</span>
                        </div>
                        <button
                          data-testid="button-toggle-ai-tutor-enabled"
                          onClick={() => {
                            const newVal = !roomAiTutorEnabled;
                            setRoomAiTutorEnabled(newVal);
                            socket?.emit("room:ai-tutor-set-enabled", { roomId: room.id, userId: user?.id, enabled: newVal });
                          }}
                          className="w-10 h-5.5 rounded-full relative transition-all flex-shrink-0"
                          style={{
                            background: roomAiTutorEnabled ? "linear-gradient(90deg, rgba(0,200,100,0.85) 0%, rgba(0,160,80,0.80) 100%)" : "rgba(80,80,100,0.50)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            width: 40, height: 22,
                          }}
                        >
                          <span className="absolute w-4 h-4 rounded-full transition-all"
                            style={{
                              background: "rgba(255,255,255,0.95)",
                              left: roomAiTutorEnabled ? "calc(100% - 18px)" : "2px",
                              top: "50%", transform: "translateY(-50%)",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                            }} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── OLD AI Tutor: Conversation overlay (replaced above) ── */}
          {false && aiConversation.length > 0 && (
            <div
              className="fixed left-4 z-[60] flex flex-col gap-2 max-w-[300px]"
              style={{ pointerEvents: "none", top: "90px" }}
              data-testid="ai-tutor-conversation-old"
            >
              {aiConversation.slice(-4).map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === "ai" ? "items-start" : "items-end"}`}>
                  {msg.role === "ai" && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,80,200,0.80)", border: "1px solid rgba(0,225,255,0.50)" }}
                      >
                        <BrainCircuit className="w-3 h-3" style={{ color: "rgba(0,225,255,0.90)" }} />
                      </div>
                      <span className="text-[10px] font-semibold" style={{ color: "rgba(0,225,255,0.80)" }}>AI Tutor</span>
                    </div>
                  )}
                  <div
                    className="rounded-2xl px-3 py-2 text-[12px] leading-relaxed max-w-[260px]"
                    style={msg.role === "ai" ? {
                      background: "rgba(12,20,50,0.88)",
                      border: "1px solid rgba(0,225,255,0.20)",
                      color: "rgba(255,255,255,0.90)",
                      backdropFilter: "blur(12px)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.40)",
                    } : {
                      background: "rgba(30,40,80,0.82)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.88)",
                      backdropFilter: "blur(12px)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.40)",
                    }}
                  >
                    {msg.text}
                  </div>
                  {/* Grammar correction hint */}
                  {msg.correction && aiTutorSettings.correctionMode !== "off" && (
                    <div
                      className="mt-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                      style={{
                        background: "rgba(30,15,60,0.88)",
                        border: "1px solid rgba(180,100,255,0.35)",
                        color: "rgba(220,180,255,0.92)",
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.30)",
                        pointerEvents: "auto",
                      }}
                    >
                      <Lightbulb className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,200,60,0.90)" }} />
                      <span>Small fix</span>
                      {msg.correctionFixed && (
                        <>
                          <span style={{ color: "rgba(255,255,255,0.30)" }}>—</span>
                          <span style={{ color: "rgba(100,255,180,0.95)", fontStyle: "italic" }}>{msg.correctionFixed}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {aiTutorLoading && (
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,80,200,0.80)", border: "1px solid rgba(0,225,255,0.50)" }}
                  >
                    <BrainCircuit className="w-3 h-3" style={{ color: "rgba(0,225,255,0.90)" }} />
                  </div>
                  <div
                    className="flex items-center gap-1 rounded-2xl px-3 py-2"
                    style={{ background: "rgba(12,20,50,0.88)", border: "1px solid rgba(0,225,255,0.20)" }}
                  >
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                        style={{ animation: `pulse 0.6s ease-in-out infinite alternate`, animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Tutor input is now inside the unified overlay chat panel */}

          {/* ── AI Tutor Control Panel (old duplicate — removed) ── */}
          {false && aiTutorActive && aiTutorControlOpen && (
            <div
              className="fixed right-4 bottom-28 z-[62]"
              data-testid="ai-tutor-control-panel-old"
            >
              <div
                className="rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background: "rgba(10,14,35,0.94)",
                  border: "1px solid rgba(0,225,255,0.18)",
                  backdropFilter: "blur(24px)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)",
                  width: 260,
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: "rgba(0,225,255,0.12)" }}
                >
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4" style={{ color: "rgba(0,225,255,0.80)" }} />
                    <span className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.90)" }}>
                      AI Tutor <span style={{ color: "rgba(0,225,255,0.75)" }}>Control</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setAiTutorControlOpen(false)}
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                      style={{ color: "rgba(255,255,255,0.40)" }}
                      data-testid="button-ai-control-close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-4">
                  {/* Correction Mode */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.70)" }}>Correction Mode</span>
                      <div
                        className="w-9 h-5 rounded-full relative cursor-pointer transition-colors"
                        style={{
                          background: aiTutorSettings.correctionMode !== "off"
                            ? "linear-gradient(90deg, rgba(0,200,100,0.85) 0%, rgba(0,160,80,0.80) 100%)"
                            : "rgba(80,80,100,0.50)",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                        onClick={() => setAiTutorSettings(s => ({
                          ...s,
                          correctionMode: s.correctionMode === "off" ? "live" : "off",
                        }))}
                        data-testid="toggle-correction-mode"
                      >
                        <div
                          className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
                          style={{
                            background: "rgba(255,255,255,0.95)",
                            left: aiTutorSettings.correctionMode !== "off" ? "calc(100% - 18px)" : "2px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {(["live", "after", "off"] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setAiTutorSettings(s => ({ ...s, correctionMode: mode }))}
                          data-testid={`button-correction-${mode}`}
                          className="flex-1 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all"
                          style={aiTutorSettings.correctionMode === mode ? {
                            background: "rgba(0,180,255,0.20)",
                            border: "1px solid rgba(0,225,255,0.45)",
                            color: "rgba(0,225,255,0.95)",
                          } : {
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            color: "rgba(255,255,255,0.40)",
                          }}
                        >
                          {mode === "after" ? "After" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Teaching Style */}
                  <div>
                    <span className="text-[11px] font-semibold mb-2 block" style={{ color: "rgba(255,255,255,0.70)" }}>Teaching Style</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {["Conversation", "Structured", "Roleplay", "Exam Prep"].map(style => (
                        <button
                          key={style}
                          onClick={() => setAiTutorSettings(s => ({ ...s, teachingStyle: style }))}
                          data-testid={`button-style-${style.toLowerCase().replace(" ", "-")}`}
                          className="py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                          style={aiTutorSettings.teachingStyle === style ? {
                            background: "rgba(0,180,255,0.20)",
                            border: "1px solid rgba(0,225,255,0.45)",
                            color: "rgba(0,225,255,0.95)",
                          } : {
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            color: "rgba(255,255,255,0.40)",
                          }}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tutor Personality */}
                  <div>
                    <span className="text-[11px] font-semibold mb-2 block" style={{ color: "rgba(255,255,255,0.70)" }}>Tutor Personality</span>
                    <div className="flex gap-1.5">
                      {["Friendly", "Strict", "Fun"].map(p => (
                        <button
                          key={p}
                          onClick={() => setAiTutorSettings(s => ({ ...s, personality: p }))}
                          data-testid={`button-personality-${p.toLowerCase()}`}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                          style={aiTutorSettings.personality === p ? {
                            background: "rgba(0,180,255,0.20)",
                            border: "1px solid rgba(0,225,255,0.45)",
                            color: "rgba(0,225,255,0.95)",
                          } : {
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            color: "rgba(255,255,255,0.40)",
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Voice + Speed */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.70)" }}>Tutor Voice</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAiTutorSettings(s => ({ ...s, voice: s.voice === "Female" ? "Male" : "Female" }))}
                        data-testid="button-voice-toggle"
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md transition-all"
                        style={{
                          background: "rgba(0,180,255,0.15)",
                          border: "1px solid rgba(0,225,255,0.35)",
                          color: "rgba(0,225,255,0.90)",
                        }}
                      >
                        {aiTutorSettings.voice}
                      </button>
                      <div
                        className="text-[10px] px-1.5 py-0.5 rounded-md"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.45)" }}
                      >
                        Speed {Math.round(aiTutorSettings.speed * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* Tone slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.70)" }}>Tone</span>
                      <div
                        className="w-9 h-5 rounded-full relative cursor-pointer transition-colors"
                        style={{
                          background: "linear-gradient(90deg, rgba(0,200,100,0.85) 0%, rgba(0,160,80,0.80) 100%)",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                        data-testid="toggle-tone"
                      >
                        <div
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full"
                          style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
                        />
                      </div>
                    </div>
                    <div
                      className="w-full h-1.5 rounded-full relative cursor-pointer"
                      style={{ background: "rgba(255,255,255,0.10)" }}
                      data-testid="slider-tone"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${aiTutorSettings.tone * 100}%`,
                          background: "linear-gradient(90deg, rgba(0,200,100,0.80) 0%, rgba(0,225,255,0.80) 100%)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Dismiss button */}
                  <button
                    onClick={toggleAiTutor}
                    data-testid="button-dismiss-ai-tutor"
                    className="w-full py-2 rounded-xl text-[12px] font-semibold transition-all hover:opacity-80"
                    style={{
                      background: "rgba(239,68,68,0.12)",
                      border: "1px solid rgba(239,68,68,0.30)",
                      color: "rgba(252,165,165,0.85)",
                    }}
                  >
                    Dismiss AI Tutor
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <DmDialog otherUserId={dmUserId} onClose={() => setDmUserId(null)} />

      {/* In-room DM notification */}
      {roomDmNotification && (
        <div className="fixed top-4 right-4 z-[100] max-w-xs w-full animate-in slide-in-from-right-4 fade-in duration-300">
          <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-start gap-3 p-3">
              <Avatar className="w-10 h-10 flex-shrink-0 rounded-md">
                <AvatarImage src={roomDmNotification.fromUser?.profileImageUrl || undefined} alt="" />
                <AvatarFallback className="rounded-md bg-primary/20 text-primary text-sm font-bold">
                  {getUserInitials(roomDmNotification.fromUser)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground truncate">
                    💬 {getUserDisplayName(roomDmNotification.fromUser)} sent you a PM
                  </p>
                  <button
                    onClick={() => setRoomDmNotification(null)}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {roomDmNotification.text.startsWith("[gif:") && roomDmNotification.text.endsWith("]") ? (
                  <div className="mt-1.5">
                    <img
                      src={roomDmNotification.text.slice(5, -1)}
                      alt="GIF"
                      className="h-16 w-auto rounded-md object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : roomDmNotification.text.startsWith("[img:") && roomDmNotification.text.endsWith("]") ? (
                  <div className="mt-1.5">
                    <img
                      src={roomDmNotification.text.slice(5, -1)}
                      alt="Photo"
                      className="h-16 w-auto rounded-md object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{roomDmNotification.text}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setDmUnreadCounts(prev => { const next = { ...prev }; delete next[roomDmNotification.fromId]; return next; });
                setDmUserId(roomDmNotification.fromId);
                setRoomDmNotification(null);
              }}
              className="w-full text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 py-2 border-t border-border transition-colors"
            >
              Reply
            </button>
          </div>
        </div>
      )}


      {lightboxMedia && (() => {
        const lbMsg = chatMessages.find(m => m.id === lightboxMedia.msgId);
        const lbUser = lbMsg ? (lbMsg.user || participants.find(p => p.id === lbMsg.userId)) : null;
        const QUICK_EMOJIS = ["👍", "❤️", "😢", "😠", "💔", "😂", "😮", "👏"];
        return (
          <div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setLightboxMedia(null)}
          >
            <div className="relative flex flex-col items-center gap-4 max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <button
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background text-foreground z-10 border border-border shadow"
                onClick={() => setLightboxMedia(null)}
                aria-label="Close image viewer"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={lightboxMedia.url}
                alt="media"
                width={800}
                height={600}
                className="max-w-full max-h-[70vh] rounded-xl object-contain shadow-2xl"
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-background/80 border border-border rounded-full px-3 py-1.5 shadow">
                  {QUICK_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      className="text-lg hover:scale-125 transition-transform px-0.5"
                      onClick={() => { if (lbMsg) handleReact(lbMsg.id, emoji); setLightboxMedia(null); }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {lbMsg && (
                  <button
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full px-4 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors shadow"
                    onClick={() => {
                      setReplyingTo({
                        id: lbMsg.id,
                        userId: lbMsg.userId,
                        userName: getUserDisplayName(lbUser),
                        text: lbMsg.text,
                      });
                      setSidePanelTab("chat");
                      setLightboxMedia(null);
                      setTimeout(() => chatInputRef.current?.focus(), 100);
                    }}
                  >
                    <CornerUpLeft className="w-3.5 h-3.5" /> Reply
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {miniCameraMode && isVideoOn && localVideoStreamObj && (
        <div
          className="fixed z-50 select-none"
          style={{ left: 12, top: 70, width: 200, height: 130 }}
          data-testid="mini-camera-player"
        >
          <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-black">
            <div className={`w-full h-full ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}>
              <RemoteVideoPreview stream={localVideoStreamObj} />
            </div>
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full pointer-events-none">
              You
            </div>
            {/* Flip camera — in mini mode, shown top-left opposite the close button */}
            <button
              className="absolute top-1.5 left-1.5 w-6 h-6 bg-black/60 hover:bg-black/85 rounded-full flex items-center justify-center shadow-lg transition-colors z-10 disabled:opacity-40"
              onClick={(e) => { e.stopPropagation(); handleFlipCamera(); }}
              disabled={isFlippingCamera}
              data-testid="button-flip-camera-mini"
              aria-label="Flip camera"
              title={cameraFacing === "user" ? "Switch to back camera" : "Switch to front camera"}
            >
              <RotateCcw className={`w-3 h-3 text-white ${isFlippingCamera ? "animate-spin" : ""}`} />
            </button>
            <button
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); setMiniCameraMode(false); setFocusedUserId(null); }}
              data-testid="button-mini-camera-close"
              aria-label="Close mini camera"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Persistent YouTube player wrapper.
          Mounted whenever activeYoutubeId is set, so playback never restarts when a viewer
          clicks an avatar, opens a panel, or otherwise hides the player view.
            - showYoutube + slot rect available  → matches the slot's bounding rect
            - miniPlayerMode (or no slot rect)   → small floating mini player
            - neither                            → 1×1 hidden but still playing audio */}
      {activeYoutubeId && miniPlayerMode && (() => {
        // Mini-player only — the full player is now rendered inline inside ytSlotRef.
        // This floating fixed-position block only appears when the user minimises the watch view.
        return (
          <div
            className="fixed select-none"
            style={{ left: miniPlayerPos.x, top: miniPlayerPos.y, width: 220, height: 130, zIndex: 50 }}
            data-testid="youtube-mini-player"
          >
            <div
              className="relative w-full h-full overflow-hidden bg-black rounded-xl shadow-2xl border border-white/20 cursor-grab active:cursor-grabbing group"
              onMouseDown={handleMiniPlayerMouseDown}
            >
              {/* YT API player mounts here — same player instance as the full view,
                  just redirected into this container so switching to mini mode never
                  triggers a fresh iframe load (and avoids YouTube Error 153). */}
              <div
                ref={ytMiniContainerRef}
                className="absolute inset-0 w-full h-full"
                data-testid="iframe-youtube-mini-player"
              />
              {/* Expand overlay on hover */}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-20 pointer-events-none">
                <button
                  className="bg-blue-500 hover:bg-blue-400 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg transition-colors flex items-center gap-1.5 pointer-events-auto"
                  onClick={(e) => { e.stopPropagation(); handleExpandMiniPlayer(); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  data-testid="button-mini-player-expand"
                >
                  <Maximize2 className="w-3 h-3" />
                  Expand
                </button>
              </div>
              {/* Close button */}
              <button
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg transition-colors z-30"
                aria-label="Close mini player"
                onClick={(e) => {
                  e.stopPropagation();
                  if (user?.id === youtubeStartedBy) {
                    handleStopYoutube();
                    setMiniPlayerMode(false);
                  } else {
                    setShowYoutube(false);
                    setMiniPlayerMode(false);
                    setUserDismissedYoutube(true);
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title={user?.id === youtubeStartedBy ? "Close video for everyone" : "Hide video (just for me)"}
                data-testid="button-mini-player-close"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        );
      })()}

      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-80 p-0 flex flex-col md:hidden" data-testid="sheet-side-panel">
          {sidePanelContent}
        </SheetContent>
      </Sheet>

      {sidePanelOpen && (
        <div className="w-80 border-l flex-col hidden md:flex h-full overflow-hidden relative z-10" style={getChatPanelStyle(currentTheme)}>
          {sidePanelContent}
        </div>
      )}

      {/* Report Dialog */}
      {reportTargetUserId && (() => {
        const target = reportTargetUserId ? participantById.get(reportTargetUserId) : undefined;
        return (
          <ReportDialog
            open={!!reportTargetUserId}
            onOpenChange={(open) => { if (!open) setReportTargetUserId(null); }}
            reportedUser={{
              id: reportTargetUserId,
              displayName: target ? getUserDisplayName(target) : undefined,
              profileImageUrl: target?.profileImageUrl || null,
              initials: target ? getUserInitials(target) : undefined,
            }}
            context="user"
            contextLabel={`In room: ${room.title}`}
            testIdSuffix={reportTargetUserId}
          />
        );
      })()}

      {/* Block Type Dialog */}
      <Dialog open={!!blockDialogUserId && blockDialogStep === "choose"} onOpenChange={(open) => { if (!open) setBlockDialogUserId(null); }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5" />
              Block {blockDialogName}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">Choose how you'd like to block this user.</p>
          <div className="flex flex-col gap-3">
            <button
              data-testid="btn-ordinary-block"
              className="flex items-start gap-3 rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
              onClick={() => blockDialogUserId && executeBlock(blockDialogUserId, "ordinary")}
            >
              <VolumeX className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <div className="font-semibold text-sm">Ordinary Block</div>
                <div className="text-xs text-muted-foreground mt-0.5">Their profile card stays visible, but you won't hear their voice or receive their messages.</div>
              </div>
            </button>
            <button
              data-testid="btn-forever-block-choose"
              className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-950/20 p-4 text-left hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
              onClick={() => setBlockDialogStep("forever-confirm")}
            >
              <EyeOff className="w-5 h-5 mt-0.5 text-red-500 shrink-0" />
              <div>
                <div className="font-semibold text-sm text-red-600 dark:text-red-400">Forever Block</div>
                <div className="text-xs text-red-500/80 mt-0.5">This person completely disappears from your view — no profile, no voice, no messages, ever.</div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forever Block Confirmation Dialog */}
      <Dialog open={!!blockDialogUserId && blockDialogStep === "forever-confirm"} onOpenChange={(open) => { if (!open) setBlockDialogUserId(null); }}>
        <DialogContent className="max-w-sm border-red-500 bg-red-950/10 dark:bg-red-950/30" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Permanently hide {blockDialogName}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              This is a <span className="underline underline-offset-2">Forever Block</span>. Once applied:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
              <li>This user will vanish from your platform entirely</li>
              <li>You will never see their profile, voice, or messages</li>
              <li>They will not know you blocked them</li>
            </ul>
            <p className="text-xs text-muted-foreground">You can undo this from your blocked users list.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              data-testid="btn-forever-block-cancel"
              onClick={() => setBlockDialogStep("choose")}
            >
              Go back
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              data-testid="btn-forever-block-confirm"
              onClick={() => blockDialogUserId && executeBlock(blockDialogUserId, "forever")}
            >
              Forever Block
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RoomOnboardingTour user={user} isOwner={isHost} />
      <PinnedSocialsButton />

      {/* Troll Vote Modal — hidden once the user has cast their vote */}
      {trollVoteModal && user && trollVoteModal.targetUserId !== user.id && myTrollVote === null && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center pointer-events-none">
          <div
            className="pointer-events-auto relative w-80 rounded-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-300"
            style={{
              background: "linear-gradient(145deg, rgba(26,22,10,0.97) 0%, rgba(20,18,8,0.98) 100%)",
              border: "1px solid rgba(234,179,8,0.35)",
              boxShadow: "0 0 0 1px rgba(234,179,8,0.10), 0 20px 60px rgba(0,0,0,0.70), 0 0 40px rgba(234,179,8,0.12), inset 0 1px 0 rgba(253,224,71,0.10)",
            }}
          >
            {/* Header glow strip */}
            <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(234,179,8,0.6), transparent)" }} />
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: "radial-gradient(circle, rgba(234,179,8,0.20) 0%, rgba(234,179,8,0.06) 100%)", border: "1px solid rgba(234,179,8,0.40)", boxShadow: "0 0 12px rgba(234,179,8,0.30), inset 0 1px 0 rgba(253,224,71,0.15)" }}
                >
                  🧌
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-400/70 mb-0.5">Troll Detected</p>
                  <p className="text-sm font-bold text-white leading-snug">
                    <span className="text-yellow-300">{trollVoteModal.targetName}</span> was marked as Troll
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">by {trollVoteModal.assignedByName} · Vote to kick them?</p>
                </div>
              </div>

              {trollVoteProgress && (
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-white/50 mb-1.5 font-medium">
                    <span>Kick votes</span>
                    <span className="text-yellow-400 font-bold">{trollVoteProgress.kickVotes} / {Math.ceil(trollVoteProgress.totalVoters / 2 + 0.5)} needed</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (trollVoteProgress.kickVotes / Math.max(1, trollVoteProgress.totalVoters)) * 100)}%`,
                        background: "linear-gradient(90deg, rgba(234,179,8,0.8), rgba(253,224,71,0.9))",
                        boxShadow: "0 0 8px rgba(234,179,8,0.5)",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">{trollVoteProgress.totalVoters} eligible voter{trollVoteProgress.totalVoters !== 1 ? "s" : ""} · majority required</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const newVote = myTrollVote === true ? null : true;
                    setMyTrollVote(newVote);
                    socket?.emit("room:troll-vote", { roomId: room.id, voterId: user.id, kick: newVote === true });
                  }}
                  className="h-10 rounded-xl text-[12px] font-bold transition-all active:scale-95"
                  style={myTrollVote === true
                    ? { background: "linear-gradient(145deg, rgba(234,179,8,0.30), rgba(161,124,0,0.25))", border: "1px solid rgba(234,179,8,0.60)", color: "#fde047", boxShadow: "inset 0 1px 0 rgba(253,224,71,0.15), 0 0 12px rgba(234,179,8,0.25)" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }
                  }
                  data-testid="button-troll-vote-kick"
                >
                  👢 Kick {myTrollVote === true ? "✓" : ""}
                </button>
                <button
                  onClick={() => {
                    setMyTrollVote(false);
                    socket?.emit("room:troll-vote", { roomId: room.id, voterId: user.id, kick: false });
                  }}
                  className="h-10 rounded-xl text-[12px] font-bold transition-all active:scale-95"
                  style={myTrollVote === false
                    ? { background: "rgba(148,163,184,0.14)", border: "1px solid rgba(148,163,184,0.40)", color: "rgb(203,213,225)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }
                  }
                  data-testid="button-troll-vote-stay"
                >
                  🛡️ Stay
                </button>
              </div>
              <p className="text-[9px] text-white/20 text-center mt-3">Poll expires in 60 seconds</p>
            </div>
          </div>
        </div>
      )}

      {hostVoteModal && hostVoteProgress && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-purple-500/30 rounded-2xl shadow-2xl p-6 w-80 max-w-[90vw]">
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">👑</div>
              <h3 className="text-white font-bold text-base">Host Vote</h3>
              <p className="text-white/60 text-xs mt-1">
                <span className="text-purple-300 font-medium">{hostVoteModal.nominatorName}</span> nominated{" "}
                <span className="text-yellow-300 font-medium">{hostVoteModal.nomineeName}</span> to be the new host
              </p>
            </div>

            <div className="flex justify-center gap-2 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{hostVoteProgress.yesVotes}</div>
                <div className="text-[10px] text-white/40">Yes</div>
              </div>
              <div className="text-white/20 text-2xl self-center">/</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{hostVoteProgress.noVotes}</div>
                <div className="text-[10px] text-white/40">No</div>
              </div>
              <div className="text-white/20 text-2xl self-center">/</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white/50">{hostVoteProgress.totalVoters}</div>
                <div className="text-[10px] text-white/40">Total</div>
              </div>
            </div>

            {user && hostVoteModal.nomineeId !== user.id && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    if (!user || myHostVote === "yes") return;
                    setMyHostVote("yes");
                    socket?.emit("room:host-vote", { roomId: room.id, voterId: user.id, vote: "yes" });
                  }}
                  disabled={myHostVote !== null}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${myHostVote === "yes" ? "bg-green-600 text-white cursor-default" : "bg-green-900/30 text-green-400 hover:bg-green-800/50 border border-green-600/30"}`}
                >
                  👑 Yes
                </button>
                <button
                  onClick={() => {
                    if (!user || myHostVote === "no") return;
                    setMyHostVote("no");
                    socket?.emit("room:host-vote", { roomId: room.id, voterId: user.id, vote: "no" });
                  }}
                  disabled={myHostVote !== null}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${myHostVote === "no" ? "bg-red-600 text-white cursor-default" : "bg-red-900/30 text-red-400 hover:bg-red-800/50 border border-red-600/30"}`}
                >
                  ✕ No
                </button>
              </div>
            )}

            {user && hostVoteModal.nomineeId === user.id && (
              <p className="text-center text-xs text-white/40 mt-2">You are the nominee — the room is voting for you!</p>
            )}

            <p className="text-[9px] text-white/20 text-center mt-3">Poll expires in 60 seconds</p>
          </div>
        </div>
      )}

      {/* ── Share Room Dialog ── */}
      {shareDialogOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShareDialogOpen(false); }}
          data-testid="share-room-dialog"
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: "hsl(var(--card))", border: "1px solid rgba(167,139,250,0.25)", boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.08)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-base">Share Room</h3>
                <p className="text-xs text-white/50 mt-0.5">Invite others to join this room</p>
              </div>
              <button
                onClick={() => setShareDialogOpen(false)}
                className="text-white/40 hover:text-white/70 transition-colors"
                data-testid="button-close-share-dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Room info */}
            <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-sm font-semibold text-white truncate">{room.title}</p>
              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <span>{room.language}</span>
                <span>·</span>
                <span>{room.level}</span>
                <span>·</span>
                <span className="text-emerald-400">{participants.length} in room</span>
              </div>
            </div>

            {/* Current participants — card grid matching room-card style */}
            {participants.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2.5">
                  In the room now · {participants.length}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {participants.slice(0, 8).map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col items-center gap-1.5"
                      data-testid={`share-participant-${p.id}`}
                    >
                      <div
                        className="w-full aspect-square rounded-xl overflow-hidden relative"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
                      >
                        {p.profileImageUrl ? (
                          <img
                            src={p.profileImageUrl}
                            alt={getUserDisplayName(p)}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white/40">
                            {getUserInitials(p)}
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-white/60 truncate w-full text-center leading-tight">
                        {getUserDisplayName(p).split(" ")[0]}
                      </span>
                    </div>
                  ))}
                  {participants.length > 8 && (
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-full aspect-square rounded-xl flex items-center justify-center text-sm font-semibold text-white/40"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        +{participants.length - 8}
                      </div>
                      <span className="text-[9px] text-white/30">more</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Copy link */}
            <ShareRoomLinkButton roomId={room.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function ShareRoomLinkButton({ roomId: _roomId }: { roomId: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${window.location.pathname}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast({ description: "Room link copied to clipboard!" });
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      toast({ variant: "destructive", description: "Failed to copy link" });
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 min-w-0 px-3 py-2 rounded-lg text-[11px] text-white/50 truncate select-all"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "monospace" }}
        data-testid="text-room-share-url"
      >
        {url}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
        style={copied
          ? { background: "rgba(52,211,153,0.20)", color: "rgba(52,211,153,0.9)", border: "1px solid rgba(52,211,153,0.35)" }
          : { background: "rgba(167,139,250,0.20)", color: "rgba(196,181,253,0.9)", border: "1px solid rgba(167,139,250,0.35)" }}
        data-testid="button-copy-room-link"
      >
        {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
