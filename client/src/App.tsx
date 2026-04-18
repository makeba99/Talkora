import { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { AnimatedBackground } from "@/components/animated-background";
import { SocketProvider } from "@/lib/socket";
import { useSocket } from "@/lib/socket";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeAnnouncement } from "@/components/badge-announcement";
import Lobby from "@/pages/lobby";
import RoomPage from "@/pages/room";
import DmPage from "@/pages/dm";
import AdminPage from "@/pages/admin";
import TeachersPage from "@/pages/teachers";
import PaymentMethodsPage from "@/pages/payment-methods";

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

  return <BadgeAnnouncement event={badgeEvent} onDismiss={() => setBadgeEvent(null)} />;
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  const content = (
    <div className="h-screen flex flex-col overflow-hidden">
      <Switch>
        <Route path="/" component={Lobby} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/teachers" component={TeachersPage} />
        <Route path="/payment-methods" component={PaymentMethodsPage} />
        <Route path="/room/:id" component={RoomPage} />
        <Route path="/messages/:userId" component={DmPage} />
        <Route>
          <Lobby />
        </Route>
      </Switch>
    </div>
  );

  if (user) {
    return (
      <SocketProvider userId={user.id}>
        <GlobalSocketEvents />
        {content}
      </SocketProvider>
    );
  }

  return content;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AnimatedBackground />
          <AppContent />
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
