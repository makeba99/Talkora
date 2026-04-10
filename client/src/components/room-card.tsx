import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Settings, Lock, Globe, Ban, LogIn, UserPlus, UserCheck, MessageSquare, Heart, ChevronUp, Instagram, Linkedin, Facebook, Video, X, Search, Youtube, Loader2, Link } from "lucide-react";
import { getAvatarRingClass } from "@/components/profile-dropdown";
import { ProfileDecoration, getRoomThemeBorderClass } from "@/components/profile-decorations";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LANGUAGES, LEVELS } from "@shared/schema";
import type { Room, User, Follow } from "@shared/schema";

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
}

const ROOM_THEMES = [
  { id: "default", label: "Default", from: "from-cyan-500", to: "to-purple-500", preview: "from-cyan-500 to-purple-500" },
  { id: "neon", label: "Neon", from: "from-cyan-400", to: "to-purple-500", preview: "from-cyan-400 to-purple-500" },
  { id: "galaxy", label: "Galaxy", from: "from-indigo-500", to: "to-purple-700", preview: "from-indigo-500 to-purple-700" },
  { id: "sunset", label: "Sunset", from: "from-orange-400", to: "to-red-500", preview: "from-orange-400 to-red-500" },
  { id: "forest", label: "Forest", from: "from-green-400", to: "to-emerald-600", preview: "from-green-400 to-emerald-600" },
  { id: "cyberpunk", label: "Cyberpunk", from: "from-yellow-400", to: "to-cyan-400", preview: "from-yellow-400 to-cyan-400" },
  { id: "ocean", label: "Ocean", from: "from-blue-400", to: "to-cyan-600", preview: "from-blue-400 to-cyan-600" },
  { id: "cherry", label: "Cherry", from: "from-pink-400", to: "to-rose-500", preview: "from-pink-400 to-rose-500" },
  { id: "gold", label: "Gold", from: "from-yellow-300", to: "to-amber-500", preview: "from-yellow-300 to-amber-500" },
  { id: "violet", label: "Violet", from: "from-violet-400", to: "to-fuchsia-600", preview: "from-violet-400 to-fuchsia-600" },
  { id: "aurora", label: "Aurora", from: "from-teal-400", to: "to-green-400", preview: "from-teal-400 to-green-400" },
  { id: "matrix", label: "Matrix", from: "from-green-400", to: "to-green-700", preview: "from-green-400 to-green-700" },
  { id: "storm", label: "Storm", from: "from-blue-500", to: "to-slate-600", preview: "from-blue-500 to-slate-600" },
  { id: "volcanic", label: "Volcanic", from: "from-red-500", to: "to-orange-400", preview: "from-red-500 to-orange-400" },
];

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

function ParticipantPopover({ participant, currentUserId, onOpenDm }: { participant: User; currentUserId?: string; onOpenDm?: (userId: string) => void }) {
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
        <AvatarImage src={participant.profileImageUrl || undefined} />
        <AvatarFallback className="text-xl font-bold">
          {getUserInitials(participant)}
        </AvatarFallback>
      </Avatar>
      <div className="text-center">
        <p className="font-bold text-sm" data-testid={`text-card-profile-name-${participant.id}`}>{getUserDisplayName(participant)}</p>
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
              className="text-muted-foreground hover:text-blue-400 transition-colors"
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
              className="text-muted-foreground hover:text-blue-500 transition-colors"
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

function CardHologramVideo({ src }: { src: string }) {
  const ytId = extractYoutubeId(src) || (src.includes("youtube.com/embed/") ? src.split("/embed/")[1]?.split("?")[0] : null);
  const overlay = (
    <div
      className="absolute inset-0 z-[1] pointer-events-none"
      style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.42) 60%, rgba(0,0,0,0.65) 100%)" }}
    />
  );
  if (ytId) {
    return (
      <>
        <iframe
          src={buildYoutubeEmbed(ytId)}
          className="absolute inset-0 w-full h-full z-0"
          allow="autoplay; encrypted-media"
          style={{ border: "none", pointerEvents: "none" }}
        />
        {overlay}
      </>
    );
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
        style={{ filter: "brightness(1.05) saturate(1.15)" }}
      />
      {overlay}
    </>
  );
}

