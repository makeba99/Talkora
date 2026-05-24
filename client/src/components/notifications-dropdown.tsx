import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Award, Bell, Check, Crown, Shield, ShieldAlert, ShieldCheck, Ban, ShieldOff, Palette, MessageCircle, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification, User } from "@shared/schema";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { useToast } from "@/hooks/use-toast";

interface NotificationsDropdownProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

interface PendingRequest {
  id: string;
  fromId: string;
  toId: string;
  status: string;
  createdAt: string;
  fromUser: User | null;
}

export function NotificationsDropdown({ open: controlledOpen, onOpenChange, hideTrigger = false }: NotificationsDropdownProps = {}) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: pendingRequests = [] } = useQuery<PendingRequest[]>({
    queryKey: ["/api/message-requests/pending"],
    queryFn: async () => {
      const res = await fetch("/api/message-requests/pending", { credentials: "include" });
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 20000,
  });

  const respondRequestMutation = useMutation({
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
    },
    onError: () => {
      toast({ title: "Action failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const unreadCount = unreadNotifCount + pendingRequests.length;
  const usersMap = new Map(allUsers.map((u) => [u.id, u]));

  useEffect(() => {
    if (!socket) return;

    const refreshNotifications = (event?: { type?: string; roomTitle?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      if (event?.type === "admin_promotion") {
        toast({
          title: "You are now a Platform Admin",
          description: "You can manage reports and moderate users.",
        });
      }
      if (event?.type === "admin_removed") {
        toast({
          title: "Admin access removed",
          description: "Your platform moderation access has been updated.",
        });
      }
      if (event?.type === "admin_warning") {
        toast({
          title: "Warning received",
          description: "Continued violations may lead to restrictions.",
          variant: "destructive",
        });
      }
      if (event?.type === "badge_awarded") {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      }
      if (event?.type === "theme_order_approved") {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        toast({
          title: "Theme request approved!",
          description: event.grantedThemeId
            ? `"${event.themeName}" was approved${event.adminNote ? ` — ${event.adminNote}` : ""}. The theme has been added to your picker.`
            : `"${event.themeName}" was approved${event.adminNote ? ` — ${event.adminNote}` : ""}.`,
        });
      }
      if (event?.type === "theme_order_denied") {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        toast({
          title: "Theme request not approved",
          description: `"${event.themeName}"${event.adminNote ? ` — ${event.adminNote}` : " was not approved at this time."}`,
          variant: "destructive",
        });
      }
      if (event?.type === "join_request") {
        toast({
          title: "🚪 Someone's knocking!",
          description: `A user wants to join "${event.roomTitle || "your room"}"`,
        });
      }
    };

    const handleWarning = (event: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Warning received",
        description: event?.message || "Continued violations may lead to restrictions.",
        variant: "destructive",
      });
    };

    const handleBroadcastNotification = (event: { title: string; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: event.title || "Platform Notification",
        description: event.message,
      });
    };

    const handleNewMessageRequest = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-requests/pending"] });
      toast({ title: "New message request", description: "Someone wants to message you." });
    };

    const handleNotificationNew = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    };

    socket.on("admin:notification", refreshNotifications);
    socket.on("admin:warning", handleWarning);
    socket.on("admin:broadcast_notification", handleBroadcastNotification);
    socket.on("message_request:new", handleNewMessageRequest);
    socket.on("notification:new", handleNotificationNew);

    return () => {
      socket.off("admin:notification", refreshNotifications);
      socket.off("admin:warning", handleWarning);
      socket.off("admin:broadcast_notification", handleBroadcastNotification);
      socket.off("message_request:new", handleNewMessageRequest);
      socket.off("notification:new", handleNotificationNew);
    };
  }, [socket, toast]);

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d`;
  };

  const getNotificationLabel = (notif: Notification, fromUser?: User) => {
    if (notif.type === "follow") return `${getUserDisplayName(fromUser)} followed you`;
    if (notif.type === "admin_promotion") return "You are now a Platform Admin! You can manage reports and moderate users.";
    if (notif.type === "admin_warning") return "You've received a warning from Admin. Continued violations may lead to restrictions.";
    if (notif.type === "admin_removed") return "Your Admin access was removed by the Platform Owner.";
    if (notif.type.startsWith("badge_awarded:")) {
      const badgeType = notif.type.split(":")[1] ?? "";
      const label = badgeType.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      return `🏆 Congratulations! You've been awarded the ${label} badge.`;
    }
    if (notif.type === "admin_restriction") return "Your account has been temporarily restricted by the Platform Owner.";
    if (notif.type === "admin_restriction_lifted") return "Your account restriction has been lifted. Full access restored.";
    if (notif.type === "security_suspicious_activity") return "Suspicious activity was detected on your account. Please review your recent sessions.";
    if (notif.type === "security_rate_limited") return "Your account hit a request rate limit. If this wasn't you, consider changing your password.";
    if (notif.type === "security_account_alert") return "A security alert has been logged on your account. Contact support if you need help.";
    if (notif.type.startsWith("join_request:")) return `🚪 ${getUserDisplayName(fromUser)} is knocking — they want to join your room!`;
    if (notif.type.startsWith("platform_broadcast:")) {
      const title = notif.type.split(":").slice(1).join(":");
      return `📢 ${title}`;
    }
    if (notif.type.startsWith("theme_order_approved:")) {
      const name = notif.type.split(":").slice(1).join(":");
      return `🎨 Your theme request "${name}" was approved! Check the theme picker to use it.`;
    }
    if (notif.type.startsWith("theme_order_denied:")) {
      const name = notif.type.split(":").slice(1).join(":");
      return `Your theme request "${name}" was not approved at this time.`;
    }
    return notif.type;
  };

  const getNotificationIcon = (notif: Notification) => {
    if (notif.type === "admin_promotion") return <ShieldCheck className="w-4 h-4 text-blue-300" />;
    if (notif.type === "admin_warning") return <AlertTriangle className="w-4 h-4 text-destructive" />;
    if (notif.type === "admin_removed") return <Crown className="w-4 h-4 text-amber-300" />;
    if (notif.type === "admin_restriction") return <Ban className="w-4 h-4 text-orange-400" />;
    if (notif.type === "admin_restriction_lifted") return <ShieldOff className="w-4 h-4 text-green-400" />;
    if (notif.type.startsWith("badge_awarded:")) return <Award className="w-4 h-4 text-amber-400" />;
    if (notif.type.startsWith("security_")) return <ShieldAlert className="w-4 h-4 text-red-400" />;
    if (notif.type.startsWith("join_request:")) return null;
    if (notif.type.startsWith("theme_order_approved:")) return <Palette className="w-4 h-4 text-green-400" />;
    if (notif.type.startsWith("theme_order_denied:")) return <Palette className="w-4 h-4 text-red-400" />;
    return null;
  };

  return (
    <DropdownMenu open={controlledOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {hideTrigger ? (
          <span
            aria-hidden="true"
            tabIndex={-1}
            data-testid="notifications-anchor"
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
          <Button size="icon" variant="ghost" className="relative" data-testid="button-notifications" aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}>
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none animate-pulse-badge"
                style={{
                  background: "linear-gradient(145deg, hsl(0 90% 58%) 0%, hsl(0 78% 44%) 100%)",
                  border: "1.5px solid hsl(228 18% 8%)",
                  boxShadow: "0 0 10px rgba(239,68,68,0.7), 0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
                }}
                data-testid="badge-notifications-unread"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadNotifCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markReadMutation.mutate()}
              className="text-xs"
              data-testid="button-mark-read"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {/* Pending message requests */}
          {pendingRequests.length > 0 && (
            <div className="p-2 border-b border-border/50">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 px-1 pb-1.5 flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> Message requests ({pendingRequests.length})
              </p>
              <div className="space-y-1">
                {pendingRequests.map((req) => {
                  const fromUser = req.fromUser;
                  const isPending = respondRequestMutation.isPending;
                  return (
                    <div
                      key={req.id}
                      className="flex items-center gap-2.5 p-2 rounded-md bg-primary/5 border border-primary/10"
                      data-testid={`message-request-${req.id}`}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={fromUser?.profileImageUrl || undefined} alt="" />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getUserInitials(fromUser)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug truncate">
                          {getUserDisplayName(fromUser)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">wants to message you</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => respondRequestMutation.mutate({ id: req.id, status: "accepted" })}
                          disabled={isPending}
                          className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500/15 hover:bg-green-500/25 text-green-400 transition-colors disabled:opacity-50"
                          data-testid={`button-accept-request-${req.id}`}
                          title="Accept"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => respondRequestMutation.mutate({ id: req.id, status: "declined" })}
                          disabled={isPending}
                          className="w-6 h-6 rounded-full flex items-center justify-center bg-destructive/15 hover:bg-destructive/25 text-destructive/80 transition-colors disabled:opacity-50"
                          data-testid={`button-decline-request-${req.id}`}
                          title="Decline"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Regular notifications */}
          {notifications.length === 0 && pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No notifications yet
            </p>
          ) : notifications.length === 0 ? null : (
            <div className="p-1">
              {notifications.slice(0, 20).map((notif) => {
                const fromUser = usersMap.get(notif.fromUserId);
                const icon = getNotificationIcon(notif);
                const isBadge = notif.type.startsWith("badge_awarded:");
                return (
                  <div
                    key={notif.id}
                    className={`flex items-center gap-3 p-2 rounded-md ${!notif.read ? (notif.type.startsWith("security_") ? "bg-red-500/8" : notif.type.startsWith("join_request:") ? "bg-amber-500/8" : "bg-primary/5") : ""}`}
                    data-testid={`notification-${notif.id}`}
                  >
                    {icon ? (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={isBadge ? { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)" } : notif.type.startsWith("security_") ? { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" } : { background: "hsl(var(--primary)/0.1)", border: "1px solid hsl(var(--primary)/0.2)" }}
                      >
                        {icon}
                      </div>
                    ) : (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={fromUser?.profileImageUrl || undefined} alt="" />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getUserInitials(fromUser)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">
                        {getNotificationLabel(notif, fromUser)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatTime(notif.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
