import { useState, useRef, useEffect, useCallback } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
        <Button
          type="button"
          size="icon"
          variant="ghost"
          data-testid="button-emoji-picker"
        >
          <Smile className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0"
        side="top"
        align="start"
        sideOffset={8}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
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

export function GifPickerButton({ onGifSelect }: GifPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) {
      setGifs([]);
      setGifError(null);
      return;
    }
    setGifLoading(true);
    setGifError(null);
    try {
      const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to search GIFs");
      }
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err: any) {
      setGifError(err.message || "Failed to search GIFs");
      setGifs([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  const loadTrending = useCallback(async () => {
    setGifLoading(true);
    setGifError(null);
    try {
      const res = await fetch("/api/gifs/trending");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to load trending GIFs");
      }
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err: any) {
      setGifError(err.message || "GIF search unavailable");
      setGifs([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && gifs.length === 0 && !gifSearch) {
      loadTrending();
    }
  }, [open, loadTrending]);

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
    onGifSelect(gif.url);
    setOpen(false);
    setGifSearch("");
    setGifs([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          data-testid="button-gif-picker"
        >
          <span className="text-xs font-bold leading-none">GIF</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0"
        side="top"
        align="start"
        sideOffset={8}
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={gifSearch}
              onChange={(e) => handleGifSearchChange(e.target.value)}
              placeholder="Search GIFs..."
              className="pl-8 text-sm"
              data-testid="input-gif-search"
            />
            {gifSearch && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => {
                  setGifSearch("");
                  loadTrending();
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[300px]">
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
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="px-2 pb-1.5 pt-0.5 border-t">
          <p className="text-[10px] text-muted-foreground text-right">Powered by GIPHY</p>
        </div>
      </PopoverContent>
    </Popover>
  );
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
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        data-testid="button-chat-image-upload"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ImagePlus className="w-4 h-4" />
        )}
      </Button>
    </>
  );
}

function renderTextWithMentions(text: string): JSX.Element {
  const mentionRegex = /@\[([^\]]+)\]|@(\w+)/g;
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
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
      parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }
    return <>{parts}</>;
  }
  return <>{text}</>;
}

const YT_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?/;
const TT_REGEX = /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.]+\/video\/(\d+)(?:[^\s]*)?/;

export function renderMessageContent(text: string, onImageClick?: (url: string) => void): JSX.Element {
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

  if (ytMatch || ttMatch) {
    const isYoutube = !!ytMatch;
    const matchedUrl = isYoutube ? ytMatch![0] : ttMatch![0];
    const videoId = isYoutube ? ytMatch![1] : ttMatch![1];
    const embedUrl = isYoutube
      ? `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`
      : `https://www.tiktok.com/embed/v2/${videoId}`;
    const cleanText = text.replace(matchedUrl, "").trim();

    return (
      <div className="flex flex-col gap-2 w-full" data-testid={isYoutube ? "message-youtube-embed" : "message-tiktok-embed"}>
        {cleanText && (
          <span className="leading-snug">{renderTextWithMentions(cleanText)}</span>
        )}
        {isYoutube ? (
          <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ paddingBottom: "56.25%", height: 0 }}>
            <iframe
              src={embedUrl}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
              loading="lazy"
              data-testid="iframe-youtube"
            />
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden">
            <iframe
              src={embedUrl}
              style={{ width: "100%", height: "480px", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="TikTok video"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
              data-testid="iframe-tiktok"
            />
          </div>
        )}
      </div>
    );
  }

  return renderTextWithMentions(text);
}
