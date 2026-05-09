import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense, type ReactNode } from "react";
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
  Mic, MicOff, PhoneOff, Hand, Globe, AlertCircle, MessageSquare,
  UserX, VolumeX, Send, X, Monitor, UserPlus, UserCheck, Users, Settings, Youtube,
  Video, VideoOff, LogIn, LogOut, Search, Play, Pause, Loader2, Pencil, Shield, Crown,
  Volume2, Copy, Flag, Ban, RefreshCw, Trash2, ChevronUp, ChevronsDown, Maximize2, Minimize2, Palette,
  Tv, BookOpen, Gamepad2, ExternalLink, Volume1, ChevronLeft, ChevronRight, CornerUpLeft, Eye, Bell, LockKeyhole,
  AtSign, TrendingUp, StopCircle, Clock, LayoutGrid, Radio, UsersRound, AlertTriangle, EyeOff, Image as ImageIcon,
  BrainCircuit, Lightbulb, ChevronDown, RotateCcw, ListVideo, Zap, Lock, ThumbsUp, ThumbsDown, SkipForward, Smile,
  Sparkles, Upload, MonitorPlay, Megaphone, Film, Star, AudioLines
} from "lucide-react";
import { SiInstagram, SiLinkedin, SiFacebook } from "react-icons/si";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
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
const ChessPanel = lazy(() =>
  import("@/components/chess-panel").then((m) => ({ default: m.ChessPanel }))
);
const CenterChessOverlay = lazy(() =>
  import("@/components/center-chess-overlay").then((m) => ({ default: m.CenterChessOverlay }))
);
import { getAvatarRingClass } from "@/lib/avatar-ring";
import { FlairBadgeDisplay } from "@/components/profile-dropdown";
import { ProfileDecoration, ROOM_THEMES, PRESET_BACKGROUNDS, getRoomThemeStyle, RoomThemeOverlay, getChatPanelStyle } from "@/components/profile-decorations";
import { NeuParticipantSlider } from "@/components/neu-participant-slider";
import { UserNotePopover } from "@/components/social-panel";
import { useAiTutor } from "@/hooks/use-ai-tutor";
import { setYoutubeActive, isYoutubeActive } from "@/lib/perf-bus";
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

