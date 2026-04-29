import { useState, useRef, useEffect, memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReportDialog } from "@/components/report-dialog";
import { NeuParticipantSlider } from "@/components/neu-participant-slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Settings, Lock, Globe, Ban, UserPlus, UserCheck, MessageSquare, Heart, ChevronUp, ChevronLeft, ChevronRight, Instagram, Linkedin, Facebook, Image as ImageIcon, X, Search, Youtube, Loader2, Link, Copy, Bell, Mic, MonitorPlay, Flame, Plus, Footprints, Hand, Sparkles, Upload } from "lucide-react";
import { GifPickerButton } from "@/components/chat-picker";
import { useToast } from "@/hooks/use-toast";
import { getAvatarRingClass } from "@/lib/avatar-ring";
import { ProfileDecoration, getRoomThemeBorderClass, ROOM_THEMES } from "@/components/profile-decorations";
import { UserBadgePips } from "@/components/user-badge-pips";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LANGUAGES, LEVELS } from "@shared/schema";
import type { Room, User, Follow, UserBadge } from "@shared/schema";

/**
 * Avatars in this card render at 52–74 CSS px. randomuser.me serves portraits
 * at 128 px by default — that's 2–3× larger than needed on a 1× display, and
 * Lighthouse flagged 7+ KiB of waste per avatar. Their CDN exposes a `/med/`
 * path variant (~72 px) which is the perfect base for 1× displays. We then
 * upgrade to the 128 px file via `srcSet` for retina screens.
 *
 * For non-randomuser URLs (Replit object storage, Google profile pictures, etc.)
 * the original src is returned untouched.
 */
function buildAvatarSources(url: string | null | undefined): {
  src: string | undefined;
  srcSet?: string;
} {
  if (!url) return { src: undefined };
  const m = url.match(
    /^(https?:\/\/randomuser\.me\/api\/portraits\/)(men|women)(\/\d+\.jpg)$/,
  );
  if (m) {
    const [, base, gender, file] = m;
    const med = `${base}med/${gender}${file}`;
    const full = `${base}${gender}${file}`;
    return { src: med, srcSet: `${med} 1x, ${full} 2x` };
  }
  return { src: url };
}

interface RoomCardProps {
  room: Room;
  participants: User[];
  onJoin: (roomId: string) => void;
  onOpenDm?: (userId: string) => void;
  isOwner?: boolean;
  isLoggedIn?: boolean;
  voteCount?: number;
  hasVoted?: boolean;
  onVote?: () => void;
  followerCountsOverride?: Record<string, number>;
  /** When the parent (e.g. lobby) already runs a single batched fetch for
   *  badges of all participants across all rooms, it can pass the result here
   *  so each card doesn't fire its own duplicate /api/users/badges/batch
   *  request. Huge perf win — drops 9 requests on a 9-card lobby down to 1. */
  participantBadgesOverride?: Record<string, UserBadge[]>;
  /** Marks the card as above-the-fold so its hologram background image loads
   *  eagerly with high fetch priority. Only set this for the first row of
   *  cards in a list — the LCP candidate is typically one of these. */
  priority?: boolean;
}


const LANGUAGE_CODES: Record<string, string> = {
  English: "gb", Spanish: "es", French: "fr", German: "de",
  Japanese: "jp", Chinese: "cn", Korean: "kr", Portuguese: "br",
  Italian: "it", Russian: "ru", Arabic: "sa", Hindi: "in",
  Turkish: "tr", Dutch: "nl", Polish: "pl", Swedish: "se",
  Norwegian: "no", Danish: "dk", Finnish: "fi", Greek: "gr",
  Hebrew: "il", Ukrainian: "ua", Romanian: "ro", Hungarian: "hu",
  Armenian: "am", Indonesian: "id",
};

function LanguageFlag({ language }: { language: string }) {
  const code = LANGUAGE_CODES[language];
  if (!code) return <Globe className="w-3.5 h-3.5 text-white/50" />;
  return (
    <img
      src={`https://flagcdn.com/20x15/${code}.png`}
      srcSet={`https://flagcdn.com/40x30/${code}.png 2x`}
      width={20}
      height={15}
      alt={language}
      className="rounded-[2px] flex-shrink-0"
      style={{ objectFit: "cover" }}
    />
  );
}

