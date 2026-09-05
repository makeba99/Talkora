import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Hammer, X, Sparkles, Upload, Loader2 } from "lucide-react";
import { LANGUAGES, LEVELS } from "@shared/constants";
import { GifPickerButton } from "@/components/chat-picker";
import { NeuParticipantSlider } from "@/components/neu-participant-slider";
import { TitleAppearancePicker } from "@/components/title-appearance-picker";
import { useToast } from "@/hooks/use-toast";

interface CreateRoomDialogProps {
  onCreateRoom: (room: {
    title: string;
    language: string;
    level: string;
    maxUsers: number;
    isPublic: boolean;
    hologramVideoUrl?: string | null;
    titleColor?: string | null;
    titleStyle?: string | null;
    lobbyProfileStyle?: string;
  }) => void;
  isPending?: boolean;
  mobileFab?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateRoomDialog({ onCreateRoom, isPending, mobileFab, open: controlledOpen, onOpenChange: controlledOnOpenChange }: CreateRoomDialogProps) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (v: boolean) => controlledOnOpenChange?.(v)
    : setInternalOpen;
  const [title, setTitle] = useState("");
  const [titleColor, setTitleColor] = useState("");
  const [titleStyle, setTitleStyle] = useState("normal");
  const [language, setLanguage] = useState("English");
  const [level, setLevel] = useState("Beginner");
  const [maxUsers, setMaxUsers] = useState(8);
  const [isPublic, setIsPublic] = useState(true);
  // mediaUrl is the chosen card hologram. It can come from either the Tenor
  // GIF picker or a direct upload (image / GIF / short video). Whichever the
  // host selects last wins, since the card slot only shows one piece of media.
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"gif" | "image" | "video">("gif");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle("");
    setTitleColor("");
    setTitleStyle("normal");
    setMediaUrl(null);
    setMediaKind("gif");
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File too large", description: "Pick a file under 25 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", file);
      const res = await fetch("/api/upload/hologram", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upload failed");
      setMediaUrl(data.url);
      setMediaKind(file.type.startsWith("video/") ? "video" : file.type === "image/gif" ? "gif" : "image");
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    import("@/lib/sound-fx").then((s) => s.sfxBuildRoom()).catch(() => {});
    onCreateRoom({
      title: title.trim(),
      language,
      level,
      maxUsers,
      isPublic,
      hologramVideoUrl: mediaUrl,
      titleColor: titleColor || null,
      titleStyle: titleStyle !== "normal" ? titleStyle : null,
      lobbyProfileStyle: "tile",
    });
    resetForm();
    setOpen(false);
  };

