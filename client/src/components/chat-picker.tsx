import { useState, useRef, useEffect, useCallback } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Smile, ImagePlus, Search, Loader2, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
}

interface GifPickerButtonProps {
  onGifSelect: (gifUrl: string) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

interface ImageUploadButtonProps {
  onImageSelect: (imageUrl: string) => void;
}

interface GifResult {
  id: string;
  url: string;
  preview: string;
  title: string;
  width: number;
  height: number;
}

function normalizeGifUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("tenor.com") || parsed.hostname.includes("media.tenor.com")) {
      parsed.search = "";
      return parsed.toString();
    }
  } catch {}
  return url;
}

export function EmojiPickerButton({ onEmojiSelect }: EmojiPickerButtonProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="room-tool-btn"
          data-testid="button-emoji-picker"
          aria-label="Open emoji picker"
        >
          <Smile className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0 vextorn-emoji-popover"
        side="top"
        align="start"
        sideOffset={8}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          theme={theme === "light" || theme === "neomorphic-light" ? Theme.LIGHT : Theme.DARK}
          width="100%"
          height={350}
          searchPlaceHolder="Search emojis..."
          previewConfig={{ showPreview: false }}
          lazyLoadEmojis
        />
      </PopoverContent>
    </Popover>
  );
}

export function GifPickerButton({ onGifSelect, side = "top", align = "start" }: GifPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [nextPos, setNextPos] = useState<string>("");
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const currentQueryRef = useRef<string>("");

  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) {
      setGifs([]);
      setGifError(null);
      setNextPos("");
      return;
    }
    currentQueryRef.current = query;
    setGifLoading(true);
    setGifError(null);
    setNextPos("");
    try {
      const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to search GIFs");
      }
      const data = await res.json();
      setGifs(data.results || []);
      setNextPos(data.next || "");
    } catch (err: any) {
      setGifError(err.message || "Failed to search GIFs");
      setGifs([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  const loadTrending = useCallback(async () => {
    currentQueryRef.current = "";
    setGifLoading(true);
    setGifError(null);
    setNextPos("");
    try {
      const res = await fetch("/api/gifs/trending");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to load trending GIFs");
      }
      const data = await res.json();
      setGifs(data.results || []);
      setNextPos(data.next || "");
    } catch (err: any) {
      setGifError(err.message || "GIF search unavailable");
      setGifs([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (pos: string, query: string) => {
    if (!pos || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = query.trim()
        ? `/api/gifs/search?q=${encodeURIComponent(query)}&pos=${encodeURIComponent(pos)}`
        : `/api/gifs/trending?pos=${encodeURIComponent(pos)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const newGifs: GifResult[] = data.results || [];
      if (newGifs.length > 0) {
        setGifs((prev) => {
          const existingIds = new Set(prev.map((g) => g.id));
          return [...prev, ...newGifs.filter((g) => !existingIds.has(g.id))];
        });
      }
      setNextPos(data.next || "");
    } catch {
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  useEffect(() => {
    if (open && gifs.length === 0 && !gifSearch) {
      loadTrending();
    }
  }, [open, loadTrending]);

  useEffect(() => {
    if (!open) return;
    const sentinel = sentinelRef.current;
    const scroller = scrollRef.current;
    if (!sentinel || !scroller) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextPos && !loadingMore && !gifLoading) {
          loadMore(nextPos, currentQueryRef.current);
        }
      },
      { root: scroller, rootMargin: "200px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, nextPos, loadingMore, gifLoading, loadMore, gifs.length]);

  const handleGifSearchChange = (value: string) => {
    setGifSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (value.trim()) {
        searchGifs(value);
      } else {
        loadTrending();
      }
    }, 400);
  };

  const handleGifClick = (gif: GifResult) => {
    onGifSelect(normalizeGifUrl(gif.url));
    setOpen(false);
    setGifSearch("");
    setGifs([]);
    setNextPos("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="room-tool-btn"
          data-testid="button-gif-picker"
          aria-label="Send a GIF"
        >
          <span className="text-[10px] font-black leading-none tracking-tight">GIF</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(340px,92vw)] p-0 overflow-hidden gif-picker-popover"
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: "var(--radix-popover-content-available-height, 75svh)",
          height: "min(480px, calc(var(--radix-popover-content-available-height, 75svh) - 8px))",
        }}
        side={side}
        align={align}
        sideOffset={6}
        avoidCollisions
        collisionPadding={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {/* Pinned search bar — always visible, never scrolls */}
        <div className="flex-shrink-0 px-2 pt-2 pb-1.5 border-b border-border/60">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={gifSearch}
              onChange={(e) => handleGifSearchChange(e.target.value)}
              placeholder="Search GIFs..."
              className="pl-8 pr-8 text-sm h-9"
              aria-label="Search GIFs"
              data-testid="input-gif-search"
              autoComplete="off"
            />
            {gifSearch && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                aria-label="Clear GIF search"
                onClick={() => {
                  setGifSearch("");
                  loadTrending();
                }}
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        {/* Scrollable GIF grid — fills remaining space */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ minHeight: 0 }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="p-2">
            {gifLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : gifError ? (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">{gifError}</p>
              </div>
            ) : gifs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">
                  {gifSearch ? "No GIFs found" : "Search for GIFs above"}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {gifs.map((gif) => (
                    <button
                      key={gif.id}
                      onClick={() => handleGifClick(gif)}
                      className="relative rounded-md overflow-hidden cursor-pointer group"
                      data-testid={`gif-result-${gif.id}`}
                    >
                      <img
                        src={gif.preview}
                        alt={gif.title}
                        className="w-full h-24 object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        decoding="async"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </button>
                  ))}
                </div>
                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div ref={sentinelRef} className="h-8" aria-hidden="true" />
              </>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 px-2 pb-1.5 pt-0.5 border-t">
          <p className="text-[10px] text-muted-foreground text-right">Powered by GIPHY</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export async function uploadChatImage(file: File): Promise<string> {
  const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
  if (!allowed.test(file.name) && !file.type.startsWith("image/")) {
    throw new Error("Invalid file type");
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("File too large");
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/upload/chat-image", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

export function ImageUploadButton({ onImageSelect }: ImageUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (!allowed.test(file.name)) return;

    if (file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload/chat-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onImageSelect(data.url);
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-chat-image-upload"
      />
      <button
        type="button"
        className="room-tool-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        data-testid="button-chat-image-upload"
        aria-label="Upload image"
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ImagePlus className="w-3.5 h-3.5" />
        )}
      </button>
    </>
  );
}

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
const DIRECT_IMAGE_REGEX = /\.(gif|webp|png|jpe?g|avif)(\?.*)?$/i;
const ROOM_URL_REGEX = /\/room\/([a-zA-Z0-9_-]+)/;

function isRoomUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(ROOM_URL_REGEX);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function RoomLinkPreview({ roomId, url }: { roomId: string; url: string }) {
  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/rooms/${roomId}`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`/api/rooms/${roomId}/participants`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([roomData, participantsData]) => {
      if (!cancelled) {
        setRoom(roomData);
        setParticipants(Array.isArray(participantsData) ? participantsData : []);
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roomId]);

  if (loading) {
    return (
      <div className="mt-2 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", maxWidth: 300, padding: "10px 12px" }}>
        <div className="h-2.5 rounded w-1/3 mb-2" style={{ background: "rgba(167,139,250,0.18)" }} />
        <div className="h-3.5 rounded w-3/4 mb-1.5" style={{ background: "rgba(255,255,255,0.10)" }} />
        <div className="h-2 rounded w-1/2" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
    );
  }

  if (!room) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-primary underline underline-offset-2 text-[12px] hover:opacity-80 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
  }

  const displayParticipants = participants.slice(0, 5);
  const extraCount = participants.length - displayParticipants.length;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block hover:opacity-90 transition-opacity"
      style={{ maxWidth: 300, textDecoration: "none" }}
      onClick={(e) => e.stopPropagation()}
      data-testid={`room-link-card-${roomId}`}
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        {/* Header bar */}
        <div className="px-3 pt-2.5 pb-1.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.8)" }}>Vextorn Room</span>
          </div>
          <p className="text-[13px] font-semibold text-white leading-tight truncate">{room.title}</p>
          <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
            {room.language} · {room.level}
            {participants.length > 0 && <span style={{ color: "rgba(52,211,153,0.85)" }}> · {participants.length} inside</span>}
          </p>
        </div>

        {/* Participants row */}
        {displayParticipants.length > 0 && (
          <div className="flex items-center gap-1 px-3 pb-2.5">
            {displayParticipants.map((p: any) => (
              <div
                key={p.id}
                className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
                title={p.firstName || p.username || ""}
              >
                {p.profileImageUrl ? (
                  <img src={p.profileImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {(p.firstName?.[0] || p.username?.[0] || "?").toUpperCase()}
                  </div>
                )}
              </div>
            ))}
            {extraCount > 0 && (
              <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
                +{extraCount}
              </div>
            )}
          </div>
        )}
      </div>
    </a>
  );
}

function trimUrl(url: string) {
  const trailing = url.match(/[),.!?;:]+$/)?.[0] || "";
  return {
    cleanUrl: trailing ? url.slice(0, -trailing.length) : url,
    trailing,
  };
}

function GifOrImagePreview({ url, onImageClick }: { url: string; onImageClick?: (url: string) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(DIRECT_IMAGE_REGEX.test(url) ? url : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (DIRECT_IMAGE_REGEX.test(url)) {
      setPreviewUrl(url);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setPreviewUrl(null);
    setFailed(false);

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled && data?.imageUrl) setPreviewUrl(data.imageUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!previewUrl && failed) return null;

  if (!previewUrl) {
    return (
      <div className="mt-2 w-full max-w-[280px] h-28 rounded-lg border border-border bg-muted/40 animate-pulse" data-testid="message-gif-loading" />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block w-fit max-w-full"
      onClick={(e) => e.stopPropagation()}
      data-testid="message-gif-link-preview"
    >
      <img
        src={previewUrl}
        alt="GIF preview"
        className="max-w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity border border-border/60"
        style={{ maxHeight: 240 }}
        loading="lazy"
        data-testid="message-gif-url-preview"
        onClick={(e) => {
          e.preventDefault();
          onImageClick?.(previewUrl);
        }}
      />
    </a>
  );
}

function renderTextWithMentionsOnly(text: string): JSX.Element {
  const mentionRegex = /@\[([^\]]+)\]|@(\w+)/g;
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`} className="break-words [overflow-wrap:anywhere]">{text.slice(lastIndex, match.index)}</span>);
    }
    const name = match[1] || match[2];
    parts.push(
      <span key={`m-${match.index}`} className="text-primary font-semibold" data-testid="mention-highlight">
        @{name}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (parts.length > 0) {
    if (lastIndex < text.length) {
      parts.push(<span key={`t-${lastIndex}`} className="break-words [overflow-wrap:anywhere]">{text.slice(lastIndex)}</span>);
    }
    return <>{parts}</>;
  }
  return <span className="break-words [overflow-wrap:anywhere]">{text}</span>;
}

function renderTextWithMentions(text: string, onImageClick?: (url: string) => void): JSX.Element {
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let match;
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} className="break-words [overflow-wrap:anywhere]">
          {renderTextWithMentionsOnly(text.slice(lastIndex, match.index))}
        </span>
      );
    }

    const { cleanUrl, trailing } = trimUrl(match[0]);
    const roomId = isRoomUrl(cleanUrl);
    parts.push(
      <span key={`url-${match.index}`} className="inline-flex flex-col max-w-full align-top">
        {roomId ? (
          <RoomLinkPreview roomId={roomId} url={cleanUrl} />
        ) : (
          <>
            <a
              href={cleanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 break-words [overflow-wrap:anywhere] hover:text-primary/80"
              data-testid="message-clickable-link"
              onClick={(e) => e.stopPropagation()}
            >
              {cleanUrl}
            </a>
            <GifOrImagePreview url={cleanUrl} onImageClick={onImageClick} />
          </>
        )}
      </span>
    );

    if (trailing) {
      parts.push(<span key={`trail-${match.index}`}>{trailing}</span>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (parts.length === 0) return renderTextWithMentionsOnly(text);

  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`} className="break-words [overflow-wrap:anywhere]">
        {renderTextWithMentionsOnly(text.slice(lastIndex))}
      </span>
    );
  }

  return <>{parts}</>;
}

const YT_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?/;
const TT_REGEX = /https?:\/\/(?:www\.)?tiktok\.com\/@([\w.]+)(?:\/video\/(\d+)|\/live)(?:[^\s]*)?/;

export function renderReplyPreview(text: string): JSX.Element {
  const trimmedText = text.trim();
  if (trimmedText.startsWith("[gif:") && trimmedText.endsWith("]")) {
    const gifUrl = trimmedText.slice(5, -1);
    return (
      <div className="flex items-center gap-1.5">
        <img
          src={gifUrl}
          alt="GIF"
          className="rounded flex-shrink-0 object-cover"
          style={{ width: 36, height: 28 }}
        />
        <span className="text-[10px] text-muted-foreground italic">GIF</span>
      </div>
    );
  }
  if (trimmedText.startsWith("[img:") && trimmedText.endsWith("]")) {
    const imgUrl = trimmedText.slice(5, -1);
    return (
      <div className="flex items-center gap-1.5">
        <img
          src={imgUrl}
          alt="Image"
          className="rounded flex-shrink-0 object-cover"
          style={{ width: 36, height: 28 }}
        />
        <span className="text-[10px] text-muted-foreground italic">Photo</span>
      </div>
    );
  }
  const directImageMatch = trimmedText.match(URL_REGEX)?.find((url) => DIRECT_IMAGE_REGEX.test(trimUrl(url).cleanUrl));
  if (directImageMatch) {
    const imgUrl = trimUrl(directImageMatch).cleanUrl;
    return (
      <div className="flex items-center gap-1.5">
        <img
          src={imgUrl}
          alt="Image"
          className="rounded flex-shrink-0 object-cover"
          style={{ width: 36, height: 28 }}
        />
        <span className="text-[10px] text-muted-foreground italic">Image / GIF</span>
      </div>
    );
  }
  const ytMatch = trimmedText.match(YT_REGEX);
  if (ytMatch) {
    const videoId = ytMatch[1];
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    const cleanText = trimmedText.replace(ytMatch[0], "").trim();
    return (
      <div className="flex items-center gap-1.5">
        <div className="relative flex-shrink-0 rounded overflow-hidden" style={{ width: 48, height: 28 }}>
          <img
            src={thumbnailUrl}
            alt="YouTube"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white ml-0.5" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground truncate">
          {cleanText || "YouTube video"}
        </span>
      </div>
    );
  }
  return <span className="text-[10px] text-muted-foreground truncate">{trimmedText}</span>;
}

export function renderMessageContent(text: string, onImageClick?: (url: string) => void, onVideoClick?: (videoId: string) => void): JSX.Element {
  if (text.startsWith("[gif:") && text.endsWith("]")) {
    const gifUrl = text.slice(5, -1);
    return (
      <img
        src={gifUrl}
        alt="GIF"
        className="max-w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
        style={{ maxHeight: 200 }}
        loading="lazy"
        data-testid="message-gif"
        onClick={() => onImageClick?.(gifUrl)}
      />
    );
  }
  if (text.startsWith("[img:") && text.endsWith("]")) {
    const imgUrl = text.slice(5, -1);
    return (
      <img
        src={imgUrl}
        alt="Image"
        className="max-w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
        style={{ maxHeight: 300 }}
        loading="lazy"
        data-testid="message-image"
        onClick={() => onImageClick?.(imgUrl)}
      />
    );
  }

  const ytMatch = text.match(YT_REGEX);
  const ttMatch = !ytMatch ? text.match(TT_REGEX) : null;

  if (ytMatch) {
    const videoId = ytMatch[1];
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const cleanText = text.replace(ytMatch[0], "").trim();
    return (
      <div
        style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}
        data-testid="message-youtube-embed"
        onClick={e => e.stopPropagation()}
      >
        {cleanText && (
          <span className="leading-snug break-words [overflow-wrap:anywhere]">
            {renderTextWithMentions(cleanText, onImageClick)}
          </span>
        )}
        <div
          style={{ position: "relative", width: "100%", display: "block", borderRadius: 10, overflow: "hidden", background: "#000", cursor: "pointer" }}
          onClick={() => onVideoClick?.(videoId)}
          data-testid="youtube-thumbnail-click"
        >
          <img
            src={thumbnailUrl}
            alt="YouTube video"
            style={{ display: "block", width: "100%", aspectRatio: "16/9", objectFit: "cover" }}
          />
          <div
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.28)" }}
          >
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
              <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, fill: "white", marginLeft: 3 }} xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (ttMatch) {
    const username = ttMatch[1];
    const videoId = ttMatch[2];
    const isLive = !videoId;
    const embedUrl = isLive
      ? `https://www.tiktok.com/embed/live/@${username}`
      : `https://www.tiktok.com/embed/v2/${videoId}`;
    const cleanText = text.replace(ttMatch[0], "").trim();
    return (
      <div
        className="flex flex-col gap-2 w-full"
        data-testid={isLive ? "message-tiktok-live" : "message-tiktok-embed"}
        onClick={e => e.stopPropagation()}
      >
        {cleanText && <span className="leading-snug break-words [overflow-wrap:anywhere]">{renderTextWithMentions(cleanText, onImageClick)}</span>}
        {isLive && (
          <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            LIVE · @{username}
          </div>
        )}
        <div className="rounded-lg overflow-hidden">
          <iframe
            src={embedUrl}
            style={{ width: "100%", height: isLive ? "560px" : "480px", border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={isLive ? `@${username} TikTok Live` : "TikTok video"}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            data-testid={isLive ? "iframe-tiktok-live" : "iframe-tiktok"}
          />
        </div>
      </div>
    );
  }

  return renderTextWithMentions(text, onImageClick);
}
