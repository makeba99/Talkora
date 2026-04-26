import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AiTutorFace } from "@/components/ai-tutor-face";
import { VextornMark } from "@/components/vextorn-logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Mic, MicOff, PhoneOff, Hand, Globe, AlertCircle, MessageSquare,
  UserX, VolumeX, Send, X, Monitor, UserPlus, UserCheck, Users, Settings, Youtube,
  Video, VideoOff, LogIn, LogOut, Search, Play, Pause, Loader2, Pencil, Shield, Crown,
  Volume2, Copy, Flag, Ban, RefreshCw, Trash2, ChevronUp, ChevronsDown, Maximize2, Palette,
  Tv, BookOpen, Gamepad2, ExternalLink, Volume1, ChevronLeft, ChevronRight, CornerUpLeft, Eye, Bell, LockKeyhole,
  AtSign, TrendingUp, StopCircle, Clock, LayoutGrid, Radio, UsersRound, AlertTriangle, EyeOff, Image as ImageIcon,
  BrainCircuit, Lightbulb, ChevronDown, RotateCcw, ListVideo, Zap, Lock, ThumbsUp, ThumbsDown, SkipForward, Smile
} from "lucide-react";
import { SiInstagram, SiLinkedin, SiFacebook } from "react-icons/si";
import { useSocket } from "@/lib/socket";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { playMoodSound } from "@/lib/mood-sounds";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { LANGUAGES, LEVELS } from "@shared/schema";
import { DmDialog } from "@/components/dm-dialog";
import { ReportDialog } from "@/components/report-dialog";
import { EmojiPickerButton, GifPickerButton, ImageUploadButton, renderMessageContent, renderReplyPreview, uploadChatImage } from "@/components/chat-picker";
import { ChessPanel } from "@/components/chess-panel";
import { CenterChessOverlay, ChessPlayerBadge } from "@/components/center-chess-overlay";
import { getAvatarRingClass, FlairBadgeDisplay } from "@/components/profile-dropdown";
import { ProfileDecoration, ROOM_THEMES, getRoomThemeStyle, RoomThemeOverlay, getChatPanelStyle } from "@/components/profile-decorations";
import { UserNotePopover } from "@/components/social-panel";
import { useAiTutor } from "@/hooks/use-ai-tutor";
import { setYoutubeActive, isYoutubeActive } from "@/lib/perf-bus";
import type { Room, User, Follow } from "@shared/schema";
import evaAvatarUrl from "@assets/generated_images/eva-avatar.png";