export function RoomCard({ room, participants, onJoin, onOpenDm, isOwner, isLoggedIn = true, voteCount = 0, hasVoted = false, onVote }: RoomCardProps) {
  const { user } = useAuth();
  const isFull = participants.length >= room.maxUsers;
  const slots = Array.from({ length: Math.min(room.maxUsers, 12) });
  const avatarSize = getAvatarSizeClass(room.maxUsers);
  const fallbackText = getFallbackTextClass(room.maxUsers);
  const participantIds = participants.map((p) => p.id);

  const { data: followerCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/follows/counts", ...participantIds],
    queryFn: async () => {
      if (participantIds.length === 0) return {};
      const res = await apiRequest("POST", "/api/follows/counts", { userIds: participantIds });
      return res.json();
    },
    enabled: participantIds.length > 0,
    staleTime: 30000,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(room.title);
  const [editLanguage, setEditLanguage] = useState(room.language);
  const [editLevel, setEditLevel] = useState(room.level);
  const [editMaxUsers, setEditMaxUsers] = useState(room.maxUsers);
  const [editTheme, setEditTheme] = useState((room as any).roomTheme || "default");
  const [hologramPreview, setHologramPreview] = useState<string | null>(null);
  const [hologramFile, setHologramFile] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoTab, setVideoTab] = useState<"upload" | "youtube">("upload");
  const [ytLinkInput, setYtLinkInput] = useState("");
  const [ytSearchQuery, setYtSearchQuery] = useState("");
  const [ytSearchResults, setYtSearchResults] = useState<any[]>([]);
  const [ytSearching, setYtSearching] = useState(false);
  const [selectedYtId, setSelectedYtId] = useState<string | null>(null);
  const ytSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const editMutation = useMutation({
    mutationFn: async (data: { title: string; language: string; level: string; maxUsers: number; roomTheme: string }) => {
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

    if (videoTab === "youtube" && selectedYtId) {
      await apiRequest("PATCH", `/api/rooms/${room.id}`, { hologramVideoUrl: buildYoutubeEmbed(selectedYtId) });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    } else if (videoTab === "youtube" && ytLinkInput.trim()) {
      const ytId = extractYoutubeId(ytLinkInput.trim());
      if (ytId) {
        await apiRequest("PATCH", `/api/rooms/${room.id}`, { hologramVideoUrl: buildYoutubeEmbed(ytId) });
        queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      }
    } else if (hologramFile) {
      setUploadingVideo(true);
      try {
        const formData = new FormData();
        formData.append("video", hologramFile);
        const res = await fetch("/api/upload/hologram", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          await apiRequest("PATCH", `/api/rooms/${room.id}`, { hologramVideoUrl: data.url });
          queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
        }
      } finally {
        setUploadingVideo(false);
      }
    }

    editMutation.mutate({ title: editTitle.trim(), language: editLanguage, level: editLevel, maxUsers: editMaxUsers, roomTheme: editTheme });
  };

  const handleYtSearch = async (query: string) => {
    if (!query.trim()) { setYtSearchResults([]); return; }
    setYtSearching(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (res.ok) setYtSearchResults(await res.json());
    } finally {
      setYtSearching(false);
    }
  };

  const handleYtSearchInput = (val: string) => {
    setYtSearchQuery(val);
    if (ytSearchTimeout.current) clearTimeout(ytSearchTimeout.current);
    ytSearchTimeout.current = setTimeout(() => handleYtSearch(val), 400);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHologramFile(file);
    const url = URL.createObjectURL(file);
    setHologramPreview(url);
  };

  const clearHologram = async () => {
    setHologramFile(null);
    setHologramPreview(null);
    setSelectedYtId(null);
    setYtLinkInput("");
    if ((room as any).hologramVideoUrl) {
      await apiRequest("PATCH", `/api/rooms/${room.id}`, { hologramVideoUrl: null });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    }
  };

  const languages = LANGUAGES.filter((l) => l !== "All");

  const levelColor: Record<string, string> = {
    Beginner: "text-chart-3",
    Intermediate: "text-chart-4",
    Advanced: "text-chart-1",
    Native: "text-secondary",
  };

  const themeBorderClass = getRoomThemeBorderClass((room as any).roomTheme);
  const hologramVideoUrl = (room as any).hologramVideoUrl as string | null | undefined;

  return (
    <div
      className={`p-[2px] rounded-md bg-gradient-to-br ${themeBorderClass}`}
      style={{ width: "100%", height: 260 }}
      data-testid={`card-room-${room.id}`}
    >
      <Card className="p-4 rounded-md border-0 flex flex-col relative overflow-hidden h-full">
        {hologramVideoUrl && <CardHologramVideo src={hologramVideoUrl} />}
        <div className="relative z-[2] flex flex-col h-full gap-2">

          {/* Header: title + settings */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base truncate" data-testid={`text-room-title-${room.id}`}>
                  {room.title}
                </h3>
                {!room.isPublic && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  <Globe className="w-3 h-3 mr-1" />
                  {room.language}
                </Badge>
                <span className={`text-xs font-medium ${levelColor[room.level] || "text-muted-foreground"}`}>
                  {room.level}
                </span>
              </div>
            </div>
            {isOwner && (
              <Button
                size="icon"
                variant="ghost"
                className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTitle(room.title);
                  setEditLanguage(room.language);
                  setEditLevel(room.level);
                  setEditMaxUsers(room.maxUsers);
                  setEditTheme((room as any).roomTheme || "default");
                  setHologramPreview(null);
                  setHologramFile(null);
                  setVideoTab("upload");
                  setYtLinkInput("");
                  setYtSearchQuery("");
                  setYtSearchResults([]);
                  setSelectedYtId(null);
                  setEditOpen(true);
                }}
                data-testid={`button-room-settings-${room.id}`}
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
            {!isOwner && isLoggedIn && (
              <Button
                size="icon"
                variant="ghost"
                className="flex-shrink-0 text-white hover:bg-white/10"
                disabled
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Participant avatars — fills remaining height, clips overflow */}
          <div className="flex items-start gap-1.5 flex-wrap flex-1 overflow-hidden content-start">
            {slots.map((_, i) => {
              const participant = participants[i];
              if (!participant) {
                return (
                  <div
                    key={i}
                    className={`${avatarSize} rounded-full border-2 border-dashed border-muted-foreground/20 flex-shrink-0`}
                  />
                );
              }

              const count = followerCounts[participant.id] || 0;
              const ringClass = getAvatarRingClass(participant.avatarRing);
              const hasRing = !!ringClass;

              const avatarContent = (
                <div className={`rounded-full p-[3px] ${hasRing ? ringClass : "bg-gradient-to-br from-cyan-400 to-purple-500"}`}>
                  <Avatar className={`${avatarSize} border-2 border-background`}>
                    <AvatarImage src={participant.profileImageUrl || undefined} alt={getUserDisplayName(participant)} />
                    <AvatarFallback className={`${fallbackText} bg-primary/10 text-primary`}>
                      {getUserInitials(participant)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              );

              const wrappedAvatar = (
                <ProfileDecoration decorationId={(participant as any).profileDecoration} size={40}>
                  {avatarContent}
                </ProfileDecoration>
              );

              if (!isLoggedIn) {
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    {wrappedAvatar}
                    <div className="flex items-center gap-0.5 text-muted-foreground" data-testid={`text-follower-count-card-${participant.id}`}>
                      <Heart className="w-3 h-3 text-pink-500" />
                      <span className="text-[10px]">{count}</span>
                    </div>
                  </div>
                );
              }

              return (
                <Popover key={i}>
                  <PopoverTrigger asChild>
                    <button className="flex flex-col items-center gap-0.5 cursor-pointer flex-shrink-0" data-testid={`button-card-participant-${participant.id}`}>
                      {wrappedAvatar}
                      <div className="flex items-center gap-0.5 text-muted-foreground" data-testid={`text-follower-count-card-${participant.id}`}>
                        <Heart className="w-3 h-3 text-pink-500" />
                        <span className="text-[10px]">{count}</span>
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-2" align="center">
                    <ParticipantPopover
                      participant={participant}
                      currentUserId={user?.id}
                      onOpenDm={onOpenDm}
                    />
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>

          {/* Footer: count + vote + join */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span className="text-xs">{participants.length}/{room.maxUsers}</span>
              </div>
              {isLoggedIn && onVote && (
                <button
                  onClick={(e) => { e.stopPropagation(); onVote(); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border ${hasVoted ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
                  data-testid={`button-vote-room-${room.id}`}
                  title={hasVoted ? "Remove vote" : "Vote for this room"}
                >
                  <ChevronUp className="w-3 h-3" />
                  {voteCount}
                </button>
              )}
              {!isLoggedIn && voteCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ChevronUp className="w-3 h-3" />{voteCount}
                </span>
              )}
            </div>
            {isFull ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Ban className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">This group is full</span>
              </div>
            ) : !isLoggedIn ? (
              <Button
                size="sm"
                variant="outline"
                asChild
                data-testid={`button-signin-room-${room.id}`}
              >
                <a href="/api/login">
                  <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  Sign in to Join
                </a>
              </Button>
            ) : (
              <Button
                size="sm"
                data-testid={`button-join-room-${room.id}`}
                onClick={() => onJoin(room.id)}
              >
                Join & Talk
              </Button>
            )}
          </div>

        </div>
      </Card>

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
                    onClick={() => setEditTheme(theme.id)}
                    className={`relative h-8 rounded-md bg-gradient-to-br ${theme.preview} transition-all ${editTheme === theme.id ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-105" : "opacity-70 hover:opacity-100"}`}
                    title={theme.label}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected: {ROOM_THEMES.find((t) => t.id === editTheme)?.label || "Default"}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Card Background Video</Label>
                {hologramVideoUrl && (
                  <button type="button" onClick={clearHologram} className="text-xs text-destructive hover:underline">Remove</button>
                )}
              </div>

              {/* Tab switcher */}
              <div className="flex rounded-md border border-border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setVideoTab("upload")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${videoTab === "upload" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  <Video className="w-3 h-3" /> Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setVideoTab("youtube")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${videoTab === "youtube" ? "bg-red-600 text-white" : "hover:bg-muted"}`}
                >
                  <Youtube className="w-3 h-3" /> YouTube
                </button>
              </div>

              {videoTab === "upload" && (
                <div className="flex items-center gap-3">
                  {hologramPreview && (
                    <div className="relative">
                      <video src={hologramPreview} autoPlay loop muted playsInline className="w-12 h-12 rounded-md object-cover border-2 border-cyan-400" />
                    </div>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    {hologramFile ? "Change File" : hologramVideoUrl ? "Replace Video" : "Upload Video"}
                  </Button>
                  <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleVideoSelect} />
                </div>
              )}

              {videoTab === "youtube" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Paste YouTube URL..."
                        value={ytLinkInput}
                        onChange={(e) => setYtLinkInput(e.target.value)}
                        className="pl-8 text-sm h-8"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                    <Input
                      placeholder="Or search YouTube..."
                      value={ytSearchQuery}
                      onChange={(e) => handleYtSearchInput(e.target.value)}
                      className="pl-8 text-sm h-8"
                    />
                    {ytSearching && <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin z-10" />}
                    {ytSearchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg max-h-44 overflow-y-auto">
                        {ytSearchResults.map((v: any) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => { setSelectedYtId(v.id); setYtSearchQuery(""); setYtSearchResults([]); }}
                            className={`w-full flex items-center gap-2 p-1.5 text-left text-xs transition-colors hover:bg-muted ${selectedYtId === v.id ? "bg-red-500/10" : ""}`}
                          >
                            <img src={v.thumbnail?.url || `https://img.youtube.com/vi/${v.id}/default.jpg`} className="w-10 h-7 object-cover rounded flex-shrink-0" />
                            <span className="truncate">{v.title}</span>
                            {selectedYtId === v.id && <Youtube className="w-3 h-3 text-red-500 flex-shrink-0 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedYtId && (
                    <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-md border border-red-500/30">
                      <img src={`https://img.youtube.com/vi/${selectedYtId}/default.jpg`} className="w-10 h-7 object-cover rounded" />
                      <span className="text-xs flex-1">YouTube video selected</span>
                      <button type="button" onClick={() => setSelectedYtId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!editTitle.trim() || editMutation.isPending || uploadingVideo}
              data-testid="button-save-room-edit"
            >
              {editMutation.isPending || uploadingVideo ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
