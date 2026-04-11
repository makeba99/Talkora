import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Bell, Check, Crown, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification, User } from "@shared/schema";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useSocket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";

export function NotificationsDropdown() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
    refetchInterval: 10000,
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

  const unreadCount = notifications.filter((n) => !n.read).length;
  const usersMap = new Map(allUsers.map((u) => [u.id, u]));

  useEffect(() => {
    if (!socket) return;

    const refreshNotifications = (event?: { type?: string }) => {
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

    socket.on("admin:notification", refreshNotifications);
    socket.on("admin:warning", handleWarning);

    return () => {
      socket.off("admin:notification", refreshNotifications);
      socket.off("admin:warning", handleWarning);
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
    if (notif.type === "admin_warning") return "You’ve received a warning from Admin. Continued violations may lead to restrictions.";
    if (notif.type === "admin_removed") return "Your Admin access was removed by the Platform Owner.";
    return notif.type;
  };

  const getNotificationIcon = (notif: Notification, fromUser?: User) => {
    if (notif.type === "admin_promotion") return <ShieldCheck className="w-4 h-4 text-blue-300" />;
    if (notif.type === "admin_warning") return <AlertTriangle className="w-4 h-4 text-destructive" />;
    if (notif.type === "admin_removed") return <Crown className="w-4 h-4 text-amber-300" />;
    return null;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="relative" data-testid="button-notifications">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
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
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No notifications yet
            </p>
          ) : (
            <div className="p-1">
              {notifications.slice(0, 20).map((notif) => {
                const fromUser = usersMap.get(notif.fromUserId);
                const icon = getNotificationIcon(notif, fromUser);
                return (
                  <div
                    key={notif.id}
                    className={`flex items-center gap-3 p-2 rounded-md ${
                      !notif.read ? "bg-primary/5" : ""
                    }`}
                    data-testid={`notification-${notif.id}`}
                  >
                    {icon ? (
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        {icon}
                      </div>
                    ) : (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={fromUser?.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getUserInitials(fromUser)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        {getNotificationLabel(notif, fromUser)}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
