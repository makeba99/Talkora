import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Mic, MicOff, PhoneOff, Hand, Globe, AlertCircle, MessageSquare,
  UserX, VolumeX, Send, X, Monitor, UserPlus, UserCheck, Users, Settings, Youtube,
  Video, VideoOff, LogIn, LogOut, Search, Play, Loader2, Pencil, Shield, Crown,
  Volume2, Copy, Flag, Ban, RefreshCw, Trash2, ChevronUp, Maximize2, Palette,
  Tv, BookOpen, Gamepad2, ExternalLink, Volume1, ChevronLeft, CornerUpLeft, Eye, Bell, LockKeyhole
} from "lucide-react";
import { SiInstagram, SiLinkedin, SiFacebook } from "react-icons/si";
import { useSocket } from "@/lib/socket";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { LANGUAGES, LEVELS } from "@shared/schema";
import { DmDialog } from "@/components/dm-dialog";
import { ReportDialog } from "@/components/report-dialog";
import { EmojiPickerButton, GifPickerButton, ImageUploadButton, renderMessageContent, renderReplyPreview, uploadChatImage } from "@/components/chat-picker";
import { getAvatarRingClass, FlairBadgeDisplay } from "@/components/profile-dropdown";
import { ProfileDecoration, ROOM_THEMES, getRoomThemeStyle, RoomThemeOverlay, getChatPanelStyle } from "@/components/profile-decorations";
import type { Room, User, Follow } from "@shared/schema";