function getThemeGlowColor(themeId: string | null | undefined): { from: string; to: string; ring: string; animated?: string } {
  switch (themeId) {
    case "premium-atmosphere": return { from: "rgba(0,210,255,1)",    to: "rgba(120,50,255,1)",     ring: "rgba(0,210,255,0.95), rgba(130,50,255,0.95), rgba(80,180,255,0.95)", animated: "premium-atmosphere-border-wrap" };
    /* ── Premium Animated Themes ── */
    case "cosmic":     return { from: "rgba(37,99,235,0.55)",  to: "rgba(239,68,68,0.45)",  ring: "rgba(37,99,235,0.5), rgba(239,68,68,0.4)",   animated: "cosmic-border-wrap" };
    case "plasma":     return { from: "rgba(155,130,255,0.55)", to: "rgba(99,102,241,0.50)", ring: "rgba(155,130,255,0.50), rgba(99,102,241,0.45)", animated: "plasma-border-wrap" };
    case "hologram":   return { from: "rgba(6,182,212,0.55)",  to: "rgba(52,211,153,0.45)", ring: "rgba(6,182,212,0.5), rgba(52,211,153,0.4)",   animated: "hologram-border-wrap" };
    case "inferno":    return { from: "rgba(234,88,12,0.55)",  to: "rgba(250,204,21,0.45)", ring: "rgba(234,88,12,0.5), rgba(250,204,21,0.4)",   animated: "inferno-border-wrap" };
    /* ── Standard Themes ── */
    case "neon":       return { from: "rgba(0,220,255,0.38)",  to: "rgba(130,80,220,0.30)", ring: "rgba(0,220,255,0.32), rgba(130,80,220,0.28)" };
    case "galaxy":     return { from: "rgba(99,102,241,0.38)", to: "rgba(130,80,200,0.30)", ring: "rgba(99,102,241,0.32), rgba(130,80,200,0.28)" };
    case "sunset":     return { from: "rgba(251,146,60,0.40)", to: "rgba(220,68,68,0.32)",  ring: "rgba(251,146,60,0.35), rgba(220,68,68,0.28)" };
    case "forest":     return { from: "rgba(52,211,153,0.40)", to: "rgba(16,185,129,0.32)", ring: "rgba(52,211,153,0.35), rgba(16,185,129,0.28)" };
    case "cyberpunk":  return { from: "rgba(210,180,21,0.40)", to: "rgba(0,195,220,0.32)",  ring: "rgba(210,180,21,0.35), rgba(0,195,220,0.28)" };
    case "ocean":      return { from: "rgba(59,130,246,0.40)", to: "rgba(6,182,212,0.32)",  ring: "rgba(59,130,246,0.35), rgba(6,182,212,0.28)" };
    case "cherry":     return { from: "rgba(255,150,180,0.42)", to: "rgba(225,100,150,0.32)", ring: "rgba(255,150,180,0.38), rgba(225,100,150,0.28)" };
    case "gold":       return { from: "rgba(220,185,50,0.40)", to: "rgba(200,140,10,0.32)", ring: "rgba(220,185,50,0.35), rgba(200,140,10,0.28)" };
    case "violet":     return { from: "rgba(150,110,240,0.38)",to: "rgba(190,95,220,0.30)", ring: "rgba(150,110,240,0.32), rgba(190,95,220,0.28)" };
    case "aurora":     return { from: "rgba(45,212,191,0.40)", to: "rgba(74,200,110,0.32)", ring: "rgba(45,212,191,0.35), rgba(74,200,110,0.28)" };
    case "storm":      return { from: "rgba(59,130,246,0.40)", to: "rgba(90,105,130,0.30)", ring: "rgba(59,130,246,0.35), rgba(90,105,130,0.28)" };
    case "volcanic":   return { from: "rgba(220,60,60,0.40)",  to: "rgba(230,130,50,0.32)", ring: "rgba(220,60,60,0.35), rgba(230,130,50,0.28)" };
    default:           return { from: "rgba(100,140,255,0.38)", to: "rgba(130,90,230,0.30)", ring: "rgba(100,140,255,0.32), rgba(130,90,230,0.26)", animated: undefined };
  }
}


function getAvatarSizeClass(maxUsers: number): string {
  if (maxUsers <= 2) return "w-16 h-16";
  if (maxUsers <= 4) return "w-14 h-14";
  if (maxUsers <= 6) return "w-12 h-12";
  if (maxUsers <= 8) return "w-11 h-11";
  if (maxUsers <= 10) return "w-10 h-10";
  return "w-9 h-9";
}

function getFallbackTextClass(maxUsers: number): string {
  if (maxUsers <= 4) return "text-base";
  if (maxUsers <= 8) return "text-sm";
  return "text-xs";
}

