import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useSocket } from "@/lib/socket";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EmojiPickerButton, GifPickerButton, ImageUploadButton, renderMessageContent } from "@/components/chat-picker";
import type { Message, User } from "@shared/schema";

interface DmViewProps {
  otherUserId: string;
  onBack: () => void;
}

export function DmView({ otherUserId, onBack }: DmViewProps) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

    socket.on("dm:new", handleNewMessage);
    return () => {
      socket.off("dm:new", handleNewMessage);
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
        if (atBottom) {
          setUnreadCount(0);
        }
      }
    }
  };

  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    } else if (!isAtBottom && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.fromId !== user?.id) {
        setUnreadCount(prev => prev + 1);
      }
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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMutation.mutate(text.trim());
    setText("");
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="border-b p-3 flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={onBack}
          data-testid="button-dm-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Avatar className="w-8 h-8">
          <AvatarImage src={otherUser?.profileImageUrl || undefined} alt={getUserDisplayName(otherUser)} />
          <AvatarFallback className="text-sm bg-primary/10 text-primary">
            {getUserInitials(otherUser)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" data-testid="text-dm-username">
            {getUserDisplayName(otherUser)}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef} onScroll={handleScroll}>
        <div className="p-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Loading messages...
            </p>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Send className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No messages yet. Say hello!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.fromId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] rounded-md px-3 py-2 ${
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="text-sm break-words">{renderMessageContent(msg.text)}</div>
                    <p
                      className={`text-xs mt-1 ${
                        isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSend} className="border-t p-3 flex items-center gap-1">
        <EmojiPickerButton onEmojiSelect={(emoji) => setText((prev) => prev + emoji)} />
        <GifPickerButton onGifSelect={(gifUrl) => {
          sendMutation.mutate(`[gif:${gifUrl}]`);
        }} />
        <ImageUploadButton onImageSelect={(imgUrl) => {
          sendMutation.mutate(`[img:${imgUrl}]`);
        }} />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
          data-testid="input-dm-message"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || sendMutation.isPending}
          data-testid="button-send-dm"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {!isAtBottom && unreadCount > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-lg hover:bg-primary/90 flex items-center gap-1.5 z-20 animate-in fade-in slide-in-from-bottom-2"
          data-testid="button-new-messages-indicator"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}
        </button>
      )}
    </div>
  );
}
