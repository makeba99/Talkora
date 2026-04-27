import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Hammer, X, Sparkles } from "lucide-react";
import { LANGUAGES, LEVELS } from "@shared/schema";
import { GifPickerButton } from "@/components/chat-picker";
import { NeuParticipantSlider } from "@/components/neu-participant-slider";

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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("English");
  const [level, setLevel] = useState("Beginner");
  const [maxUsers, setMaxUsers] = useState(8);
  const [isPublic, setIsPublic] = useState(true);
  const [gifUrl, setGifUrl] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setGifUrl(null);
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
      hologramVideoUrl: gifUrl,
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
              <Label className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary/80" />
                Card GIF
                <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>
              </Label>
              {gifUrl && (
                <button
                  type="button"
                  onClick={() => setGifUrl(null)}
                  className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                  data-testid="button-clear-gif"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {gifUrl ? (
                <img
                  src={gifUrl}
                  alt="Selected GIF"
                  className="w-14 h-14 rounded-md object-cover border-2 border-primary/60"
                  data-testid="img-card-gif-preview"
                />
              ) : (
                <div className="w-14 h-14 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                  No GIF
                </div>
              )}
              <div className="flex-1 flex items-center gap-2">
                <GifPickerButton onGifSelect={(url) => setGifUrl(url)} />
                <span className="text-sm text-muted-foreground">
                  {gifUrl ? "Tap GIF to change" : "Tap GIF to browse Tenor"}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Themes, backgrounds and roles are configured inside the room once you join.
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
