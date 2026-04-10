import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Globe, Users, Shield, Headphones, MessageSquare } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20">
              <Mic className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold">
              Connect<span className="text-primary">2</span>Talk
            </span>
          </div>
          <Button asChild data-testid="button-login-nav">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </nav>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
          <div className="max-w-6xl mx-auto px-4 py-20 md:py-32 relative">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight font-serif">
                  Practice Languages{" "}
                  <span className="text-primary">Live</span> with Real People
                </h1>
                <p className="text-lg text-muted-foreground max-w-lg">
                  Join voice rooms to practice speaking with native speakers and fellow learners from around the world. No schedules, no booking - just jump in and talk.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button size="lg" asChild data-testid="button-get-started">
                    <a href="/api/login">Get Started Free</a>
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Shield className="w-4 h-4" /> Free forever
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-4 h-4" /> 12+ languages
                  </span>
                </div>
              </div>
              <div className="relative hidden md:block">
                <div className="relative rounded-md overflow-hidden border bg-card p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Headphones className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Spanish Conversation</p>
                      <p className="text-xs text-muted-foreground">Intermediate</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 border-2 border-primary/40 flex items-center justify-center text-sm font-bold"
                      >
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground">
                      +
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1 h-4 bg-primary rounded-full animate-sound-wave"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">Live now</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-16">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-10">Why Connect2Talk?</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="p-6 space-y-3">
                <Mic className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Voice-First Learning</h3>
                <p className="text-sm text-muted-foreground">
                  Practice speaking and listening with real-time voice rooms powered by WebRTC.
                </p>
              </Card>
              <Card className="p-6 space-y-3">
                <Users className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Global Community</h3>
                <p className="text-sm text-muted-foreground">
                  Connect with native speakers and learners at every skill level from around the world.
                </p>
              </Card>
              <Card className="p-6 space-y-3">
                <MessageSquare className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Social Features</h3>
                <p className="text-sm text-muted-foreground">
                  Follow friends, send direct messages, and get notified when they join rooms.
                </p>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          Connect2Talk &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
