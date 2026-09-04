import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, MessageCircle, Check, X, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/lib/socket-context";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Message } from "@shared/schema";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Conversation {
  otherUserId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface PendingRequest {
  id: string;
  fromId: string;
  toId: string;
  status: string;
  createdAt: string;
  fromUser: User | null;
}

interface MessagesDropdownProps {
  onOpenDm: (userId: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function MessagesDropdown({ onOpenDm, open: controlledOpen, onOpenChange, hideTrigger }: MessagesDropdownProps) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"messages" | "requests">("messages");
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
    enabled: !!user,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread/count"],
    enabled: !!user,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const { data: pendingRequests = [] } = useQuery<PendingRequest[]>({
    queryKey: ["/api/message-requests/pending"],
    queryFn: async () => {
      const res = await fetch("/api/message-requests/pending", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const res = await apiRequest("PATCH", `/api/message-requests/${id}`, { status });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.status === "accepted" ? "Request accepted" : "Request declined",
        description: variables.status === "accepted" ? "You can now exchange messages." : "The request has been declined.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/message-requests/pending"] });
      if (variables.status === "accepted") {
        queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      }
    },
    onError: () => {
      toast({ title: "Action failed", description: "Please try again.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!socket || !user) return;
    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    };
    const handleNewRequest = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-requests/pending"] });
    };
    socket.on("dm:new", handleNewMessage);
    socket.on("message_request:new", handleNewRequest);
    return () => {
      socket.off("dm:new", handleNewMessage);
      socket.off("message_request:new", handleNewRequest);
    };
  }, [socket, user]);

  const unreadCount = unreadData?.count || 0;
  const totalBadge = unreadCount + pendingRequests.length;
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
        {hideTrigger ? (
          <span
            aria-hidden="true"
            tabIndex={-1}
            data-testid="messages-anchor"
            style={{
              position: "fixed",
              top: 56,
              right: 16,
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
              zIndex: -1,
            }}
          />
        ) : (
          <Button size="icon" variant="ghost" className="relative" data-testid="button-messages" aria-label={totalBadge > 0 ? `Messages (${totalBadge} unread)` : "Messages"}>
            <MessageSquare className="w-4 h-4" />
            {totalBadge > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none animate-pulse-badge"
                style={{
                  background: "linear-gradient(145deg, hsl(0 90% 58%) 0%, hsl(0 78% 44%) 100%)",
                  border: "1.5px solid hsl(228 18% 8%)",
                  boxShadow: "0 0 10px rgba(239,68,68,0.7), 0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
                }}
                data-testid="badge-messages-unread"
              >
                {totalBadge > 9 ? "9+" : totalBadge}
              </span>
            )}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="p-3 border-b">
          <div className="flex gap-1" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "messages"}
              onClick={() => setActiveTab("messages")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === "messages"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
              data-testid="tab-messages"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Messages
              {unreadCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
                  style={{ background: "hsl(0 85% 55%)", color: "#fff" }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "requests"}
              onClick={() => setActiveTab("requests")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === "requests"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
              data-testid="tab-message-requests"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Requests
              {pendingRequests.length > 0 && (
                <span className="min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
                  style={{ background: "hsl(0 85% 55%)", color: "#fff" }}>
                  {pendingRequests.length > 9 ? "9+" : pendingRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Conversations tab */}
        {activeTab === "messages" && (
          <ScrollArea className="max-h-80">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 px-4 text-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No messages yet</p>
                <p className="text-[11px] text-muted-foreground/70 leading-snug">
                  Open someone’s profile and tap Message to start a chat.
                </p>
              </div>
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
                        <AvatarImage src={otherUser?.profileImageUrl || undefined} alt="" />
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
        )}

        {/* Requests tab */}
        {activeTab === "requests" && (
          <ScrollArea className="max-h-80">
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <MessageCircle className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground text-center">No pending message requests</p>
                <p className="text-xs text-muted-foreground/60 text-center max-w-[200px]">
                  People who follow you can request to message you here.
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {pendingRequests.map((req) => {
                  const fromUser = req.fromUser;
                  const isPending = respondMutation.isPending;
                  return (
                    <div
                      key={req.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg bg-primary/5 border border-primary/10"
                      data-testid={`request-item-${req.id}`}
                    >
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={fromUser?.profileImageUrl || undefined} alt="" />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getUserInitials(fromUser)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug truncate">
                          {getUserDisplayName(fromUser)}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-orange-400/70 flex-shrink-0" />
                          <p className="text-[10px] text-muted-foreground">
                            Wants to message you · {formatTime(req.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => respondMutation.mutate({ id: req.id, status: "accepted" })}
                          disabled={isPending}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-green-500/15 hover:bg-green-500/30 text-green-400 transition-colors disabled:opacity-50 border border-green-500/20"
                          data-testid={`button-accept-dm-request-${req.id}`}
                          title="Accept"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => respondMutation.mutate({ id: req.id, status: "declined" })}
                          disabled={isPending}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-destructive/10 hover:bg-destructive/20 text-destructive/80 transition-colors disabled:opacity-50 border border-destructive/20"
                          data-testid={`button-decline-dm-request-${req.id}`}
                          title="Decline"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
