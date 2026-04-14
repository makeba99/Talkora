import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Link, Loader2, Plus, Search, Video, X, Youtube } from "lucide-react";
import { LANGUAGES, LEVELS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const ROOM_THEMES = [
  { id: "premium-atmosphere", label: "Premium Atmosphere", preview: "from-cyan-400 via-fuchsia-500 to-orange-400" },
  { id: "cosmic", label: "Cosmic", preview: "from-blue-600 via-purple-500 to-red-500" },
  { id: "plasma", label: "Plasma", preview: "from-pink-500 via-purple-600 to-indigo-500" },
  { id: "hologram", label: "Hologram", preview: "from-cyan-400 via-teal-500 to-emerald-400" },
  { id: "inferno", label: "Inferno", preview: "from-orange-600 via-red-500 to-yellow-400" },
  { id: "default", label: "Default", preview: "from-cyan-500 to-purple-500" },
  { id: "neon", label: "Neon", preview: "from-cyan-400 to-purple-500" },
  { id: "galaxy", label: "Galaxy", preview: "from-indigo-500 to-purple-700" },
  { id: "sunset", label: "Sunset", preview: "from-orange-400 to-red-500" },
  { id: "forest", label: "Forest", preview: "from-green-400 to-emerald-600" },
  { id: "cyberpunk", label: "Cyberpunk", preview: "from-yellow-400 to-cyan-400" },
  { id: "ocean", label: "Ocean", preview: "from-blue-400 to-cyan-600" },
  { id: "cherry", label: "Cherry", preview: "from-pink-400 to-rose-500" },
  { id: "gold", label: "Gold", preview: "from-yellow-300 to-amber-500" },
  { id: "violet", label: "Violet", preview: "from-violet-400 to-fuchsia-600" },
  { id: "aurora", label: "Aurora", preview: "from-teal-400 to-green-400" },
  { id: "matrix", label: "Matrix", preview: "from-green-400 to-green-700" },
  { id: "storm", label: "Storm", preview: "from-blue-500 to-slate-600" },
  { id: "volcanic", label: "Volcanic", preview: "from-red-500 to-orange-400" },
];

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
        <Button data-testid="button-create-room">
          <Plus className="w-4 h-4 mr-2" />
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
            <Label>Card Theme</Label>
            <div className="grid grid-cols-5 gap-2">
              {ROOM_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setRoomTheme(theme.id)}
                  className={`relative h-8 rounded-md bg-gradient-to-br ${theme.preview} transition-all ${roomTheme === theme.id ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-105" : "opacity-70 hover:opacity-100"}`}
                  title={theme.label}
                  data-testid={`button-create-theme-${theme.id}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground" data-testid="text-create-theme-selected">
              Selected: {ROOM_THEMES.find((t) => t.id === roomTheme)?.label || "Default"}
            </p>
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
