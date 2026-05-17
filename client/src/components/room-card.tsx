import { useState, useRef, useEffect, useCallback, memo, lazy, Suspense } from "react";
import { loadKnockCooldown, saveKnockCooldown } from "@/lib/knock-cooldown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, Settings, Lock, Globe, UserPlus, UserCheck, MessageSquare, Heart, Instagram, Linkedin, Facebook, X, Copy, Bell, Mic, Flame, Plus, Hand } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAvatarRingClass } from "@/lib/avatar-ring";
import { getRoomThemeBorderClass, ROOM_THEMES } from "@/lib/room-theme-utils";
import { UserBadgePips } from "@/components/user-badge-pips";

// Heavy components — only loaded on user interaction, never on initial paint.
// profile-decorations.tsx is 1,900 lines of SVG data; keeping it out of the
// critical path saves ~400 ms of script evaluation on the lobby load.
const ProfileDecoration = lazy(() =>
  import("@/components/profile-decorations").then((m) => ({ default: m.ProfileDecoration }))
);
const ReportDialog = lazy(() =>
  import("@/components/report-dialog").then((m) => ({ default: m.ReportDialog }))
);
// Room edit dialog — fetched only when the gear icon is clicked (never on
// initial lobby paint). Keeps ~20 KiB of form JSX out of the critical chunk.
const RoomEditDialog = lazy(() =>
  import("@/components/room-edit-dialog").then((m) => ({ default: m.RoomEditDialog }))
);
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Room, User, Follow, UserBadge } from "@shared/schema";
import { FLAG_EMOJI, LANGUAGE_COUNTRY_CODE } from "@shared/constants";

/* ─── Module-level viewport singleton ─────────────────────────────────────
 * Each RoomCard previously installed its own window resize listener.
 * On a 9-card lobby that's 9 handlers all firing on the same resize event
 * — identical work done 9× per frame. This singleton installs exactly ONE
 * passive listener for the whole page, notifies every subscribed card, and
 * lets them recompute in a shared microtask batch instead of 9 separate
 * ones.  The `passive: true` flag also removes the browser's
 * scroll-blocking check and eliminates Lighthouse's non-passive-listener
 * warning.
 * ─────────────────────────────────────────────────────────────────────── */
let _vpWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
const _vpSubs = new Set<() => void>();
let _vpInstalled = false;

// Module-level MediaQueryList singletons — created once when the module loads
// instead of inside the render function. Previously `window.matchMedia` was
// called twice per CardHologramVideo render, meaning 6–9 redundant queries
// per paint cycle with multiple cards on screen. Singleton avoids that cost.
const _mqlCoarse = typeof window !== "undefined"
  ? window.matchMedia("(max-width: 767px), (pointer: coarse)")
  : null;
const _mqlReduced = typeof window !== "undefined"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;
function _getSkipMotion(): boolean {
  return (_mqlCoarse?.matches ?? false) || (_mqlReduced?.matches ?? false);
}

function subscribeVpResize(cb: () => void): () => void {
  if (!_vpInstalled && typeof window !== "undefined") {
    window.addEventListener(
      "resize",
      () => { _vpWidth = window.innerWidth; _vpSubs.forEach((fn) => fn()); },
      { passive: true },
    );
    _vpInstalled = true;
  }
  _vpSubs.add(cb);
  return () => _vpSubs.delete(cb);
}

function computeCircleScale(displayCount: number): number {
  const w = _vpWidth;
  const crowded = displayCount >= 4;
  if (w >= 1536) return crowded ? 1.10 : 1.35;
  if (w >= 1280) return crowded ? 1.00 : 1.18;
  if (w >= 1024) return crowded ? 0.94 : 1.06;
  return crowded ? 0.90 : 0.98;
}

/**
 * Avatars in this card render at 52–74 CSS px. randomuser.me serves portraits
 * at 128 px by default — that's 2–3× larger than needed on a 1× display, and
 * Lighthouse flagged 7+ KiB of waste per avatar. Their CDN exposes a `/med/`
 * path variant (~72 px) which is the perfect base for 1× displays. We then
 * upgrade to the 128 px file via `srcSet` for retina screens.
 *
 * For non-randomuser URLs (local /avatars/, Replit object storage, Google
 * profile pictures, etc.) the original src is returned untouched.
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
  /** Marks the card as above-the-fold. Controls the IntersectionObserver
   *  gate in CardHologramVideo so above-fold cards load backgrounds
   *  immediately instead of waiting for scroll. No longer used for
   *  image loading priority (avatars/flags are always lazy). */
  priority?: boolean;
}



