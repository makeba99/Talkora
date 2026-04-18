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

function GlobalSocketEvents() {
  const { socket } = useSocket();
  const { toast } = useToast();
  const [badgeEvent, setBadgeEvent] = useState<any | null>(null);

  useEffect(() => {
    if (!socket) return;
    const handleBadgeAwarded = (event: any) => setBadgeEvent(event);
    const handleAnnouncement = (event: any) => {
      toast({
        title: event?.kind === "maintenance" ? "Maintenance announcement" : "Platform announcement",
        description: event?.title || event?.message || "New announcement from the Platform Owner.",
      });
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
    socket.on("badge:awarded", handleBadgeAwarded);
    socket.on("admin:announcement", handleAnnouncement);
    socket.on("admin:restricted", handleRestricted);
    socket.on("admin:restriction-lifted", handleRestrictionLifted);
    return () => {
      socket.off("badge:awarded", handleBadgeAwarded);
      socket.off("admin:announcement", handleAnnouncement);
      socket.off("admin:restricted", handleRestricted);
      socket.off("admin:restriction-lifted", handleRestrictionLifted);
    };
  }, [socket, toast]);

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
