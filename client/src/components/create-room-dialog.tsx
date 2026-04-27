import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Hammer, X, Sparkles, Upload, Loader2 } from "lucide-react";
import { LANGUAGES, LEVELS } from "@shared/schema";
import { GifPickerButton } from "@/components/chat-picker";
import { NeuParticipantSlider } from "@/components/neu-participant-slider";
import { useToast } from "@/hooks/use-toast";

interface CreateRoomDialogProps {
  onCreateRoom: (room: {
    title: string;
    language: string;
    level: string;
    maxUsers: number;
    isPublic: boolean;
    hologramVideoUrl?: string | null;
  }) => void;
  isPending?: boolean;
}

export function CreateRoomDialog({ onCreateRoom, isPending }: CreateRoomDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
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
    if (!title.trim()) return;
    onCreateRoom({
      title: title.trim(),
      language,
      level,
      maxUsers,
      isPublic,
      hologramVideoUrl: mediaUrl,
    });
    resetForm();
    setOpen(false);
  };

  const languages = LANGUAGES.filter((l) => l !== "All");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          data-testid="button-create-room"
          className="create-room-neu hammer-btn font-semibold whitespace-nowrap flex-shrink-0 rounded-full"
          aria-label="Create Room"
          title="Create Room"
        >
          <span className="create-room-neu-icon">
            <Hammer className="sparkle-icon w-[14px] h-[14px]" />
          </span>
          <span className="create-room-neu-label">Create Room</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create a Voice Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-title">Room Name</Label>
            <Input
              id="room-title"
              data-testid="input-room-title"
              placeholder="e.g. English Beginners Chat"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger data-testid="select-language">
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
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger data-testid="select-level">
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
              Pick a GIF from Tenor or upload your own picture / short video. Themes and host controls are set inside the room.
            </p>
          </div>

          <button
            type="submit"
            className="neu-submit"
            disabled={!title.trim() || isPending}
            data-testid="button-submit-room"
          >
            {isPending ? "Creating..." : "Create Room"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
