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

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
const DIRECT_IMAGE_REGEX = /\.(gif|webp|png|jpe?g|avif)(\?.*)?$/i;

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
    parts.push(
      <span key={`url-${match.index}`} className="inline-flex flex-col max-w-full align-top">
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
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
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
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const cleanText = text.replace(ytMatch[0], "").trim();
    return (
      <div
        className="flex flex-col gap-2 w-full"
        data-testid="message-youtube-embed"
        onClick={e => e.stopPropagation()}
      >
          {cleanText && <span className="leading-snug break-words [overflow-wrap:anywhere]">{renderTextWithMentions(cleanText, onImageClick)}</span>}
        <div
          className="relative w-full rounded-lg overflow-hidden bg-black cursor-pointer group"
          style={{ paddingBottom: "56.25%", height: 0 }}
          onClick={() => onVideoClick?.(videoId)}
          data-testid="youtube-thumbnail-click"
        >
          <img
            src={thumbnailUrl}
            alt="YouTube video"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white ml-1" xmlns="http://www.w3.org/2000/svg">
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
