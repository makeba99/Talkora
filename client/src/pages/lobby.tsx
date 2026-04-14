import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Mic, ChevronUp, ChevronDown, LogIn, Crown, ShieldCheck, GraduationCap } from "lucide-react";
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

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
              <CreateRoomDialog
                onCreateRoom={(data) => createRoomMutation.mutate(data)}
                isPending={createRoomMutation.isPending}
              />
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