function ParticipantPopover({ participant, currentUserId, onOpenDm, badges = [] }: { participant: User; currentUserId?: string; onOpenDm?: (userId: string) => void; badges?: UserBadge[] }) {
  const { data: following = [] } = useQuery<Follow[]>({
    queryKey: ["/api/follows/following", currentUserId],
    enabled: !!currentUserId,
  });

  const { data: followers = [] } = useQuery<Follow[]>({
    queryKey: ["/api/follows/followers", participant.id],
  });

  const { data: followingList = [] } = useQuery<Follow[]>({
    queryKey: ["/api/follows/following", participant.id],
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/follows", {
        followerId: currentUserId,
        followingId: participant.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/followers", participant.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/counts"] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/follows/${currentUserId}/${participant.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/followers", participant.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/counts"] });
    },
  });

  const isFollowing = following.some((f) => f.followingId === participant.id);
  const isSelf = currentUserId === participant.id;

  const hasSocialLinks = participant.instagramUrl || participant.linkedinUrl || participant.facebookUrl;

  return (
    <div className="flex flex-col items-center gap-3 p-2" data-testid={`card-profile-popup-${participant.id}`}>
      <Avatar className="w-16 h-16 border-2 border-border">
        {(() => {
          const a = buildAvatarSources(participant.profileImageUrl);
          return <AvatarImage src={a.src} srcSet={a.srcSet} alt="" />;
        })()}
        <AvatarFallback className="text-xl font-bold">
          {getUserInitials(participant)}
        </AvatarFallback>
      </Avatar>
      <div className="text-center">
        <p className="font-bold text-sm" data-testid={`text-card-profile-name-${participant.id}`}>{getUserDisplayName(participant)}</p>
        <UserBadgePips badges={badges} userId={participant.id} />
        {participant.bio && (
          <p className="text-xs text-muted-foreground mt-1 italic max-w-[160px]" data-testid={`text-card-profile-bio-${participant.id}`}>{participant.bio}</p>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{followers.length}</strong> followers</span>
        <span><strong className="text-foreground">{followingList.length}</strong> following</span>
      </div>
      {hasSocialLinks && (
        <div className="flex items-center gap-2">
          {participant.instagramUrl && (
            <a
              href={participant.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-pink-400 transition-colors"
              title="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
          )}
          {participant.linkedinUrl && (
            <a
              href={participant.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-orange-400 transition-colors"
              title="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          )}
          {participant.facebookUrl && (
            <a
              href={participant.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-orange-500 transition-colors"
              title="Facebook"
            >
              <Facebook className="w-4 h-4" />
            </a>
          )}
        </div>
      )}
      {!isSelf && currentUserId && (
        <div className="flex items-center gap-2 w-full">
          <Button
            variant={isFollowing ? "secondary" : "default"}
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              isFollowing ? unfollowMutation.mutate() : followMutation.mutate();
            }}
            disabled={followMutation.isPending || unfollowMutation.isPending}
            data-testid={`button-card-follow-${participant.id}`}
          >
            {isFollowing ? <UserCheck className="w-4 h-4 mr-1.5" /> : <UserPlus className="w-4 h-4 mr-1.5" />}
            {isFollowing ? "Unfollow" : "Follow"}
          </Button>
          {onOpenDm && (
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDm(participant.id);
              }}
              data-testid={`button-card-dm-${participant.id}`}
              aria-label={`Send a direct message to ${getUserDisplayName(participant)}`}
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function buildYoutubeEmbed(id: string) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0`;
}

function isImageMedia(src: string): boolean {
  // Treat anything that ends in a static-image / animated-GIF extension as an
  // <img>. <video> tags silently fail on .gif / .png / .jpg / .webp, which was
  // the reason GIF picks and image uploads "didn't display" on the card.
  const cleaned = src.split("?")[0].toLowerCase();
  return /\.(gif|png|jpe?g|webp|avif|bmp)$/.test(cleaned)
    || cleaned.includes("media.tenor.com")
    || cleaned.includes("/tenor/")
    || cleaned.includes("c.tenor.com");
}

function CardHologramVideo({ src, priority = false }: { src: string; priority?: boolean }) {
  // Lobby cards stack 6+ at a time. We always paint the dimming overlay so the
  // theme mood reads even when we skip animation. Static images render with a
  // plain <img> (cheap), animated videos render with <video> on capable
  // viewports, and YouTube URLs render through the muted lite-iframe.
  const overlay = (
    <div
      className="absolute inset-0 z-[1] pointer-events-none"
      style={{ background: "linear-gradient(to bottom, rgba(2,4,18,0.44) 0%, rgba(2,4,18,0.32) 58%, rgba(2,4,18,0.58) 100%)" }}
    />
  );
  const ytId = extractYoutubeId(src) || (src.includes("youtube.com/embed/") ? src.split("/embed/")[1]?.split("?")[0] : null);
  // Only video/iframe playback is throttled on phones — images are essentially
  // free, so we keep them visible everywhere.
  const skipMotion = typeof window !== "undefined" && (
    window.matchMedia?.("(max-width: 767px), (pointer: coarse)").matches === true
    || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );

  if (isImageMedia(src)) {
    return (
      <>
        <img
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? { fetchpriority: "high" } as any : {})}
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{ opacity: 0.65, filter: "brightness(0.7) saturate(0.85)" }}
        />
        {overlay}
      </>
    );
  }

  if (ytId) {
    if (skipMotion) {
      return (
        <>
          <img
            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            {...(priority ? { fetchpriority: "high" } as any : {})}
            className="absolute inset-0 w-full h-full object-cover z-0"
            style={{ opacity: 0.55, filter: "brightness(0.65) saturate(0.7)" }}
          />
          {overlay}
        </>
      );
    }
    return (
      <>
        <iframe
          src={buildYoutubeEmbed(ytId)}
          className="absolute inset-0 w-full h-full z-0"
          allow="autoplay; encrypted-media"
          style={{ border: "none", pointerEvents: "none", opacity: 0.55, filter: "brightness(0.7) saturate(0.7)" }}
        />
        {overlay}
      </>
    );
  }

  if (skipMotion) {
    return overlay;
  }
  return (
    <>
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        style={{ opacity: 0.55, filter: "brightness(0.7) saturate(0.85)" }}
      />
      {overlay}
    </>
  );
}

function RoomCardImpl({ room, participants, onJoin, onOpenDm, isOwner, isLoggedIn = true, voteCount = 0, hasVoted = false, onVote, followerCountsOverride, participantBadgesOverride, priority = false }: RoomCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isUnlimited = room.maxUsers === 0;
  const isFull = !isUnlimited && participants.length >= room.maxUsers;
  const slots = Array.from({ length: Math.min(room.maxUsers, 12) });
  const avatarSize = getAvatarSizeClass(room.maxUsers);
  const fallbackText = getFallbackTextClass(room.maxUsers);
  const [requestOpen, setRequestOpen] = useState(false);

  /* Bullet-proof debounce for the knock button. The mutation already exposes
   * `isPending`, but React state updates aren't synchronous — a fast double-
   * click (or click+Enter combo) can fire two mutations before isPending
   * flips. The ref lock is set synchronously in the click handler and held
   * for a short cooldown after success/error, so rapid repeats can't slip
   * past and trigger the API rate limiter. */
  const knockInFlightRef = useRef(false);
  const knockMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/rooms/${room.id}/knock`);
    },
    onSuccess: () => {
      import("@/lib/sound-fx").then((m) => m.sfxKnock()).catch(() => {});
      toast({ title: "🚪 Knock sent!", description: "The host will see your knock inside the room." });
      setTimeout(() => { knockInFlightRef.current = false; }, 1500);
    },
    onError: () => {
      toast({ title: "Couldn't send knock", description: "Please try again.", variant: "destructive" });
      setTimeout(() => { knockInFlightRef.current = false; }, 1500);
    },
  });
  const safeKnock = () => {
    if (knockInFlightRef.current || knockMutation.isPending) return;
    knockInFlightRef.current = true;
    knockMutation.mutate();
  };
  const participantIds = participants.map((p) => p.id);

  const { data: fetchedFollowerCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/follows/counts", ...participantIds],
    queryFn: async () => {
      if (participantIds.length === 0) return {};
      const res = await apiRequest("POST", "/api/follows/counts", { userIds: participantIds });
      return res.json();
    },
    enabled: participantIds.length > 0 && !followerCountsOverride,
    staleTime: 30000,
  });

  const followerCounts = followerCountsOverride ?? fetchedFollowerCounts;

  const { data: fetchedParticipantBadges = {} } = useQuery<Record<string, UserBadge[]>>({
    queryKey: ["/api/users/badges/batch", ...participantIds],
    queryFn: async () => {
      if (participantIds.length === 0) return {};
      const res = await apiRequest("POST", "/api/users/badges/batch", { userIds: participantIds });
      return res.json();
    },
    enabled: participantIds.length > 0 && !participantBadgesOverride,
    staleTime: 60000,
  });

  const participantBadges = participantBadgesOverride ?? fetchedParticipantBadges;

  const [reportOpen, setReportOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(room.title);
  const [editLanguage, setEditLanguage] = useState(room.language);
  const [editLevel, setEditLevel] = useState(room.level);
  const [editMaxUsers, setEditMaxUsers] = useState(room.maxUsers);
  const [editHologramUrl, setEditHologramUrl] = useState<string | null>(((room as any).hologramVideoUrl as string) || null);
  const [editHologramKind, setEditHologramKind] = useState<"gif" | "image" | "video">(() => {
    const u = ((room as any).hologramVideoUrl as string) || "";
    if (!u) return "gif";
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return "video";
    if (/\.gif(\?|$)/i.test(u) || /tenor\.com|giphy\.com/i.test(u)) return "gif";
    return "image";
  });
  const [editHologramUploading, setEditHologramUploading] = useState(false);
  const editHologramFileRef = useRef<HTMLInputElement>(null);

  // Reset background editor whenever the dialog opens so it reflects the
  // room's current saved background.
  useEffect(() => {
    if (editOpen) {
      setEditTitle(room.title);
      setEditLanguage(room.language);
      setEditLevel(room.level);
      setEditMaxUsers(room.maxUsers);
      const u = ((room as any).hologramVideoUrl as string) || null;
      setEditHologramUrl(u);
      if (u) {
        if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) setEditHologramKind("video");
        else if (/\.gif(\?|$)/i.test(u) || /tenor\.com|giphy\.com/i.test(u)) setEditHologramKind("gif");
        else setEditHologramKind("image");
      } else {
        setEditHologramKind("gif");
      }
      setEditHologramUploading(false);
    }
  }, [editOpen, room]);

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

  const editMutation = useMutation({
    mutationFn: async (data: { title: string; language: string; level: string; maxUsers: number; hologramVideoUrl: string | null }) => {
      const res = await apiRequest("PATCH", `/api/rooms/${room.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setEditOpen(false);
    },
  });

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    editMutation.mutate({
      title: editTitle.trim(),
      language: editLanguage,
      level: editLevel,
      maxUsers: editMaxUsers,
      hologramVideoUrl: editHologramUrl,
    });
  };

  const languages = LANGUAGES.filter((l) => l !== "All");

  const levelColor: Record<string, string> = {
    Beginner: "text-amber-300",
    Intermediate: "text-orange-400",
    Advanced: "text-orange-500",
    Native: "text-rose-400",
  };

  const themeBorderClass = getRoomThemeBorderClass((room as any).roomTheme);
  const hologramVideoUrl = (room as any).hologramVideoUrl as string | null | undefined;

  const isPremiumAtmosphere = theme === "premium-atmosphere" || (room as any).roomTheme === "premium-atmosphere";
  const glow = getThemeGlowColor(isPremiumAtmosphere ? "premium-atmosphere" : (room as any).roomTheme);
  // Unlimited rooms (maxUsers===0) only show filled participants, no ghost tiles.
  // Capped rooms show ALL slots so viewers can see how many spots are open.
  const displayCount = isUnlimited
    ? Math.min(participants.length, 12)
    : Math.min(room.maxUsers, 12);
  const displaySlots = Array.from({ length: displayCount });

  /* viewport-based scale factor so the participant circles grow on bigger screens
     while the card itself stays a comfortable, fixed-feeling size. Sizing is
     based on maxUsers (total capacity) so the grid always fills the card area
     proportionally whether slots are filled or empty. */
  const [circleScale, setCircleScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      // 4-person 2×2 grids overflow body at uncrowded scale — treat ≥4 as crowded
      const crowded = displayCount >= 4;
      if (w >= 1536) setCircleScale(crowded ? 1.10 : 1.35);
      else if (w >= 1280) setCircleScale(crowded ? 1.00 : 1.18);
      else if (w >= 1024) setCircleScale(crowded ? 0.94 : 1.06);
      else setCircleScale(crowded ? 0.90 : 0.98);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [displayCount]);

  /* circle size is based on how many people are actually visible — small rooms
     with 1–2 people get big, friendly portraits; crowded rooms shrink so two
     rows still fit comfortably inside the card body without ever clipping.
     Sized down so the lobby fits 2 rows of cards on smaller screens like
     Free4Talk does. */
  const baseCircleSize =
    displayCount <= 1 ? 88 :
    displayCount === 2 ? 78 :
    displayCount === 3 ? 66 :
    displayCount === 4 ? 60 :
    displayCount <= 6 ? 56 :
    displayCount <= 8 ? 46 :
    displayCount <= 10 ? 40 :
    36;
  const circleSize = Math.round(baseCircleSize * circleScale);

  const settingsButton = isOwner ? (
    <Button
      size="icon"
      variant="ghost"
      className="neu-icon-btn-red flex-shrink-0 w-7 h-7 rounded-full"
      onClick={(e) => {
        e.stopPropagation();
        setEditTitle(room.title);
        setEditLanguage(room.language);
        setEditLevel(room.level);
        setEditMaxUsers(room.maxUsers);
        setEditOpen(true);
      }}
      data-testid={`button-room-settings-${room.id}`}
      aria-label={`Edit settings for room ${room.title}`}
    >
      <Settings className="w-3.5 h-3.5" />
    </Button>
  ) : (() => {
    const ownerUser = participants.find(p => p.id === room.ownerId);
    const ownerName = ownerUser ? getUserDisplayName(ownerUser) : room.ownerId.slice(0, 8).toUpperCase();
    const ownerAvatar = ownerUser?.profileImageUrl || undefined;
    const ownerInitials = ownerUser ? getUserInitials(ownerUser) : "?";
    const createdAtStr = (room as any).createdAt
      ? new Date((room as any).createdAt).toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
      : "—";
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="flex-shrink-0 w-7 h-7 text-white/50 hover:text-white hover:bg-white/10"
            onClick={(e) => e.stopPropagation()}
            data-testid={`button-room-info-${room.id}`}
            aria-label={`Show details for room ${room.title}`}
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
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
                {(() => {
                  const a = buildAvatarSources(ownerAvatar);
                  return <AvatarImage src={a.src} srcSet={a.srcSet} alt="" />;
                })()}
                <AvatarFallback className="bg-zinc-700 text-white text-lg">{ownerInitials}</AvatarFallback>
              </Avatar>
              <p className="text-sm font-medium text-white">{ownerName}</p>
            </div>
            <div className="border-t border-white/10" />
            <button
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-white w-full text-left transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(room.ownerId);
                toast({ description: "Owner ID copied!" });
              }}
              data-testid={`button-copy-owner-id-${room.id}`}
            >
              <Copy className="w-4 h-4 text-white/50" />
              Copy Owner ID
            </button>
            <button
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-white w-full text-left transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setReportOpen(true);
              }}
              data-testid={`button-report-bad-topic-${room.id}`}
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
  })();

  /* ── elegant border gradient ── */
  const borderGradient = isPremiumAtmosphere
    ? `linear-gradient(135deg, rgba(0,220,255,0.60) 0%, rgba(80,60,255,0.50) 28%, rgba(160,40,255,0.44) 52%, rgba(80,160,255,0.50) 76%, rgba(0,220,255,0.60) 100%)`
    : `linear-gradient(135deg, ${glow.from} 0%, rgba(80,100,200,0.08) 50%, ${glow.to} 100%)`;
  const outerGlow = isPremiumAtmosphere
    ? "0 0 10px rgba(0,210,255,0.28), 0 0 22px rgba(110,50,255,0.18), 0 0 42px rgba(0,100,255,0.08)"
    : `0 0 10px ${glow.from.replace(/[\d.]+\)$/, "0.25)")}`;

  /* ── grid columns: every capacity must fill its grid EXACTLY (no dangling
     bottom-row cells). Otherwise the missing cell sits right where the ENTER
     door is in the footer corner, and the door reads as a phantom slot —
     making an 8-room look like 9, a 10-room look like 12, etc. So we pick
     factor pairs whenever possible (6→3×2, 8→4×2, 9→3×3, 10→5×2, 12→4×3) and
     only use a "stair" layout for genuinely awkward counts (5, 7, 11). ── */
  const gridCols =
    displayCount <= 1 ? 1 :
    displayCount === 2 ? 2 :
    displayCount === 3 ? 3 :
    displayCount === 4 ? 4 :
    displayCount === 5 ? 3 :       // 3+2
    displayCount === 6 ? 3 :       // 3×2 ✓ exact
    displayCount === 7 ? 4 :       // 4+3
    displayCount === 8 ? 4 :       // 4×2 ✓ exact
    displayCount === 9 ? 3 :       // 3×3 ✓ exact
    displayCount === 10 ? 5 :      // 5×2 ✓ exact
    displayCount === 11 ? 4 :      // 4+4+3
    4;                              // 12 → 4×3 ✓ exact

  return (
    <div
      className={glow.animated ?? ""}
      style={{
        width: "100%",
        padding: "1px",
        borderRadius: "18px",
        background: borderGradient,
        boxShadow: outerGlow,
        position: "relative",
      }}
      data-testid={`card-room-${room.id}`}
    >
      <div
        className={`flex flex-col relative overflow-hidden ${isPremiumAtmosphere ? "premium-atmosphere-card" : ""}`}
        style={{
          borderRadius: "16px",
          // Bumped both gradients to fully opaque (was 0.80–0.92 alpha) so we
          // can drop the heavy `backdrop-filter: blur(22px) saturate(1.3)`
          // that used to sit here. The blur caused two real problems:
          //   1. On hover the card lifts via translateY(-3px); the backdrop
          //      sampler then re-composites mid-transition against the
          //      neighbouring card's pixels, producing a "blurry / mixing
          //      colours" smear on the right edge of adjacent cards.
          //   2. Every card paid for a 22px GPU blur on every scroll/hover
          //      tick even though the original alpha was already 88–92%
          //      opaque, so the visual contribution was negligible.
          // Going opaque preserves the depth look (gradient still reads as
          // glass thanks to the outer 1px gradient border + box-shadow ring)
          // while eliminating the artifact and cutting paint cost.
          background: isPremiumAtmosphere
            ? "linear-gradient(145deg, rgb(3,6,22) 0%, rgb(6,8,28) 38%, rgb(5,3,20) 72%, rgb(8,4,25) 100%)"
            : "linear-gradient(160deg, rgb(16, 20, 50) 0%, rgb(11, 15, 42) 100%)",
          height: isPremiumAtmosphere ? 268 : 252,
        }}
      >
        {isPremiumAtmosphere && (
          <div className="premium-atmosphere-card-effects" aria-hidden="true">
            <span className="premium-atmosphere-orb premium-atmosphere-orb-a" />
            <span className="premium-atmosphere-orb premium-atmosphere-orb-b" />
            <span className="premium-atmosphere-orb premium-atmosphere-orb-c" />
            <span className="premium-atmosphere-sweep" />
          </div>
        )}
        {hologramVideoUrl && <CardHologramVideo src={hologramVideoUrl} priority={priority} />}

        <div className="relative z-[2] flex flex-col h-full">

          {/* ── Header ── */}
          <div className="relative z-10 flex items-start justify-between gap-2 px-3 pt-2 pb-4">
            <div className="flex-1 min-w-0 pr-2">
              {/* Title row with green live dot */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                <h3 className="font-extrabold text-sm text-white truncate tracking-tight" data-testid={`text-room-title-${room.id}`}>
                  {room.title}
                </h3>
                {!room.isPublic && <Lock className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />}
              </div>
              {/* Sub-row: flag, language, level, joining count */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <LanguageFlag language={room.language} />
                <span className="text-[11px] text-white/70 font-medium">{room.language}</span>
                <span className="text-white/30 text-[10px]">•</span>
                <span className={`text-[11px] font-semibold ${levelColor[room.level] || "text-orange-400"}`}>
                  {room.level}
                </span>
                {voteCount > 0 && (
                  <>
                    <span className="text-white/30 text-[10px]">•</span>
                    <div className="flex items-center gap-0.5">
                      <Users className="w-3 h-3 text-orange-400/80" />
                      <span className="text-[11px] font-semibold text-orange-400">{voteCount} joining</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
              {settingsButton}
            </div>
          </div>

          {/* ── YouTube watch-party strip ── shown when the card has a live
              YouTube hologram, so visitors can see who's watching together */}
          {hologramVideoUrl && extractYoutubeId(hologramVideoUrl) && participants.length > 0 && (
            <div className="px-4 pb-2" data-testid={`youtube-watchers-${room.id}`}>
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
                style={{
                  background: "rgba(0,0,0,0.45)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,60,60,0.22)",
                }}
              >
                {/* Red YouTube play icon */}
                <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-sm" style={{ background: "#ff0000" }}>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <polygon points="2,1 8,4.5 2,8" fill="white" />
                  </svg>
                </div>
                <span className="text-[10px] text-white/60 font-medium tracking-wide flex-1 truncate">Watching together</span>
                {/* Stacked watcher avatars */}
                <div className="flex items-center" style={{ marginLeft: "auto" }}>
                  {participants.slice(0, 4).map((p, idx) => (
                    <div
                      key={p.id}
                      className="rounded-full border-2 overflow-hidden flex-shrink-0"
                      style={{
                        width: 22,
                        height: 22,
                        marginLeft: idx === 0 ? 0 : -8,
                        borderColor: "rgba(0,0,0,0.6)",
                        zIndex: 4 - idx,
                        position: "relative",
                      }}
                    >
                      <Avatar style={{ width: 22, height: 22 }} className="rounded-full">
                        {(() => {
                          const a = buildAvatarSources(p.profileImageUrl);
                          return <AvatarImage src={a.src} srcSet={a.srcSet} alt={getUserDisplayName(p)} className="rounded-full" />;
                        })()}
                        <AvatarFallback className="rounded-full text-[8px] font-bold bg-[#1a1520] text-white/80">
                          {getUserInitials(p)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ))}
                  {participants.length > 4 && (
                    <div
                      className="rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 22,
                        height: 22,
                        marginLeft: -8,
                        borderColor: "rgba(0,0,0,0.6)",
                        background: "rgba(80,80,120,0.8)",
                        zIndex: 0,
                        position: "relative",
                      }}
                    >
                      <span className="text-[8px] font-bold text-white/80">+{participants.length - 4}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Body: unified neon ring circle grid ──
              `overflow-visible` so avatar rings/decorations that extend a few
              pixels outside the body never get clipped at the top. The outer
              card already owns the rounded-corner clipping.

              `tightSpacing` applies to crowded multi-row layouts whose bottom
              row reaches the rightmost column (7, 8, 11, 12). Without it the
              4th-column avatar in the bottom row drifts directly under the
              ENTER door icon and the top-row 4th avatar crowds the settings
              cog. We pull the spots horizontally closer together (smaller
              column gap) AND nudge the whole grid slightly inward from the
              right so the rightmost column clears the door, while still
              keeping the design exactly as-is for sparser rooms. */}
          {(() => {
            const tightSpacing = displayCount === 7 || displayCount === 8 || displayCount === 11 || displayCount === 12;
            const colGapPx = tightSpacing ? 2 : 6;       // 2px ↔ tailwind gap-1.5 (6px)
            const rowGapPx = 6;                            // vertical rhythm unchanged
            const gridRightPad = tightSpacing ? 18 : 0;   // pull bottom-right spot away from the door
            return (
          <div className="flex-1 flex flex-col justify-center px-3 pt-5 pb-2 min-h-0 overflow-visible">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                justifyItems: "center",
                columnGap: colGapPx,
                rowGap: rowGapPx,
                paddingRight: gridRightPad,
              }}
            >
              {displaySlots.map((_, i) => {
                const p = participants[i];

                if (p) {
                  const count = followerCounts[p.id] || 0;
                  const ringClass = getAvatarRingClass(p.avatarRing);
                  const hasRing = !!ringClass;
                  const badges = participantBadges[p.id] || [];

                  const avatarEl = (
                    <div
                      className={`relative rounded-2xl flex-shrink-0 flex items-center justify-center ${hasRing ? ringClass : ""}`}
                      style={{
                        width: circleSize + 6,
                        height: circleSize + 6,
                        padding: 3,
                        background: hasRing ? undefined : `linear-gradient(135deg, ${glow.from}, ${glow.to})`,
                        boxShadow: hasRing
                          ? undefined
                          : isPremiumAtmosphere
                            ? `0 0 7px rgba(145,40,130,0.40), 0 0 14px rgba(145,40,130,0.20), 0 0 22px rgba(100,50,180,0.15)`
                            : `0 0 10px ${glow.from}, 0 0 20px ${glow.to}`,
                      }}
                    >
                      <Avatar style={{ width: circleSize, height: circleSize }} className={`rounded-2xl border-2 ${hasRing ? "border-transparent" : isPremiumAtmosphere ? "border-white/20 shadow-[inset_0_0_18px_rgba(255,255,255,0.08)]" : "border-[#0a1228]"}`}>
                        {(() => {
                          const a = buildAvatarSources(p.profileImageUrl);
                          return <AvatarImage src={a.src} srcSet={a.srcSet} alt={getUserDisplayName(p)} className="rounded-2xl" />;
                        })()}
                        <AvatarFallback className="rounded-2xl text-base font-bold bg-[#1a1520] text-white/70">
                          {getUserInitials(p)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                        <UserBadgePips badges={badges} userId={p.id} compact />
                      </div>
                    </div>
                  );

                  const decorated = (
                    <ProfileDecoration decorationId={(p as any).profileDecoration} size={circleSize}>
                      {avatarEl}
                    </ProfileDecoration>
                  );

                  /* Heart/follower count is only useful in small, uncluttered
                     rooms — in crowded rooms (5+ slots) it eats vertical space
                     and pushes the first row of avatars into the language/level
                     header. The full follower count is still shown in the
                     hover popover, so it's safe to hide here. */
                  const showHeartRow = displayCount <= 4;
                  const heartRow = showHeartRow ? (
                    <div className="flex items-center justify-center gap-0.5 mt-0.5" data-testid={`text-follower-count-card-${p.id}`}>
                      <Heart className="w-2.5 h-2.5 text-red-400 fill-red-400" />
                      <span className="text-[9px] text-white/60 font-medium">{count}</span>
                    </div>
                  ) : null;

                  if (!isLoggedIn) {
                    return (
                      <div key={i} className="flex flex-col items-center">
                        {decorated}
                        {heartRow}
                      </div>
                    );
                  }

                  return (
                    <Popover key={i}>
                      <PopoverTrigger asChild>
                        <button
                          className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
                          data-testid={`button-card-participant-${p.id}`}
                        >
                          {decorated}
                          {heartRow}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-60 p-2" align="center">
                        <ParticipantPopover participant={p} currentUserId={user?.id} onOpenDm={onOpenDm} badges={badges} />
                      </PopoverContent>
                    </Popover>
                  );
                }

                /* Empty slot — deep 3D neumorphic tile */
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div
                      className="rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{
                        width: circleSize + 6,
                        height: circleSize + 6,
                        background: "linear-gradient(155deg, hsl(228 18% 13%) 0%, hsl(228 16% 8%) 60%, hsl(228 14% 6%) 100%)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        boxShadow: [
                          "-5px -5px 10px rgba(255,255,255,0.045)",
                          "6px 6px 16px rgba(0,0,0,0.92)",
                          "2px 2px 5px rgba(0,0,0,0.70)",
                          "inset 0 2px 0 rgba(255,255,255,0.08)",
                          "inset 0 -2px 0 rgba(0,0,0,0.55)",
                          "inset 2px 0 0 rgba(255,255,255,0.03)",
                          "inset -1px 0 0 rgba(0,0,0,0.4)",
                        ].join(", "),
                      }}
                    >
                      <Users
                        style={{
                          width: Math.round(circleSize * 0.36),
                          height: Math.round(circleSize * 0.36),
                          color: "rgba(255,255,255,0.12)",
                          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* + Join Spot — only for very small rooms (1-3 spots) where there's
                room to breathe; crowded rooms (5+) need every vertical pixel for
                avatars so the first row never crowds the language/level header. */}
            {!isFull && displayCount <= 3 && (
              <div className="flex items-center justify-center gap-1 mt-1.5">
                <Plus className="w-3 h-3 text-white/50" />
                <span className="text-[11px] text-white/50 font-medium">Join Spot</span>
              </div>
            )}
          </div>
            );
          })()}

          {/* ── Footer ── */}
          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-white/50">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">
                  {participants.length}/{isUnlimited ? "∞" : room.maxUsers}
                </span>
              </div>

              {isLoggedIn && onVote && (
                <button
                  onClick={(e) => { e.stopPropagation(); onVote(); }}
                  className={`flex items-center gap-0.5 transition-colors ${hasVoted ? "text-orange-400" : "text-white/35 hover:text-orange-400"}`}
                  data-testid={`button-vote-room-${room.id}`}
                  title={hasVoted ? "Remove vote" : "Vote"}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">{voteCount}</span>
                </button>
              )}
            </div>

            {/* Step In — 3D animated swinging door.
                Just two states now:
                  • ENTER → ajar door with green ▸ chevron, click to walk in
                  • FULL  → red NO-ENTRY ⊘ sign, click to knock (host gets an
                            in-room prompt with your name + Allow / Deny)
                Private rooms are treated as FULL — the only way in is to knock.
            */}
            {(() => {
              const isPrivate = !room.isPublic;
              // If the viewer is the owner OR is already listed as a participant
              // (e.g. they joined from another tab) they should ALWAYS see the
              // open door — never asked to knock on a room they're already in.
              const alreadyIn = !!isOwner || (!!user && participants.some(p => p.id === user.id));
              // Anything not freely enterable is rendered as the FULL/knock door,
              // but only if the viewer isn't already a member of the room.
              const isClosed = !alreadyIn && (isFull || isPrivate);
              // Both "full" and "private" rooms now share the LOCKED visual
              // (amber/brass keyhole + warm glow + amber LED caption). The old
              // red sealed-shut FULL look is gone — every closed room reads as
              // "locked", you knock to ask for entry the same way regardless of
              // why the door isn't open.
              const stateClass = isClosed ? "door-3d-locked" : "";

              const doorBody = (
                <>
                  <div className="door-frame">
                    <div className="door-interior">
                      {/* ENTER: bobbing green chevron peeks through the ajar gap */}
                      {!isClosed && (
                        <span className="door-welcome-arrow" aria-hidden="true" />
                      )}
                    </div>
                    <div className="door-panel">
                      <div className="door-panel-inset door-panel-inset-top">
                        {/* FULL/PRIVATE: solid lock that morphs into a knocking
                            hand on hover, signalling the click action. */}
                        {isClosed && (
                          <span className="door-knock-indicator" aria-hidden="true">
                            <Lock className="door-knock-lock w-[13px] h-[13px]" strokeWidth={2.5} />
                            <Hand className="door-knock-hand w-[13px] h-[13px]" strokeWidth={2.5} />
                          </span>
                        )}
                      </div>
                      <div className="door-panel-inset door-panel-inset-bot" />
                      <div className="door-knob" />
                    </div>
                  </div>
                  {/* Tiny state caption under the door */}
                  <span className={`door-caption door-caption-${isClosed ? "full" : "open"}`}>
                    {isClosed ? "Locked" : "Enter"}
                  </span>
                </>
              );

              if (!isLoggedIn) {
                return (
                  <a
                    href="/api/login"
                    className={`door-3d-wrap ${stateClass}`}
                    title={isClosed ? "Sign in to knock" : "Enter room"}
                    data-testid={`button-signin-room-${room.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {doorBody}
                  </a>
                );
              }
              if (isClosed) {
                return (
                  <div
                    className={`door-3d-wrap ${stateClass}`}
                    role="button"
                    tabIndex={0}
                    aria-disabled={knockMutation.isPending || undefined}
                    title={knockMutation.isPending ? "Knocking…" : "🚪 Knock — ask the host to let you in"}
                    onClick={(e) => { e.stopPropagation(); safeKnock(); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); safeKnock(); } }}
                    data-testid={`button-knock-room-${room.id}`}
                  >
                    {doorBody}
                  </div>
                );
              }
              return (
                <div
                  className={`door-3d-wrap ${stateClass}`}
                  role="button"
                  tabIndex={0}
                  title={alreadyIn ? "Re-enter room" : "Enter room"}
                  onClick={(e) => { e.stopPropagation(); onJoin(room.id); }}
                  onKeyDown={(e) => e.key === "Enter" && onJoin(room.id)}
                  data-testid={`button-join-room-${room.id}`}
                >
                  {doorBody}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Report Dialog */}
      {(() => {
        const ownerUser = participants.find(p => p.id === room.ownerId);
        const ownerName = ownerUser ? getUserDisplayName(ownerUser) : room.ownerId.slice(0, 8).toUpperCase();
        return (
          <ReportDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            reportedUser={{
              id: room.ownerId,
              displayName: ownerName,
              profileImageUrl: ownerUser?.profileImageUrl || null,
              initials: ownerUser ? getUserInitials(ownerUser) : "?",
            }}
            context="room"
            contextLabel={`Room: ${room.title}`}
            testIdSuffix={room.id}
          />
        );
      })()}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit Room Settings</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-room-title">Room Name</Label>
              <Input
                id="edit-room-title"
                data-testid="input-edit-room-title"
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

            {/* Card Media — only editable from outside the room. Inside-room
                settings are reserved for live theme & animation tweaks. */}
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
                Pick a GIF, upload your own picture / short video, or tap Clear to remove the current card background.
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground leading-snug bg-muted/30 border border-border/40 rounded-md px-3 py-2">
              Card themes, host controls and in-room animations are managed inside the room — open the room and tap Settings.
            </p>

            <Button
              type="submit"
              className="w-full"
              disabled={!editTitle.trim() || editMutation.isPending || editHologramUploading}
              data-testid="button-save-room-edit"
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * `RoomCard` is wrapped in `React.memo` because the lobby renders 9+ cards in
 * a grid and a "live activity" interval ticks every few seconds, mutating
 * unrelated rooms. Without memoization every tick re-runs every card's
 * render + heart/badge effects, which is the primary contributor to high TBT
 * on the lobby. The default shallow prop comparison is correct here — all
 * props are primitives, the participants array reference is stable from the
 * parent's `useMemo`, and the callbacks come from the lobby (also stable).
 */
export const RoomCard = memo(RoomCardImpl);
