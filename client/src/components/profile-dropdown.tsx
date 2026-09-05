import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Settings, LogOut, Camera, ChevronDown, Check, ZoomIn, Ban, X, Bell, BellRing, BellOff, EyeOff, Eye, Award, MessageCircle, Users as UsersIcon, Palette, LayoutGrid, Pin, Anchor, Volume2, VolumeX, Zap, ZapOff, Linkedin } from "lucide-react";
import { isSoundEnabled, setSoundEnabled, onSoundEnabledChange, sfxToggle } from "@/lib/sound-fx";
import { isBoostMode, setBoostMode, onBoostModeChange } from "@/lib/perf-bus";
import { SiInstagram, SiFacebook } from "react-icons/si";
import { useAuth } from "@/hooks/use-auth";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { useSocket } from "@/lib/socket-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PROFILE_DECORATIONS, ProfileDecoration, resolveDecorationId } from "@/components/profile-decorations";
import { SQUARE_PROFILE_STYLES } from "@/lib/square-profile-style";
import { SquareStyleSwatch } from "@/components/room-user-profile";
import { PROFILE_ANIMATIONS, ProfileAnimationOverlay, resolveProfileAnimationId } from "@/lib/profile-animations";
import { BADGE_TYPES } from "@shared/constants";
import { isVipUser, vipNameClass, titleColorStyle } from "@/lib/vip";
import { TITLE_COLOR_PALETTE, canUseFeature } from "@shared/entitlements";

// AVATAR_RINGS / FLAIR_BADGES / getAvatarRingClass / getFlairIcon now live
// in @/lib/avatar-ring so the lobby's room cards can import the small lookup
// table without dragging in the entire ~1.2k-line profile-dropdown bundle.
// We re-export from the same module path so existing callers keep working.
import {
  AVATAR_RINGS,
  FLAIR_BADGES,
  getAvatarRingClass,
  getFlairIcon,
  getFlairEmoji,
} from "@/lib/avatar-ring";
export { AVATAR_RINGS, FLAIR_BADGES, getAvatarRingClass, getFlairIcon };

export function FlairBadgeDisplay({ badgeId, className }: { badgeId: string | null | undefined; className?: string }) {
  const emoji = getFlairEmoji(badgeId);
  if (!emoji) return null;
  return (
    <span className={`text-xs ${className || ""}`} data-testid="flair-badge-display">{emoji}</span>
  );
}

const CROP_SIZE = 260;

function ImageCropDialog({
  open,
  imgSrc,
  onClose,
  onConfirm,
}: {
  open: boolean;
  imgSrc: string;
  onClose: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!open || !imgSrc) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    const img = new Image();
    img.onload = () => { imgRef.current = img; drawCanvas(img, 1, { x: 0, y: 0 }); };
    img.src = imgSrc;
  }, [open, imgSrc]);

  const drawCanvas = useCallback((img: HTMLImageElement, z: number, off: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

    const scale = Math.min(CROP_SIZE / img.width, CROP_SIZE / img.height) * z;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (CROP_SIZE - drawW) / 2 + off.x;
    const dy = (CROP_SIZE - drawH) / 2 + off.y;

    ctx.save();
    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(99,102,241,0.8)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, []);

  useEffect(() => {
    if (imgRef.current) drawCanvas(imgRef.current, zoom, offset);
  }, [zoom, offset, drawCanvas]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, offsetX: offset.x, offsetY: offset.y };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.mouseX;
    const dy = e.clientY - dragStart.current.mouseY;
    setOffset({ x: dragStart.current.offsetX + dx, y: dragStart.current.offsetY + dy });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, "image/jpeg", 0.92);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4" /> Adjust Profile Photo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Drag to reposition. Use the slider to zoom.</p>
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={CROP_SIZE}
              height={CROP_SIZE}
              className="rounded-full cursor-grab active:cursor-grabbing border-2 border-primary/30 shadow-md"
              onMouseDown={handleMouseDown}
              style={{ userSelect: "none" }}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <ZoomIn className="w-3 h-3" /> Zoom
            </Label>
            <Slider
              min={1}
              max={4}
              step={0.05}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleConfirm}>Apply & Upload</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ProfileDropdownProps {
  onOpenTheme?: () => void;
  onOpenNotifications?: () => void;
  onOpenMessages?: () => void;
  onOpenCommunity?: () => void;
  unreadMessages?: number;
  unreadNotifications?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Map of which orbit satellites are currently pinned to the header bar.
   * Pinned items disappear from the orbit ring; their pin badge in the orbit
   * is not rendered when they are pinned.
   */
  pinned?: { messages?: boolean; notifications?: boolean; themes?: boolean; community?: boolean; orbit?: boolean };
  onTogglePin?: (key: "messages" | "notifications" | "themes" | "community" | "orbit") => void;
  /**
   * Map of which orbit satellites are pinned to the bottom-right corner FAB
   * stack. Orthogonal to `pinned` — an item can be pinned to header, corner,
   * both, or neither. Pinning to corner does not remove the item from the
   * orbit ring, so users can still discover/access it from the orbit.
   */
  cornerPinned?: { messages?: boolean; notifications?: boolean; themes?: boolean; community?: boolean; orbit?: boolean };
  onToggleCornerPin?: (key: "messages" | "notifications" | "themes" | "community" | "orbit") => void;
  /**
   * Rendering mode for the orbit popover content:
   *  - "full" (default): orbit ring + identity card + footer actions
   *  - "ring-only": just the orbit ring (used by the standalone orbit launcher chip)
   *  - "profile-only": identity + footer (used when the orbit has been pinned out
   *    of the avatar pill into its own header chip)
   */
  mode?: "full" | "ring-only" | "profile-only";
  /**
   * Optional custom trigger element. When provided, replaces the default
   * avatar pill — used by the standalone orbit launcher chip so the orbit
   * popover can be anchored to a separate header button.
   */
  customTrigger?: React.ReactElement;
}