interface VoiceRoomProps {
  room: Room;
  onLeave: (reason?: "joined-another-room") => void;
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
  const smoothedRef = useRef<number[]>(new Array(14).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const NUM_BARS = 14;
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    const binStep = Math.max(1, Math.floor(analyserNode.frequencyBinCount / NUM_BARS));
    const smoothed = smoothedRef.current;

    const draw = () => {
      analyserNode.getByteFrequencyData(dataArray);
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const barW = Math.floor(W / NUM_BARS) - 1;
      for (let i = 0; i < NUM_BARS; i++) {
        const raw = dataArray[i * binStep] / 255;
        smoothed[i] = smoothed[i] * 0.65 + raw * 0.35;
        const barH = Math.max(2, smoothed[i] * H * 0.92);
        const x = i * (barW + 1);
        const y = H - barH;
        const grad = ctx.createLinearGradient(0, y, 0, H);
        grad.addColorStop(0, "rgba(255,255,255,0.95)");
        grad.addColorStop(1, "rgba(0,224,255,0.9)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(x, y, barW, barH, [2, 2, 0, 0]);
        } else {
          ctx.rect(x, y, barW, barH);
        }
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyserNode]);

  if (!analyserNode) {
    return (
      <div className="absolute bottom-6 left-0 right-0 flex justify-center items-end gap-[2px] h-5 z-20 pointer-events-none px-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="w-1.5 bg-orange-400/80 rounded-t-sm animate-sound-wave origin-bottom"
            style={{ animationDelay: `${i * 0.13}s`, height: "70%" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="absolute bottom-5 left-0 right-0 flex justify-center z-20 pointer-events-none px-1.5">
      <canvas
        ref={canvasRef}
        width={88}
        height={22}
        className="opacity-95 drop-shadow-md"
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
  hasActiveYoutubeGlobal,
  onWatchYoutube,
  isWatchingYoutube,
  allParticipants,
  onForceMute,
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
}: any) {
  const showVideoIcon = isMe ? isVideoOn : (p.hasVideo || hasRemoteVideo);
  const showYoutubeIcon = hasActiveYoutube;
  const showScreenIcon = isSharing || hasRemoteScreen;
  const showBookIcon = !!hasActiveBook;
  const isWatcher = isYoutubeWatcher && !hasActiveYoutube;

  const ringClass = getAvatarRingClass(p.avatarRing);
  const hasCustomRing = !!ringClass;

  const isBroadcasting = hasActiveYoutube || showScreenIcon;
  const otherParticipants = allParticipants ? allParticipants.filter((p2: any) => p2.id !== p.id) : [];

  const handleCopyId = () => {
    navigator.clipboard.writeText(p.id);
  };

  const isFollowing = followingIds.has(p.id);

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
                <AvatarImage src={p.profileImageUrl || undefined} />
                <AvatarFallback className="bg-muted text-lg">{getUserInitials(p)}</AvatarFallback>
             </Avatar>
             <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex justify-between items-center text-xs">
                   <span className="text-muted-foreground">ID: {p.id.slice(0, 10).toUpperCase()}</span>
                   <button className="text-white/50 font-medium hover:underline px-1" onClick={handleCopyId}>Copy ID</button>
                </div>
                <div className="text-sm font-semibold truncate leading-none">Name: {getUserDisplayName(p)}</div>
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
            <div className="grid grid-cols-3 gap-2">
               <Button variant="outline" size="sm" onClick={() => onForceMute && onForceMute(p.id)} className="h-8 text-xs border-border bg-transparent hover:bg-muted px-1">
                  <VolumeX className="w-3.5 h-3.5 mr-1" /> Mute
               </Button>
               <Button variant="outline" size="sm" onClick={() => onKick && onKick(p.id)} className="h-8 text-xs border-border bg-transparent hover:bg-muted px-1">
                  <UserX className="w-3.5 h-3.5 mr-1" /> Kick
               </Button>
               <Button variant="outline" size="sm" onClick={() => onClearChatGlobal && onClearChatGlobal(true)} className="h-8 text-xs border-border bg-transparent hover:bg-muted px-1">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
               </Button>
            </div>
          )}

          {(isCurrentUserHost || isCurrentUserCoOwner) && !isMe && !isRoomOwner && (
            <div className="grid grid-cols-2 gap-2">
               <Button variant={participantRole === "guest" || !participantRole ? "default" : "outline"} size="sm" onClick={() => onAssignRole && onAssignRole("guest")} className={`h-8 text-xs ${participantRole === "guest" || !participantRole ? 'bg-muted text-foreground border-border' : 'bg-transparent border-border text-muted-foreground hover:bg-muted'}`}>
                 <ChevronUp className="w-3.5 h-3.5 mr-1" /> Set Guest
               </Button>
               <Button variant={participantRole === "co-owner" ? "default" : "outline"} size="sm" onClick={() => onAssignRole && onAssignRole("co-owner")} className={`h-8 text-xs ${participantRole === "co-owner" ? 'bg-orange-600 text-white border-orange-600' : 'bg-transparent border-border text-muted-foreground hover:bg-muted'}`}>
                 <ChevronUp className="w-3.5 h-3.5 mr-1" /> Set Co-Owner
               </Button>
            </div>
          )}
          
          {(!isCurrentUserHost && !isCurrentUserCoOwner && !isMe) && (
             <div className="grid grid-cols-1 gap-2">
               <Button variant="outline" size="sm" onClick={() => onClearChatLocal && onClearChatLocal()} className="h-8 text-xs border-border bg-transparent hover:bg-muted">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear My Chat
               </Button>
             </div>
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
              <input type="range" min="0" max="1" step="0.05" value={volume ?? 1} onChange={(e) => onVolumeChange && onVolumeChange(p.id, parseFloat(e.target.value))} className="flex-1 accent-orange-500 h-1 cursor-pointer" />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-md overflow-hidden bg-muted/30 border-[3px] border-transparent select-none opacity-70">
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
        className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-md overflow-hidden bg-muted/20 group border-[3px] select-none ${
          isSpeaking ? "border-[hsl(var(--neu-orange))]/60 shadow-[0_0_14px_hsl(var(--neu-orange)/0.45)]" : "border-transparent hover:border-white/20"
        } transition-all duration-300`}
      >
        {hasActiveYoutube && youtubeVideoId ? (
          <img
            src={`https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`}
            alt="YouTube thumbnail"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : remoteVideoStream ? (
          <RemoteVideoPreview stream={remoteVideoStream} className={isMe && localVideoFlipped ? "scale-x-[-1]" : ""} />
        ) : p.profileImageUrl ? (
          <img
            src={p.profileImageUrl}
            alt={getUserDisplayName(p)}
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

        {(showScreenIcon || showYoutubeIcon || showBookIcon || isWatcher) && (
          <div className="absolute top-1 right-8 z-20 flex items-center gap-0.5 animate-pulse drop-shadow-md">
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
             {isWatcher && !showScreenIcon && !showYoutubeIcon && (
                <div className="bg-red-500/80 p-1 rounded-sm shadow flex items-center gap-0.5 pointer-events-none">
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

        {isRoomOwner ? (
          <div
            className="absolute bottom-0 left-0 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-tr-md shadow-sm z-20 flex items-center gap-0.5"
            style={{
              background: "linear-gradient(145deg, hsl(var(--neu-orange-hi) / 0.95) 0%, hsl(var(--neu-orange-lo) / 0.92) 100%)",
              boxShadow: "0 0 10px hsl(var(--neu-orange) / 0.45), inset 0 1px 0 rgba(220,210,255,0.30)",
            }}
          >
            Owner <Crown className="w-2.5 h-2.5 text-yellow-200" />
          </div>
        ) : participantRole === "co-owner" ? (
          <div
            className="absolute bottom-0 left-0 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-tr-md shadow-sm z-20 flex items-center gap-0.5"
            style={{
              background: "linear-gradient(145deg, hsl(var(--neu-orange-hi) / 0.75) 0%, hsl(var(--neu-orange-lo) / 0.72) 100%)",
              boxShadow: "0 0 8px hsl(var(--neu-orange) / 0.35), inset 0 1px 0 rgba(220,210,255,0.25)",
            }}
          >
            Co-Owner
          </div>
        ) : isMe ? (
          <div className="absolute bottom-0 left-0 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-tr-md shadow-sm z-20">
            You
          </div>
        ) : null}

        <div className="absolute bottom-1 right-1 z-20 drop-shadow-md">
          {p.isMuted ? (
            <MicOff className="w-4 h-4 text-white opacity-80" />
          ) : (
             <Mic className="w-4 h-4 text-white opacity-100" />
          )}
        </div>

        {/* Note: the old static "raise hand" badge here has been replaced by
            the floating mood emoji that animates above the card (see top of
            avatarContent above). */}
      </div>
    </div>
  );

  return (
    <ProfileDecoration decorationId={(p as any).profileDecoration} size={112}>
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

export function VoiceRoom({ room: roomProp, onLeave }: VoiceRoomProps) {
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
  const [participantMoods, setParticipantMoods] = useState<Record<string, { id: string; emoji: string }>>({});
  const moodTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Mood picker open/closed state (for the new emoji bar that replaced the
  // raise-hand button in the bottom control row).
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
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
  const aiInputRef = useRef<HTMLInputElement>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [localVideoStreamObj, setLocalVideoStreamObj] = useState<MediaStream | null>(null);
  const [miniCameraMode, setMiniCameraMode] = useState(false);
  const [youtubeSearch, setYoutubeSearch] = useState("");
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [youtubeSearching, setYoutubeSearching] = useState(false);
  const [activeYoutubeId, setActiveYoutubeId] = useState<string | null>(null);
  const [youtubeStartedBy, setYoutubeStartedBy] = useState<string | null>(null);
  const [showYoutube, setShowYoutube] = useState(false);
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
  const [hologramPreviewVR, setHologramPreviewVR] = useState<string | null>(null);
  const [hologramFileVR, setHologramFileVR] = useState<File | null>(null);
  const [uploadingVideoVR, setUploadingVideoVR] = useState(false);
  const [videoTabVR, setVideoTabVR] = useState<"upload" | "youtube">("upload");
  const [ytLinkVR, setYtLinkVR] = useState("");
  const [ytQueryVR, setYtQueryVR] = useState("");
  const [ytResultsVR, setYtResultsVR] = useState<any[]>([]);
  const [ytSearchingVR, setYtSearchingVR] = useState(false);
  const [selectedYtVR, setSelectedYtVR] = useState<string | null>(null);
  const ytTimeoutVR = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoInputVR = useRef<HTMLInputElement>(null);
  const [youtubeFeatured, setYoutubeFeatured] = useState<any[]>([]);
  const [youtubeFeaturedLoading, setYoutubeFeaturedLoading] = useState(false);
  const [youtubeCategory, setYoutubeCategory] = useState<string>("conversation");
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
  const [participantRoles, setParticipantRoles] = useState<Record<string, string>>({});
  const [videoFlipped, setVideoFlipped] = useState(true);
  const [remoteVideoUserId, setRemoteVideoUserId] = useState<string | null>(null);
  const [remoteScreenShareUserId, setRemoteScreenShareUserId] = useState<string | null>(null);
  const [availableVideoUsers, setAvailableVideoUsers] = useState<Set<string>>(new Set());
  const [availableScreenUsers, setAvailableScreenUsers] = useState<Set<string>>(new Set());
  const youtubeSearchTimeout = useRef<NodeJS.Timeout | null>(null);
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
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
  const [miniPlayerMode, setMiniPlayerMode] = useState(false);
  const [miniPlayerPos, setMiniPlayerPos] = useState({ x: 16, y: 80 });
  const ytSlotRef = useRef<HTMLDivElement | null>(null);
  const [ytSlotRect, setYtSlotRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [youtubeWatchers, setYoutubeWatchers] = useState<Set<string>>(new Set());
  type YtQueueItem = { id: string; videoId: string; title?: string; thumbnail?: string; addedBy: string };
  const [ytQueue, setYtQueue] = useState<YtQueueItem[]>([]);
  const [screenWatchers, setScreenWatchers] = useState<Set<string>>(new Set());
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
  const [goLivePlatform, setGoLivePlatform] = useState<"youtube" | "twitch" | "tiktok">("youtube");

  const [readSearch, setReadSearch] = useState("");
  const [readBooks, setReadBooks] = useState<any[]>([]);
  const [readCatalog, setReadCatalog] = useState<any[]>([]);
  const [readAudiobooks, setReadAudiobooks] = useState<any[]>([]);
  const [readVideos, setReadVideos] = useState<any[]>([]);
  const [readLoading, setReadLoading] = useState(false);
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
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (targetId: string) => {
      await apiRequest("DELETE", `/api/follows/${user?.id}/${targetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following", user?.id] });
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: async (data: { title: string; language: string; level: string; maxUsers: number; roomTheme?: string; welcomeMessage?: string | null; welcomeMediaUrls?: string[]; welcomeMediaTypes?: string[]; welcomeMediaPosition?: string; welcomeAccentColor?: string }) => {
      const res = await apiRequest("PATCH", `/api/rooms/${room.id}`, data);
      return await res.json();
    },
    onSuccess: (updatedRoom: any) => {
      setRoomData((prev: any) => ({ ...prev, ...updatedRoom }));
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", room.id] });
      setEditDialogOpen(false);
      if (updatedRoom.welcomeMessage !== undefined) setWelcomeText(updatedRoom.welcomeMessage || "");
      if (updatedRoom.welcomeMediaUrls !== undefined) setWelcomeMediaUrlsState(updatedRoom.welcomeMediaUrls || []);
      if (updatedRoom.welcomeMediaTypes !== undefined) setWelcomeMediaTypesState(updatedRoom.welcomeMediaTypes || []);
      if (updatedRoom.welcomeMediaPosition !== undefined) setWelcomeMediaPositionState(updatedRoom.welcomeMediaPosition || "below");
      if (updatedRoom.welcomeAccentColor !== undefined) setWelcomeAccentColorState(updatedRoom.welcomeAccentColor || "#8B5CF6");
      toast({ title: "Room settings updated" });
    },
    onError: () => {
      toast({ title: "Failed to update room settings", variant: "destructive" });
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/rooms/${room.id}`);
    },
    onError: () => {
      toast({ title: "Failed to delete room", variant: "destructive" });
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
    },
    onError: () => {
      toast({ title: "Failed to update theme", variant: "destructive" });
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
    },
    onError: () => {
      toast({ title: "Failed to update welcome message", variant: "destructive" });
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
          const isScreenTrack = track.label?.toLowerCase().includes("screen") ||
            track.label?.toLowerCase().includes("monitor") ||
            track.label?.toLowerCase().includes("window") ||
            track.label?.toLowerCase().includes("tab") ||
            track.label?.toLowerCase().includes("display") ||
            (remoteVideoStreams.current.has(peerId) && !remoteScreenStreams.current.has(peerId));

          if (isScreenTrack) {
            remoteScreenStreams.current.set(peerId, stream);
            setAvailableScreenUsers((prev) => { const n = new Set(Array.from(prev)); n.add(peerId); return n; });
            track.onended = () => {
              remoteScreenStreams.current.delete(peerId);
              setAvailableScreenUsers((prev) => { const n = new Set(prev); n.delete(peerId); return n; });
              setRemoteScreenShareUserId((prev) => prev === peerId ? null : prev);
              if (remoteScreenRef.current && remoteScreenRef.current.srcObject === stream) {
                remoteScreenRef.current.srcObject = null;
              }
            };
            track.onmute = () => {
              remoteScreenStreams.current.delete(peerId);
              setAvailableScreenUsers((prev) => { const n = new Set(prev); n.delete(peerId); return n; });
              setRemoteScreenShareUserId((prev) => prev === peerId ? null : prev);
            };
          } else {
            remoteVideoStreams.current.set(peerId, stream);
            setAvailableVideoUsers((prev) => { const n = new Set(Array.from(prev)); n.add(peerId); return n; });
            track.onended = () => {
              remoteVideoStreams.current.delete(peerId);
              setAvailableVideoUsers((prev) => { const n = new Set(prev); n.delete(peerId); return n; });
              setRemoteVideoUserId((prev) => prev === peerId ? null : prev);
              if (remoteVideoRef.current && remoteVideoRef.current.srcObject === stream) {
                remoteVideoRef.current.srcObject = null;
              }
            };
            track.onmute = () => {
              remoteVideoStreams.current.delete(peerId);
              setAvailableVideoUsers((prev) => { const n = new Set(prev); n.delete(peerId); return n; });
              setRemoteVideoUserId((prev) => prev === peerId ? null : prev);
            };
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
    const previousStream = localStream.current;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = keepMuteState ? !isMutedRef.current : false;
    });
    localStream.current = stream;
    if (previousStream && previousStream !== stream) {
      previousStream.getTracks().forEach((track) => track.stop());
    }
    setMicError(false);
    setShowMicHelp(false);
    attachLocalAnalyser(stream);
    await publishLocalAudioStream(stream);
  }, [attachLocalAnalyser, publishLocalAudioStream]);

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

      peerConnections.current.forEach((pc, peerId) => {
        try {
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
            cleanupPeer(peerId);
          }
        } catch (e) {}
      });
    };
    socket.on("connect", handleReconnect);

    const handleVisibilityForRoom = () => {
      if (document.visibilityState === "visible" && socket.connected) {
        socket.emit("room:join", { roomId: room.id, userId: user.id });
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

    socket.on("room:user-left", (data: { userId: string; participants: Participant[] }) => {
      const leftUser = participantsRef.current.find((p) => p.id === data.userId);
      const name = leftUser ? getUserDisplayName(leftUser) : "Someone";
      setParticipants(data.participants);
      participantsRef.current = data.participants;
      cleanupPeer(data.userId);
      setAvailableScreenUsers((prev) => { const n = new Set(prev); n.delete(data.userId); return n; });
      setAvailableVideoUsers((prev) => { const n = new Set(prev); n.delete(data.userId); return n; });
      setRemoteScreenShareUserId((prev) => prev === data.userId ? null : prev);
      setRemoteVideoUserId((prev) => prev === data.userId ? null : prev);
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

    // Mood reactions broadcast — when anyone in the room (including ourselves)
    // picks an emoji from the mood picker, the server echoes a "room:mood-update"
    // back. We stash the emoji keyed by userId so the corresponding participant
    // card pins the mood emoji above their avatar. The mood now PERSISTS until
    // the owner explicitly removes it (room:mood-clear) or picks a new one.
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

    socket.on("room:reaction-update", (data: { messageId: string; reactions: Record<string, string[]> }) => {
      setChatMessages((prev) =>
        prev.map((m) => m.id === data.messageId ? { ...m, reactions: data.reactions } : m)
      );
    });

    socket.on("room:youtube", (data: { videoId: string | null; startedBy?: string }) => {
      setActiveYoutubeId(data.videoId);
      setYoutubeStartedBy(data.videoId ? (data.startedBy || null) : null);
      // A new (or cleared) video resets the per-user "I dismissed this" flag,
      // so the next video gets a fresh chance to be shown. Vote toggles also reset.
      setUserDismissedYoutube(false);
      setMyYtVote(null);
      setMyYtSkipVote(false);
      setYtVotes({ likes: 0, dislikes: 0, skip: 0, watchers: 0 });
      if (!data.videoId) {
        setShowYoutube(false);
        setMiniPlayerMode(false);
        setYoutubeWatchers(new Set());
      } else if (data.startedBy === user.id) {
        // Only auto-open for the broadcaster — watchers must click the broadcaster's avatar
        setShowYoutube(true);
      }
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

    socket.on("room:youtube-watchers-update", (data: { userId: string; watching: boolean }) => {
      setYoutubeWatchers(prev => {
        const next = new Set(prev);
        if (data.watching) next.add(data.userId);
        else next.delete(data.userId);
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
        setAvailableScreenUsers((prev) => { const n = new Set(Array.from(prev)); n.add(data.userId); return n; });
      } else {
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

    socket.on("room:youtube-votes", (data: { videoId?: string; likes: number; dislikes: number; skip: number; watchers: number }) => {
      setYtVotes({ likes: data.likes || 0, dislikes: data.dislikes || 0, skip: data.skip || 0, watchers: data.watchers || 0 });
    });

    socket.on("room:youtube-skipped", () => {
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

    socket.on("room:roles", (roles: Record<string, string>) => {
      setParticipantRoles(roles);
    });

    socket.on("room:roles-update", (data: { userId: string; role: string; roles: Record<string, string> }) => {
      setParticipantRoles(data.roles);
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
      socket.off("room:mood-update");
      // Cancel any in-flight mood-clear timers so they don't fire after unmount.
      Object.values(moodTimersRef.current).forEach((t) => clearTimeout(t));
      moodTimersRef.current = {};
      socket.off("room:mute-update");
      socket.off("room:kicked");
      socket.off("room:host-deleted");
      socket.off("room:joined-another-room");
      socket.off("room:already-in-room");
      socket.off("room:chat-message");
      socket.off("room:chat-delete");
      socket.off("room:reaction-update");
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
      socket.off("room:updated");
      socket.off("room:host-transferred");
      socket.off("user:blocked");
      socket.off("user:unblocked");
      socket.off("room:welcome-message");
      // AI tutor socket.off handled by useAiTutor hook cleanup.
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
    socket.emit("room:youtube-time-request", { roomId: room.id, requesterId: user.id });
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

  useEffect(() => {
    if (isVideoOn && videoStream.current && localVideoRef.current) {
      localVideoRef.current.srcObject = videoStream.current;
    }
  }, [isVideoOn]);

  useEffect(() => {
    if (remoteVideoUserId && remoteVideoRef.current) {
      const stream = remoteVideoStreams.current.get(remoteVideoUserId);
      if (stream) {
        remoteVideoRef.current.srcObject = stream;
      }
    }
  }, [remoteVideoUserId]);

  useEffect(() => {
    if (remoteScreenShareUserId && remoteScreenRef.current) {
      const stream = remoteScreenStreams.current.get(remoteScreenShareUserId);
      if (stream) {
        remoteScreenRef.current.srcObject = stream;
      }
    }
  }, [remoteScreenShareUserId]);

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
    window.addEventListener("resize", scheduleMeasure);
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
                  socketRef.current.emit("room:youtube-time-request", { roomId: room.id, requesterId: user?.id });
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
        console.log("[YT] onYouTubeIframeAPIReady fired");
        createPlayer();
      };
    }

    return () => {
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
    if (!ytIsPlaying || !showYoutube) return;
    // Free4talk-style: anyone watching the player should see their own seek bar update
    const id = setInterval(() => {
      try {
        const t = youtubePlayerRef.current?.getCurrentTime?.() || 0;
        const d = youtubePlayerRef.current?.getDuration?.() || 0;
        setYtCurrentTime(t);
        if (d > 0) setYtDuration(d);
      } catch (_) {}
    }, 1000);
    return () => clearInterval(id);
  }, [ytIsPlaying, showYoutube, user?.id, youtubeStartedBy]);

  useEffect(() => {
    if (!socket || !activeYoutubeId) return;
    socket.emit("room:youtube-watching", { roomId: room.id, watching: showYoutube });
    if (showYoutube) {
      setYoutubeWatchers(prev => { const n = new Set(prev); n.add(user?.id || ""); return n; });
      // Pre-fetch the starter's current playhead the moment a watcher opens the
      // panel — BEFORE the iframe even mounts. The response populates
      // ytSyncTimeRef so that when the player's onReady fires moments later,
      // it can seek directly to the correct position. This eliminates the
      // "starts at 0, then jumps" flash that happened when we waited until
      // onReady to ask for the time.
      if (user?.id && user.id !== youtubeStartedByRef.current) {
        ytSyncTimeRef.current = 0;
        socket.emit("room:youtube-time-request", { roomId: room.id, requesterId: user.id });
      }
    } else {
      setYoutubeWatchers(prev => { const n = new Set(prev); n.delete(user?.id || ""); return n; });
    }
  }, [showYoutube, activeYoutubeId]);

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
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
    socket?.emit("room:mute", { roomId: room.id, userId: user?.id, isMuted: !isMuted });
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
  // room IMMEDIATELY (instead of waiting the 1.5s disconnect grace period). This
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
              disabled={micError}
              data-testid="button-toggle-mute"
              title={isMuted ? "Unmute" : "Mute"}
              className={`${btnBase} disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100`}
              style={isMuted ? ghostStyle : micLiveStyle}
            >
              {isMuted
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

        {/* Camera */}
        <div className="flex flex-col items-center gap-[5px] sm:gap-[7px]">
          <button
            onClick={toggleVideo}
            data-testid="button-toggle-video"
            title={isVideoOn ? "Stop Camera" : "Camera"}
            className={btnBase}
            style={isVideoOn ? videoActiveStyle : ghostStyle}
          >
            {isVideoOn ? <Video className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" /> : <VideoOff className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />}
          </button>
          <span className={labelBase} style={isVideoOn ? { color: "rgba(147,197,253,0.85)" } : { color: "rgba(255,255,255,0.32)" }}>
            Camera
          </span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-[5px] sm:gap-[7px]">
          <button
            onClick={handleScreenShare}
            data-testid="button-screen-share"
            title={isScreenSharing ? "Stop Share" : "Share Screen"}
            className={btnBase}
            style={isScreenSharing ? screenShareActiveStyle : ghostStyle}
          >
            <Monitor className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
          </button>
          <span className={labelBase} style={isScreenSharing ? { color: "rgba(196,181,253,0.85)" } : { color: "rgba(255,255,255,0.32)" }}>
            Share
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
              <BrainCircuit className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" style={aiTutorActive ? { filter: "drop-shadow(0 0 6px hsl(var(--neu-orange-hi) / 0.85))" } : undefined} />
            </button>
          </div>
          <span className={labelBase} style={{ color: aiTutorActive ? "hsl(var(--neu-orange-hi) / 0.95)" : "hsl(var(--neu-orange-hi) / 0.72)" }}>
            {aiTutorActive ? aiPersonaName : "AI Tutor"}
          </span>
        </div>

        <div className="mx-0.5 h-7 sm:h-10 w-px self-center" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.11) 50%, transparent 100%)" }} />

        {/* Leave */}
        <div className="flex flex-col items-center gap-[5px] sm:gap-[7px]">
          <button
            onClick={handleLeave}
            data-testid="button-leave-room"
            title="Leave Room"
            className={btnBase}
            style={leaveStyle}
          >
            <PhoneOff className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]" />
          </button>
          <span className={labelBase} style={{ color: "rgba(252,165,165,0.72)" }}>
            Leave
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
    const myRole = participantRoles[user?.id || ""] || "guest";
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

  const myRole = participantRoles[user?.id || ""] || "guest";
  const canAssignRoles = isHost || myRole === "co-owner";
  // Anyone in the room can play / queue YouTube videos. The person who starts
  // a video becomes its host — they are the only one who can stop it for
  // everyone. Other participants can hide it locally without affecting anyone.
  const canPlayYoutube = true;

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
    socket?.emit("room:screen-share", { roomId: room.id, userId: user?.id, active: false });
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      await stopMyScreenShare();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStream.current = stream;
      setIsScreenSharing(true);
      socket?.emit("room:screen-share", { roomId: room.id, userId: user?.id, active: true });
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }
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
          console.error("Error adding screen track to peer:", peerId, e);
        }
      }
      stream.getVideoTracks()[0].onended = () => {
        removeScreenTracksFromPeers();
        setIsScreenSharing(false);
        screenStream.current = null;
        socket?.emit("room:screen-share", { roomId: room.id, userId: user?.id, active: false });
      };
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  };

  const toggleVideo = async () => {
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
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      socket?.emit("room:video-status", { roomId: room.id, active: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
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
    } catch (err) {
      console.error("Camera access failed:", err);
      toast({ title: "Camera access denied", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (sidePanelTab !== "youtube") return;
    setYoutubeFeaturedLoading(true);
    fetch(`/api/youtube/featured?category=${encodeURIComponent(youtubeCategory)}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setYoutubeFeatured(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setYoutubeFeaturedLoading(false));
  }, [sidePanelTab, youtubeCategory]);

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
    if (showEReader || selectedBook) {
      handleCloseBook();
    }
    setActiveYoutubeId(videoId);
    setShowYoutube(true);
    socket?.emit("room:youtube", { roomId: room.id, videoId });
    setYoutubeSearch("");
    setYoutubeResults([]);
  };

  const formatYtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleStopYoutube = () => {
    setActiveYoutubeId(null);
    setShowYoutube(false);
    setMiniPlayerMode(false);
    setFocusedUserId(null);
    setYoutubeWatchers(new Set());
    setYtIsPlaying(false);
    setYtCurrentTime(0);
    setYtDuration(0);
    setYtQueue([]);
    youtubePlayerRef.current?.destroy();
    youtubePlayerRef.current = null;
    socket?.emit("room:youtube", { roomId: room.id, videoId: null });
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

  const handleWatchYoutube = () => {
    setShowYoutube((prev) => !prev);
  };

  const mentionFilteredParticipants = mentionQuery !== null
    ? participants.filter((p) => {
        const name = getUserDisplayName(p).toLowerCase();
        return name.includes(mentionQuery.toLowerCase());
      })
    : [];

  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
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
    if (isAtBottom || isOwnMessage) {
      viewport.scrollTop = viewport.scrollHeight;
      setUnreadCount(0);
      if (!isAtBottom && isOwnMessage) setIsAtBottom(true);
    } else if (lastMsg.type !== "system") {
      setUnreadCount(prev => prev + 1);
    }
  }, [chatMessages, isAtBottom, user?.id]);

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

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (mentionQuery !== null && mentionFilteredParticipants.length > 0) {
      insertMention(mentionFilteredParticipants[mentionIndex]);
      return;
    }
    if (!chatText.trim() || !socket || !user) return;
    socket.emit("room:chat", {
      roomId: room.id,
      userId: user.id,
      text: chatText.trim(),
      messageColor: chatMessageColor,
      privateToId: privateChatToId === "public" ? null : privateChatToId,
      replyTo: replyingTo || undefined,
    });
    setChatText("");
    setMentionQuery(null);
    setReplyingTo(null);
  };

  const handleReact = (messageId: string, emoji: string) => {
    if (!socket || !user) return;
    socket.emit("room:react", { roomId: room.id, messageId, emoji });
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

    if (videoTabVR === "youtube" && selectedYtVR) {
      await apiRequest("PATCH", `/api/rooms/${room.id}`, { hologramVideoUrl: buildYtEmbed(selectedYtVR) });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    } else if (videoTabVR === "youtube" && ytLinkVR.trim()) {
      const id = extractYtId(ytLinkVR.trim());
      if (id) {
        await apiRequest("PATCH", `/api/rooms/${room.id}`, { hologramVideoUrl: buildYtEmbed(id) });
        queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      }
    } else if (hologramFileVR) {
      setUploadingVideoVR(true);
      try {
        const formData = new FormData();
        formData.append("video", hologramFileVR);
        const res = await fetch("/api/upload/hologram", { method: "POST", body: formData, credentials: "include" });
        const data = await res.json();
        if (res.ok) {
          await apiRequest("PATCH", `/api/rooms/${room.id}`, { hologramVideoUrl: data.url });
          queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
        }
      } finally {
        setUploadingVideoVR(false);
      }
    }

    updateRoomMutation.mutate({
      title: editTitle.trim(),
      language: editLanguage,
      level: editLevel,
      maxUsers: editMaxUsers,
      roomTheme: editRoomTheme,
    });
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

  const loadBookText = async (book: any, fromShared = false) => {
    if (activeYoutubeId) {
      handleStopYoutube();
    }
    setSelectedBook(book);
    setBookText("");
    setWordInfo(null);
    setBookLoading(true);
    setShowEReader(true);
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
      {/* Icon-only tab switcher row */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/[0.07] shrink-0">
        {/* Chat */}
        <div className="relative">
          <button
            onClick={() => setSidePanelTab("chat")}
            data-testid="tab-chat"
            title="Chat"
            className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all duration-200 hover:-translate-y-px hover:scale-[1.04] active:scale-[0.96]"
            style={sidePanelTab === "chat"
              ? { background: "hsl(var(--neu-orange) / 0.18)", border: "1px solid hsl(var(--neu-orange) / 0.40)", color: "hsl(var(--neu-orange-hi) / 0.96)", boxShadow: "0 0 12px hsl(var(--neu-orange) / 0.28), inset 0 1px 0 rgba(220,210,255,0.18)" }
              : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
            }
          >
            <MessageSquare className="w-[15px] h-[15px]" />
          </button>
          {unreadChatBadge > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center leading-none pointer-events-none" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.5)" }}>
              {unreadChatBadge > 99 ? "99+" : unreadChatBadge}
            </span>
          )}
        </div>
        {/* YouTube */}
        <button
          onClick={() => setSidePanelTab("youtube")}
          data-testid="tab-youtube"
          title="YouTube"
          className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all duration-200 hover:-translate-y-px hover:scale-[1.04] active:scale-[0.96]"
          style={sidePanelTab === "youtube"
            ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.22)", color: "rgba(252,100,100,0.92)", boxShadow: "0 0 10px rgba(239,68,68,0.10)" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
          }
        >
          <Youtube className="w-[15px] h-[15px]" />
        </button>
        {/* Read */}
        <button
          onClick={() => setSidePanelTab("read")}
          data-testid="tab-read"
          title="Read"
          className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all duration-200 hover:-translate-y-px hover:scale-[1.04] active:scale-[0.96]"
          style={sidePanelTab === "read"
            ? { background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.22)", color: "rgba(110,231,183,0.92)", boxShadow: "0 0 10px rgba(52,211,153,0.10)" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
          }
        >
          <BookOpen className="w-[15px] h-[15px]" />
        </button>
        {/* Chess */}
        <button
          onClick={() => setSidePanelTab("chess")}
          data-testid="tab-chess"
          title="Chess"
          className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all duration-200 hover:-translate-y-px hover:scale-[1.04] active:scale-[0.96]"
          style={sidePanelTab === "chess"
            ? { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.22)", color: "rgba(253,224,71,0.92)", boxShadow: "0 0 10px rgba(251,191,36,0.10)" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
          }
        >
          <Gamepad2 className="w-[15px] h-[15px]" />
        </button>
        {/* Go Live */}
        <button
          onClick={() => setSidePanelTab("golive")}
          data-testid="tab-golive"
          title="Go Live"
          className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all duration-200 hover:-translate-y-px hover:scale-[1.04] active:scale-[0.96]"
          style={sidePanelTab === "golive"
            ? { background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.28)", color: "rgba(252,80,80,0.95)", boxShadow: "0 0 10px rgba(239,68,68,0.14)" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
          }
        >
          <Radio className="w-[15px] h-[15px]" />
        </button>
        {/* People */}
        <button
          onClick={() => setSidePanelTab("people")}
          data-testid="tab-people"
          title="People"
          className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all duration-200 hover:-translate-y-px hover:scale-[1.04] active:scale-[0.96]"
          style={sidePanelTab === "people"
            ? { background: "hsla(var(--neu-orange) / 0.18)", border: "1px solid hsla(var(--neu-orange) / 0.34)", color: "hsla(var(--neu-orange-hi) / 0.95)", boxShadow: "0 0 10px hsla(var(--neu-orange) / 0.18), inset 0 1px 0 rgba(255,255,255,0.06)" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
          }
        >
          <UsersRound className="w-[15px] h-[15px]" />
        </button>
      </div>

      <div className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" style={{ display: sidePanelTab === "chat" ? "flex" : "none" }}>
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-muted/10">
          <button
            onClick={() => setShowMentionsOnly(false)}
            className={`text-[11px] px-3 py-1 rounded-full transition-all duration-150 font-medium ${!showMentionsOnly ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/60"}`}
            data-testid="filter-all-messages"
          >
            All
          </button>
          <button
            onClick={() => setShowMentionsOnly(true)}
            className={`text-[11px] px-3 py-1 rounded-full transition-all duration-150 flex items-center gap-1 font-medium ${showMentionsOnly ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/60"}`}
            data-testid="filter-mentions"
          >
            <AtSign className="w-2.5 h-2.5" /> Mentions
          </button>
          {isHost && (
            <button
              onClick={() => setWelcomeDialogOpen(true)}
              data-testid="button-chat-welcome"
              title={welcomeText ? "Edit welcome message" : "Set welcome message"}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150"
              style={welcomeText
                ? { background: "hsla(var(--neu-orange) / 0.22)", border: "1px solid hsla(var(--neu-orange) / 0.40)", color: "hsla(var(--neu-orange-hi) / 0.95)", boxShadow: "0 0 8px hsla(var(--neu-orange) / 0.22), inset 0 1px 0 rgba(255,255,255,0.06)" }
                : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
              }
            >
              <span className="text-[12px] leading-none">👋</span>
              <span>{welcomeText ? "Welcome" : "Add Welcome"}</span>
            </button>
          )}
        </div>
        <ScrollArea className="flex-1 min-h-0" ref={chatScrollRef} onScroll={handleScroll}>
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
                        <img key={i} src={url} alt="welcome" className="max-h-40 rounded-lg object-cover" data-testid={`img-welcome-media-${msg.id}-${i}`} />
                      ))}
                    </div>
                  ) : null;
                  const bodyBlock = msg.welcomeMessage ? (
                    <p className="text-[12px] text-white/80 leading-relaxed whitespace-pre-wrap">{msg.welcomeMessage}</p>
                  ) : null;
                  return (
                    <div key={msg.id} className="mx-1 mb-2 rounded-xl border overflow-hidden" style={{ borderColor: wAccent + "55", background: wAccent + "15" }} data-testid={`room-chat-${msg.id}`}>
                      <div className="px-3 py-1.5 flex items-center gap-1.5 border-b" style={{ borderColor: wAccent + "33", background: wAccent + "22" }}>
                        <span className="text-base">👋</span>
                        <span className="text-[11px] font-semibold" style={{ color: wAccent }}>Welcome Message</span>
                        <button
                          onClick={() => setDismissedWelcomeIds(prev => { const next = new Set(Array.from(prev)); next.add(msg.id); return next; })}
                          className="ml-auto p-0.5 rounded hover:bg-black/20 transition-colors opacity-50 hover:opacity-100"
                          title="Close"
                          data-testid={`button-dismiss-welcome-${msg.id}`}
                        >
                          <X className="w-3 h-3" style={{ color: wAccent }} />
                        </button>
                      </div>
                      <div className="px-3 py-2 flex flex-col gap-1.5">
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
                            <AvatarImage src={msg.badgeUserAvatar ?? undefined} />
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
                  return (
                    <div key={msg.id} className="flex items-center justify-center gap-1.5 py-0.5" data-testid={`room-chat-${msg.id}`}>
                      <div className="h-px flex-1 bg-border/30" />
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 bg-muted/20 rounded-full px-2.5 py-0.5">
                        {msg.text.includes("joined") ? (
                          <LogIn className="w-2.5 h-2.5 text-emerald-500/70" />
                        ) : msg.text.includes("left") ? (
                          <LogOut className="w-2.5 h-2.5 text-rose-400/70" />
                        ) : (
                          <Shield className="w-2.5 h-2.5 text-primary/60" />
                        )}
                        <span>{msg.text}</span>
                      </div>
                      <div className="h-px flex-1 bg-border/30" />
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

                const msgParticipant = participants.find((p) => p.id === msg.userId);
                const msgUser = msg.user || msgParticipant;
                const pIndex = participants.findIndex((p) => p.id === msg.userId);
                const gradient = getAvatarGradient(pIndex >= 0 ? pIndex : 0);
                const reactions = msg.reactions || {};
                const hasReactions = Object.keys(reactions).some((e) => reactions[e].length > 0);
                const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "👏"];

                return (
                  <div
                    key={msg.id}
                    className="group flex items-start gap-2.5 relative rounded-lg px-2 py-1.5 -mx-2 transition-colors duration-100 hover:bg-muted/20"
                    data-testid={`room-chat-${msg.id}`}
                    onMouseEnter={() => setHoveredMsgId(msg.id)}
                    onMouseLeave={() => setHoveredMsgId(null)}
                  >
                    <div className={`rounded-full p-[2px] bg-gradient-to-br ${gradient} flex-shrink-0 mt-0.5 shadow-sm`}>
                      <Avatar className="w-8 h-8 border border-background/80">
                        <AvatarImage src={msgUser?.profileImageUrl || undefined} />
                        <AvatarFallback className={`text-xs bg-gradient-to-br ${gradient} text-white`}>
                          {getUserInitials(msgUser)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                        <span className="text-[12px] font-semibold min-w-0 break-words [overflow-wrap:anywhere] tracking-tight">{getUserDisplayName(msgUser)}</span>
                        <span className="text-[10px] text-muted-foreground/50">{formatTime(msg.createdAt)}</span>
                        {msg.isPrivate && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-400/40 text-amber-300" data-testid={`badge-private-message-${msg.id}`}>
                            <LockKeyhole className="w-2.5 h-2.5 mr-1" />
                            Private to {msg.privateToId === user?.id ? "you" : msg.privateToName}
                          </Badge>
                        )}
                      </div>
                      {msg.replyTo && (
                        <div className="mt-0.5 mb-1.5 pl-2 border-l-2 border-primary/40 rounded-r-md" style={{ background: "rgba(255,255,255,0.04)" }}>
                          <span className="text-[10px] font-semibold text-primary/70 block px-1.5 pt-1">{msg.replyTo.userName}</span>
                          <div className="px-1.5 pb-1 text-xs opacity-80 pointer-events-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]" data-testid={`reply-preview-message-${msg.id}`}>
                            {renderReplyPreview(msg.replyTo.text)}
                          </div>
                        </div>
                      )}
                      <div
                        className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] mt-0.5 max-w-full"
                        style={{ color: msg.messageColor || undefined }}
                        data-testid={`text-room-chat-${msg.id}`}
                      >
                        {renderMessageContent(msg.text, (url) => setLightboxMedia({ url, msgId: msg.id }), (id) => handleSelectYoutubeVideo(id))}
                      </div>
                      {hasReactions && (
                        <div className="flex flex-wrap gap-1 mt-1.5" data-testid={`reactions-${msg.id}`}>
                          {Object.entries(reactions).filter(([, uids]) => uids.length > 0).map(([emoji, uids]) => (
                            <button
                              key={emoji}
                              onClick={() => handleReact(msg.id, emoji)}
                              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${uids.includes(user?.id || "") ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted border-border hover:bg-muted/80"}`}
                              data-testid={`reaction-${msg.id}-${emoji}`}
                            >
                              <span>{emoji}</span>
                              <span className="font-medium">{uids.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {hoveredMsgId === msg.id && (
                      <div className="absolute right-0 top-0 flex items-center gap-0.5 bg-popover border rounded-md shadow-sm px-1 py-0.5 z-10">
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
                          className="ml-1 text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-accent transition-colors"
                          data-testid={`button-reply-${msg.id}`}
                        >
                          Reply
                        </button>
                        {msg.userId === user?.id && (
                          <button
                            onClick={() => {
                              socket?.emit("room:chat-delete", { roomId: room.id, messageId: msg.id, deletedBy: user.id });
                              setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, text: "This message was deleted.", type: "deleted" as any, reactions: {}, replyTo: null } : m));
                            }}
                            className="ml-1 text-[10px] text-destructive hover:text-white px-1 py-0.5 rounded hover:bg-destructive transition-colors flex items-center gap-1"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" /> Del
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            );
            })()}
          </div>
        </ScrollArea>
        <form onSubmit={handleSendChat} className="p-3 border-t border-border/40 bg-muted/5 flex flex-col gap-2 relative flex-shrink-0 mt-auto">
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
                    <AvatarImage src={p.profileImageUrl || ""} />
                    <AvatarFallback className="text-[10px]">{getUserInitials(p)}</AvatarFallback>
                  </Avatar>
                  <span>{getUserDisplayName(p)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <div className="absolute top-1.5 right-1.5 z-10">
              <EmojiPickerButton onEmojiSelect={(emoji) => setChatText((prev) => prev + emoji)} />
            </div>
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
              placeholder={pasteUploading ? "Uploading image..." : privateChatToId === "public" ? "Message the room…" : "Private message…"}
              disabled={pasteUploading}
              className="flex w-full rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5 pr-10 text-[13px] ring-offset-background placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/30 resize-none disabled:opacity-50 transition-all duration-150 leading-relaxed"
              style={privateChatToId !== "public" ? { borderColor: "rgba(251,191,36,0.35)", boxShadow: "0 0 0 1px rgba(251,191,36,0.15)" } : undefined}
              rows={2}
              data-testid="input-room-chat"
            />
          </div>

          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-lg transition-colors ${privateChatToId !== "public" ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid="button-chat-mode-toggle"
                    aria-label={privateChatToId === "public" ? "Switch to private" : "Switch to public"}
                  >
                    {privateChatToId === "public" ? <Globe className="w-3.5 h-3.5" /> : <LockKeyhole className="w-3.5 h-3.5" />}
                  </Button>
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
                            <AvatarImage src={p.profileImageUrl || ""} />
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
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" data-testid="button-chat-color-picker" aria-label="Message color">
                    <span className="w-3 h-3 rounded-full border border-border/60" style={{ backgroundColor: chatMessageColor }} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-3" side="top" align="start">
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Message color</p>
                    <div className="grid grid-cols-6 gap-2">
                      {["#e5e7eb", "#22d3ee", "#a78bfa", "#facc15", "#fb7185", "#4ade80", "#f97316", "#60a5fa", "#f0abfc", "#ffffff", "#c084fc", "#2dd4bf"].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setChatMessageColor(color)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${chatMessageColor === color ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
                          style={{ backgroundColor: color }}
                          data-testid={`button-chat-color-${color.replace("#", "")}`}
                          aria-label={`Set chat color ${color}`}
                        />
                      ))}
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
            <Button
              type="submit"
              size="sm"
              disabled={!chatText.trim()}
              data-testid="button-send-room-chat"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              Send
            </Button>
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
              const broadcaster = participants.find(p => p.id === youtubeStartedBy);
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
                        <img src={item.thumbnail} alt="" className="w-12 h-8 rounded object-cover flex-shrink-0 bg-muted" />
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
              <div className="p-3 space-y-3">
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
                          <img src={video.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
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
                    <div className="flex items-center gap-1.5 px-0.5">
                      <TrendingUp className="w-3 h-3 text-red-400/70" />
                      <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest">
                        {youtubeFeaturedLoading ? "Loading…" : "Trending Now"}
                      </p>
                    </div>
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
                      <div
                        key={video.id}
                        className="rounded-xl overflow-hidden border border-border/30 bg-muted/10 hover:border-border/50 transition-all duration-150 group"
                      >
                        <div className="relative w-full aspect-video bg-muted overflow-hidden cursor-pointer" onClick={() => handleSelectYoutubeVideo(video.id)}>
                          <img src={video.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
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
                              >
                                <Play className="w-2.5 h-2.5 fill-red-400" /> Play Now
                              </button>
                              <button
                                onClick={() => handleAddToQueue({ id: video.id, title: video.title, thumbnail: video.thumbnail })}
                                className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-muted/20 border border-border/30 text-muted-foreground text-[10px] font-medium hover:bg-muted/40 transition-colors"
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
              </div>
            </ScrollArea>
          )}

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
                <img src={sharedBook.formats["image/jpeg"]} alt="" className="w-8 h-11 rounded object-cover flex-shrink-0 bg-muted" />
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
                  <img src={selectedBook.formats["image/jpeg"]} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0 bg-muted" />
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
            <div className="p-3 pb-2 border-b flex-shrink-0">
              <p className="text-xs text-muted-foreground mb-2">Search free books from Project Gutenberg. Host opens a book to share it — followers sync scroll automatically.</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={readSearch}
                    onChange={(e) => setReadSearch(e.target.value)}
                    placeholder="Search books..."
                    className="pl-8 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") searchGutenberg(readSearch); }}
                  />
                </div>
                <Button size="sm" onClick={() => searchGutenberg(readSearch)} disabled={readLoading || !readSearch.trim()}>
                  {readLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-2">
                {readLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {readBooks.length === 0 && readCatalog.length === 0 && readAudiobooks.length === 0 && readVideos.length === 0 && !readLoading && (
                  <div className="text-center py-8 space-y-2 text-muted-foreground">
                    <BookOpen className="w-8 h-8 mx-auto opacity-30" />
                    <p className="text-xs">No matches. Try a different search.</p>
                    <button onClick={loadDefaultBooks} className="text-xs text-primary hover:underline" data-testid="link-browse-bestsellers">Browse bestsellers</button>
                  </div>
                )}
                {readBooks.length > 0 && !readSearch.trim() && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-1">📚 Popular Bestsellers</p>
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
                      <img src={book.formats["image/jpeg"]} alt="" className="w-12 h-16 rounded object-cover flex-shrink-0 bg-muted" />
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
                          setActiveYoutubeId(v.id);
                          setShowYoutube(true);
                          socket?.emit("room:youtube", { roomId: room.id, videoId: v.id });
                        }}
                        className="w-full flex items-start gap-2 p-2 rounded-lg border hover:bg-muted/50 text-left transition-colors"
                        data-testid={`button-video-${v.id}`}
                      >
                        {v.thumbnail ? (
                          <img src={v.thumbnail} alt="" className="w-16 h-10 rounded object-cover flex-shrink-0 bg-muted" />
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
                      <BookOpen className="w-3 h-3" /> More from Open Library
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
                          <img src={c.coverUrl} alt="" className="w-12 h-16 rounded object-cover flex-shrink-0 bg-muted" />
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
          <ChessPanel socket={socket} roomId={room.id} userId={user.id} participants={participants} />
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
        <div className="p-3 pb-2 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold">Go Live</p>
              <p className="text-[10px] text-muted-foreground">Stream this room to your audience</p>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {/* Platform selector */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
            {(["youtube", "twitch", "tiktok"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setGoLivePlatform(p)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                style={goLivePlatform === p
                  ? { background: p === "youtube" ? "rgba(239,68,68,0.20)" : p === "twitch" ? "rgba(145,70,255,0.20)" : "rgba(0,0,0,0.30)", color: p === "youtube" ? "#fc6464" : p === "twitch" ? "#bf94ff" : "#ffffff", border: "1px solid " + (p === "youtube" ? "rgba(239,68,68,0.30)" : p === "twitch" ? "rgba(145,70,255,0.30)" : "rgba(255,255,255,0.15)") }
                  : { color: "rgba(255,255,255,0.40)", border: "1px solid transparent" }
                }
              >
                {p === "youtube" ? "YouTube" : p === "twitch" ? "Twitch" : "TikTok"}
              </button>
            ))}
          </div>

          {/* Steps */}
          {goLivePlatform === "youtube" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {[
                  { step: "1", text: "Go to YouTube Studio → Go Live → Stream" },
                  { step: "2", text: "Copy your Stream URL and Stream Key from YouTube" },
                  { step: "3", text: "In OBS: Settings → Stream → Service: YouTube → paste key" },
                  { step: "4", text: "In OBS: Add \"Screen Capture\" source pointing to this tab" },
                  { step: "5", text: "Click Start Streaming in OBS" },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-white">{step}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{text}</p>
                  </div>
                ))}
              </div>
              <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer" className="block">
                <button className="w-full py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "rgba(239,68,68,0.80)", border: "1px solid rgba(239,68,68,0.40)" }}>
                  <ExternalLink className="w-3.5 h-3.5" /> Open YouTube Studio
                </button>
              </a>
            </div>
          )}
          {goLivePlatform === "twitch" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {[
                  { step: "1", text: "Go to Twitch Dashboard → Settings → Stream" },
                  { step: "2", text: "Copy your Primary Stream Key" },
                  { step: "3", text: "In OBS: Settings → Stream → Service: Twitch → paste key" },
                  { step: "4", text: "In OBS: Add \"Screen Capture\" source pointing to this tab" },
                  { step: "5", text: "Click Start Streaming in OBS" },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-white">{step}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{text}</p>
                  </div>
                ))}
              </div>
              <a href="https://dashboard.twitch.tv/settings/stream" target="_blank" rel="noopener noreferrer" className="block">
                <button className="w-full py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "rgba(145,70,255,0.70)", border: "1px solid rgba(145,70,255,0.40)" }}>
                  <ExternalLink className="w-3.5 h-3.5" /> Open Twitch Dashboard
                </button>
              </a>
            </div>
          )}
          {goLivePlatform === "tiktok" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {[
                  { step: "1", text: "Open TikTok app → tap + → Go Live → PC Stream" },
                  { step: "2", text: "Copy the Stream URL and Stream Key from TikTok" },
                  { step: "3", text: "In OBS: Settings → Stream → Custom RTMP → paste URL & key" },
                  { step: "4", text: "In OBS: Add \"Screen Capture\" source pointing to this tab" },
                  { step: "5", text: "Click Start Streaming in OBS" },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-white">{step}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{text}</p>
                  </div>
                ))}
              </div>
              <a href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer" className="block">
                <button className="w-full py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "rgba(0,0,0,0.60)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <ExternalLink className="w-3.5 h-3.5" /> Open TikTok
                </button>
              </a>
            </div>
          )}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/60">Need OBS? Download free at <a href="https://obsproject.com" target="_blank" rel="noopener noreferrer" className="text-primary/80 hover:text-primary">obsproject.com</a></p>
          </div>
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
                        <AvatarImage src={u.profileImageUrl ?? undefined} />
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
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all duration-150"
                        style={isFollowingUser
                          ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)", border: "1px solid rgba(255,255,255,0.10)" }
                          : { background: "hsla(var(--neu-orange) / 0.22)", color: "hsla(var(--neu-orange-hi) / 0.95)", border: "1px solid hsla(var(--neu-orange) / 0.34)" }
                        }
                      >
                        {isFollowingUser ? "Following" : "Follow"}
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

      <Dialog open={goLiveOpen} onOpenChange={setGoLiveOpen}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              </div>
              Go Live
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Stream your room to YouTube, Twitch, or TikTok using broadcasting software (OBS, Streamlabs, etc.)</p>
          <div className="flex gap-1 border-b pb-3">
            {(["youtube", "twitch", "tiktok"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setGoLivePlatform(p)}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${goLivePlatform === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                {p === "youtube" ? "YouTube" : p === "twitch" ? "Twitch" : "TikTok"}
              </button>
            ))}
          </div>
          {goLivePlatform === "youtube" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {[
                  { step: "1", text: "Go to YouTube Studio → Go Live → Stream" },
                  { step: "2", text: "Copy your Stream URL and Stream Key from YouTube" },
                  { step: "3", text: "In OBS: Settings → Stream → Service: YouTube → paste key" },
                  { step: "4", text: "In OBS: Add \"Screen Capture\" source pointing to this browser tab" },
                  { step: "5", text: "Click Start Streaming in OBS" },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-white">{step}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
              <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full bg-red-600 hover:bg-red-500 text-white">
                  <ExternalLink className="w-4 h-4 mr-2" /> Open YouTube Studio
                </Button>
              </a>
            </div>
          )}
          {goLivePlatform === "twitch" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {[
                  { step: "1", text: "Go to Twitch Dashboard → Settings → Stream" },
                  { step: "2", text: "Copy your Primary Stream Key" },
                  { step: "3", text: "In OBS: Settings → Stream → Service: Twitch → paste key" },
                  { step: "4", text: "In OBS: Add \"Screen Capture\" source pointing to this browser tab" },
                  { step: "5", text: "Click Start Streaming in OBS" },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-white">{step}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
              <a href="https://dashboard.twitch.tv/settings/stream" target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white">
                  <ExternalLink className="w-4 h-4 mr-2" /> Open Twitch Dashboard
                </Button>
              </a>
            </div>
          )}
          {goLivePlatform === "tiktok" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {[
                  { step: "1", text: "Open TikTok app → tap + → Go Live → PC Stream" },
                  { step: "2", text: "Copy the Stream URL and Stream Key shown in TikTok" },
                  { step: "3", text: "In OBS: Settings → Stream → Custom RTMP → paste URL & key" },
                  { step: "4", text: "In OBS: Add \"Screen Capture\" source pointing to this browser tab" },
                  { step: "5", text: "Click Start Streaming in OBS" },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-white">{step}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
              <a href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full bg-black hover:bg-zinc-800 text-white">
                  <ExternalLink className="w-4 h-4 mr-2" /> Open TikTok
                </Button>
              </a>
            </div>
          )}
          <div className="pt-2 border-t">
            <p className="text-[10px] text-muted-foreground text-center">Need OBS? Download free at <a href="https://obsproject.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">obsproject.com</a></p>
          </div>
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
              <Select value={String(editMaxUsers)} onValueChange={(v) => setEditMaxUsers(Number(v))}>
                <SelectTrigger data-testid="select-edit-max-users">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 4, 6, 8, 10, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} people</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Card Background Video</Label>
                {(room as any).hologramVideoUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest("PATCH", `/api/rooms/${room.id}`, { hologramVideoUrl: null });
                      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
                      setHologramPreviewVR(null);
                      setHologramFileVR(null);
                      setSelectedYtVR(null);
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="flex rounded-md border border-border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setVideoTabVR("upload")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${videoTabVR === "upload" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  <Video className="w-3 h-3" /> Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setVideoTabVR("youtube")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${videoTabVR === "youtube" ? "bg-red-600 text-white" : "hover:bg-muted"}`}
                >
                  <Youtube className="w-3 h-3" /> YouTube
                </button>
              </div>

              {videoTabVR === "upload" && (
                <div className="flex items-center gap-3">
                  {hologramPreviewVR && (
                    <video src={hologramPreviewVR} autoPlay loop muted playsInline className="w-12 h-12 rounded-md object-cover border-2 border-cyan-400" />
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => videoInputVR.current?.click()} className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    {hologramFileVR ? "Change File" : (room as any).hologramVideoUrl ? "Replace Video" : "Upload Video"}
                  </Button>
                  <input
                    ref={videoInputVR}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setHologramFileVR(file);
                      setHologramPreviewVR(URL.createObjectURL(file));
                    }}
                  />
                </div>
              )}

              {videoTabVR === "youtube" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                    <Input placeholder="Paste YouTube link or search..." value={ytLinkVR || ytQueryVR} onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes("youtube.com") || val.includes("youtu.be")) { setYtLinkVR(val); setYtQueryVR(""); }
                      else { setYtQueryVR(val); setYtLinkVR(""); handleYtQueryVR(val); }
                    }} className="pl-8 text-sm h-8" />
                    {ytSearchingVR && <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
                    {ytResultsVR.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg max-h-44 overflow-y-auto">
                        {ytResultsVR.map((v: any) => (
                          <button key={v.id} type="button"
                            onClick={() => { setSelectedYtVR(v.id); setYtResultsVR([]); setYtQueryVR(""); }}
                            className={`w-full flex items-center gap-2 p-1.5 text-left text-xs transition-colors hover:bg-muted ${selectedYtVR === v.id ? "bg-red-500/10" : ""}`}
                          >
                            <img src={v.thumbnail?.url || `https://img.youtube.com/vi/${v.id}/default.jpg`} className="w-10 h-7 object-cover rounded flex-shrink-0" />
                            <span className="truncate">{v.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedYtVR && (
                    <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-md border border-red-500/30">
                      <img src={`https://img.youtube.com/vi/${selectedYtVR}/default.jpg`} className="w-10 h-7 object-cover rounded" />
                      <span className="text-xs flex-1">YouTube video selected</span>
                      <button type="button" onClick={() => setSelectedYtVR(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!editTitle.trim() || updateRoomMutation.isPending || uploadingVideoVR}
              data-testid="button-submit-edit-room"
            >
              {updateRoomMutation.isPending || uploadingVideoVR ? "Saving..." : "Save Changes"}
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
              <Label>Message</Label>
              <textarea
                value={welcomeText}
                onChange={(e) => setWelcomeText(e.target.value)}
                placeholder="Write a greeting for your room…"
                className="w-full resize-none rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[96px]"
                maxLength={500}
                data-testid="input-welcome-message"
              />
              <p className="text-[10px] text-muted-foreground text-right">{welcomeText.length}/500</p>
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
                      <img src={url} alt={`welcome media ${i + 1}`} className="h-20 w-full object-cover" data-testid={`img-welcome-media-${i}`} />
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
            <div className="flex items-center gap-2 min-w-0 flex-1 basis-0">
              <div className="relative flex-shrink-0">
                <div
                  className="w-7 h-7 rounded-[10px] flex items-center justify-center"
                  style={{ background: "rgba(157,134,255,0.10)", border: "1px solid rgba(157,134,255,0.20)", boxShadow: "0 0 10px rgba(91,60,224,0.18)" }}
                  data-testid="brand-room-mark"
                >
                  <VextornMark size={20} />
                </div>
                <span className="absolute -top-px -right-px w-[7px] h-[7px] rounded-full bg-green-400 border border-black/40" style={{ boxShadow: "0 0 4px rgba(74,222,128,0.7)" }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h2
                    className="font-semibold text-[13px] truncate leading-tight"
                    style={{ color: "rgba(255,255,255,0.92)", letterSpacing: "-0.01em" }}
                    data-testid="text-voice-room-title"
                  >
                    {room.title}
                  </h2>
                  {isHost && (
                    <span
                      className="flex-shrink-0 text-[9px] font-bold px-1.5 py-[2px] rounded-md tracking-wider uppercase"
                      style={{ background: "hsl(var(--neu-orange) / 0.18)", color: "hsl(var(--neu-orange-hi) / 0.96)", border: "1px solid hsl(var(--neu-orange) / 0.40)", boxShadow: "0 0 10px hsl(var(--neu-orange) / 0.22), inset 0 1px 0 rgba(220,210,255,0.18)" }}
                    >
                      HOST
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-[2px]">
                  <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.40)" }}>{room.language}</span>
                  <span style={{ color: "rgba(255,255,255,0.16)", fontSize: 10 }}>·</span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.30)" }}>{room.level}</span>
                  <span style={{ color: "rgba(255,255,255,0.16)", fontSize: 10 }}>·</span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.30)" }}>{participants.length}/{room.maxUsers}</span>
                </div>
              </div>
            </div>

            {/* ── Center: Control dock ── */}
            <div className="order-3 flex w-full justify-center md:order-none md:w-auto md:flex-shrink-0">
              {renderControlDock()}
            </div>

            {/* ── Right: Panel toggles ── */}
            <div className="flex items-center justify-end gap-0.5 flex-1 basis-0">
              {/* Social Panel Toggle */}
              {(() => {
                const isActive = sidePanelOpen;
                return (
                  <div className="relative">
                    <button
                      onClick={() => {
                        const isMobile = window.innerWidth < 768;
                        if (isMobile) { setMobileSheetOpen(!mobileSheetOpen); }
                        else { setSidePanelOpen(!sidePanelOpen); }
                      }}
                      data-testid="button-panel-social"
                      title="Social Panel"
                      className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all duration-200 hover:-translate-y-px hover:scale-[1.06] active:scale-[0.96]"
                      style={isActive
                        ? { background: "hsl(var(--neu-orange) / 0.18)", border: "1px solid hsl(var(--neu-orange) / 0.40)", color: "hsl(var(--neu-orange-hi) / 0.96)", boxShadow: "0 0 12px hsl(var(--neu-orange) / 0.28), inset 0 1px 0 rgba(220,210,255,0.18)" }
                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.38)" }
                      }
                    >
                      <LayoutGrid className="w-[14px] h-[14px]" />
                    </button>
                    {unreadChatBadge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center leading-none pointer-events-none" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.5)" }}>
                        {unreadChatBadge > 99 ? "99+" : unreadChatBadge}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Settings */}
              {isHost && (
                <button
                  onClick={() => {
                    setEditTitle(room.title);
                    setEditLanguage(room.language);
                    setEditLevel(room.level);
                    setEditMaxUsers(room.maxUsers);
                    const currentEditTheme = (room as any).roomTheme || "none";
                    const themeIndex = ROOM_THEMES.findIndex((theme) => theme.id === currentEditTheme);
                    setEditRoomTheme(currentEditTheme);
                    setEditThemeOffset(Math.max(0, Math.floor(Math.max(0, themeIndex) / 4) * 4));
                    setEditDialogOpen(true);
                  }}
                  data-testid="button-host-settings"
                  title="Room Settings"
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all duration-200 hover:-translate-y-px hover:scale-[1.06] active:scale-[0.96]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.38)" }}
                >
                  <Settings className="w-[14px] h-[14px]" />
                </button>
              )}
              {!isHost && (() => {
                const ownerUser = participants.find(p => p.id === room.ownerId);
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
                        className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all duration-200 hover:-translate-y-px hover:scale-[1.06] active:scale-[0.96]"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.38)" }}
                      >
                        <Settings className="w-[14px] h-[14px]" />
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
                            <AvatarImage src={ownerAvatar} />
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

        <div className="flex-1 flex flex-col overflow-hidden relative">

          {focusedUserId && !(activeYoutubeId && showYoutube) && !showEReader && !isScreenSharing && !remoteScreenShareUserId && (!isVideoOn || miniCameraMode) && !remoteVideoUserId && (
            <div className="flex-1 min-h-0 relative flex items-center justify-center p-4 cursor-pointer" onClick={() => { setFocusedUserId(null); setMiniCameraMode(false); setMiniPlayerMode(false); }}>
               <div className="w-[40vw] max-w-[160px] sm:max-w-[200px] aspect-square relative rounded-full overflow-hidden shadow-2xl flex flex-col items-center justify-center cursor-default transition-all duration-300 pointer-events-none" onClick={(e) => e.stopPropagation()}>
                  {(() => {
                     const fP = participants.find(p => p.id === focusedUserId);
                     if (!fP) return null;
                     return fP.profileImageUrl ? (
                       <img src={fP.profileImageUrl} className="w-full h-full object-cover pointer-events-auto" />
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
            const broadcaster = participants.find(p => p.id === youtubeStartedBy);
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

          {activeYoutubeId && showYoutube && (() => {
            const isYoutubeHost = true;
            const broadcaster = participants.find(p => p.id === youtubeStartedBy);
            const bIndex = participants.findIndex(p => p.id === youtubeStartedBy);
            const bGradient = getAvatarGradient(bIndex >= 0 ? bIndex : 0);
            return (
              <div
                ref={ytSlotRef}
                className="flex-1 min-h-0 bg-black relative group/ytplayer"
                data-testid="media-main-youtube"
                data-yt-slot="true"
              >
                {/* Persistent player is mounted at top-level (see ytPersistentWrapper).
                    This slot just reserves the visual area; overlays render with the player. */}

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
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {/* Play / Pause */}
                        <button
                          onClick={handleYtPlayPause}
                          className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/28 border border-white/20 flex items-center justify-center transition-colors shadow-lg"
                          data-testid="button-yt-playpause"
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

                {/* Floating watch-party reactions — emojis drift up from the bottom
                    of the video with the sender's avatar attached, so everyone can
                    see WHO reacted. Visible to the starter and to every joined
                    watcher (it lives inside the player container, which renders
                    only when showYoutube is true). */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-10" data-testid="yt-floating-reactions">
                  {ytFloatingReactions.map(r => {
                    const sender = participants.find(p => p.id === r.userId);
                    const senderName = sender ? getUserDisplayName(sender) : "";
                    return (
                      <div
                        key={r.id}
                        className="absolute flex flex-col items-center gap-1 select-none"
                        style={{
                          left: `${r.left}%`,
                          bottom: 0,
                          animation: "ytReactionFloat 2.8s ease-out forwards",
                        }}
                      >
                        <span className="text-3xl" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>
                          {r.emoji}
                        </span>
                        {sender && (
                          <div className="flex items-center gap-1 bg-black/65 backdrop-blur-sm rounded-full pl-0.5 pr-2 py-0.5 border border-white/15 shadow-md">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={sender.profileImageUrl || undefined} />
                              <AvatarFallback className="text-[8px] bg-purple-500/40 text-white">
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

                {/* Reactions toggle (smiley) + collapsible reactions/voting panel.
                    The panel is HIDDEN by default — users tap the smiley to open it.
                    When open it reveals an emoji picker (everyone can fire reactions)
                    and the live like / dislike / skip-vote tally. The skip vote
                    auto-advances the queue once a majority of the room agrees.
                    None of this affects the starter's playhead. */}
                <div
                  className="absolute bottom-3 right-3 z-20 flex items-center gap-2"
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
                          socket.emit("room:youtube-vote", { roomId: room.id, kind: next || "none" });
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
                          socket.emit("room:youtube-vote", { roomId: room.id, kind: next || "none" });
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
                          socket.emit("room:youtube-skip-vote", { roomId: room.id, vote: next });
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
                                <img src={reader.profileImageUrl} className="w-full h-full object-cover" />
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
                    <button onClick={() => setWordInfo(null)} className="p-1 rounded hover:opacity-70 transition-opacity">
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
                ref={(el) => {
                  screenVideoRef.current = el;
                  if (el && screenStream.current) {
                    el.srcObject = screenStream.current;
                  }
                }}
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
                    <img src={user.profileImageUrl} className="w-full h-full object-cover rounded-full" />
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
                ref={(el) => {
                  remoteScreenRef.current = el;
                  if (el && remoteScreenShareUserId) {
                    const stream = remoteScreenStreams.current.get(remoteScreenShareUserId);
                    if (stream) el.srcObject = stream;
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-white/15 rounded-full px-3 py-1 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                  <Monitor className="w-3 h-3 text-orange-400 flex-shrink-0" />
                  <span className="text-white text-xs">{getUserDisplayName(participants.find(p => p.id === remoteScreenShareUserId))} is sharing screen</span>
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
                const sharer = participants.find(p => p.id === remoteScreenShareUserId);
                return sharer ? (
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full pl-1 pr-3 py-1 shadow-lg border border-white/10 z-10">
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-orange-500/60 bg-orange-900/60 flex items-center justify-center">
                      {(sharer as any).profileImageUrl ? (
                        <img src={(sharer as any).profileImageUrl} className="w-full h-full object-cover rounded-full" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
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
                ref={(el) => {
                  remoteVideoRef.current = el;
                  if (el && remoteVideoUserId) {
                    const stream = remoteVideoStreams.current.get(remoteVideoUserId);
                    if (stream) el.srcObject = stream;
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/70 backdrop-blur-sm rounded-full px-3 py-1 text-xs">
                {getUserDisplayName(participants.find(p => p.id === remoteVideoUserId))}
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
                className={`w-full h-full object-cover ${videoFlipped ? "scale-x-[-1]" : ""}`}
              />
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full pl-1 pr-3 py-1 shadow-lg border border-white/10 z-10">
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-orange-500/60 bg-orange-900/60 flex items-center justify-center">
                  {user?.profileImageUrl ? (
                    <img src={user.profileImageUrl} className="w-full h-full object-cover rounded-full" />
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

          <div className={`flex items-end justify-center p-3 pt-5 pb-5 overflow-hidden flex-shrink-0 ${!(activeYoutubeId && showYoutube) && !showEReader && !isScreenSharing && !remoteScreenShareUserId && !remoteVideoUserId && !(isVideoOn && !miniCameraMode) ? "flex-1" : ""}`}>
            <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-5">
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
                                  <img src={watcher.profileImageUrl} className="w-full h-full object-cover" />
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
                                      <img src={reader.profileImageUrl} className="w-full h-full object-cover" />
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
                      hasActiveYoutube={!!activeYoutubeId && youtubeStartedBy === p.id}
                      hasActiveBook={bookReaders.has(p.id)}
                      participantRole={participantRoles[p.id] || "guest"}
                      onProfileClick={() => handleParticipantClick(p.id)}
                      isYoutubeWatcher={youtubeWatchers.has(p.id) && youtubeStartedBy !== p.id}
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
                      hasActiveYoutubeGlobal={!!activeYoutubeId}
                      onWatchYoutube={handleWatchYoutube}
                      isWatchingYoutube={showYoutube}
                      onForceMute={handleForceMute}
                      onKick={handleKick}
                      onBlock={handleBlock}
                      onReport={handleReport}
                      onClearChatGlobal={handleClearChat}
                      onClearChatLocal={() => setChatMessages([])}
                      onReconnect={handleReconnect}
                      volume={participantVolumes[p.id] ?? 1}
                      onVolumeChange={handleVolumeChange}
                      youtubeVideoId={activeYoutubeId}
                      remoteVideoStream={isMe && isVideoOn && miniCameraMode ? localVideoStreamObj : (!isMe && availableVideoUsers.has(p.id) ? remoteVideoStreams.current.get(p.id) : undefined)}
                      localVideoFlipped={isMe ? videoFlipped : false}
                      isBlocked={isBlockedUser}
                      onUnblock={handleUnblock}
                      analyserNode={analysersRef.current.get(p.id)}
                      mood={participantMoods[p.id]}
                      onClearMood={isMe ? clearMyMood : undefined}
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
                    avatar={<NeumorphicAvatarRing glowRgb="0,225,255" intense content={<img src={evaAvatarUrl} alt="Eva avatar" className="w-full h-full object-cover rounded-full" data-testid="img-eva-avatar" />} />}
                    name="Eva"
                    badge="NEW AI"
                    description="ElevenLabs · Natural & expressive"
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
                      <AiTutorFace gender={aiTutorFaceStyle} viseme={currentViseme} speaking={aiTutorDisplaySpeaking} />

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
                    <img src="/ai-face.png" alt="AI" className="w-full h-full object-cover object-top" />
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
                <AvatarImage src={roomDmNotification.fromUser?.profileImageUrl || undefined} />
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
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={lightboxMedia.url}
                alt="media"
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
            <div className={`w-full h-full ${videoFlipped ? "scale-x-[-1]" : ""}`}>
              <RemoteVideoPreview stream={localVideoStreamObj} />
            </div>
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full pointer-events-none">
              You
            </div>
            <button
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); setMiniCameraMode(false); setFocusedUserId(null); }}
              data-testid="button-mini-camera-close"
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
        const target = participants.find(p => p.id === reportTargetUserId);
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
        <DialogContent className="max-w-sm">
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
        <DialogContent className="max-w-sm border-red-500 bg-red-950/10 dark:bg-red-950/30">
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

    </div>
  );
}
