import { Component, type ReactNode } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { VoiceRoom } from "@/components/voice-room";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LogIn, MonitorX, ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { useRoomTabGuard } from "@/hooks/use-room-tab-guard";
import type { Room } from "@shared/schema";

class VoiceRoomErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[VoiceRoom] Render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <div className="flex justify-center">
              <div className="rounded-full bg-red-500/15 p-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Something went wrong</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The room encountered an unexpected error. Try refreshing to rejoin.
              </p>
              {this.state.error.message && (
                <p className="text-xs text-muted-foreground/60 font-mono bg-muted/30 rounded px-3 py-2 text-left break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={() => {
                  this.setState({ error: null });
                  this.props.onReset();
                }}
                data-testid="button-retry-room"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  try { window.close(); } catch (_) {}
                  setTimeout(() => { window.location.href = "/"; }, 200);
                }}
                data-testid="button-back-lobby-error"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Lobby
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const accessKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("key") : null;
  const watchUserId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("watch") || undefined : undefined;

  const { data: room, isLoading, isError, refetch } = useQuery<Room>({
    queryKey: ["/api/rooms", params.id, accessKey],
    enabled: !!params.id,
    queryFn: async () => {
      const query = accessKey ? `?key=${encodeURIComponent(accessKey)}` : "";
      const res = await fetch(`/api/rooms/${encodeURIComponent(params.id || "")}${query}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const tabGuard = useRoomTabGuard(
    user ? (params.id ?? undefined) : undefined,
    user?.id,
  );

  useDocumentMeta({
    title: room?.title ? `${room.title} — ${room.language} voice room` : "Voice room",
    description: room
      ? `Join "${room.title}" on Vextorn — a live ${room.language} ${room.level} voice room. Practice speaking, listen to natives, and improve fluency together.`
      : "Talk live with the room — Vextorn voice rooms keep your conversation private and high-quality.",
    noIndex: !room?.isPublic,
  });

  if (isLoading || authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Sign in to join this room</h2>
          <p className="text-muted-foreground text-sm">You need an account to participate in voice rooms.</p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild data-testid="button-signin-room">
              <a href="/api/login">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </a>
            </Button>
            <Button variant="outline" onClick={() => navigate("/")} data-testid="link-back-lobby">
              Back to Lobby
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!room || isError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <h2 className="text-xl font-semibold">Room not found</h2>
          <p className="text-muted-foreground text-sm">This room may have been deleted, or the room link may be invalid.</p>
          <Button variant="outline" onClick={() => navigate("/")} data-testid="link-back-lobby">
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  // While the tab-guard is still reading localStorage (one React cycle),
  // show a lightweight spinner instead of mounting VoiceRoom prematurely.
  // Mounting VoiceRoom before we know the guard status can trigger WebRTC
  // and socket joins that need to be immediately torn down, and — on slower
  // devices — a brief double-join flicker that looks like a crash.
  if (tabGuard === "checking") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (tabGuard === "duplicate") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-5 max-w-sm px-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-amber-500/15 p-4">
              <MonitorX className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Room already open</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You already have <span className="font-medium text-foreground">{room.title}</span> open
              in another tab. Switch back to that tab to continue.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                try { window.close(); } catch (_) {}
                setTimeout(() => navigate("/"), 200);
              }}
              data-testid="button-close-duplicate-tab"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Lobby
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <VoiceRoomErrorBoundary onReset={() => refetch()}>
      <VoiceRoom
        room={room}
        watchUserId={watchUserId}
        onLeave={(reason) => {
          if (reason === "joined-another-room") {
            window.close();
            setTimeout(() => { window.location.href = "/"; }, 300);
            return;
          }
          if (window.opener) window.close();
          else navigate("/");
        }}
      />
    </VoiceRoomErrorBoundary>
  );
}
