import { useState, useEffect } from "react";
import { Bell, X, BellOff } from "lucide-react";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { useAuth } from "@/hooks/use-auth";

const APP_VERSION = "v10";
const STORAGE_KEY = "vx_push_prompt";

function getDismissedKey(userId: string) {
  return `${STORAGE_KEY}_${userId}_${APP_VERSION}`;
}

export function PushPromptBanner() {
  const { user } = useAuth();
  const push = usePushSubscription();
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (push.state === "loading") return;
    if (push.state === "unsupported") return;
    if (push.state === "denied") return;
    if (push.state === "subscribed") return;

    const key = getDismissedKey(user.id);
    if (localStorage.getItem(key)) return;

    const timer = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => setAnimateIn(true));
    }, 3500);

    return () => clearTimeout(timer);
  }, [user, push.state]);

  function dismiss(permanent: boolean) {
    setAnimateIn(false);
    setTimeout(() => setVisible(false), 350);
    if (permanent && user) {
      localStorage.setItem(getDismissedKey(user.id), "1");
    }
  }

  async function handleAllow() {
    push.subscribe();
    dismiss(true);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 z-[9999] w-full max-w-sm pointer-events-none"
      style={{ transform: "translateX(-50%)" }}
      aria-live="polite"
    >
      <div
        className="pointer-events-auto mx-3 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(18,16,34,0.97) 0%, rgba(26,22,48,0.97) 100%)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.15), 0 0 24px rgba(139,92,246,0.08)",
          transform: animateIn ? "translateY(0)" : "translateY(calc(100% + 24px))",
          opacity: animateIn ? 1 : 0,
          transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease",
        }}
        data-testid="push-prompt-banner"
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.15))", border: "1px solid rgba(139,92,246,0.3)" }}
          >
            <Bell className="w-5 h-5 text-violet-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">Stay in the loop</p>
            <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
              Get notified about new rooms, messages, and announcements — even when the tab is closed.
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleAllow}
                disabled={push.isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, rgba(139,92,246,0.85), rgba(99,102,241,0.75))",
                  border: "1px solid rgba(139,92,246,0.5)",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(139,92,246,0.3)",
                }}
                data-testid="button-push-allow"
              >
                <Bell className="w-3 h-3" />
                Enable notifications
              </button>
              <button
                onClick={() => dismiss(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white/45 hover:text-white/70 transition-colors"
                data-testid="button-push-dismiss"
              >
                Not now
              </button>
            </div>
          </div>

          <button
            onClick={() => dismiss(true)}
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors mt-0.5"
            aria-label="Dismiss"
            data-testid="button-push-close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.4), transparent)" }} />
      </div>
    </div>
  );
}
