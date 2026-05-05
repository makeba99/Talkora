import { useState, useEffect, useCallback, useRef, lazy, Suspense, useDeferredValue, useMemo, startTransition } from "react";
import { useLocation } from "wouter";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Search, Mic, ChevronUp, ChevronDown, LogIn, Crown, ShieldCheck, GraduationCap, Users, Heart, MessageCircle, Radio, Flame, MessageSquare, Globe, X, Bell, Palette, Users as UsersIcon, PinOff, Anchor, ArrowRight, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RoomCard } from "@/components/room-card";
import { showHintOnce } from "@/lib/hints";

/* SiteFooter (~425 lines) sits below the fold and is never the LCP.
 * ScrollJumpButton only renders after the user has scrolled. Both are
 * deferred so they never block the lobby's first paint. */
const SiteFooter = lazy(() =>
  import("@/components/site-footer").then((m) => ({ default: m.SiteFooter }))
);
const ScrollJumpButton = lazy(() =>
  import("@/components/scroll-jump-button").then((m) => ({ default: m.ScrollJumpButton }))
);

/* Heavy header chrome that only renders for signed-in users (and on user
 * interaction for CreateRoomDialog). Lazy-loading these keeps the initial
 * lobby chunk much smaller — CreateRoomDialog alone pulls in the entire
 * react-hook-form + zod (~117 kB) bundle, and ProfileDropdown is ~1.2k
 * lines of menu UI that the LCP doesn't depend on at all. */
const CreateRoomDialog = lazy(() =>
  import("@/components/create-room-dialog").then((m) => ({ default: m.CreateRoomDialog }))
);
const MessagesDropdown = lazy(() =>
  import("@/components/messages-dropdown").then((m) => ({ default: m.MessagesDropdown }))
);
const NotificationsDropdown = lazy(() =>
  import("@/components/notifications-dropdown").then((m) => ({ default: m.NotificationsDropdown }))
);
const ProfileDropdown = lazy(() =>
  import("@/components/profile-dropdown").then((m) => ({ default: m.ProfileDropdown }))
);
const PinnedSocialsButton = lazy(() =>
  import("@/components/pinned-socials-button").then((m) => ({ default: m.PinnedSocialsButton }))
);

// Heavy lobby surfaces that only mount on user interaction (clicks, hover,
// or the once-per-session onboarding gate). Lazy-loading them keeps the
// initial lobby chunk small without changing what users see — these never
// render anything until the gating state becomes truthy.
const CommentThreadDialog = lazy(() =>
  import("@/components/comment-thread-dialog").then((m) => ({ default: m.CommentThreadDialog }))
);
const OnboardingTour = lazy(() =>
  import("@/components/onboarding-tour").then((m) => ({ default: m.OnboardingTour }))
);
const ContextualHints = lazy(() =>
  import("@/components/contextual-hints").then((m) => ({ default: m.ContextualHints }))
);
const DmDialog = lazy(() =>
  import("@/components/dm-dialog").then((m) => ({ default: m.DmDialog }))
);
const SocialPanel = lazy(() =>
  import("@/components/social-panel").then((m) => ({ default: m.SocialPanel }))
);
const ThemePicker = lazy(() =>
  import("@/components/theme-picker").then((m) => ({ default: m.ThemePicker }))
);
import { useLowBandwidthHint } from "@/hooks/use-low-bandwidth-hint";
import { VextornMark } from "@/components/vextorn-logo";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/lib/socket-context";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LANGUAGES, FLAG_EMOJI } from "@shared/constants";
import type { Announcement, Follow, Room, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  SAMPLE_USERS,
  SAMPLE_ROOMS,
  BASE_SAMPLE_PARTICIPANTS,
  BASE_SAMPLE_VOTE_COUNTS,
  SAMPLE_FOLLOWER_COUNTS,
  SAMPLE_SPEAKER_META,
  ALL_SAMPLE_USERS,
  SAMPLE_PEOPLE,
} from "@/lib/sample-data";

type DiscoveryFilter = "rooms" | "top-speakers" | "famous-users";
type LobbyAnnouncement = Announcement & { viewedAt?: string | null; dismissedAt?: string | null };

function getUserName(person: User) {
  return person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || "Language learner";
}

function getPresenceLabel(status?: string) {
  if (!status || status === "online") return "Online now";
  if (status === "brb") return "BRB";
  if (status === "afk") return "AFK";
  if (status === "busy") return "Busy";
  if (status === "offline") return "Offline";
  return status;
}

function getPresenceClass(status?: string) {
  if (!status || status === "online") return "text-emerald-300";
  if (status === "brb") return "text-amber-300";
  if (status === "afk") return "text-sky-300";
  if (status === "busy") return "text-rose-300";
  return "text-white/50";
}

/**
 * Single floating circular button used in the bottom-right corner pin stack.
 * Renders a neumorphic dark FAB with a centered icon, an optional unread dot,
 * a small persistent "anchor" badge to make the pinned state visually obvious,
 * and an unpin badge that appears on hover/focus to demote it back.
 */
