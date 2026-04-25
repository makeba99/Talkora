import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/lib/socket";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Message } from "@shared/schema";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";

interface Conversation {
  otherUserId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface MessagesDropdownProps {
  onOpenDm: (userId: string) => void;
}

export function MessagesDropdown({ onOpenDm }: MessagesDropdownProps) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [open, setOpen] = useState(false);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread/count"],
    enabled: !!user,
    refetchInterval: 5000,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!socket || !user) return;

    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    };

    socket.on("dm:new", handleNewMessage);
    return () => {
      socket.off("dm:new", handleNewMessage);
    };
  }, [socket, user]);

  const unreadCount = unreadData?.count || 0;
  const usersMap = new Map(allUsers.map((u) => [u.id, u]));

  const formatMessagePreview = (msg: string) => {
    if (msg.startsWith("[gif:") && msg.endsWith("]")) return "🎞 GIF";
    if (msg.startsWith("[img:") && msg.endsWith("]")) return "🖼 Photo";
    return msg;
  };

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d`;
  };

  const handleOpenConversation = async (otherUserId: string) => {
    setOpen(false);
    try {
      await apiRequest("POST", `/api/messages/read/${otherUserId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    } catch {}
    onOpenDm(otherUserId);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="relative" data-testid="button-messages">
          <MessageSquare className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none animate-pulse-badge"
              style={{
                background: "linear-gradient(145deg, hsl(0 90% 58%) 0%, hsl(0 78% 44%) 100%)",
                border: "1.5px solid hsl(228 18% 8%)",
                boxShadow: "0 0 10px rgba(239,68,68,0.7), 0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
              data-testid="badge-messages-unread"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <span className="font-semibold text-sm">Messages</span>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet
            </p>
          ) : (
            <div className="p-1">
              {conversations.slice(0, 20).map((conv) => {
                const otherUser = usersMap.get(conv.otherUserId);
                return (
                  <button
                    key={conv.otherUserId}
                    onClick={() => handleOpenConversation(conv.otherUserId)}
                    className={`w-full flex items-center gap-3 p-2 rounded-md text-left hover-elevate active-elevate-2 ${
                      conv.unreadCount > 0 ? "bg-primary/5" : ""
                    }`}
                    data-testid={`conversation-${conv.otherUserId}`}
                  >
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      <AvatarImage src={otherUser?.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getUserInitials(otherUser)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${conv.unreadCount > 0 ? "font-semibold" : "font-medium"}`}>
                          {getUserDisplayName(otherUser)}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-xs truncate flex-1 ${conv.unreadCount > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {formatMessagePreview(conv.lastMessage)}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span
                            className="min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0 leading-none"
                            style={{
                              background: "linear-gradient(145deg, hsl(0 90% 58%) 0%, hsl(0 78% 44%) 100%)",
                              boxShadow: "0 0 6px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,255,255,0.22)",
                            }}
                            data-testid={`badge-conversation-unread-${conv.otherUserId}`}
                          >
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
