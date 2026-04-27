import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Hammer, Image as ImageIcon } from "lucide-react";
import { LANGUAGES, LEVELS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ROOM_THEMES } from "@/components/profile-decorations";
import { NeuParticipantSlider } from "@/components/neu-participant-slider";

interface CreateRoomDialogProps {
  onCreateRoom: (room: {
    title: string;
    language: string;
    level: string;
    maxUsers: number;
    isPublic: boolean;
    roomTheme?: string | null;
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
  const [roomTheme, setRoomTheme] = useState("none");
  const [themeOffset, setThemeOffset] = useState(0);
  const THEMES_PER_PAGE = 4;
  const [hologramFile, setHologramFile] = useState<File | null>(null);
  const [hologramPreview, setHologramPreview] = useState<string | null>(null);
  const [hologramKind, setHologramKind] = useState<"video" | "image" | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHologramFile(file);
    setHologramKind(file.type.startsWith("video/") ? "video" : "image");
    setHologramPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setTitle("");
    setRoomTheme("premium-atmosphere");
    setHologramFile(null);
    setHologramPreview(null);
    setHologramKind(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let hologramVideoUrl: string | null = null;

    if (hologramFile) {
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
        if (!res.ok) throw new Error(data?.message || "Failed to upload video");
        hologramVideoUrl = data.url;
      } catch (err: any) {
        toast({ title: err.message || "Failed to upload video", variant: "destructive" });
        setUploadingVideo(false);
        return;
      } finally {
        setUploadingVideo(false);
      }
    }

    onCreateRoom({ title: title.trim(), language, level, maxUsers, isPublic, roomTheme, hologramVideoUrl });
    resetForm();
    setOpen(false);
  };

  const languages = LANGUAGES.filter((l) => l !== "All");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          data-testid="button-create-room"
          className="hammer-btn create-room-btn h-10 px-4 font-semibold whitespace-nowrap flex-shrink-0 gap-2 rounded-md"
        >
          <Hammer className="sparkle-icon w-4 h-4" />
          Create Room
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
              <Label>Card Theme</Label>
              <span className="text-xs text-muted-foreground" data-testid="text-create-theme-selected">
                {ROOM_THEMES.find((t) => t.id === roomTheme)?.label || "Default"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setThemeOffset((o) => Math.max(0, o - THEMES_PER_PAGE))}
                disabled={themeOffset === 0}
                className="neu-tile-nav flex-shrink-0 w-7 h-12 rounded-md flex items-center justify-center"
                data-testid="button-theme-prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 grid grid-cols-4 gap-2">
                {ROOM_THEMES.slice(themeOffset, themeOffset + THEMES_PER_PAGE).map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setRoomTheme(theme.id)}
                    className={`neu-tile ${roomTheme === theme.id ? "is-active" : ""}`}
                    title={theme.label}
                    data-testid={`button-create-theme-${theme.id}`}
                  >
                    <img
                      src={theme.img}
                      alt={theme.label}
                      className="w-full h-[52px] object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        const fallback = e.currentTarget.nextSibling as HTMLElement;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                    <div className={`w-full h-[52px] bg-gradient-to-br ${theme.preview} hidden items-center justify-center`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-semibold text-white leading-none px-0.5 truncate">
                      {theme.label}
                    </span>
                    {roomTheme === theme.id && (
                      <div className="neu-tile-check">
                        <svg className="w-2 h-2" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setThemeOffset((o) => Math.min(ROOM_THEMES.length - THEMES_PER_PAGE, o + THEMES_PER_PAGE))}
                disabled={themeOffset + THEMES_PER_PAGE >= ROOM_THEMES.length}
                className="neu-tile-nav flex-shrink-0 w-7 h-12 rounded-md flex items-center justify-center"
                data-testid="button-theme-next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center gap-1.5 pt-1">
              {Array.from({ length: Math.ceil(ROOM_THEMES.length / THEMES_PER_PAGE) }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setThemeOffset(i * THEMES_PER_PAGE)}
                  className={`neu-tile-dot ${themeOffset === i * THEMES_PER_PAGE ? "is-active" : ""}`}
                  data-testid={`button-theme-page-${i}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Card Background</Label>
            <div className="flex items-center gap-3">
              {hologramPreview && (
                hologramKind === "video" ? (
                  <video
                    src={hologramPreview}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-12 h-12 rounded-md object-cover border-2 border-orange-400"
                    data-testid="video-create-preview"
                  />
                ) : (
                  <img
                    src={hologramPreview}
                    alt="Background preview"
                    className="w-12 h-12 rounded-md object-cover border-2 border-orange-400"
                    data-testid="img-create-preview"
                  />
                )
              )}
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="neu-upload-btn flex-1 flex items-center justify-center gap-2 text-sm font-medium"
                data-testid="button-create-upload-video"
              >
                <ImageIcon className="w-4 h-4" />
                {hologramFile ? "Change Background" : "Upload Video, GIF or Image"}
              </button>
              {hologramFile && (
                <button
                  type="button"
                  onClick={() => {
                    setHologramFile(null);
                    setHologramPreview(null);
                    setHologramKind(null);
                  }}
                  className="text-xs text-destructive hover:underline"
                  data-testid="button-create-clear-video"
                >
                  Remove
                </button>
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleVideoSelect}
                data-testid="input-create-video-file"
              />
            </div>
          </div>

          <button
            type="submit"
            className="neu-submit"
            disabled={!title.trim() || isPending || uploadingVideo}
            data-testid="button-submit-room"
          >
            {isPending || uploadingVideo ? "Creating..." : "Create Room"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
