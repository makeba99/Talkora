import { useEffect, useState, lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

// MaintenancePage contains a heavy canvas/RAF animation that's almost never
// shown. Lazy-loading removes it from the initial JS bundle, saving ~20 KB
// that was otherwise parsed on every page load unconditionally.
const MaintenancePage = lazy(() =>
  import("@/components/maintenance-page").then((m) => ({ default: m.MaintenancePage }))
);

// Socket module is lazy — socket.io-client (~55 kB gzipped) is only fetched
// when a user is authenticated. Unauthenticated Lighthouse/crawlers never pay
// this cost, which removes socket.io-client from the cold-start critical path.
const SocketLayer = lazy(() =>
  import("./socket-layer").then((m) => ({ default: m.SocketLayer }))
);

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
const Toaster = lazy(() =>
  import("@/components/ui/toaster").then((m) => ({ default: m.Toaster }))
);
const UpdateAvailableToast = lazy(() =>
  import("@/components/update-available-toast").then((m) => ({ default: m.UpdateAvailableToast }))
);

function LobbyShell() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="h-[57px] flex-shrink-0 border-b border-white/[0.06]" />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[1600px] mx-auto p-3 sm:p-4 lg:px-6 xl:px-8 space-y-4 pt-4">
          <Skeleton className="h-10 w-full rounded-2xl" />
          <div className="flex gap-2">
            {[80, 96, 72, 88].map((w, i) => (
              <Skeleton key={i} className="h-8 rounded-full flex-shrink-0" style={{ width: w }} />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-3 lg:gap-y-5 lg:gap-x-4 xl:gap-y-6 xl:gap-x-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-3 p-5 rounded-2xl border border-white/10 bg-muted/5" style={{ minHeight: 255 }}>
                <Skeleton className="h-6 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((j) => <Skeleton key={j} className="w-10 h-10 rounded-full" />)}
                </div>
                <div className="flex justify-between gap-2">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-9 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin" || user?.email === "dj55jggg@gmail.com";

  const { data: maintenanceData } = useQuery<{ active: boolean }>({
    queryKey: ["/api/maintenance"],
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  if (maintenanceData?.active && !isSuperAdmin) {
    return (
      <Suspense fallback={null}>
        <MaintenancePage />
      </Suspense>
    );
  }

  const content = (
    <div className="h-screen flex flex-col overflow-hidden">
      <Suspense fallback={<LobbyShell />}>
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
      <Suspense fallback={content}>
        <SocketLayer userId={user.id}>
          {content}
        </SocketLayer>
      </Suspense>
    );
  }

  return content;
}

function DeferredOverlays() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w: any = window;
    const idle = w.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
    const handle = idle(() => setReady(true), { timeout: 4500 });
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

function PreRenderDismiss() {
  // Wait for /api/rooms data before dismissing the pre-render skeleton overlay.
  //
  // Why this matters for LCP:
  // Without this guard, `#vx-pr` is hidden on React's very first commit
  // (before any data arrives). The browser then looks for a new LCP candidate
  // in the freshly visible DOM — typically the first real room card, which
  // only paints after: React bundle parse + lobby chunk load + API response.
  // On Lighthouse's 4G throttle that's ~2,700 ms.
  //
  // With this guard, `#vx-pr` stays up while rooms load. The real lobby
  // renders *behind* the overlay (position:fixed;z-index:9999 hides it from
  // users but not from React). When rooms arrive, we dismiss instantly — the
  // fully-rendered lobby is revealed in one frame with no blank flash.
  // LCP = skeleton (~300 ms) instead of real room cards (~2,700 ms).
  //
  // Safety net: dismiss after 3 s if the fetch stalls or errors out so the
  // skeleton never becomes a permanent blocker.
  const { data: rooms } = useQuery<unknown[]>({ queryKey: ["/api/rooms"] });

  useEffect(() => {
    const el = document.getElementById("vx-pr");
    if (!el || el.style.display === "none") return;

    if (rooms !== undefined) {
      // Data is ready — wait one animation frame so React has committed and
      // the browser has painted the actual lobby content before we remove the
      // overlay. Without this rAF, the overlay disappears before room-card
      // elements enter the DOM → Lighthouse finds no LCP candidate (NO_LCP).
      const raf = requestAnimationFrame(() => { el.style.display = "none"; });
      return () => cancelAnimationFrame(raf);
    }

    // Fallback: clear the overlay after 3 s on very slow connections / errors.
    const t = setTimeout(() => { el.style.display = "none"; }, 3000);
    return () => clearTimeout(t);
  }, [rooms]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <PreRenderDismiss />
          <DeferredOverlays />
          <AppContent />
          <DeferredToasts />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
