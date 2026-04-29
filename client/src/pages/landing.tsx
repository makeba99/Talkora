import { useEffect, useRef } from "react";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemePicker } from "@/components/theme-picker";
import { Mic, Globe, Users, Shield, Headphones, MessageSquare } from "lucide-react";
import { VextornMark } from "@/components/vextorn-logo";
import { useTheme } from "@/lib/theme";

function HeroOrb({
  color,
  size,
  top,
  left,
  delay,
}: {
  color: string;
  size: number;
  top: string;
  left: string;
  delay: number;
}) {
  return (
    <div
      className="hero-orb"
      style={{
        width: size,
        height: size,
        top,
        left,
        background: color,
        animationDelay: `${delay}s`,
        animationDuration: `${6 + delay}s`,
        opacity: 0.55,
      }}
    />
  );
}

export default function LandingPage() {
  useDocumentMeta({
    title: "Talk. Share. Belong.",
    description:
      "Vextorn is a real-time voice community for language practice. Join live audio rooms by language and level — speak, listen, and belong.",
  });
  const { theme, currentThemeDef } = useTheme();
  const isDark = currentThemeDef.isDark;

  const orbColor1 = `hsl(var(--primary) / 0.18)`;
  const orbColor2 = `hsl(var(--secondary) / 0.14)`;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">

      {/* Aurora animated background layer */}
      {theme === "aurora" && (
        <div className="aurora-bg fixed inset-0 -z-10" />
      )}

      {/* Sticky nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2.5 animate-slide-in-left">
            <VextornMark size={36} className="drop-shadow-[0_0_10px_rgba(155,92,255,0.35)]" />
            <div className="flex flex-col leading-none">
              <span
                className={`text-lg ${theme === "neon-cyberpunk" ? "neon-text" : ""}`}
                style={{
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                }}
                data-testid="brand-nav-wordmark"
              >
                Vextorn
              </span>
              <span
                className="hidden sm:inline text-[10px] font-semibold mt-0.5 bg-gradient-to-r from-[#9D86FF] via-[#7B5CF6] to-[#3D8FFF] bg-clip-text text-transparent"
                style={{ letterSpacing: "0.04em" }}
              >
                Talk. Share. Belong.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 animate-fade-in">
            <ThemePicker />
            <Button asChild data-testid="button-login-nav">
              <a href="/api/login">Sign In</a>
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* ── HERO ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Ambient orbs */}
          <HeroOrb color={orbColor1} size={520} top="-10%" left="-8%" delay={0} />
          <HeroOrb color={orbColor2} size={400} top="20%" left="55%" delay={2.5} />
          <HeroOrb color={orbColor1} size={280} top="60%" left="10%" delay={1.2} />

          <div className="max-w-6xl mx-auto px-4 py-20 md:py-32 relative">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/8 text-primary text-xs font-medium animate-fade-in"
                  style={{ animationDelay: "0.1s" }}
                >
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Live voice rooms, now open
                </div>

                <h1
                  className={`text-4xl md:text-5xl lg:text-6xl font-bold leading-tight font-serif animate-slide-in-up ${
                    theme === "neon-cyberpunk" ? "neon-text" : ""
                  }`}
                  style={{ animationDelay: "0.15s" }}
                >
                  Practice Languages{" "}
                  <span className="text-primary">Live</span> with Real People
                </h1>

                <p
                  className="text-lg text-muted-foreground max-w-lg animate-slide-in-up"
                  style={{ animationDelay: "0.25s" }}
                >
                  Join voice rooms to practice speaking with native speakers and fellow
                  learners from around the world. No schedules, no booking — just jump
                  in and talk.
                </p>

                <div
                  className="flex items-center gap-3 flex-wrap animate-slide-in-up"
                  style={{ animationDelay: "0.35s" }}
                >
                  <Button size="lg" asChild data-testid="button-get-started">
                    <a href="/api/login">Get Started Free</a>
                  </Button>
                </div>

                <div
                  className="flex items-center gap-4 text-sm text-muted-foreground animate-fade-in"
                  style={{ animationDelay: "0.45s" }}
                >
                  <span className="flex items-center gap-1">
                    <Shield className="w-4 h-4" /> Free forever
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-4 h-4" /> 12+ languages
                  </span>
                </div>
              </div>

              {/* Mock room card preview */}
              <div
                className="relative hidden md:block animate-scale-in"
                style={{ animationDelay: "0.3s" }}
              >
                <div className="relative rounded-xl overflow-hidden border bg-card/80 backdrop-blur-md p-6 space-y-4 shadow-xl">
                  {/* Subtle accent glow behind the card */}
                  <div
                    className="absolute inset-0 opacity-10 rounded-xl"
                    style={{
                      background: `radial-gradient(ellipse at 30% 20%, hsl(var(--primary) / 0.6), transparent 60%)`,
                    }}
                  />

                  <div className="flex items-center gap-3 relative">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Headphones className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Spanish Conversation</p>
                      <p className="text-xs text-muted-foreground">Intermediate</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1 text-xs text-primary font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Live
                    </div>
                  </div>

                  <div className="flex gap-2 relative">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 border-2 border-primary/40 flex items-center justify-center text-sm font-bold animate-float-up"
                        style={{ animationDelay: `${i * 0.4}s` }}
                      >
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground">
                      +
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 relative">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-primary animate-sound-wave"
                        style={{
                          height: `${8 + (i % 3) * 6}px`,
                          animationDelay: `${i * 0.12}s`,
                        }}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">4 speaking</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ──────────────────────────────────────────── */}
        <section className="border-t bg-muted/30 py-16 relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-4">
            <h2
              className="text-2xl font-bold text-center mb-10 animate-slide-in-up"
            >
              Why Vextorn?
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: <Mic className="w-8 h-8 text-primary" />,
                  title: "Voice-First Learning",
                  body: "Practice speaking and listening with real-time voice rooms powered by WebRTC.",
                  delay: "0.1s",
                },
                {
                  icon: <Users className="w-8 h-8 text-primary" />,
                  title: "Global Community",
                  body: "Connect with native speakers and learners at every skill level from around the world.",
                  delay: "0.2s",
                },
                {
                  icon: <MessageSquare className="w-8 h-8 text-primary" />,
                  title: "Social Features",
                  body: "Follow friends, send direct messages, and get notified when they join rooms.",
                  delay: "0.3s",
                },
              ].map((feature) => (
                <Card
                  key={feature.title}
                  className="p-6 space-y-3 animate-slide-in-up hover:border-primary/40 transition-colors duration-300"
                  style={{ animationDelay: feature.delay }}
                >
                  {feature.icon}
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          Vextorn &copy; {new Date().getFullYear()} · Talk. Share. Belong.
        </div>
      </footer>
    </div>
  );
}
