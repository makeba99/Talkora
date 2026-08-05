import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Settings, Lock, Globe, Ban, LogIn, UserPlus, UserCheck, MessageSquare, Heart, ChevronUp } from "lucide-react";
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
          <p className="text-xs text-muted-foreground mt-1 italic" data-testid={`text-card-profile-bio-${participant.id}`}>{participant.bio}</p>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{followers.length}</strong> followers</span>
        <span><strong className="text-foreground">{followingList.length}</strong> following</span>
      </div>
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

export function RoomCard({ room, participants, onJoin, onOpenDm, isOwner, isLoggedIn = true, voteCount = 0, hasVoted = false, onVote }: RoomCardProps) {
  const { user } = useAuth();
  const isFull = participants.length >= room.maxUsers;
  const slots = Array.from({ length: Math.min(room.maxUsers, 8) });
  const avatarSize = "w-14 h-14";
  const emptySlotSize = "w-14 h-14";
  const fallbackText = "text-base";
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

  const editMutation = useMutation({
    mutationFn: async (data: { title: string; language: string; level: string; maxUsers: number }) => {
      const res = await apiRequest("PATCH", `/api/rooms/${room.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setEditOpen(false);
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    editMutation.mutate({ title: editTitle.trim(), language: editLanguage, level: editLevel, maxUsers: editMaxUsers });
  };

  const languages = LANGUAGES.filter((l) => l !== "All");

  const levelColor: Record<string, string> = {
    Beginner: "text-chart-3",
    Intermediate: "text-chart-4",
    Advanced: "text-chart-1",
    Native: "text-secondary",
  };

  const themeBorderClass = getRoomThemeBorderClass((room as any).roomTheme);

  return (
    <div
      className={`p-[2px] rounded-md bg-gradient-to-br ${themeBorderClass} h-full`}
      data-testid={`card-room-${room.id}`}
    >
      <Card
        className="p-5 space-y-4 transition-all duration-200 group rounded-md border-0 h-full flex flex-col"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base truncate" data-testid={`text-room-title-${room.id}`}>
                {room.title}
              </h3>
              {!room.isPublic && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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

        <div className="flex items-center gap-2 flex-wrap flex-1 content-start">
          {slots.map((_, i) => {
            const participant = participants[i];
            if (!participant) {
              return (
                <div
                  key={i}
                  className={`${emptySlotSize} rounded-full border-2 border-dashed border-muted-foreground/20`}
                />
              );
            }

            const isSelf = participant.id === user?.id;

            const count = followerCounts[participant.id] || 0;
            const ringClass = getAvatarRingClass(participant.avatarRing);
            const hasRing = !!ringClass;

            if (!isLoggedIn) {
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <ProfileDecoration decorationId={(participant as any).profileDecoration} size={40}>
                    <div className={`rounded-full p-[3px] ${hasRing ? ringClass : "bg-gradient-to-br from-cyan-400 to-purple-500"}`}>
                      <Avatar className={`${avatarSize} border-2 border-background`}>
                        <AvatarImage src={participant.profileImageUrl || undefined} alt={getUserDisplayName(participant)} />
                        <AvatarFallback className={`${fallbackText} bg-primary/10 text-primary`}>
                          {getUserInitials(participant)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </ProfileDecoration>
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
                  <button className="flex flex-col items-center gap-1 cursor-pointer" data-testid={`button-card-participant-${participant.id}`}>
                    <ProfileDecoration decorationId={(participant as any).profileDecoration} size={40}>
                      <div className={`rounded-full p-[3px] ${hasRing ? ringClass : "bg-gradient-to-br from-cyan-400 to-purple-500"}`}>
                        <Avatar className={`${avatarSize} border-2 border-background`}>
                          <AvatarImage src={participant.profileImageUrl || undefined} alt={getUserDisplayName(participant)} />
                          <AvatarFallback className={`${fallbackText} bg-primary/10 text-primary`}>
                            {getUserInitials(participant)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </ProfileDecoration>
                    <div className="flex items-center gap-0.5 text-muted-foreground" data-testid={`text-follower-count-card-${participant.id}`}>
                      <Heart className="w-3 h-3 text-pink-500" />
                      <span className="text-[10px]">{count}</span>
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="center">
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

        <div className="flex items-center justify-between gap-2 mt-auto">
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
            <Button
              type="submit"
              className="w-full"
              disabled={!editTitle.trim() || editMutation.isPending}
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