export function ProfileDropdown({
  onOpenTheme,
  onOpenNotifications,
  onOpenMessages,
  onOpenCommunity,
  unreadMessages = 0,
  unreadNotifications = 0,
  open: controlledOpen,
  onOpenChange,
  pinned,
  onTogglePin,
  cornerPinned,
  onToggleCornerPin,
  mode = "full",
  customTrigger,
}: ProfileDropdownProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const orbitOpen = controlledOpen ?? internalOpen;
  const setOrbitOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };
  const closeOrbitAnd = (fn?: () => void) => () => { setOrbitOpen(false); fn?.(); };
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { appearOffline, setAppearOffline } = useSocket();
  const { toast } = useToast();
  const push = usePushSubscription();
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [badgeApplyOpen, setBadgeApplyOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [socialsPinned, setSocialsPinned] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState("online");
  const [selectedRing, setSelectedRing] = useState<string>("none");
  const [selectedFlair, setSelectedFlair] = useState<string>("none");
  const [selectedDecoration, setSelectedDecoration] = useState<string>("none");
  const [selectedAnimation, setSelectedAnimation] = useState<string>("none");
  const [selectedTitleColor, setSelectedTitleColor] = useState<string>("");
  const [showBadge, setShowBadge] = useState(true);
  const [showStatusBio, setShowStatusBio] = useState(true);
  const [showVipLabel, setShowVipLabel] = useState(true);
  const [followVisibility, setFollowVisibility] = useState<string>("everyone");
  const [requestedBadge, setRequestedBadge] = useState("");
  const [badgeReason, setBadgeReason] = useState("");
  const [roomJoinNotifyPref, setRoomJoinNotifyPref] = useState<"everyone" | "mutual" | "none">("everyone");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImgSrc, setCropImgSrc] = useState("");

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName?: string; bio?: string; instagramUrl?: string; linkedinUrl?: string; facebookUrl?: string; socialsPinned?: boolean; status?: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setEditOpen(false);
      toast({ title: "Profile updated" });
      import("@/lib/sound-fx").then((s) => s.sfxSuccess()).catch(() => {});
    },
    onError: () => {
      import("@/lib/sound-fx").then((s) => s.sfxError()).catch(() => {});
    },
  });

  const { data: blockedUsers = [], refetch: refetchBlockedUsers } = useQuery<any[]>({
    queryKey: ["/api/blocks/users"],
    enabled: blockedOpen,
  });

  const { data: badgeApplications = [] } = useQuery<any[]>({
    queryKey: ["/api/badge-applications/my"],
    enabled: badgeApplyOpen,
  });

  const unblockMutation = useMutation({
    mutationFn: async (blockedId: string) => {
      await apiRequest("DELETE", `/api/blocks/${blockedId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocks/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blocks"] });
      refetchBlockedUsers();
      toast({ title: "User unblocked" });
      import("@/lib/sound-fx").then((s) => s.sfxSuccess()).catch(() => {});
    },
    onError: () => {
      toast({ title: "Failed to unblock user", variant: "destructive" });
      import("@/lib/sound-fx").then((s) => s.sfxError()).catch(() => {});
    },
  });

  const saveDecorationsMutation = useMutation({
    mutationFn: async (data: { avatarRing?: string; flairBadge?: string; profileDecoration?: string; profileAnimation?: string; titleColor?: string | null; showBadge?: boolean; showStatusBio?: boolean; showVipLabel?: boolean; followVisibility?: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSettingsOpen(false);
      toast({ title: "Settings saved" });
      import("@/lib/sound-fx").then((s) => s.sfxSuccess()).catch(() => {});
    },
    onError: (err: any) => {
      toast({ title: "Could not save settings", description: err?.message, variant: "destructive" });
      import("@/lib/sound-fx").then((s) => s.sfxError()).catch(() => {});
    },
  });

  const roomJoinNotifyMutation = useMutation({
    mutationFn: async (pref: "everyone" | "mutual" | "none") => {
      const res = await apiRequest("PATCH", "/api/push/room-join-notify-pref", { pref });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Notification preference saved" });
    },
    onError: () => {
      toast({ title: "Could not save preference", variant: "destructive" });
    },
  });

  const badgeApplicationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/badge-applications", {
        badgeType: requestedBadge,
        reason: badgeReason,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/badge-applications/my"] });
      setRequestedBadge("");
      setBadgeReason("");
      toast({ title: "Badge application sent", description: "Admins can now review your request." });
      import("@/lib/sound-fx").then((s) => s.sfxSuccess()).catch(() => {});
    },
    onError: (err: any) => {
      toast({ title: "Could not apply", description: err?.message, variant: "destructive" });
      import("@/lib/sound-fx").then((s) => s.sfxError()).catch(() => {});
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File | Blob) => {
      const formData = new FormData();
      formData.append("avatar", file, "avatar.jpg");
      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Avatar updated" });
      import("@/lib/sound-fx").then((s) => s.sfxUpload()).catch(() => {});
    },
    onError: () => {
      import("@/lib/sound-fx").then((s) => s.sfxError()).catch(() => {});
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (src) {
        setCropImgSrc(src);
        setCropOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (blob: Blob) => {
    setCropOpen(false);
    setCropImgSrc("");
    uploadAvatarMutation.mutate(blob);
  };

  const handleOpenEdit = () => {
    setDisplayName(user?.displayName || getUserDisplayName(user));
    setBio(user?.bio || "");
    setInstagramUrl((user as any)?.instagramUrl || "");
    setLinkedinUrl((user as any)?.linkedinUrl || "");
    setFacebookUrl((user as any)?.facebookUrl || "");
    setSocialsPinned(!!(user as any)?.socialsPinned);
    setPresenceStatus((user as any)?.status || "online");
    setRoomJoinNotifyPref(((user as any)?.roomJoinNotifyFrom as any) || "mutual");
    setEditOpen(true);
  };

  const handleOpenSettings = () => {
    setSelectedRing(user?.avatarRing || "none");
    setSelectedFlair(user?.flairBadge || "none");
    setSelectedDecoration(resolveDecorationId((user as any)?.profileDecoration));
    setSelectedAnimation(resolveProfileAnimationId((user as any)?.profileAnimation));
    setSelectedTitleColor((user as any)?.titleColor || "");
    setShowBadge((user as any)?.showBadge !== false);
    setShowStatusBio((user as any)?.showStatusBio !== false);
    setShowVipLabel((user as any)?.showVipLabel !== false);
    setFollowVisibility((user as any)?.followVisibility || "everyone");
    setSettingsOpen(true);
  };

  const handleSaveDecorations = () => {
    saveDecorationsMutation.mutate({
      avatarRing: selectedRing,
      flairBadge: "none",
      profileDecoration: selectedDecoration,
      profileAnimation: selectedAnimation,
      titleColor: selectedTitleColor || null,
      showBadge,
      showStatusBio,
      showVipLabel,
      followVisibility,
    });
  };

  return (
    <>
      <Popover open={orbitOpen} onOpenChange={setOrbitOpen}>
        <PopoverTrigger asChild>
          {customTrigger ?? (
          <button
            className="orbit-trigger-pill"
            data-testid="button-profile-dropdown"
            aria-label="Open profile menu"
          >
            <span className="orbit-trigger-avatar-wrap">
              <Avatar className="w-9 h-9">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.displayName || user?.firstName || "Your profile"} />
                <AvatarFallback className="text-[13px] bg-primary/10 text-primary font-semibold">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <span
                className="orbit-trigger-status"
                style={{
                  background: appearOffline ? "#6b7280" : "#22c55e",
                  boxShadow: appearOffline ? "none" : "0 0 6px rgba(34,197,94,0.7)",
                }}
                aria-hidden="true"
              />
              {(unreadMessages + unreadNotifications) > 0 && (
                <span className="orbit-trigger-badge" aria-hidden="true">
                  {Math.min(unreadMessages + unreadNotifications, 99)}
                </span>
              )}
            </span>
            <span
              className="text-[13.5px] font-semibold hidden sm:inline truncate max-w-[140px] tracking-tight"
              data-testid="text-current-user"
            >
              {getUserDisplayName(user)}
            </span>
            <ChevronDown className="orbit-trigger-chev w-3.5 h-3.5 hidden sm:block" />
          </button>
          )}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          className="orbit-popover-content"
        >
          {/* connector tail from the trigger pill into the orbit */}
          <span className="orbit-tail" aria-hidden="true" />

          {/* Orbit ring with 4 satellites: items only appear here when NOT
              pinned to the header. Tap a satellite to open it; tap its small
              pin badge to pin it to the header (it then disappears from the
              orbit and shows as a chip next to the avatar). The center
              "close" button is itself pinnable: pinning it lifts the whole
              orbit out of the avatar pill into a standalone header chip.
              In "profile-only" mode the ring is hidden entirely. */}
          {mode !== "profile-only" && (
          <div className="orbit-ring" data-testid="orbit-ring">
            <span className="orbit-ring-outer" aria-hidden="true" />
            <span className="orbit-ring-inner" aria-hidden="true" />

            {/* center: collapse / "all apps" — also pinnable so the orbit
                can live as its own header chip, separated from the profile. */}
            <button
              type="button"
              className="orbit-center"
              onClick={() => setOrbitOpen(false)}
              data-testid="button-orbit-center"
              title="Close menu"
              aria-label="Close menu"
            >
              <LayoutGrid className="w-5 h-5" />
              {onTogglePin && (
                <span
                  role="button"
                  tabIndex={0}
                  className="orbit-sat-pin orbit-center-pin"
                  onClick={(e) => { e.stopPropagation(); onTogglePin?.("orbit"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onTogglePin?.("orbit"); } }}
                  data-testid="button-pin-orbit"
                  aria-label={pinned?.orbit ? "Move Orbit back into profile" : "Pin Orbit as a separate header button"}
                  title={pinned?.orbit ? "Move back into profile" : "Pin orbit to header"}
                >
                  <Pin className="w-2.5 h-2.5" />
                </span>
              )}
              {onToggleCornerPin && (
                <span
                  role="button"
                  tabIndex={0}
                  className={`orbit-sat-pin orbit-sat-pin-corner orbit-center-pin-corner ${cornerPinned?.orbit ? "is-active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onToggleCornerPin?.("orbit"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onToggleCornerPin?.("orbit"); } }}
                  data-testid="button-corner-pin-orbit"
                  aria-label={cornerPinned?.orbit ? "Unpin Orbit from corner" : "Pin Orbit to corner"}
                  title={cornerPinned?.orbit ? "Unpin from corner" : "Pin to corner"}
                >
                  <Anchor className="w-2.5 h-2.5" />
                </span>
              )}
            </button>

            {!pinned?.messages && (
              <button
                type="button"
                className="orbit-sat orbit-sat-top"
                onClick={closeOrbitAnd(onOpenMessages)}
                data-testid="orbit-sat-messages"
                aria-label="Messages"
              >
                <span className="orbit-sat-bubble">
                  <MessageCircle className="w-[18px] h-[18px]" />
                  {unreadMessages > 0 && (
                    <span className="orbit-sat-badge" aria-label={`${unreadMessages} unread`}>
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                    </span>
                  )}
                </span>
                <span className="orbit-sat-label">Messages</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="orbit-sat-pin"
                  onClick={(e) => { e.stopPropagation(); onTogglePin?.("messages"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onTogglePin?.("messages"); } }}
                  data-testid="button-pin-messages"
                  aria-label="Pin Messages to header"
                  title="Pin to header"
                >
                  <Pin className="w-2.5 h-2.5" />
                </span>
                {onToggleCornerPin && (
                  <span
                    role="button"
                    tabIndex={0}
                    className={`orbit-sat-pin orbit-sat-pin-corner ${cornerPinned?.messages ? "is-active" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onToggleCornerPin?.("messages"); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onToggleCornerPin?.("messages"); } }}
                    data-testid="button-corner-pin-messages"
                    aria-label={cornerPinned?.messages ? "Unpin Messages from corner" : "Pin Messages to corner"}
                    title={cornerPinned?.messages ? "Unpin from corner" : "Pin to corner"}
                  >
                    <Anchor className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            )}

            {!pinned?.notifications && (
              <button
                type="button"
                className="orbit-sat orbit-sat-right"
                onClick={closeOrbitAnd(onOpenNotifications)}
                data-testid="orbit-sat-notifications"
                aria-label="Notifications"
              >
                <span className="orbit-sat-bubble">
                  <Bell className="w-[18px] h-[18px]" />
                  {unreadNotifications > 0 && (
                    <span className="orbit-sat-badge" aria-label={`${unreadNotifications} unread`}>
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </span>
                <span className="orbit-sat-label">Notifications</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="orbit-sat-pin"
                  onClick={(e) => { e.stopPropagation(); onTogglePin?.("notifications"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onTogglePin?.("notifications"); } }}
                  data-testid="button-pin-notifications"
                  aria-label="Pin Notifications to header"
                  title="Pin to header"
                >
                  <Pin className="w-2.5 h-2.5" />
                </span>
                {onToggleCornerPin && (
                  <span
                    role="button"
                    tabIndex={0}
                    className={`orbit-sat-pin orbit-sat-pin-corner ${cornerPinned?.notifications ? "is-active" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onToggleCornerPin?.("notifications"); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onToggleCornerPin?.("notifications"); } }}
                    data-testid="button-corner-pin-notifications"
                    aria-label={cornerPinned?.notifications ? "Unpin Notifications from corner" : "Pin Notifications to corner"}
                    title={cornerPinned?.notifications ? "Unpin from corner" : "Pin to corner"}
                  >
                    <Anchor className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            )}

            {!pinned?.themes && (
              <button
                type="button"
                className="orbit-sat orbit-sat-bottom"
                onClick={closeOrbitAnd(onOpenTheme)}
                data-testid="orbit-sat-themes"
                aria-label="Themes"
              >
                <span className="orbit-sat-bubble">
                  <Palette className="w-[18px] h-[18px]" />
                </span>
                <span className="orbit-sat-label">Themes</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="orbit-sat-pin"
                  onClick={(e) => { e.stopPropagation(); onTogglePin?.("themes"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onTogglePin?.("themes"); } }}
                  data-testid="button-pin-themes"
                  aria-label="Pin Themes to header"
                  title="Pin to header"
                >
                  <Pin className="w-2.5 h-2.5" />
                </span>
                {onToggleCornerPin && (
                  <span
                    role="button"
                    tabIndex={0}
                    className={`orbit-sat-pin orbit-sat-pin-corner ${cornerPinned?.themes ? "is-active" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onToggleCornerPin?.("themes"); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onToggleCornerPin?.("themes"); } }}
                    data-testid="button-corner-pin-themes"
                    aria-label={cornerPinned?.themes ? "Unpin Themes from corner" : "Pin Themes to corner"}
                    title={cornerPinned?.themes ? "Unpin from corner" : "Pin to corner"}
                  >
                    <Anchor className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            )}

            {!pinned?.community && (
              <button
                type="button"
                className="orbit-sat orbit-sat-left"
                onClick={closeOrbitAnd(onOpenCommunity)}
                data-testid="orbit-sat-community"
                aria-label="Community"
              >
                <span className="orbit-sat-bubble">
                  <UsersIcon className="w-[18px] h-[18px]" />
                </span>
                <span className="orbit-sat-label">Community</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="orbit-sat-pin"
                  onClick={(e) => { e.stopPropagation(); onTogglePin?.("community"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onTogglePin?.("community"); } }}
                  data-testid="button-pin-community"
                  aria-label="Pin Community to header"
                  title="Pin to header"
                >
                  <Pin className="w-2.5 h-2.5" />
                </span>
                {onToggleCornerPin && (
                  <span
                    role="button"
                    tabIndex={0}
                    className={`orbit-sat-pin orbit-sat-pin-corner ${cornerPinned?.community ? "is-active" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onToggleCornerPin?.("community"); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onToggleCornerPin?.("community"); } }}
                    data-testid="button-corner-pin-community"
                    aria-label={cornerPinned?.community ? "Unpin Community from corner" : "Pin Community to corner"}
                    title={cornerPinned?.community ? "Unpin from corner" : "Pin to corner"}
                  >
                    <Anchor className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            )}
          </div>
          )}

          {/* identity card under the orbit (hidden in ring-only mode) */}
          {mode !== "ring-only" && (
          <div className="orbit-identity">
            <div className="relative flex-shrink-0">
              <Avatar className="w-9 h-9 ring-1 ring-white/15">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.displayName || user?.firstName || "Your profile"} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`text-[13px] font-semibold truncate ${vipNameClass(user)}`}
                style={titleColorStyle(user)}
                data-testid="text-dropdown-user-name"
              >
                {isVipUser(user) ? "👑 " : ""}{getUserDisplayName(user)}
              </p>
              <p
                className="text-[10.5px] truncate"
                data-testid="text-dropdown-status"
                style={{ color: appearOffline ? "rgba(251,191,36,0.85)" : "rgba(34,197,94,0.85)" }}
              >
                {appearOffline ? "Appearing offline" : "Online"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <SoundFxMiniToggle />
              <BoostModeMiniToggle />
              {/* Push notification toggle */}
              {push.state !== "unsupported" && (
                <button
                  type="button"
                  onClick={() => {
                    if (push.isLoading) return;
                    if (push.state === "subscribed") {
                      push.unsubscribe();
                    } else if (push.state === "denied") {
                      toast({ title: "Notifications blocked", description: "Allow notifications in your browser settings, then try again.", variant: "destructive" });
                    } else {
                      push.subscribe();
                    }
                  }}
                  className="orbit-mini-toggle"
                  data-testid="button-push-notifications"
                  title={
                    push.state === "subscribed" ? "Push notifications on — click to turn off" :
                    push.state === "denied" ? "Notifications blocked by browser" :
                    push.state === "loading" ? "Checking notification status…" :
                    "Enable push notifications"
                  }
                  aria-label="Toggle push notifications"
                  disabled={push.isLoading}
                >
                  {push.state === "subscribed"
                    ? <BellRing className="w-3.5 h-3.5 text-amber-400" />
                    : push.state === "denied"
                    ? <BellOff className="w-3.5 h-3.5 text-destructive/70" />
                    : <Bell className="w-3.5 h-3.5 opacity-50" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setAppearOffline(!appearOffline)}
                className="orbit-mini-toggle"
                data-testid="menu-appear-offline"
                title={appearOffline ? "Currently appearing offline" : "Click to appear offline"}
                aria-label="Toggle appear offline"
              >
                {appearOffline
                  ? <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          )}

          {/* secondary actions footer (hidden in ring-only mode) */}
          {mode !== "ring-only" && (
          <div className="orbit-footer">
            <button
              type="button"
              className="orbit-footer-btn"
              onClick={closeOrbitAnd(handleOpenEdit)}
              data-testid="menu-edit-profile"
            >
              <User className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              className="orbit-footer-btn"
              onClick={closeOrbitAnd(handleOpenSettings)}
              data-testid="menu-settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
            <button
              type="button"
              className="orbit-footer-btn"
              onClick={closeOrbitAnd(() => setBadgeApplyOpen(true))}
              data-testid="menu-apply-badge"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Badge</span>
            </button>
            <button
              type="button"
              className="orbit-footer-btn"
              onClick={closeOrbitAnd(() => setBlockedOpen(true))}
              data-testid="menu-blocked-users"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Blocked</span>
            </button>
            <button
              type="button"
              className="orbit-footer-btn orbit-footer-btn-danger"
              onClick={closeOrbitAnd(() => logout())}
              data-testid="menu-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
          )}
        </PopoverContent>
      </Popover>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <ImageCropDialog
        open={cropOpen}
        imgSrc={cropImgSrc}
        onClose={() => { setCropOpen(false); setCropImgSrc(""); }}
        onConfirm={handleCropConfirm}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 pr-1">
              <div className="flex justify-center">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.displayName || user?.firstName || "Your profile"} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full"
                    aria-label="Upload profile photo"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-3 h-3" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter display name"
                  data-testid="input-display-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell others about yourself..."
                  maxLength={150}
                  data-testid="input-bio"
                />
                <p className="text-xs text-muted-foreground text-right">{bio.length}/150</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="presence-status">Status</Label>
                <Select value={presenceStatus} onValueChange={setPresenceStatus}>
                  <SelectTrigger id="presence-status" data-testid="select-presence-status">
                    <SelectValue placeholder="Set your status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="brb">BRB</SelectItem>
                    <SelectItem value="afk">AFK</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="zz">ZZ (Sleeping)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-1.5">Social Links</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SiInstagram className="w-4 h-4 text-pink-500 flex-shrink-0" />
                    <Input
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      placeholder="instagram.com/yourhandle"
                      className="text-sm"
                      data-testid="input-instagram-url"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <Input
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="linkedin.com/in/yourname"
                      className="text-sm"
                      data-testid="input-linkedin-url"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <SiFacebook className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <Input
                      value={facebookUrl}
                      onChange={(e) => setFacebookUrl(e.target.value)}
                      placeholder="facebook.com/yourprofile"
                      className="text-sm"
                      data-testid="input-facebook-url"
                    />
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="socials-pinned-toggle" className="text-sm font-medium">
                      Pin socials to side
                    </Label>
                    <p className="text-xs text-muted-foreground leading-snug">
                      Adds a round button on the right edge so your socials are always one tap away.
                    </p>
                  </div>
                  <Switch
                    id="socials-pinned-toggle"
                    checked={socialsPinned}
                    onCheckedChange={setSocialsPinned}
                    data-testid="switch-socials-pinned"
                  />
                </div>
              </div>

              {/* Room-join notification preference — only shown when push is active */}
              {push.state === "subscribed" && (
                <div className="space-y-2 rounded-md border border-border/50 bg-muted/30 px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BellRing className="w-3.5 h-3.5 text-amber-400" />
                    <Label className="text-sm font-medium">Room join notifications</Label>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug mb-2">
                    Get notified when someone you follow joins a room.
                  </p>
                  <div className="flex gap-2">
                    {(["everyone", "mutual", "none"] as const).map((opt) => {
                      const labels = { everyone: "Everyone", mutual: "Mutual only", none: "Off" };
                      const active = roomJoinNotifyPref === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setRoomJoinNotifyPref(opt);
                            roomJoinNotifyMutation.mutate(opt);
                          }}
                          disabled={roomJoinNotifyMutation.isPending}
                          data-testid={`button-notify-pref-${opt}`}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border"
                          style={{
                            background: active
                              ? "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.15))"
                              : "transparent",
                            borderColor: active
                              ? "rgba(139,92,246,0.5)"
                              : "rgba(255,255,255,0.08)",
                            color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {labels[opt]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-1">
                    {roomJoinNotifyPref === "mutual"
                      ? "Only people you both follow each other will trigger a notification."
                      : roomJoinNotifyPref === "none"
                      ? "You won't receive any room-join push notifications."
                      : "Anyone you follow will trigger a notification when they join a room."}
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => updateProfileMutation.mutate({ displayName, bio, instagramUrl, linkedinUrl, facebookUrl, socialsPinned, status: presenceStatus })}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Profile Decorations</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-6 pr-4">

              {/* Supporter Settings — VIP only */}
              {isVipUser(user) && (
              <div className="rounded-lg border border-cyan-500/30 bg-[#0d1117] p-4 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  ⚙️ Supporter Settings
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex flex-col items-start gap-1.5">
                    <Label className="text-xs text-muted-foreground">Badge</Label>
                    <Switch
                      checked={showBadge}
                      onCheckedChange={setShowBadge}
                      className="data-[state=checked]:bg-cyan-500"
                    />
                  </div>
                  <div className="flex flex-col items-start gap-1.5">
                    <Label className="text-xs text-muted-foreground">Status/Bio</Label>
                    <Switch
                      checked={showStatusBio}
                      onCheckedChange={setShowStatusBio}
                      className="data-[state=checked]:bg-cyan-500"
                    />
                  </div>
                  <div className="flex flex-col items-start gap-1.5">
                    <Label className="text-xs text-muted-foreground">VIP Label</Label>
                    <Switch
                      checked={showVipLabel}
                      onCheckedChange={setShowVipLabel}
                      className="data-[state=checked]:bg-cyan-500"
                    />
                  </div>
                  <div className="flex flex-col items-start gap-1.5">
                    <Label className="text-xs text-muted-foreground">Who can follow?</Label>
                    <Select value={followVisibility} onValueChange={setFollowVisibility}>
                      <SelectTrigger className="h-7 text-xs w-full bg-background/50 border-cyan-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="everyone">Everyone</SelectItem>
                        <SelectItem value="nobody">Nobody</SelectItem>
                        <SelectItem value="vip_only">VIP Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              )}

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Title color
                  {!canUseFeature(user, "title_color") && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">VIP</span>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Choose a display-name color. Saved to your profile.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {TITLE_COLOR_PALETTE.map((swatch) => {
                    const locked = !canUseFeature(user, "title_color") && !!swatch.value;
                    const active = (selectedTitleColor || "") === (swatch.value || "");
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          if (locked) {
                            toast({ title: "VIP only", description: "Buy Me a Coffee to unlock title colors." });
                            return;
                          }
                          setSelectedTitleColor(swatch.value);
                        }}
                        className={`h-5 w-5 shrink-0 rounded-full border transition-transform ${
                          active
                            ? "scale-110 border-white ring-2 ring-primary/50"
                            : "border-white/15 hover:border-white/45"
                        } ${locked ? "opacity-40 cursor-not-allowed" : ""}`}
                        style={{
                          background: swatch.value || "linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.06))",
                        }}
                        data-testid={`title-color-${swatch.id}`}
                        title={locked ? `${swatch.label} (VIP)` : swatch.label}
                        aria-label={swatch.label}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Avatar Ring</Label>
                <div className="flex justify-center mb-3">
                  <ProfileDecoration decorationId={selectedDecoration} size={72} soft={false}>
                    <div className={`rounded-lg p-0.5 w-full h-full ${getAvatarRingClass(selectedRing)}`}>
                      <Avatar className="w-full h-full rounded-lg">
                        <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.displayName || user?.firstName || "Your profile"} className="rounded-lg object-cover" />
                        <AvatarFallback className="text-xl bg-primary/10 text-primary rounded-lg">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </ProfileDecoration>
                  {selectedFlair !== "none" && (
                    <FlairBadgeDisplay badgeId={selectedFlair} className="text-lg ml-1 -mt-1" />
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_RINGS.map((ring, idx) => {
                    const vipOnly = "vip" in ring && Boolean((ring as { vip?: boolean }).vip);
                    const locked = vipOnly && !isVipUser(user);
                    return (
                    <button
                      key={ring.id}
                      onClick={() => {
                        if (locked) {
                          toast({ title: "VIP only", description: "Buy a coffee ($5+) to unlock this ring." });
                          return;
                        }
                        setSelectedRing(ring.id);
                      }}
                      className={`neu-deco-tile ${selectedRing === ring.id ? "is-active" : ""} ${locked ? "opacity-50" : ""}`}
                      style={{ ["--neu-deco-delay" as any]: `${idx * 35}ms` }}
                      data-testid={`ring-option-${ring.id}`}
                      title={locked ? `${ring.label} (VIP)` : ring.label}
                    >
                      {ring.id === "none" ? (
                        <span className="neu-deco-tile-none" />
                      ) : (
                        <span className="neu-deco-tile-preview">
                          <span className={`block w-5 h-5 rounded-full bg-background ${ring.className}`} />
                        </span>
                      )}
                      <span className="neu-deco-tile-label">{locked ? `🔒 ${ring.label}` : ring.label}</span>
                      {selectedRing === ring.id && (
                        <span className="neu-deco-tile-check"><Check /></span>
                      )}
                    </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Avatar decoration</Label>
                <p className="text-xs text-muted-foreground">
                  Square frames for room cards — available to everyone. VIP users also get character overlays.
                </p>

                {(() => {
                  const renderSquare = (deco: typeof SQUARE_PROFILE_STYLES[number], idx: number) => {
                    const locked = deco.vip && !isVipUser(user);
                    return (
                      <button
                        key={deco.id}
                        onClick={() => {
                          if (locked) {
                            toast({ title: "VIP only", description: "Buy Me a Coffee to unlock this frame." });
                            return;
                          }
                          setSelectedDecoration(deco.id);
                        }}
                        className={`neu-deco-tile ${selectedDecoration === deco.id ? "is-active" : ""} ${locked ? "opacity-50" : ""}`}
                        style={{ ["--neu-deco-delay" as any]: `${idx * 25}ms` }}
                        data-testid={`decoration-option-${deco.id}`}
                        title={locked ? `${deco.label} (VIP)` : deco.description}
                      >
                        <SquareStyleSwatch styleId={deco.id} size={40} />
                        <span className="neu-deco-tile-label">
                          {locked ? `🔒 ${deco.label}` : deco.label}
                        </span>
                        {selectedDecoration === deco.id && (
                          <span className="neu-deco-tile-check"><Check /></span>
                        )}
                      </button>
                    );
                  };

                  const renderTile = (deco: typeof PROFILE_DECORATIONS[number], idx: number) => {
                    const locked = deco.vip && !isVipUser(user);
                    return (
                      <button
                        key={deco.id}
                        onClick={() => {
                          if (locked) {
                            toast({ title: "VIP only", description: "Buy Me a Coffee to unlock premium avatar frames." });
                            return;
                          }
                          setSelectedDecoration(deco.id);
                        }}
                        className={`neu-deco-tile ${selectedDecoration === deco.id ? "is-active" : ""} ${locked ? "opacity-50" : ""}`}
                        style={{ ["--neu-deco-delay" as any]: `${idx * 35}ms` }}
                        data-testid={`decoration-option-${deco.id}`}
                        title={locked ? `${deco.label} (VIP)` : deco.description}
                      >
                        {deco.id === "none" ? (
                          <span className="neu-deco-tile-none" />
                        ) : (
                          <span className="neu-deco-tile-preview" style={{ width: 40, height: 40, background: "transparent", boxShadow: "none" }}>
                            <ProfileDecoration decorationId={deco.id} size={40} density="reduced" soft>
                              <span className="block w-full h-full rounded-lg bg-background/80 ring-1 ring-border" />
                            </ProfileDecoration>
                          </span>
                        )}
                        <span className="neu-deco-tile-label">
                          {locked ? `🔒 ${deco.label}` : deco.label}
                        </span>
                        {selectedDecoration === deco.id && (
                          <span className="neu-deco-tile-check"><Check /></span>
                        )}
                      </button>
                    );
                  };

                  const freeFrames = SQUARE_PROFILE_STYLES.filter((d) => !d.vip);
                  const rareFrames = SQUARE_PROFILE_STYLES.filter((d) => d.vip);
                  const vipItems = PROFILE_DECORATIONS.filter((d) => d.category === "vip");

                  return (
                    <>
                      <div className="grid grid-cols-4 gap-2">
                        {freeFrames.map((d, i) => renderSquare(d, i))}
                      </div>
                      <div className="pt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-amber-300/90">
                          Rare frames
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {rareFrames.map((d, i) => renderSquare(d, i + freeFrames.length))}
                        </div>
                      </div>
                      <div className="pt-2">
                        <p
                          className="text-[11px] font-semibold uppercase tracking-wider mb-2"
                          style={{ color: "rgba(251,191,36,0.95)" }}
                          data-testid="decoration-section-vip"
                        >
                          VIP overlays
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {vipItems.map((d, i) => renderTile(d, i))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* ── Profile Card Animation ─────────────────────────────── */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Card animation</Label>
                <p className="text-xs text-muted-foreground">Halo around your voice-room card — sits on the rim, not over your photo</p>

                {/* Live preview */}
                <div className="flex justify-center mb-2 py-3">
                  <div className="relative rounded-lg overflow-visible bg-muted/30 border border-border/40" style={{ width: 72, height: 72 }}>
                    <ProfileAnimationOverlay animationId={selectedAnimation} isHost={true} />
                    <div className="absolute inset-0 flex items-center justify-center z-10 overflow-hidden rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-primary/20 ring-2 ring-primary/40 flex items-center justify-center">
                        <span className="text-lg">{PROFILE_ANIMATIONS.find(a => a.id === selectedAnimation)?.emoji ?? "👤"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {PROFILE_ANIMATIONS.map((anim, idx) => (
                    <button
                      key={anim.id}
                      onClick={() => setSelectedAnimation(anim.id)}
                      className={`neu-deco-tile ${selectedAnimation === anim.id ? "is-active" : ""}`}
                      style={{ ["--neu-deco-delay" as any]: `${idx * 30}ms` }}
                      data-testid={`animation-option-${anim.id}`}
                      title={anim.label}
                    >
                      {anim.id === "none" ? (
                        <span className="neu-deco-tile-none" />
                      ) : (
                        <span className="neu-deco-tile-preview" style={{ width: 28, height: 28, background: "transparent", boxShadow: "none", position: "relative", overflow: "hidden", borderRadius: 4 }}>
                          <span className="absolute inset-0 rounded" style={{ overflow: "hidden" }}>
                            <ProfileAnimationOverlay animationId={anim.id} isHost={true} />
                          </span>
                          <span className="relative z-10 flex items-center justify-center w-full h-full text-[13px]">
                            {anim.emoji ?? "✦"}
                          </span>
                        </span>
                      )}
                      <span className="neu-deco-tile-label">{anim.label}</span>
                      {selectedAnimation === anim.id && (
                        <span className="neu-deco-tile-check"><Check /></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <Button
            className="w-full mt-2"
            onClick={handleSaveDecorations}
            disabled={saveDecorationsMutation.isPending}
            data-testid="button-save-decorations"
          >
            {saveDecorationsMutation.isPending ? "Saving..." : "Save Decorations"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-4 h-4" /> Blocked Users
            </DialogTitle>
          </DialogHeader>
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No blocked users</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {blockedUsers.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-md border border-border">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={u.profileImageUrl || undefined} alt="" />
                    <AvatarFallback className="text-xs">{getUserInitials(u)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm flex-1 truncate">{getUserDisplayName(u)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2 flex-shrink-0"
                    onClick={() => unblockMutation.mutate(u.id)}
                    disabled={unblockMutation.isPending}
                    data-testid={`button-unblock-${u.id}`}
                  >
                    <X className="w-3 h-3 mr-1" /> Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={badgeApplyOpen} onOpenChange={setBadgeApplyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" /> Apply for a Badge
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Badge</Label>
              <Select value={requestedBadge} onValueChange={setRequestedBadge}>
                <SelectTrigger data-testid="select-apply-badge">
                  <SelectValue placeholder="Choose a badge..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(BADGE_TYPES).map((badge) => (
                    <SelectItem key={badge.id} value={badge.id} data-testid={`option-apply-badge-${badge.id}`}>
                      {badge.emoji} {badge.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Why do you deserve it?</Label>
              <Textarea
                value={badgeReason}
                onChange={(e) => setBadgeReason(e.target.value)}
                placeholder="Share your contribution, progress, or reason..."
                rows={4}
                data-testid="textarea-badge-reason"
              />
            </div>
            <Button
              className="w-full"
              disabled={!requestedBadge || badgeReason.trim().length < 10 || badgeApplicationMutation.isPending}
              onClick={() => badgeApplicationMutation.mutate()}
              data-testid="button-submit-badge-application"
            >
              {badgeApplicationMutation.isPending ? "Sending..." : "Submit Application"}
            </Button>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">My applications</p>
              {badgeApplications.length === 0 ? (
                <p className="text-xs text-muted-foreground">No badge applications yet.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {badgeApplications.map((application) => {
                    const badge = BADGE_TYPES[application.badgeType as keyof typeof BADGE_TYPES];
                    return (
                      <div key={application.id} className="flex items-center justify-between rounded-lg border border-border p-2" data-testid={`card-my-badge-application-${application.id}`}>
                        <span className="text-xs font-medium">
                          {badge?.emoji} {badge?.label || application.badgeType}
                        </span>
                        <Badge variant={application.status === "pending" ? "secondary" : application.status === "approved" ? "default" : "outline"} data-testid={`status-my-badge-application-${application.id}`}>
                          {application.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SoundFxMiniToggle() {
  const [enabled, setEnabledState] = useState<boolean>(() => isSoundEnabled());
  useEffect(() => onSoundEnabledChange(setEnabledState), []);
  const toggle = () => {
    const next = !enabled;
    setSoundEnabled(next);
    if (next) sfxToggle(true);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="orbit-mini-toggle"
      data-testid="menu-sound-fx"
      title={enabled ? "Sound effects ON — tap to mute" : "Sound effects OFF — tap to enable"}
      aria-label="Toggle sound effects"
      aria-pressed={enabled}
    >
      {enabled
        ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
        : <VolumeX className="w-3.5 h-3.5 text-amber-400" />}
    </button>
  );
}

function BoostModeMiniToggle() {
  const [enabled, setEnabledState] = useState<boolean>(() => isBoostMode());
  useEffect(() => onBoostModeChange(setEnabledState), []);
  const toggle = () => {
    const next = !enabled;
    setBoostMode(next);
    sfxToggle(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="orbit-mini-toggle"
      data-testid="menu-boost-mode"
      title={enabled ? "Boost mode ON — tap to restore full visuals" : "Boost mode OFF — tap for faster scrolling"}
      aria-label="Toggle boost mode"
      aria-pressed={enabled}
    >
      {enabled
        ? <Zap className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.6} />
        : <ZapOff className="w-3.5 h-3.5" strokeWidth={2.2} />}
    </button>
  );
}

