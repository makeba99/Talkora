import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useUser } from "@/lib/user";
import { Mic, Globe, Zap } from "lucide-react";
import { VextornMark } from "@/components/vextorn-logo";

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      await login(username.trim());
    } catch (err: any) {
      setError(err.message || "Failed to join");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <VextornMark size={64} className="drop-shadow-[0_0_20px_rgba(155,92,255,0.45)]" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-chart-3 rounded-full animate-pulse-glow" />
            </div>
          </div>
          <div>
            <h1
              className="text-4xl tracking-tight"
              style={{ fontWeight: 800, letterSpacing: "-0.04em" }}
              data-testid="text-app-title"
            >
              Vextorn
            </h1>
            <p
              className="text-muted-foreground mt-2 text-[11px] font-semibold"
              style={{ letterSpacing: "0.22em" }}
            >
              TALK · SHARE · BELONG
            </p>
          </div>
        </div>

        <Card className="p-6 space-y-6 glow-cyan">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-2 p-3 rounded-md bg-muted/50">
              <Globe className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground text-center">12+ Languages</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 rounded-md bg-muted/50">
              <Mic className="w-5 h-5 text-secondary" />
              <span className="text-xs text-muted-foreground text-center">Voice-First</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 rounded-md bg-muted/50">
              <Zap className="w-5 h-5 text-chart-3" />
              <span className="text-xs text-muted-foreground text-center">Instant Join</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="username">
                Choose your username
              </label>
              <Input
                id="username"
                data-testid="input-username"
                placeholder="Enter a username to get started..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="h-11"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" data-testid="text-login-error">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!username.trim() || isLoading}
              data-testid="button-join"
            >
              {isLoading ? "Joining..." : "Join Vextorn"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            No sign-up required. Pick a name and start talking.
          </p>
        </Card>
      </div>
    </div>
  );
}
