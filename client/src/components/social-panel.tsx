import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Search, UserPlus, UserCheck, MessageSquare, Phone, StickyNote, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { User, Follow, UserBadge } from "@shared/schema";
import { BADGE_TYPES } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function UserBadgePips({ userId }: { userId: string }) {
  const { data: badges = [] } = useQuery<UserBadge[]>({
    queryKey: ["/api/users", userId, "badges"],
    queryFn: () => fetch(`/api/users/${userId}/badges`).then(r => r.json()),
    staleTime: 60000,
  });
  if (badges.length === 0) return null;
  const displayed = badges.slice(0, 3);
  return (
    <div className="flex items-center gap-0.5 mt-0.5">
      {displayed.map((b) => {
        const def = BADGE_TYPES[b.badgeType as keyof typeof BADGE_TYPES];
        if (!def) return null;
        return (
          <Tooltip key={b.id}>
            <TooltipTrigger asChild>
              <span className="text-[11px] leading-none cursor-default">{def.emoji}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{def.label}</TooltipContent>
          </Tooltip>
        );
      })}
      {badges.length > 3 && <span className="text-[10px] text-muted-foreground">+{badges.length - 3}</span>}
    </div>
  );
}

export function UserNotePopover({ userId }: { userId: string }) {
  const [noteText, setNoteText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<{ note: string }>({
    queryKey: ["/api/notes", userId],
    queryFn: () => fetch(`/api/notes/${userId}`, { credentials: "include" }).then(r => r.json()),
    enabled: open,
    staleTime: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: async (note: string) => {
      await apiRequest("POST", `/api/notes/${userId}`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", userId] });
    },
  });

  const currentNote = noteText ?? (data?.note ?? "");

  const handleClose = () => {
    setOpen(false);
    setNoteText(null);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            data-testid={`button-note-${userId}`}
            className={`h-8 w-8 ${data?.note ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`}
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          >
            <StickyNote className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Private note</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="sm:max-w-lg w-full p-0 overflow-hidden" data-testid={`dialog-note-${userId}`}>
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <StickyNote className="w-4 h-4 text-amber-400" />
              Private Note
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Only you can see this — not visible to anyone else</p>
          </DialogHeader>
          <div className="px-5 py-4 space-y-3">
            {isLoading ? (
              <div className="h-52 bg-muted animate-pulse rounded-lg" />
            ) : (
              <Textarea
                className="resize-none h-52 text-sm leading-relaxed bg-muted/30 border-border/50 focus-visible:ring-amber-400/40 placeholder:text-muted-foreground/50"
                placeholder="Write your personal notes about this person here... (only you can read this)"
                value={currentNote}
                onChange={(e) => setNoteText(e.target.value)}
                maxLength={1000}
                autoFocus
                data-testid={`textarea-note-${userId}`}
              />
            )}
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">{currentNote.length} / 1000</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={handleClose}
                  data-testid={`button-cancel-note-${userId}`}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-amber-500 hover:bg-amber-400 text-black"
                  disabled={saveMutation.isPending || isLoading}
                  onClick={() => saveMutation.mutate(currentNote)}
                  data-testid={`button-save-note-${userId}`}
                >
                  {saveMutation.isPending ? "Saving..." : "Save Note"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface UserProfileDialogProps {
  user: User;
  open: boolean;
  onClose: () => void;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onMessage: () => void;
  onJoinRoom?: () => void;
  inRoomId?: string;
  isOnline: boolean;
}

function UserProfileDialog({
  user: u,
  open,
  onClose,
  isFollowing,
  onFollow,
  onUnfollow,
  onMessage,
  onJoinRoom,
  inRoomId,
  isOnline,
}: UserProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-sm w-full p-0 overflow-hidden"
        data-testid={`dialog-profile-${u.id}`}
      >
        <div className="relative">
          <div className="h-16 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
          <div className="absolute top-8 left-4">
            <Avatar className="w-16 h-16 border-4 border-background shadow-lg">
              <AvatarImage src={u.profileImageUrl || undefined} alt={getUserDisplayName(u)} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {getUserInitials(u)}
              </AvatarFallback>
            </Avatar>
            <div
              className={`absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-background ${
                isOnline ? "bg-green-500" : "bg-muted-foreground/40"
              }`}
            />
          </div>
        </div>

        <div className="px-4 pt-10 pb-4 space-y-3">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-base leading-tight">{getUserDisplayName(u)}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isOnline ? "Online" : "Offline"}
                  {inRoomId && (
                    <span className="ml-1.5 text-primary font-medium">• In a room</span>
                  )}
                </p>
              </div>
              {isFollowing && (
                <Badge variant="secondary" className="text-[10px] h-5 shrink-0">Following</Badge>
              )}
            </div>
            {u.bio && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-3">{u.bio}</p>
            )}
            <UserBadgePips userId={u.id} />
          </div>

          <div className="border-t border-border/40 pt-3">
            <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Private Note</p>
            <UserNotePopover userId={u.id} />
          </div>

          <div className="flex gap-2 pt-1">
            {inRoomId && onJoinRoom && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs"
                onClick={() => { onJoinRoom(); onClose(); }}
                data-testid={`button-join-room-profile-${u.id}`}
              >
                <Phone className="w-3.5 h-3.5 mr-1.5" /> Join Room
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={() => { onMessage(); onClose(); }}
              data-testid={`button-message-profile-${u.id}`}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Message
            </Button>
            <Button
              size="sm"
              variant={isFollowing ? "outline" : "default"}
              className="flex-1 h-8 text-xs"
              onClick={() => { isFollowing ? onUnfollow() : onFollow(); }}
              data-testid={`button-follow-profile-${u.id}`}
            >
              {isFollowing ? (
                <><UserCheck className="w-3.5 h-3.5 mr-1.5 text-primary" /> Following</>
              ) : (
                <><UserPlus className="w-3.5 h-3.5 mr-1.5" /> Follow</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SocialPanelProps {
  onOpenDm?: (userId: string) => void;
  onlineUsers: Set<string>;
}

export function SocialPanel({ onOpenDm, onlineUsers }: SocialPanelProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const { data: following = [] } = useQuery<Follow[]>({
    queryKey: ["/api/follows/following", user?.id],
    enabled: !!user,
  });

  const { data: followers = [] } = useQuery<Follow[]>({
    queryKey: ["/api/follows/followers", user?.id],
    enabled: !!user,
  });

  const { data: userRooms = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/users/rooms"],
    enabled: !!user,
    refetchInterval: 5000,
  });

  const followMutation = useMutation({
    mutationFn: async (followingId: string) => {
      await apiRequest("POST", "/api/follows", {
        followerId: user?.id,
        followingId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/followers"] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (followingId: string) => {
      await apiRequest("DELETE", `/api/follows/${user?.id}/${followingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/followers"] });
    },
  });

  const followingIds = new Set(following.map((f) => f.followingId));
  const followerIds = new Set(followers.map((f) => f.followerId));

  const friends = allUsers.filter(
    (u) => u.id !== user?.id && followingIds.has(u.id) && followerIds.has(u.id)
  );

  const followingUsers = allUsers.filter(
    (u) => u.id !== user?.id && followingIds.has(u.id)
  );

  const followerUsers = allUsers.filter(
    (u) => u.id !== user?.id && followerIds.has(u.id)
  );

  const connectedUserIds = new Set([...Array.from(followingIds), ...Array.from(followerIds)]);
  const connectedUsers = allUsers.filter(
    (u) => u.id !== user?.id && connectedUserIds.has(u.id)
  );

  const filterBySearch = (users: User[]) =>
    users.filter((u) =>
      getUserDisplayName(u).toLowerCase().includes(search.toLowerCase())
    );

  const handleJoinRoom = (roomId: string) => {
    setOpen(false);
    if (user?.id) {
      try {
        const bc = new BroadcastChannel(`connect-room-${user.id}`);
        bc.postMessage({ type: "room-joined", roomId });
        bc.close();
      } catch {}
    }
    window.open(`/room/${roomId}`, "_blank");
  };

  const renderUser = (u: User) => {
    const isOnline = onlineUsers.has(u.id);
    const isFollowing = followingIds.has(u.id);
    const inRoomId = userRooms[u.id];

    return (
      <div
        key={u.id}
        className="flex items-center gap-3 p-2 rounded-md hover-elevate"
        data-testid={`social-user-${u.id}`}
      >
        <button
          className="relative flex-shrink-0 focus:outline-none"
          onClick={() => setProfileUser(u)}
          data-testid={`button-avatar-${u.id}`}
          aria-label={`View ${getUserDisplayName(u)}'s profile`}
        >
          <Avatar className="w-9 h-9 hover:ring-2 hover:ring-primary/50 transition-all rounded-full">
            <AvatarImage src={u.profileImageUrl || undefined} alt={getUserDisplayName(u)} />
            <AvatarFallback className="text-sm bg-primary/10 text-primary">
              {getUserInitials(u)}
            </AvatarFallback>
          </Avatar>
          <div
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${
              isOnline ? "bg-status-online" : "bg-status-offline"
            }`}
          />
        </button>

        <button
          className="flex-1 min-w-0 text-left focus:outline-none"
          onClick={() => setProfileUser(u)}
          data-testid={`button-name-${u.id}`}
        >
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate hover:text-primary transition-colors">
              {getUserDisplayName(u)}
            </p>
            {inRoomId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium flex-shrink-0">
                In Room
              </span>
            )}
          </div>
          {u.bio ? (
            <p className="text-xs text-muted-foreground truncate">{u.bio}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isOnline ? "Online" : "Offline"}
            </p>
          )}
          <UserBadgePips userId={u.id} />
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {inRoomId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleJoinRoom(inRoomId)}
                  data-testid={`button-join-room-${u.id}`}
                  className="text-primary w-8 h-8"
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Join their room</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="w-8 h-8"
                onClick={() => {
                  if (onOpenDm) {
                    onOpenDm(u.id);
                  } else {
                    setLocation(`/messages/${u.id}`);
                  }
                  setOpen(false);
                }}
                data-testid={`button-dm-${u.id}`}
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Message</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="w-8 h-8"
                onClick={() =>
                  isFollowing
                    ? unfollowMutation.mutate(u.id)
                    : followMutation.mutate(u.id)
                }
                data-testid={`button-follow-${u.id}`}
              >
                {isFollowing ? (
                  <UserCheck className="w-4 h-4 text-primary" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFollowing ? "Unfollow" : "Follow"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  };

  const profileTarget = profileUser;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="icon" variant="ghost" data-testid="button-social-panel">
            <Users className="w-4 h-4" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-80 sm:w-96 p-0 flex flex-col">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle>People</SheetTitle>
          </SheetHeader>

          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
          </div>

          <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 grid grid-cols-4 text-[11px]">
              <TabsTrigger value="all" className="text-[11px]" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="friends" className="text-[11px]" data-testid="tab-friends">Friends</TabsTrigger>
              <TabsTrigger value="following" className="text-[11px]" data-testid="tab-following">Following</TabsTrigger>
              <TabsTrigger value="followers" className="text-[11px]" data-testid="tab-followers">Followers</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-2">
              <div className="px-4 pb-4">
                <TabsContent value="all" className="mt-0 space-y-1">
                  {filterBySearch(connectedUsers).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No connections yet. Follow someone to see them here.
                    </p>
                  ) : (
                    filterBySearch(connectedUsers).map(renderUser)
                  )}
                </TabsContent>
                <TabsContent value="friends" className="mt-0 space-y-1">
                  {filterBySearch(friends).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No friends yet
                    </p>
                  ) : (
                    filterBySearch(friends).map(renderUser)
                  )}
                </TabsContent>
                <TabsContent value="following" className="mt-0 space-y-1">
                  {filterBySearch(followingUsers).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Not following anyone
                    </p>
                  ) : (
                    filterBySearch(followingUsers).map(renderUser)
                  )}
                </TabsContent>
                <TabsContent value="followers" className="mt-0 space-y-1">
                  {filterBySearch(followerUsers).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No followers yet
                    </p>
                  ) : (
                    filterBySearch(followerUsers).map(renderUser)
                  )}
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {profileTarget && (
        <UserProfileDialog
          user={profileTarget}
          open={!!profileTarget}
          onClose={() => setProfileUser(null)}
          isFollowing={followingIds.has(profileTarget.id)}
          onFollow={() => followMutation.mutate(profileTarget.id)}
          onUnfollow={() => unfollowMutation.mutate(profileTarget.id)}
          onMessage={() => {
            if (onOpenDm) {
              onOpenDm(profileTarget.id);
            } else {
              setLocation(`/messages/${profileTarget.id}`);
            }
            setOpen(false);
          }}
          onJoinRoom={userRooms[profileTarget.id] ? () => handleJoinRoom(userRooms[profileTarget.id]) : undefined}
          inRoomId={userRooms[profileTarget.id]}
          isOnline={onlineUsers.has(profileTarget.id)}
        />
      )}
    </>
  );
}