function LanguageFlag({ language }: { language: string }) {
  const code = LANGUAGE_COUNTRY_CODE[language];
  if (!code) return <Globe className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />;
  return (
    <img
      src={`https://flagcdn.com/w20/${code}.png`}
      srcSet={`https://flagcdn.com/w40/${code}.png 2x`}
      width={20}
      height={15}
      alt={language}
      loading="lazy"
      decoding="async"
      style={{ borderRadius: 2, flexShrink: 0, objectFit: "cover" }}
    />
  );
}

const _themeGlowCache = new Map<string, { from: string; to: string; ring: string; animated?: string }>();
function getThemeGlowColor(themeId: string | null | undefined): { from: string; to: string; ring: string; animated?: string } {
  const key = themeId ?? "";
  const cached = _themeGlowCache.get(key);
  if (cached) return cached;
  const result = _computeThemeGlowColor(themeId);
  _themeGlowCache.set(key, result);
  return result;
}
function _computeThemeGlowColor(themeId: string | null | undefined): { from: string; to: string; ring: string; animated?: string } {
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
    /* ── DJ / Music Themes ── */
    case "disco":      return { from: "rgba(255,50,200,0.40)", to: "rgba(0,220,255,0.32)", ring: "rgba(255,50,200,0.35), rgba(255,220,0,0.28), rgba(0,220,255,0.32)", animated: "disco-border-wrap" };
    case "trap-gold":  return { from: "rgba(255,185,0,0.40)",  to: "rgba(200,130,0,0.32)", ring: "rgba(255,185,0,0.35), rgba(200,130,0,0.28)", animated: "trap-gold-border-wrap" };
    case "skeleton-gangsta": return { from: "rgba(190,180,165,0.38)", to: "rgba(40,50,65,0.30)", ring: "rgba(190,180,165,0.32), rgba(40,50,65,0.26)" };
    case "romance":    return { from: "rgba(200,40,60,0.50)",  to: "rgba(175,115,20,0.42)", ring: "rgba(200,40,60,0.45), rgba(175,115,20,0.38)" };
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

function ParticipantPopoverShell({
  participant,
  currentUserId,
  onOpenDm,
  badges = [],
  children,
}: {
  participant: User;
  currentUserId?: string;
  onOpenDm?: (userId: string) => void;
  badges?: UserBadge[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {open && (
        <PopoverContent className="w-60 p-2" align="center">
          <ParticipantPopover
            participant={participant}
            currentUserId={currentUserId}
            onOpenDm={onOpenDm}
            badges={badges}
          />
        </PopoverContent>
      )}
    </Popover>
  );
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
          return <AvatarImage src={a.src} srcSet={a.srcSet} alt={getUserDisplayName(participant)} width={64} height={64} loading="lazy" decoding="async" />;
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
              aria-label={`${getUserDisplayName(participant)} on Instagram`}
            >
              <Instagram className="w-4 h-4" aria-hidden="true" />
            </a>
          )}
          {participant.linkedinUrl && (
            <a
              href={participant.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-orange-400 transition-colors"
              aria-label={`${getUserDisplayName(participant)} on LinkedIn`}
            >
              <Linkedin className="w-4 h-4" aria-hidden="true" />
            </a>
          )}
          {participant.facebookUrl && (
            <a
              href={participant.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-orange-500 transition-colors"
              aria-label={`${getUserDisplayName(participant)} on Facebook`}
            >
              <Facebook className="w-4 h-4" aria-hidden="true" />
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
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
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

// Hostnames that exclusively serve image/GIF content (no HTML pages).
// Used as a fallback for CDN URLs that lack a file extension.
const IMAGE_CDN_HOSTNAMES = new Set([
  "media.tenor.com",
  "media1.tenor.com",
  "media2.tenor.com",
  "c.tenor.com",
  "tenor.com",
  "media1.giphy.com",
  "media2.giphy.com",
  "media3.giphy.com",
  "media4.giphy.com",
  "i.imgur.com",
  "i.giphy.com",
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
]);

function isImageMedia(src: string): boolean {
  const cleaned = src.split("?")[0].toLowerCase();
  if (/\.(gif|png|jpe?g|webp|avif|bmp)$/.test(cleaned)) return true;
  // Also treat well-known image CDN hostnames as images even without extension
  try {
    const { hostname } = new URL(src);
    return IMAGE_CDN_HOSTNAMES.has(hostname);
  } catch {}
  return false;
}

const PROXIED_HOSTNAMES = new Set([
  "media.tenor.com",
  "media1.tenor.com",
  "media2.tenor.com",
  "c.tenor.com",
  "tenor.com",
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
]);

/**
 * Route external images through our server-side proxy so the browser receives
 * a 1-year Cache-Control header instead of the 1-day TTL those CDNs set.
 * This satisfies Lighthouse's "Use efficient cache lifetimes" audit and
 * removes direct third-party connections from the lobby's network waterfall.
 */
function proxyExternalUrl(src: string): string {
  try {
    const u = new URL(src);
    if (u.protocol === "https:" && PROXIED_HOSTNAMES.has(u.hostname)) {
      return `/api/proxy/image?url=${encodeURIComponent(src)}`;
    }
  } catch {
    // not a URL — pass through unchanged
  }
  return src;
}

function CardHologramVideo({ src, priority = false }: { src: string; priority?: boolean }) {
  // Lobby cards stack 6+ at a time. We always paint the dimming overlay so the
  // theme mood reads even when we skip animation. Static images render with a
  // plain <img> (cheap), animated videos render with <video> on capable
  // viewports, and YouTube URLs render through the muted lite-iframe.
  //
  // Image/GIF overlay is kept lighter than the video overlay so the GIF is
  // clearly visible — the heavy 44–58% dark scrim was the reason GIF backgrounds
  // appeared almost invisible (they rendered at only ~43% brightness).

  // IntersectionObserver gate: applies only to video/YouTube (heavy) media.
  // Images/GIFs are always eager-loaded regardless of scroll position because:
  //   1. GIFs are typically <1 MB and render immediately via the proxy cache.
  //   2. CSS containment contexts (contain: layout style / layout paint) on
  //      ancestor wrappers can prevent IntersectionObserver from firing, so
  //      relying on it for above-fold image cards caused them to never load.
  //   3. LCP: CSS background-image is never an LCP candidate regardless of
  //      loading strategy, so there is no PageSpeed penalty for eager loading.
  // For video/YouTube (potentially many MB), we keep the observer gate so
  // off-screen cards don't hammer the network on initial page load.
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(isImageMedia(src) ? true : priority);
  // imgSrc starts as the proxied URL; falls back to the direct CDN URL if the
  // proxy returns 413 (GIF > 4 MB). Must be declared unconditionally here to
  // satisfy React's Rules of Hooks (no hooks inside conditional branches).
  const [imgSrc, setImgSrc] = useState(() => proxyExternalUrl(src));
  // Sync imgSrc whenever the src prop changes (e.g. host edits the background
  // GIF from the lobby or in-room settings). Without this, the stale proxied
  // URL from the previous mount keeps showing the old GIF (or nothing if the
  // previous src was null and the component was just mounted fresh via key=).
  useEffect(() => {
    setImgSrc(proxyExternalUrl(src));
  }, [src]);
  useEffect(() => {
    if (shouldLoad) return;
    if (typeof IntersectionObserver === "undefined") { setShouldLoad(true); return; }
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShouldLoad(true); obs.disconnect(); } },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [shouldLoad]);

  const gifOverlay = (
    <div
      className="absolute inset-0 z-[1] pointer-events-none"
      style={{ background: "linear-gradient(to bottom, rgba(2,4,18,0.18) 0%, rgba(2,4,18,0.10) 50%, rgba(2,4,18,0.30) 100%)" }}
    />
  );
  const videoOverlay = (
    <div
      className="absolute inset-0 z-[1] pointer-events-none"
      style={{ background: "linear-gradient(to bottom, rgba(2,4,18,0.44) 0%, rgba(2,4,18,0.32) 58%, rgba(2,4,18,0.58) 100%)" }}
    />
  );
  const ytId = extractYoutubeId(src) || (src.includes("youtube.com/embed/") ? src.split("/embed/")[1]?.split("?")[0] : null);
  // Only video/iframe playback is throttled on phones — images are essentially
  // free, so we keep them visible everywhere.
  const skipMotion = _getSkipMotion();

  // Sentinel div is always rendered so the IntersectionObserver can observe it
  // even before any media mounts. Invisible to users (absolute inset-0, z-0).
  const sentinel = <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />;

  if (isImageMedia(src)) {
    // The parent card wrapper (in RoomCard's render) already applies the
    // hologram as a CSS background-image on the overflow:hidden div, so the
    // GIF/image renders correctly without any <img> here. We intentionally
    // skip the <img> because:
    //   • <img> elements (even with loading="lazy") in the initial viewport
    //     ARE tracked as LCP candidates by Chrome 121+. A large external GIF
    //     loading on slow 4G (1–5 MB at 200 KB/s ≈ 5–25 s) was the root
    //     cause of mobile LCP = 34.7 s in PageSpeed Insights.
    //   • CSS background-image is NEVER an LCP candidate by spec, so using
    //     the parent's backgroundImage leaves the skeleton icon as the dominant
    //     LCP element (~200 ms with the inlined data URI).
    //   • CSS background-image animates GIFs normally in all modern browsers.
    // The gifOverlay gradient is still rendered so dimming is preserved.
    return <>{sentinel}{gifOverlay}</>;
  }

  if (ytId) {
    if (skipMotion) {
      return (
        <>
          {sentinel}
          {/* CSS background-image for YouTube thumbnails — same LCP reasoning as
              above: a <div> with background-image is never an LCP candidate, so
              Lighthouse measures room title text as LCP instead of a slow
              i.ytimg.com image fetch. WebP preferred, JPEG as fallback. */}
          {shouldLoad && (
            <div
              aria-hidden="true"
              className="absolute inset-0 w-full h-full z-0"
              style={{
                backgroundImage: `image-set(url('https://i.ytimg.com/vi_webp/${ytId}/hqdefault.webp') type('image/webp'), url('https://i.ytimg.com/vi/${ytId}/hqdefault.jpg') type('image/jpeg'))`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: 0.55,
                filter: "brightness(0.65) saturate(0.7)",
              }}
            />
          )}
          {videoOverlay}
        </>
      );
    }
    return (
      <>
        {sentinel}
        {shouldLoad && (
          <iframe
            src={buildYoutubeEmbed(ytId)}
            title="Room background video"
            className="absolute inset-0 w-full h-full z-0"
            allow="autoplay; encrypted-media"
            style={{ border: "none", pointerEvents: "none", opacity: 0.55, filter: "brightness(0.7) saturate(0.7)" }}
          />
        )}
        {videoOverlay}
      </>
    );
  }

  if (skipMotion) {
    return <>{sentinel}{videoOverlay}</>;
  }
  return (
    <>
      {sentinel}
      {shouldLoad && (
        <video
          src={src}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{ opacity: 0.55, filter: "brightness(0.7) saturate(0.85)", contentVisibility: "auto", containIntrinsicSize: "100% 100%" }}
        />
      )}
      {videoOverlay}
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

  // Progressive knock cooldown state — loaded from localStorage on first render
  // and updated whenever the server returns a 429 (cooldown) or socket delivers
  // a room:knock-denied event (handled globally in socket-layer → saves to LS).
  const [knockCd, setKnockCd] = useState<{ cooldownUntil: number; denialCount: number; banned: boolean } | null>(() => loadKnockCooldown(room.id));
  // Seconds remaining in the current cooldown, ticking down every second.
  const [knockSecsLeft, setKnockSecsLeft] = useState<number>(0);

  // Re-sync from localStorage whenever cooldown info may have been written by the
  // global socket handler (room:knock-denied arrives outside this component).
  useEffect(() => {
    const cd = loadKnockCooldown(room.id);
    setKnockCd(cd);
  }, [room.id]);

  // Tick-down the cooldown display every second.
  useEffect(() => {
    if (!knockCd || knockCd.banned) { setKnockSecsLeft(0); return; }
    const tick = () => {
      const secs = Math.max(0, Math.ceil((knockCd.cooldownUntil - Date.now()) / 1000));
      setKnockSecsLeft(secs);
    };
    tick();
    if (knockCd.cooldownUntil <= Date.now()) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [knockCd]);

  const knockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rooms/${room.id}/knock`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err: any = new Error(body.message || "Knock failed");
        err.status = res.status;
        err.body = body;
        throw err;
      }
    },
    onSuccess: () => {
      import("@/lib/sound-fx").then((m) => m.sfxKnock()).catch(() => {});
      toast({ title: "🚪 Knock sent!", description: "The host will see your knock inside the room." });
      setTimeout(() => { knockInFlightRef.current = false; }, 1500);
    },
    onError: (err: any) => {
      knockInFlightRef.current = false;
      if (err?.status === 429 && err?.body) {
        const { cooldownUntil, denialCount, banned } = err.body;
        const cd = { cooldownUntil: cooldownUntil ?? 0, denialCount: denialCount ?? 1, banned: !!banned };
        saveKnockCooldown(room.id, cd);
        setKnockCd(cd);
        if (banned) {
          toast({ title: "🚫 You can't knock here", description: "You've been rejected too many times.", variant: "destructive" });
        } else {
          const mins = Math.ceil(((cooldownUntil ?? Date.now()) - Date.now()) / 60000);
          toast({ title: "🚪 Please wait", description: `Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`, variant: "destructive" });
        }
      } else {
        toast({ title: "Couldn't send knock", description: "Please try again.", variant: "destructive" });
      }
    },
  });

  const knockBlocked = !!(knockCd?.banned || (knockCd && knockSecsLeft > 0));

  const safeKnock = () => {
    if (knockInFlightRef.current || knockMutation.isPending || knockBlocked) return;
    knockInFlightRef.current = true;
    knockMutation.mutate();
  };

  // Friendly countdown label for the button: "5:00", "1:23", etc.
  const knockCdLabel = knockCd?.banned
    ? "Blocked"
    : knockSecsLeft > 0
      ? `${Math.floor(knockSecsLeft / 60)}:${String(knockSecsLeft % 60).padStart(2, "0")}`
      : null;
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

  const levelColor: Record<string, string> = {
    Beginner: "text-amber-300",
    Intermediate: "text-orange-400",
    Advanced: "text-orange-500",
    Native: "text-rose-400",
  };

  const themeBorderClass = getRoomThemeBorderClass((room as any).roomTheme);
  const hologramVideoUrl = (room as any).hologramVideoUrl as string | null | undefined;

  const isPremiumAtmosphere = theme === "premium-atmosphere" || (room as any).roomTheme === "premium-atmosphere";
  const activeThemeId = isPremiumAtmosphere ? "premium-atmosphere" : (room as any).roomTheme;
  const glow = getThemeGlowColor(activeThemeId);
  // Unlimited rooms (maxUsers===0) only show filled participants, no ghost tiles.
  // Capped rooms show ALL slots so viewers can see how many spots are open.
  const displayCount = isUnlimited
    ? Math.min(participants.length, 12)
    : Math.min(room.maxUsers, 12);
  const displaySlots = Array.from({ length: displayCount });

  /* viewport-based scale factor so the participant circles grow on bigger screens
     while the card itself stays a comfortable, fixed-feeling size. Sizing is
     based on maxUsers (total capacity) so the grid always fills the card area
     proportionally whether slots are filled or empty.
     Uses the module-level singleton so all cards share ONE passive listener
     instead of N separate resize handlers (one per card). */
  const [circleScale, setCircleScale] = useState(() => computeCircleScale(displayCount));
  useEffect(() => {
    setCircleScale(computeCircleScale(displayCount));
    return subscribeVpResize(() => setCircleScale(computeCircleScale(displayCount)));
  }, [displayCount]);

  /* Fixed circle size — avatars stay the same size regardless of how many
     participants or slots there are. The scale factor still adjusts for
     viewport width so they look right on all screen sizes. */
  const baseCircleSize = 52;
  const circleSize = Math.round(baseCircleSize * circleScale);

  const settingsButton = isOwner ? (
    <button
      className="lobby-card-settings-btn lobby-card-settings-btn--owner flex-shrink-0"
      onClick={(e) => {
        e.stopPropagation();
        setEditOpen(true);
      }}
      data-testid={`button-room-settings-${room.id}`}
      aria-label={`Edit settings for room ${room.title}`}
    >
      <Settings className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
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
          <button
            className="lobby-card-settings-btn flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            data-testid={`button-room-info-${room.id}`}
            aria-label={`Show details for room ${room.title}`}
          >
            <Settings className="w-3.5 h-3.5" aria-hidden="true" />
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
                {(() => {
                  const a = buildAvatarSources(ownerAvatar);
                  return <AvatarImage src={a.src} srcSet={a.srcSet} alt={ownerName} width={64} height={64} loading="lazy" decoding="async" />;
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
              <p className="text-xs text-white/55 mb-0.5">Created At</p>
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
    : isDiscoDJ
    ? `linear-gradient(135deg, rgba(255,50,200,0.80) 0%, rgba(255,220,0,0.70) 25%, rgba(0,255,160,0.65) 50%, rgba(0,220,255,0.70) 75%, rgba(200,50,255,0.80) 100%)`
    : `linear-gradient(135deg, ${glow.from} 0%, rgba(80,100,200,0.08) 50%, ${glow.to} 100%)`;
  // Layered ambient elevation shadow: tight contact shadow + mid float + deep halo.
  // Centered below the card (no X offset) so there are zero directional "shadow edges" —
  // the card simply lifts off the surface like a physical object.
  const ambientDepth = [
    "0 1px 3px rgba(0,0,0,0.45)",
    "0 6px 16px rgba(0,0,0,0.38)",
    "0 20px 44px rgba(0,0,0,0.24)",
    "0 40px 80px rgba(0,0,0,0.12)",
  ].join(", ");
  const outerGlow = isPremiumAtmosphere
    ? `${ambientDepth}, 0 0 18px rgba(0,210,255,0.22), 0 0 36px rgba(110,50,255,0.12), 0 0 60px rgba(0,100,255,0.06)`
    : `${ambientDepth}, 0 0 14px ${glow.from.replace(/[\d.]+\)$/, "0.18)")}`;

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

  const cardAlreadyIn = !!isOwner || (!!user && participants.some(p => p.id === user.id));
  const cardIsClosed = !cardAlreadyIn && (isFull || !room.isPublic);

  return (
    <div
      className={glow.animated ?? ""}
      style={{
        width: "100%",
        padding: "1.5px",
        borderRadius: "26px",
        background: borderGradient,
        boxShadow: outerGlow,
        position: "relative",
      }}
      data-testid={`card-room-${room.id}`}
    >
      <div
        className={`flex flex-col relative overflow-hidden ${isPremiumAtmosphere ? "premium-atmosphere-card" : ""} ${hologramVideoUrl && isImageMedia(hologramVideoUrl) ? "card-image-bg" : ""}`}
        style={{
          borderRadius: "24px",
          // For GIF/image holograms: apply the background-image directly on
          // this div so overflow:hidden + border-radius clip it correctly.
          // IMPORTANT: use backgroundColor (not the `background` shorthand)
          // for the fallback color. The `background` shorthand resets
          // background-image to `none`, which cancels out the backgroundImage
          // longhand set alongside it — causing GIFs to be invisible.
          // Using backgroundColor leaves backgroundImage untouched.
          // For video/YouTube: use the dark gradient so the card looks fine
          // while the iframe/video loads inside CardHologramVideo.
          //
          // NOTE: CSS background-image has NO onError fallback. The image
          // proxy has a 4 MB size cap — if a GIF exceeds it the proxy returns
          // 413 and the background silently disappears (shows only the dark
          // backgroundColor). To guarantee visibility, use the direct URL for
          // all GIF/image backgrounds; the CSP already allows all https: imgs.
          ...(hologramVideoUrl && isImageMedia(hologramVideoUrl)
            ? {
                backgroundColor: "rgb(5, 8, 20)",
                backgroundImage: `url("${hologramVideoUrl.replace(/"/g, "%22")}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : {
                background: isPremiumAtmosphere
                  ? "linear-gradient(145deg, rgb(3,6,22) 0%, rgb(6,8,28) 38%, rgb(5,3,20) 72%, rgb(8,4,25) 100%)"
                  : "linear-gradient(160deg, rgb(16, 20, 50) 0%, rgb(11, 15, 42) 100%)",
              }),
          height: isPremiumAtmosphere ? 268 : 252,
          boxShadow: [
            "inset 0 1px 0 rgba(255,255,255,0.09)",
            "inset 0 -1px 0 rgba(0,0,0,0.50)",
            "inset 1px 0 0 rgba(255,255,255,0.03)",
            "inset -1px 0 0 rgba(0,0,0,0.20)",
          ].join(", "),
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
        {hologramVideoUrl && <CardHologramVideo key={hologramVideoUrl} src={hologramVideoUrl} priority={priority} />}

        <div className="relative z-[2] flex flex-col h-full">

          {/* ── Header ── */}
          <div className="relative z-10 flex items-start justify-between gap-2 px-3 pt-2 pb-4">
            <div className="flex-1 min-w-0 pr-2">
              {/* Title row with green live dot */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                {room.title && (
                  <h3 className="font-extrabold text-sm leading-5 text-white truncate tracking-tight" data-testid={`text-room-title-${room.id}`}>
                    {room.title}
                  </h3>
                )}
                {!room.isPublic && <Lock className="w-3.5 h-3.5 text-white/55 flex-shrink-0" role="img" aria-label="Private room" />}
              </div>
              {/* Sub-row: flag, language, level, mic status, LIVE */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <LanguageFlag language={room.language} />
                <span className="text-[11px] text-white/70 font-medium">{room.language}</span>
                <span className="text-white/30 text-[10px]" aria-hidden="true">•</span>
                <span className={`text-[11px] font-semibold ${levelColor[room.level] || "text-orange-400"}`}>
                  {room.level}
                </span>
                <span className="text-white/30 text-[10px]" aria-hidden="true">•</span>
                {(() => {
                  const tp = ((room as any).talkPermission as string) || "everyone";
                  const isOpen    = tp === "everyone";
                  const isPartial = tp === "co_owners";
                  const iconColor = isOpen ? "text-green-400" : isPartial ? "text-yellow-400" : "text-rose-400";
                  const bg        = isOpen ? "rgba(74,222,128,0.12)"  : isPartial ? "rgba(251,191,36,0.12)"  : "rgba(248,113,113,0.12)";
                  const border    = isOpen ? "rgba(74,222,128,0.25)"  : isPartial ? "rgba(251,191,36,0.25)"  : "rgba(248,113,113,0.25)";
                  const label     = isOpen ? "Open mic"               : isPartial ? "Hosts only"             : "Muted";
                  return (
                    <div
                      className={`flex items-center justify-center w-[18px] h-[18px] rounded-full ${iconColor}`}
                      style={{ background: bg, border: `1px solid ${border}` }}
                      title={label}
                      data-testid={`icon-mic-status-${room.id}`}
                    >
                      <Mic className="w-2.5 h-2.5" />
                    </div>
                  );
                })()}
                {hologramVideoUrl && (extractYoutubeId(hologramVideoUrl) || /twitch\.tv/i.test(hologramVideoUrl)) && (
                  <div className="flex items-center gap-0.5" data-testid={`badge-live-${room.id}`}>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                    </span>
                    <span className="text-[9px] font-bold text-red-400 tracking-wider uppercase">Live</span>
                  </div>
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
                          return <AvatarImage src={a.src} srcSet={a.srcSet} alt={getUserDisplayName(p)} width={22} height={22} className="rounded-full" loading="lazy" decoding="async" />;
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
            const rowGapPx = 6;
            // Door is now absolutely positioned at bottom-right; protect the
            // bottom-right slot for any multi-column grid (≥2 cols).
            const gridRightPad = gridCols >= 2 ? 42 : 0;
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

                  // Participant avatars are always lazy — the LCP anchor is
                  // the /vextorn-icon-192.png in the pre-render skeleton
                  // (96×96 = 9,216 px²). Marking any external avatar as
                  // fetchpriority="high" would compete for bandwidth with the
                  // icon preload and potentially steal LCP. Keep all avatars
                  // lazy so the browser prioritises the icon instead.

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
                          return <AvatarImage
                            src={a.src}
                            srcSet={a.srcSet}
                            alt={getUserDisplayName(p)}
                            width={circleSize}
                            height={circleSize}
                            loading="lazy"
                            decoding="async"
                            className="rounded-2xl"
                          />;
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

                  // ProfileDecoration is a lazy chunk (~1,900-line SVG file).
                  // Most participants have no decoration — skip the Suspense
                  // overhead entirely in that case and render avatarEl directly.
                  const decorated = (p as any).profileDecoration
                    ? (
                      <Suspense fallback={avatarEl}>
                        <ProfileDecoration decorationId={(p as any).profileDecoration} size={circleSize}>
                          {avatarEl}
                        </ProfileDecoration>
                      </Suspense>
                    )
                    : avatarEl;

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
                    <ParticipantPopoverShell
                      key={i}
                      participant={p}
                      currentUserId={user?.id}
                      onOpenDm={onOpenDm}
                      badges={badges}
                    >
                      <button
                        className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
                        data-testid={`button-card-participant-${p.id}`}
                        aria-label={`View ${getUserDisplayName(p)}'s profile`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {decorated}
                        {heartRow}
                      </button>
                    </ParticipantPopoverShell>
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
          <div className="flex items-center gap-2 px-3 pb-2 pt-0">
            {/* Participant count chip */}
            <div
              className="flex items-center gap-0.5 text-white/60"
              data-testid={`badge-participants-${room.id}`}
              title={`${participants.length} of ${isUnlimited ? "∞" : room.maxUsers} participants`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold tabular-nums">
                {participants.length}{!isUnlimited && `/${room.maxUsers}`}
              </span>
            </div>

            {isLoggedIn && onVote && (
              <button
                onClick={(e) => { e.stopPropagation(); onVote(); }}
                className={`flex items-center gap-0.5 transition-colors ${hasVoted ? "text-orange-400" : "text-white/55 hover:text-orange-400"}`}
                data-testid={`button-vote-room-${room.id}`}
                aria-label={hasVoted ? `Remove vote from ${room.title}` : `Vote for ${room.title}`}
                aria-pressed={hasVoted}
              >
                <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-[11px] font-semibold">{voteCount}</span>
              </button>
            )}
          </div>

          {/* ── Door: absolutely pinned to bottom-right of the card so it
              never participates in the flex layout and cannot push the
              participant grid upward or overlap the slots. ── */}
          {(() => {
            const isClosed = cardIsClosed;
            const stateClass = isClosed ? "door-3d-locked" : "";
            const maxP = (room as any).maxParticipants as number | undefined;
            const doorBody = (
              <>
                {maxP != null && (
                  <div
                    className="flex items-center gap-0.5 mb-0.5"
                    data-testid={`badge-capacity-${room.id}`}
                  >
                    <span className="text-[8px] font-semibold tabular-nums"
                      style={{
                        color: participants.length >= maxP ? "hsl(355 70% 65%)" : "hsl(252 50% 65%)",
                        textShadow: participants.length >= maxP ? "0 0 6px hsl(355 65% 40% / 0.6)" : "0 0 6px hsl(252 65% 40% / 0.5)",
                      }}>
                      {participants.length}/{maxP}
                    </span>
                  </div>
                )}
                <div className="door-frame">
                  <div className="door-interior">
                    {!isClosed && <span className="door-welcome-arrow" aria-hidden="true" />}
                  </div>
                  <div className="door-panel">
                    <div className="door-panel-inset door-panel-inset-top">
                      {isClosed && (
                        <span className="door-knock-indicator" aria-hidden="true">
                          <Lock className="door-knock-lock w-[10px] h-[10px]" strokeWidth={2.5} />
                          <Hand className="door-knock-hand w-[10px] h-[10px]" strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                    <div className="door-panel-inset door-panel-inset-bot" />
                    <div className="door-knob" />
                  </div>
                </div>
                <span className={`door-caption door-caption-${isClosed ? "locked" : "open"}`}>
                  {isClosed ? "Locked" : "Enter"}
                </span>
              </>
            );

            const wrapStyle: React.CSSProperties = { position: "absolute", bottom: 8, right: 10, zIndex: 10 };

            if (!isLoggedIn) {
              return (
                <a href="/api/login" className={`door-3d-wrap ${stateClass}`} style={wrapStyle}
                  aria-label={isClosed ? `Sign in to knock on ${room.title}` : `Sign in to enter ${room.title}`}
                  data-testid={`button-signin-room-${room.id}`}
                  onClick={(e) => e.stopPropagation()}>
                  {doorBody}
                </a>
              );
            }
            if (isClosed) {
              return (
                <div style={{ position: "absolute", bottom: 8, right: 10, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div className={`door-3d-wrap ${knockBlocked ? "door-3d-wrap--locked" : stateClass}`}
                    style={{ position: "relative", opacity: knockBlocked ? 0.5 : 1, cursor: knockBlocked ? "not-allowed" : "pointer" }}
                    role="button" tabIndex={knockBlocked ? -1 : 0}
                    aria-disabled={knockMutation.isPending || knockBlocked || undefined}
                    aria-label={knockBlocked ? (knockCd?.banned ? "Permanently blocked from knocking" : `Knock available in ${knockCdLabel}`) : knockMutation.isPending ? `Knocking on ${room.title}…` : `Knock to request entry to ${room.title}`}
                    onClick={(e) => { e.stopPropagation(); safeKnock(); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); safeKnock(); } }}
                    data-testid={`button-knock-room-${room.id}`}>
                    {doorBody}
                  </div>
                  {knockCdLabel && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: knockCd?.banned ? "#ef4444" : "#f59e0b", background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "1px 5px", lineHeight: 1.4, letterSpacing: "0.02em", whiteSpace: "nowrap" }}
                      data-testid={`text-knock-cooldown-${room.id}`}>
                      {knockCd?.banned ? "🚫 Blocked" : `⏳ ${knockCdLabel}`}
                    </span>
                  )}
                </div>
              );
            }
            return (
              <div className={`door-3d-wrap ${stateClass}`} style={wrapStyle}
                role="button" tabIndex={0}
                aria-label={cardAlreadyIn ? `Re-enter ${room.title}` : `Enter ${room.title}`}
                onClick={(e) => { e.stopPropagation(); onJoin(room.id); }}
                onKeyDown={(e) => e.key === "Enter" && onJoin(room.id)}
                onMouseEnter={() => { try { import("@/pages/room"); } catch {} }}
                data-testid={`button-join-room-${room.id}`}>
                {doorBody}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Report Dialog — lazy: only fetched after the user clicks "Report" */}
      {reportOpen && (() => {
        const ownerUser = participants.find(p => p.id === room.ownerId);
        const ownerName = ownerUser ? getUserDisplayName(ownerUser) : room.ownerId.slice(0, 8).toUpperCase();
        return (
          <Suspense fallback={null}>
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
          </Suspense>
        );
      })()}

      {editOpen && (
        <Suspense fallback={null}>
          <RoomEditDialog
            room={room as any}
            onClose={() => setEditOpen(false)}
          />
        </Suspense>
      )}
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
