import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { VoiceRoom } from "@/components/voice-room";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Room } from "@shared/schema";

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: room, isLoading } = useQuery<Room>({
    queryKey: ["/api/rooms", params.id],
    enabled: !!params.id,
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

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <h2 className="text-xl font-semibold">Room not found</h2>
          <p className="text-muted-foreground text-sm">This room may have been deleted.</p>
          <Button variant="outline" onClick={() => navigate("/")} data-testid="link-back-lobby">
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  return (
    <VoiceRoom
      room={room}
      onLeave={() => {
        if (window.opener) {
          window.close();
        } else {
          navigate("/");
        }
      }}
    />
  );
}
