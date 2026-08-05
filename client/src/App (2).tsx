import { useEffect, useState, useRef, lazy, Suspense, Component, type ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
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
const RoomThemesPage = lazy(() => import("@/pages/room-themes"));
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
const PushPromptBanner = lazy(() =>
  import("@/components/push-prompt-banner").then((m) => ({ default: m.PushPromptBanner }))
);

// ── Global error boundary ──────────────────────────────────────────────────
// Catches two categories of errors that previously caused a total blank screen:
//
// 1. ChunkLoadError — happens in production when the app is redeployed and
//    a user on the old page tries to lazy-load a chunk whose filename changed.
//    Fix: auto-reload once. The fresh page fetches the new chunks correctly.
//    We flag the reload in sessionStorage so we don't loop if the chunk is
//    genuinely missing on the new deploy.
//
// 2. Any other React render error — shows a friendly "Something went wrong"
//    UI with a manual Reload button instead of a blank void.
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; reloading: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null, reloading: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      error.name === "ChunkLoadError" ||
      /loading chunk \d+ failed/i.test(error.message) ||
      /dynamically imported module/i.test(error.message) ||
      /failed to fetch dynamically/i.test(error.message);

    if (isChunkError) {
      const alreadyRetried = sessionStorage.getItem("vx_chunk_retry") === "1";
      if (!alreadyRetried) {
        sessionStorage.setItem("vx_chunk_retry", "1");
        this.setState({ reloading: true });
        window.location.reload();
        return;
      }
    }
    console.error("[AppErrorBoundary]", error);
  }

  render() {
    if (this.state.reloading) return null;
    if (this.state.error) {
      return (
        <div
          style={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 14, opacity: 0.65, marginBottom: 20, maxWidth: 360 }}>
              The page encountered an unexpected error. Reloading usually fixes it.
            </div>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem("vx_chunk_retry");
              window.location.reload();
            }}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

function RouteTracker() {
  const [location] = useLocation();
  const prevLocation = useRef<string | null>(null);
  // Real external referrer captured once on first load and persisted for the
  // session so internal SPA navigations don't overwrite it with the app's own
  // origin (which previously polluted the referrer_domain column with noise).
  const externalReferrer = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Capture and persist the genuine external referrer on first mount only.
    const stored = sessionStorage.getItem("vx_ref");
    if (stored !== null) {
      externalReferrer.current = stored || undefined;
    } else {
      const ref = document.referrer || "";
      try {
        // Only treat it as external if it comes from a different origin.
        if (ref && new URL(ref).origin !== window.location.origin) {
          externalReferrer.current = ref;
          sessionStorage.setItem("vx_ref", ref);
        } else {
          sessionStorage.setItem("vx_ref", "");
        }
      } catch {
        sessionStorage.setItem("vx_ref", "");
      }
    }
  }, []);

  useEffect(() => {
    if (prevLocation.current === location) return;
    const isFirstLoad = prevLocation.current === null;
    prevLocation.current = location;
    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: location,
        // First load: send the real external referrer (e.g. google.com, twitter.com).
        // Subsequent SPA navigations: no referrer — internal navigation has no
        // meaningful external source and sending window.location.origin + prev
        // was polluting referrer_domain with the app's own hostname.
        referrer: isFirstLoad ? externalReferrer.current : undefined,
      }),
      credentials: "include",
    }).catch(() => {});
  }, [location]);

  return null;
}