  const languages = LANGUAGES.filter((l) => l !== "All");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mobileFab ? (
          <button
            type="button"
            data-testid="button-create-room-fab"
            className="create-room-fab"
            aria-label="Create Room"
          >
            <span className="create-room-fab-orb">
              <Hammer className="w-[18px] h-[18px]" style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.7))" }} />
            </span>
            <span>Create Room</span>
          </button>
        ) : (
          <button
            type="button"
            data-testid="button-create-room"
            className="hammer-btn cr-shimmer"
            aria-label="Create Room"
            title="Create Room"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              height: "36px",
              padding: "4px 16px 4px 5px",
              border: "none",
              borderRadius: "999px",
              cursor: "pointer",
              fontFamily: "inherit",
              background: "linear-gradient(175deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 22%, rgba(255,255,255,0) 45%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.40) 100%), linear-gradient(180deg, hsl(255 40% 12%) 0%, hsl(255 35% 5%) 100%)",
              boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.28), inset 1px 0 0 rgba(255,255,255,0.05), inset -1px 0 0 rgba(255,255,255,0.03), inset 0 -1.5px 0 rgba(0,0,0,0.85), 0 0 0 1px rgba(140,100,255,0.18), 0 2px 4px rgba(0,0,0,0.65), 0 8px 24px -6px rgba(0,0,0,0.80), 0 0 18px -4px rgba(120,80,255,0.20)",
              color: "rgba(255,255,255,0.95)",
              textShadow: "0 1px 3px rgba(0,0,0,0.85)",
              transition: "transform 200ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 260ms cubic-bezier(0.2,0.8,0.2,1)",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "inset 0 1.5px 0 rgba(255,255,255,0.35), inset 1px 0 0 rgba(255,255,255,0.07), inset -1px 0 0 rgba(255,255,255,0.04), inset 0 -1.5px 0 rgba(0,0,0,0.85), 0 0 0 1px rgba(160,120,255,0.30), 0 3px 8px rgba(0,0,0,0.70), 0 14px 32px -6px rgba(0,0,0,0.85), 0 0 28px -4px rgba(140,100,255,0.35)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "inset 0 1.5px 0 rgba(255,255,255,0.28), inset 1px 0 0 rgba(255,255,255,0.05), inset -1px 0 0 rgba(255,255,255,0.03), inset 0 -1.5px 0 rgba(0,0,0,0.85), 0 0 0 1px rgba(140,100,255,0.18), 0 2px 4px rgba(0,0,0,0.65), 0 8px 24px -6px rgba(0,0,0,0.80), 0 0 18px -4px rgba(120,80,255,0.20)";
            }}
            onMouseDown={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0) scale(0.985)";
            }}
            onMouseUp={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            }}
          >
            <span style={{
              flexShrink: 0,
              width: "26px",
              height: "26px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "999px",
              background: "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 52%), linear-gradient(180deg, hsl(255 40% 24%) 0%, hsl(255 35% 12%) 100%)",
              boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.72), inset 0 0 0 1px rgba(255,255,255,0.09), 0 0 0 1px rgba(0,0,0,0.65), 0 3px 8px rgba(0,0,0,0.70), 0 0 10px rgba(120,80,255,0.25)",
              color: "rgba(255,255,255,0.92)",
            }}>
              <Hammer className="sparkle-icon w-[14px] h-[14px]" />
            </span>
            <span style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "rgba(255,255,255,0.95)",
              letterSpacing: "0.02em",
              textShadow: "0 1px 3px rgba(0,0,0,0.85)",
            }}>Create Room</span>
          </button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md flex flex-col gap-0 p-0"
        style={{ maxHeight: "min(90svh, 640px)" }}
        aria-describedby={undefined}
      >
        {/* Sticky header */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/40">
          <DialogTitle>Create a Voice Room</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-4 min-h-0">
          <div className="space-y-2">
            <Label htmlFor="room-title">
              Room Name <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="room-title"
              data-testid="input-room-title"
              placeholder="Leave blank for no title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
            />
          </div>

          <TitleAppearancePicker
            color={titleColor}
            style={titleStyle}
            previewText={title}
            onColorChange={setTitleColor}
            onStyleChange={setTitleStyle}
            testIdPrefix="create-room-title"
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-room-language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="create-room-language" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-room-level">Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="create-room-level" data-testid="select-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {lvl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Max Participants</Label>
            <NeuParticipantSlider
              value={maxUsers}
              onChange={setMaxUsers}
              testId="slider-max-users"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="public-toggle">Public Room</Label>
            <Switch
              id="public-toggle"
              data-testid="switch-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              className="neu-switch"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary/80" />
                Card Media
                <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>
              </Label>
              {mediaUrl && !uploading && (
                <button
                  type="button"
                  onClick={() => { setMediaUrl(null); setMediaKind("gif"); }}
                  className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                  data-testid="button-clear-card-media"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {mediaUrl ? (
                mediaKind === "video" ? (
                  <video
                    src={mediaUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-14 h-14 rounded-md object-cover border-2 border-primary/60"
                    data-testid="video-card-media-preview"
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt="Selected media"
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-md object-cover border-2 border-primary/60"
                    data-testid="img-card-media-preview"
                  />
                )
              ) : (
                <div className="w-14 h-14 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Empty"}
                </div>
              )}
              <div className="flex-1 grid grid-cols-2 gap-2">
                <GifPickerButton
                  onGifSelect={(url) => { setMediaUrl(url); setMediaKind("gif"); }}
                  side="bottom"
                  align="start"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="neu-upload-btn flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50"
                  data-testid="button-upload-card-media"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFilePick}
                  data-testid="input-card-media-file"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Pick a GIF or upload your own picture / short video. Themes and host controls are set inside the room.
            </p>
          </div>
        </div>

        {/* Pinned footer with submit */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-border/40">
          <button
            type="button"
            onClick={handleSubmit}
            className="neu-submit w-full"
            disabled={isPending}
            data-testid="button-submit-room"
          >
            {isPending ? "Creating..." : "Create Room"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
