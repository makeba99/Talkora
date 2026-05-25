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
import { Users, Search, UserPlus, UserCheck, UserMinus, MessageSquare, Phone, StickyNote, X, PlayCircle, Tv2, Bell, BellOff, UserX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { User, Follow, UserBadge } from "@shared/schema";
import { BADGE_TYPES } from "@shared/constants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
            aria-label="Private note"
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
  isFollower: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onRemoveFollower: () => void;
  onMessage: () => void;
  onJoinRoom?: () => void;
  inRoomId?: string;
  isOnline: boolean;
  currentUser?: User | null;
}

function UserProfileDialog({
  user: u,
  open,
  onClose,
  isFollowing,
  isFollower,
  onFollow,
  onUnfollow,
  onRemoveFollower,
  onMessage,
  onJoinRoom,
  inRoomId,
  isOnline,
  currentUser,
}: UserProfileDialogProps) {

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-sm w-full p-0 overflow-hidden"
        data-testid={`dialog-profile-${u.id}`}
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{getUserDisplayName(u)}'s profile</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <div className="h-16 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
          <div className="absolute top-8 left-4">
            {/* Watcher pip stack: current user's avatar floats above the profile avatar
                when they are watching this person — mirrors the in-room watcher bubbles */}
            <div className="relative inline-block">
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
          {isFollower && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 mt-1"
              onClick={() => { onRemoveFollower(); onClose(); }}
              data-testid={`button-remove-follower-${u.id}`}
            >
              <UserMinus className="w-3 h-3 mr-1.5" /> Remove follower
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SocialPanelProps {
  onOpenDm?: (userId: string) => void;
  onlineUsers: Set<string>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function SocialPanel({ onOpenDm, onlineUsers, open: controlledOpen, onOpenChange, hideTrigger }: SocialPanelProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

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
      import("@/lib/sound-fx").then((s) => s.sfxFollow()).catch(() => {});
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (followingId: string) => {
      await apiRequest("DELETE", `/api/follows/${user?.id}/${followingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/followers"] });
      import("@/lib/sound-fx").then((s) => s.sfxUnfollow()).catch(() => {});
    },
  });

  const removeFollowerMutation = useMutation({
    mutationFn: async (followerId: string) => {
      await apiRequest("DELETE", `/api/follows/${followerId}/${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/followers"] });
    },
  });

  const { data: notifPrefsData = {} } = useQuery<Record<string, { notifyRoomJoin: boolean; notifyDm: boolean }>>({
    queryKey: ["/api/push/muted-users"],
    enabled: !!user,
  });

  const updateNotifPrefsMutation = useMutation({
    mutationFn: async ({ userId, notifyRoomJoin, notifyDm }: { userId: string; notifyRoomJoin: boolean; notifyDm: boolean }) => {
      await apiRequest("PATCH", `/api/push/notif-prefs/${userId}`, { notifyRoomJoin, notifyDm });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/push/muted-users"] });
    },
  });

  const followingIds = new Set(following.map((f) => f.followingId));
  const followerIds = new Set(followers.map((f) => f.followerId));

  const friends = allUsers.filter(
    (u) => u.id !== user?.id && followingIds.has(u.id) && followerIds.has(u.id)
  );

  const followingUsers = allUsers.filter(
    (u) => u.id !== user?.id && followingIds.has(u.id) && !followerIds.has(u.id)
  );

  const followerUsers = allUsers.filter(
    (u) => u.id !== user?.id && followerIds.has(u.id) && !followingIds.has(u.id)
  );

  const connectedUserIds = new Set([...Array.from(followingIds), ...Array.from(followerIds)]);
  const connectedUsers = allUsers.filter(
    (u) => u.id !== user?.id && connectedUserIds.has(u.id)
  );

  const filterBySearch = (users: User[]) =>
    users.filter((u) =>
      getUserDisplayName(u).toLowerCase().includes(search.toLowerCase())
    );

  const handleJoinRoom = (roomId: string, watchUserId?: string) => {
    setOpen(false);
    if (user?.id) {
      try {
        const bc = new BroadcastChannel(`connect-room-${user.id}`);
        bc.postMessage({ type: "room-joined", roomId });
        bc.close();
      } catch {}
    }
    const params = watchUserId ? `?watch=${encodeURIComponent(watchUserId)}` : "";
    const url = `/room/${roomId}${params}`;
    const target = `vextorn-room-${roomId}`;
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
        } else if (watchUserId) {
          popup.location.href = url;
        }
        popup.focus();
        return;
      } catch {
        try { popup.focus(); } catch {}
        return;
      }
    }
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
    window.location.href = url;
  };

  const renderUser = (u: User) => {
    const isOnline = onlineUsers.has(u.id);
    const isFollowing = followingIds.has(u.id);
    const inRoomId = userRooms[u.id];

    return (
      <div
        key={u.id}
        className="flex items-center gap-2 p-2 rounded-md hover-elevate"
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
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-medium truncate hover:text-primary transition-colors min-w-0">
              {getUserDisplayName(u)}
            </p>
            {isFollowing && (
              <span className="text-[9px] leading-none px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold uppercase tracking-wide flex-shrink-0">
                ✓
              </span>
            )}
            {inRoomId && (
              <span className="text-[9px] leading-none px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold uppercase tracking-wide flex-shrink-0">
                Live
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

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {inRoomId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleJoinRoom(inRoomId)}
                  data-testid={`button-join-room-${u.id}`}
                  aria-label="Join their room"
                  className="text-emerald-400 hover:text-emerald-300 w-8 h-8"
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
                aria-label="Send message"
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
          <UserNotePopover userId={u.id} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isFollowing ? "default" : "ghost"}
                className={`w-8 h-8 transition-all ${isFollowing ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30" : ""}`}
                aria-label={isFollowing ? `Unfollow ${u.username}` : `Follow ${u.username}`}
                onClick={() =>
                  isFollowing
                    ? unfollowMutation.mutate(u.id)
                    : followMutation.mutate(u.id)
                }
                data-testid={`button-follow-${u.id}`}
              >
                {isFollowing ? (
                  <UserCheck className="w-4 h-4" />
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

  const renderFollowerRow = (u: User) => {
    const isOnline = onlineUsers.has(u.id);
    const inRoomId = userRooms[u.id];
    const prefs = notifPrefsData[u.id];
    const roomJoinOn = prefs?.notifyRoomJoin !== false;
    const dmOn = prefs?.notifyDm !== false;
    const anyOn = roomJoinOn || dmOn;

    return (
      <div
        key={u.id}
        className="flex items-center gap-2 p-2 rounded-md hover-elevate"
        data-testid={`follower-row-${u.id}`}
      >
        <button
          className="relative flex-shrink-0 focus:outline-none"
          onClick={() => setProfileUser(u)}
          data-testid={`button-avatar-follower-${u.id}`}
          aria-label={`View ${getUserDisplayName(u)}'s profile`}
        >
          <Avatar className="w-9 h-9 hover:ring-2 hover:ring-primary/50 transition-all rounded-full">
            <AvatarImage src={u.profileImageUrl || undefined} alt={getUserDisplayName(u)} />
            <AvatarFallback className="text-sm bg-primary/10 text-primary">
              {getUserInitials(u)}
            </AvatarFallback>
          </Avatar>
          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${isOnline ? "bg-status-online" : "bg-status-offline"}`} />
        </button>

        <button
          className="flex-1 min-w-0 text-left focus:outline-none"
          onClick={() => setProfileUser(u)}
          data-testid={`button-name-follower-${u.id}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-medium truncate hover:text-primary transition-colors min-w-0">
              {getUserDisplayName(u)}
            </p>
            {inRoomId && (
              <span className="text-[9px] leading-none px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold uppercase tracking-wide flex-shrink-0">
                Live
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {u.bio || (isOnline ? "Online" : "Offline")}
          </p>
          <UserBadgePips userId={u.id} />
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Notification prefs popover */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`w-8 h-8 transition-all ${anyOn ? "text-orange-400 bg-orange-500/10 border border-orange-500/20" : "text-muted-foreground"}`}
                    aria-label="Notification settings"
                    data-testid={`button-notif-prefs-${u.id}`}
                  >
                    {anyOn ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Notification settings</TooltipContent>
            </Tooltip>
            <PopoverContent side="left" align="center" className="w-52 p-3 space-y-2.5">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 flex items-center gap-1">
                <Bell className="w-3 h-3" /> Notifications from {getUserDisplayName(u)}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Room joins</span>
                  <button
                    onClick={() => updateNotifPrefsMutation.mutate({ userId: u.id, notifyRoomJoin: !roomJoinOn, notifyDm: dmOn })}
                    className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-all duration-200 ${roomJoinOn ? "bg-emerald-500 ring-2 ring-emerald-400/60 shadow-[0_0_10px_rgba(52,211,153,0.55)]" : "bg-red-600/70 ring-2 ring-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.4)]"}`}
                    aria-pressed={roomJoinOn}
                    data-testid={`toggle-notif-room-follower-${u.id}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${roomJoinOn ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Direct messages</span>
                  <button
                    onClick={() => updateNotifPrefsMutation.mutate({ userId: u.id, notifyRoomJoin: roomJoinOn, notifyDm: !dmOn })}
                    className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-all duration-200 ${dmOn ? "bg-emerald-500 ring-2 ring-emerald-400/60 shadow-[0_0_10px_rgba(52,211,153,0.55)]" : "bg-red-600/70 ring-2 ring-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.4)]"}`}
                    aria-pressed={dmOn}
                    data-testid={`toggle-notif-dm-follower-${u.id}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${dmOn ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Remove follower */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label={`Remove ${getUserDisplayName(u)} as follower`}
                onClick={() => removeFollowerMutation.mutate(u.id)}
                data-testid={`button-remove-follower-row-${u.id}`}
              >
                <UserX className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove follower</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  };

  const profileTarget = profileUser;

  const onlineFilter = (users: User[]) => onlyOnline ? users.filter((u) => onlineUsers.has(u.id)) : users;
  const applyFilters = (users: User[]) => onlineFilter(filterBySearch(users));

  const allCount = connectedUsers.length;
  const friendsCount = friends.length;
  const followingCount = followingUsers.length;
  const followersCount = followerUsers.length;
  const onlineCount = connectedUsers.filter((u) => onlineUsers.has(u.id)).length;

  const renderEmpty = (icon: React.ReactNode, title: string, hint: string) => (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 text-primary/70">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground/90 mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[220px]">{hint}</p>
    </div>
  );

  const tabPill = (label: string, count: number, isActive?: boolean) => (
    <span className="flex items-center gap-1.5">
      <span>{label}</span>
      {count > 0 && (
        <span className={`text-[9px] leading-none px-1.5 py-0.5 rounded-full font-bold ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </span>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        {!hideTrigger && (
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" data-testid="button-social-panel" aria-label="Open social panel">
              <Users className="w-4 h-4" aria-hidden="true" />
            </Button>
          </SheetTrigger>
        )}
        <SheetContent
          className="w-80 sm:w-96 p-0 flex flex-col bg-gradient-to-b from-background via-background to-background/95"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <SheetHeader className="px-5 pt-7 pr-12 pb-3 border-b border-border/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
            <SheetTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30 flex-shrink-0">
                  <Users className="w-4.5 h-4.5 text-primary-foreground" />
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-base font-bold tracking-tight">People</span>
                  <span className="text-[10px] text-muted-foreground font-normal whitespace-nowrap">
                    {onlineCount} online · {allCount} total
                  </span>
                </div>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pt-3 pb-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-full bg-muted/40 border-border/50 focus-visible:ring-primary/40 placeholder:text-muted-foreground/70"
                data-testid="input-search-users"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setOnlyOnline(!onlyOnline)}
              className={`w-full flex items-center justify-center gap-2 h-8 rounded-full text-xs font-medium transition-all ${
                onlyOnline
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-transparent"
              }`}
              data-testid="toggle-online-only"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${onlyOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/50"}`} />
              {onlyOnline ? `Showing ${onlineCount} online` : "Show online only"}
            </button>
          </div>

          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 grid grid-cols-4 h-9 bg-muted/30 rounded-full p-1">
              <TabsTrigger value="all" className="text-[11px] rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-all">
                {tabPill("All", allCount, activeTab === "all")}
              </TabsTrigger>
              <TabsTrigger value="friends" className="text-[11px] rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-friends">
                {tabPill("Friends", friendsCount, activeTab === "friends")}
              </TabsTrigger>
              <TabsTrigger value="following" className="text-[11px] rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-following">
                {tabPill("Following", followingCount, activeTab === "following")}
              </TabsTrigger>
              <TabsTrigger value="followers" className="text-[11px] rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-followers">
                {tabPill("Followers", followersCount, activeTab === "followers")}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-2">
              <div className="px-3 pb-4">
                <TabsContent value="all" className="mt-0 space-y-0.5">
                  {applyFilters(connectedUsers).length === 0 ? (
                    renderEmpty(
                      <Users className="w-6 h-6" />,
                      search || onlyOnline ? "No matches" : "No connections yet",
                      search || onlyOnline ? "Try a different search or filter." : "Follow someone to start building your network."
                    )
                  ) : (
                    applyFilters(connectedUsers).map(renderUser)
                  )}
                </TabsContent>
                <TabsContent value="friends" className="mt-0 space-y-0.5">
                  {applyFilters(friends).length === 0 ? (
                    renderEmpty(
                      <UserCheck className="w-6 h-6" />,
                      "No friends yet",
                      "Friends are people who follow each other. Follow someone back to make a friend!"
                    )
                  ) : (
                    applyFilters(friends).map(renderUser)
                  )}
                </TabsContent>
                <TabsContent value="following" className="mt-0 space-y-0.5">
                  {applyFilters(followingUsers).length === 0 ? (
                    renderEmpty(
                      <UserPlus className="w-6 h-6" />,
                      "Not following anyone",
                      "Tap the follow icon on any user to keep up with them."
                    )
                  ) : (
                    applyFilters(followingUsers).map(renderUser)
                  )}
                </TabsContent>
                <TabsContent value="followers" className="mt-0 space-y-0.5">
                  {applyFilters(followerUsers).length === 0 ? (
                    renderEmpty(
                      <Users className="w-6 h-6" />,
                      "No followers yet",
                      "Be active in rooms — others will discover and follow you."
                    )
                  ) : (
                    applyFilters(followerUsers).map(renderFollowerRow)
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
          isFollower={followerIds.has(profileTarget.id)}
          onFollow={() => followMutation.mutate(profileTarget.id)}
          onUnfollow={() => unfollowMutation.mutate(profileTarget.id)}
          onRemoveFollower={() => removeFollowerMutation.mutate(profileTarget.id)}
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
          currentUser={user}
        />
      )}
    </>
  );
}
