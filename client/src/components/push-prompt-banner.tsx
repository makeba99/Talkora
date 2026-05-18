import { useState, useEffect } from "react";
import { Bell, Users, MessageSquare, X, Radio } from "lucide-react";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { useAuth } from "@/hooks/use-auth";

const APP_VERSION = "v12";
const STORAGE_KEY = "vx_push_prompt";
const REPROMPT_DAYS = 7;
const REPROMPT_MS = REPROMPT_DAYS * 24 * 60 * 60 * 1000;

function getKey(userId: string) {
  return `${STORAGE_KEY}_${userId}_${APP_VERSION}`;
}

type DismissState =
  | { type: "never" }
  | { type: "snoozed"; at: number }
  | { type: "permanent" };

function readDismiss(userId: string): DismissState {
  try {
    const raw = localStorage.getItem(getKey(userId));
    if (!raw) return { type: "never" };
    if (raw === "perm") return { type: "permanent" };
    if (raw.startsWith("ts:")) {
      const at = Number(raw.slice(3));
      return isNaN(at) ? { type: "permanent" } : { type: "snoozed", at };
    }
    return { type: "permanent" };
  } catch {
    return { type: "permanent" };
  }
}

function writeSnoozed(userId: string) {
  try { localStorage.setItem(getKey(userId), `ts:${Date.now()}`); } catch {}
}

function writePermanent(userId: string) {
  try { localStorage.setItem(getKey(userId), "perm"); } catch {}
}

const SAMPLE_AVATARS = [
  "/avatars/women-32.jpg",
  "/avatars/men-14.jpg",
  "/avatars/women-61.jpg",
  "/avatars/men-46.jpg",
];

function PresenceAvatars() {
  return (
    <div className="flex items-center mb-3">
      <div className="flex -space-x-2.5">
        {SAMPLE_AVATARS.map((src, i) => (
          <div
            key={i}
            className="relative w-8 h-8 rounded-full border-2 flex-shrink-0"
            style={{
              borderColor: "rgba(18,16,34,0.97)",
              zIndex: SAMPLE_AVATARS.length - i,
            }}
          >
            <img
              src={src}
              alt=""
              className="w-full h-full rounded-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
              style={{
                borderColor: "rgba(18,16,34,0.97)",
                background: i < 3 ? "#22c55e" : "#f59e0b",
                boxShadow: i < 3 ? "0 0 6px rgba(34,197,94,0.7)" : "0 0 6px rgba(245,158,11,0.6)",
                animation: i < 2 ? "pulse-dot 2s ease-in-out infinite" : undefined,
                animationDelay: i === 1 ? "0.7s" : undefined,
              }}
            />
          </div>
        ))}
      </div>
      <div className="ml-3">
        <p className="text-xs font-semibold text-emerald-400 leading-none">4 friends online now</p>
        <p className="text-[10px] text-white/40 mt-0.5">You'd know this instantly with notifications</p>
      </div>
    </div>
  );
}

const BENEFITS = [
  { icon: Users,          text: "See when friends come online" },
  { icon: Radio,          text: "Friend joins a room you follow" },
  { icon: MessageSquare,  text: "Direct messages & replies" },
];

export function PushPromptBanner() {
  const { user } = useAuth();
  const push = usePushSubscription();
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [isReprompt, setIsReprompt] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (push.state === "loading") return;
    if (push.state === "unsupported") return;
    if (push.state === "denied") return;
    if (push.state === "subscribed") return;

    const ds = readDismiss(user.id);
    if (ds.type === "permanent") return;

    let delay = 4000;
    let reprompt = false;

    if (ds.type === "snoozed") {
      const elapsed = Date.now() - ds.at;
      if (elapsed < REPROMPT_MS) return;
      reprompt = true;
      delay = 5000;
    }

    const timer = setTimeout(() => {
      setIsReprompt(reprompt);
      setVisible(true);
      requestAnimationFrame(() => setAnimateIn(true));
    }, delay);

    return () => clearTimeout(timer);
  }, [user, push.state]);

  function slideOut(cb: () => void) {
    setAnimateIn(false);
    setTimeout(() => { setVisible(false); cb(); }, 350);
  }

  function handleAllow() {
    push.subscribe();
    if (user) writePermanent(user.id);
    slideOut(() => {});
  }

  function handleNotNow() {
    if (!user) return;
    if (isReprompt) {
      writePermanent(user.id);
    } else {
      writeSnoozed(user.id);
    }
    slideOut(() => {});
  }

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>

      <div
        className="fixed bottom-5 left-1/2 z-[9999] w-full max-w-xs pointer-events-none"
        style={{ transform: "translateX(-50%)" }}
        aria-live="polite"
      >
        <div
          className="pointer-events-auto mx-3 rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(160deg, rgba(20,17,38,0.98) 0%, rgba(28,22,52,0.98) 100%)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(139,92,246,0.2)",
            boxShadow: [
              "0 24px 48px rgba(0,0,0,0.6)",
              "0 0 0 1px rgba(255,255,255,0.04)",
              "0 0 32px rgba(139,92,246,0.12)",
            ].join(", "),
            transform: animateIn ? "translateY(0) scale(1)" : "translateY(calc(100% + 28px)) scale(0.96)",
            opacity: animateIn ? 1 : 0,
            transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease",
          }}
          data-testid="push-prompt-banner"
        >
          {/* Subtle top accent stripe */}
          <div
            className="h-0.5 w-full"
            style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(99,102,241,0.4), transparent)" }}
          />

          <div className="p-4 pb-3">
            {/* Header row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(99,102,241,0.2))",
                    border: "1px solid rgba(139,92,246,0.35)",
                    boxShadow: "0 2px 12px rgba(139,92,246,0.2)",
                  }}
                >
                  <Bell className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">
                    {isReprompt ? "Still want to stay connected?" : "Know when friends are online"}
                  </p>
                  <p className="text-[10px] text-white/40 leading-tight mt-0.5">
                    {isReprompt ? "One tap to stay in the loop." : "Never miss a moment on Vextorn"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleNotNow}
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white/25 hover:text-white/55 hover:bg-white/8 transition-colors ml-1 -mt-0.5"
                aria-label="Dismiss"
                data-testid="button-push-close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Presence avatars preview */}
            <PresenceAvatars />

            {/* Benefit bullets */}
            <div className="space-y-1.5 mb-3.5">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(139,92,246,0.15)",
                      border: "1px solid rgba(139,92,246,0.2)",
                    }}
                  >
                    <Icon className="w-3 h-3 text-violet-400" />
                  </div>
                  <span className="text-xs text-white/65 leading-tight">{text}</span>
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <button
              onClick={handleAllow}
              disabled={push.isLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-60 mb-2"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.9), rgba(99,102,241,0.8))",
                border: "1px solid rgba(139,92,246,0.5)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(139,92,246,0.35), 0 1px 0 rgba(255,255,255,0.1) inset",
              }}
              data-testid="button-push-allow"
            >
              <Bell className="w-3.5 h-3.5" />
              {push.isLoading ? "Enabling…" : "Enable notifications"}
            </button>

            <button
              onClick={handleNotNow}
              className="w-full py-1.5 text-xs text-white/35 hover:text-white/55 transition-colors text-center"
              data-testid="button-push-dismiss"
            >
              {isReprompt ? "No thanks, don't ask again" : "Not now"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
