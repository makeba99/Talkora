import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Settings, LogOut, Camera, ChevronDown, Check, Sparkles, ZoomIn, Ban, X, Bell, EyeOff, Eye, Award } from "lucide-react";
import { SiInstagram, SiLinkedin, SiFacebook } from "react-icons/si";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/lib/socket";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PROFILE_DECORATIONS, ProfileDecoration } from "@/components/profile-decorations";
import { BADGE_TYPES } from "@shared/schema";

export const AVATAR_RINGS = [
  { id: "none", label: "None", className: "" },
  { id: "pulse-cyan", label: "Pulse Cyan", className: "animate-pulse ring-2 ring-cyan-400" },
  { id: "pulse-purple", label: "Pulse Purple", className: "animate-pulse ring-2 ring-purple-400" },
  { id: "glow-gold", label: "Glow Gold", className: "ring-2 ring-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" },
  { id: "glow-green", label: "Glow Green", className: "ring-2 ring-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" },
  { id: "glow-pink", label: "Glow Pink", className: "ring-2 ring-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.6)]" },
  { id: "rainbow", label: "Rainbow", className: "ring-2 ring-transparent bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 bg-clip-border" },
  { id: "fire", label: "Fire", className: "ring-2 ring-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.7)] animate-pulse" },
  { id: "ice", label: "Ice", className: "ring-2 ring-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.6)]" },
] as const;

export const FLAIR_BADGES = [
  { id: "none", label: "None", icon: null },
  { id: "crown", label: "Crown", icon: "crown" },
  { id: "star", label: "Star", icon: "star" },
  { id: "lightning", label: "Lightning", icon: "lightning" },
  { id: "heart", label: "Heart", icon: "heart" },
  { id: "diamond", label: "Diamond", icon: "diamond" },
  { id: "cat", label: "Cat", icon: "cat" },
  { id: "dog", label: "Dog", icon: "dog" },
  { id: "bear", label: "Bear", icon: "bear" },
  { id: "fox", label: "Fox", icon: "fox" },
  { id: "wolf", label: "Wolf", icon: "wolf" },
  { id: "panda", label: "Panda", icon: "panda" },
] as const;

export function getAvatarRingClass(ringId: string | null | undefined): string {
  if (!ringId || ringId === "none") return "";
  const ring = AVATAR_RINGS.find(r => r.id === ringId);
  return ring?.className || "";
}

export function getFlairIcon(badgeId: string | null | undefined): string | null {
  if (!badgeId || badgeId === "none") return null;
  const badge = FLAIR_BADGES.find(b => b.id === badgeId);
  return badge?.icon || null;
}

const FLAIR_ICON_MAP: Record<string, string> = {
  crown: "\u{1F451}",
  star: "\u2B50",
  lightning: "\u26A1",
  heart: "\u2764\uFE0F",
  diamond: "\u{1F48E}",
  cat: "\u{1F431}",
  dog: "\u{1F436}",
  bear: "\u{1F43B}",
  fox: "\u{1F98A}",
  wolf: "\u{1F43A}",
  panda: "\u{1F43C}",
};

export function FlairBadgeDisplay({ badgeId, className }: { badgeId: string | null | undefined; className?: string }) {
  const icon = getFlairIcon(badgeId);
  if (!icon) return null;
  const emoji = FLAIR_ICON_MAP[icon];
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
}