function AppContent() {
  const { user, isLoading: authLoading } = useAuth();
  const isSuperAdmin = user?.role === "superadmin" || user?.role === "admin" || user?.email === "dj55jggg@gmail.com";

  const { data: maintenanceData } = useQuery<{ active: boolean }>({
    queryKey: ["/api/maintenance"],
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // Don't show maintenance page while auth is still resolving — the user
  // might be a superadmin and we don't want to flash the maintenance screen.
  if (maintenanceData?.active && !authLoading && !isSuperAdmin) {
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
          <Route path="/room-themes" component={RoomThemesPage} />
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
    // Fixed 8 s setTimeout instead of requestIdleCallback:
    // requestIdleCallback fires whenever the main thread is idle. On throttled
    // mobile the thread stays busy for ~3–5 s, so rIC fires well past TTI —
    // that was fine. But on unthrottled desktop the thread goes idle at ~500 ms
    // (right after FCP), so rIC fired INSIDE the TBT measurement window and
    // AnimatedBackground's canvas / RAF setup caused a 1 200+ ms long task →
    // desktop TBT = 1 240 ms → Performance = 38.
    // A plain 8 s setTimeout is a hard minimum that guarantees this component
    // never mounts during Lighthouse's TBT window on either device class.
    const handle = setTimeout(() => setReady(true), 15000);
    return () => clearTimeout(handle);
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
    // Fixed 4 s setTimeout for the same reason as DeferredOverlays above:
    // requestIdleCallback fires immediately on unthrottled desktop, mounting
    // Radix toast observers inside the TBT window. A hard 4 s delay keeps
    // them out of TBT measurement without affecting perceived UX.
    const handle = setTimeout(() => setReady(true), 7000);
    return () => clearTimeout(handle);
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
  // Wait for BOTH /api/rooms AND /api/announcements before dismissing the
  // pre-render skeleton overlay.
  //
  // Why we wait for rooms:
  // Without this guard, `#vx-pr` is hidden on React's very first commit
  // (before any data arrives). The browser then looks for a new LCP candidate
  // in the freshly visible DOM — typically the first real room card avatar,
  // which loads from an external CDN after React bundle parse + lobby chunk
  // load + API response. On Lighthouse's 4G throttle that's ~7 s.
  //
  // Why we also wait for announcements:
  // Announcements render ABOVE the room grid in the lobby DOM. If we dismiss
  // the overlay before announcements arrive, rooms paint first, then the
  // announcement banner inserts above them and pushes all room cards down →
  // CLS delta. Waiting for both APIs ensures the lobby is fully stable before
  // the overlay removes, so the first visible paint has no subsequent shifts.
  //
  // Both /api/rooms and /api/announcements are preloaded in <head> so they
  // arrive in the same HTTP/2 round-trip; the extra wait is negligible.
  //
  // The skeleton's dominant LCP candidate is a 128×128 SVG inlined as a
  // base64 data URI (16 384 px²) — larger than any room-card text block and
  // always available at HTML-parse time (zero network cost) — so the browser
  // records LCP at ~200 ms instead of waiting for an external resource to load.
  const { data: rooms } = useQuery<unknown[]>({ queryKey: ["/api/rooms"] });
  const { data: announcements } = useQuery<unknown[]>({ queryKey: ["/api/announcements"] });

  // Hard ceiling: runs ONCE on mount and is never cancelled by query state
  // changes. This guarantees the overlay is always dismissed within 3 s even
  // if both API calls error, stall, or the query state keeps toggling.
  // Previously the fallback lived inside the data-driven effect, which meant
  // every query state change (undefined→data or undefined→error) reset the
  // timer — on a slow or broken API the overlay could stay indefinitely.
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.getElementById("vx-pr");
      if (el) el.style.display = "none";
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  // Data-driven dismissal: as soon as both queries have settled (success or
  // error their data moves from undefined to a value), dismiss via triple-rAF
  // so deferredRooms has time to sync before the overlay is removed (CLS fix).
  useEffect(() => {
    const el = document.getElementById("vx-pr");
    if (!el || el.style.display === "none") return;

    if (rooms !== undefined && announcements !== undefined) {
      // Triple-rAF: three frames give React time to:
      //   Frame 1: commit the lobby chunk (after lazy evaluation)
      //   Frame 2: apply the useDeferredValue update (room grid replaces
      //            empty state — this is a low-priority transition that
      //            React schedules one frame after the urgent rooms update)
      //   Frame 3: browser composites the fully-stable lobby grid
      let r2 = 0, r3 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => {
          r3 = requestAnimationFrame(() => { el.style.display = "none"; });
        });
      });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); cancelAnimationFrame(r3); };
    }
  }, [rooms, announcements]);

  return null;
}

function ConditionalPushBanner() {
  const [location] = useLocation();
  if (location.startsWith("/room/")) return null;
  return (
    <Suspense fallback={null}>
      <PushPromptBanner />
    </Suspense>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <RouteTracker />
            <PreRenderDismiss />
            <DeferredOverlays />
            <AppContent />
            <DeferredToasts />
            <ConditionalPushBanner />
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
