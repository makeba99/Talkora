import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Mic, ChevronUp, ChevronDown, LogIn, Crown, ShieldCheck, GraduationCap, Users, Footprints, Plus, Globe, BookOpen, Star, Heart, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RoomCard } from "@/components/room-card";
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
import type { Room, User } from "@shared/schema";
import { Button } from "@/components/ui/button";

type FeaturedParticipant = {
  name: string;
  color: string;
  avatarUrl: string;
  followers: number;
};

type FeaturedRoom = {
  id: string;
  title: string;
  language: string;
  level: string;
  participants: FeaturedParticipant[];
  maxUsers: number;
  theme: "cosmic" | "plasma" | "hologram" | "sunset" | "aurora" | "ocean";
};

type FeaturedGroup = {
  id: string;
  title: string;
  subtitle: string;
  icon: "mic" | "book" | "star";
  rooms: FeaturedRoom[];
};

const FEATURED_LANGUAGE_CODES: Record<string, string> = {
  English: "gb",
  Spanish: "es",
  French: "fr",
  German: "de",
  Japanese: "jp",
  Korean: "kr",
  Arabic: "sa",
  Armenian: "am",
  Portuguese: "br",
  Chinese: "cn",
};

const FEATURED_THEME_STYLES: Record<FeaturedRoom["theme"], { border: string; glow: string; badge: string }> = {
  cosmic: {
    border: "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(168,85,247,0.85), rgba(239,68,68,0.9))",
    glow: "0 0 22px rgba(99,102,241,0.25)",
    badge: "rgba(99,102,241,0.14)",
  },
  plasma: {
    border: "linear-gradient(135deg, rgba(236,72,153,0.95), rgba(124,58,237,0.9), rgba(79,70,229,0.9))",
    glow: "0 0 22px rgba(236,72,153,0.22)",
    badge: "rgba(236,72,153,0.13)",
  },
  hologram: {
    border: "linear-gradient(135deg, rgba(6,182,212,0.95), rgba(45,212,191,0.85), rgba(52,211,153,0.9))",
    glow: "0 0 22px rgba(6,182,212,0.24)",
    badge: "rgba(6,182,212,0.13)",
  },
  sunset: {
    border: "linear-gradient(135deg, rgba(251,146,60,0.95), rgba(244,63,94,0.9), rgba(168,85,247,0.78))",
    glow: "0 0 22px rgba(251,146,60,0.2)",
    badge: "rgba(251,146,60,0.13)",
  },
  aurora: {
    border: "linear-gradient(135deg, rgba(45,212,191,0.95), rgba(74,222,128,0.82), rgba(34,211,238,0.84))",
    glow: "0 0 22px rgba(45,212,191,0.22)",
    badge: "rgba(45,212,191,0.13)",
  },
  ocean: {
    border: "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(6,182,212,0.86), rgba(14,165,233,0.88))",
    glow: "0 0 22px rgba(59,130,246,0.22)",
    badge: "rgba(59,130,246,0.13)",
  },
};