export function ProfileDropdown({ onOpenTheme, onOpenNotifications }: ProfileDropdownProps = {}) {
  const { user, logout } = useAuth();
  const { appearOffline, setAppearOffline } = useSocket();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [badgeApplyOpen, setBadgeApplyOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [selectedRing, setSelectedRing] = useState<string>("none");
  const [selectedFlair, setSelectedFlair] = useState<string>("none");
  const [selectedDecoration, setSelectedDecoration] = useState<string>("none");
  const [requestedBadge, setRequestedBadge] = useState("");
  const [badgeReason, setBadgeReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImgSrc, setCropImgSrc] = useState("");

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName?: string; bio?: string; instagramUrl?: string; linkedinUrl?: string; facebookUrl?: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setEditOpen(false);
      toast({ title: "Profile updated" });
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
    },
    onError: () => {
      toast({ title: "Failed to unblock user", variant: "destructive" });
    },
  });

  const saveDecorationsMutation = useMutation({
    mutationFn: async (data: { avatarRing?: string; flairBadge?: string; profileDecoration?: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSettingsOpen(false);
      toast({ title: "Settings saved" });
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
    },
    onError: (err: any) => {
      toast({ title: "Could not apply", description: err?.message, variant: "destructive" });
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
    setEditOpen(true);
  };

  const handleOpenSettings = () => {
    setSelectedRing(user?.avatarRing || "none");
    setSelectedFlair(user?.flairBadge || "none");
    setSelectedDecoration((user as any)?.profileDecoration || "none");
    setSettingsOpen(true);
  };

  const handleSaveDecorations = () => {
    saveDecorationsMutation.mutate({
      avatarRing: selectedRing,
      flairBadge: "none",
      profileDecoration: selectedDecoration,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2" data-testid="button-profile-dropdown">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:inline truncate max-w-24" data-testid="text-current-user">
              {getUserDisplayName(user)}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-3 border-b border-border bg-muted/30">
            <div className="relative flex-shrink-0">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-sm bg-primary/10 text-primary">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <span
                className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background"
                style={{
                  background: appearOffline ? "#6b7280" : "#22c55e",
                  boxShadow: appearOffline ? "none" : "0 0 6px rgba(34,197,94,0.7)",
                }}
                data-testid="status-dot-dropdown"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" data-testid="text-dropdown-user-name">{getUserDisplayName(user)}</p>
              <p className="text-xs truncate" data-testid="text-dropdown-status"
                style={{ color: appearOffline ? "rgba(251,191,36,0.85)" : "rgba(34,197,94,0.85)" }}
              >
                {appearOffline ? "Appearing offline" : "Online"}
              </p>
            </div>
          </div>
          <div className="p-1">
            <DropdownMenuItem onClick={handleOpenEdit} data-testid="menu-edit-profile">
              <User className="w-4 h-4 mr-2" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenSettings} data-testid="menu-settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { onOpenNotifications?.(); }}
              data-testid="menu-notifications"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setBadgeApplyOpen(true)}
              data-testid="menu-apply-badge"
            >
              <Award className="w-4 h-4 mr-2" />
              Apply for Badge
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setBlockedOpen(true)}
              data-testid="menu-blocked-users"
            >
              <Ban className="w-4 h-4 mr-2" />
              Blocked Users
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setAppearOffline(!appearOffline)}
              data-testid="menu-appear-offline"
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  {appearOffline
                    ? <EyeOff className="w-4 h-4 mr-2 text-amber-400" />
                    : <Eye className="w-4 h-4 mr-2" />
                  }
                  <span className={appearOffline ? "text-amber-400" : ""}>
                    Appear Offline
                  </span>
                </div>
                <div
                  className="relative ml-3 flex-shrink-0 w-8 h-4 rounded-full transition-colors duration-200"
                  style={{
                    background: appearOffline
                      ? "rgba(251,191,36,0.85)"
                      : "rgba(255,255,255,0.15)",
                    border: appearOffline
                      ? "1px solid rgba(251,191,36,0.5)"
                      : "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <span
                    className="absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200"
                    style={{
                      background: "#fff",
                      left: appearOffline ? "calc(100% - 14px)" : "2px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  />
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-destructive focus:text-destructive"
              data-testid="menu-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

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
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-3 h-3" />
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
                    <SiLinkedin className="w-4 h-4 text-blue-600 flex-shrink-0" />
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
              </div>

              <Button
                className="w-full"
                onClick={() => updateProfileMutation.mutate({ displayName, bio, instagramUrl, linkedinUrl, facebookUrl })}
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
              <div className="space-y-3">
                <Label className="text-sm font-medium">Avatar Ring</Label>
                <div className="flex justify-center mb-3">
                  <ProfileDecoration decorationId={selectedDecoration} size={64}>
                    <div className={`rounded-full p-0.5 ${getAvatarRingClass(selectedRing)}`}>
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={user?.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xl bg-primary/10 text-primary">
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
                  {AVATAR_RINGS.map((ring, idx) => (
                    <button
                      key={ring.id}
                      onClick={() => setSelectedRing(ring.id)}
                      className={`neu-deco-tile ${selectedRing === ring.id ? "is-active" : ""}`}
                      style={{ ["--neu-deco-delay" as any]: `${idx * 35}ms` }}
                      data-testid={`ring-option-${ring.id}`}
                      title={ring.label}
                    >
                      {ring.id === "none" ? (
                        <span className="neu-deco-tile-none" />
                      ) : (
                        <span className="neu-deco-tile-preview">
                          <span className={`block w-5 h-5 rounded-full bg-background ${ring.className}`} />
                        </span>
                      )}
                      <span className="neu-deco-tile-label">{ring.label}</span>
                      {selectedRing === ring.id && (
                        <span className="neu-deco-tile-check"><Check /></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Animated Decoration</Label>
                <p className="text-xs text-muted-foreground">Animated effects around your avatar in rooms</p>

                {(() => {
                  // Render decorations grouped by category. "core" (None) sits
                  // up top; "professional" comes next with a section header so
                  // serious users can find polished options without wading
                  // through emoji-heavy ones; "expressive" follows.
                  const renderTile = (deco: typeof PROFILE_DECORATIONS[number], idx: number) => {
                    const labelText = deco.label.replace(/^[\p{Emoji}\s]+/u, "").trim() || deco.label;
                    const emojiMatch = deco.label.match(/^(\p{Emoji}+)/u);
                    const emoji = emojiMatch ? emojiMatch[1] : null;
                    return (
                      <button
                        key={deco.id}
                        onClick={() => setSelectedDecoration(deco.id)}
                        className={`neu-deco-tile ${selectedDecoration === deco.id ? "is-active" : ""}`}
                        style={{ ["--neu-deco-delay" as any]: `${idx * 35}ms` }}
                        data-testid={`decoration-option-${deco.id}`}
                        title={labelText}
                      >
                        {deco.id === "none" ? (
                          <span className="neu-deco-tile-none" />
                        ) : (
                          <span className="neu-deco-tile-preview" style={{ width: 36, height: 36, background: "transparent", boxShadow: "none" }}>
                            <ProfileDecoration decorationId={deco.id} size={36}>
                              <span className="block w-5 h-5 rounded-full bg-background/80 ring-1 ring-border" />
                            </ProfileDecoration>
                          </span>
                        )}
                        <span className="neu-deco-tile-label">
                          {emoji ? `${emoji} ${labelText}` : labelText}
                        </span>
                        {selectedDecoration === deco.id && (
                          <span className="neu-deco-tile-check"><Check /></span>
                        )}
                      </button>
                    );
                  };

                  const coreItems = PROFILE_DECORATIONS.filter(d => d.category === "core");
                  const professionalItems = PROFILE_DECORATIONS.filter(d => d.category === "professional");
                  const expressiveItems = PROFILE_DECORATIONS.filter(d => d.category === "expressive");

                  return (
                    <>
                      {/* None tile */}
                      <div className="grid grid-cols-4 gap-2">
                        {coreItems.map((d, i) => renderTile(d, i))}
                      </div>

                      {/* Professional section */}
                      <div className="pt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2" data-testid="decoration-section-professional">
                          Professional
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {professionalItems.map((d, i) => renderTile(d, i + coreItems.length))}
                        </div>
                      </div>

                      {/* Expressive section */}
                      <div className="pt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2" data-testid="decoration-section-expressive">
                          Expressive
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {expressiveItems.map((d, i) => renderTile(d, i + coreItems.length + professionalItems.length))}
                        </div>
                      </div>
                    </>
                  );
                })()}
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
                    <AvatarImage src={u.profileImageUrl || undefined} />
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