interface VoiceRoomProps {
  room: Room;
  onLeave: () => void;
}

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
  type?: "message" | "system";
  reactions?: Record<string, string[]>;
  replyTo?: { id: string; userId: string; userName: string; text: string } | null;
  messageColor?: string;
  privateToId?: string | null;
  privateToName?: string;
  isPrivate?: boolean;
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
            className="w-1.5 bg-cyan-400/80 rounded-t-sm animate-sound-wave origin-bottom"
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
  analyserNode
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
                   <button className="text-blue-400 font-medium hover:underline px-1" onClick={handleCopyId}>Copy ID</button>
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
            <div className="grid grid-cols-3 gap-2">
               <Button variant="outline" size="sm" onClick={() => onNavigateDm && onNavigateDm(p.id)} className="h-8 text-xs border-border bg-transparent hover:bg-muted px-1">
                  <MessageSquare className="w-3.5 h-3.5 mr-1 text-muted-foreground" /> PM
               </Button>
               <Button variant="outline" size="sm" onClick={() => isFollowing ? unfollowMutation.mutate(p.id) : followMutation.mutate(p.id)} className="h-8 text-xs border-border bg-transparent hover:bg-muted px-1">
                  {isFollowing ? <UserCheck className="w-3.5 h-3.5 mr-1 text-blue-400" /> : <UserPlus className="w-3.5 h-3.5 mr-1 text-muted-foreground" />} {isFollowing ? "Unf" : "Follow"}
               </Button>
               <Button variant="outline" size="sm" onClick={() => onReconnect && onReconnect(p.id)} className="h-8 text-xs border-border bg-transparent hover:bg-muted px-1">
                  <RefreshCw className="w-3.5 h-3.5 mr-1 text-muted-foreground" /> Reboot
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
               <Button variant={participantRole === "co-owner" ? "default" : "outline"} size="sm" onClick={() => onAssignRole && onAssignRole("co-owner")} className={`h-8 text-xs ${participantRole === "co-owner" ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent border-border text-muted-foreground hover:bg-muted'}`}>
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
              <Button variant="outline" size="sm" className="h-8 border-blue-600 text-blue-500 bg-transparent px-2 pointer-events-none">Volume <Volume2 className="w-3.5 h-3.5 ml-1"/></Button>
              <input type="range" min="0" max="1" step="0.05" value={volume ?? 1} onChange={(e) => onVolumeChange && onVolumeChange(p.id, parseFloat(e.target.value))} className="flex-1 accent-blue-500 h-1 cursor-pointer" />
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
    <div className="flex flex-col items-start gap-1">
      <div
        className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-md overflow-hidden bg-muted/20 group border-[3px] select-none ${
          isSpeaking ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "border-transparent hover:border-blue-500/30"
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
                  <Video className="w-5 h-5 text-cyan-400 drop-shadow-md" />
                  <span className="text-[10px] text-cyan-300 font-semibold drop-shadow-md">Expand</span>
                </>
              ) : (
                <span className="text-xs sm:text-sm font-bold text-white drop-shadow-md leading-tight break-words line-clamp-2 px-2">
                  {getUserDisplayName(p).split(' ').join('\n')}
                </span>
              )}
            </div>
        </div>

        {(showScreenIcon || showYoutubeIcon || showBookIcon || isWatcher) && (
          <div className="absolute top-1 right-8 z-20 flex items-center gap-0.5 animate-pulse pointer-events-none drop-shadow-md">
             {showScreenIcon && (
                <div className="bg-blue-600 p-1 rounded-sm shadow">
                   <Monitor className="w-3 h-3 text-white" />
                </div>
             )}
             {showYoutubeIcon && !showScreenIcon && (
                <div className="bg-red-600 p-1 rounded-sm shadow">
                   <Youtube className="w-3 h-3 text-white" />
                </div>
             )}
             {isWatcher && !showScreenIcon && !showYoutubeIcon && (
                <div className="bg-red-500/80 p-1 rounded-sm shadow flex items-center gap-0.5">
                   <Eye className="w-3 h-3 text-white" />
                </div>
             )}
             {showBookIcon && !showScreenIcon && (
                <div className="bg-amber-600 p-1 rounded-sm shadow">
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
          <div className="absolute bottom-0 left-0 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-tr-md shadow-sm z-20 flex items-center gap-0.5">
            Owner <Crown className="w-2.5 h-2.5 text-yellow-300" />
          </div>
        ) : participantRole === "co-owner" ? (
          <div className="absolute bottom-0 left-0 bg-blue-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-tr-md shadow-sm z-20 flex items-center gap-0.5">
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

        {p.handRaised && (
          <div className="absolute top-1 left-1 w-5 h-5 bg-yellow-500/90 rounded-full flex items-center justify-center shadow-lg z-20">
            <Hand className="w-3 h-3 text-white" />
          </div>
        )}
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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [micError, setMicError] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState("chat");
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; msgId: string } | null>(null);
  const [chatText, setChatText] = useState("");
  const [chatMessageColor, setChatMessageColor] = useState(() => localStorage.getItem("connect2talk-chat-color") || "#e5e7eb");
  const [privateChatToId, setPrivateChatToId] = useState<string>("public");
  const [pasteUploading, setPasteUploading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
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
  const [editTitle, setEditTitle] = useState(roomProp.title);
  const [editLanguage, setEditLanguage] = useState(roomProp.language);
  const [editLevel, setEditLevel] = useState(roomProp.level);
  const [editMaxUsers, setEditMaxUsers] = useState(roomProp.maxUsers);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [editRoomTheme, setEditRoomTheme] = useState((roomProp as any).roomTheme || "none");
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
  const [dmUserId, setDmUserId] = useState<string | null>(null);
  const [reportTargetUserId, setReportTargetUserId] = useState<string | null>(null);
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
  const ytRemoteAction = useRef(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null);
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
  const [miniPlayerMode, setMiniPlayerMode] = useState(false);
  const [miniPlayerPos, setMiniPlayerPos] = useState({ x: 16, y: 80 });
  const [youtubeWatchers, setYoutubeWatchers] = useState<Set<string>>(new Set());

  const [bookReaders, setBookReaders] = useState<Set<string>>(new Set());
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [goLivePlatform, setGoLivePlatform] = useState<"youtube" | "twitch" | "tiktok">("youtube");

  const [readSearch, setReadSearch] = useState("");
  const [readBooks, setReadBooks] = useState<any[]>([]);
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
  const sidePanelTabRef = useRef(sidePanelTab);
  const ytSyncTimeRef = useRef<number>(0);
  const youtubeStartedByRef = useRef<string | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, playerX: 0, playerY: 0 });
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());

  useEffect(() => {
    setRoomData(roomProp);
  }, [roomProp]);

  const isHost = room.ownerId === user?.id;

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
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const { data: following = [] } = useQuery<Follow[]>({
    queryKey: ["/api/follows/following", user?.id],
    enabled: !!user,
  });

  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const blockedIdsRef = useRef<Set<string>>(new Set());
  const { data: initialBlockedIds = [] } = useQuery<string[]>({
    queryKey: ["/api/blocks"],
    enabled: !!user,
  });
  useEffect(() => {
    const s = new Set(initialBlockedIds);
    setBlockedIds(s);
    blockedIdsRef.current = s;
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
    mutationFn: async (data: { title: string; language: string; level: string; maxUsers: number; roomTheme?: string }) => {
      const res = await apiRequest("PATCH", `/api/rooms/${room.id}`, data);
      return await res.json();
    },
    onSuccess: (updatedRoom: any) => {
      setRoomData((prev: any) => ({ ...prev, ...updatedRoom }));
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", room.id] });
      setEditDialogOpen(false);
      toast({ title: "Room settings updated" });
    },
    onError: () => {
      toast({ title: "Failed to update room settings", variant: "destructive" });
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

  useEffect(() => {
    if (!socket || !user) return;

    let animationFrameId: number;
    let lastCheck = performance.now();
    const checkAudioLevels = (time: number) => {
      if (time - lastCheck > 100) {
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
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        localStream.current = stream;
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
        setMicError(false);
        
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
          } catch(e) {}
        }
      } catch (err) {
        console.error("Failed to get microphone:", err);
        setMicError(true);
      }
      socket.emit("room:join", { roomId: room.id, userId: user.id });
      socket.emit("room:mute", { roomId: room.id, userId: user.id, isMuted: true });
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
      if (blockedIdsRef.current.has(data.from)) return;
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
      if (blockedIdsRef.current.has(data.peerId)) return;
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

    socket.on("room:already-in-room", (data: { roomId: string }) => {
      toast({
        title: "Already in another room",
        description: "You can only be in one room at a time. Leave your current room first.",
        variant: "destructive",
      });
    });

    socket.on("room:chat-message", (msg: ChatMessage) => {
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
      if (!data.videoId) {
        setShowYoutube(false);
        setMiniPlayerMode(false);
        setYoutubeWatchers(new Set());
      } else if (data.startedBy !== user.id) {
         setShowYoutube(false);
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

    socket.on("room:youtube-state", (data: { action: string; time?: number; from: string }) => {
      if (data.from === user.id) return;
      const player = youtubePlayerRef.current;
      if (!player || !player.playVideo) return;
      ytRemoteAction.current = true;
      try {
        if (data.action === "play") {
          if (data.time !== undefined) player.seekTo(data.time, true);
          player.playVideo();
        } else if (data.action === "pause") {
          player.pauseVideo();
        } else if (data.action === "stop") {
          player.stopVideo();
        }
      } catch (e) {}
      setTimeout(() => { ytRemoteAction.current = false; }, 1000);
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

    socket.on("user:blocked", ({ otherId }: { otherId: string }) => {
      setBlockedIds(prev => { const n = new Set(prev); n.add(otherId); blockedIdsRef.current = n; return n; });
      setParticipants(prev => prev.filter(p => p.id !== otherId));
      cleanupPeer(otherId);
    });

    socket.on("user:unblocked", ({ otherId }: { otherId: string }) => {
      setBlockedIds(prev => { const n = new Set(prev); n.delete(otherId); blockedIdsRef.current = n; return n; });
      queryClient.invalidateQueries({ queryKey: ["/api/blocks"] });
    });

    return () => {
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
      socket.off("room:mute-update");
      socket.off("room:kicked");
      socket.off("room:already-in-room");
      socket.off("room:chat-message");
      socket.off("room:chat-delete");
      socket.off("room:reaction-update");
      socket.off("room:youtube");
      socket.off("room:youtube-watchers-update");
      socket.off("room:book-watchers-update");
      socket.off("room:screen-share");
      socket.off("room:video-status");
      socket.off("room:youtube-state");
      socket.off("room:roles");
      socket.off("room:roles-update");
      socket.off("room:updated");
      socket.off("room:host-transferred");
      socket.off("user:blocked");
      socket.off("user:unblocked");
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
  }, [socket, user, room.id, createPeerConnection, cleanupPeer, flushPendingCandidates, addSystemMessage, playNotificationSound]);

  useEffect(() => {
    if (!socket || !user) return;
    const handleRoomDm = (msg: any) => {
      if (msg.fromId === user.id) return;
      if (msg.toId !== user.id) return;
      const fromUser = participants.find(p => p.id === msg.fromId) as User | undefined;
      if (roomDmTimerRef.current) clearTimeout(roomDmTimerRef.current);
      setRoomDmNotification({ fromId: msg.fromId, text: msg.text, fromUser });
      roomDmTimerRef.current = setTimeout(() => setRoomDmNotification(null), 7000);
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
        socket.emit("room:youtube-time-respond", { roomId: room.id, time, requesterId });
      } catch (_) {}
    };
    const handleTimeResponded = ({ time }: { time: number }) => {
      ytSyncTimeRef.current = time;
      try {
        if (youtubePlayerRef.current?.seekTo) {
          youtubePlayerRef.current.seekTo(time, true);
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

  useEffect(() => {
    if (!socket || !user || !activeYoutubeId || !youtubeStartedBy) return;
    if (showYoutube && user.id !== youtubeStartedBy) {
      socket.emit("room:youtube-time-request", { roomId: room.id, requesterId: user.id });
    }
  }, [showYoutube]);

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

  useEffect(() => {
    if (!activeYoutubeId || !showYoutube) {
      if (youtubePlayerRef.current) {
        try { youtubePlayerRef.current.destroy(); } catch (e) {}
        youtubePlayerRef.current = null;
      }
      return;
    }

    const createPlayer = () => {
      const container = document.getElementById("yt-player-container");
      if (!container) return;
      const YT = (window as any).YT;
      if (!YT || !YT.Player) return;
      try {
        if (youtubePlayerRef.current) {
          try { youtubePlayerRef.current.destroy(); } catch (e) {}
        }
        const player = new YT.Player("yt-player-container", {
          videoId: activeYoutubeId,
          playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              if (ytSyncTimeRef.current > 0) {
                try { player.seekTo(ytSyncTimeRef.current, true); } catch (_) {}
                ytSyncTimeRef.current = 0;
              }
            },
            onStateChange: (event: any) => {
              if (ytRemoteAction.current) return;
              const state = event.data;
              if (state === YT.PlayerState.PLAYING) {
                socket?.emit("room:youtube-state", {
                  roomId: room.id,
                  action: "play",
                  time: player.getCurrentTime(),
                });
              } else if (state === YT.PlayerState.PAUSED) {
                socket?.emit("room:youtube-state", {
                  roomId: room.id,
                  action: "pause",
                  time: player.getCurrentTime(),
                });
              }
            },
          },
        });
        youtubePlayerRef.current = player;
      } catch (e) {
        console.error("YouTube player error:", e);
      }
    };

    const YT = (window as any).YT;
    if (YT && YT.Player) {
      setTimeout(createPlayer, 200);
    } else {
      if (!document.getElementById("yt-api-script")) {
        const tag = document.createElement("script");
        tag.id = "yt-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      (window as any).onYouTubeIframeAPIReady = () => {
        setTimeout(createPlayer, 200);
      };
    }

    return () => {
      if (youtubePlayerRef.current) {
        try { youtubePlayerRef.current.destroy(); } catch (e) {}
        youtubePlayerRef.current = null;
      }
    };
  }, [activeYoutubeId, showYoutube, socket, room.id]);

  useEffect(() => {
    if (!socket || !activeYoutubeId) return;
    socket.emit("room:youtube-watching", { roomId: room.id, watching: showYoutube });
    if (showYoutube) {
      setYoutubeWatchers(prev => { const n = new Set(prev); n.add(user?.id || ""); return n; });
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

  const toggleHand = () => {
    setHandRaised(!handRaised);
    socket?.emit("room:hand", { roomId: room.id, userId: user?.id, raised: !handRaised });
  };

  const handleLeave = () => {
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
    onLeave();
  };

  const renderControlDock = () => {
    const ghostStyle: React.CSSProperties = {
      background: "rgba(255,255,255,0.058)",
      border: "1px solid rgba(255,255,255,0.085)",
      color: "rgba(255,255,255,0.40)",
    };
    const activeStyle: React.CSSProperties = {
      background: "linear-gradient(145deg, rgba(255,255,255,0.155) 0%, rgba(255,255,255,0.08) 100%)",
      border: "1px solid rgba(255,255,255,0.20)",
      color: "rgba(255,255,255,0.96)",
      boxShadow: "0 0 14px rgba(255,255,255,0.07), 0 4px 16px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.12)",
    };
    const micLiveStyle: React.CSSProperties = {
      background: "linear-gradient(145deg, rgba(34,197,94,0.18) 0%, rgba(22,163,74,0.10) 100%)",
      border: "1px solid rgba(34,197,94,0.30)",
      color: "rgba(74,222,128,0.96)",
      boxShadow: "0 0 18px rgba(34,197,94,0.22), 0 4px 16px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
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

    const btnBase = "relative w-12 h-12 rounded-[18px] flex items-center justify-center transition-all duration-200 ease-out hover:-translate-y-[3px] hover:scale-[1.04] active:translate-y-0 active:scale-[0.97]";
    const labelBase = "text-[9px] font-semibold leading-none tracking-wider uppercase";

    return (
      <div
        className="pointer-events-auto flex items-center gap-1.5 select-none"
        style={{
          background: "linear-gradient(180deg, rgba(18,22,36,0.97) 0%, rgba(9,11,22,0.95) 100%)",
          backdropFilter: "blur(40px) saturate(1.35)",
          WebkitBackdropFilter: "blur(40px) saturate(1.35)",
          border: "1px solid rgba(255,255,255,0.088)",
          borderRadius: "32px",
          boxShadow: "0 24px 56px rgba(0,0,0,0.52), 0 0 0 1px rgba(255,255,255,0.022), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.18)",
          padding: "11px 16px",
        }}
        data-testid="toolbar-room-controls"
      >
        {/* Mute */}
        <div className="flex flex-col items-center gap-[7px]">
          <button
            onClick={toggleMute}
            disabled={micError}
            data-testid="button-toggle-mute"
            title={isMuted ? "Unmute" : "Mute"}
            className={`${btnBase} disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100`}
            style={isMuted ? ghostStyle : micLiveStyle}
          >
            {isMuted
              ? <MicOff className="w-[18px] h-[18px]" />
              : (
                <span className="relative flex items-center justify-center">
                  <Mic className="w-[18px] h-[18px]" />
                  <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-green-400 border border-black/30 shadow-sm" />
                </span>
              )
            }
          </button>
          <span className={labelBase} style={isMuted ? { color: "rgba(255,255,255,0.32)" } : { color: "rgba(74,222,128,0.82)" }}>
            {isMuted ? "Unmute" : "Live"}
          </span>
        </div>

        {/* Camera */}
        <div className="flex flex-col items-center gap-[7px]">
          <button
            onClick={toggleVideo}
            data-testid="button-toggle-video"
            title={isVideoOn ? "Stop Camera" : "Camera"}
            className={btnBase}
            style={isVideoOn ? activeStyle : ghostStyle}
          >
            {isVideoOn ? <Video className="w-[18px] h-[18px]" /> : <VideoOff className="w-[18px] h-[18px]" />}
          </button>
          <span className={labelBase} style={isVideoOn ? { color: "rgba(255,255,255,0.68)" } : { color: "rgba(255,255,255,0.32)" }}>
            Camera
          </span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-[7px]">
          <button
            onClick={handleScreenShare}
            data-testid="button-screen-share"
            title={isScreenSharing ? "Stop Share" : "Share Screen"}
            className={btnBase}
            style={isScreenSharing ? activeStyle : ghostStyle}
          >
            <Monitor className="w-[18px] h-[18px]" />
          </button>
          <span className={labelBase} style={isScreenSharing ? { color: "rgba(255,255,255,0.68)" } : { color: "rgba(255,255,255,0.32)" }}>
            Share
          </span>
        </div>

        {/* Hand — premium standout button */}
        <div className="flex flex-col items-center gap-[7px]">
          <div className="relative">
            {handRaised && (
              <span
                className="absolute inset-0 rounded-[18px] animate-ping"
                style={{ background: "rgba(251,191,36,0.28)", animationDuration: "1.4s" }}
              />
            )}
            <button
              onClick={toggleHand}
              data-testid="button-toggle-hand"
              title={handRaised ? "Lower Hand" : "Raise Hand"}
              className={btnBase}
              style={handRaised ? handRaisedStyle : ghostStyle}
            >
              <Hand className="w-[18px] h-[18px]" style={handRaised ? { filter: "drop-shadow(0 0 4px rgba(251,191,36,0.6))" } : undefined} />
            </button>
          </div>
          <span className={labelBase} style={handRaised ? { color: "rgba(251,191,36,0.86)" } : { color: "rgba(255,255,255,0.32)" }}>
            Hand
          </span>
        </div>

        <div className="mx-0.5 h-10 w-px self-center" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.11) 50%, transparent 100%)" }} />

        {/* Leave */}
        <div className="flex flex-col items-center gap-[7px]">
          <button
            onClick={handleLeave}
            data-testid="button-leave-room"
            title="Leave Room"
            className={btnBase}
            style={leaveStyle}
          >
            <PhoneOff className="w-[18px] h-[18px]" />
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

  const handleBlock = async (targetUserId: string) => {
    try {
      await apiRequest("POST", "/api/blocks", { blockerId: user?.id, blockedId: targetUserId });
      toast({ title: "User blocked." });
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

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      await removeScreenTracksFromPeers();
      screenStream.current?.getTracks().forEach((t) => t.stop());
      screenStream.current = null;
      setIsScreenSharing(false);
      socket?.emit("room:screen-share", { roomId: room.id, userId: user?.id, active: false });
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
    if (sidePanelTab === "youtube" && youtubeFeatured.length === 0 && !youtubeFeaturedLoading) {
      setYoutubeFeaturedLoading(true);
      fetch("/api/youtube/featured", { credentials: "include" })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setYoutubeFeatured(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setYoutubeFeaturedLoading(false));
    }
  }, [sidePanelTab]);

  const handleYoutubeSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setYoutubeResults([]);
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

  const handleStopYoutube = () => {
    setActiveYoutubeId(null);
    setShowYoutube(false);
    setMiniPlayerMode(false);
    setFocusedUserId(null);
    setYoutubeWatchers(new Set());
    youtubePlayerRef.current?.destroy();
    youtubePlayerRef.current = null;
    socket?.emit("room:youtube", { roomId: room.id, videoId: null });
  };

  const handleParticipantClick = (peerId: string) => {
    const isClickingOther = peerId !== user?.id;

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

      setShowYoutube(false);
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
    } else {
      const stream = remoteScreenStreams.current.get(peerId);
      setRemoteScreenShareUserId(peerId);
      if (stream && remoteScreenRef.current) {
        remoteScreenRef.current.srcObject = stream;
      }
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
    "from-cyan-400 to-blue-500",
    "from-green-400 to-emerald-500",
    "from-orange-400 to-red-500",
    "from-purple-400 to-pink-500",
    "from-yellow-400 to-orange-500",
    "from-pink-400 to-rose-500",
    "from-teal-400 to-cyan-500",
    "from-indigo-400 to-purple-500",
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
      const res = await fetch(`https://gutendex.com/books/?sort=popular&languages=en`);
      const data = await res.json();
      setReadBooks(data.results || []);
    } catch { setReadBooks([]); } finally { setReadLoading(false); }
  };

  const searchGutenberg = async (query: string) => {
    if (!query.trim()) {
      setReadBooks([]);
      loadDefaultBooks();
      return;
    }
    setReadLoading(true);
    try {
      const res = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}&languages=en`);
      const data = await res.json();
      setReadBooks(data.results || []);
    } catch { setReadBooks([]); } finally { setReadLoading(false); }
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
    <Tabs value={sidePanelTab} onValueChange={setSidePanelTab} className="flex flex-col h-full">
      <TabsList className="w-full border-b bg-transparent h-auto p-0 flex">
        <TabsTrigger value="chat" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 text-xs py-2.5 px-1.5 transition-colors relative" data-testid="tab-chat">
          <MessageSquare className="w-3.5 h-3.5 mr-1" /> Chat
          {unreadChatBadge > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center leading-none">
              {unreadChatBadge > 99 ? "99+" : unreadChatBadge}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="youtube" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 text-xs py-2.5 px-1.5 transition-colors" data-testid="tab-youtube">
          <Youtube className="w-3.5 h-3.5 mr-1" /> YouTube
        </TabsTrigger>
        <TabsTrigger value="read" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 text-xs py-2.5 px-1.5 transition-colors" data-testid="tab-read">
          <BookOpen className="w-3.5 h-3.5 mr-1" /> Read
        </TabsTrigger>
        <TabsTrigger value="chess" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 text-xs py-2.5 px-1.5 transition-colors" data-testid="tab-chess">
          <Gamepad2 className="w-3.5 h-3.5 mr-1" /> Chess
        </TabsTrigger>
      </TabsList>

      <TabsContent value="chat" className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" forceMount style={{ display: sidePanelTab === "chat" ? "flex" : "none" }}>
        <div className="flex items-center gap-1 px-2 py-1 border-b">
          <button
            onClick={() => setShowMentionsOnly(false)}
            className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${!showMentionsOnly ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            data-testid="filter-all-messages"
          >
            All
          </button>
          <button
            onClick={() => setShowMentionsOnly(true)}
            className={`text-[11px] px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${showMentionsOnly ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            data-testid="filter-mentions"
          >
            @ Mentions
          </button>
        </div>
        <ScrollArea className="flex-1 min-h-0" ref={chatScrollRef} onScroll={handleScroll}>
          <div className="p-3 space-y-3 min-h-full flex flex-col justify-end">
            {(() => {
              const displayedMessages = showMentionsOnly
                ? chatMessages.filter(msg => msg.type !== "system" && (msg as any).type !== "deleted" && isMentionedInMessage(msg.text))
                : chatMessages;
              return displayedMessages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 mt-auto">
                {showMentionsOnly ? "No messages mentioning you." : "No messages yet. Start the conversation!"}
              </p>
            ) : (
              displayedMessages.map((msg) => {
                if (msg.type === "system" && !showMentionsOnly) {
                  return (
                    <div key={msg.id} className="flex items-center justify-center gap-2 py-1" data-testid={`room-chat-${msg.id}`}>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {msg.text.includes("joined") ? (
                          <LogIn className="w-3 h-3 text-chart-3" />
                        ) : msg.text.includes("left") ? (
                          <LogOut className="w-3 h-3 text-chart-4" />
                        ) : (
                          <Shield className="w-3 h-3 text-blue-400" />
                        )}
                        <span>{msg.text}</span>
                        <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                      </div>
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
                    className="group flex items-start gap-2.5 relative"
                    data-testid={`room-chat-${msg.id}`}
                    onMouseEnter={() => setHoveredMsgId(msg.id)}
                    onMouseLeave={() => setHoveredMsgId(null)}
                  >
                    <div className={`rounded-full p-[2px] bg-gradient-to-br ${gradient} flex-shrink-0 mt-0.5`}>
                      <Avatar className="w-9 h-9 border border-background">
                        <AvatarImage src={msgUser?.profileImageUrl || undefined} />
                        <AvatarFallback className={`text-xs bg-gradient-to-br ${gradient} text-white`}>
                          {getUserInitials(msgUser)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                        <span className="text-xs font-semibold min-w-0 break-words [overflow-wrap:anywhere]">{getUserDisplayName(msgUser)}</span>
                        <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
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
                          <div className="px-1.5 pb-1 text-xs opacity-80 pointer-events-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {renderMessageContent(
                              msg.replyTo.text,
                              (url) => setLightboxMedia({ url, msgId: msg.id }),
                              (id) => handleSelectYoutubeVideo(id)
                            )}
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
        <form onSubmit={handleSendChat} className="p-3 border-t flex flex-col gap-2 relative flex-shrink-0 mt-auto">
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
          <div className="flex flex-wrap items-center gap-2">
            <Select value={privateChatToId} onValueChange={setPrivateChatToId}>
              <SelectTrigger className="h-8 flex-1 min-w-[150px] text-xs" data-testid="select-private-chat-recipient">
                <SelectValue placeholder="Public chat" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public chat</SelectItem>
                {participants
                  .filter((p) => p.id !== user?.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Private to {getUserDisplayName(p)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 px-2" data-testid="button-chat-color-picker">
                  <Palette className="w-3.5 h-3.5 mr-1.5" />
                  <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: chatMessageColor }} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" side="top" align="end">
                <div className="space-y-2">
                  <p className="text-xs font-medium">Message color</p>
                  <div className="grid grid-cols-6 gap-2">
                    {["#e5e7eb", "#22d3ee", "#a78bfa", "#facc15", "#fb7185", "#4ade80", "#f97316", "#60a5fa", "#f0abfc", "#ffffff", "#c084fc", "#2dd4bf"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setChatMessageColor(color)}
                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${chatMessageColor === color ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
                        style={{ backgroundColor: color }}
                        data-testid={`button-chat-color-${color.replace("#", "")}`}
                        aria-label={`Set chat color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
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
            {!isAtBottom && unreadCount > 0 && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute -top-12 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-lg hover:bg-primary/90 flex items-center gap-1.5 z-20 animate-in fade-in slide-in-from-bottom-2"
                data-testid="button-new-messages-indicator"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}
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
                    });
                  } catch (err) {
                    console.error("Paste image upload failed:", err);
                  } finally {
                    setPasteUploading(false);
                  }
                }
              }}
              placeholder={pasteUploading ? "Uploading image..." : privateChatToId === "public" ? "Type a message... (@ to mention)" : "Type a temporary private message..."}
              disabled={pasteUploading}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2.5 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:opacity-60"
              rows={3}
              data-testid="input-room-chat"
            />
          </div>
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <GifPickerButton onGifSelect={(gifUrl) => {
                if (socket && user) {
                  socket.emit("room:chat", {
                    roomId: room.id,
                    userId: user.id,
                    text: `[gif:${gifUrl}]`,
                    messageColor: chatMessageColor,
                    privateToId: privateChatToId === "public" ? null : privateChatToId,
                  });
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
                  });
                }
              }} />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!chatText.trim()}
              data-testid="button-send-room-chat"
            >
              <Send className="w-4 h-4 mr-1.5" />
              Send
            </Button>
          </div>
        </form>
      </TabsContent>


      <TabsContent value="youtube" className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" forceMount style={{ display: sidePanelTab === "youtube" ? "flex" : "none" }}>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-3 pb-2 border-b flex-shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={youtubeSearch}
                onChange={(e) => handleYoutubeSearchInput(e.target.value)}
                placeholder="Search YouTube videos..."
                className="pl-8 text-sm"
                data-testid="input-youtube-search"
              />
              {youtubeSearching && (
                <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
              )}
            </div>
            {activeYoutubeId && (
              <div className="flex items-center gap-1 mt-2">
                <Button size="icon" variant="ghost" onClick={handleStopYoutube} title="Stop" data-testid="button-stop-youtube-panel">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-2">
              {youtubeResults.length > 0 && (
                <div className="space-y-1" data-testid="youtube-search-results">
                  {youtubeResults.map((video: any) => (
                    <button
                      key={video.id}
                      onClick={() => handleSelectYoutubeVideo(video.id)}
                      className="w-full flex items-start gap-2 p-1.5 rounded-md hover-elevate active-elevate-2 text-left transition-colors"
                      data-testid={`button-youtube-result-${video.id}`}
                    >
                      <img src={video.thumbnail} alt="" className="w-24 h-14 rounded object-cover flex-shrink-0 bg-muted" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium line-clamp-2 leading-tight">{video.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {video.channelTitle && <span className="text-[10px] text-muted-foreground truncate">{video.channelTitle}</span>}
                          {video.duration && <span className="text-[10px] text-muted-foreground flex-shrink-0">{video.duration}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {youtubeSearch.trim() && !youtubeSearching && youtubeResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No results found</p>
              )}
              {!youtubeSearch.trim() && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-1 pb-1">
                    {youtubeFeaturedLoading ? "Loading trending..." : "🔥 Trending Now"}
                  </p>
                  {youtubeFeaturedLoading && <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
                  {!youtubeFeaturedLoading && youtubeFeatured.map((video: any) => (
                    <button
                      key={video.id}
                      onClick={() => handleSelectYoutubeVideo(video.id)}
                      className="w-full flex items-start gap-2 p-1.5 rounded-md hover-elevate active-elevate-2 text-left transition-colors"
                    >
                      <img src={video.thumbnail} alt="" className="w-24 h-14 rounded object-cover flex-shrink-0 bg-muted" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium line-clamp-2 leading-tight">{video.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {video.channelTitle && <span className="text-[10px] text-muted-foreground truncate">{video.channelTitle}</span>}
                          {video.duration && <span className="text-[10px] text-muted-foreground flex-shrink-0">{video.duration}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </TabsContent>

      <TabsContent value="read" className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" forceMount style={{ display: sidePanelTab === "read" ? "flex" : "none" }}>
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
                {readBooks.length === 0 && !readLoading && (
                  <div className="text-center py-8 space-y-2 text-muted-foreground">
                    <BookOpen className="w-8 h-8 mx-auto opacity-30" />
                    <p className="text-xs">No books found. Try a different search.</p>
                    <button onClick={loadDefaultBooks} className="text-xs text-primary hover:underline">Browse bestsellers</button>
                  </div>
                )}
                {readBooks.length > 0 && !readSearch.trim() && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-1">📚 Popular Bestsellers</p>
                )}
                {readBooks.map((book: any) => (
                  <button
                    key={book.id}
                    onClick={() => loadBookText(book)}
                    className="w-full flex items-start gap-2 p-2 rounded-lg border hover:bg-muted/50 text-left transition-colors"
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
              </div>
            </ScrollArea>
          </div>
        )}
      </TabsContent>

      <TabsContent value="chess" className="flex-1 flex flex-col m-0 overflow-hidden min-h-0" forceMount style={{ display: sidePanelTab === "chess" ? "flex" : "none" }}>
        <div className="p-3 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Chess.com</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Play with your Chess.com account</p>
            </div>
            <a
              href="https://www.chess.com/play/online"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open <ExternalLink className="w-3 h-3" />
            </a>
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
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="flex h-full relative overflow-hidden" style={getRoomThemeStyle(currentTheme)}>
      <RoomThemeOverlay themeId={currentTheme} />

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
          <div className="grid grid-cols-2 gap-3 mt-2">
            {ROOM_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setEditRoomTheme(theme.id)}
                className={`relative flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-all
                  ${editRoomTheme === theme.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-muted/50"}`}
              >
                <span className="font-semibold text-sm">{theme.label}</span>
                <span className="text-xs text-muted-foreground">{theme.description}</span>
                {editRoomTheme === theme.id && (
                  <span className="absolute top-2 right-2 text-primary text-xs">✓</span>
                )}
              </button>
            ))}
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
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
              <Label>Card Theme</Label>
              <div className="grid grid-cols-5 gap-2">
                {ROOM_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setEditRoomTheme(theme.id)}
                    className={`relative h-8 rounded-md bg-gradient-to-br ${(theme as any).preview || "from-cyan-400 to-purple-500"} transition-all ${editRoomTheme === theme.id ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-105" : "opacity-70 hover:opacity-100"}`}
                    title={theme.label}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected: {ROOM_THEMES.find((t) => t.id === editRoomTheme)?.label || "Default"}
              </p>
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
        </DialogContent>
      </Dialog>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="border-b border-white/[0.07] px-4 py-2.5" style={{ background: "rgba(8,10,18,0.74)", backdropFilter: "blur(16px)" }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 basis-0">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,225,255,0.12)", border: "1px solid rgba(0,225,255,0.2)" }}>
                  <Mic className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border-2 border-background" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h2 className="font-bold text-sm truncate text-white/90" data-testid="text-voice-room-title">
                    {room.title}
                  </h2>
                  {isHost && (
                    <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,225,255,0.12)", color: "rgba(0,225,255,0.9)", border: "1px solid rgba(0,225,255,0.2)" }}>
                      HOST
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {room.language}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                  <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{room.level}</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                  <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{participants.length}/{room.maxUsers}</span>
                </div>
              </div>
            </div>

            <div className="order-3 flex w-full justify-center md:order-none md:w-auto md:flex-shrink-0">
              {renderControlDock()}
            </div>

            <div className="flex items-center justify-end gap-0.5 flex-1 basis-0">
              {/* Chat */}
              <div className="relative">
                <button
                  onClick={() => {
                    const isMobile = window.innerWidth < 768;
                    if (isMobile) { setMobileSheetOpen(!mobileSheetOpen); setSidePanelTab("chat"); }
                    else if (sidePanelOpen && sidePanelTab === "chat") { setSidePanelOpen(false); }
                    else { setSidePanelOpen(true); setSidePanelTab("chat"); }
                  }}
                  data-testid="button-panel-chat"
                  title="Chat"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${sidePanelTab === "chat" && sidePanelOpen ? "text-cyan-300" : "text-white/40 hover:text-white/70"}`}
                  style={sidePanelTab === "chat" && sidePanelOpen ? { background: "rgba(0,225,255,0.12)", border: "1px solid rgba(0,225,255,0.2)" } : { background: "transparent" }}
                >
                  <MessageSquare className="w-[15px] h-[15px]" />
                </button>
                {unreadChatBadge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center leading-none pointer-events-none">
                    {unreadChatBadge > 99 ? "99+" : unreadChatBadge}
                  </span>
                )}
              </div>

              {/* YouTube */}
              <button
                onClick={() => {
                  const isMobile = window.innerWidth < 768;
                  if (isMobile) { setMobileSheetOpen(!mobileSheetOpen); setSidePanelTab("youtube"); }
                  else if (sidePanelOpen && sidePanelTab === "youtube") { setSidePanelOpen(false); }
                  else { setSidePanelOpen(true); setSidePanelTab("youtube"); }
                }}
                data-testid="button-panel-youtube"
                title="YouTube"
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${sidePanelTab === "youtube" && sidePanelOpen ? "text-red-400" : "text-white/40 hover:text-white/70"}`}
                style={sidePanelTab === "youtube" && sidePanelOpen ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" } : { background: "transparent" }}
              >
                <Youtube className="w-[15px] h-[15px]" />
              </button>

              {/* GoLive — subtle, not red */}
              <button
                onClick={() => setGoLiveOpen(true)}
                data-testid="button-go-live"
                title="Go Live"
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 text-white/40 hover:text-white/70"
                style={{ background: "transparent" }}
              >
                <Tv className="w-[15px] h-[15px]" />
              </button>

              {/* Host: single Settings button (theme + edit inside dialog) */}
              {isHost && (
                <button
                  onClick={() => {
                    setEditTitle(room.title);
                    setEditLanguage(room.language);
                    setEditLevel(room.level);
                    setEditMaxUsers(room.maxUsers);
                    setEditRoomTheme((room as any).roomTheme || "none");
                    setEditDialogOpen(true);
                  }}
                  data-testid="button-host-settings"
                  title="Room Settings"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 text-white/40 hover:text-white/70"
                  style={{ background: "transparent" }}
                >
                  <Settings className="w-[15px] h-[15px]" />
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
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 text-white/40 hover:text-white/70"
                        style={{ background: "transparent" }}
                      >
                        <Settings className="w-[15px] h-[15px]" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-60 p-0 border-0 shadow-2xl overflow-hidden"
                      style={{ background: "#1a1f2e" }}
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
            <div className="mt-2 flex items-center gap-2 text-xs text-chart-4 bg-chart-4/10 rounded-md p-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Microphone access denied. You can listen but not speak.</span>
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

          {activeYoutubeId && showYoutube && (
            <div className="flex-1 min-h-0 bg-black relative" data-testid="media-main-youtube">
              <div id="yt-player-container" className="w-full h-full" />

              {(() => {
                const broadcaster = participants.find(p => p.id === youtubeStartedBy);
                if (!broadcaster) return null;
                const bIndex = participants.findIndex(p => p.id === youtubeStartedBy);
                const bGradient = getAvatarGradient(bIndex >= 0 ? bIndex : 0);
                return (
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full pl-1 pr-3 py-1 shadow-lg border border-white/10 z-10">
                    <div className={`w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-red-500/70 bg-gradient-to-br ${bGradient}`}>
                      {broadcaster.profileImageUrl ? (
                        <img src={broadcaster.profileImageUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${bGradient} flex items-center justify-center`}>
                          <span className="text-[10px] font-bold text-white">{getUserInitials(broadcaster)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col leading-none">
                      <span className="text-white text-[11px] font-semibold">{getUserDisplayName(broadcaster)}</span>
                      <span className="text-red-400 text-[9px] flex items-center gap-0.5 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                        Playing
                      </span>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

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
            <div className="flex-1 min-h-0 bg-black" data-testid="media-main-screen">
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
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/70 backdrop-blur-sm rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
                <Monitor className="w-3 h-3" />
                {getUserDisplayName(participants.find(p => p.id === remoteScreenShareUserId))} is sharing screen
              </div>
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
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-blue-500/70 bg-blue-600 flex items-center justify-center">
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
                    {p.id === youtubeStartedBy && youtubeWatchers.size > 0 && (
                      <div className="flex flex-col items-center gap-0.5 mb-1" data-testid={`youtube-watchers-card-${p.id}`}>
                        <div className="flex items-center">
                          {Array.from(youtubeWatchers).slice(0, 4).map((watcherId, wi) => {
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
                          {youtubeWatchers.size > 4 && (
                            <div className="w-5 h-5 rounded-full border border-background bg-slate-700 flex items-center justify-center shadow-sm text-[7px] font-bold text-white" style={{ marginLeft: -6, zIndex: 0 }}>
                              +{youtubeWatchers.size - 4}
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] text-muted-foreground">{youtubeWatchers.size} watching</span>
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

                    {isHost && !isMe && (
                      <div className="absolute -top-2 right-0 flex gap-0.5 invisible group-hover:visible z-10">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="w-6 h-6 rounded-full"
                          onClick={() => handleForceMute(p.id)}
                          title="Mute user"
                          data-testid={`button-force-mute-${p.id}`}
                        >
                          <VolumeX className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="w-6 h-6 rounded-full text-destructive"
                          onClick={() => handleKick(p.id)}
                          title="Kick user"
                          data-testid={`button-kick-${p.id}`}
                        >
                          <UserX className="w-3 h-3" />
                        </Button>
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
                    />
                  </div>
                );
              })}
            </div>
          </div>

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

      {miniPlayerMode && activeYoutubeId && (
        <div
          className="fixed z-50 select-none"
          style={{ left: miniPlayerPos.x, top: miniPlayerPos.y, width: 220, height: 130 }}
          data-testid="youtube-mini-player"
        >
          <div
            className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-black cursor-grab active:cursor-grabbing group"
            onMouseDown={handleMiniPlayerMouseDown}
          >
            <img
              src={`https://img.youtube.com/vi/${activeYoutubeId}/hqdefault.jpg`}
              alt="YouTube mini player"
              className="w-full h-full object-cover"
              draggable={false}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <button
                className="bg-blue-500 hover:bg-blue-400 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg transition-colors flex items-center gap-1.5"
                onClick={(e) => { e.stopPropagation(); handleExpandMiniPlayer(); }}
                onMouseDown={(e) => e.stopPropagation()}
                data-testid="button-mini-player-expand"
              >
                <Maximize2 className="w-3 h-3" />
                Click to Zoom
              </button>
            </div>
            <button
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); handleStopYoutube(); setMiniPlayerMode(false); }}
              onMouseDown={(e) => e.stopPropagation()}
              data-testid="button-mini-player-close"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
}
