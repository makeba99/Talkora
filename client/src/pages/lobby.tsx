import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Mic, ChevronUp, ChevronDown, LogIn, Crown, ShieldCheck, GraduationCap, Users, Heart, MessageCircle, Radio, Flame, MessageSquare, Globe, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RoomCard } from "@/components/room-card";
import { CommentThreadDialog } from "@/components/comment-thread-dialog";
import { CreateRoomDialog } from "@/components/create-room-dialog";
import { DmDialog } from "@/components/dm-dialog";
import { MessagesDropdown } from "@/components/messages-dropdown";
import { SocialPanel } from "@/components/social-panel";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { ThemePicker } from "@/components/theme-picker";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/lib/socket";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LANGUAGES } from "@shared/schema";
import type { Announcement, Follow, Room, User } from "@shared/schema";
import { Button } from "@/components/ui/button";

type DiscoveryFilter = "rooms" | "top-speakers" | "famous-users";
type LobbyAnnouncement = Announcement & { viewedAt?: string | null; dismissedAt?: string | null };

function makeSampleUser(id: string, firstName: string, lastName: string, portrait: string): User {
  return {
    id,
    email: null,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    profileImageUrl: `https://randomuser.me/api/portraits/${portrait}.jpg`,
    bio: null,
    avatarRing: null,
    flairBadge: null,
    profileDecoration: null,
    instagramUrl: null,
    linkedinUrl: null,
    facebookUrl: null,
    status: "online",
    role: "user",
    warningCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const SAMPLE_USERS = {
  sofia:    makeSampleUser("sample-user-1",  "Sofia",    "Martinez", "women/32"),
  liam:     makeSampleUser("sample-user-2",  "Liam",     "Chen",     "men/46"),
  emma:     makeSampleUser("sample-user-3",  "Emma",     "Davis",    "women/28"),
  carlos:   makeSampleUser("sample-user-4",  "Carlos",   "Rivera",   "men/14"),
  aigerim:  makeSampleUser("sample-user-5",  "Aigerim",  "Bekova",   "women/61"),
  marcus:   makeSampleUser("sample-user-6",  "Marcus",   "Williams", "men/88"),
  anya:     makeSampleUser("sample-user-7",  "Anya",     "Petrova",  "women/52"),
  james:    makeSampleUser("sample-user-8",  "James",    "O'Brien",  "men/67"),
  nadia:    makeSampleUser("sample-user-9",  "Nadia",    "Hassan",   "women/77"),
  kevin:    makeSampleUser("sample-user-10", "Kevin",    "Park",     "men/33"),
  yuki:     makeSampleUser("sample-user-11", "Yuki",     "Tanaka",   "women/5"),
  min:      makeSampleUser("sample-user-12", "Min",      "Ji-hoon",  "men/72"),
  seo:      makeSampleUser("sample-user-13", "Seo",      "Yeon",     "women/44"),
  pierre:   makeSampleUser("sample-user-14", "Pierre",   "Dupont",   "men/55"),
  claire:   makeSampleUser("sample-user-15", "Claire",   "Bernard",  "women/17"),
  hassan:   makeSampleUser("sample-user-16", "Hassan",   "Al-Amin",  "men/78"),
  fatima:   makeSampleUser("sample-user-17", "Fatima",   "Zahra",    "women/90"),
  takeshi:  makeSampleUser("sample-user-18", "Takeshi",  "Mori",     "men/36"),
  hana:     makeSampleUser("sample-user-19", "Hana",     "Suzuki",   "women/26"),
  lucas:    makeSampleUser("sample-user-20", "Lucas",    "Santos",   "men/22"),
};

const SAMPLE_ROOMS: Room[] = [
  {
    id: "sample-room-1",
    title: "English Club 🇬🇧",
    language: "English",
    level: "Beginner",
    maxUsers: 3,
    ownerId: SAMPLE_USERS.sofia.id,
    isPublic: false,
    activeUsers: 3,
    roomTheme: "neon",
    hologramVideoUrl: null,
    createdAt: new Date(),
  },
  {
    id: "sample-room-2",
    title: "Spanish Practice 🇪🇸",
    language: "Spanish",
    level: "Intermediate",
    maxUsers: 2,
    ownerId: SAMPLE_USERS.carlos.id,
    isPublic: true,
    activeUsers: 2,
    roomTheme: "sunset",
    hologramVideoUrl: null,
    createdAt: new Date(),
  },
  {
    id: "sample-room-3",
    title: "Advanced English Talk",
    language: "English",
    level: "Advanced",
    maxUsers: 5,
    ownerId: SAMPLE_USERS.marcus.id,
    isPublic: true,
    activeUsers: 5,
    roomTheme: "cosmic",
    hologramVideoUrl: null,
    createdAt: new Date(),
  },
  {
    id: "sample-room-4",
    title: "Korean Study Group 🇰🇷",
    language: "Korean",
    level: "Beginner",
    maxUsers: 3,
    ownerId: SAMPLE_USERS.min.id,
    isPublic: true,
    activeUsers: 3,
    roomTheme: "hologram",
    hologramVideoUrl: null,
    createdAt: new Date(),
  },
  {
    id: "sample-room-5",
    title: "French Conversation 🇫🇷",
    language: "French",
    level: "Intermediate",
    maxUsers: 3,
    ownerId: SAMPLE_USERS.pierre.id,
    isPublic: false,
    activeUsers: 3,
    roomTheme: "violet",
    hologramVideoUrl: null,
    createdAt: new Date(),
  },
  {
    id: "sample-room-6",
    title: "Japanese Practice 🇯🇵",
    language: "Japanese",
    level: "Beginner",
    maxUsers: 4,
    ownerId: SAMPLE_USERS.yuki.id,
    isPublic: false,
    activeUsers: 4,
    roomTheme: "cherry",
    hologramVideoUrl: null,
    createdAt: new Date(),
  },
];

const SAMPLE_ROOM_PARTICIPANTS: Record<string, User[]> = {
  "sample-room-1": [SAMPLE_USERS.sofia, SAMPLE_USERS.liam, SAMPLE_USERS.emma],
  "sample-room-2": [SAMPLE_USERS.carlos, SAMPLE_USERS.aigerim],
  "sample-room-3": [SAMPLE_USERS.marcus, SAMPLE_USERS.anya, SAMPLE_USERS.james, SAMPLE_USERS.nadia, SAMPLE_USERS.kevin],
  "sample-room-4": [SAMPLE_USERS.min, SAMPLE_USERS.seo, SAMPLE_USERS.hassan],
  "sample-room-5": [SAMPLE_USERS.pierre, SAMPLE_USERS.claire, SAMPLE_USERS.fatima],
  "sample-room-6": [SAMPLE_USERS.yuki, SAMPLE_USERS.takeshi, SAMPLE_USERS.hana, SAMPLE_USERS.lucas],
};

const SAMPLE_FOLLOWER_COUNTS: Record<string, number> = {
  "sample-user-1":  145,
  "sample-user-2":  89,
  "sample-user-3":  203,
  "sample-user-4":  67,
  "sample-user-5":  312,
  "sample-user-6":  421,
  "sample-user-7":  156,
  "sample-user-8":  78,
  "sample-user-9":  234,
  "sample-user-10": 91,
  "sample-user-11": 189,
  "sample-user-12": 342,
  "sample-user-13": 127,
  "sample-user-14": 56,
  "sample-user-15": 98,
  "sample-user-16": 213,
  "sample-user-17": 176,
  "sample-user-18": 144,
  "sample-user-19": 267,
  "sample-user-20": 83,
};

const SAMPLE_VOTE_COUNTS: Record<string, number> = {
  "sample-room-1": 12,
  "sample-room-2": 7,
  "sample-room-3": 24,
  "sample-room-4": 18,
  "sample-room-5": 9,
  "sample-room-6": 15,
};

const SAMPLE_SPEAKER_META: Record<string, { bio: string; languages: string[]; voteCount: number; commentCount: number; isOnline: boolean }> = {
  "sample-user-1":  { bio: "Passionate about bridging cultures through language", languages: ["English", "Spanish"],  voteCount: 89,  commentCount: 24, isOnline: true  },
  "sample-user-2":  { bio: "Daily English practice enthusiast & tech lover",      languages: ["English", "Mandarin"], voteCount: 54,  commentCount: 11, isOnline: true  },
  "sample-user-3":  { bio: "Loves French cinema and casual Spanish conversation",  languages: ["French", "Spanish"],   voteCount: 112, commentCount: 31, isOnline: false },
  "sample-user-4":  { bio: "Native speaker helping beginners get confident",       languages: ["Spanish", "English"],  voteCount: 43,  commentCount: 9,  isOnline: true  },
  "sample-user-5":  { bio: "Trilingual and always looking for a language buddy",   languages: ["Korean", "French"],    voteCount: 201, commentCount: 56, isOnline: true  },
  "sample-user-6":  { bio: "Advanced English, advanced mindset, let's talk!",      languages: ["English", "German"],   voteCount: 267, commentCount: 74, isOnline: true  },
  "sample-user-7":  { bio: "Russian soul, English dreams, talking daily",          languages: ["English", "Russian"],  voteCount: 95,  commentCount: 28, isOnline: false },
  "sample-user-8":  { bio: "Join my room for casual conversation practice",        languages: ["English", "Irish"],    voteCount: 48,  commentCount: 15, isOnline: true  },
  "sample-user-9":  { bio: "Arabic & English fluent — DM me anytime",             languages: ["English", "Arabic"],   voteCount: 143, commentCount: 41, isOnline: false },
  "sample-user-10": { bio: "K-pop fan, Korean learner, English speaker",           languages: ["Korean", "English"],   voteCount: 58,  commentCount: 19, isOnline: true  },
};

const SAMPLE_PEOPLE = Object.values(SAMPLE_USERS).slice(0, 10);

function getUserName(person: User) {
  return person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || "Language learner";
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

  return (
    <article
      className="flex-shrink-0 min-w-[260px] max-w-[260px] rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden flex flex-col"
      style={{
        background: "linear-gradient(160deg, rgba(8,15,40,0.92) 0%, rgba(5,10,30,0.88) 100%)",
        boxShadow: "0 0 28px rgba(0,210,255,0.09), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
      data-testid={`card-discovery-user-${person.id}`}
    >
      {/* Top banner accent */}
      <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #22d3ee, #818cf8, #e879f9)" }} />

      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Avatar + name row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div
              className="w-[72px] h-[72px] rounded-full p-[2.5px]"
              style={{ background: "linear-gradient(135deg, #22d3ee, #818cf8, #e879f9)" }}
            >
              {person.profileImageUrl ? (
                <img
                  src={person.profileImageUrl}
                  alt={name}
                  className="w-full h-full rounded-full object-cover border-2 border-[#08102a]"
                  data-testid={`img-discovery-user-${person.id}`}
                />
              ) : (
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-lg font-black text-white border-2 border-[#08102a]"
                  style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(167,139,250,0.22))" }}
                  data-testid={`avatar-discovery-user-${person.id}`}
                >
                  {initials}
                </div>
              )}
            </div>
            <span
              className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-[#08102a] ${isOnline ? "bg-emerald-400" : "bg-slate-500"}`}
              data-testid={`status-discovery-user-${person.id}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-extrabold text-white leading-tight" data-testid={`text-discovery-name-${person.id}`}>
              {name}
            </h3>
            <p className={`text-[11px] font-semibold mt-0.5 ${isOnline ? "text-emerald-400" : "text-white/40"}`}>
              {isOnline ? "● Online now" : "○ Offline"}
            </p>
            {currentRoomId && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-cyan-300 bg-cyan-400/10 rounded-full px-2 py-0.5">
                <Radio className="w-2.5 h-2.5" />
                Talking
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <p className="text-[11px] text-white/55 leading-relaxed line-clamp-2">{bio}</p>
        )}

        {/* Language badges */}
        {languages.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Globe className="w-3 h-3 text-white/30 flex-shrink-0" />
            {languages.map((lang) => (
              <span
                key={lang}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-violet-400/25 bg-violet-400/10 text-violet-200"
              >
                {lang}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-white/60" data-testid={`text-discovery-followers-${person.id}`}>
            <Heart className="w-3 h-3 text-red-400 fill-red-400" />
            <span className="font-semibold text-white/80">{followerCount}</span>
            <span className="text-white/35">followers</span>
          </span>
          {voteCount > 0 && (
            <span className="flex items-center gap-1 text-white/60">
              <Flame className="w-3 h-3 text-orange-400" />
              <span className="font-semibold text-white/80">{voteCount + (hasVoted ? 1 : 0)}</span>
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-1 text-white/60">
              <MessageSquare className="w-3 h-3 text-blue-400" />
              <span className="font-semibold text-white/80">{commentCount}</span>
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 mt-auto">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onFollowToggle}
              disabled={isCurrentUser || isPending}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors border ${
                isFollowing
                  ? "border-cyan-400/40 bg-cyan-400/20 text-cyan-200 hover:bg-cyan-400/25"
                  : "border-cyan-400/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/16"
              } disabled:opacity-45 disabled:cursor-not-allowed`}
              data-testid={`button-follow-discovery-${person.id}`}
            >
              {isCurrentUser ? "You" : isFollowing ? "✓ Following" : "+ Follow"}
            </button>
            <button
              onClick={onTalk}
              disabled={isCurrentUser || (!isOnline && !currentRoomId)}
              className="flex items-center justify-center gap-1 rounded-xl border border-violet-400/25 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-100 disabled:opacity-45 disabled:cursor-not-allowed hover:bg-violet-400/16 transition-colors"
              data-testid={`button-talk-discovery-${person.id}`}
            >
              <MessageCircle className="w-3 h-3" />
              {isCurrentUser ? "You" : currentRoomId ? "Talk" : "Message"}
            </button>
          </div>
          <button
            onClick={onVote}
            disabled={isCurrentUser}
            className={`w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors border ${
              hasVoted
                ? "border-orange-400/50 bg-orange-400/20 text-orange-200"
                : "border-orange-400/20 bg-orange-400/8 text-orange-300/70 hover:bg-orange-400/14 hover:border-orange-400/35"
            } disabled:opacity-45 disabled:cursor-not-allowed`}
            data-testid={`button-vote-discovery-${person.id}`}
          >
            <Flame className={`w-3.5 h-3.5 ${hasVoted ? "fill-orange-400 text-orange-400" : ""}`} />
            {hasVoted ? "Voted!" : "Vote"}
            {(voteCount > 0) && <span className="ml-1 opacity-60">{voteCount + (hasVoted ? 1 : 0)}</span>}
          </button>
          <button
            onClick={onComment}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-blue-400/20 bg-blue-400/8 px-3 py-2 text-xs font-bold text-blue-300/70 hover:bg-blue-400/14 hover:border-blue-400/35 transition-colors"
            data-testid={`button-comment-discovery-${person.id}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Comments
            {commentCount > 0 && <span className="ml-1 opacity-60">{commentCount}</span>}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Lobby() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isAdminUser = user?.role === "admin" || user?.role === "superadmin" || user?.email === "dj55jggg@gmail.com";
  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [languagesExpanded, setLanguagesExpanded] = useState(false);
  const [activeDiscovery, setActiveDiscovery] = useState<DiscoveryFilter>("rooms");
  const [speakerVotes, setSpeakerVotes] = useState<Set<string>>(new Set());
  const [dmUserId, setDmUserId] = useState<string | null>(null);
  const [commentTargetUser, setCommentTargetUser] = useState<{ user: any; name: string } | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<
    Record<string, User[]>
  >({});
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const viewedAnnouncementIdsRef = useRef<Set<string>>(new Set());

  const { data: fetchedRooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
    refetchInterval: 5000,
  });

  const { data: announcements = [] } = useQuery<LobbyAnnouncement[]>({
    queryKey: ["/api/announcements"],
    refetchInterval: 30000,
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

  const realRoomIds = new Set(fetchedRooms.map((r) => r.id));
  const rooms = [
    ...fetchedRooms,
    ...SAMPLE_ROOMS.filter((s) => !realRoomIds.has(s.id)),
  ];

  const allRoomParticipants = (base: Record<string, User[]>) => ({
    ...SAMPLE_ROOM_PARTICIPANTS,
    ...base,
  });

  const roomIds = rooms.map((r) => r.id);
  const { data: voteData, refetch: refetchVotes } = useQuery<{ counts: Record<string, number>; userVotes: Record<string, boolean> }>({
    queryKey: ["/api/rooms/votes/batch", roomIds.join(",")],
    queryFn: async () => {
      if (roomIds.length === 0) return { counts: {}, userVotes: {} };
      const res = await apiRequest("POST", "/api/rooms/votes/batch", { roomIds });
      return res.json();
    },
    enabled: roomIds.length > 0,
    refetchInterval: 30000,
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
    refetchInterval: 10000,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: usersCurrentRooms = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/users/rooms"],
    enabled: !!user,
    refetchInterval: 5000,
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
    refetchInterval: 30000,
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
    }) => {
      const res = await apiRequest("POST", "/api/rooms", {
        ...roomData,
        ownerId: user?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({ title: "Room created! Click 'Join & Talk' to enter." });
    },
    onError: (err: any) => {
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

    socket.on("room:created", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    });

    socket.on("room:deleted", (data: { roomId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms/participants"] });
      if (data?.roomId) {
        setRoomParticipants((prev) => {
          const next = { ...prev };
          delete next[data.roomId];
          return next;
        });
      }
    });

    socket.on("room:full", () => {
      toast({
        title: "Room is full",
        description: "This room has reached its maximum capacity. Try another room.",
        variant: "destructive",
      });
    });

    return () => {
      socket.off("presence:online");
      socket.off("presence:update");
      socket.off("room:participants-update");
      socket.off("room:created");
      socket.off("room:deleted");
      socket.off("room:full");
    };
  }, [socket, toast]);

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
      try {
        const res = await apiRequest("POST", `/api/rooms/${encodeURIComponent(roomId)}/access-link`, {});
        const data = await res.json();
        try {
          const bc = new BroadcastChannel(`connect-room-${user.id}`);
          bc.postMessage({ type: "room-joined", roomId });
          bc.close();
        } catch {}
        window.open(data.path || `/room/${roomId}`, "_blank");
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

  const filteredRooms = rooms
    .filter((room) => {
      const matchesLang = selectedLanguage === "All" || room.language === selectedLanguage;
      const matchesSearch = room.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLang && matchesSearch;
    })
    .sort((a, b) => {
      const aVotes = voteData?.counts?.[a.id] || 0;
      const bVotes = voteData?.counts?.[b.id] || 0;
      return bVotes - aVotes;
    });

  const followingIds = new Set(following.map((follow) => follow.followingId));
  const realUserIds = new Set(allUsers.map((u) => u.id));
  const sampleToMerge = SAMPLE_PEOPLE.filter((u) => !realUserIds.has(u.id));
  const mergedPeople = [...allUsers, ...sampleToMerge];

  const getSpeakerFollowers = (id: string) =>
    followerCounts[id] ?? SAMPLE_FOLLOWER_COUNTS[id] ?? 0;
  const getSpeakerOnline = (p: User) =>
    onlineUsers.has(p.id) || p.status === "online" || (SAMPLE_SPEAKER_META[p.id]?.isOnline ?? false);

  const filteredPeople = mergedPeople
    .filter((person) => {
      const meta = SAMPLE_SPEAKER_META[person.id];
      const searchable = `${getUserName(person)} ${person.email || ""} ${(person as any).bio || ""} ${meta?.bio || ""} ${(meta?.languages || []).join(" ")}`.toLowerCase();
      return searchable.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const aFollowers = getSpeakerFollowers(a.id);
      const bFollowers = getSpeakerFollowers(b.id);
      const aOnline = getSpeakerOnline(a);
      const bOnline = getSpeakerOnline(b);
      const aInRoom = usersCurrentRooms[a.id] ? 1 : 0;
      const bInRoom = usersCurrentRooms[b.id] ? 1 : 0;

      if (activeDiscovery === "top-speakers") {
        return Number(bOnline) - Number(aOnline) || bInRoom - aInRoom || bFollowers - aFollowers || getUserName(a).localeCompare(getUserName(b));
      }

      return bFollowers - aFollowers || Number(bOnline) - Number(aOnline) || getUserName(a).localeCompare(getUserName(b));
    })
    .slice(0, 10);

  const languageCounts: Record<string, number> = {};
  rooms.forEach((r) => {
    languageCounts[r.language] = (languageCounts[r.language] || 0) + 1;
  });

  const languageTags = LANGUAGES.filter(
    (lang) => lang === "All" || (languageCounts[lang] || 0) > 0
  );

  const visibleLanguages = languagesExpanded ? languageTags : languageTags.slice(0, 8);

  return (
    <div className="flex flex-col h-full">
      <header
        className="sticky top-0 z-50 bg-background/90 backdrop-blur-md"
        style={{
          borderBottom: "1px solid rgba(0,220,255,0.12)",
          boxShadow: "0 1px 0 rgba(0,220,255,0.08), 0 4px 24px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(0,200,255,0.18) 0%, rgba(110,60,255,0.18) 100%)",
                border: "1px solid rgba(0,210,255,0.28)",
                boxShadow: "0 0 14px rgba(0,210,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <Mic className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-[15px] font-extrabold leading-tight tracking-tight">
                Connect<span style={{ color: "#22d3ee" }}>2</span>Talk
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight tracking-widest uppercase opacity-70">
                Language Practice Community
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {user ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/teachers")}
                  className="mr-1 text-xs border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40"
                  data-testid="button-book-teacher-nav"
                >
                  <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-violet-400" />
                  <span className="hidden sm:inline text-violet-300/80">Book Teacher</span>
                </Button>
                {isAdminUser && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/admin")}
                    className="mr-1 text-xs border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40"
                    data-testid="button-admin-panel"
                  >
                    {user.role === "superadmin" || user.email === "dj55jggg@gmail.com" ? (
                      <Crown className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                    )}
                    <span className="hidden sm:inline text-amber-300/80">Admin</span>
                  </Button>
                )}
                <SocialPanel onlineUsers={onlineUsers} onOpenDm={(userId) => setDmUserId(userId)} />
                <MessagesDropdown onOpenDm={(userId) => setDmUserId(userId)} />
                <NotificationsDropdown open={notificationsOpen} onOpenChange={setNotificationsOpen} />
                <ThemePicker open={themePickerOpen} onOpenChange={setThemePickerOpen} />
                <div className="w-px h-5 mx-1.5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
                <ProfileDropdown
                  onOpenTheme={() => setThemePickerOpen(true)}
                  onOpenNotifications={() => setNotificationsOpen(true)}
                />
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/teachers")}
                  className="text-xs border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40"
                  data-testid="button-book-teacher-nav-guest"
                >
                  <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-violet-400" />
                  <span className="hidden sm:inline text-violet-300/80">Book Teacher</span>
                </Button>
                <ThemePicker />
                <Button
                  asChild
                  data-testid="button-sign-in"
                  size="sm"
                  className="ml-1 font-semibold"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,200,255,0.9) 0%, rgba(100,60,240,0.9) 100%)",
                    border: "1px solid rgba(0,210,255,0.3)",
                    boxShadow: "0 0 18px rgba(0,200,255,0.2)",
                  }}
                >
                  <a href="/api/login">
                    <LogIn className="w-4 h-4 mr-1.5" />
                    Sign In
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto app-scrollbar">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 pb-8 space-y-5 animate-fade-in">
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
                        className="w-full rounded-lg object-cover max-h-52"
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
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
              <Input
                placeholder={activeDiscovery === "rooms" ? "Search rooms and languages..." : "Search speakers and famous users..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-14 h-10 transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(0,210,255,0.45)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,210,255,0.08), 0 0 16px rgba(0,210,255,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                data-testid="input-search-rooms"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 text-[10px] text-muted-foreground/40 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-mono pointer-events-none">
                ⌘K
              </kbd>
            </div>
            {user && (
              <div className="w-full md:w-auto flex-shrink-0 [&_button]:w-full md:[&_button]:w-auto [&_button]:whitespace-nowrap" data-testid="container-create-room">
                <CreateRoomDialog
                  onCreateRoom={(data) => createRoomMutation.mutate(data)}
                  isPending={createRoomMutation.isPending}
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center" data-testid="filters-discovery-search">
            {([
              { id: "rooms", label: "Rooms", icon: Mic },
              { id: "top-speakers", label: "Top Speakers", icon: Radio },
              { id: "famous-users", label: "Famous Users", icon: Heart },
            ] as const).map((filter) => {
              const Icon = filter.icon;
              const isActive = activeDiscovery === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveDiscovery(filter.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200"
                  style={
                    isActive
                      ? {
                          background: "linear-gradient(135deg, rgba(0,200,255,0.85) 0%, rgba(100,50,240,0.85) 100%)",
                          border: "1px solid rgba(0,210,255,0.4)",
                          color: "#fff",
                          boxShadow: "0 0 14px rgba(0,200,255,0.22), 0 2px 8px rgba(0,0,0,0.25)",
                        }
                      : {
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.62)",
                        }
                  }
                  data-testid={`filter-discovery-${filter.id}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {filter.label}
                </button>
              );
            })}
          </div>

          {activeDiscovery === "rooms" && (
          <div className="flex gap-2 flex-wrap items-center">
            {visibleLanguages.map((lang) => {
              const count = lang === "All" ? rooms.length : languageCounts[lang] || 0;
              const isActive = selectedLanguage === lang;
              return (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200"
                  style={
                    isActive
                      ? {
                          background: "linear-gradient(135deg, rgba(0,200,255,0.85) 0%, rgba(100,50,240,0.85) 100%)",
                          border: "1px solid rgba(0,210,255,0.4)",
                          color: "#fff",
                          boxShadow: "0 0 14px rgba(0,200,255,0.22), 0 2px 8px rgba(0,0,0,0.25)",
                        }
                      : {
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.55)",
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                      e.currentTarget.style.border = "1px solid rgba(255,255,255,0.18)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.85)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                      e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                    }
                  }}
                  data-testid={`tab-language-${lang.toLowerCase()}`}
                >
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
                onClick={() => setLanguagesExpanded(!languagesExpanded)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.45)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.75)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.45)";
                }}
                data-testid="button-toggle-languages"
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
            <section className="space-y-3" data-testid="section-people-discovery">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-white" data-testid="text-people-discovery-title">
                    {activeDiscovery === "top-speakers" ? "Top speakers to track" : "Famous users to follow"}
                  </h2>
                  <p className="text-sm text-white/45">
                    Follow people to track them, then talk when they are online or inside a room.
                  </p>
                </div>
                <span className="text-xs text-white/45 flex items-center gap-1" data-testid="text-people-discovery-count">
                  {filteredPeople.length} people
                </span>
              </div>
              {filteredPeople.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center text-sm text-white/50" data-testid="text-no-discovery-users">
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
                      <PeopleDiscoveryCard
                        key={person.id}
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
                    );
                  })}
                </div>
              )}
            </section>
          ) : roomsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-3 p-5 rounded-md border">
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
          ) : filteredRooms.length === 0 ? (
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
                <CreateRoomDialog
                  onCreateRoom={(data) => createRoomMutation.mutate(data)}
                  isPending={createRoomMutation.isPending}
                />
              ) : (
                <Button asChild data-testid="button-sign-in-empty">
                  <a href="/api/login">Sign in to create a room</a>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRooms.map((room) => {
                const mergedParticipants = allRoomParticipants(roomParticipants);
                const isSample = room.id.startsWith("sample-");
                return (
                  <RoomCard
                    key={room.id}
                    room={room}
                    participants={mergedParticipants[room.id] || []}
                    onJoin={handleJoinRoom}
                    onOpenDm={(userId) => setDmUserId(userId)}
                    isOwner={room.ownerId === user?.id}
                    isLoggedIn={!!user}
                    voteCount={isSample ? SAMPLE_VOTE_COUNTS[room.id] ?? 0 : (voteData?.counts?.[room.id] || 0)}
                    hasVoted={voteData?.userVotes?.[room.id] || false}
                    onVote={isSample ? undefined : (user ? () => voteMutation.mutate({ roomId: room.id, hasVoted: voteData?.userVotes?.[room.id] || false }) : undefined)}
                    followerCountsOverride={isSample ? SAMPLE_FOLLOWER_COUNTS : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {user && (
        <DmDialog
          otherUserId={dmUserId}
          onClose={() => setDmUserId(null)}
        />
      )}

      {commentTargetUser && (
        <CommentThreadDialog
          targetUser={commentTargetUser.user}
          targetUserName={commentTargetUser.name}
          onClose={() => setCommentTargetUser(null)}
        />
      )}
    </div>
  );
}
