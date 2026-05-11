/**
 * RoomEditDialog — lazy-loaded edit sheet for room settings.
 *
 * Extracted from room-card.tsx so the ~300 lines of form JSX are NOT parsed
 * during the initial lobby render. The chunk is fetched only when a room owner
 * clicks the gear icon, removing ~20 KiB from the lobby's critical parse path.
 */
import { useState, useRef, lazy, Suspense, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, X, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LANGUAGES, LEVELS } from "@shared/constants";

const GifPickerButton = lazy(() =>
  import("@/components/chat-picker").then((m) => ({ default: m.GifPickerButton }))
);
const NeuParticipantSlider = lazy(() =>
  import("@/components/neu-participant-slider").then((m) => ({ default: m.NeuParticipantSlider }))
);

interface RoomEditDialogProps {
  room: {
    id: string;
    title: string;
    language: string;
    level: string;
    maxUsers: number;
    hologramVideoUrl?: string | null;
  };
  onClose: () => void;
}

export function RoomEditDialog({ room, onClose }: RoomEditDialogProps) {
  const { toast } = useToast();
  const languages = LANGUAGES.filter((l) => l !== "All");

  const [editTitle, setEditTitle] = useState(room.title);
  const [editLanguage, setEditLanguage] = useState(room.language);
  const [editLevel, setEditLevel] = useState(room.level);
  const [editMaxUsers, setEditMaxUsers] = useState(room.maxUsers);
  const [editHologramUrl, setEditHologramUrl] = useState<string | null>(
    room.hologramVideoUrl ?? null
  );
  const [editHologramKind, setEditHologramKind] = useState<"gif" | "image" | "video">(() => {
    const u = room.hologramVideoUrl || "";
    if (!u) return "gif";
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return "video";
    if (/\.gif(\?|$)/i.test(u) || /tenor\.com|giphy\.com/i.test(u)) return "gif";
    return "image";
  });
  const [editHologramUploading, setEditHologramUploading] = useState(false);
  const editHologramFileRef = useRef<HTMLInputElement>(null);

  const handleEditHologramFilePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File too large", description: "Pick a file under 25 MB.", variant: "destructive" });
      return;
    }
    setEditHologramUploading(true);
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
      setEditHologramUrl(data.url);
      setEditHologramKind(file.type.startsWith("video/") ? "video" : file.type === "image/gif" ? "gif" : "image");
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setEditHologramUploading(false);
    }
  };

  const editMutation = useMutation({
    mutationFn: async (data: { title: string; language: string; level: string; maxUsers: number; hologramVideoUrl: string | null }) => {
      const res = await apiRequest("PATCH", `/api/rooms/${room.id}`, data);
      return res.json();
    },
    onSuccess: (updatedRoom, variables) => {
      // Patch the cache immediately so the GIF/background shows without
      // waiting for the SSE round-trip. Prefer the server's response when
      // available, fall back to the variables we sent.
      // Do NOT call invalidateQueries — the server emits room:updated via
      // socket AND broadcastRooms() via SSE, both of which already sync all
      // clients in real time. A redundant invalidation races against those
      // updates and is the reason GIF backgrounds don't appear until refresh.
      const patch = updatedRoom ?? variables;
      queryClient.setQueryData(["/api/rooms"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((r: any) =>
          r.id === room.id ? { ...r, ...patch } : r
        );
      });
      // Cancel any in-flight /api/rooms/mine refetch and immediately sync it
      // with the mutation result. A stale background refetch that was already
      // in-flight (triggered by a 30s stale-timer or window-focus event) can
      // complete AFTER onSuccess and overwrite hologramVideoUrl back to null
      // in the /api/rooms cache via the myOwnRooms useEffect in lobby.tsx.
      queryClient.cancelQueries({ queryKey: ["/api/rooms/mine"] });
      queryClient.setQueryData(["/api/rooms/mine"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((r: any) => r.id === room.id ? { ...r, ...patch } : r);
      });
      toast({ title: "Room settings saved!" });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    editMutation.mutate({
      title: editTitle.trim(),
      language: editLanguage,
      level: editLevel,
      maxUsers: editMaxUsers,
      hologramVideoUrl: editHologramUrl,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-md flex flex-col gap-0 p-0"
        style={{ maxHeight: "min(90svh, 640px)" }}
        aria-describedby={undefined}
      >
        {/* Sticky header */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/40">
          <DialogTitle>Edit Room Settings</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-4 min-h-0">
            <div className="space-y-2">
              <Label htmlFor="edit-room-title">Room Name</Label>
              <Input
                id="edit-room-title"
                data-testid="input-edit-room-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-room-language">Language</Label>
                <Select value={editLanguage} onValueChange={setEditLanguage}>
                  <SelectTrigger id="edit-room-language" data-testid="select-edit-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-room-level">Level</Label>
                <Select value={editLevel} onValueChange={setEditLevel}>
                  <SelectTrigger id="edit-room-level" data-testid="select-edit-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Max Participants</Label>
              <Suspense fallback={<div className="h-10 rounded-md bg-muted/30 animate-pulse" />}>
                <NeuParticipantSlider
                  value={editMaxUsers}
                  onChange={setEditMaxUsers}
                  testId="slider-edit-max-users"
                />
              </Suspense>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary/80" />
                  Card Media
                  <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>
                </Label>
                {editHologramUrl && !editHologramUploading && (
                  <button
                    type="button"
                    onClick={() => { setEditHologramUrl(null); setEditHologramKind("gif"); }}
                    className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                    data-testid="button-clear-edit-card-media"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {editHologramUrl ? (
                  editHologramKind === "video" ? (
                    <video
                      src={editHologramUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-14 h-14 rounded-md object-cover border-2 border-primary/60"
                      data-testid="video-edit-card-media-preview"
                    />
                  ) : (
                    <img
                      src={editHologramUrl}
                      alt="Selected media"
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-md object-cover border-2 border-primary/60"
                      data-testid="img-edit-card-media-preview"
                    />
                  )
                ) : (
                  <div className="w-14 h-14 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                    {editHologramUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Empty"}
                  </div>
                )}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Suspense fallback={<div className="h-9 rounded-md bg-muted/30 animate-pulse" />}>
                    <GifPickerButton
                      onGifSelect={(url) => { setEditHologramUrl(url); setEditHologramKind("gif"); }}
                      side="bottom"
                      align="start"
                    />
                  </Suspense>
                  <button
                    type="button"
                    onClick={() => editHologramFileRef.current?.click()}
                    disabled={editHologramUploading}
                    className="neu-upload-btn flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50"
                    data-testid="button-upload-edit-card-media"
                  >
                    {editHologramUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {editHologramUploading ? "Uploading..." : "Upload"}
                  </button>
                  <input
                    ref={editHologramFileRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleEditHologramFilePick}
                    data-testid="input-edit-card-media-file"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Pick a GIF, upload your own picture / short video, or tap Clear to remove the current card background.
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground leading-snug bg-muted/30 border border-border/40 rounded-md px-3 py-2">
              Card themes, host controls and in-room animations are managed inside the room — open the room and tap Settings.
            </p>
          </div>

          {/* Pinned footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-border/40">
            <Button
              type="submit"
              className="w-full"
              disabled={!editTitle.trim() || editMutation.isPending || editHologramUploading}
              data-testid="button-save-room-edit"
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