const FEATURED_ROOM_GROUPS: FeaturedGroup[] = [
  {
    id: "daily-practice",
    title: "Daily Practice Rooms",
    subtitle: "Conversation circles that are always visible when you return home.",
    icon: "mic",
    rooms: [
      { id: "daily-english", title: "Morning English Warmup", language: "English", level: "Beginner", maxUsers: 6, theme: "hologram", participants: [{ name: "Maya", color: "#22d3ee", avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg", followers: 128 }, { name: "Leo", color: "#a78bfa", avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg", followers: 91 }, { name: "Nora", color: "#34d399", avatarUrl: "https://randomuser.me/api/portraits/women/68.jpg", followers: 214 }] },
      { id: "daily-spanish", title: "Spanish Travel Phrases", language: "Spanish", level: "Intermediate", maxUsers: 8, theme: "sunset", participants: [{ name: "Ana", color: "#fb923c", avatarUrl: "https://randomuser.me/api/portraits/women/12.jpg", followers: 174 }, { name: "Luis", color: "#f472b6", avatarUrl: "https://randomuser.me/api/portraits/men/65.jpg", followers: 82 }] },
      { id: "daily-french", title: "French Cafe Chat", language: "French", level: "Advanced", maxUsers: 5, theme: "plasma", participants: [{ name: "Camille", color: "#e879f9", avatarUrl: "https://randomuser.me/api/portraits/women/27.jpg", followers: 241 }, { name: "Theo", color: "#818cf8", avatarUrl: "https://randomuser.me/api/portraits/men/22.jpg", followers: 119 }, { name: "Ari", color: "#f0abfc", avatarUrl: "https://randomuser.me/api/portraits/women/51.jpg", followers: 98 }, { name: "Sam", color: "#38bdf8", avatarUrl: "https://randomuser.me/api/portraits/men/41.jpg", followers: 157 }] },
    ],
  },
  {
    id: "culture-topics",
    title: "Culture & Topic Clubs",
    subtitle: "Low-pressure rooms built around music, films, food, and daily life.",
    icon: "star",
    rooms: [
      { id: "culture-japanese", title: "Anime & Everyday Japanese", language: "Japanese", level: "Beginner", maxUsers: 7, theme: "cosmic", participants: [{ name: "Ren", color: "#60a5fa", avatarUrl: "https://randomuser.me/api/portraits/men/75.jpg", followers: 302 }, { name: "Yuki", color: "#c084fc", avatarUrl: "https://randomuser.me/api/portraits/women/35.jpg", followers: 188 }] },
      { id: "culture-korean", title: "Korean Drama Reactions", language: "Korean", level: "Intermediate", maxUsers: 6, theme: "plasma", participants: [{ name: "Min", color: "#f472b6", avatarUrl: "https://randomuser.me/api/portraits/women/72.jpg", followers: 267 }, { name: "Jae", color: "#a78bfa", avatarUrl: "https://randomuser.me/api/portraits/men/81.jpg", followers: 143 }, { name: "Ivy", color: "#22d3ee", avatarUrl: "https://randomuser.me/api/portraits/women/88.jpg", followers: 225 }] },
      { id: "culture-armenian", title: "Armenian Heritage Talk", language: "Armenian", level: "Native", maxUsers: 6, theme: "aurora", participants: [{ name: "Aram", color: "#2dd4bf", avatarUrl: "https://randomuser.me/api/portraits/men/48.jpg", followers: 176 }, { name: "Lena", color: "#86efac", avatarUrl: "https://randomuser.me/api/portraits/women/63.jpg", followers: 199 }] },
    ],
  },
  {
    id: "goal-rooms",
    title: "Goal-Based Practice",
    subtitle: "Focused cards for interviews, exams, pronunciation, and confidence.",
    icon: "book",
    rooms: [
      { id: "goal-business", title: "Business English Roleplay", language: "English", level: "Advanced", maxUsers: 5, theme: "ocean", participants: [{ name: "Omar", color: "#38bdf8", avatarUrl: "https://randomuser.me/api/portraits/men/15.jpg", followers: 331 }, { name: "Priya", color: "#60a5fa", avatarUrl: "https://randomuser.me/api/portraits/women/5.jpg", followers: 286 }, { name: "Chen", color: "#67e8f9", avatarUrl: "https://randomuser.me/api/portraits/men/24.jpg", followers: 204 }] },
      { id: "goal-arabic", title: "Arabic Pronunciation Lab", language: "Arabic", level: "Beginner", maxUsers: 4, theme: "sunset", participants: [{ name: "Noor", color: "#fb923c", avatarUrl: "https://randomuser.me/api/portraits/women/76.jpg", followers: 162 }] },
      { id: "goal-german", title: "German Exam Speaking", language: "German", level: "Intermediate", maxUsers: 6, theme: "cosmic", participants: [{ name: "Klara", color: "#818cf8", avatarUrl: "https://randomuser.me/api/portraits/women/39.jpg", followers: 248 }, { name: "Ben", color: "#f87171", avatarUrl: "https://randomuser.me/api/portraits/men/53.jpg", followers: 137 }] },
    ],
  },
];

function FeaturedLanguageFlag({ language }: { language: string }) {
  const code = FEATURED_LANGUAGE_CODES[language];
  if (!code) return <Globe className="w-3.5 h-3.5 text-white/55" />;
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

function FeaturedGroupIcon({ icon }: { icon: FeaturedGroup["icon"] }) {
  if (icon === "book") return <BookOpen className="w-4 h-4 text-cyan-300" />;
  if (icon === "star") return <Star className="w-4 h-4 text-violet-300" />;
  return <Mic className="w-4 h-4 text-cyan-300" />;
}

function FeaturedRoomCard({ room, isLoggedIn, onStepIn }: { room: FeaturedRoom; isLoggedIn: boolean; onStepIn: () => void }) {
  const theme = FEATURED_THEME_STYLES[room.theme];
  const openSlots = Math.max(room.maxUsers - room.participants.length, 0);

  return (
    <div
      className="rounded-[18px] p-[2px]"
      style={{ background: theme.border, boxShadow: theme.glow }}
      data-testid={`card-featured-room-${room.id}`}
    >
      <div
        className="h-[290px] rounded-2xl p-3.5 flex flex-col justify-between overflow-hidden relative"
        style={{
          background: "linear-gradient(145deg, rgba(5,8,24,0.9), rgba(10,13,38,0.78))",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-50" style={{ background: "radial-gradient(circle at 18% 0%, rgba(34,211,238,0.16), transparent 38%), radial-gradient(circle at 90% 18%, rgba(167,139,250,0.14), transparent 34%)" }} />
        <div className="relative space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <h3 className="text-sm font-extrabold text-white truncate" data-testid={`text-featured-title-${room.id}`}>
                  {room.title}
                </h3>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                <FeaturedLanguageFlag language={room.language} />
                <span className="text-white/70 font-medium" data-testid={`text-featured-language-${room.id}`}>{room.language}</span>
                <span className="text-white/25">•</span>
                <span className="text-cyan-300 font-semibold" data-testid={`text-featured-level-${room.id}`}>{room.level}</span>
              </div>
            </div>
            <div
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-white/75 flex-shrink-0"
              style={{ background: theme.badge, border: "1px solid rgba(255,255,255,0.08)" }}
              data-testid={`text-featured-count-${room.id}`}
            >
              <Users className="w-3 h-3" />
              {room.participants.length}/{room.maxUsers}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-x-2 gap-y-1.5">
            {Array.from({ length: Math.min(room.maxUsers, 8) }).map((_, index) => {
              const participant = room.participants[index];
              return (
                <div key={index} className="flex flex-col items-center">
                  <div
                    className="w-12 h-12 rounded-full p-[3px]"
                    style={{ background: participant ? `linear-gradient(135deg, ${participant.color}, rgba(167,139,250,0.92))` : theme.border }}
                    data-testid={`avatar-featured-${room.id}-${index}`}
                  >
                    {participant ? (
                      <img
                        src={participant.avatarUrl}
                        alt={participant.name}
                        className="w-full h-full rounded-full object-cover border-2 border-[#0a1228]"
                        data-testid={`img-featured-profile-${room.id}-${index}`}
                      />
                    ) : (
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      >
                        <Users className="w-5 h-5 text-white/35" />
                      </div>
                    )}
                  </div>
                  {participant && (
                    <div className="mt-0.5 flex items-center gap-0.5" data-testid={`text-featured-followers-${room.id}-${index}`}>
                      <Heart className="w-2.5 h-2.5 text-red-400 fill-red-400" />
                      <span className="text-[9px] text-white/60 font-medium">{participant.followers}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {openSlots > 0 && (
            <div className="flex items-center justify-center gap-1 text-[11px] text-white/50 font-medium" data-testid={`text-featured-open-spots-${room.id}`}>
              <Plus className="w-3 h-3" />
              {openSlots} Join Spot{openSlots === 1 ? "" : "s"}
            </div>
          )}
        </div>

        <div className="relative flex items-center justify-between gap-2 pt-3">
          <span className="text-[11px] text-white/40">Practice room</span>
          <button
            onClick={onStepIn}
            className="step-in-btn flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white active:scale-95"
            style={{ background: theme.border }}
            data-testid={`button-featured-step-in-${room.id}`}
          >
            <Footprints className="w-3.5 h-3.5" />
            {isLoggedIn ? "Step In" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
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
  const [dmUserId, setDmUserId] = useState<string | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<
    Record<string, User[]>
  >({});
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [closedFeaturedGroups, setClosedFeaturedGroups] = useState<Set<string>>(new Set());

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
    refetchInterval: 5000,
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
    (roomId: string) => {
      if (!user) {
        window.location.href = "/api/login";
        return;
      }
      window.open(`/room/${roomId}`, "_blank");
    },
    [user]
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
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
              <Input
                placeholder="Search rooms, languages, users..."
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

          {roomsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  participants={roomParticipants[room.id] || []}
                  onJoin={handleJoinRoom}
                  onOpenDm={(userId) => setDmUserId(userId)}
                  isOwner={room.ownerId === user?.id}
                  isLoggedIn={!!user}
                  voteCount={voteData?.counts?.[room.id] || 0}
                  hasVoted={voteData?.userVotes?.[room.id] || false}
                  onVote={user ? () => voteMutation.mutate({ roomId: room.id, hasVoted: voteData?.userVotes?.[room.id] || false }) : undefined}
                />
              ))}
            </div>
          )}

          <section className="space-y-5 pt-2" data-testid="section-featured-room-groups">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300/60 font-bold">Explore anytime</p>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight" data-testid="text-featured-room-groups-title">
                  Featured room groups
                </h2>
              </div>
              <p className="text-sm text-white/45 max-w-md">
                Persistent practice cards stay on the home page, so learners always have topics to browse while live rooms load or change.
              </p>
            </div>

            {FEATURED_ROOM_GROUPS.map((group) => {
              const isClosed = closedFeaturedGroups.has(group.id);
              return (
              <div key={group.id} className="space-y-3" data-testid={`group-featured-rooms-${group.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, rgba(0,200,255,0.14), rgba(110,60,255,0.16))",
                      border: "1px solid rgba(0,210,255,0.22)",
                      boxShadow: "0 0 14px rgba(0,210,255,0.12)",
                    }}
                  >
                    <FeaturedGroupIcon icon={group.icon} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-white" data-testid={`text-featured-group-title-${group.id}`}>
                      {group.title}
                    </h3>
                    <p className="text-xs text-white/45" data-testid={`text-featured-group-subtitle-${group.id}`}>
                      {group.subtitle}
                    </p>
                  </div>
                  </div>
                  <button
                    onClick={() => {
                      setClosedFeaturedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      });
                    }}
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/55 hover:text-white hover:border-cyan-400/35 transition-colors flex-shrink-0"
                    data-testid={`button-toggle-featured-group-${group.id}`}
                  >
                    {isClosed ? <ChevronDown className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    {isClosed ? "Open" : "Close"}
                  </button>
                </div>
                {!isClosed && (
                <div className="grid grid-cols-1 min-[560px]:grid-cols-3 gap-4">
                  {group.rooms.map((room) => (
                    <FeaturedRoomCard
                      key={room.id}
                      room={room}
                      isLoggedIn={!!user}
                      onStepIn={() => {
                        if (!user) {
                          window.location.href = "/api/login";
                          return;
                        }
                        toast({
                          title: "Pick or create a live room",
                          description: "These featured cards show suggested topics. Create a matching room or step into an active live room above.",
                        });
                      }}
                    />
                  ))}
                </div>
                )}
              </div>
              );
            })}
          </section>
        </div>
      </div>

      {user && (
        <DmDialog
          otherUserId={dmUserId}
          onClose={() => setDmUserId(null)}
        />
      )}
    </div>
  );
}