function WaveformCanvas({ analyserNode }: { analyserNode?: AnalyserNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const dataArray = analyserNode ? new Uint8Array(analyserNode.frequencyBinCount) : null;

    /* Three layered sine waves: amber (primary), violet (mid), cyan (deep) */
    const LAYERS = [
      { r: 251, g: 146, b:  60, alpha: 0.92, lw: 2.2, blur: 12, speed: 0.072, freq: 2.0, ampMul: 0.90 },
      { r: 167, g: 139, b: 250, alpha: 0.58, lw: 1.5, blur:  7, speed: 0.052, freq: 3.2, ampMul: 0.62 },
      { r:   6, g: 182, b: 212, alpha: 0.34, lw: 1.0, blur:  5, speed: 0.032, freq: 1.5, ampMul: 0.40 },
    ];

    const STEPS = 44;

    const draw = () => {
      const t = tRef.current++;
      ctx.clearRect(0, 0, W, H);

      let level = 0;
      if (analyserNode && dataArray) {
        analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        const cap = Math.min(56, dataArray.length);
        for (let i = 0; i < cap; i++) sum += dataArray[i];
        level = sum / cap / 255;
      } else {
        /* Gentle idle pulse when no live audio */
        level = 0.18 + Math.sin(t * 0.038) * 0.055;
      }

      for (let li = 0; li < LAYERS.length; li++) {
        const L = LAYERS[li];
        const phase = t * L.speed + li * Math.PI * 0.68;

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${L.r},${L.g},${L.b},${L.alpha})`;
        ctx.lineWidth = L.lw;
        ctx.shadowBlur = L.blur;
        ctx.shadowColor = `rgba(${L.r},${L.g},${L.b},0.60)`;

        const pts: [number, number][] = [];
        for (let i = 0; i <= STEPS; i++) {
          const x = (i / STEPS) * W;
          let amp: number;
          if (analyserNode && dataArray) {
            const bin = Math.floor((i / STEPS) * Math.min(56, dataArray.length - 1));
            amp = (dataArray[bin] / 255) * H * L.ampMul;
          } else {
            amp = level * H * L.ampMul;
          }
          const y = H / 2 + Math.sin((x / W) * Math.PI * L.freq + phase) * Math.max(1.2, amp);
          pts.push([x, y]);
        }

        /* Smooth bezier through all points */
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        ctx.stroke();
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyserNode]);

  return (
    <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
      <canvas
        ref={canvasRef}
        width={104}
        height={30}
        className="opacity-96"
        data-testid="waveform-canvas"
      />
    </div>
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
      <PopoverContent className="w-72 p-0 bg-card border-border text-card-foreground shadow-xl" align="end" avoidCollisions onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col p-3 gap-3">
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
            <div className="grid grid-cols-4 gap-2">
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
               <Button variant="outline" size="sm" onClick={() => onReconnect && onReconnect(p.id)} className="h-12 flex-col text-[10px] leading-tight border-border bg-transparent hover:bg-muted px-1 gap-0.5">
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="truncate w-full text-center">Reboot</span>
               </Button>
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
        className={`relative rounded-md overflow-hidden bg-muted/20 group border-[3px] select-none ${
          isSpeaking ? "border-[hsl(var(--neu-orange))]/60 shadow-[0_0_14px_hsl(var(--neu-orange)/0.45)]" : "border-transparent hover:border-white/20"
        } transition-all duration-300`}
        style={{ width: cardPx, height: cardPx, flexShrink: 0 }}
      >
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
                  <img src={p.profileImageUrl} alt={getUserDisplayName(p)} width={36} height={36} decoding="async" className="w-full h-full object-cover" />
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
                  <img src={p.profileImageUrl} alt={getUserDisplayName(p)} width={36} height={36} decoding="async" className="w-full h-full object-cover" />
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
                  <img src={p.profileImageUrl} alt={getUserDisplayName(p)} width={36} height={36} decoding="async" className="w-full h-full object-cover" />
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
          <RemoteVideoPreview stream={remoteVideoStream} className={isMe && localVideoFlipped ? "scale-x-[-1]" : ""} />
        ) : avatarGifUrl ? (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-0 z-0"
              style={{
                backgroundImage: `url('${avatarGifUrl}')`,
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
                  <img src={p.profileImageUrl} alt={getUserDisplayName(p)} width={28} height={28} decoding="async" className="w-full h-full object-cover" />
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
            decoding="async"
            width={200}
            height={200}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
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

        {gearPopover}

        {isSpeaking && (
          <WaveformCanvas analyserNode={analyserNode} />
        )}

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
          <div className="absolute bottom-1 right-1 z-20 drop-shadow-md">
            {p.isMuted ? (
              <MicOff className="w-4 h-4 text-white opacity-80" />
            ) : (
               <Mic className="w-4 h-4 text-white opacity-100" />
            )}
          </div>
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

export function VoiceRoom({ room: roomProp, onLeave, watchUserId }: VoiceRoomProps) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { toast } = useToast();
  const [roomData, setRoomData] = useState(roomProp);
  const room = roomData;
  const [isMuted, setIsMuted] = useState(true);
  const isMutedRef = useRef(true);
  const [handRaised, setHandRaised] = useState(false);
  // Mood reactions — when any participant fires a mood emoji from the picker,
  // we keep their currently-active emoji here keyed by userId. The floating
  // animation in ParticipantCard re-runs whenever the entry's `id` changes
  // (the `key` prop on the floating div), so picking the same emoji twice in a
  // row still re-triggers the animation. Entries are auto-cleared after the
  // animation duration so the card returns to its normal state.
  const [participantAvatarGifs, setParticipantAvatarGifs] = useState<Record<string, string>>({});
  const [participantMoods, setParticipantMoods] = useState<Record<string, { id: string; emoji: string }>>({});
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
  const [micError, setMicError] = useState(false);
  const [showMicHelp, setShowMicHelp] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(() => localStorage.getItem("connect2talk-mic-device") || "default");
  const [micSwitching, setMicSwitching] = useState(false);
  const [micPermissionStatus, setMicPermissionStatus] = useState<PermissionState | "unknown">("unknown");
  const [dismissedWelcomeIds, setDismissedWelcomeIds] = useState<Set<string>>(new Set());
  const [welcomeDialogOpen, setWelcomeDialogOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState("chat");
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // ── AI Tutor (modular: STT / TTS / Stream / Avatar) ──────────────────────
  const [aiPersonaPickerOpen, setAiPersonaPickerOpen] = useState(false);

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
  const [chatMessageColor, setChatMessageColor] = useState(() => localStorage.getItem("connect2talk-chat-color") || "#e5e7eb");
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
  const typingExpireTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const aiInputRef = useRef<HTMLInputElement>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraShareMode, setIsCameraShareMode] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [isFlippingCamera, setIsFlippingCamera] = useState(false);
  const [localVideoStreamObj, setLocalVideoStreamObj] = useState<MediaStream | null>(null);
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
  const [popularMovies, setPopularMovies] = useState<any[]>([]);
  const [popularMoviesLoading, setPopularMoviesLoading] = useState(false);
  const dailyModernMovieRef = useRef<{ dayKey: string; movieId: string | null }>({ dayKey: "", movieId: null });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteRoomOpen, setDeleteRoomOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(roomProp.title);
  const [editLanguage, setEditLanguage] = useState(roomProp.language);
  const [editLevel, setEditLevel] = useState(roomProp.level);
  const [editMaxUsers, setEditMaxUsers] = useState(roomProp.maxUsers);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [themeDialogOffset, setThemeDialogOffset] = useState(0);
  const [editRoomTheme, setEditRoomTheme] = useState((roomProp as any).roomTheme || "none");
  const [editThemeOffset, setEditThemeOffset] = useState(0);
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
  const [reportTargetUserId, setReportTargetUserId] = useState<string | null>(null);
  const [blockDialogUserId, setBlockDialogUserId] = useState<string | null>(null);
  const [blockDialogStep, setBlockDialogStep] = useState<"choose" | "forever-confirm">("choose");
  const [blockDialogName, setBlockDialogName] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; userId: string; userName: string; text: string } | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
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
  const [moviePlayerHeight, setMoviePlayerHeight] = useState<number | null>(null);
  const [ytPlayerHeight, setYtPlayerHeight] = useState<number | null>(null);
  // Reset to full-height (flex-1) whenever a new video/movie starts so the
  // player always opens at maximum size rather than a previously-dragged size.
  useEffect(() => { if (activeYoutubeId) setYtPlayerHeight(null); }, [activeYoutubeId]);
  useEffect(() => { if (activeMovieId) setMoviePlayerHeight(null); }, [activeMovieId]);
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

  const [readSearch, setReadSearch] = useState("");
  const [readBooks, setReadBooks] = useState<any[]>([]);
  const [readCatalog, setReadCatalog] = useState<any[]>([]);
  const [readAudiobooks, setReadAudiobooks] = useState<any[]>([]);
  const [readVideos, setReadVideos] = useState<any[]>([]);
  const [readLoading, setReadLoading] = useState(false);
  const [readingHistory, setReadingHistory] = useState<Array<{ id: string | number; title: string; author: string; coverUrl: string | null; lastReadAt: string }>>(() => {
    try { return JSON.parse(localStorage.getItem("vextorn_reading_history") || "[]"); } catch { return []; }
  });
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [bookText, setBookText] = useState("");
  const [bookLoading, setBookLoading] = useState(false);
  const [wordInfo, setWordInfo] = useState<{ word: string; translation: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showEReader, setShowEReader] = useState(false);
  const [eReaderTheme, setEReaderTheme] = useState<"light" | "dark" | "sepia">("sepia");
  const [eReaderFontSize, setEReaderFontSize] = useState(16);
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
  const [dmUnreadCounts, setDmUnreadCounts] = useState<Record<string, number>>({});
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
    if (sidePanelTab === "chat") setUnreadChatBadge(0);
  }, [sidePanelTab]);

  useEffect(() => {
    localStorage.setItem("connect2talk-chat-color", chatMessageColor);
  }, [chatMessageColor]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following", user?.id] });
      import("@/lib/sound-fx").then((s) => s.sfxFollow()).catch(() => {});
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
    onSuccess: (updatedRoom: any) => {
      setRoomData((prev: any) => ({ ...prev, ...updatedRoom }));
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", room.id] });
      // Also patch the lobby cache directly so the GIF background appears on
      // the room card immediately — the socket room:updated event does the
      // same but can arrive after one extra round-trip.
      queryClient.setQueryData(["/api/rooms"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((r: any) =>
          r.id === room.id ? { ...r, ...updatedRoom } : r
        );
      });
      // Cancel any in-flight /api/rooms/mine refetch and sync it with the
      // mutation result to prevent a stale response from overwriting
      // hologramVideoUrl back to null via the myOwnRooms useEffect.
      queryClient.cancelQueries({ queryKey: ["/api/rooms/mine"] });
      queryClient.setQueryData(["/api/rooms/mine"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((r: any) => r.id === room.id ? { ...r, ...updatedRoom } : r);
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
      voiceProcessorRef.current.onLevelMeter = (rms, peak) => setMicLevel({ rms, peak });
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
    setSelectedVoicePresetId(presetId);
    selectedVoicePresetIdRef.current = presetId;
    saveVoicePresetId(presetId);
    setVoicePickerOpen(false);

    // Auto-preview the character sound when selected (non-blocking)
    if (presetId !== "natural") {
      const ctx = (() => {
        if (!audioContextRef.current) {
          const AC = window.AudioContext || (window as any).webkitAudioContext;
          if (AC) audioContextRef.current = new AC();
        }
        return audioContextRef.current;
      })();
      if (ctx) {
        setPreviewingPresetId(presetId);
        previewVoicePreset(ctx, presetId)
          .catch(() => {})
          .finally(() => setPreviewingPresetId(null));
      }
    }

    const rawStream = rawMicStreamRef.current;
    if (!rawStream) return;

    if (!audioContextRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) audioContextRef.current = new AC();
    }
    if (!audioContextRef.current) return;
    if (!voiceProcessorRef.current) {
      voiceProcessorRef.current = new VoiceProcessor(audioContextRef.current);
    }
    voiceProcessorRef.current.onLevelMeter = (rms, peak) => setMicLevel({ rms, peak });
    // CRITICAL: await process() so AudioContext is resumed before the graph is
    // wired — without this the filter chain is silently inactive.
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
        
        setSpeakingUsers(prev => {
          if (prev.size !== currentlySpeaking.size) return currentlySpeaking;
          let changed = false;
          prev.forEach((id) => {
             if (!currentlySpeaking.has(id)) { changed = true; }
          });
          return changed ? currentlySpeaking : prev;
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

    socket.on("room:user-joined", (data: { user: Participant; participants: Participant[] }) => {
      setParticipants(data.participants);
      participantsRef.current = data.participants;
      if (data.user.id !== user.id) {
        const name = getUserDisplayName(data.user);
        addSystemMessage(`${name} joined the room`);
        playNotificationSound("join");
        // Afi K personality: only the AI session owner triggers the welcome so it broadcasts once
        if (aiTutorActiveRef.current && /afi\s*k|afik/i.test(aiPersonaNameRef.current)) {
          welcomeUserRef.current?.(name);
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
      setChatMessages((prev) => [...prev, { ...msg, reactions: msg.reactions || {} }]);
      if (sidePanelTabRef.current !== "chat" && (msg as any).type !== "system" && msg.userId !== user?.id) {
        setUnreadChatBadge((prev) => prev + 1);
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
      // If we're actively watching this host, resync our iframe
      if (movieStartedByRef.current === data.hostId && typeof data.time === "number") {
        const newOffset = Math.floor(data.time);
        setMovieStartOffset(newOffset);
        setMovieSyncKey(k => k + 1);
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
      // Otherwise: another participant started a video. Leave my view alone —
      // I can choose to join from their participant tile.
    });

    socket.on("room:book", (data: { book: any | null; hostId: string | null; scrollPct: number; watchers?: string[] }) => {
      if (data.book && data.hostId) {
        if (data.hostId !== user.id) {
          setBookHostId(data.hostId);
          setSharedBook(data.book);
        }
        // Populate bookReaders from the authoritative watcher list when available
        if (data.watchers && data.watchers.length > 0) {
          setBookReaders(new Set(data.watchers));
        } else if (data.hostId !== user.id) {
          setBookReaders(prev => { const n = new Set(prev); n.add(data.hostId!); return n; });
        }
      } else if (!data.book) {
        setBookHostId(null);
        setSharedBook(null);
        setIsFollowingBook(false);
        setBookReaders(new Set());
        if (data.hostId !== user.id) {
          setShowEReader(false);
          setSelectedBook(null);
          setBookText("");
        }
      }
    });

    socket.on("room:book-scroll", (data: { scrollPct: number }) => {
      const el = bookScrollRef.current;
      if (!el) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll > 0) {
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

    // Independent playback: each user controls their own player. We intentionally
    // do NOT auto-apply remote play/pause/seek events — incoming room:youtube-state
    // events are ignored. The only way to follow the starter is the manual
    // "Sync with starter" button, which uses the time-request/respond mechanism.
    socket.on("room:youtube-state", () => { /* intentional no-op */ });

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

    socket.on("room:updated", (updatedRoom: any) => {
      if (updatedRoom && updatedRoom.id === room.id) {
        setRoomData((prev: any) => ({ ...prev, ...updatedRoom }));
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

  useEffect(() => {
    if (!socket || !user) return;
    const handleRoomDm = (msg: any) => {
      if (msg.fromId === user.id) return;
      if (msg.toId !== user.id) return;
      if (blockedIdsRef.current.has(msg.fromId) || foreverBlockedIdsRef.current.has(msg.fromId)) return;
      const fromUser = participants.find(p => p.id === msg.fromId) as User | undefined;
      if (roomDmTimerRef.current) clearTimeout(roomDmTimerRef.current);
      setRoomDmNotification({ fromId: msg.fromId, text: msg.text, fromUser });
      roomDmTimerRef.current = setTimeout(() => setRoomDmNotification(null), 7000);
      setDmUnreadCounts(prev => ({ ...prev, [msg.fromId]: (prev[msg.fromId] || 0) + 1 }));
    };
    socket.on("dm:new", handleRoomDm);
    return () => {
      socket.off("dm:new", handleRoomDm);
      if (roomDmTimerRef.current) clearTimeout(roomDmTimerRef.current);
    };
  }, [socket, user, participants]);

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
    if (sidePanelTab === "read" && readBooks.length === 0 && !readLoading) {
      loadDefaultBooks();
    }
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
      } else if (state === YT.PlayerState.PAUSED) {
        setYtIsPlaying(false);
        setYoutubeActive(false);
        try { setYtCurrentTime(player.getCurrentTime() || 0); } catch (_) {}
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

    const createPlayer = () => {
      const container = ytContainerRef.current;
      console.log("[YT] createPlayer — container:", !!container, "videoId:", activeYoutubeId);
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
            controls: 0,
            disablekb: 1,
            fs: 0,
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
                100: "Video not found or has been removed.",
                101: "The owner of this video has disabled embedded playback.",
                150: "The owner of this video has disabled embedded playback.",
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

    const YT = (window as any).YT;
    console.log("[YT] effect — YT loaded:", !!YT, "YT.Player:", !!(YT?.Player), "videoId:", activeYoutubeId);
    if (YT && YT.Player) {
      createPlayer();
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
        createPlayer();
      };
    }

    return () => {
      effectCancelled = true;
      if (youtubePlayerRef.current) {
        try { youtubePlayerRef.current.destroy(); } catch (_) {}
        youtubePlayerRef.current = null;
      }
      if (ytContainerRef.current) ytContainerRef.current.innerHTML = "";
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
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const newX = Math.max(0, Math.min(window.innerWidth - 220, dragStartRef.current.playerX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 130, dragStartRef.current.playerY + dy));
      setMiniPlayerPos({ x: newX, y: newY });
    };
    const handleMouseUp = () => { isDraggingRef.current = false; };
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

  const toggleMute = () => {
    // If the host has restricted talking and we're trying to UNMUTE, block.
    // Re-muting is always allowed (going silent never violates a restriction).
    if (isMuted && !canUseTalkControls) {
      toast({ title: "Mic locked", description: talkLockReason || "Talking is disabled in this room.", variant: "destructive" });
      return;
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
              title={(isMuted && !canUseTalkControls) ? talkLockReason : (isMuted ? "Unmute" : "Mute")}
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
            {isMuted ? "Unmute" : "Live"}
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
        <div className="hidden sm:flex flex-col items-center gap-[5px] sm:gap-[7px]">
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
        </div>

        {/* Voice preset picker */}
        <div className="flex flex-col items-center gap-[5px] sm:gap-[7px] relative">
          <div className="relative">
            {voicePickerOpen && (
              <span
                className="absolute inset-0 rounded-[14px] sm:rounded-[18px] animate-ping"
                style={{ background: "rgba(99,102,241,0.28)", animationDuration: "1.4s" }}
              />
            )}
            <button
              onClick={() => setVoicePickerOpen((v) => !v)}
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
        </div>

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
        <div className="flex flex-col items-center gap-[5px] sm:gap-[7px]">
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
        </div>

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

  useEffect(() => {
    if (!socket) return;
    const globalClearHandler = () => {
      setChatMessages([]);
      toast({ title: "Chat cleared by moderator." });
    };
    socket.on("room:chat-cleared-global", globalClearHandler);
    return () => { socket.off("room:chat-cleared-global", globalClearHandler); };
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
    if (goLivePlatform === "youtube" && !youtubeKey) { toast({ title: "Enter your YouTube stream key", variant: "destructive" }); return; }
    if (goLivePlatform === "twitch" && !twitchKey) { toast({ title: "Enter your Twitch stream key", variant: "destructive" }); return; }
    if (goLivePlatform === "both" && !twitchKey && !youtubeKey) { toast({ title: "Enter at least one stream key", variant: "destructive" }); return; }

    setGlStatus("connecting");
    setGlError(null);

    let displayStream: MediaStream;
    let micStream: MediaStream | null = null;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    } catch {
      setGlStatus("error");
      setGlError("Screen capture was denied. Please allow screen sharing to go live.");
      return;
    }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { /* mic optional */ }

    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    displayStream.getAudioTracks().forEach(t => audioCtx.createMediaStreamSource(new MediaStream([t])).connect(dest));
    if (micStream) micStream.getAudioTracks().forEach(t => audioCtx.createMediaStreamSource(new MediaStream([t])).connect(dest));
    const combined = new MediaStream([...displayStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

    let startRes: Response;
    try {
      startRes = await fetch("/api/stream/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          twitchKey: twitchKey || undefined,
          youtubeKey: youtubeKey || undefined,
          roomId: room.id,
          twitchUsername: glTwitchUsername.trim() || undefined,
          youtubeChannelId: glYoutubeChannelId.trim() || undefined,
        }),
      });
    } catch {
      setGlStatus("error");
      setGlError("Could not connect to streaming server. Try again.");
      displayStream.getTracks().forEach(t => t.stop());
      return;
    }
    if (!startRes.ok) {
      const err = await startRes.json().catch(() => ({}));
      setGlStatus("error");
      setGlError((err as any).message || "Failed to start stream.");
      displayStream.getTracks().forEach(t => t.stop());
      return;
    }
    const { streamId } = await startRes.json();
    setGlStreamId(streamId);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";
    const mr = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 2_500_000 });
    glMediaRecorderRef.current = mr;

    mr.ondataavailable = async (e) => {
      if (e.data.size === 0) return;
      const buf = await e.data.arrayBuffer();
      fetch(`/api/stream/${streamId}/chunk`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        credentials: "include",
        body: buf,
      }).catch(() => {});
    };

    mr.onstop = () => {
      displayStream.getTracks().forEach(t => t.stop());
      micStream?.getTracks().forEach(t => t.stop());
      audioCtx.close();
    };

    displayStream.getVideoTracks()[0].onended = () => stopGoLive(streamId);

    mr.start(2000);
    setGlStatus("live");
    setGlDuration(0);
    setGlViewers(null);
    glDurationRef.current = setInterval(() => setGlDuration(d => d + 1), 1000);

    const pollViewers = async () => {
      try {
        const r = await fetch(`/api/stream/${streamId}/viewers`, { credentials: "include" });
        if (r.ok) setGlViewers(await r.json());
      } catch {}
    };
    pollViewers();
    glViewerPollRef.current = setInterval(pollViewers, 30_000);
  }, [goLivePlatform, glTwitchKey, glYoutubeKey, glTwitchUsername, glYoutubeChannelId, room.id]);

  const stopGoLive = useCallback(async (sid?: string) => {
    const id = sid ?? glStreamId;
    if (glMediaRecorderRef.current && glMediaRecorderRef.current.state !== "inactive") {
      glMediaRecorderRef.current.stop();
    }
    glMediaRecorderRef.current = null;
    if (glDurationRef.current) { clearInterval(glDurationRef.current); glDurationRef.current = null; }
    if (glViewerPollRef.current) { clearInterval(glViewerPollRef.current); glViewerPollRef.current = null; }
    setGlStatus("idle");
    setGlDuration(0);
    setGlViewers(null);
    if (id) {
      setGlStreamId(null);
      fetch(`/api/stream/${id}/stop`, { method: "POST", credentials: "include" }).catch(() => {});
    }
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
    movieHostPlayingRef2.current = false;
    setMovieHostPlaying(false);
    socket?.emit("room:movie-state", { roomId: room.id, action: "pause", time: movieHostElapsedRef.current, ts: Date.now() });
  };

  const handleMoviePlay = () => {
    movieHostPlayingRef2.current = true;
    setMovieHostPlaying(true);
    const t = movieHostElapsedRef.current;
    socket?.emit("room:movie-state", { roomId: room.id, action: "play", time: t, ts: Date.now() });
    // Reload iframe from current position so host also starts fresh at this timestamp
    setMovieStartOffset(t);
    setMovieSyncKey(k => k + 1);
  };

  const handleMovieResync = () => {
    if (!movieStartedBy) return;
    const currentTime = movieCurrentTimeByHost.get(movieStartedBy);
    if (typeof currentTime === "number") {
      setMovieStartOffset(Math.floor(currentTime));
      setMovieSyncKey(k => k + 1);
    }
  };

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

  // Independent playback: play / pause / seek operate only on this user's local
  // YouTube player. Nothing is broadcast to other participants, so each user has
  // full local control without affecting anyone else.
  const handleYtPlayPause = useCallback(() => {
    const player = youtubePlayerRef.current;
    if (!player) return;
    try {
      if (ytIsPlaying) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    } catch (_) {}
  }, [ytIsPlaying]);

  const handleYtSeek = useCallback((seconds: number) => {
    const player = youtubePlayerRef.current;
    if (!player) return;
    try {
      player.seekTo(seconds, true);
      setYtCurrentTime(seconds);
    } catch (_) {}
  }, []);

  const handleYtVolume = useCallback((vol: number) => {
    const player = youtubePlayerRef.current;
    if (!player) return;
    try {
      if (vol === 0) {
        player.mute();
      } else {
        player.unMute();
        player.setVolume(vol);
      }
      setYtVolume(vol);
    } catch (_) {}
  }, []);

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

    // If clicked participant is reading and we're not yet reading, join the read session
    if (isClickingOther && bookReaders.has(peerId) && sharedBook && !showEReader) {
      handleJoinReadTogether(sharedBook);
      setSidePanelOpen(true);
      setSidePanelTab("read");
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

  const handleSendChat = (e: React.FormEvent) => {
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
    socket.emit("room:chat", {
      roomId: room.id,
      userId: user.id,
      text: chatText.trim(),
      messageColor: chatMessageColor,
      privateToId: privateChatToId === "public" ? null : privateChatToId,
      replyTo: replyingTo || undefined,
    });
    import("@/lib/sound-fx").then((s) => s.sfxSend()).catch(() => {});
    setChatText("");
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

  const handleYtSearchVR = async (query: string) => {
    if (!query.trim()) { setYtResultsVR([]); return; }
    setYtSearchingVR(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (res.ok) setYtResultsVR(await res.json());
    } finally {
      setYtSearchingVR(false);
    }
  };

  const handleYtQueryVR = (val: string) => {
    setYtQueryVR(val);
    if (ytTimeoutVR.current) clearTimeout(ytTimeoutVR.current);
    ytTimeoutVR.current = setTimeout(() => handleYtSearchVR(val), 400);
  };

  const handleEditRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

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
    if (readBooks.length > 0 || readLoading) return;
    setReadLoading(true);
    try {
      const res = await fetch(`/api/library/search`, { credentials: "include" });
      const data = await res.json();
      setReadBooks(data.books || []);
      setReadCatalog([]);
      setReadAudiobooks([]);
      setReadVideos([]);
    } catch { setReadBooks([]); } finally { setReadLoading(false); }
  };

  const searchGutenberg = async (query: string) => {
    if (!query.trim()) {
      setReadBooks([]);
      setReadCatalog([]);
      setReadAudiobooks([]);
      setReadVideos([]);
      loadDefaultBooks();
      return;
    }
    setReadLoading(true);
    try {
      const res = await fetch(`/api/library/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      const data = await res.json();
      setReadBooks(data.books || []);
      setReadCatalog(data.openLibrary || []);
      setReadAudiobooks(data.audiobooks || []);
      setReadVideos(data.videos || []);
    } catch {
      setReadBooks([]); setReadCatalog([]); setReadAudiobooks([]); setReadVideos([]);
    } finally { setReadLoading(false); }
  };

  const saveToReadingHistory = (book: any) => {
    const entry = {
      id: book.id,
      title: book.title,
      author: book.authors?.map((a: any) => a.name).join(", ") || "",
      coverUrl: book.formats?.["image/jpeg"] || null,
      lastReadAt: new Date().toISOString(),
    };
    setReadingHistory(prev => {
      const filtered = prev.filter(h => h.id !== entry.id);
      const updated = [entry, ...filtered].slice(0, 10);
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
      const formats = book.formats || {};
      const textUrl = formats["text/plain; charset=utf-8"] || formats["text/plain; charset=us-ascii"] || formats["text/plain"];
      if (!textUrl) throw new Error("No text");
      const res = await fetch(`/api/book/text?url=${encodeURIComponent(textUrl)}`);
      if (!res.ok) throw new Error("Fetch failed");
      const text = await res.text();
      const startIdx = text.indexOf("*** START OF") > -1
        ? text.indexOf("\n", text.indexOf("*** START OF")) + 1
        : text.indexOf("***\r\n\r\n") > -1 ? text.indexOf("***\r\n\r\n") + 6 : 0;
      setBookText(text.slice(startIdx, startIdx + 12000));
    } catch { setBookText("Could not load the book text. Try another title."); }
    finally { setBookLoading(false); }
  };

  const handleJoinReadTogether = async (book: any) => {
    setIsFollowingBook(true);
    setBookReaders(prev => { const n = new Set(prev); n.add(user?.id || ""); return n; });
    socket?.emit("room:book-watching", { roomId: room.id, watching: true });
    await loadBookText(book, true);
  };

  const handleCloseBook = () => {
    setSelectedBook(null);
    setBookText("");
    setWordInfo(null);
    setShowEReader(false);
    const amIBookHost = bookHostId === user?.id;
    if (amIBookHost) {
      socket?.emit("room:book", { roomId: room.id, book: null });
      setBookReaders(new Set());
      setBookHostId(null);
    } else if (isFollowingBook) {
      setIsFollowingBook(false);
      socket?.emit("room:book-watching", { roomId: room.id, watching: false });
      setBookReaders(prev => { const n = new Set(prev); n.delete(user?.id || ""); return n; });
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
          {unreadChatBadge > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center leading-none pointer-events-none" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.60), inset 0 1px 0 rgba(255,255,255,0.40)" }}>
              {unreadChatBadge > 99 ? "99+" : unreadChatBadge}
            </span>
          )}
        </div>
        <button onClick={() => setSidePanelTab("youtube")} data-testid="tab-youtube" title="YouTube" className="room-tab-btn" data-accent="youtube" data-active={sidePanelTab === "youtube"}>
          <Youtube className="w-[20px] h-[20px]" />
        </button>
        <button onClick={() => setSidePanelTab("movies")} data-testid="tab-movies" title="Movies" className="room-tab-btn" data-accent="movies" data-active={sidePanelTab === "movies"}>
          <Film className="w-[20px] h-[20px]" />
        </button>
        <button onClick={() => setSidePanelTab("read")} data-testid="tab-read" title="Read" className="room-tab-btn" data-accent="read" data-active={sidePanelTab === "read"}>
          <BookOpen className="w-[20px] h-[20px]" />
        </button>
        <button onClick={() => setSidePanelTab("chess")} data-testid="tab-chess" title="Chess" className="room-tab-btn" data-accent="chess" data-active={sidePanelTab === "chess"}>
          <Gamepad2 className="w-[20px] h-[20px]" />
        </button>
        <button onClick={() => setSidePanelTab("golive")} data-testid="tab-golive" title="Go Live" className="room-tab-btn" data-accent="golive" data-active={sidePanelTab === "golive"}>
          <Radio className="w-[20px] h-[20px]" />
        </button>
        <button onClick={() => setSidePanelTab("people")} data-testid="tab-people" title="People" className="room-tab-btn" data-accent="people" data-active={sidePanelTab === "people"}>
          <UsersRound className="w-[20px] h-[20px]" />
        </button>
      </div>

      <div className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" style={{ display: sidePanelTab === "chat" ? "flex" : "none" }}>
        {/* ── Filter row — All / @Mentions / Welcome ────────────────────── */}
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
        </div>
        {/* ── Pinned message banner ─────────────────────────────────────── */}
        {pinnedMessage && (() => {
          const pinAuthorObj = pinnedMessage.message.user || participantById.get(pinnedMessage.message.userId);
          const pinAuthorName = pinAuthorObj
            ? getUserDisplayName(pinAuthorObj)
            : (pinnedMessage.message as any).userName || "Unknown";
          const pinAuthorAvatar = pinAuthorObj?.profileImageUrl;
          const pinAuthorInitial = (pinAuthorName?.[0] || "?").toUpperCase();
          return (
            <div className="chat-pin-banner" data-testid="chat-pinned-banner">
              <div className="chat-pin-icon">📌</div>
              <div className="chat-pin-body" onClick={() => {
                const el = document.querySelector(`[data-testid="room-chat-${pinnedMessage.message.id}"]`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }}>
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
                <span className="chat-pin-text">
                  {pinnedMessage.message.text.length > 80
                    ? pinnedMessage.message.text.slice(0, 80) + "…"
                    : pinnedMessage.message.text}
                </span>
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
          <div className="px-3 py-3 space-y-1 min-h-full flex flex-col justify-end">
            {(() => {
              const displayedMessages = showMentionsOnly
                ? chatMessages.filter(msg => msg.type !== "system" && (msg as any).type !== "deleted" && isMentionedInMessage(msg.text))
                : chatMessages;
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
              displayedMessages.map((msg) => {
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
                const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "👏"];
                const isOwn = msg.userId === user?.id;

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
                return (
                  <div
                    key={msg.id}
                    className={`group chat-msg-row${isOwn ? " flex-row-reverse" : ""}`}
                    data-own={isOwn ? "true" : undefined}
                    data-new={isNew ? "true" : undefined}
                    data-testid={`room-chat-${msg.id}`}
                    onMouseEnter={() => setHoveredMsgId(msg.id)}
                    onMouseLeave={() => setHoveredMsgId(null)}
                  >
                    {/* Per-user coloured avatar ring — marginTop offsets it to align with
                        the bubble's flat corner, which sits below the name header (~19px) */}
                    <div className="relative flex-shrink-0 group/avatar" style={{ marginTop: "19px" }}>
                      <div
                        className="chat-msg-avatar-ring rounded-full"
                        style={{
                          padding: "2.5px",
                          background: rc.bg,
                          boxShadow: `-2px -2px 6px rgba(255,255,255,.06), 3px 3px 10px rgba(0,0,0,.75), 0 0 14px ${rc.glow}`,
                        }}
                      >
                        <Avatar className="w-8 h-8" style={{ border: "1.5px solid rgba(0,0,0,.55)" }}>
                          <AvatarImage src={msgUser?.profileImageUrl || undefined} alt="" />
                          <AvatarFallback className={`text-xs bg-gradient-to-br ${gradient} text-white`}>
                            {getUserInitials(msgUser)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      {/* DM quick-action badge — only for other people's messages */}
                      {!isOwn && msg.userId !== "system" && (
                        <button
                          onClick={() => {
                            setPrivateChatToId(privateChatToId === msg.userId ? "public" : msg.userId);
                            chatInputRef.current?.focus();
                          }}
                          title={privateChatToId === msg.userId ? "Stop whispering" : `Whisper to ${getUserDisplayName(msgUser)}`}
                          data-testid={`button-dm-avatar-${msg.id}`}
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/avatar:opacity-100 transition-all duration-150 scale-90 group-hover/avatar:scale-100"
                          style={{
                            background: privateChatToId === msg.userId
                              ? "linear-gradient(135deg,rgba(251,191,36,.95),rgba(194,115,10,.85))"
                              : "linear-gradient(135deg,rgba(99,102,241,.92),rgba(67,56,202,.80))",
                            border: privateChatToId === msg.userId
                              ? "1px solid rgba(251,191,36,.45)"
                              : "1px solid rgba(139,92,246,.40)",
                            borderRadius: "999px",
                            padding: "1px 5px",
                            fontSize: "8px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            color: "#fff",
                            boxShadow: "0 2px 6px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.18)",
                            whiteSpace: "nowrap",
                            lineHeight: "1.4",
                          }}
                        >
                          {privateChatToId === msg.userId ? "✓ DM" : "DM"}
                        </button>
                      )}
                    </div>

                    {/* Bubble column — name above, bubble below */}
                    <div className={`flex flex-col gap-[3px] max-w-[72%] min-w-0 ${isOwn ? "items-end" : "items-start"}`}>

                      {/* Name + time header — outside the bubble */}
                      <div className={`flex items-baseline gap-1.5 flex-wrap px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                        <span className="chat-msg-name">{getUserDisplayName(msgUser)}</span>
                        <span className="chat-msg-time">{formatTime(msg.createdAt)}</span>
                        {msg.isPrivate && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-400/40 text-amber-300" data-testid={`badge-private-message-${msg.id}`}>
                            <LockKeyhole className="w-2.5 h-2.5 mr-1" />
                            Private to {msg.privateToId === user?.id ? "you" : msg.privateToName}
                          </Badge>
                        )}
                      </div>

                      {/* Hover toolbar — emoji reactions + host/own actions only, no Reply */}
                      {hoveredMsgId === msg.id && (
                        <div
                          className="flex items-center gap-0.5 max-w-full flex-wrap"
                          style={{ background:"rgba(8,9,15,.92)", backdropFilter:"blur(14px)", border:"1px solid rgba(255,255,255,.09)", borderRadius:"10px", boxShadow:"0 4px 16px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06)", padding:"3px 5px", alignSelf: isOwn ? "flex-end" : "flex-start" }}
                        >
                          {QUICK_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReact(msg.id, emoji)}
                              className="text-sm hover:scale-125 transition-transform px-0.5 leading-none"
                              data-testid={`quick-react-${msg.id}-${emoji}`}
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                          {(isHost || participantRoles[user?.id || ""] === "co-owner") && msg.type !== "system" && (msg as any).type !== "deleted" && (
                            <button
                              onClick={() => {
                                if (pinnedMessage?.message?.id === msg.id) {
                                  socket?.emit("room:unpin-message", { roomId: room.id });
                                } else {
                                  socket?.emit("room:pin-message", {
                                    roomId: room.id,
                                    message: msg,
                                    pinnedBy: user?.id,
                                    pinnedByName: getUserDisplayName(user) || "Host",
                                  });
                                }
                              }}
                              className="ml-0.5 text-[10px] px-1 py-0.5 rounded transition-colors"
                              style={pinnedMessage?.message?.id === msg.id
                                ? { color: "rgba(251,191,36,.90)", background: "rgba(251,191,36,.12)" }
                                : { color: "rgba(255,255,255,.38)", background: "transparent" }
                              }
                              title={pinnedMessage?.message?.id === msg.id ? "Unpin message" : "Pin message"}
                              data-testid={`button-pin-${msg.id}`}
                            >
                              📌
                            </button>
                          )}
                          {isOwn && msg.type !== "deleted" && (msg as any).type !== "system" && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingMsgId(msg.id);
                                  setEditingText(msg.text);
                                  setHoveredMsgId(null);
                                }}
                                className="ml-0.5 text-[10px] text-blue-300 hover:text-white px-1 py-0.5 rounded hover:bg-blue-500/20 transition-colors flex items-center gap-1"
                                title="Edit"
                                data-testid={`button-edit-${msg.id}`}
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              <button
                                onClick={() => {
                                  socket?.emit("room:chat-delete", { roomId: room.id, messageId: msg.id, deletedBy: user!.id });
                                  setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, text: "This message was deleted.", type: "deleted" as any, reactions: {}, replyTo: null } : m));
                                }}
                                className="ml-0.5 text-[10px] text-destructive hover:text-white px-1 py-0.5 rounded hover:bg-destructive transition-colors flex items-center gap-1"
                                title="Delete"
                                data-testid={`button-delete-${msg.id}`}
                              >
                                <Trash2 className="w-3 h-3" /> Del
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* The actual bubble */}
                      <div className="chat-msg-card" data-own={isOwn ? "true" : undefined}>
                        {msg.replyTo && (
                          <div className="chat-reply-chip" data-testid={`reply-chip-${msg.id}`}>
                            <span className="chat-reply-chip-arrow">↩</span>
                            <span className="chat-reply-chip-name">{msg.replyTo.userName}</span>
                          </div>
                        )}
                        {editingMsgId === msg.id ? (
                          <div className="flex flex-col gap-1.5 mt-0.5">
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
                              <span className="text-white/20">↵ Enter to save · Esc to cancel</span>
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
                        {/* Reply button — embedded at the bottom of the bubble, visible on hover */}
                        {hoveredMsgId === msg.id && msg.type !== "deleted" && (msg as any).type !== "system" && (
                          <div className={`flex mt-1.5 ${isOwn ? "justify-start" : "justify-end"}`}>
                            <button
                              onClick={() => {
                                setReplyingTo({
                                  id: msg.id,
                                  userId: msg.userId,
                                  userName: getUserDisplayName(msgUser) || "Unknown",
                                  text: msg.text,
                                });
                                chatInputRef.current?.focus();
                              }}
                              className="chat-reply-inline-btn"
                              data-testid={`button-reply-${msg.id}`}
                            >
                              ↩ Reply
                            </button>
                          </div>
                        )}
                        {hasReactions && (
                          <div className="flex flex-wrap gap-1 mt-1.5" data-testid={`reactions-${msg.id}`}>
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
                                  <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                                    <p className="font-medium mb-0.5">{tooltip.heading}</p>
                                    <p className="text-muted-foreground">{tooltip.names}</p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* Reply hover panel — full quoted text, shown on hover */}
                      {msg.replyTo && hoveredMsgId === msg.id && (
                        <div
                          className={`chat-reply-hover-panel ${isOwn ? "items-end" : "items-start"}`}
                          data-own={isOwn ? "true" : undefined}
                          data-testid={`reply-hover-panel-${msg.id}`}
                        >
                          <div className="chat-reply-hover-inner">
                            <span className="chat-reply-hover-name">↩ {msg.replyTo.userName}</span>
                            <div className="chat-reply-hover-body" data-testid={`reply-hover-text-${msg.id}`}>
                              {renderReplyPreview(msg.replyTo.text)}
                            </div>
                          </div>
                        </div>
                      )}

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

                  </div>
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
              maxLength={isTroll ? TROLL_MAX_CHARS : undefined}
            />
            {isTroll && (
              <div
                className="absolute bottom-1.5 right-10 text-[9px] font-bold tabular-nums pointer-events-none"
                style={{ color: chatText.length >= TROLL_MAX_CHARS ? "rgb(248,113,113)" : chatText.length >= TROLL_MAX_CHARS * 0.8 ? "rgb(253,224,71)" : "rgba(255,255,255,0.25)" }}
              >
                {chatText.length}/{TROLL_MAX_CHARS}
              </div>
            )}
          </div>

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
                    <span className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: chatMessageColor, boxShadow: `0 0 6px ${chatMessageColor}55, inset 0 1px 0 rgba(255,255,255,0.4)` }} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="chat-color-pop w-60 p-3" side="top" align="start">
                  <div className="chat-color-pop-inner">
                    <div className="chat-color-pop-head">
                      <span className="chat-color-pop-title">Message color</span>
                      <span
                        className="chat-color-pop-preview"
                        style={{
                          color: chatMessageColor,
                          textShadow: `0 0 10px ${chatMessageColor}66`,
                        }}
                        aria-hidden="true"
                      >
                        Aa
                      </span>
                    </div>
                    <div className="chat-color-grid" role="radiogroup" aria-label="Chat color">
                      {["#e5e7eb", "#22d3ee", "#a78bfa", "#facc15", "#fb7185", "#4ade80", "#f97316", "#60a5fa", "#f0abfc", "#ffffff", "#c084fc", "#2dd4bf"].map((color) => {
                        const selected = chatMessageColor === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setChatMessageColor(color)}
                            className={`chat-color-swatch ${selected ? "is-selected" : ""}`}
                            style={{
                              ["--swatch" as any]: color,
                              backgroundColor: color,
                            }}
                            data-testid={`button-chat-color-${color.replace("#", "")}`}
                            aria-label={`Set chat color ${color}`}
                          >
                            {selected && (
                              <svg viewBox="0 0 12 12" className="chat-color-check" aria-hidden="true">
                                <path d="M2.5 6.2 L5 8.7 L9.5 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <GifPickerButton onGifSelect={(gifUrl) => {
                if (socket && user) {
                  socket.emit("room:chat", {
                    roomId: room.id,
                    userId: user.id,
                    text: `[gif:${gifUrl}]`,
                    messageColor: chatMessageColor,
                    privateToId: privateChatToId === "public" ? null : privateChatToId,
                    replyTo: replyingTo || undefined,
                  });
                  setReplyingTo(null);
                }
              }} />
              <ImageUploadButton onImageSelect={(imgUrl) => {
                if (socket && user) {
                  socket.emit("room:chat", {
                    roomId: room.id,
                    userId: user.id,
                    text: `[img:${imgUrl}]`,
                    messageColor: chatMessageColor,
                    privateToId: privateChatToId === "public" ? null : privateChatToId,
                    replyTo: replyingTo || undefined,
                  });
                  setReplyingTo(null);
                }
              }} />
            </div>
            <button
              type="submit"
              disabled={!chatText.trim()}
              data-testid="button-send-room-chat"
              data-ready={chatText.trim() ? "true" : undefined}
              className="room-send-btn"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
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

        {selectedBook && showEReader ? (
          <div className="flex flex-col flex-1 min-h-0 p-3 gap-3">
            <div className="p-3 rounded-xl border space-y-3">
              <div className="flex items-start gap-2">
                {selectedBook.formats?.["image/jpeg"] ? (
                  <img loading="lazy" decoding="async" src={selectedBook.formats["image/jpeg"]} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0 bg-muted" />
                ) : (
                  <div className="w-10 h-14 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-tight line-clamp-2">{selectedBook.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {selectedBook.authors?.map((a: any) => a.name).join(", ")}
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
            <div className="p-3 pb-2 border-b flex-shrink-0 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={readSearch}
                    onChange={(e) => setReadSearch(e.target.value)}
                    placeholder="Search by title, author, or topic…"
                    className="pl-8 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") searchGutenberg(readSearch); }}
                  />
                </div>
                <Button size="sm" onClick={() => searchGutenberg(readSearch)} disabled={readLoading || !readSearch.trim()}>
                  {readLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["English", "Mystery", "Romance", "Self-help", "History", "Science", "Philosophy", "Adventure"].map(genre => (
                  <button
                    key={genre}
                    onClick={() => { setReadSearch(genre); searchGutenberg(genre); }}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border/60 bg-muted/30 hover:bg-muted/70 hover:border-border transition-colors"
                    data-testid={`chip-genre-${genre.toLowerCase()}`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-2">
                {readLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {/* Reading History */}
                {readingHistory.length > 0 && !readSearch.trim() && readBooks.length === 0 && !readLoading && (
                  <div className="space-y-1.5 pb-2" data-testid="section-reading-history">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Recently Read
                      </p>
                      <button
                        onClick={() => { setReadingHistory([]); try { localStorage.removeItem("vextorn_reading_history"); } catch {} }}
                        className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      >Clear</button>
                    </div>
                    {readingHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 opacity-80 hover:opacity-100 transition-opacity">
                        {h.coverUrl ? (
                          <img loading="lazy" decoding="async" src={h.coverUrl} alt="" className="w-8 h-11 rounded object-cover flex-shrink-0 bg-muted" />
                        ) : (
                          <div className="w-8 h-11 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium line-clamp-2 leading-tight">{h.title}</p>
                          {h.author && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{h.author}</p>}
                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">{new Date(h.lastReadAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                    <button onClick={loadDefaultBooks} className="text-[11px] text-primary hover:underline w-full text-center pt-1" data-testid="link-browse-new">Browse new books →</button>
                  </div>
                )}

                {readBooks.length === 0 && readCatalog.length === 0 && readAudiobooks.length === 0 && readVideos.length === 0 && !readLoading && readingHistory.length === 0 && (
                  <div className="text-center py-8 space-y-2 text-muted-foreground">
                    <BookOpen className="w-8 h-8 mx-auto opacity-30" />
                    <p className="text-xs">No matches. Try a different search.</p>
                    <button onClick={loadDefaultBooks} className="text-xs text-primary hover:underline" data-testid="link-browse-bestsellers">Browse bestsellers</button>
                  </div>
                )}
                {readBooks.length > 0 && !readSearch.trim() && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-1">📚 Free Classics (Project Gutenberg)</p>
                )}
                {readBooks.length > 0 && readSearch.trim() && (
                  <p className="text-[10px] font-semibold text-emerald-400/90 uppercase tracking-wide px-1 pb-1 flex items-center gap-1" data-testid="text-section-free">
                    <BookOpen className="w-3 h-3" /> Read free now
                  </p>
                )}
                {readBooks.map((book: any) => (
                  <button
                    key={book.id}
                    onClick={() => loadBookText(book)}
                    className="w-full flex items-start gap-2 p-2 rounded-lg border hover:bg-muted/50 text-left transition-colors"
                    data-testid={`button-book-${book.id}`}
                  >
                    {book.formats?.["image/jpeg"] ? (
                      <img loading="lazy" decoding="async" src={book.formats["image/jpeg"]} alt="" className="w-12 h-16 rounded object-cover flex-shrink-0 bg-muted" />
                    ) : (
                      <div className="w-12 h-16 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold line-clamp-2">{book.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {book.authors?.map((a: any) => a.name).join(", ")}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {book.download_count?.toLocaleString()} downloads
                      </p>
                    </div>
                  </button>
                ))}

                {readSearch.trim() && readBooks.length === 0 && (readCatalog.length > 0 || readAudiobooks.length > 0 || readVideos.length > 0) && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-amber-200/90" data-testid="text-no-free-text">
                    No free full text for "<strong>{readSearch}</strong>" — here are some related audiobooks, videos, and catalog matches you can open in a new tab.
                  </div>
                )}

                {readAudiobooks.length > 0 && (
                  <div className="space-y-1.5 pt-2" data-testid="section-audiobooks">
                    <p className="text-[10px] font-semibold uppercase tracking-wide px-1 flex items-center gap-1" style={{ color: "hsla(var(--neu-orange-hi) / 0.92)" }}>
                      <Volume1 className="w-3 h-3" /> Free audiobooks (LibriVox)
                    </p>
                    {readAudiobooks.map((a: any) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                        data-testid={`link-audiobook-${a.id}`}
                      >
                        <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: "hsla(var(--neu-orange) / 0.16)", border: "1px solid hsla(var(--neu-orange) / 0.30)" }}>
                          <Volume1 className="w-5 h-5" style={{ color: "hsla(var(--neu-orange-hi) / 0.92)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold line-clamp-2">{a.title}</p>
                          {a.author && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{a.author}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {a.runtime ? `${a.runtime} • ` : ""}Listen on LibriVox
                          </p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1" />
                      </a>
                    ))}
                  </div>
                )}

                {readVideos.length > 0 && (
                  <div className="space-y-1.5 pt-2" data-testid="section-videos">
                    <p className="text-[10px] font-semibold text-red-400/90 uppercase tracking-wide px-1 flex items-center gap-1">
                      <Tv className="w-3 h-3" /> Watch on YouTube
                    </p>
                    {readVideos.map((v: any) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSidePanelTab("youtube");
                          handleSelectYoutubeVideo(v.id);
                        }}
                        className="w-full flex items-start gap-2 p-2 rounded-lg border hover:bg-muted/50 text-left transition-colors"
                        data-testid={`button-video-${v.id}`}
                      >
                        {v.thumbnail ? (
                          <img loading="lazy" decoding="async" src={v.thumbnail} alt="" className="w-16 h-10 rounded object-cover flex-shrink-0 bg-muted" />
                        ) : (
                          <div className="w-16 h-10 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                            <Tv className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold line-clamp-2">{v.title}</p>
                          {v.channel && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{v.channel}</p>}
                          <p className="text-[10px] text-red-400/80 mt-0.5">▶ Play in room</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {readCatalog.length > 0 && (
                  <div className="space-y-1.5 pt-2" data-testid="section-catalog">
                    <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide px-1 flex items-center gap-1">
                      {readSearch.trim() ? <><BookOpen className="w-3 h-3" /> More from Open Library</> : <><TrendingUp className="w-3 h-3" /> Trending This Week</>}
                    </p>
                    {readCatalog.map((c: any) => (
                      <a
                        key={c.key}
                        href={c.openLibraryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                        data-testid={`link-catalog-${c.key?.replace(/\W/g, '')}`}
                      >
                        {c.coverUrl ? (
                          <img loading="lazy" decoding="async" src={c.coverUrl} alt="" className="w-12 h-16 rounded object-cover flex-shrink-0 bg-muted" />
                        ) : (
                          <div className="w-12 h-16 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold line-clamp-2">{c.title}</p>
                          {c.author && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.author}</p>}
                          {c.year && <p className="text-[10px] text-muted-foreground mt-0.5">{c.year}</p>}
                        </div>
                        <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" style={{ display: sidePanelTab === "chess" ? "flex" : "none" }}>
        {user?.id && socket && (
          <Suspense fallback={null}>
            <ChessPanel socket={socket} roomId={room.id} userId={user.id} participants={participants} />
          </Suspense>
        )}
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
                  {glViewers.twitch === null && glViewers.youtube === null && (
                    <span className="text-[9px] text-muted-foreground/50">Viewer counts unavailable — add username below to enable</span>
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

          {/* Platform tabs */}
          {glStatus === "idle" || glStatus === "error" ? (
            <>
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                {(["youtube", "twitch", "both"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setGoLivePlatform(p)}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150"
                    style={goLivePlatform === p
                      ? { background: p === "youtube" ? "rgba(239,68,68,0.22)" : p === "twitch" ? "rgba(145,70,255,0.22)" : "rgba(80,160,80,0.22)", color: p === "youtube" ? "#fc6464" : p === "twitch" ? "#bf94ff" : "#6ee86e", border: "1px solid " + (p === "youtube" ? "rgba(239,68,68,0.30)" : p === "twitch" ? "rgba(145,70,255,0.30)" : "rgba(80,200,80,0.30)") }
                      : { color: "rgba(255,255,255,0.38)", border: "1px solid transparent" }
                    }
                  >
                    {p === "both" ? "Both 🔗" : p === "youtube" ? "YouTube" : "Twitch"}
                  </button>
                ))}
              </div>

              {/* Stream key inputs */}
              <div className="space-y-2">
                {(goLivePlatform === "youtube" || goLivePlatform === "both") && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="vr-go-live-yt-key-a" className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">YouTube Stream Key</label>
                      <a href="https://studio.youtube.com/channel/UC/livestreaming" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5">Get key <ExternalLink className="w-2.5 h-2.5" /></a>
                    </div>
                    <div className="relative">
                      <input
                        id="vr-go-live-yt-key-a"
                        type={glShowYoutubeKey ? "text" : "password"}
                        value={glYoutubeKey}
                        onChange={e => setGlYoutubeKey(e.target.value)}
                        placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                        className="w-full px-2.5 py-1.5 pr-8 rounded-lg text-xs bg-white/[0.05] border border-white/[0.10] text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/50"
                      />
                      <button onClick={() => setGlShowYoutubeKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60" aria-label={glShowYoutubeKey ? "Hide YouTube stream key" : "Show YouTube stream key"}>
                        {glShowYoutubeKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
                {(goLivePlatform === "twitch" || goLivePlatform === "both") && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="vr-go-live-tw-key-a" className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">Twitch Stream Key</label>
                      <a href="https://dashboard.twitch.tv/settings/stream" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5">Get key <ExternalLink className="w-2.5 h-2.5" /></a>
                    </div>
                    <div className="relative">
                      <input
                        id="vr-go-live-tw-key-a"
                        type={glShowTwitchKey ? "text" : "password"}
                        value={glTwitchKey}
                        onChange={e => setGlTwitchKey(e.target.value)}
                        placeholder="live_xxxxxxxxxxxxxxxxxxxx"
                        className="w-full px-2.5 py-1.5 pr-8 rounded-lg text-xs bg-white/[0.05] border border-white/[0.10] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
                      />
                      <button onClick={() => setGlShowTwitchKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60" aria-label={glShowTwitchKey ? "Hide Twitch stream key" : "Show Twitch stream key"}>
                        {glShowTwitchKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional viewer count usernames */}
              <div className="space-y-1.5">
                {(goLivePlatform === "youtube" || goLivePlatform === "both") && (
                  <div>
                    <label htmlFor="vr-go-live-yt-channel-a" className="text-[9px] font-semibold text-white/40 uppercase tracking-wide">YouTube Channel ID <span className="normal-case font-normal">(optional · for live viewer count)</span></label>
                    <input
                      id="vr-go-live-yt-channel-a"
                      type="text"
                      value={glYoutubeChannelId}
                      onChange={e => setGlYoutubeChannelId(e.target.value)}
                      placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/40"
                    />
                  </div>
                )}
                {(goLivePlatform === "twitch" || goLivePlatform === "both") && (
                  <div>
                    <label htmlFor="vr-go-live-tw-user-a" className="text-[9px] font-semibold text-white/40 uppercase tracking-wide">Twitch Username <span className="normal-case font-normal">(optional · for live viewer count)</span></label>
                    <input
                      id="vr-go-live-tw-user-a"
                      type="text"
                      value={glTwitchUsername}
                      onChange={e => setGlTwitchUsername(e.target.value)}
                      placeholder="yourchannelname"
                      className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40"
                    />
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wide">How it works</p>
                {[
                  "Paste your stream key(s) above",
                  "Click Go Live — browser captures this tab",
                  "Your room streams directly to the platform(s)",
                  "Click End when you're done",
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white/50">{i + 1}</span>
                    <p className="text-[11px] text-muted-foreground leading-snug">{t}</p>
                  </div>
                ))}
              </div>

              {/* Go Live button */}
              <button
                onClick={startGoLive}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
                style={{
                  background: goLivePlatform === "twitch"
                    ? "linear-gradient(135deg,rgba(145,70,255,0.85),rgba(100,40,200,0.85))"
                    : goLivePlatform === "youtube"
                      ? "linear-gradient(135deg,rgba(239,68,68,0.85),rgba(180,30,30,0.85))"
                      : "linear-gradient(135deg,rgba(239,68,68,0.75),rgba(145,70,255,0.75))",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                <Radio className="w-4 h-4" /> Go Live
              </button>
            </>
          ) : glStatus === "connecting" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-red-400" />
              <p className="text-sm text-muted-foreground">Connecting to stream server…</p>
            </div>
          ) : null}
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
    <div className="flex h-full relative overflow-hidden" style={getRoomThemeStyle(currentTheme)}>
      <RoomThemeOverlay themeId={currentTheme} />

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

          {(glStatus === "idle" || glStatus === "error") && (<>
            {/* Platform selector */}
            <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border">
              {(["youtube", "twitch", "both"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setGoLivePlatform(p)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${goLivePlatform === p ? (p === "youtube" ? "bg-red-600/20 text-red-400 border border-red-600/30" : p === "twitch" ? "bg-purple-600/20 text-purple-400 border border-purple-600/30" : "bg-green-600/15 text-green-400 border border-green-600/25") : "text-muted-foreground hover:text-foreground"}`}
                >
                  {p === "both" ? "Both 🔗" : p === "youtube" ? "YouTube" : "Twitch"}
                </button>
              ))}
            </div>

            {/* Stream key fields */}
            <div className="space-y-3">
              {(goLivePlatform === "youtube" || goLivePlatform === "both") && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="vr-go-live-yt-key-b" className="text-xs font-semibold text-red-400">YouTube Stream Key</label>
                    <a href="https://studio.youtube.com/channel/UC/livestreaming" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-0.5">
                      Get key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      id="vr-go-live-yt-key-b"
                      type={glShowYoutubeKey ? "text" : "password"}
                      value={glYoutubeKey}
                      onChange={e => setGlYoutubeKey(e.target.value)}
                      placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                      className="w-full px-3 py-2 pr-9 rounded-lg text-sm bg-background border focus:outline-none focus:ring-1 focus:ring-red-500/50 placeholder:text-muted-foreground/40"
                    />
                    <button onClick={() => setGlShowYoutubeKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={glShowYoutubeKey ? "Hide YouTube stream key" : "Show YouTube stream key"}>
                      {glShowYoutubeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
              {(goLivePlatform === "twitch" || goLivePlatform === "both") && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="vr-go-live-tw-key-b" className="text-xs font-semibold text-purple-400">Twitch Stream Key</label>
                    <a href="https://dashboard.twitch.tv/settings/stream" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-0.5">
                      Get key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      id="vr-go-live-tw-key-b"
                      type={glShowTwitchKey ? "text" : "password"}
                      value={glTwitchKey}
                      onChange={e => setGlTwitchKey(e.target.value)}
                      placeholder="live_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 pr-9 rounded-lg text-sm bg-background border focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder:text-muted-foreground/40"
                    />
                    <button onClick={() => setGlShowTwitchKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={glShowTwitchKey ? "Hide Twitch stream key" : "Show Twitch stream key"}>
                      {glShowTwitchKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Optional viewer count fields */}
            <div className="space-y-2">
              {(goLivePlatform === "youtube" || goLivePlatform === "both") && (
                <div className="space-y-1">
                  <label htmlFor="vr-go-live-yt-channel-b" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">YouTube Channel ID <span className="normal-case font-normal">(optional — enables live viewer count)</span></label>
                  <input
                    id="vr-go-live-yt-channel-b"
                    type="text"
                    value={glYoutubeChannelId}
                    onChange={e => setGlYoutubeChannelId(e.target.value)}
                    placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 rounded-lg text-sm bg-background border focus:outline-none focus:ring-1 focus:ring-red-500/40 placeholder:text-muted-foreground/40"
                  />
                </div>
              )}
              {(goLivePlatform === "twitch" || goLivePlatform === "both") && (
                <div className="space-y-1">
                  <label htmlFor="vr-go-live-tw-user-b" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Twitch Username <span className="normal-case font-normal">(optional — enables live viewer count)</span></label>
                  <input
                    id="vr-go-live-tw-user-b"
                    type="text"
                    value={glTwitchUsername}
                    onChange={e => setGlTwitchUsername(e.target.value)}
                    placeholder="yourchannelname"
                    className="w-full px-3 py-2 rounded-lg text-sm bg-background border focus:outline-none focus:ring-1 focus:ring-purple-500/40 placeholder:text-muted-foreground/40"
                  />
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="p-3 rounded-xl bg-muted/30 border space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">How it works — no software needed</p>
              {["Paste your stream key(s) above", "Click Go Live — your browser captures this tab", "Your room streams directly to the platform(s)", "Click End Stream when you're done"].map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-primary">{i + 1}</span>
                  <p className="text-xs text-muted-foreground">{t}</p>
                </div>
              ))}
            </div>

            <Button
              className="w-full font-bold text-white"
              style={{
                background: goLivePlatform === "twitch"
                  ? "linear-gradient(135deg,#9146ff,#6523b0)"
                  : goLivePlatform === "youtube"
                    ? "linear-gradient(135deg,#ef4444,#b91c1c)"
                    : "linear-gradient(135deg,#ef4444 0%,#9146ff 100%)",
              }}
              onClick={startGoLive}
            >
              <Radio className="w-4 h-4 mr-2" /> Go Live
            </Button>
          </>)}

          {glStatus === "connecting" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Connecting to stream server…</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>🎨 Room Theme</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Choose a visual theme for your room. All participants will see it.</p>
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Selected</span>
              <span className="text-xs font-medium text-foreground" data-testid="text-theme-dialog-selected">
                {ROOM_THEMES.find((t) => t.id === editRoomTheme)?.label || "Default"}
              </span>
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
                {ROOM_THEMES.slice(themeDialogOffset, themeDialogOffset + 4).map((theme) => (
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
                onClick={() => setThemeDialogOffset((o) => Math.min(Math.max(0, ROOM_THEMES.length - 4), o + 4))}
                disabled={themeDialogOffset + 4 >= ROOM_THEMES.length}
                className="flex-shrink-0 w-7 h-12 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                data-testid="button-theme-dialog-next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center gap-1">
              {Array.from({ length: Math.ceil(ROOM_THEMES.length / 4) }).map((_, i) => (
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

      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setDeleteRoomOpen(false); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit Room Settings</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditRoomSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-room-title">Room Name</Label>
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
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={editLanguage} onValueChange={setEditLanguage}>
                  <SelectTrigger data-testid="select-edit-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={editLevel} onValueChange={setEditLevel}>
                  <SelectTrigger data-testid="select-edit-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Participants</Label>
              <NeuParticipantSlider
                value={editMaxUsers}
                onChange={setEditMaxUsers}
                testId="slider-edit-max-users"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Card Theme</Label>
                <span className="text-xs text-muted-foreground" data-testid="text-edit-theme-selected">
                  {ROOM_THEMES.find((t) => t.id === editRoomTheme)?.label || "Default"}
                </span>
              </div>
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
                  {ROOM_THEMES.slice(editThemeOffset, editThemeOffset + 4).map((theme) => (
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
                  onClick={() => setEditThemeOffset((o) => Math.min(Math.max(0, ROOM_THEMES.length - 4), o + 4))}
                  disabled={editThemeOffset + 4 >= ROOM_THEMES.length}
                  className="flex-shrink-0 w-7 h-12 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-edit-theme-next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-center gap-1">
                {Array.from({ length: Math.ceil(ROOM_THEMES.length / 4) }).map((_, i) => (
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

            <div className="flex items-center justify-between">
              <Label htmlFor="edit-public-toggle">Public Room</Label>
              <Switch
                id="edit-public-toggle"
                data-testid="switch-edit-public"
                checked={editIsPublic}
                onCheckedChange={setEditIsPublic}
                className="neu-switch"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary/80" />
                  Card Media
                  <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>
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
                    <video
                      src={editHologramUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-14 h-14 rounded-md object-cover border-2 border-primary/60"
                      data-testid="video-edit-card-media-preview"
                    />
                  ) : (
                    <img
                      src={editHologramUrl}
                      alt="Selected media"
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-md object-cover border-2 border-primary/60"
                      data-testid="img-edit-card-media-preview"
                    />
                  )
                ) : (
                  <div className="w-14 h-14 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                    {editHologramUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Empty"}
                  </div>
                )}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <GifPickerButton
                    onGifSelect={(url) => { setEditHologramUrl(url); setEditHologramKind("gif"); }}
                  />
                  <button
                    type="button"
                    onClick={() => editHologramFileRef.current?.click()}
                    disabled={editHologramUploading}
                    className="neu-upload-btn flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50"
                    data-testid="button-upload-edit-card-media"
                  >
                    {editHologramUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
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
                Pick a GIF, upload your own picture / short video, or tap Clear to remove the current card background (including any YouTube link).
              </p>
            </div>

            {/* Smart neumorphic Host Controls panel — one tap cycles each tile */}
            <div className="host-perm-section">
              <div className="host-perm-section-head">
                <span className="host-perm-section-title">
                  <span className="host-perm-section-icon"><Shield className="w-3.5 h-3.5" /></span>
                  <span>Host Controls</span>
                </span>
                <span className="host-perm-section-hint">Tap a tile to change</span>
              </div>
              <div className="host-perm-grid">
                <PermTile
                  label="Mic"
                  Icon={Mic}
                  value={editTalkPermission}
                  onChange={(v) => setEditTalkPermission(v as any)}
                  withMuted
                  testId="tile-perm-talk"
                />
                <PermTile
                  label="Camera"
                  Icon={Video}
                  value={editCameraPermission}
                  onChange={(v) => setEditCameraPermission(v as any)}
                  testId="tile-perm-camera"
                />
                <PermTile
                  label="Screen"
                  Icon={MonitorPlay}
                  value={editScreenPermission}
                  onChange={(v) => setEditScreenPermission(v as any)}
                  testId="tile-perm-screen"
                />
                <PermTile
                  label="YouTube"
                  Icon={Youtube}
                  value={editYoutubePermission}
                  onChange={(v) => setEditYoutubePermission(v as any)}
                  testId="tile-perm-youtube"
                />
                <PermTile
                  label="Chat"
                  Icon={MessageSquare}
                  value={editChatPermission}
                  onChange={(v) => setEditChatPermission(v as any)}
                  testId="tile-perm-chat"
                />
              </div>
              <div className="host-perm-section-foot">
                <Megaphone className="w-3.5 h-3.5 host-perm-section-foot-icon" />
                <span>Each change is announced in the room chat so everyone sees the new rules.</span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!editTitle.trim() || updateRoomMutation.isPending}
              data-testid="button-submit-edit-room"
            >
              {updateRoomMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-destructive/20">
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
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h2
                    className="font-extrabold text-[14px] truncate"
                    style={{
                      color: "rgba(255,255,255,0.95)",
                      letterSpacing: "-0.025em",
                      lineHeight: 1.2,
                      textShadow: "0 1px 8px rgba(140,100,255,0.25), 0 0 24px rgba(100,60,220,0.15)",
                    }}
                    data-testid="text-voice-room-title"
                  >
                    {room.title}
                  </h2>
                  {isHost && (
                    <span
                      className="flex-shrink-0 text-[8px] font-black px-[7px] py-[3px] rounded-[6px] tracking-[0.12em] uppercase"
                      style={{
                        background: "linear-gradient(135deg, hsl(var(--neu-orange) / 0.28) 0%, hsl(var(--neu-orange) / 0.16) 100%)",
                        color: "hsl(var(--neu-orange-hi) / 1)",
                        border: "1px solid hsl(var(--neu-orange) / 0.50)",
                        boxShadow: [
                          "0 0 10px hsl(var(--neu-orange) / 0.30)",
                          "0 0 20px hsl(var(--neu-orange) / 0.14)",
                          "inset 0 1px 0 rgba(255,240,200,0.22)",
                          "inset 0 -1px 0 rgba(0,0,0,0.35)",
                        ].join(", "),
                      }}
                    >
                      HOST
                    </span>
                  )}
                  {talkBadge && (() => {
                    const TalkIcon = talkBadge.icon;
                    const toneClass = talkBadge.tone ? ` talk-mode-badge--${talkBadge.tone}` : "";
                    return (
                      <span
                        className={`talk-mode-badge${toneClass}`}
                        title={talkLockReason || talkBadge.label}
                        data-testid="badge-talk-mode"
                      >
                        <TalkIcon className="w-[9px] h-[9px]" />
                        {talkBadge.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Metadata row */}
                <div className="flex items-center gap-[5px] mt-[3px]">
                  <span
                    className="text-[10px] font-semibold tracking-wide"
                    style={{ color: "rgba(180,160,255,0.75)" }}
                  >
                    {room.language}
                  </span>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.15)", flexShrink: 0, display: "inline-block" }} />
                  <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>{room.level}</span>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.15)", flexShrink: 0, display: "inline-block" }} />
                  <span
                    className="text-[10px] font-semibold tabular-nums"
                    style={{ color: "rgba(100,220,160,0.70)" }}
                  >
                    {participants.length}<span style={{ color: "rgba(255,255,255,0.22)" }}>/{room.maxUsers === 0 ? "∞" : room.maxUsers}</span>
                  </span>
                </div>
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
                  {unreadChatBadge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center leading-none pointer-events-none z-10" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.6), inset 0 1px 0 rgba(255,255,255,0.3)" }}>
                      {unreadChatBadge > 99 ? "99+" : unreadChatBadge}
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

        <div className="flex-1 flex flex-col overflow-hidden relative" style={{ paddingBottom: ((activeYoutubeId && showYoutube) || (activeMovieId && showMovie) || showEReader || isScreenSharing || !!remoteScreenShareUserId || !!remoteVideoUserId || (isVideoOn && !miniCameraMode)) ? 210 : 0 }}>

          {focusedUserId && !(activeYoutubeId && showYoutube) && !showEReader && !isScreenSharing && !remoteScreenShareUserId && (!isVideoOn || miniCameraMode) && !remoteVideoUserId && (
            <div className="flex-1 min-h-0 relative flex items-center justify-center p-4 cursor-pointer" onClick={() => { setFocusedUserId(null); setMiniCameraMode(false); setMiniPlayerMode(false); }}>
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
          )}

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
              className="bg-black relative flex flex-col overflow-hidden"
              style={moviePlayerHeight ? { height: moviePlayerHeight, flexShrink: 0 } : { flex: 1, minHeight: 0 }}
              data-testid="media-main-movie"
            >
              {/* Always-visible close X for non-host watchers */}
              {user?.id !== movieStartedBy && (
                <button
                  onClick={() => { setShowMovie(false); setActiveMovieId(null); setMovieStartedBy(null); socket?.emit("room:movie-watching", { roomId: room.id, hostId: movieStartedBy, watching: false }); }}
                  className="absolute top-2 right-2 z-30 w-7 h-7 rounded-full bg-black/70 hover:bg-red-500/80 text-white flex items-center justify-center border border-white/20 shadow-md transition-colors"
                  data-testid="button-close-movie-self"
                  title="Close movie (just for me)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Title bar — revealed on hover */}
              <div
                className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5 opacity-0 hover:opacity-100 transition-opacity duration-200"
                style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)" }}
              >
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-violet-400" />
                  <span className="text-white text-sm font-semibold truncate max-w-xs">{activeMovieTitle}</span>
                  {movieStartedBy && movieStartedBy !== user?.id && (() => {
                    const host = movieStartedBy ? participantById.get(movieStartedBy) : undefined;
                    return host ? (
                      <span className="text-white/50 text-xs">shared by {getUserDisplayName(host)}</span>
                    ) : null;
                  })()}
                </div>
                {user?.id === movieStartedBy ? (
                  <button
                    onClick={handleStopMovie}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/80 hover:bg-red-500 text-white text-xs font-medium transition-colors"
                    data-testid="button-stop-movie-main"
                  >
                    <StopCircle className="w-3 h-3" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowMovie(false); setActiveMovieId(null); setMovieStartedBy(null); socket?.emit("room:movie-watching", { roomId: room.id, hostId: movieStartedBy, watching: false }); }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-medium transition-colors"
                    data-testid="button-hide-movie-main"
                  >
                    <X className="w-3 h-3" /> Hide
                  </button>
                )}
              </div>
              {/* Internet Archive embed — confirmed embeddable, no Cloudflare blocking */}
              <iframe
                key={`${activeMovieId}_${movieStartOffset}_${movieSyncKey}`}
                src={`https://archive.org/embed/${encodeURIComponent(activeMovieId)}${movieStartOffset > 0 ? `?start=${movieStartOffset}&autoplay=1` : "?autoplay=1"}`}
                title={activeMovieTitle}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
                data-testid="iframe-movie-player"
              />

              {/* Host sync controls — play/pause so watchers stay in sync */}
              {user?.id === movieStartedBy && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-25 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full border border-white/15 px-3 py-1.5 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-auto" data-testid="movie-host-sync-controls">
                  <span className="text-white/50 text-[10px] font-medium select-none">Sync controls</span>
                  {movieHostPlaying ? (
                    <button
                      type="button"
                      onClick={handleMoviePause}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors"
                      data-testid="button-movie-host-pause"
                      title="Pause for all watchers"
                    >
                      <span className="w-3 h-3 flex items-center justify-center">⏸</span> Pause All
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMoviePlay}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/80 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
                      data-testid="button-movie-host-play"
                      title="Resume for all watchers"
                    >
                      <span className="w-3 h-3 flex items-center justify-center">▶</span> Resume All
                    </button>
                  )}
                </div>
              )}

              {/* Watcher resync button */}
              {user?.id !== movieStartedBy && (
                <button
                  type="button"
                  onClick={handleMovieResync}
                  className="absolute bottom-8 left-3 z-25 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 hover:bg-black/90 border border-white/15 text-white text-xs font-medium transition-colors opacity-0 hover:opacity-100 backdrop-blur-sm"
                  data-testid="button-movie-resync"
                  title="Jump to where the host currently is"
                >
                  ↺ Resync
                </button>
              )}

              {/* Reactions toggle + collapsible emoji picker — hidden by default, tap smiley to reveal */}
              <div
                className="absolute right-3 bottom-6 z-20 flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {movieReactionsOpen && (
                  <div
                    className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-full border border-white/15 px-2 py-1.5 shadow-lg animate-in fade-in slide-in-from-right-2 duration-200"
                    data-testid="movie-reactions-panel"
                  >
                    {["❤️", "🍿", "😂", "😮", "👏", "🔥", "🤯"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => { if (socket) socket.emit("room:movie-reaction", { roomId: room.id, emoji }); }}
                        className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center text-base transition-transform hover:scale-125 active:scale-90"
                        title={`Send ${emoji}`}
                        data-testid={`button-movie-react-${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setMovieReactionsOpen((v) => !v)}
                  className={`w-9 h-9 rounded-full backdrop-blur-sm border flex items-center justify-center shadow-lg transition-colors ${movieReactionsOpen ? "bg-violet-500/85 border-violet-300/50 text-white" : "bg-black/65 border-white/15 text-white hover:bg-white/20"}`}
                  title={movieReactionsOpen ? "Hide reactions" : "Show reactions"}
                  data-testid="button-movie-reactions-toggle"
                >
                  {movieReactionsOpen ? <X className="w-4 h-4" /> : <Smile className="w-4 h-4" />}
                </button>
              </div>

              {/* Resize handle */}
              <div
                className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center z-30 cursor-ns-resize group/resize-movie hover:bg-white/10 transition-colors"
                data-testid="movie-player-resize-handle"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const container = e.currentTarget.parentElement!;
                  const startH = container.getBoundingClientRect().height;
                  const onMove = (me: MouseEvent) => {
                    const outerH = container.parentElement?.getBoundingClientRect().height ?? 600;
                    setMoviePlayerHeight(Math.max(180, Math.min(outerH - 80, startH + (me.clientY - startY))));
                  };
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
              >
                <div className="w-14 h-1 rounded-full bg-white/25 group-hover/resize-movie:bg-white/60 transition-colors" />
              </div>
            </div>
          )}

          {activeYoutubeId && showYoutube && (() => {
            const isYoutubeHost = true;
            const broadcaster = youtubeStartedBy ? participantById.get(youtubeStartedBy) : undefined;
            const bIndex = participants.findIndex(p => p.id === youtubeStartedBy);
            const bGradient = getAvatarGradient(bIndex >= 0 ? bIndex : 0);
            return (
              <div
                ref={ytSlotRef}
                className="bg-black relative group/ytplayer"
                style={ytPlayerHeight ? { height: ytPlayerHeight, flexShrink: 0 } : { flex: 1, minHeight: 0 }}
                data-testid="media-main-youtube"
                data-yt-slot="true"
              >
                {/* Persistent player is mounted at top-level (see ytPersistentWrapper).
                    This slot just reserves the visual area; overlays render with the player. */}

                {/* Resize handle — drag bottom edge to resize the player */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center z-30 cursor-ns-resize group/resize-yt hover:bg-white/10 transition-colors"
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

                {/* Host control bar — only visible to the broadcaster, revealed on hover */}
                {isYoutubeHost && (
                  <div
                    className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-2.5 px-4 pt-8 pb-3 opacity-0 group-hover/ytplayer:opacity-100 transition-opacity duration-200"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)" }}
                    data-testid="youtube-host-controls"
                  >
                    {/* Seek bar */}
                    <input
                      type="range"
                      min={0}
                      max={ytDuration || 100}
                      step={1}
                      value={ytCurrentTime}
                      onChange={(e) => handleYtSeek(Number(e.target.value))}
                      className="w-full h-1.5 cursor-pointer rounded-full appearance-none"
                      style={{ accentColor: "#ef4444" }}
                      data-testid="input-yt-seek"
                      aria-label="Video seek"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {/* Play / Pause */}
                        <button
                          onClick={handleYtPlayPause}
                          className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/28 border border-white/20 flex items-center justify-center transition-colors shadow-lg"
                          data-testid="button-yt-playpause"
                          aria-label={ytIsPlaying ? "Pause" : "Play"}
                        >
                          {ytIsPlaying
                            ? <Pause className="w-4 h-4 text-white" />
                            : <Play className="w-4 h-4 text-white fill-white ml-0.5" />}
                        </button>
                        {/* Reload — recovers from frozen frame while audio still plays */}
                        <button
                          onClick={() => {
                            const player = youtubePlayerRef.current;
                            if (!player) return;
                            try {
                              const t = player.getCurrentTime?.() || 0;
                              ytSyncTimeRef.current = Math.max(0, t);
                              const id = activeYoutubeId;
                              setActiveYoutubeId(null);
                              setTimeout(() => setActiveYoutubeId(id), 60);
                            } catch (_) {}
                          }}
                          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 border border-white/15 flex items-center justify-center transition-colors shadow-lg"
                          title="Reload video (fixes frozen frame)"
                          data-testid="button-yt-reload"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-white" />
                        </button>
                        {/* Sync with starter — non-starters only */}
                        {user?.id !== youtubeStartedBy && youtubeStartedBy && (
                          <button
                            onClick={handleYtSyncToStarter}
                            className="h-8 px-2.5 rounded-full bg-white/10 hover:bg-purple-500/60 border border-white/15 flex items-center justify-center gap-1 transition-colors shadow-lg"
                            title="Jump to where the starter is watching"
                            data-testid="button-yt-sync"
                          >
                            <Zap className="w-3.5 h-3.5 text-white" />
                            <span className="text-[10px] text-white font-semibold leading-none">Sync</span>
                          </button>
                        )}
                        {/* Close — only the starter can close the video for everyone */}
                        {user?.id === youtubeStartedBy && (
                          <button
                            onClick={handleStopYoutube}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/60 border border-white/15 flex items-center justify-center transition-colors shadow-lg"
                            title="Close video for everyone"
                            data-testid="button-yt-stop"
                          >
                            <StopCircle className="w-3.5 h-3.5 text-white" />
                          </button>
                        )}
                        {/* Time */}
                        <span className="text-white/70 text-[11px] font-mono tabular-nums" data-testid="text-yt-time">
                          {formatYtTime(ytCurrentTime)} / {formatYtTime(ytDuration)}
                        </span>
                      </div>
                      {/* Volume */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleYtVolume(ytVolume > 0 ? 0 : 100)}
                          className="text-white/60 hover:text-white transition-colors flex-shrink-0"
                          title={ytVolume === 0 ? "Unmute" : "Mute"}
                          data-testid="button-yt-mute"
                        >
                          {ytVolume === 0 ? <VolumeX className="w-4 h-4" /> : ytVolume < 50 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={ytVolume}
                          onChange={(e) => handleYtVolume(Number(e.target.value))}
                          className="w-20 h-1.5 cursor-pointer rounded-full appearance-none"
                          style={{ accentColor: "#ffffff" }}
                          data-testid="input-yt-volume"
                          aria-label="YouTube volume"
                        />
                      </div>
                    </div>
                  </div>
                )}


                {/* Connection quality badge — auto-shown when slow internet triggers a quality downgrade */}
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

                {/* Top-right close button.
                    The close button does different things depending on who clicks it:
                      - Starter : stops the video for everyone in the room
                      - Anyone else (watcher): just hides the player for themselves;
                                               the room keeps watching, and they can
                                               re-join from the side panel. */}
                <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
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
                    className="w-7 h-7 rounded-full bg-black/55 backdrop-blur-sm hover:bg-red-500/80 border border-white/15 flex items-center justify-center text-white shadow-md transition-colors"
                    title={user?.id === youtubeStartedBy ? "Close video for everyone" : "Hide video (just for you)"}
                    data-testid="button-yt-corner-close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Reactions toggle (smiley) + collapsible reactions/voting panel.
                    The panel is HIDDEN by default — users tap the smiley to open it.
                    When open it reveals an emoji picker (everyone can fire reactions)
                    and the live like / dislike / skip-vote tally. The skip vote
                    auto-advances the queue once a majority of the room agrees.
                    None of this affects the starter's playhead. */}
                <div
                  className="absolute right-3 z-20 flex items-center gap-2 transition-[bottom] duration-200 bottom-3 group-hover/ytplayer:bottom-20"
                  onClick={(e) => e.stopPropagation()}
                >
                  {ytReactionsOpen && (
                    <div
                      className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-full border border-white/15 px-2 py-1.5 shadow-lg animate-in fade-in slide-in-from-right-2 duration-200"
                      data-testid="yt-reactions-panel"
                    >
                      {/* Emoji picker — everyone in the watch party can fire any of these. */}
                      {["❤️", "🔥", "😂", "😮", "👏", "👍", "🤯"].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => { if (socket) socket.emit("room:youtube-reaction", { roomId: room.id, emoji }); }}
                          className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center text-base transition-transform hover:scale-125 active:scale-90"
                          title={`Send ${emoji}`}
                          data-testid={`button-yt-react-${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      <div className="w-px h-5 bg-white/20" />
                      <button
                        type="button"
                        onClick={() => {
                          if (!socket) return;
                          const next = myYtVote === "like" ? null : "like";
                          setMyYtVote(next);
                          socket.emit("room:youtube-vote", { roomId: room.id, hostId: youtubeStartedBy, kind: next || "none" });
                        }}
                        className={`h-7 px-2 rounded-full flex items-center gap-1 text-[11px] font-semibold transition-colors ${myYtVote === "like" ? "bg-emerald-500/85 text-white" : "bg-white/10 text-white/85 hover:bg-white/20"}`}
                        title="Like this video"
                        data-testid="button-yt-vote-like"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="tabular-nums">{ytVotes.likes}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!socket) return;
                          const next = myYtVote === "dislike" ? null : "dislike";
                          setMyYtVote(next);
                          socket.emit("room:youtube-vote", { roomId: room.id, hostId: youtubeStartedBy, kind: next || "none" });
                        }}
                        className={`h-7 px-2 rounded-full flex items-center gap-1 text-[11px] font-semibold transition-colors ${myYtVote === "dislike" ? "bg-red-500/85 text-white" : "bg-white/10 text-white/85 hover:bg-white/20"}`}
                        title="Dislike this video"
                        data-testid="button-yt-vote-dislike"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span className="tabular-nums">{ytVotes.dislikes}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!socket) return;
                          const next = !myYtSkipVote;
                          setMyYtSkipVote(next);
                          socket.emit("room:youtube-skip-vote", { roomId: room.id, hostId: youtubeStartedBy, vote: next });
                        }}
                        className={`h-7 px-2 rounded-full flex items-center gap-1 text-[11px] font-semibold transition-colors ${myYtSkipVote ? "bg-amber-500/85 text-white" : "bg-white/10 text-white/85 hover:bg-white/20"}`}
                        title={`Vote to skip — auto-advances when ${Math.max(2, Math.ceil((ytVotes.watchers || participants.length) / 2))} people agree`}
                        data-testid="button-yt-vote-skip"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        <span className="tabular-nums">{ytVotes.skip}</span>
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setYtReactionsOpen((v) => !v)}
                    className={`w-9 h-9 rounded-full backdrop-blur-sm border flex items-center justify-center shadow-lg transition-colors ${ytReactionsOpen ? "bg-purple-500/85 border-purple-300/50 text-white" : "bg-black/65 border-white/15 text-white hover:bg-white/20"}`}
                    title={ytReactionsOpen ? "Hide reactions" : "Show reactions"}
                    data-testid="button-yt-reactions-toggle"
                  >
                    {ytReactionsOpen ? <X className="w-4 h-4" /> : <Smile className="w-4 h-4" />}
                  </button>
                </div>

                {/* Profiles intentionally NOT overlaid on the video — they appear in the
                    participant strip beneath the player, mirroring the book reader pattern. */}
              </div>
            );
          })()}

          {showEReader && selectedBook && (
            <div
              className="flex-1 min-h-0 flex flex-col relative"
              style={{
                background: eReaderTheme === "sepia" ? "#f5ead5" : eReaderTheme === "light" ? "#ffffff" : "#1a1a1a",
                color: eReaderTheme === "dark" ? "#d4c9b0" : "#1a1008",
              }}
              data-testid="media-main-ereader"
            >
              {/* Reader toolbar */}
              <div
                className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0 flex-wrap"
                style={{
                  background: eReaderTheme === "sepia" ? "#ece0c5" : eReaderTheme === "light" ? "#f0f0f0" : "#111111",
                  borderColor: eReaderTheme === "dark" ? "#333" : "#d4c4a0",
                }}
              >
                <button
                  onClick={() => setShowEReader(false)}
                  className="flex-shrink-0 p-1 rounded hover:opacity-70 transition-opacity"
                  title="Close reader"
                >
                  <X className="w-4 h-4" />
                </button>
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                <span className="text-xs font-semibold truncate flex-1 min-w-0 max-w-[160px]">{selectedBook.title}</span>

                <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                  {/* Font size */}
                  <button onClick={() => setEReaderFontSize(s => Math.max(12, s - 2))} className="px-1.5 py-0.5 rounded text-xs font-bold hover:opacity-70 transition-opacity" title="Smaller">A−</button>
                  <span className="text-[10px] opacity-60 w-7 text-center">{eReaderFontSize}</span>
                  <button onClick={() => setEReaderFontSize(s => Math.min(28, s + 2))} className="px-1.5 py-0.5 rounded text-xs font-bold hover:opacity-70 transition-opacity" title="Larger">A+</button>

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

              {/* Book text */}
              <div
                ref={bookScrollRef}
                className="flex-1 min-h-0 overflow-y-auto"
                onMouseUp={handleReaderMouseUp}
              >
                <div className="mx-auto max-w-2xl px-8 py-8">
                  {bookLoading && (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin opacity-40" />
                    </div>
                  )}
                  {!bookLoading && bookText && (
                    <div
                      className="leading-relaxed whitespace-pre-wrap cursor-text"
                      style={{ fontSize: eReaderFontSize, lineHeight: 1.8, letterSpacing: "0.01em" }}
                    >
                      {bookText}
                    </div>
                  )}
                  {!bookLoading && !bookText && (
                    <div className="flex items-center justify-center py-16 opacity-50">
                      <p className="text-sm">Could not load book content. Try another title.</p>
                    </div>
                  )}
                </div>
              </div>
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

          {isVideoOn && localVideoStreamObj && !miniCameraMode && !isScreenSharing && !(activeYoutubeId && showYoutube) && !showEReader && !remoteVideoUserId && (
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
          return (
          <div className={`flex items-end justify-center p-2 pb-4 ${(activeYoutubeId && showYoutube) || (activeMovieId && showMovie) || showEReader || isScreenSharing || !!remoteScreenShareUserId || !!remoteVideoUserId || (isVideoOn && !miniCameraMode) ? "absolute bottom-0 left-0 right-0 z-20 pt-16 overflow-visible" : "flex-1 pt-14 overflow-visible"}`}>
            <div
              className="overflow-x-auto w-full"
              style={{ scrollbarWidth: "none" }}
            >
            <div className="flex flex-nowrap items-end justify-center pt-14" style={{ gap: gapPx, minWidth: "max-content", margin: "0 auto" }}>
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
                    className="flex flex-col items-center gap-2 group relative"
                    data-testid={`card-participant-${p.id}`}
                  >
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
                      onNavigateDm={(userId: string) => setDmUserId(userId)}
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
                      onReconnect={handleReconnect}
                      volume={participantVolumes[p.id] ?? 1}
                      onVolumeChange={handleVolumeChange}
                      youtubeVideoId={youtubeHosts.get(p.id) || null}
                      remoteVideoStream={isMe && isVideoOn && miniCameraMode ? localVideoStreamObj : (!isMe && availableVideoUsers.has(p.id) ? remoteVideoStreams.current.get(p.id) : undefined)}
                      localVideoFlipped={isMe ? cameraFacing === "user" : false}
                      isBlocked={isBlockedUser}
                      onUnblock={handleUnblock}
                      analyserNode={analysersRef.current.get(p.id)}
                      mood={participantMoods[p.id]}
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
                      hologramVideoUrl={(room as any).hologramVideoUrl || null}
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
          {(ytFloatingReactions.length > 0 || movieFloatingReactions.length > 0) && (
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
                  {/* Female — Afi K */}
                  <NeumorphicPersonaCard
                    testId="button-persona-female"
                    onClick={() => { setAiPersonaPickerOpen(false); startWithPersona("Female", "Afi K"); }}
                    avatar={<NeumorphicAvatarRing glowRgb="255,140,210" content={<span className="text-2xl font-light leading-none" style={{ color: "rgba(255,200,230,0.98)", textShadow: "0 0 10px rgba(255,140,210,0.55)" }}>♀</span>} />}
                    name="Afi K"
                    description="Funny · flirty · welcomes joiners by name"
                    nameColor="rgba(255,180,220,0.95)"
                    accentColor="rgba(255,140,210,0.90)"
                  />

                  {/* Male — Dude Lebowski */}
                  <NeumorphicPersonaCard
                    testId="button-persona-male"
                    onClick={() => { setAiPersonaPickerOpen(false); startWithPersona("Male", "Dude"); }}
                    avatar={<NeumorphicAvatarRing glowRgb="120,180,255" content={<span className="text-2xl font-light leading-none" style={{ color: "rgba(180,215,255,0.98)", textShadow: "0 0 10px rgba(120,180,255,0.55)" }}>♂</span>} />}
                    name="Dude Lebowski"
                    description="Laid-back · conversational · easy-going"
                    nameColor="rgba(150,195,255,0.95)"
                    accentColor="rgba(120,180,255,0.90)"
                  />

                  {/* Eva — ElevenLabs (detailed AI portrait, neumorphic ring) */}
                  <NeumorphicPersonaCard
                    testId="button-persona-eva"
                    onClick={() => { setAiPersonaPickerOpen(false); startWithPersona("Eva", "Eva"); }}
                    avatar={<NeumorphicAvatarRing glowRgb="0,225,255" intense content={<img loading="lazy" decoding="async" src={evaAvatarUrl} alt="Eva avatar" className="w-full h-full object-cover rounded-full" data-testid="img-eva-avatar" />} />}
                    name="Eva"
                    badge="NEW AI"
                    description="ElevenLabs · Natural & expressive"
                    nameColor="rgba(160,235,255,0.97)"
                    accentColor="rgba(0,225,255,0.95)"
                  />

                  {/* Flex — Street-smart, hype, high energy */}
                  <NeumorphicPersonaCard
                    testId="button-persona-flex"
                    onClick={() => { setAiPersonaPickerOpen(false); startWithPersona("Male", "Flex"); }}
                    avatar={<NeumorphicAvatarRing glowRgb="255,180,0" content={<span className="text-2xl font-black leading-none" style={{ color: "rgba(255,210,80,0.98)", textShadow: "0 0 12px rgba(255,180,0,0.70)" }}>F</span>} />}
                    name="Flex"
                    badge="🔥"
                    description="Street-smart · hype · high energy"
                    nameColor="rgba(255,210,80,0.97)"
                    accentColor="rgba(255,180,0,0.90)"
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
        const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "👏"];
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
      {activeYoutubeId && (() => {
        const isMini = !showYoutube || miniPlayerMode || !ytSlotRect;
        const isYoutubeHost = !!user?.id;
        const showAsHidden = !showYoutube && !miniPlayerMode;
        const wrapperStyle: React.CSSProperties = showAsHidden
          ? { left: -9999, top: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }
          : isMini
            ? { left: miniPlayerPos.x, top: miniPlayerPos.y, width: 220, height: 130 }
            : { left: ytSlotRect!.left, top: ytSlotRect!.top, width: ytSlotRect!.width, height: ytSlotRect!.height };
        return (
          <div
            className="fixed select-none"
            style={{ ...wrapperStyle, zIndex: isMini ? 50 : 5 }}
            data-testid={isMini ? "youtube-mini-player" : "youtube-persistent-player"}
          >
            <div
              className={`relative w-full h-full overflow-hidden bg-black ${isMini ? "rounded-xl shadow-2xl border border-white/20 cursor-grab active:cursor-grabbing group" : ""}`}
              onMouseDown={isMini && !showAsHidden ? handleMiniPlayerMouseDown : undefined}
            >
              <div
                ref={ytContainerRef}
                className="w-full h-full border-0 transition-opacity duration-300"
                style={{ opacity: ytPlayerReady ? 1 : 0 }}
                data-testid="iframe-youtube-player"
              />
              {ytPlayerLoading && !ytPlayerReady && !ytPlayerError && !showAsHidden && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black pointer-events-none" data-testid="youtube-loading-overlay">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-[11px] text-white/70">Loading video…</span>
                  </div>
                </div>
              )}
              {ytPlayerError && !showAsHidden && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/95 px-4" data-testid="youtube-error-overlay">
                  <div className="flex flex-col items-center gap-3 text-center max-w-sm">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <X className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="text-sm text-white/90 leading-snug">{ytPlayerError.message}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        className="px-3 py-1.5 text-[12px] font-semibold bg-blue-500 hover:bg-blue-400 text-white rounded-full transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleRetryYoutube(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        data-testid="button-youtube-retry"
                      >
                        Retry
                      </button>
                      <a
                        className="px-3 py-1.5 text-[12px] font-semibold bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                        href={`https://www.youtube.com/watch?v=${activeYoutubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        data-testid="link-youtube-open"
                      >
                        Open on YouTube
                      </a>
                    </div>
                  </div>
                </div>
              )}
              {isMini && !showAsHidden && (
                <>
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-20 pointer-events-none">
                    <button
                      className="bg-blue-500 hover:bg-blue-400 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg transition-colors flex items-center gap-1.5 pointer-events-auto"
                      onClick={(e) => { e.stopPropagation(); handleExpandMiniPlayer(); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      data-testid="button-mini-player-expand"
                    >
                      <Maximize2 className="w-3 h-3" />
                      Click to Zoom
                    </button>
                  </div>
                  <button
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg transition-colors z-30"
                    aria-label="Close mini player"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (user?.id === youtubeStartedBy) {
                        handleStopYoutube();
                        setMiniPlayerMode(false);
                      } else {
                        // Non-starter: just hide the player locally, don't
                        // affect anyone else's playback.
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
                </>
              )}
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
    </div>
  );
}
