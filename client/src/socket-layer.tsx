import { useEffect, useState, Suspense, lazy } from "react";
import { SocketProvider } from "@/lib/socket";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { saveKnockCooldown } from "@/lib/knock-cooldown";
import type { Message } from "@shared/schema";

const BadgeAnnouncement = lazy(() =>
  import("@/components/badge-announcement").then((m) => ({ default: m.BadgeAnnouncement }))
);

const SEVERITY_LABELS: Record<string, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "Medium",
  low: "Low",
};

function GlobalSocketEvents() {
  const { socket } = useSocket();
  const { toast } = useToast();
  const { user } = useAuth();
  const [badgeEvent, setBadgeEvent] = useState<any | null>(null);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin" || user?.email === "dj55jggg@gmail.com";

  useEffect(() => {
    if (!socket || !user) return;

    // ── DM real-time sync ─────────────────────────────────────────────────────
    // These handlers live here (always-mounted) rather than in MessagesDropdown
    // or DmView (lazy/conditionally mounted) so that badge counts and
    // conversation lists update the instant a message arrives, regardless of
    // which page the user is on or whether those components are rendered yet.
    const handleDmNew = (msg: Message) => {
      // Refresh the unread count badge and the conversation list in the header.
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      // If the DmView for this conversation is currently open, refresh its thread.
      if (msg?.fromId && msg?.toId) {
        const partnerId = msg.fromId === user.id ? msg.toId : msg.fromId;
        queryClient.invalidateQueries({ queryKey: ["/api/messages", user.id, partnerId] });
      }
    };

    const handleMessageRequestNew = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-requests/pending"] });
    };

    const handleMessageRequestUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    };

    socket.on("dm:new", handleDmNew);
    socket.on("message_request:new", handleMessageRequestNew);
    socket.on("message_request:updated", handleMessageRequestUpdated);

    return () => {
      socket.off("dm:new", handleDmNew);
      socket.off("message_request:new", handleMessageRequestNew);
      socket.off("message_request:updated", handleMessageRequestUpdated);
    };
  }, [socket, user]);

  useEffect(() => {
    if (!socket) return;
    const handleBadgeAwarded = (event: any) => setBadgeEvent(event);
    const handleAnnouncement = (_event: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    };
    const handleRestricted = (event: any) => {
      toast({
        title: "Account restricted",
        description: event?.reason || "Your account is temporarily restricted.",
        variant: "destructive",
      });
    };
    const handleRestrictionLifted = () => {
      toast({ title: "Restriction lifted", description: "Your account can participate again." });
    };
    const handleSecurityAdminAlert = (event: any) => {
      if (!isAdmin) return;
      const severity = event?.severity ?? "medium";
      const label = SEVERITY_LABELS[severity] ?? severity;
      const isCritical = severity === "critical" || severity === "high";
      toast({
        title: `Security Alert [${label}]`,
        description: event?.description ?? "A security event was detected.",
        variant: isCritical ? "destructive" : "default",
        duration: isCritical ? 10000 : 6000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-events/count"] });
    };
    const handleKnockDenied = (event: any) => {
      const { roomTitle, cooldownUntil, cooldownMinutes, denialCount, banned, roomId } = event ?? {};
      // Persist cooldown so the knock button in the lobby can reflect it immediately.
      if (roomId) saveKnockCooldown(roomId, { cooldownUntil: cooldownUntil ?? 0, denialCount: denialCount ?? 1, banned: !!banned });
      if (banned) {
        toast({
          title: "🚫 Knock rejected — permanently",
          description: `You've been denied ${denialCount} times and can no longer knock on "${roomTitle}".`,
          variant: "destructive",
          duration: 8000,
        });
      } else {
        const mins = cooldownMinutes ?? 5;
        toast({
          title: "🚪 Knock denied",
          description: `You can try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
          variant: "destructive",
          duration: 6000,
        });
      }
    };

    socket.on("badge:awarded", handleBadgeAwarded);
    socket.on("admin:announcement", handleAnnouncement);
    socket.on("admin:restricted", handleRestricted);
    socket.on("admin:restriction-lifted", handleRestrictionLifted);
    socket.on("security:admin_alert", handleSecurityAdminAlert);
    socket.on("room:knock-denied", handleKnockDenied);
    return () => {
      socket.off("badge:awarded", handleBadgeAwarded);
      socket.off("admin:announcement", handleAnnouncement);
      socket.off("admin:restricted", handleRestricted);
      socket.off("admin:restriction-lifted", handleRestrictionLifted);
      socket.off("security:admin_alert", handleSecurityAdminAlert);
      socket.off("room:knock-denied", handleKnockDenied);
    };
  }, [socket, toast, isAdmin]);

  if (!badgeEvent) return null;
  return (
    <Suspense fallback={null}>
      <BadgeAnnouncement event={badgeEvent} onDismiss={() => setBadgeEvent(null)} />
    </Suspense>
  );
}

export function SocketLayer({ userId, children }: { userId: string; children: React.ReactNode }) {
  return (
    <SocketProvider userId={userId}>
      <GlobalSocketEvents />
      {children}
    </SocketProvider>
  );
}
