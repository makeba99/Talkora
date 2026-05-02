import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { LANGUAGES, LEVELS } from "@shared/schema";

interface CreateRoomDialogProps {
  onCreateRoom: (room: {
    title: string;
    language: string;
    level: string;
    maxUsers: number;
    isPublic: boolean;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreateRoom({ title: title.trim(), language, level, maxUsers, isPublic });
    setTitle("");
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
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
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
                {[2, 4, 6, 8, 10, 12].map((n) => (
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

          <Button
            type="submit"
            className="w-full"
            disabled={!title.trim() || isPending}
            data-testid="button-submit-room"
          >
            {isPending ? "Creating..." : "Create Room"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
