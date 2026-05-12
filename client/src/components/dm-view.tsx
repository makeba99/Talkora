import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Send, ChevronDown, Smile } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EmojiPickerButton, GifPickerButton, ImageUploadButton, renderMessageContent, uploadChatImage } from "@/components/chat-picker";
import type { Message, User } from "@shared/schema";

const DM_QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉"];

interface DmViewProps {
  otherUserId: string;
  onBack: () => void;
}

export function DmView({ otherUserId, onBack }: DmViewProps) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [text, setText] = useState("");
  const [pasteUploading, setPasteUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Reactions (client-side, per-session) ── */
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [reactPopoverMsgId, setReactPopoverMsgId] = useState<string | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  /* Prevent hover re-triggering immediately after an action (mouse stays inside row) */
  const suppressHoverRef = useRef(false);
  const dismissHover = () => {
    setReactPopoverMsgId(null);
    setHoveredMsgId(null);
    suppressHoverRef.current = true;
    setTimeout(() => { suppressHoverRef.current = false; }, 700);
  };

  const handleDmReact = (msgId: string, emoji: string) => {
    if (!user) return;
    setReactions(prev => {
      const msgReactions = { ...(prev[msgId] || {}) };
      const users = [...(msgReactions[emoji] || [])];
      const idx = users.indexOf(user.id);
      if (idx >= 0) {
        users.splice(idx, 1);
      } else {
        users.push(user.id);
      }
      msgReactions[emoji] = users;
      return { ...prev, [msgId]: msgReactions };
    });
    dismissHover();
  };

  const { data: otherUser } = useQuery<User>({
    queryKey: ["/api/users", otherUserId],
    enabled: !!otherUserId,
  });

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", user?.id, otherUserId],
    enabled: !!user && !!otherUserId,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: async (msgText: string) => {
      await apiRequest("POST", "/api/messages", {
        fromId: user?.id,
        toId: otherUserId,
        text: msgText,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/messages", user?.id, otherUserId],
      });
    },
  });

  useEffect(() => {
    if (!socket || !user) return;
    const handleNewMessage = (msg: Message) => {
      if (
        (msg.fromId === otherUserId && msg.toId === user.id) ||
        (msg.fromId === user.id && msg.toId === otherUserId)
      ) {
        queryClient.invalidateQueries({
          queryKey: ["/api/messages", user.id, otherUserId],
        });
      }
    };
    const handleRead = (data: { readerId: string }) => {
      // The other user read our messages — refresh to update read flags
      if (data.readerId === otherUserId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/messages", user.id, otherUserId],
        });
      }
    };
    socket.on("dm:new", handleNewMessage);
    socket.on("dm:read", handleRead);
    return () => {
      socket.off("dm:new", handleNewMessage);
      socket.off("dm:read", handleRead);
    };
  }, [socket, user, otherUserId]);

  useEffect(() => {
    if (!user || !otherUserId) return;
    apiRequest("POST", `/api/messages/read/${otherUserId}`).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    }).catch(() => {});
  }, [user, otherUserId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = () => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const { scrollTop, scrollHeight, clientHeight } = viewport;
        const atBottom = scrollHeight - scrollTop <= clientHeight + 50;
        setIsAtBottom(atBottom);
        if (atBottom) setUnreadCount(0);
      }
    }
  };

  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    } else if (!isAtBottom && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.fromId !== user?.id) setUnreadCount(prev => prev + 1);
    }
  }, [messages, isAtBottom, user?.id]);

  const scrollToBottom = () => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      setUnreadCount(0);
      setIsAtBottom(true);
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    sendMutation.mutate(text.trim());
    setText("");
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  /* Returns true if this is the LAST message in a consecutive same-sender run.
     Avatar is shown only on the last message (Telegram / iMessage style). */
  const isLastInRun = (msg: Message, idx: number) => {
    if (idx === messages.length - 1) return true;
    const next = messages[idx + 1];
    if (next.fromId !== msg.fromId) return true;
    return new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime() >= 2 * 60 * 1000;
  };

  /* Returns true if this message continues a same-sender run (used for spacing) */
  const isGrouped = (msg: Message, idx: number) => {
    if (idx === 0) return false;
    const prev = messages[idx - 1];
    if (prev.fromId !== msg.fromId) return false;
    return new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 2 * 60 * 1000;
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="dm-header">
        <button
          type="button"
          onClick={onBack}
          className="dm-back-btn"
          data-testid="button-dm-back"
          aria-label="Go back"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <Avatar className="w-8 h-8 flex-shrink-0 ring-1 ring-white/10">
          <AvatarImage src={otherUser?.profileImageUrl || undefined} alt={getUserDisplayName(otherUser)} />
          <AvatarFallback className="text-xs font-bold" style={{ background: "linear-gradient(135deg,#4c3dcc,#7c5af0)", color: "#fff" }}>
            {getUserInitials(otherUser) || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
          <p className="dm-header-name truncate" data-testid="text-dm-username">
            {getUserDisplayName(otherUser) || "Unknown"}
          </p>
          <p className="dm-header-sub">Private message</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef} onScroll={handleScroll}>
        <div className="p-3 space-y-1">
          {isLoading ? (
            <p className="text-xs text-center py-8" style={{ color: "rgba(160,155,210,0.45)" }}>Loading…</p>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 space-y-2.5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(100,85,210,0.12)", border: "1px solid rgba(120,100,255,0.16)" }}>
                <Send className="w-4 h-4" style={{ color: "rgba(160,148,255,0.45)" }} />
              </div>
              <p className="text-xs" style={{ color: "rgba(160,155,210,0.45)" }}>No messages yet. Say hello!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.fromId === user?.id;
              const grouped = isGrouped(msg, idx);
              const lastInRun = isLastInRun(msg, idx);
              const msgReactions = reactions[msg.id] || {};
              const hasReactions = Object.values(msgReactions).some(uids => uids.length > 0);

              return (
                <div
                  key={msg.id}
                  className={`dm-msg-row ${isMe ? "dm-msg-row--own" : ""} ${grouped ? "dm-msg-row--grouped" : ""}`}
                  onMouseEnter={() => { if (!suppressHoverRef.current) setHoveredMsgId(msg.id); }}
                  onMouseLeave={() => setHoveredMsgId(null)}
                  data-testid={`message-${msg.id}`}
                >
                  {/* Avatar — left side for other user; invisible placeholder when grouped */}
                  {!isMe && (
                    <div className="dm-msg-avatar-slot">
                      {lastInRun ? (
                        <Avatar className="w-8 h-8 flex-shrink-0 ring-1 ring-white/10">
                          <AvatarImage src={otherUser?.profileImageUrl || undefined} alt={getUserDisplayName(otherUser)} />
                          <AvatarFallback className="text-xs font-bold" style={{ background: "linear-gradient(135deg,#4c3dcc,#7c5af0)", color: "#fff" }}>
                            {getUserInitials(otherUser) || "?"}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8 h-8 flex-shrink-0" />
                      )}
                    </div>
                  )}

                  {/* Bubble + reactions column */}
                  <div className={`dm-msg-content ${isMe ? "items-end" : "items-start"}`}>

                    {/* Sender name — only shown for first message in a group, and only for the other user */}
                    {!isMe && !grouped && (
                      <p className="dm-sender-name">
                        {getUserDisplayName(otherUser) || "Unknown"}
                      </p>
                    )}

                    {/* Bubble */}
                    <div className={`dm-bubble ${isMe ? "dm-bubble-own" : "dm-bubble-other"}`} data-testid={`bubble-${msg.id}`}>
                      <div className="dm-bubble-text break-words">{renderMessageContent(msg.text)}</div>
                      {isMe ? (
                        <div className="dm-bubble-meta">
                          <span className="dm-bubble-time">{formatTime(msg.createdAt)}</span>
                          <span className={msg.read ? "dm-tick dm-tick--seen" : "dm-tick dm-tick--sent"} data-testid={`tick-${msg.id}`} aria-label={msg.read ? "Seen" : "Sent"}>
                            {msg.read ? (
                              <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
                                <path d="M1 5.5L4.5 9L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M6 5.5L9.5 9L16 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            ) : (
                              <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                                <path d="M1 5.5L4.5 9L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                        </div>
                      ) : (
                        <p className="dm-bubble-time">{formatTime(msg.createdAt)}</p>
                      )}
                    </div>

                    {/* Reaction pills — outside bubble, doesn't change bubble size */}
                    {hasReactions && (
                      <div className={`dm-reaction-row ${isMe ? "flex-row-reverse" : ""}`} data-testid={`reactions-dm-${msg.id}`}>
                        {Object.entries(msgReactions)
                          .filter(([, uids]) => uids.length > 0)
                          .map(([emoji, uids]) => (
                            <Tooltip key={emoji}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleDmReact(msg.id, emoji)}
                                  className="chat-reaction-pill"
                                  data-self={uids.includes(user?.id || "") ? "true" : undefined}
                                  data-testid={`dm-reaction-${msg.id}-${emoji}`}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-medium">{uids.length}</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6} className="text-[10px] px-1.5 py-0.5">
                                {uids.length === 1 ? "1 reaction" : `${uids.length} reactions`}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                      </div>
                    )}

                    {/* Hover quick-react bar */}
                    <div className={`dm-quick-react-bar ${hoveredMsgId === msg.id || reactPopoverMsgId === msg.id ? "dm-quick-react-bar--visible" : ""} ${isMe ? "self-end" : "self-start"}`}>
                      <Popover open={reactPopoverMsgId === msg.id} onOpenChange={(open) => { if (open) setReactPopoverMsgId(msg.id); else dismissHover(); }}>
                        <PopoverTrigger asChild>
                          <button
                            className="dm-react-trigger"
                            data-testid={`button-dm-react-${msg.id}`}
                            title="Add reaction"
                            type="button"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="p-1.5 w-auto" side={isMe ? "left" : "right"} sideOffset={6}>
                          <div className="flex items-center gap-0.5 flex-wrap" style={{ maxWidth: "180px" }}>
                            {DM_QUICK_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => handleDmReact(msg.id, emoji)}
                                className="text-base hover:scale-125 active:scale-95 transition-transform flex items-center justify-center rounded-md hover:bg-white/10"
                                style={{ minWidth: "28px", minHeight: "28px", lineHeight: 1 }}
                                data-testid={`dm-quick-react-${msg.id}-${emoji}`}
                                title={`React with ${emoji}`}
                                type="button"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Own avatar — right side; invisible placeholder when grouped */}
                  {isMe && (
                    <div className="dm-msg-avatar-slot">
                      {lastInRun ? (
                        <Avatar className="w-8 h-8 flex-shrink-0 ring-1 ring-white/10">
                          <AvatarImage src={user?.profileImageUrl || undefined} alt="You" />
                          <AvatarFallback className="text-xs font-bold" style={{ background: "linear-gradient(135deg,#7c5af0,#a855f7)", color: "#fff" }}>
                            {getUserInitials(user) || "?"}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8 h-8 flex-shrink-0" />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <form onSubmit={handleSend} className="dm-input-dock">
        <div className="dm-tools-row">
          <EmojiPickerButton onEmojiSelect={(emoji) => setText((prev) => prev + emoji)} />
          <GifPickerButton onGifSelect={(gifUrl) => { sendMutation.mutate(`[gif:${gifUrl}]`); }} side="top" align="start" />
          <ImageUploadButton onImageSelect={(imgUrl) => { sendMutation.mutate(`[img:${imgUrl}]`); }} />
        </div>
        <div className="dm-input-wrap">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Type a message"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSend(); }}
            onPaste={async (e) => {
              const items = Array.from(e.clipboardData.items);
              const imageItem = items.find(item => item.type.startsWith("image/"));
              if (imageItem) {
                e.preventDefault();
                const file = imageItem.getAsFile();
                if (!file) return;
                setPasteUploading(true);
                try {
                  const imgUrl = await uploadChatImage(file);
                  sendMutation.mutate(`[img:${imgUrl}]`);
                } catch {}
                finally { setPasteUploading(false); }
              }
            }}
            placeholder={pasteUploading ? "Uploading…" : "Message…"}
            disabled={pasteUploading}
            className="dm-input"
            data-testid="input-dm-message"
          />
          <button
            type="submit"
            disabled={!text.trim() || sendMutation.isPending}
            className="dm-send-btn"
            data-testid="button-send-dm"
            aria-label="Send message"
          >
            <Send className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </form>

      {/* Scroll-to-bottom pill */}
      {!isAtBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-20 right-4 w-8 h-8 rounded-full shadow-lg flex items-center justify-center z-20 animate-in fade-in slide-in-from-bottom-2 transition-colors"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          data-testid="button-scroll-to-bottom"
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
              style={{
                background: "linear-gradient(145deg, #e85555 0%, #c01818 100%)",
                border: "1.5px solid hsl(228 18% 8%)",
                boxShadow: "0 0 6px rgba(220,50,50,0.5), 0 1px 4px rgba(0,0,0,0.4)",
              }}
              data-testid="badge-dm-scroll-unread"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
