import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, Search, UserPlus, UserCheck, MessageSquare, Phone, StickyNote } from "lucide-react";
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

function UserNotePopover({ userId }: { userId: string }) {
  const [noteText, setNoteText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<{ note: string }>({
    queryKey: ["/api/notes", userId],
    queryFn: () => fetch(`/api/notes/${userId}`).then(r => r.json()),
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

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNoteText(null); }}>
      <PopoverTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              data-testid={`button-note-${userId}`}
              className={data?.note ? "text-amber-400" : ""}
            >
              <StickyNote className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Private note</TooltipContent>
        </Tooltip>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end" side="left">
        <p className="text-xs font-medium mb-1.5">Private note (only you can see this)</p>
        {isLoading ? (
          <div className="h-20 bg-muted animate-pulse rounded" />
        ) : (
          <Textarea
            className="text-xs resize-none h-24"
            placeholder="Add a personal note about this person..."
            value={currentNote}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={1000}
            data-testid={`textarea-note-${userId}`}
          />
        )}
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] text-muted-foreground">{currentNote.length}/1000</span>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate(currentNote)}
            data-testid={`button-save-note-${userId}`}
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
        <div className="relative flex-shrink-0">
          <Avatar className="w-9 h-9">
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
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{getUserDisplayName(u)}</p>
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
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {inRoomId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleJoinRoom(inRoomId)}
                  data-testid={`button-join-room-${u.id}`}
                  className="text-primary"
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Join their room</TooltipContent>
            </Tooltip>
          )}
          <Button
            size="icon"
            variant="ghost"
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
          {isFollowing && <UserNotePopover userId={u.id} />}
          <Button
            size="icon"
            variant="ghost"
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
        </div>
      </div>
    );
  };

  return (
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
          <TabsList className="mx-4 grid grid-cols-4">
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="friends" data-testid="tab-friends">
              Friends
            </TabsTrigger>
            <TabsTrigger value="following" data-testid="tab-following">
              Following
            </TabsTrigger>
            <TabsTrigger value="followers" data-testid="tab-followers">
              Followers
            </TabsTrigger>
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
  );
}
