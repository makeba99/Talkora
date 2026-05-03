import { useEffect, useState, Suspense, lazy } from "react";
import { SocketProvider } from "@/lib/socket";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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
    socket.on("badge:awarded", handleBadgeAwarded);
    socket.on("admin:announcement", handleAnnouncement);
    socket.on("admin:restricted", handleRestricted);
    socket.on("admin:restriction-lifted", handleRestrictionLifted);
    socket.on("security:admin_alert", handleSecurityAdminAlert);
    return () => {
      socket.off("badge:awarded", handleBadgeAwarded);
      socket.off("admin:announcement", handleAnnouncement);
      socket.off("admin:restricted", handleRestricted);
      socket.off("admin:restriction-lifted", handleRestrictionLifted);
      socket.off("security:admin_alert", handleSecurityAdminAlert);
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
