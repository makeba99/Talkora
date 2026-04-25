import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Link, Loader2, Search, Sparkles, Video, X, Youtube } from "lucide-react";
import { LANGUAGES, LEVELS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ROOM_THEMES } from "@/components/profile-decorations";

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function buildYoutubeEmbed(id: string) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0`;
}

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
  const [roomTheme, setRoomTheme] = useState("premium-atmosphere");
  const [themeOffset, setThemeOffset] = useState(0);
  const THEMES_PER_PAGE = 4;
  const [videoTab, setVideoTab] = useState<"upload" | "youtube">("upload");
  const [hologramFile, setHologramFile] = useState<File | null>(null);
  const [hologramPreview, setHologramPreview] = useState<string | null>(null);
  const [ytLinkInput, setYtLinkInput] = useState("");
  const [ytSearchQuery, setYtSearchQuery] = useState("");
  const [ytSearchResults, setYtSearchResults] = useState<any[]>([]);
  const [selectedYtId, setSelectedYtId] = useState<string | null>(null);
  const [ytSearching, setYtSearching] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const ytSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleYtSearch = async (query: string) => {
    if (!query.trim()) {
      setYtSearchResults([]);
      return;
    }
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
    setSelectedYtId(null);
    setYtLinkInput("");
    setHologramPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setTitle("");
    setRoomTheme("premium-atmosphere");
    setHologramFile(null);
    setHologramPreview(null);
    setYtLinkInput("");
    setYtSearchQuery("");
    setYtSearchResults([]);
    setSelectedYtId(null);
    setVideoTab("upload");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let hologramVideoUrl: string | null = null;

    if (videoTab === "youtube") {
      const ytId = selectedYtId || extractYoutubeId(ytLinkInput.trim());
      if (ytId) hologramVideoUrl = buildYoutubeEmbed(ytId);
      if (ytLinkInput.trim() && !ytId && !selectedYtId) {
        toast({ title: "Please paste a valid YouTube link", variant: "destructive" });
        return;
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
          className="hammer-btn h-10 px-4 font-semibold whitespace-nowrap flex-shrink-0 gap-2"
          style={{
            background: "linear-gradient(135deg, hsl(235 72% 54%) 0%, hsl(252 65% 38%) 100%)",
            border: "1px solid rgba(100,80,230,0.42)",
            color: "#fff",
          }}
        >
          <Sparkles className="sparkle-icon w-4 h-4" />
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
            <Select value={String(maxUsers)} onValueChange={(v) => setMaxUsers(Number(v))}>
              <SelectTrigger data-testid="select-max-users">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 6, 8, 10, 12].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} people
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="public-toggle">Public Room</Label>
            <Switch
              id="public-toggle"
              data-testid="switch-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
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
                className="flex-shrink-0 w-7 h-12 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                    className={`relative rounded-lg overflow-hidden transition-all border-2 ${roomTheme === theme.id ? "border-white shadow-lg" : "border-transparent opacity-70 hover:opacity-100"}`}
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
                      <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-white flex items-center justify-center">
                        <svg className="w-1.5 h-1.5" viewBox="0 0 12 12" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                className="flex-shrink-0 w-7 h-12 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                data-testid="button-theme-next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center gap-1">
              {Array.from({ length: Math.ceil(ROOM_THEMES.length / THEMES_PER_PAGE) }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setThemeOffset(i * THEMES_PER_PAGE)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${themeOffset === i * THEMES_PER_PAGE ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"}`}
                  data-testid={`button-theme-page-${i}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Card Background Video</Label>
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setVideoTab("upload")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${videoTab === "upload" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                data-testid="button-create-video-upload-tab"
              >
                <Video className="w-3 h-3" /> Upload File
              </button>
              <button
                type="button"
                onClick={() => setVideoTab("youtube")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${videoTab === "youtube" ? "bg-red-600 text-white" : "hover:bg-muted"}`}
                data-testid="button-create-video-youtube-tab"
              >
                <Youtube className="w-3 h-3" /> YouTube
              </button>
            </div>

            {videoTab === "upload" && (
              <div className="flex items-center gap-3">
                {hologramPreview && (
                  <video
                    src={hologramPreview}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-12 h-12 rounded-md object-cover border-2 border-cyan-400"
                    data-testid="video-create-preview"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2"
                  data-testid="button-create-upload-video"
                >
                  <Video className="w-4 h-4" />
                  {hologramFile ? "Change File" : "Upload Video"}
                </Button>
                {hologramFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setHologramFile(null);
                      setHologramPreview(null);
                    }}
                    className="text-xs text-destructive hover:underline"
                    data-testid="button-create-clear-video"
                  >
                    Remove
                  </button>
                )}
                <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleVideoSelect} data-testid="input-create-video-file" />
              </div>
            )}

            {videoTab === "youtube" && (
              <div className="space-y-2">
                <div className="relative">
                  <Link className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Paste YouTube URL..."
                    value={ytLinkInput}
                    onChange={(e) => {
                      setYtLinkInput(e.target.value);
                      setSelectedYtId(null);
                    }}
                    className="pl-8 text-sm h-8"
                    data-testid="input-create-youtube-url"
                  />
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                  <Input
                    placeholder="Or search YouTube..."
                    value={ytSearchQuery}
                    onChange={(e) => handleYtSearchInput(e.target.value)}
                    className="pl-8 text-sm h-8"
                    data-testid="input-create-youtube-search"
                  />
                  {ytSearching && <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin z-10" />}
                  {ytSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg max-h-44 overflow-y-auto">
                      {ytSearchResults.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedYtId(v.id);
                            setYtSearchResults([]);
                            setYtSearchQuery(v.title);
                            setYtLinkInput("");
                            setHologramFile(null);
                            setHologramPreview(null);
                          }}
                          className={`w-full flex items-center gap-2 p-1.5 text-left text-xs transition-colors hover:bg-muted ${selectedYtId === v.id ? "bg-red-500/10" : ""}`}
                          data-testid={`button-create-youtube-result-${v.id}`}
                        >
                          <img src={v.thumbnail?.url || v.thumbnail || `https://img.youtube.com/vi/${v.id}/default.jpg`} className="w-10 h-7 object-cover rounded flex-shrink-0" alt="" />
                          <span className="truncate">{v.title}</span>
                          {selectedYtId === v.id && <Youtube className="w-3 h-3 text-red-500 flex-shrink-0 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedYtId && (
                  <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-md border border-red-500/30" data-testid="status-create-youtube-selected">
                    <img src={`https://img.youtube.com/vi/${selectedYtId}/default.jpg`} className="w-10 h-7 object-cover rounded" alt="" />
                    <span className="text-xs flex-1">YouTube video selected</span>
                    <button type="button" onClick={() => setSelectedYtId(null)} className="text-muted-foreground hover:text-foreground" data-testid="button-create-clear-youtube"><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!title.trim() || isPending || uploadingVideo}
            data-testid="button-submit-room"
          >
            {isPending || uploadingVideo ? "Creating..." : "Create Room"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
