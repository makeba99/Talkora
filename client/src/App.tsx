import { useEffect, useState, lazy, Suspense, startTransition } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { SocketProvider } from "@/lib/socket";
import { useSocket } from "@/lib/socket";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const Lobby = lazy(() => import("@/pages/lobby"));
const RoomPage = lazy(() => import("@/pages/room"));
const DmPage = lazy(() => import("@/pages/dm"));
const AdminPage = lazy(() => import("@/pages/admin"));
const TeachersPage = lazy(() => import("@/pages/teachers"));
const PaymentMethodsPage = lazy(() => import("@/pages/payment-methods"));
const AnimatedBackground = lazy(() =>
  import("@/components/animated-background").then((m) => ({ default: m.AnimatedBackground }))
);
const PwaInstallBanner = lazy(() =>
  import("@/components/pwa-install-banner").then((m) => ({ default: m.PwaInstallBanner }))
);

/* Toast / update / badge chrome doesn't need to block first paint. The toast
 * queue itself is just module-level state in `use-toast`, so calls to
 * `toast(...)` keep working even before the visual `<Toaster />` mounts —
 * the queued messages will render as soon as the lazy chunk arrives. */
const Toaster = lazy(() =>
  import("@/components/ui/toaster").then((m) => ({ default: m.Toaster }))
);
const UpdateAvailableToast = lazy(() =>
  import("@/components/update-available-toast").then((m) => ({ default: m.UpdateAvailableToast }))
);
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

  // BadgeAnnouncement is lazy — it only renders a celebratory popover when an
  // event arrives, so we don't need it parsed until that first event fires.
  if (!badgeEvent) return null;
  return (
    <Suspense fallback={null}>
      <BadgeAnnouncement event={badgeEvent} onDismiss={() => setBadgeEvent(null)} />
    </Suspense>
  );
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

  const routeFallback = (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-4 w-64">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );

  const content = (
    <div className="h-screen flex flex-col overflow-hidden">
      <Suspense fallback={routeFallback}>
        <Switch>
          <Route path="/" component={Lobby} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/teachers" component={TeachersPage} />
          <Route path="/teachers/:teacherId" component={TeachersPage} />
          <Route path="/payment-methods" component={PaymentMethodsPage} />
          <Route path="/room/:id" component={RoomPage} />
          <Route path="/messages/:userId" component={DmPage} />
          <Route>
            <Lobby />
          </Route>
        </Switch>
      </Suspense>
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

function DeferredOverlays() {
  // Defer mounting non-critical visual chrome until after the main route paints,
  // so the LCP candidate isn't held back by canvas/banner JS parsing.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w: any = window;
    const idle = w.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
    const handle = idle(() => setReady(true), { timeout: 2000 });
    return () => {
      if (w.cancelIdleCallback && typeof handle === "number") w.cancelIdleCallback(handle);
    };
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <AnimatedBackground />
      <PwaInstallBanner />
    </Suspense>
  );
}

function DeferredToasts() {
  // Toaster + UpdateAvailableToast aren't on the LCP critical path — both
  // render nothing visible at first paint anyway (Toaster has an empty queue,
  // UpdateAvailableToast only triggers when a new SW takes over). Defer their
  // import until after the main route paints to shave initial JS.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w: any = window;
    const idle = w.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
    const handle = idle(() => setReady(true), { timeout: 2000 });
    return () => {
      if (w.cancelIdleCallback && typeof handle === "number") w.cancelIdleCallback(handle);
    };
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <UpdateAvailableToast />
      <Toaster />
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <DeferredOverlays />
          <AppContent />
          <DeferredToasts />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