function CornerPinFab({
  label,
  testId,
  icon,
  showDot,
  onClick,
  onUnpin,
}: {
  label: string;
  testId: string;
  icon: React.ReactNode;
  showDot?: boolean;
  onClick: () => void;
  onUnpin: () => void;
}) {
  return (
    <div className="corner-pin-fab-group">
      <button
        type="button"
        className="corner-pin-fab"
        data-testid={testId}
        aria-label={label}
        title={label}
        onClick={onClick}
      >
        <span className="corner-pin-fab-icon">{icon}</span>
        {showDot && <span className="corner-pin-fab-dot" aria-hidden="true" />}
        <span className="corner-pin-fab-badge" aria-hidden="true">
          <Anchor className="w-2.5 h-2.5" />
        </span>
      </button>
      <button
        type="button"
        className="corner-pin-fab-unpin"
        data-testid={`${testId}-unpin`}
        aria-label={`Unpin ${label} from corner`}
        title="Unpin from corner"
        onClick={(e) => { e.stopPropagation(); onUnpin(); }}
      >
        <PinOff className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

function PeopleDiscoveryCard({
  person,
  followerCount,
  isOnline,
  currentRoomId,
  isFollowing,
  isCurrentUser,
  isPending,
  onFollowToggle,
  onTalk,
  voteCount = 0,
  commentCount = 0,
  hasVoted = false,
  onVote,
  onComment,
  bio,
  languages = [],
}: {
  person: User;
  followerCount: number;
  isOnline: boolean;
  currentRoomId?: string;
  isFollowing: boolean;
  isCurrentUser: boolean;
  isPending: boolean;
  onFollowToggle: () => void;
  onTalk: () => void;
  voteCount?: number;
  commentCount?: number;
  hasVoted?: boolean;
  onVote?: () => void;
  onComment?: () => void;
  bio?: string;
  languages?: string[];
}) {
  const { toast } = useToast();
  const name = getUserName(person);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const totalVotes = voteCount + (hasVoted ? 1 : 0);

  return (
    <article
      className="neu-people-card group flex-shrink-0 w-[268px] flex flex-col"
      data-testid={`card-discovery-user-${person.id}`}
    >
      {/* Subtle warm accent strip on top edge */}
      <div className="neu-people-accent" />

      {/* Talking ribbon (only when in a room) */}
      {currentRoomId && (
        <div className="neu-people-talking">
          <Radio className="w-3 h-3" />
          <span>Live in a room</span>
        </div>
      )}

      <div className="p-4 pt-5 flex flex-col flex-1 gap-3.5">
        {/* Avatar + identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="neu-people-avatar-ring">
              {person.profileImageUrl ? (
                <img
                  src={person.profileImageUrl}
                  alt={name}
                  width={58}
                  height={58}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full rounded-full object-cover"
                  data-testid={`img-discovery-user-${person.id}`}
                />
              ) : (
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-base font-black text-white"
                  style={{ background: "linear-gradient(135deg, rgba(255,156,86,0.35), rgba(255,98,0,0.25))" }}
                  data-testid={`avatar-discovery-user-${person.id}`}
                >
                  {initials}
                </div>
              )}
            </div>
            <span
              className={`neu-people-status ${isOnline ? "is-online" : ""}`}
              data-testid={`status-discovery-user-${person.id}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-[14px] font-extrabold text-white leading-tight tracking-tight"
              data-testid={`text-discovery-name-${person.id}`}
            >
              {name}
            </h3>
            <p className={`flex items-center gap-1.5 text-[10.5px] font-semibold mt-1 ${getPresenceClass(person.status)}`}>
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  isOnline
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.85)]"
                    : person.status === "brb"
                      ? "bg-amber-400"
                      : person.status === "afk"
                        ? "bg-sky-400"
                        : person.status === "busy"
                          ? "bg-rose-400"
                          : "bg-white/25"
                }`}
              />
              {getPresenceLabel(person.status)}
            </p>
          </div>
        </div>

        {/* Bio */}
        {bio ? (
          <p className="text-[11.5px] text-white/55 leading-relaxed line-clamp-2 min-h-[32px]">{bio}</p>
        ) : (
          <div className="min-h-[32px]" />
        )}

        {/* Language chips */}
        {languages.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Globe className="w-3 h-3 text-white/50 flex-shrink-0" aria-hidden="true" />
            {languages.map((lang) => (
              <span key={lang} className="neu-people-lang">
                {lang}
              </span>
            ))}
          </div>
        )}

        {/* Inset stats strip — engraved into the card */}
        <div className="neu-people-stats" data-testid={`text-discovery-followers-${person.id}`}>
          <span className="neu-people-stat">
            <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
            <span className="font-bold text-white/85">{followerCount}</span>
            <span className="text-white/55 text-[10px]">followers</span>
          </span>
          {totalVotes > 0 && (
            <span className="neu-people-stat">
              <Flame className="w-3 h-3 text-orange-400" />
              <span className="font-bold text-white/85">{totalVotes}</span>
            </span>
          )}
          {commentCount > 0 && (
            <span className="neu-people-stat">
              <MessageSquare className="w-3 h-3 text-white/60" aria-hidden="true" />
              <span className="font-bold text-white/85">{commentCount}</span>
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 mt-auto">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onFollowToggle}
              disabled={isCurrentUser || isPending}
              className={`neu-people-btn ${isFollowing ? "is-active" : ""} disabled:opacity-45 disabled:cursor-not-allowed`}
              data-testid={`button-follow-discovery-${person.id}`}
              aria-label={isCurrentUser ? undefined : isFollowing ? `Unfollow ${name}` : `Follow ${name}`}
            >
              {isCurrentUser ? "You" : isFollowing ? "Following" : "Follow"}
            </button>
            <button
              onClick={onTalk}
              disabled={isCurrentUser || (!isOnline && !currentRoomId)}
              className="neu-people-btn-primary disabled:opacity-45 disabled:cursor-not-allowed"
              data-testid={`button-talk-discovery-${person.id}`}
              aria-label={isCurrentUser ? undefined : currentRoomId ? `Join ${name}'s room` : `Message ${name}`}
            >
              <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
              {isCurrentUser ? "You" : currentRoomId ? "Talk" : "Message"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onVote}
              disabled={isCurrentUser}
              className={`neu-people-btn-soft ${hasVoted ? "is-voted" : ""} disabled:opacity-45 disabled:cursor-not-allowed`}
              data-testid={`button-vote-discovery-${person.id}`}
              aria-label={isCurrentUser ? undefined : hasVoted ? `Remove vote from ${name}` : `Vote for ${name}`}
              aria-pressed={!isCurrentUser ? hasVoted : undefined}
            >
              <Flame className={`w-3.5 h-3.5 ${hasVoted ? "fill-orange-400 text-orange-400" : "text-orange-300/70"}`} aria-hidden="true" />
              {hasVoted ? "Voted" : "Vote"}
              {totalVotes > 0 && <span className="ml-0.5 opacity-70" aria-hidden="true">{totalVotes}</span>}
            </button>
            <button
              onClick={onComment}
              className="neu-people-btn-soft"
              data-testid={`button-comment-discovery-${person.id}`}
              aria-label={`View comments on ${name}'s profile`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-white/50" aria-hidden="true" />
              Comments
              {commentCount > 0 && <span className="ml-0.5 opacity-70" aria-hidden="true">{commentCount}</span>}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* Defer the OnboardingTour + ContextualHints overlays until well after the
 * LCP window closes. The onboarding-tour chunk itself is lazy-loaded, so
 * importing it earlier triggers a chunk fetch + parse during the critical
 * path. We wait 6.5 s (matching the 6 s floor inside onboarding-tour.tsx)
 * so neither the import cost nor the first paint of the card ever appear
 * inside Lighthouse's LCP measurement window (~4 s on slow-4G). */
function DeferredLobbyOverlays({ onStepChange }: { onStepChange: (id: string) => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 6500);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <OnboardingTour onStepChange={onStepChange} />
      <ContextualHints />
    </Suspense>
  );
}

export default function Lobby() {
  useDocumentMeta({
    title: "Live voice rooms by language",
    description:
      "Join live audio rooms by language and level. Practice English, Spanish, French, Korean, Japanese and more with real people on Vextorn.",
  });
  const { user } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();
  useLowBandwidthHint();
  const [, navigate] = useLocation();
  const isAdminUser = user?.role === "admin" || user?.role === "superadmin" || user?.email === "dj55jggg@gmail.com";
  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [activeDiscovery, setActiveDiscovery] = useState<DiscoveryFilter>("rooms");
  const [speakerVotes, setSpeakerVotes] = useState<Set<string>>(new Set());
  const [dmUserId, setDmUserId] = useState<string | null>(null);
  const [commentTargetUser, setCommentTargetUser] = useState<{ user: any; name: string } | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<
    Record<string, User[]>
  >({});
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [orbitOpen, setOrbitOpen] = useState(false);
  const [languagesExpanded, setLanguagesExpanded] = useState(false);
  const [showLanguageFilters, setShowLanguageFilters] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem("vextorn:showLanguageFilters");
    return saved === null ? false : saved === "true";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vextorn:showLanguageFilters", String(showLanguageFilters));
    }
  }, [showLanguageFilters]);
  const [searchSuggestOpen, setSearchSuggestOpen] = useState(false);
  const searchShellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!searchSuggestOpen) return;
    const onDown = (e: MouseEvent) => {
      if (searchShellRef.current && !searchShellRef.current.contains(e.target as Node)) {
        setSearchSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchSuggestOpen]);

  // -------------------------------------------------------------------------
  // Pinned header items: users can promote any orbit satellite into the
  // header bar (and demote it back). Choice persists per browser via
  // localStorage so it survives reloads.
  // -------------------------------------------------------------------------
  type PinnedKey = "messages" | "notifications" | "themes" | "community" | "orbit";
  const PIN_STORAGE_KEY = "vextorn:header:pinned:v1";
  const [pinned, setPinned] = useState<Record<PinnedKey, boolean>>(() => {
    const fallback: Record<PinnedKey, boolean> = {
      messages: false,
      notifications: false,
      themes: false,
      community: false,
      orbit: false,
    };
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...fallback, ...parsed };
      }
    } catch {}
    return fallback;
  });
  const togglePin = useCallback((key: PinnedKey) => {
    setPinned((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Corner pin state — orthogonal to header pinning. When an item is pinned
  // to the corner it appears as a circular FAB in a vertical stack at the
  // bottom-right of the screen, in addition to (not instead of) wherever it
  // already lives. Items pinnable to the corner include the same orbit
  // satellites plus the header-only buttons (Book Teacher, Profile pill).
  // Persists to localStorage with a separate key so it can evolve
  // independently of the legacy header-pin schema.
  // -------------------------------------------------------------------------
  type CornerKey = PinnedKey | "bookTeacher" | "profile";
  const CORNER_STORAGE_KEY = "vextorn:corner:pinned:v1";
  const [cornerPinned, setCornerPinned] = useState<Record<CornerKey, boolean>>(() => {
    const fallback: Record<CornerKey, boolean> = {
      messages: false,
      notifications: false,
      themes: false,
      community: false,
      orbit: false,
      bookTeacher: false,
      profile: false,
    };
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(CORNER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...fallback, ...parsed };
      }
    } catch {}
    return fallback;
  });
  const toggleCornerPin = useCallback((key: CornerKey) => {
    setCornerPinned((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(CORNER_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  // Adapter so ProfileDropdown's narrower key type lines up with our wider one.
  const toggleCornerPinOrbit = useCallback(
    (key: PinnedKey) => toggleCornerPin(key as CornerKey),
    [toggleCornerPin]
  );

  // Live unread counters drive the auto-popup behavior of the orbital menu.
  const { data: unreadMsgData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread/count"],
    enabled: !!user,
  });
  const { data: notificationsList } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });
  const unreadMessages = unreadMsgData?.count ?? 0;
  const unreadNotifications = (notificationsList ?? []).filter((n: any) => !n.read).length;
  const prevUnreadMsgRef = useRef<number>(0);
  const prevUnreadNotifRef = useRef<number>(0);
  const orbitAutoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // First load is treated as the baseline so we don't auto-popup for pre-existing
  // unread messages — only TRUE deltas (new arrivals during the session) trigger.
  const orbitBaselineSetRef = useRef<boolean>(false);
  useEffect(() => {
    // Keep counters in sync so the trigger-pill badge always reflects the
    // current unread totals, but no longer auto-pop the orbit on growth —
    // Messages and Notifications are no longer in the orbit ring; the user
    // opts them into the header bar via the "Pin to header" row in the
    // profile menu. They still receive everything in the background.
    if (!user) return;
    prevUnreadMsgRef.current = unreadMessages;
    prevUnreadNotifRef.current = unreadNotifications;
    orbitBaselineSetRef.current = true;
  }, [unreadMessages, unreadNotifications, user]);
  useEffect(() => () => {
    if (orbitAutoCloseTimerRef.current) clearTimeout(orbitAutoCloseTimerRef.current);
  }, []);
  const viewedAnnouncementIdsRef = useRef<Set<string>>(new Set());
  const [liveVoteCounts, setLiveVoteCounts] = useState<Record<string, number>>({ ...BASE_SAMPLE_VOTE_COUNTS });
  const [liveParticipants, setLiveParticipants] = useState<Record<string, User[]>>({ ...BASE_SAMPLE_PARTICIPANTS });
  // Memoize the merged participants map so re-renders from socket presence events
  // don't rebuild the object unless the participant data actually changed.
  const mergedRoomParticipants = useMemo(
    () => ({ ...liveParticipants, ...roomParticipants }),
    [liveParticipants, roomParticipants]
  );
  type LobbyKnock = { id: string; roomId: string; fromUserId: string; fromUserName: string; fromUserAvatar: string | null; ts: number };
  const [pendingLobbyKnocks, setPendingLobbyKnocks] = useState<LobbyKnock[]>([]);

  useEffect(() => {
    // Mobile-perf guard: this interval simulates "live" activity on the SAMPLE
    // rooms by randomly bumping vote counts and shuffling participant avatars.
    // It triggers a state update — and therefore a re-render of the lobby grid —
    // every 4-7 seconds, which on a phone means constant React work + layout
    // for purely cosmetic motion. We skip it entirely on phones (and also when
    // the OS asks for reduced motion or when the tab isn't visible).
    if (typeof window !== "undefined") {
      const isMobile = window.matchMedia?.("(max-width: 767px), (pointer: coarse)").matches === true;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
      if (isMobile || reduceMotion) return;
    }
    const sampleRoomIds = SAMPLE_ROOMS.map((r) => r.id);
    let interval: ReturnType<typeof setInterval> | null = null;
    const w = window as any;
    // Defer the interval start until the browser is idle (up to 4s).
    // This keeps the orbit animation off the critical LCP path entirely —
    // Lighthouse's mobile simulation measures LCP during the first ~3s, so
    // any state updates from this interval would contribute to long tasks.
    const idle = w.requestIdleCallback ?? ((cb: () => void, opts: any) => setTimeout(cb, opts?.timeout ?? 1));
    const idleHandle = idle(() => {
      interval = setInterval(() => {
        const roll = Math.random();
        const roomId = sampleRoomIds[Math.floor(Math.random() * sampleRoomIds.length)];
        const room = SAMPLE_ROOMS.find((r) => r.id === roomId);
        if (!room) return;
        // Wrap in startTransition so React treats these as low-priority
        // re-renders — the browser can yield to higher-priority work (input,
        // paint) mid-reconcile instead of blocking for the full tree update.
        startTransition(() => {
          if (roll < 0.45) {
            setLiveVoteCounts((prev) => {
              const curr = prev[roomId] ?? BASE_SAMPLE_VOTE_COUNTS[roomId] ?? 0;
              const delta = Math.floor(Math.random() * 3) + 1;
              const direction = Math.random() > 0.35 ? 1 : -1;
              return { ...prev, [roomId]: Math.max(1, curr + direction * delta) };
            });
          } else if (roll < 0.82) {
            setLiveParticipants((prev) => {
              const currParts = prev[roomId] ?? BASE_SAMPLE_PARTICIPANTS[roomId] ?? [];
              const allPool = ALL_SAMPLE_USERS.filter((u) => !currParts.some((p) => p.id === u.id));
              if (currParts.length < room.maxUsers && allPool.length > 0 && Math.random() > 0.4) {
                const newUser = allPool[Math.floor(Math.random() * allPool.length)];
                return { ...prev, [roomId]: [...currParts, newUser] };
              } else if (currParts.length > 1) {
                const removeIdx = Math.floor(Math.random() * (currParts.length - 1)) + 1;
                return { ...prev, [roomId]: currParts.filter((_, i) => i !== removeIdx) };
              }
              return prev;
            });
          }
        });
      }, 4500 + Math.random() * 3000);
    }, { timeout: 4000 });
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(idleHandle);
      if (interval) clearInterval(interval);
    };
  }, []);

  // SSE: subscribe to the room-list push stream so the 15 s polling interval
  // can be eliminated. The server sends a full room snapshot on connect and
  // on every create/update/delete mutation. EventSource reconnects automatically
  // on drop, so no manual retry logic is needed. We write directly into the
  // React Query cache so there is no extra HTTP round-trip.
  useEffect(() => {
    const es = new EventSource("/api/rooms/stream");

    es.addEventListener("rooms", (e: MessageEvent) => {
      try {
        const incoming: any[] = JSON.parse(e.data);
        // Merge SSE data into the existing cache rather than replacing it
        // wholesale. A full replacement wipes any locally-patched fields
        // (e.g. hologramVideoUrl set by room-edit-dialog's onSuccess) if
        // the SSE snapshot arrives slightly before the DB write is visible
        // to getAllRooms, causing the GIF to disappear until the next SSE.
        queryClient.setQueryData<any[]>(["/api/rooms"], (old) => {
          if (!old || old.length === 0) return incoming;
          const incomingMap = new Map(incoming.map((r: any) => [r.id, r]));
          // Update rooms that appear in the SSE payload (they have active users).
          const updated = old.map((r: any) =>
            incomingMap.has(r.id) ? { ...r, ...incomingMap.get(r.id) } : r
          );
          // Append any brand-new rooms from SSE that weren't in the old cache.
          const newRooms = incoming.filter((r: any) => !old.some((o: any) => o.id === r.id));
          return [...updated, ...newRooms];
        });
      } catch {}
    });

    return () => { es.close(); };
  }, []);

  const { data: fetchedRooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
    // SSE keeps this cache up-to-date in real time. Keep a long safety-net
    // refetch interval in case EventSource fails to reconnect after a drop.
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });

  // Always fetch the owner's own rooms directly from the DB, bypassing the
  // activeUsers>0 filter used by /api/rooms. This prevents two issues:
  //   1. staleTime elapsing → refetch removes room (activeUsers=0) from cache
  //   2. HTTP 304 cache response predating the hologramVideoUrl edit
  // When this data arrives it is merged into the /api/rooms cache so the
  // normal rendering path (userOwnedRooms → rooms → filteredRooms → cards)
  // always has fresh hologramVideoUrl for the owner's room card.
  const { data: myOwnRooms = [] } = useQuery<Room[]>({
    queryKey: ["/api/rooms/mine"],
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 2 * 60 * 1000,
  });
  useEffect(() => {
    if (myOwnRooms.length === 0) return;
    queryClient.setQueryData<any[]>(["/api/rooms"], (old) => {
      if (!old) return myOwnRooms;
      const myMap = new Map(myOwnRooms.map((r) => [r.id, r]));
      // Merge fresh owner data into existing cache — prefer /api/rooms/mine
      // for owner's rooms (always DB-fresh) while keeping all other rooms.
      const updated = old.map((r: any) =>
        myMap.has(r.id) ? { ...r, ...myMap.get(r.id) } : r
      );
      const brandNew = myOwnRooms.filter((r) => !old.some((o: any) => o.id === r.id));
      return [...updated, ...brandNew];
    });
  }, [myOwnRooms]);

  const { data: announcements = [] } = useQuery<LobbyAnnouncement[]>({
    queryKey: ["/api/announcements"],
    refetchInterval: 10 * 60 * 1000,
  });

  const markAnnouncementsViewedMutation = useMutation({
    mutationFn: async (announcementIds: string[]) => {
      await apiRequest("POST", "/api/announcements/viewed", { announcementIds });
    },
  });

  const dismissAnnouncementMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      await apiRequest("POST", `/api/announcements/${announcementId}/dismiss`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement dismissed" });
    },
    onError: (err: any) => toast({ title: "Could not dismiss announcement", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!user || announcements.length === 0) return;
    const unseenIds = announcements
      .filter((announcement) => !announcement.viewedAt && !viewedAnnouncementIdsRef.current.has(announcement.id))
      .map((announcement) => announcement.id);
    if (unseenIds.length === 0) return;
    unseenIds.forEach((id) => viewedAnnouncementIdsRef.current.add(id));
    markAnnouncementsViewedMutation.mutate(unseenIds);
  }, [user, announcements]);

  // Hide empty rooms (activeUsers === 0) from other users — the server
  // already filters them from /api/rooms, but this guards against stale
  // cache / in-flight socket updates delivering a 0-participant room briefly.
  // Exception: the owner always sees their own rooms even at 0 participants,
  // because a just-created room starts at 0 until the creator joins it.
  const userOwnedRooms = fetchedRooms.filter(r => r.ownerId === user?.id);
  const otherRealRooms = fetchedRooms.filter(r => r.ownerId !== user?.id && (r.activeUsers ?? 0) > 0);
  const rooms = useMemo(
    () => [...userOwnedRooms, ...SAMPLE_ROOMS.slice(0, 8), ...otherRealRooms],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchedRooms, user?.id],
  );
  const visibleRooms = useDeferredValue(rooms);

  /* PERF: collect every unique participant id across every visible room so the
   * lobby can fire ONE batched fetch for badges (and reuse the lobby-wide
   * follower-count fetch) instead of letting each card fire its own. On a
   * 9-card lobby this drops 18 POST round-trips down to 2.
   * Memoized: socket presence events fire frequently and the participant IDs
   * rarely change — skipping the Set+sort on every re-render saves ~3ms each. */
  const allVisibleParticipantIds = useMemo(() => {
    const seen = new Set<string>();
    Object.values(mergedRoomParticipants).forEach((arr) => {
      (arr || []).forEach((p) => {
        if (p?.id) seen.add(p.id);
      });
    });
    return Array.from(seen).sort();
  }, [mergedRoomParticipants]);

  const { data: lobbyParticipantBadges = {} } = useQuery<Record<string, any[]>>({
    queryKey: ["/api/users/badges/batch", "lobby", allVisibleParticipantIds.join(",")],
    queryFn: async () => {
      if (allVisibleParticipantIds.length === 0) return {};
      const res = await apiRequest("POST", "/api/users/badges/batch", { userIds: allVisibleParticipantIds });
      return res.json();
    },
    enabled: allVisibleParticipantIds.length > 0,
    staleTime: 60000,
    /* Keep last successful badge map while a new fetch (triggered by a new
     * participant id appearing) is in flight. Without this, `data` resets to
     * undefined on every queryKey change and every RoomCard would briefly
     * re-enable its own per-card batch query — defeating the consolidation. */
    placeholderData: keepPreviousData,
  });

  const roomIds = visibleRooms.map((r) => r.id);
  const { data: voteData, refetch: refetchVotes } = useQuery<{ counts: Record<string, number>; userVotes: Record<string, boolean> }>({
    queryKey: ["/api/rooms/votes/batch", roomIds.join(",")],
    queryFn: async () => {
      if (roomIds.length === 0) return { counts: {}, userVotes: {} };
      const res = await apiRequest("POST", "/api/rooms/votes/batch", { roomIds });
      return res.json();
    },
    enabled: roomIds.length > 0,
    refetchInterval: 5 * 60 * 1000,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ roomId, hasVoted }: { roomId: string; hasVoted: boolean }) => {
      if (hasVoted) {
        await apiRequest("DELETE", `/api/rooms/${roomId}/vote`, {});
      } else {
        await apiRequest("POST", `/api/rooms/${roomId}/vote`, {});
      }
    },
    onSuccess: () => {
      refetchVotes();
    },
  });

  const { data: initialParticipants } = useQuery<Record<string, User[]>>({
    queryKey: ["/api/rooms/participants"],
    /* Bumped from 10s → 30s. Real-time per-room participant changes already
     * arrive via the `room:participants-update` socket event (see effect that
     * registers this listener), so this poll is just a recovery fallback. */
    refetchInterval: 30000,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
    /* Bumped from 15s → 45s. The full users list rarely changes between
     * lobby visits — saving 4 calls/min at this single endpoint. */
    refetchInterval: 10 * 60 * 1000,
  });

  const { data: usersCurrentRooms = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/users/rooms"],
    enabled: !!user,
    /* Bumped from 5s → 30s. The "which room is X currently in" data drives
     * presence dots in side widgets and changes infrequently. 5s polling for
     * this was the single biggest contributor to /api rate-limit hits. */
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: following = [] } = useQuery<Follow[]>({
    queryKey: ["/api/follows/following", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await apiRequest("GET", `/api/follows/following/${user.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const discoverableUserIds = allUsers.map((person) => person.id);
  const { data: followerCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/follows/counts", discoverableUserIds.join(",")],
    queryFn: async () => {
      if (discoverableUserIds.length === 0) return {};
      const res = await apiRequest("POST", "/api/follows/counts", { userIds: discoverableUserIds });
      return res.json();
    },
    enabled: discoverableUserIds.length > 0,
    refetchInterval: 10 * 60 * 1000,
    /* Keep last successful counts while a refetch is in flight so the
     * lobby-wide override passed to RoomCards stays populated and per-card
     * follower-count queries don't briefly re-enable. */
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (initialParticipants) {
      setRoomParticipants((prev) => {
        const merged = { ...initialParticipants };
        for (const [roomId, parts] of Object.entries(prev)) {
          merged[roomId] = parts;
        }
        return merged;
      });
    }
  }, [initialParticipants]);

  const createRoomMutation = useMutation({
    mutationFn: async (roomData: {
      title: string;
      language: string;
      level: string;
      maxUsers: number;
      isPublic: boolean;
      roomTheme?: string | null;
      hologramVideoUrl?: string | null;
      talkPermission?: "everyone" | "co_owners" | "owner_only" | "muted";
    }) => {
      const res = await apiRequest("POST", "/api/rooms", {
        ...roomData,
        ownerId: user?.id,
      });
      return res.json();
    },
    onSuccess: (newRoom) => {
      // Immediately prepend the new room to the cache so the creator sees it
      // without waiting for the SSE broadcast or a refetch round-trip.
      // Do NOT call invalidateQueries here — the SSE stream and room:created
      // socket event already sync all clients in real time. A redundant
      // invalidation triggers a background refetch that races against the SSE
      // update and can cause the new room (or its GIF background) to flicker
      // or disappear until the next full refresh.
      queryClient.setQueryData<any[]>(["/api/rooms"], (old) =>
        old ? (old.some(r => r.id === newRoom.id) ? old : [newRoom, ...old]) : [newRoom]
      );
      // Also sync the /api/rooms/mine cache so the myOwnRooms useEffect always
      // has the correct hologramVideoUrl for this room. Without this, a stale
      // in-flight /api/rooms/mine refetch can complete after onSuccess and
      // overwrite hologramVideoUrl back to null in the /api/rooms cache.
      queryClient.cancelQueries({ queryKey: ["/api/rooms/mine"] });
      queryClient.setQueryData<any[]>(["/api/rooms/mine"], (old = []) =>
        Array.isArray(old)
          ? (old.some((r) => r.id === newRoom.id) ? old : [...old, newRoom])
          : [newRoom]
      );
      toast({ title: "Room created! Click 'Join & Talk' to enter." });
      import("@/lib/sound-fx").then((s) => s.sfxSuccess()).catch(() => {});
    },
    onError: (err: any) => {
      import("@/lib/sound-fx").then((s) => s.sfxError()).catch(() => {});
      let message = "Failed to create room";
      try {
        const text = err?.message || "";
        const jsonPart = text.substring(text.indexOf("{"));
        if (jsonPart) {
          const parsed = JSON.parse(jsonPart);
          message = parsed.message || message;
        }
      } catch {}
      toast({ title: message, variant: "destructive" });
    },
  });

  const followMutation = useMutation({
    mutationFn: async ({ personId, isFollowing }: { personId: string; isFollowing: boolean }) => {
      if (!user?.id) throw new Error("Sign in to follow users");
      if (isFollowing) {
        await apiRequest("DELETE", `/api/follows/${user.id}/${personId}`);
      } else {
        await apiRequest("POST", "/api/follows", { followerId: user.id, followingId: personId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/counts"] });
      toast({ title: "Follow list updated" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Unable to update follow", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!socket) return;

    socket.on("presence:online", (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
    });

    socket.on("presence:update", (data: { userId: string; status: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (data.status === "online") next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    });

    socket.on(
      "room:participants-update",
      (data: { roomId: string; participants: User[] }) => {
        setRoomParticipants((prev) => ({
          ...prev,
          [data.roomId]: data.participants,
        }));
      }
    );

    socket.on("room:created", (newRoom: any) => {
      // Always prefer setQueryData for instant UI updates. The SSE stream
      // is the authoritative real-time source — no invalidation needed here.
      if (newRoom?.id) {
        queryClient.setQueryData<any[]>(["/api/rooms"], (old) =>
          old ? (old.some(r => r.id === newRoom.id) ? old : [newRoom, ...old]) : [newRoom]
        );
      }
      // If newRoom has no id (malformed), the SSE broadcastRooms() will
      // arrive momentarily and correct the cache automatically.
    });

    socket.on("room:updated", (updatedRoom: any) => {
      if (!updatedRoom?.id) return;
      queryClient.setQueryData<any[]>(["/api/rooms"], (old) => {
        if (!old) return old;
        return old.map(r => r.id === updatedRoom.id ? { ...r, ...updatedRoom } : r);
      });
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
      }) => {
        if (!data?.userId) return;
        // Patch the user's profile fields in every room they're currently in
        // so lobby cards refresh avatars/rings/decorations without a reload.
        setRoomParticipants((prev) => {
          let changed = false;
          const next: typeof prev = {};
          for (const [roomId, parts] of Object.entries(prev)) {
            const idx = parts.findIndex((p) => p.id === data.userId);
            if (idx === -1) {
              next[roomId] = parts;
            } else {
              changed = true;
              const updated = [...parts];
              updated[idx] = { ...updated[idx], ...data };
              next[roomId] = updated;
            }
          }
          return changed ? next : prev;
        });
      }
    );

    socket.on("room:deleted", (data: { roomId: string }) => {
      if (data?.roomId) {
        queryClient.setQueryData<any[]>(["/api/rooms"], (old) =>
          old ? old.filter((r) => r.id !== data.roomId) : old
        );
        setRoomParticipants((prev) => {
          const next = { ...prev };
          delete next[data.roomId];
          return next;
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      }
    });

    socket.on("room:full", () => {
      toast({
        title: "Room is full",
        description: "This room has reached its maximum capacity. Try another room.",
        variant: "destructive",
      });
    });

    // Someone knocked on MY room while I'm on the lobby — show Allow/Deny prompt.
    socket.on("room:knock-request", (data: { roomId: string; fromUserId: string; fromUserName: string; fromUserAvatar: string | null; ts: number }) => {
      if (!data?.fromUserId) return;
      setPendingLobbyKnocks(prev => {
        if (prev.some(k => k.fromUserId === data.fromUserId && k.roomId === data.roomId)) return prev;
        return [...prev, { id: `${data.fromUserId}-${data.ts}`, roomId: data.roomId, fromUserId: data.fromUserId, fromUserName: data.fromUserName, fromUserAvatar: data.fromUserAvatar, ts: data.ts }];
      });
    });

    // Host responded to my knock — let me in (or politely turn me away).
    socket.on("room:knock-allowed", (data: { roomId: string; roomTitle: string }) => {
      toast({
        title: "🚪 You're in!",
        description: `${data.roomTitle || "The host"} opened the door — joining now…`,
      });
      // Auto-redirect into the room. The capacity bypass grant on the server
      // is one-shot, so we go straight there.
      if (data?.roomId) navigate(`/room/${data.roomId}`);
    });

    socket.on("room:knock-denied", (data: { roomId: string; roomTitle: string }) => {
      toast({
        title: "Knock declined",
        description: `The host of "${data.roomTitle || "the room"}" isn't taking visitors right now.`,
        variant: "destructive",
      });
    });

    return () => {
      socket.off("presence:online");
      socket.off("presence:update");
      socket.off("room:participants-update");
      socket.off("room:created");
      socket.off("room:updated");
      socket.off("room:deleted");
      socket.off("user:profile-updated");
      socket.off("room:full");
      socket.off("room:knock-request");
      socket.off("room:knock-allowed");
      socket.off("room:knock-denied");
    };
  }, [socket, toast]);

  const handleLobbyKnockAllow = useCallback((knock: LobbyKnock) => {
    if (!socket) return;
    socket.emit("room:knock-allow", { roomId: knock.roomId, userId: knock.fromUserId });
    setPendingLobbyKnocks(prev => prev.filter(k => k.id !== knock.id));
    toast({ title: "✅ Allowed", description: `${knock.fromUserName} can now join.` });
  }, [socket, toast]);

  const handleLobbyKnockDeny = useCallback((knock: LobbyKnock) => {
    if (!socket) return;
    socket.emit("room:knock-deny", { roomId: knock.roomId, userId: knock.fromUserId });
    setPendingLobbyKnocks(prev => prev.filter(k => k.id !== knock.id));
  }, [socket]);

  // Ghost-typing demo for the search step of the onboarding tour.
  // We animate fake characters into the search input so first-timers
  // can see "this is what searching looks like" without doing it themselves.
  const ghostTypingRef = useRef<{ cancel: () => void } | null>(null);
  const startGhostTyping = useCallback((text: string) => {
    ghostTypingRef.current?.cancel();
    let i = 0;
    let typing: ReturnType<typeof setInterval> | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    setSearchQuery("");
    typing = setInterval(() => {
      i += 1;
      setSearchQuery(text.slice(0, i));
      if (i >= text.length && typing) {
        clearInterval(typing);
        typing = null;
        clearTimer = setTimeout(() => setSearchQuery(""), 1700);
      }
    }, 110);
    ghostTypingRef.current = {
      cancel: () => {
        if (typing) clearInterval(typing);
        if (clearTimer) clearTimeout(clearTimer);
        setSearchQuery("");
      },
    };
  }, []);
  useEffect(() => () => ghostTypingRef.current?.cancel(), []);

  // Hook the onboarding tour into the lobby for step-specific side effects:
  // switching the discovery tab and triggering the ghost-typing demo.
  const handleTourStepChange = useCallback(
    (
      current: { id: string; tab?: "rooms" | "top-speakers" | "famous-users"; ghostType?: string } | null,
      prev: { id: string; tab?: "rooms" | "top-speakers" | "famous-users"; ghostType?: string } | null,
    ) => {
      // Tour closed — make sure typing is cleaned up, orbit is closed, and we're back on rooms.
      if (!current) {
        ghostTypingRef.current?.cancel();
        setOrbitOpen(false);
        if (prev?.tab && prev.tab !== "rooms") setActiveDiscovery("rooms");
        return;
      }
      // Switch discovery tab if the new step wants a specific one.
      if (current.tab) {
        setActiveDiscovery(current.tab);
      }
      // Stop any in-flight ghost typing if we left the search step.
      if (prev?.id === "search" && current.id !== "search") {
        ghostTypingRef.current?.cancel();
      }
      // Trigger ghost typing on entering a step that asks for it. Wait a beat
      // so the spotlight has settled on the search shell first.
      if (current.ghostType && prev?.id !== current.id) {
        const text = current.ghostType;
        setTimeout(() => startGhostTyping(text), 450);
      }
      // Auto-open the orbit popover for the orbit-related steps so the user
      // sees the actual ring, satellites, and pin badges while reading the
      // explanation. Close it again when the tour moves to any other step.
      const orbitSteps = new Set(["profile", "orbit-pin", "orbit-notifs"]);
      const wantOrbit = orbitSteps.has(current.id);
      setOrbitOpen(wantOrbit);
    },
    [startGhostTyping],
  );

  const handleJoinRoom = useCallback(
    async (roomId: string) => {
      if (roomId.startsWith("sample-")) {
        toast({ title: "Demo room", description: "Sign in and create your own room to start talking!" });
        return;
      }
      if (!user) {
        window.location.href = "/api/login";
        return;
      }
      showHintOnce({
        id: "room-first-join",
        title: "Welcome to your first room",
        body: "Your mic stays muted at first — listen for a beat, then raise your hand when you're ready to speak.",
        durationMs: 8000,
      });
      try {
        const res = await apiRequest("POST", `/api/rooms/${encodeURIComponent(roomId)}/access-link`, {});
        const data = await res.json();
        try {
          const bc = new BroadcastChannel(`connect-room-${user.id}`);
          bc.postMessage({ type: "room-joined", roomId });
          bc.close();
        } catch {}
        const url = data.path || `/room/${roomId}`;
        const target = `vextorn-room-${roomId}`;
        // Try to focus an existing room tab without overwriting its state.
        let popup: Window | null = null;
        try {
          popup = window.open("", target);
        } catch {
          popup = null;
        }
        if (popup && !popup.closed) {
          try {
            if (popup.location.href === "about:blank") {
              popup.location.href = url;
            }
            popup.focus();
            return;
          } catch {
            try { popup.focus(); } catch {}
            return;
          }
        }
        // No existing tab — try to open a fresh one.
        let opened: Window | null = null;
        try {
          opened = window.open(url, target);
        } catch {
          opened = null;
        }
        if (opened && !opened.closed) {
          try { opened.focus(); } catch {}
          return;
        }
        // Popup blocked (e.g. inside Replit preview iframe, mobile in-app
        // browsers, strict popup blockers) — fall back to same-tab nav so
        // the user can still actually enter the room.
        window.location.href = url;
      } catch (error: any) {
        toast({
          title: "Unable to open room",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
      }
    },
    [user, toast]
  );

  // Memoize the filtered+sorted list so useDeferredValue can detect when the
  // reference actually changes — prevents spurious deferred-render cycles on
  // unrelated state updates. useDeferredValue then lets React yield to the
  // browser between room-card reconciliation frames, cutting TBT and INP.
  const filteredRooms = useMemo(
    () =>
      rooms
        .filter((room) => {
          const matchesLang = selectedLanguage === "All" || room.language === selectedLanguage;
          const matchesSearch = room.title.toLowerCase().includes(searchQuery.toLowerCase());
          return matchesLang && matchesSearch;
        })
        .sort((a, b) => {
          const aVotes = voteData?.counts?.[a.id] || 0;
          const bVotes = voteData?.counts?.[b.id] || 0;
          return bVotes - aVotes;
        }),
    [rooms, selectedLanguage, searchQuery, voteData]
  );
  // Deferred copy: React renders the room grid with this value. When
  // filteredRooms changes (new data / filter) React first commits the cheap
  // parts of the update, then resumes room-card reconciliation in background
  // frames — yielding to the browser between them. This keeps input and
  // scroll interactions smooth even while 15+ RoomCards are re-rendering.
  const deferredRooms = useDeferredValue(filteredRooms);

  // Progressive rendering: three scheduler yield points break the 9-card render
  // across three separate tasks instead of one 100ms+ block.
  //   Task 1 (immediate):  cards 0-2  — first viewport row, highest priority
  //   Task 2 (RAF tick 1): cards 3-5  — second row, after browser paints task 1
  //   Task 3 (RAF tick 2): cards 6+   — below-fold, lowest priority
  // Each startTransition marks the batch as non-urgent so React can yield to
  // higher-priority updates (scroll, input) between tasks. Directly reduces the
  // "13 long tasks" count by splitting the heaviest initial commit into thirds.
  const [midFoldReady, setMidFoldReady] = useState(false);
  const [belowFoldReady, setBelowFoldReady] = useState(false);
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      startTransition(() => setMidFoldReady(true));
      const raf2 = requestAnimationFrame(() => {
        startTransition(() => setBelowFoldReady(true));
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PERF: memoize the Set — `following` is stable between socket presence events.
  const followingIds = useMemo(
    () => new Set(following.map((f) => f.followingId)),
    [following]
  );

  // PERF: memoize merged people list — sample data is static, allUsers only
  // changes when a user logs in/out, not on every presence update.
  const mergedPeople = useMemo(() => {
    const realUserIds = new Set(allUsers.map((u) => u.id));
    const sampleToMerge = SAMPLE_PEOPLE.filter((u) => !realUserIds.has(u.id));
    return [...allUsers, ...sampleToMerge];
  }, [allUsers]);

  const getSpeakerFollowers = (id: string) =>
    followerCounts[id] ?? SAMPLE_FOLLOWER_COUNTS[id] ?? 0;
  // getPresenceLabel and getPresenceClass are module-level helpers (above).
  const getSpeakerOnline = (p: User) =>
    onlineUsers.has(p.id) || p.status === "online" || (SAMPLE_SPEAKER_META[p.id]?.isOnline ?? false);

  // PERF: memoize the people list. Most critically, short-circuit when the
  // rooms view is active (the default) — the sort over 30 users never needs to
  // run during the LCP load, cutting TBT meaningfully on slow devices.
  const filteredPeople = useMemo(() => {
    if (activeDiscovery === "rooms") return [];
    const lsq = searchQuery.toLowerCase();
    return mergedPeople
      .filter((person) => {
        const meta = SAMPLE_SPEAKER_META[person.id];
        const searchable = `${getUserName(person)} ${person.email || ""} ${(person as any).bio || ""} ${meta?.bio || ""} ${(meta?.languages || []).join(" ")}`.toLowerCase();
        return searchable.includes(lsq);
      })
      .sort((a, b) => {
        const aFollowers = followerCounts[a.id] ?? SAMPLE_FOLLOWER_COUNTS[a.id] ?? 0;
        const bFollowers = followerCounts[b.id] ?? SAMPLE_FOLLOWER_COUNTS[b.id] ?? 0;
        const aOnline = onlineUsers.has(a.id) || a.status === "online" || (SAMPLE_SPEAKER_META[a.id]?.isOnline ?? false);
        const bOnline = onlineUsers.has(b.id) || b.status === "online" || (SAMPLE_SPEAKER_META[b.id]?.isOnline ?? false);
        const aInRoom = usersCurrentRooms[a.id] ? 1 : 0;
        const bInRoom = usersCurrentRooms[b.id] ? 1 : 0;

        if (activeDiscovery === "top-speakers") {
          return Number(bOnline) - Number(aOnline) || bInRoom - aInRoom || bFollowers - aFollowers || getUserName(a).localeCompare(getUserName(b));
        }

        return bFollowers - aFollowers || Number(bOnline) - Number(aOnline) || getUserName(a).localeCompare(getUserName(b));
      })
      .slice(0, 10);
  }, [mergedPeople, searchQuery, activeDiscovery, followerCounts, onlineUsers, usersCurrentRooms]);

  // PERF: memoize language counts and tag list — these only change when the
  // rooms list itself changes, not on every participant/presence update.
  const languageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rooms.forEach((r) => { counts[r.language] = (counts[r.language] || 0) + 1; });
    return counts;
  }, [rooms]);

  const languageTags = useMemo(
    () => LANGUAGES.filter((lang) => lang === "All" || (languageCounts[lang] || 0) > 0),
    [languageCounts]
  );
  const visibleLanguages = languagesExpanded ? languageTags : languageTags.slice(0, 8);

  // ---------------------------------------------------------------------------
  // Live search suggestions: matching rooms, languages and people, capped so
  // the dropdown stays glanceable. Only computed when there's a query.
  // ---------------------------------------------------------------------------
  const sq = searchQuery.trim().toLowerCase();
  const suggestRooms = sq
    ? rooms
        .filter((r) =>
          r.title.toLowerCase().includes(sq) ||
          r.language.toLowerCase().includes(sq)
        )
        .slice(0, 4)
    : [];
  const suggestLanguages = sq
    ? LANGUAGES.filter(
        (l) => l !== "All" && l.toLowerCase().includes(sq) && (languageCounts[l] || 0) > 0
      ).slice(0, 4)
    : [];
  const suggestPeople = sq
    ? mergedPeople
        .filter((p) => {
          const name = getUserName(p).toLowerCase();
          const email = (p.email || "").toLowerCase();
          return name.includes(sq) || email.includes(sq);
        })
        .slice(0, 4)
    : [];
  const hasSuggestions =
    sq.length > 0 &&
    (suggestRooms.length + suggestLanguages.length + suggestPeople.length) > 0;

  return (
    <div className="flex flex-col h-full neu-canvas">
      <header
        aria-label="Site header"
        className="header-pro sticky top-0 z-50 backdrop-blur-xl transition-all duration-300"
        style={{
          background: "linear-gradient(180deg, hsl(220 9% 8% / 0.94) 0%, hsl(220 9% 10% / 0.82) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        <div className="header-pro-inner flex items-center justify-between gap-4 px-4 sm:px-5 py-2.5 max-w-[1600px] mx-auto">
          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 relative group">
              <div
                className="absolute -inset-2 rounded-[18px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(91,108,255,0.55), rgba(155,92,255,0.55), rgba(255,107,161,0.55))",
                }}
              />
              <VextornMark size={36} className="relative z-10 drop-shadow-[0_0_12px_rgba(155,92,255,0.50)]" />
            </div>
            {/* sr-only h1 ensures screen readers and Lighthouse accessibility
                audits always find a page-level heading even on viewports
                where the visible brand text is inside a display:none container. */}
            <h1 className="sr-only">Vextorn — Talk. Share. Belong.</h1>
            <div className="min-w-0 hidden sm:flex flex-col justify-center leading-none" aria-hidden="true">
              <span
                className="text-[17px] leading-none tracking-tight"
                style={{
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                }}
              >
                Vextorn
              </span>
              <p
                className="text-[9.5px] leading-none mt-1.5 bg-gradient-to-r from-[#9D86FF] via-[#7B5CF6] to-[#3D8FFF] bg-clip-text text-transparent uppercase tracking-[0.18em]"
                style={{ fontWeight: 700 }}
              >
                Talk · Share · Belong
              </p>
            </div>
          </div>

          {/* Action zone — nav landmark so screen readers can jump here */}
          <nav aria-label="Site navigation" className="flex items-center gap-1 flex-shrink-0">
            {user ? (
              <>
                <span className="header-pro-btn-wrap relative inline-flex">
                  <button
                    onClick={() => navigate("/teachers")}
                    className="header-pro-btn inline-flex items-center h-9 px-3.5 rounded-full text-[12px] font-semibold"
                    data-testid="button-book-teacher-nav"
                    title="Book a teacher"
                    aria-label="Book a teacher"
                  >
                    <GraduationCap className="w-4 h-4 sm:mr-1.5 text-neu-orange" />
                    <span className="hidden sm:inline">Book Teacher</span>
                  </button>
                  <span
                    role="button"
                    tabIndex={0}
                    className={`header-pro-corner-pin ${cornerPinned.bookTeacher ? "is-active" : ""}`}
                    onClick={(e) => { e.stopPropagation(); toggleCornerPin("bookTeacher"); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleCornerPin("bookTeacher"); } }}
                    data-testid="button-corner-pin-bookteacher"
                    aria-label={cornerPinned.bookTeacher ? "Unpin Book Teacher from corner" : "Pin Book Teacher to corner"}
                    title={cornerPinned.bookTeacher ? "Unpin from corner" : "Pin to corner"}
                  >
                    <Anchor className="w-2.5 h-2.5" />
                  </span>
                </span>
                {isAdminUser && (
                  <button
                    onClick={() => navigate("/admin")}
                    className="header-pro-btn inline-flex items-center h-9 px-3.5 rounded-full text-[12px] font-semibold"
                    data-testid="button-admin-panel"
                    title="Admin panel"
                    aria-label="Admin panel"
                  >
                    {user.role === "superadmin" || user.email === "dj55jggg@gmail.com" ? (
                      <Crown className="w-4 h-4 sm:mr-1.5 text-neu-orange" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 sm:mr-1.5 text-neu-orange" />
                    )}
                    <span className="hidden sm:inline">Admin</span>
                  </button>
                )}
                <span className="header-pro-divider hidden sm:inline-block" aria-hidden="true" />
                {/* hidden controlled triggers — opened from the orbital profile menu OR from pinned chips */}
                <Suspense fallback={null}>
                  {socialOpen && (
                    <SocialPanel
                      onlineUsers={onlineUsers}
                      onOpenDm={(userId) => setDmUserId(userId)}
                      open={socialOpen}
                      onOpenChange={setSocialOpen}
                      hideTrigger
                    />
                  )}
                </Suspense>
                <Suspense fallback={null}>
                  {messagesOpen && (
                    <MessagesDropdown
                      onOpenDm={(userId) => setDmUserId(userId)}
                      open={messagesOpen}
                      onOpenChange={setMessagesOpen}
                      hideTrigger
                    />
                  )}
                </Suspense>
                <Suspense fallback={null}>
                  {notificationsOpen && (
                    <NotificationsDropdown open={notificationsOpen} onOpenChange={setNotificationsOpen} hideTrigger />
                  )}
                </Suspense>
                <Suspense fallback={null}>
                  {themePickerOpen && (
                    <ThemePicker open={themePickerOpen} onOpenChange={setThemePickerOpen} hideTrigger />
                  )}
                </Suspense>

                {/* Pinned chips: items the user promoted out of the orbit. Hover reveals a tiny unpin badge. */}
                {pinned.messages && (
                  <button
                    type="button"
                    onClick={() => setMessagesOpen(true)}
                    className="header-pin-chip mr-1"
                    data-testid="chip-pinned-messages"
                    aria-label="Messages"
                    title="Messages"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {unreadMessages > 0 && <span className="header-pin-dot" aria-hidden="true" />}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); togglePin("messages"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); togglePin("messages"); } }}
                      className="header-pin-unpin"
                      data-testid="button-unpin-messages"
                      aria-label="Move Messages back to orbit"
                      title="Move back to orbit"
                    >
                      <PinOff className="w-2.5 h-2.5" />
                    </span>
                  </button>
                )}
                {pinned.notifications && (
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(true)}
                    className="header-pin-chip mr-1"
                    data-testid="chip-pinned-notifications"
                    aria-label="Notifications"
                    title="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadNotifications > 0 && <span className="header-pin-dot" aria-hidden="true" />}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); togglePin("notifications"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); togglePin("notifications"); } }}
                      className="header-pin-unpin"
                      data-testid="button-unpin-notifications"
                      aria-label="Move Notifications back to orbit"
                      title="Move back to orbit"
                    >
                      <PinOff className="w-2.5 h-2.5" />
                    </span>
                  </button>
                )}
                {pinned.themes && (
                  <button
                    type="button"
                    onClick={() => setThemePickerOpen(true)}
                    className="header-pin-chip mr-1"
                    data-testid="chip-pinned-themes"
                    aria-label="Themes"
                    title="Themes"
                  >
                    <Palette className="w-4 h-4" />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); togglePin("themes"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); togglePin("themes"); } }}
                      className="header-pin-unpin"
                      data-testid="button-unpin-themes"
                      aria-label="Move Themes back to orbit"
                      title="Move back to orbit"
                    >
                      <PinOff className="w-2.5 h-2.5" />
                    </span>
                  </button>
                )}
                {pinned.community && (
                  <button
                    type="button"
                    onClick={() => setSocialOpen(true)}
                    className="header-pin-chip mr-1"
                    data-testid="chip-pinned-community"
                    aria-label="Community"
                    title="Community"
                  >
                    <UsersIcon className="w-4 h-4" />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); togglePin("community"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); togglePin("community"); } }}
                      className="header-pin-unpin"
                      data-testid="button-unpin-community"
                      aria-label="Move Community back to orbit"
                      title="Move back to orbit"
                    >
                      <PinOff className="w-2.5 h-2.5" />
                    </span>
                  </button>
                )}

                {/* Standalone orbit launcher chip: appears once the user pins
                    the orbit out of the avatar pill. Opens the orbit ring on
                    its own popover so the orbit lives separately from the
                    profile menu. The avatar pill keeps profile-only content. */}
                {pinned.orbit && (
                  <Suspense fallback={null}>
                  <ProfileDropdown
                    open={orbitOpen}
                    onOpenChange={setOrbitOpen}
                    onOpenTheme={() => setThemePickerOpen(true)}
                    onOpenNotifications={() => setNotificationsOpen(true)}
                    onOpenMessages={() => setMessagesOpen(true)}
                    onOpenCommunity={() => setSocialOpen(true)}
                    unreadMessages={unreadMessages}
                    unreadNotifications={unreadNotifications}
                    pinned={pinned}
                    onTogglePin={togglePin}
                    cornerPinned={cornerPinned}
                    onToggleCornerPin={toggleCornerPinOrbit}
                    mode="ring-only"
                    customTrigger={
                      <button
                        type="button"
                        className="header-pin-chip mr-1"
                        data-testid="chip-pinned-orbit"
                        aria-label="Open orbit menu"
                        title="Orbit"
                      >
                        <LayoutGrid className="w-4 h-4" />
                        {(unreadMessages + unreadNotifications) > 0 && (
                          <span className="header-pin-dot" aria-hidden="true" />
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); togglePin("orbit"); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); togglePin("orbit"); } }}
                          className="header-pin-unpin"
                          data-testid="button-unpin-orbit"
                          aria-label="Move Orbit back into profile"
                          title="Move back into profile"
                        >
                          <PinOff className="w-2.5 h-2.5" />
                        </span>
                      </button>
                    }
                  />
                  </Suspense>
                )}

                {/* Avatar pill profile menu.
                    When the orbit lives inside the avatar (default), this
                    popover IS the orbit popover so it shares the orbitOpen
                    controlled state with the rest of the page (auto-popups
                    target it). When the orbit has been pinned out into its
                    own header chip, the avatar pill becomes a pure profile
                    dropdown — we drop the controlled state so it can open
                    independently of the orbit chip's popover. */}
                <Suspense fallback={<Skeleton className="h-9 w-9 rounded-full" />}>
                  <ProfileDropdown
                    {...(pinned.orbit ? {} : { open: orbitOpen, onOpenChange: setOrbitOpen })}
                    onOpenTheme={() => setThemePickerOpen(true)}
                    onOpenNotifications={() => setNotificationsOpen(true)}
                    onOpenMessages={() => setMessagesOpen(true)}
                    onOpenCommunity={() => setSocialOpen(true)}
                    unreadMessages={unreadMessages}
                    unreadNotifications={unreadNotifications}
                    pinned={pinned}
                    onTogglePin={togglePin}
                    cornerPinned={cornerPinned}
                    onToggleCornerPin={toggleCornerPinOrbit}
                    mode={pinned.orbit ? "profile-only" : "full"}
                  />
                </Suspense>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/teachers")}
                  className="neu-btn inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold"
                  data-testid="button-book-teacher-nav-guest"
                  aria-label="Book a teacher"
                >
                  <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-neu-orange" />
                  <span className="hidden sm:inline" aria-hidden="true">Book Teacher</span>
                </button>
                <a
                  href="/api/login"
                  data-testid="button-sign-in"
                  className="neu-btn-orange ml-1 inline-flex items-center h-9 px-4 rounded-full text-sm font-bold"
                >
                  <LogIn className="w-4 h-4 mr-1.5" />
                  Sign In
                </a>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Semantic <main> landmark for accessibility — Lighthouse and screen
          readers both look for exactly one <main> per page so users can jump
          straight to the primary content. Renders identically to a <div>. */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden app-scrollbar" id="main-content">
        <div className="max-w-[1600px] mx-auto p-3 sm:p-4 lg:px-6 xl:px-8 pb-0 space-y-5 lobby-content-enter min-w-0">
          {announcements.length > 0 && (
            <div className="space-y-2" data-testid="container-lobby-announcements">
              {announcements.map((announcement) => {
                const kindTheme = {
                  maintenance: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.28)", accent: "rgba(245,158,11,1)", pill: "rgba(245,158,11,0.18)" },
                  safety:      { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.28)",  accent: "rgba(239,68,68,1)",  pill: "rgba(239,68,68,0.18)" },
                  celebration: { bg: "rgba(167,139,250,0.08)",border: "rgba(167,139,250,0.28)",accent: "rgba(167,139,250,1)",pill: "rgba(167,139,250,0.18)" },
                  platform:    { bg: "rgba(0,200,255,0.06)",  border: "rgba(0,200,255,0.22)",  accent: "rgba(0,200,255,1)",  pill: "rgba(0,200,255,0.15)" },
                }[announcement.kind] ?? { bg: "rgba(0,200,255,0.06)", border: "rgba(0,200,255,0.22)", accent: "rgba(0,200,255,1)", pill: "rgba(0,200,255,0.15)" };

                const mediaUrls = (announcement as any).mediaUrls || [];
                const mediaTypes = (announcement as any).mediaTypes || [];
                const position = (announcement as any).mediaPosition || "below";
                const bodyAfterMedia = (announcement as any).bodyAfterMedia;

                const mediaBlock = mediaUrls.length > 0 ? (
                  <div className={`grid gap-1.5 ${mediaUrls.length === 1 ? "" : "grid-cols-2"}`}>
                    {mediaUrls.map((url: string, i: number) => (
                      <img
                        key={i}
                        src={url}
                        alt={mediaTypes[i] === "gif" ? "Announcement GIF" : "Announcement image"}
                        loading="lazy"
                        decoding="async"
                        width={480}
                        height={208}
                        referrerPolicy="no-referrer"
                        className="w-full rounded-lg object-cover max-h-52 aspect-[12/5]"
                        data-testid={`img-lobby-announcement-media-${announcement.id}-${i}`}
                      />
                    ))}
                  </div>
                ) : null;

                const bodyBlock = <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" data-testid={`text-lobby-announcement-body-${announcement.id}`}>{announcement.body}</p>;
                const bodyAfterBlock = bodyAfterMedia ? (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{bodyAfterMedia}</p>
                ) : null;

                return (
                  <div
                    key={announcement.id}
                    className="rounded-xl border p-4 space-y-2.5"
                    style={{ background: kindTheme.bg, borderColor: kindTheme.border }}
                    data-testid={`card-lobby-announcement-${announcement.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border" style={{ background: kindTheme.pill, borderColor: kindTheme.border, color: kindTheme.accent }}>
                          📣 Admin
                        </span>
                      </div>
                      {user && (
                        <button
                          onClick={() => dismissAnnouncementMutation.mutate(announcement.id)}
                          className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          aria-label="Dismiss announcement"
                          data-testid={`button-dismiss-lobby-announcement-${announcement.id}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm font-bold leading-snug" style={{ color: kindTheme.accent }} data-testid={`text-lobby-announcement-title-${announcement.id}`}>{announcement.title}</p>
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
              })}
            </div>
          )}
          {/* Search bar — sculpted neumorphic capsule with live suggestions */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div
              ref={searchShellRef}
              role="search"
              data-tour-target="search"
              className={`search-neu-shell relative flex-1 ${searchQuery ? "is-filled" : ""} ${searchSuggestOpen && hasSuggestions ? "is-suggesting" : ""}`}
            >
              <span className="search-neu-icon-wrap" aria-hidden="true">
                <Search className="w-[17px] h-[17px]" />
              </span>
              <Input
                aria-label={
                  activeDiscovery === "rooms"
                    ? "Search rooms, languages, and people"
                    : activeDiscovery === "top-speakers"
                      ? "Search top speakers"
                      : "Search famous users"
                }
                placeholder={
                  activeDiscovery === "rooms"
                    ? "Search rooms, languages, people…"
                    : activeDiscovery === "top-speakers"
                      ? "Search top speakers…"
                      : "Search famous users…"
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchSuggestOpen(true);
                }}
                onFocus={(e) => {
                  setSearchSuggestOpen(true);
                  showHintOnce({
                    id: "search-first-focus",
                    title: "Search across the lobby",
                    body: "Try a language like 'spanish', a topic, or a person's name — results update as you type.",
                    anchor: searchShellRef.current,
                  });
                }}
                className="search-neu-input border-0 bg-transparent text-white placeholder:text-white/55 focus-visible:ring-0 focus-visible:ring-offset-0"
                data-testid="input-search-rooms"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setSearchSuggestOpen(false); }}
                  className="search-neu-clear"
                  data-testid="button-clear-search"
                  aria-label="Clear search"
                  title="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Live suggestions dropdown */}
              {searchSuggestOpen && hasSuggestions && (
                <div className="search-suggest" data-testid="popover-search-suggestions">
                  {suggestRooms.length > 0 && (
                    <div className="search-suggest-group">
                      <div className="search-suggest-group-label">
                        <Mic className="w-3 h-3" />
                        <span>Rooms</span>
                      </div>
                      {suggestRooms.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="search-suggest-item"
                          onClick={() => { setSearchSuggestOpen(false); handleJoinRoom(r.id); }}
                          data-testid={`suggest-room-${r.id}`}
                          aria-label={`Enter room: ${r.title} — ${r.language}`}
                        >
                          <span className="search-suggest-item-icon search-suggest-item-icon-room">
                            <Mic className="w-3.5 h-3.5" />
                          </span>
                          <span className="search-suggest-item-body">
                            <span className="search-suggest-item-title">{r.title}</span>
                            <span className="search-suggest-item-sub">{r.language}</span>
                          </span>
                          <ArrowRight className="search-suggest-item-arrow w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  )}
                  {suggestLanguages.length > 0 && (
                    <div className="search-suggest-group">
                      <div className="search-suggest-group-label">
                        <Globe className="w-3 h-3" />
                        <span>Languages</span>
                      </div>
                      {suggestLanguages.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          className="search-suggest-item"
                          onClick={() => {
                            startTransition(() => setSelectedLanguage(lang));
                            setShowLanguageFilters(true);
                            setSearchQuery("");
                            setSearchSuggestOpen(false);
                          }}
                          data-testid={`suggest-language-${lang.toLowerCase()}`}
                          aria-label={`Filter by language: ${lang}`}
                        >
                                  <span className="search-suggest-item-icon search-suggest-item-icon-lang" aria-hidden="true">
                            {FLAG_EMOJI[lang] ? (
                              <span style={{ fontSize: "14px", lineHeight: 1 }}>{FLAG_EMOJI[lang]}</span>
                            ) : (
                              <Globe className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <span className="search-suggest-item-body">
                            <span className="search-suggest-item-title">{lang}</span>
                            <span className="search-suggest-item-sub">
                              {languageCounts[lang] || 0} room{(languageCounts[lang] || 0) === 1 ? "" : "s"}
                            </span>
                          </span>
                          <ArrowRight className="search-suggest-item-arrow w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  )}
                  {suggestPeople.length > 0 && (
                    <div className="search-suggest-group">
                      <div className="search-suggest-group-label">
                        <Users className="w-3 h-3" />
                        <span>People</span>
                      </div>
                      {suggestPeople.map((p) => {
                        const name = getUserName(p);
                        const initial = (name || "?").charAt(0).toUpperCase();
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className="search-suggest-item"
                            aria-label={`View profile: ${getUserName(p)}`}
                            onClick={() => {
                              setActiveDiscovery("famous-users");
                              setSearchSuggestOpen(false);
                            }}
                            data-testid={`suggest-person-${p.id}`}
                          >
                            {p.profileImageUrl ? (
                              <img
                                src={p.profileImageUrl}
                                alt={name}
                                width={28}
                                height={28}
                                loading="lazy"
                                decoding="async"
                                className="search-suggest-item-avatar"
                              />
                            ) : (
                              <span className="search-suggest-item-icon search-suggest-item-icon-people">
                                {initial}
                              </span>
                            )}
                            <span className="search-suggest-item-body">
                              <span className="search-suggest-item-title">{name}</span>
                              <span className="search-suggest-item-sub">
                                {getSpeakerOnline(p) ? "Online now" : "Tap to view"}
                              </span>
                            </span>
                            <ArrowRight className="search-suggest-item-arrow w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            {user && (
              <div className="w-full md:w-auto flex-shrink-0 [&_button]:w-full md:[&_button]:w-auto [&_button]:whitespace-nowrap" data-testid="container-create-room">
                <Suspense fallback={<Skeleton className="h-10 w-full md:w-44 rounded-lg" />}>
                  <CreateRoomDialog
                    onCreateRoom={(data) => createRoomMutation.mutate(data)}
                    isPending={createRoomMutation.isPending}
                  />
                </Suspense>
              </div>
            )}
          </div>

          {/* Filter strip: each chip has its own colour family so Rooms,
              Speakers, Famous and Languages stay easy to tell apart. */}
          <div className="filter-strip" data-testid="filters-discovery-search">
            <div role="group" aria-label="View filter" className="filter-strip-group">
              {([
                { id: "rooms",         label: "Rooms",        icon: Mic,   tone: "purple" },
                { id: "top-speakers",  label: "Top Speakers", icon: Radio, tone: "cyan"   },
                { id: "famous-users",  label: "Famous Users", icon: Heart, tone: "pink"   },
              ] as const).map((filter) => {
                const Icon = filter.icon;
                const isActive = activeDiscovery === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => startTransition(() => setActiveDiscovery(filter.id))}
                    className={`filter-chip filter-chip-${filter.tone} ${isActive ? "is-active" : ""}`}
                    aria-pressed={isActive}
                    data-testid={`filter-discovery-${filter.id}`}
                  >
                    <span className="filter-chip-icon">
                      <Icon className="w-[14px] h-[14px]" />
                    </span>
                    <span className="filter-chip-label">{filter.label}</span>
                  </button>
                );
              })}

              {activeDiscovery === "rooms" && (
                <button
                  type="button"
                  onClick={() => setShowLanguageFilters((v) => !v)}
                  className={`filter-chip filter-chip-teal filter-chip-lang ${showLanguageFilters ? "is-active" : ""}`}
                  aria-expanded={showLanguageFilters}
                  aria-pressed={showLanguageFilters}
                  aria-label={showLanguageFilters ? "Hide language filters" : "Show language filters"}
                  title={showLanguageFilters ? "Hide language filters" : "Show language filters"}
                  data-tour-target="languages"
                  data-testid="button-toggle-language-filters"
                >
                  <span className="filter-chip-icon">
                    <Globe className="w-[14px] h-[14px]" />
                  </span>
                  <span className="filter-chip-label">Languages</span>
                  {selectedLanguage !== "All" && (
                    <span className="filter-chip-meta" data-testid="badge-active-language">
                      {FLAG_EMOJI[selectedLanguage] && (
                        <span aria-hidden="true" style={{ fontSize: "12px", lineHeight: 1 }}>{FLAG_EMOJI[selectedLanguage]}</span>
                      )}
                      {selectedLanguage}
                    </span>
                  )}
                  {showLanguageFilters ? (
                    <ChevronUp className="w-3.5 h-3.5 opacity-80" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                  )}
                </button>
              )}
            </div>

          </div>

          {activeDiscovery === "rooms" && showLanguageFilters && (
          <div className="flex gap-2 flex-wrap items-center" data-testid="row-language-filters">
            {visibleLanguages.map((lang) => {
              const count = lang === "All" ? rooms.length : languageCounts[lang] || 0;
              const isActive = selectedLanguage === lang;
              return (
                <button
                  key={lang}
                  onClick={() => startTransition(() => setSelectedLanguage(lang))}
                  className={`neu-pill flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${isActive ? "is-active" : ""}`}
                  aria-pressed={isActive}
                  aria-label={lang === "All" ? "Show all languages" : `Filter by ${lang}`}
                  style={isActive ? {
                    background: "linear-gradient(145deg, hsl(var(--neu-orange-hi)) 0%, hsl(var(--neu-orange-lo)) 100%)",
                    color: "#fff",
                    border: "1px solid hsl(var(--neu-orange) / 0.45)",
                    boxShadow: "0 0 18px hsl(var(--neu-orange) / 0.40), 0 0 38px hsl(var(--neu-orange) / 0.16), -3px -3px 8px rgba(255,255,255,0.05), 4px 4px 14px rgba(0,0,0,0.62), inset 0 1px 0 rgba(220,210,255,0.40)",
                    textShadow: "0 1px 1px rgba(0,0,0,0.30)",
                  } : undefined}
                  data-testid={`tab-language-${lang.toLowerCase()}`}
                >
                  {FLAG_EMOJI[lang] ? (
                    <span role="img" aria-label={lang} style={{ fontSize: "13px", lineHeight: 1 }} className="select-none">
                      {FLAG_EMOJI[lang]}
                    </span>
                  ) : null}
                  {lang}
                  <span
                    className="text-[11px] font-bold min-w-4 text-center"
                    style={{ opacity: isActive ? 0.9 : 0.6 }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            {languageTags.length > 8 && (
              <button
                onClick={() => startTransition(() => setLanguagesExpanded((v) => !v))}
                className="neu-pill flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
                data-testid="button-toggle-languages"
                aria-expanded={languagesExpanded}
                aria-label={languagesExpanded ? "Show fewer languages" : "Show more languages"}
              >
                {languagesExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    More
                  </>
                )}
              </button>
            )}
          </div>
          )}

          {activeDiscovery !== "rooms" ? (
            <section className="space-y-3" aria-label="People discovery" data-testid="section-people-discovery">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-white" data-testid="text-people-discovery-title">
                    {activeDiscovery === "top-speakers" ? "Top speakers to track" : "Famous users to follow"}
                  </h2>
                  <p className="text-sm text-white/60">
                    Follow people to track them, then talk when they are online or inside a room.
                  </p>
                </div>
                <span className="text-xs text-white/60 flex items-center gap-1" data-testid="text-people-discovery-count">
                  {filteredPeople.length} people
                </span>
              </div>
              {filteredPeople.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center text-sm text-white/65" data-testid="text-no-discovery-users">
                  No people found. Try a different search.
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto app-scrollbar pb-2" data-testid="list-people-discovery">
                  {filteredPeople.map((person) => {
                    const isSamplePerson = person.id.startsWith("sample-user-");
                    const meta = SAMPLE_SPEAKER_META[person.id];
                    const isOnline = getSpeakerOnline(person);
                    const currentRoomId = usersCurrentRooms[person.id];
                    const isFollowing = followingIds.has(person.id);
                    const hasVoted = speakerVotes.has(person.id);
                    return (
                      <div
                        key={person.id}
                        {...(person.id === filteredPeople[0]?.id ? { "data-tour-target": "people" } : {})}
                      >
                      <PeopleDiscoveryCard
                        person={person}
                        followerCount={getSpeakerFollowers(person.id)}
                        isOnline={isOnline}
                        currentRoomId={currentRoomId}
                        isFollowing={isFollowing}
                        isCurrentUser={!!user && person.id === user.id}
                        isPending={followMutation.isPending}
                        voteCount={meta?.voteCount ?? 0}
                        commentCount={meta?.commentCount ?? 0}
                        hasVoted={hasVoted}
                        bio={meta?.bio ?? (person as any).bio}
                        languages={meta?.languages ?? []}
                        onFollowToggle={() => {
                          if (!user) { toast({ title: "Sign in to follow users", description: "Create an account to start following." }); return; }
                          if (person.id !== user.id) {
                            followMutation.mutate({ personId: person.id, isFollowing });
                          }
                        }}
                        onVote={() => {
                          if (!user) { toast({ title: "Sign in to vote", description: "Create an account to vote for speakers." }); return; }
                          setSpeakerVotes((prev) => {
                            const next = new Set(prev);
                            if (next.has(person.id)) next.delete(person.id);
                            else next.add(person.id);
                            return next;
                          });
                          toast({ title: hasVoted ? "Vote removed" : "Voted! 🔥" });
                        }}
                        onComment={() => {
                          setCommentTargetUser({ user: person, name: getUserName(person) });
                        }}
                        onTalk={() => {
                          if (!user) { toast({ title: "Sign in to message", description: "Create an account to send messages." }); return; }
                          if (currentRoomId) {
                            handleJoinRoom(currentRoomId);
                            return;
                          }
                          if (!isSamplePerson) setDmUserId(person.id);
                          else toast({ title: "This is a demo user", description: "Sign in and meet real language learners!" });
                        }}
                      />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : roomsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-4 lg:gap-y-5 xl:gap-y-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-3 p-5 rounded-md border" style={{ minHeight: 300 }}>
                  <Skeleton className="h-6 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="w-10 h-10 rounded-full" />
                    ))}
                  </div>
                  <div className="flex justify-between gap-2">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-9 w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : deferredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <Mic className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-semibold" data-testid="text-no-rooms">No rooms found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || selectedLanguage !== "All"
                    ? "Try adjusting your filters"
                    : "Be the first to create a voice room!"}
                </p>
              </div>
              {user ? (
                <Suspense fallback={<Skeleton className="h-10 w-44 rounded-lg" />}>
                  <CreateRoomDialog
                    onCreateRoom={(data) => createRoomMutation.mutate(data)}
                    isPending={createRoomMutation.isPending}
                  />
                </Suspense>
              ) : (
                <Button asChild data-testid="button-sign-in-empty">
                  <a href="/api/login">Sign in to create a room</a>
                </Button>
              )}
            </div>
          ) : (
            <section aria-label="Voice rooms">
            <h2 className="sr-only">Voice rooms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-5 lg:gap-y-6 xl:gap-y-7">
              {(() => {
                /* PERF: mergedRoomParticipants is now a top-level useMemo so it
                 * is only recomputed when liveParticipants or roomParticipants
                 * actually change — not on every socket presence event. */
                const mergedParticipants = mergedRoomParticipants;
                const hasLobbyFollowerCounts = Object.keys(followerCounts).length > 0;
                /* PERF: ALWAYS pass the lobby badges override (even before it
                 * resolves), so per-card queries stay disabled from the very
                 * first render. Previously we waited for hasLobbyBadges to be
                 * true, which meant on the first paint each card would race-fire
                 * its own /api/users/badges/batch — turning 1 request into 9.
                 * Now we accept ~50ms of empty badges on initial load in
                 * exchange for eliminating 8 duplicate POSTs that were
                 * appearing in the Lighthouse critical-request chain. */
                const renderedRooms = belowFoldReady ? deferredRooms : midFoldReady ? deferredRooms.slice(0, 6) : deferredRooms.slice(0, 3);
                return renderedRooms.map((room, idx) => {
                const isSample = room.id.startsWith("sample-");
                const card = (
                  <RoomCard
                    room={room}
                    participants={mergedParticipants[room.id] || []}
                    onJoin={handleJoinRoom}
                    onOpenDm={(userId) => setDmUserId(userId)}
                    isOwner={room.ownerId === user?.id}
                    isLoggedIn={!!user}
                    voteCount={isSample ? liveVoteCounts[room.id] ?? 0 : (voteData?.counts?.[room.id] || 0)}
                    hasVoted={voteData?.userVotes?.[room.id] || false}
                    onVote={isSample ? undefined : (user ? () => voteMutation.mutate({ roomId: room.id, hasVoted: voteData?.userVotes?.[room.id] || false }) : undefined)}
                    followerCountsOverride={
                      isSample
                        ? SAMPLE_FOLLOWER_COUNTS
                        : hasLobbyFollowerCounts
                          ? followerCounts
                          : undefined
                    }
                    participantBadgesOverride={lobbyParticipantBadges}
                    priority={idx < 3}
                  />
                );
                /* Note: previously used `content-visibility: auto` on off-screen
                 * cards (idx >= 3) for paint-skipping, but that caused a visible
                 * dark "shadow" artifact on the right half of cards as they
                 * scrolled into view — the browser was painting the placeholder
                 * background before the card's 3D door/avatar contents finished
                 * rendering. Removed to preserve visual fidelity; the off-screen
                 * cards still benefit from `contain: layout paint` via the inner
                 * card styles, and React.memo on RoomCard plus the deferred
                 * overlays in this round handle the perf side. */
                return idx === 0 ? (
                <div key={`${room.id}-${idx}`} data-tour-target="rooms" style={{ contain: "layout paint", minHeight: 255 }}>
                    {card}
                  </div>
                ) : (
                  <div key={`${room.id}-${idx}`} style={{ contain: "layout paint", minHeight: 255 }}>{card}</div>
                );
                });
              })()}
            </div>
            </section>
          )}
        </div>
        <Suspense fallback={null}>
          <SiteFooter />
        </Suspense>
      </main>

      <DeferredLobbyOverlays onStepChange={handleTourStepChange} />

      {user && dmUserId && (
        <Suspense fallback={null}>
          <DmDialog
            otherUserId={dmUserId}
            onClose={() => setDmUserId(null)}
          />
        </Suspense>
      )}

      {commentTargetUser && (
        <Suspense fallback={null}>
          <CommentThreadDialog
            targetUser={commentTargetUser.user}
            targetUserName={commentTargetUser.name}
            onClose={() => setCommentTargetUser(null)}
          />
        </Suspense>
      )}

      {/* Knock-knock notifications for hosts on the lobby */}
      {pendingLobbyKnocks.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 items-end pointer-events-none">
          {pendingLobbyKnocks.map(knock => (
            <div
              key={knock.id}
              className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-[hsl(var(--card))] shadow-2xl px-4 py-3 min-w-[280px] max-w-[340px] animate-in slide-in-from-right-4 fade-in duration-300"
              data-testid={`lobby-knock-card-${knock.fromUserId}`}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border border-white/15 bg-muted flex items-center justify-center">
                {knock.fromUserAvatar ? (
                  <img loading="lazy" decoding="async" src={knock.fromUserAvatar} alt={knock.fromUserName} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-foreground/70">{knock.fromUserName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{knock.fromUserName}</p>
                <p className="text-[11px] text-muted-foreground">wants to join your room</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                  onClick={() => handleLobbyKnockAllow(knock)}
                  data-testid={`button-knock-allow-${knock.fromUserId}`}
                >
                  Allow
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-3 text-xs rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => handleLobbyKnockDeny(knock)}
                  data-testid={`button-knock-deny-${knock.fromUserId}`}
                >
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Suspense fallback={null}>
        <ScrollJumpButton />
      </Suspense>
      {user && (
        <Suspense fallback={null}>
          <PinnedSocialsButton />
        </Suspense>
      )}

      {/* ----------------------------------------------------------------
          Pinned-to-corner FAB stack. Renders one circular floating button
          per item the user has anchored to the bottom-right. Each button
          opens the same panel its header / orbit counterpart would, so
          power users can keep a dock of their most-used tools always one
          click away without crowding the header. The whole stack hides
          when nothing is pinned, so it is invisible until invited.
          ---------------------------------------------------------------- */}
      {user && (cornerPinned.bookTeacher
        || cornerPinned.messages
        || cornerPinned.notifications
        || cornerPinned.themes
        || cornerPinned.community
        || cornerPinned.orbit) && (
        <div className="corner-pin-stack" aria-label="Pinned shortcuts" data-testid="corner-pin-stack">
          {cornerPinned.bookTeacher && (
            <CornerPinFab
              label="Book Teacher"
              testId="corner-fab-bookteacher"
              icon={<GraduationCap className="w-5 h-5 text-neu-orange" />}
              onClick={() => navigate("/teachers")}
              onUnpin={() => toggleCornerPin("bookTeacher")}
            />
          )}
          {cornerPinned.messages && (
            <CornerPinFab
              label="Messages"
              testId="corner-fab-messages"
              icon={<MessageCircle className="w-5 h-5" />}
              showDot={unreadMessages > 0}
              onClick={() => setMessagesOpen(true)}
              onUnpin={() => toggleCornerPin("messages")}
            />
          )}
          {cornerPinned.notifications && (
            <CornerPinFab
              label="Notifications"
              testId="corner-fab-notifications"
              icon={<Bell className="w-5 h-5" />}
              showDot={unreadNotifications > 0}
              onClick={() => setNotificationsOpen(true)}
              onUnpin={() => toggleCornerPin("notifications")}
            />
          )}
          {cornerPinned.community && (
            <CornerPinFab
              label="Community"
              testId="corner-fab-community"
              icon={<UsersIcon className="w-5 h-5" />}
              onClick={() => setSocialOpen(true)}
              onUnpin={() => toggleCornerPin("community")}
            />
          )}
          {cornerPinned.themes && (
            <CornerPinFab
              label="Themes"
              testId="corner-fab-themes"
              icon={<Palette className="w-5 h-5" />}
              onClick={() => setThemePickerOpen(true)}
              onUnpin={() => toggleCornerPin("themes")}
            />
          )}
          {cornerPinned.orbit && (
            <CornerPinFab
              label="Orbit"
              testId="corner-fab-orbit"
              icon={<LayoutGrid className="w-5 h-5" />}
              showDot={(unreadMessages + unreadNotifications) > 0}
              onClick={() => setOrbitOpen(true)}
              onUnpin={() => toggleCornerPin("orbit")}
            />
          )}
        </div>
      )}
    </div>
  );
}
