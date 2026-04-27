import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from "react";
import { ChevronRight, X, Sparkles, Mic, Globe, Search, Hammer, UserCircle, Users, Compass, Pin, Bell } from "lucide-react";

const STORAGE_KEY = "vextorn:onboarding:v2";
const STORAGE_STEP_KEY = "vextorn:onboarding:v2:step";

type OnboardingStep = {
  id: string;
  target?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  primary?: string;
  secondary?: string;
  /** Optional tab to switch to in the lobby's discovery row before this step renders. */
  tab?: "rooms" | "top-speakers" | "famous-users";
  /** If true, fire the ghost-typing demo when this step becomes active. */
  ghostType?: string;
  /** If true, render confetti when this step becomes active. */
  celebrate?: boolean;
};

const STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    icon: Compass,
    title: "Hey — welcome to Vextorn.",
    body: "I'll be your guide for the next sixty seconds. Ready?",
    primary: "Show me around",
    secondary: "Skip for now",
  },
  {
    id: "rooms",
    target: '[data-tour-target="rooms"]',
    icon: Mic,
    title: "These are voice rooms.",
    body: "People drop in, talk, listen, learn languages, hang out. Tap a card to peek inside — no pressure to speak.",
    primary: "Got it",
    secondary: "Skip tour",
    tab: "rooms",
  },
  {
    id: "languages",
    target: '[data-tour-target="languages"]',
    icon: Globe,
    title: "Filter by language.",
    body: "Tune the lobby to whatever you're learning today. You can change this anytime — nothing is locked in.",
    primary: "Cool, what's next?",
    secondary: "Skip tour",
    tab: "rooms",
  },
  {
    id: "people",
    target: '[data-tour-target="people"]',
    icon: Users,
    title: "Meet the regulars.",
    body: "Top speakers and famous voices live here. Follow someone to know when they're online — then pop into their room.",
    primary: "Nice — keep going",
    secondary: "Skip tour",
    tab: "top-speakers",
  },
  {
    id: "search",
    target: '[data-tour-target="search"]',
    icon: Search,
    title: "Search like a regular.",
    body: "Type anything — a room, a language, a person — and we'll find it instantly. Watch:",
    primary: "Cool, what's next?",
    secondary: "Skip tour",
    tab: "rooms",
    ghostType: "spanish",
  },
  {
    id: "create-room",
    target: '[data-testid="button-create-room"]',
    icon: Hammer,
    title: "Spin up your own room.",
    body: "Pick a topic, a language, a vibe. You're the host — others knock to come in.",
    primary: "Got it",
    secondary: "Skip tour",
    tab: "rooms",
  },
  {
    id: "profile",
    target: '[data-testid="button-profile-dropdown"]',
    icon: UserCircle,
    title: "This is you.",
    body: "Tap your avatar to open your **orbit menu** — a ring of satellites for friends, messages, themes, and your decoration. Everything personal lives here.",
    primary: "Show me the orbit",
    secondary: "Skip tour",
  },
  {
    id: "orbit-pin",
    target: '[data-testid="button-profile-dropdown"]',
    icon: Pin,
    title: "Pin what matters to your header.",
    body: "Inside the orbit, each satellite has a **pin** — pin Messages, Notifications, Themes, or Community to put a quick-access icon next to your avatar. Unpin anything you don't need on screen.",
    primary: "Got it — what about alerts?",
    secondary: "Skip tour",
  },
  {
    id: "orbit-notifs",
    target: '[data-testid="button-profile-dropdown"]',
    icon: Bell,
    title: "You'll never miss a thing — pinned or not.",
    body: "Even if you **don't pin** Messages or Notifications to the header, you'll still get the **red dot on your avatar** the moment something new arrives. Open the orbit anytime to read it. Pinning is just a shortcut, never a requirement.",
    primary: "Perfect — what's next?",
    secondary: "Skip tour",
  },
  {
    id: "done",
    icon: Sparkles,
    title: "You're all set.",
    body: "Wander around. I'll pop a hint here and there as you explore — and I'm always in the corner if you want the tour again.",
    primary: "Start exploring",
    celebrate: true,
  },
];

/** Tiny inline renderer that turns **bold** segments into <strong> nodes. */
function renderRichBody(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function readSavedStatus(): "completed" | "skipped" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "completed" || v === "skipped" ? v : null;
}

type OnboardingTourProps = {
  onStepChange?: (current: OnboardingStep | null, prev: OnboardingStep | null) => void;
};

export function OnboardingTour({ onStepChange }: OnboardingTourProps = {}) {
  const [active, setActive] = useState(false);
  const [reopenVisible, setReopenVisible] = useState(false);
  const [step, setStep] = useState<number>(7);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const prevStepRef = useRef<{ active: boolean; step: number }>({ active: false, step });

  // Auto-launch on first visit (after letting the lobby settle for 1.2s)
  useEffect(() => {
    const status = readSavedStatus();
    // eslint-disable-next-line no-console
    console.log("[onboarding] mount status=", status);
    if (status === null) {
      const t = setTimeout(() => setActive(true), 200);
      return () => clearTimeout(t);
    } else {
      // Already finished or skipped — show the relaunch capsule after a beat
      const t = setTimeout(() => setReopenVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_STEP_KEY, String(step));
    }
  }, [step]);

  const start = useCallback(() => {
    setStep(0);
    setActive(true);
    setReopenVisible(false);
  }, []);

  const skip = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "skipped");
    }
    setActive(false);
    setTimeout(() => setReopenVisible(true), 400);
  }, []);

  const complete = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "completed");
      window.localStorage.setItem(STORAGE_STEP_KEY, "0");
    }
    setStep(0);
    setActive(false);
    setTimeout(() => setReopenVisible(true), 400);
  }, []);

  const next = useCallback(() => {
    setStep((s) => {
      if (s + 1 >= STEPS.length) {
        complete();
        return 0;
      }
      return s + 1;
    });
  }, [complete]);

  const goTo = useCallback((i: number) => {
    if (i >= 0 && i < STEPS.length) setStep(i);
  }, []);

  const current = STEPS[step];

  // Notify the host (lobby) about step transitions so it can switch tabs,
  // start a ghost-typing demo, etc.
  useEffect(() => {
    const prev = prevStepRef.current;
    const wasActive = prev.active;
    const wasStep = prev.step;
    if (active) {
      const prevStep = wasActive ? STEPS[wasStep] : null;
      onStepChange?.(current, prevStep);
    } else if (wasActive) {
      // Tour just closed
      onStepChange?.(null, STEPS[wasStep]);
    }
    prevStepRef.current = { active, step };
  }, [active, step, current, onStepChange]);

  // Recompute target rect + card position whenever step / size changes.
  // Uses staggered retries so we catch elements that mount slightly after a
  // step change (e.g. when switching the discovery tab for the People step).
  useLayoutEffect(() => {
    if (!active) {
      setTargetRect(null);
      setCardPos(null);
      return;
    }
    if (!current?.target) {
      setTargetRect(null);
      setCardPos(null);
      return;
    }

    const update = () => {
      const el = document.querySelector(current.target!);
      if (!el) {
        setTargetRect(null);
        setCardPos(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      const cardWidth = 360;
      const cardEstHeight = 230;
      const margin = 16;
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;

      let top = rect.bottom + margin;
      let placement: "top" | "bottom" = "bottom";
      if (top + cardEstHeight > viewportH - margin) {
        if (rect.top - margin - cardEstHeight > margin) {
          top = rect.top - margin - cardEstHeight;
          placement = "top";
        } else {
          top = Math.max(margin, viewportH - cardEstHeight - margin);
        }
      }

      let left = rect.left + rect.width / 2 - cardWidth / 2;
      left = Math.max(margin, Math.min(left, viewportW - cardWidth - margin));

      setCardPos({ top, left, placement });
    };

    update();
    const retry1 = window.setTimeout(update, 80);
    const retry2 = window.setTimeout(update, 220);
    const retry3 = window.setTimeout(update, 480);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const interval = window.setInterval(update, 600);
    return () => {
      window.clearTimeout(retry1);
      window.clearTimeout(retry2);
      window.clearTimeout(retry3);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(interval);
    };
  }, [active, current]);

  // Bring the highlighted target into view on each step
  useEffect(() => {
    if (!active || !current?.target) return;
    const el = document.querySelector(current.target);
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [active, step, current]);

  // Esc to skip
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, skip]);

  if (!active) {
    return reopenVisible ? (
      <button
        type="button"
        className="onboarding-relaunch"
        onClick={start}
        data-testid="button-onboarding-relaunch"
        aria-label="Restart guided tour"
        title="Restart tour"
      >
        <span className="onboarding-relaunch-medallion">
          <Compass className="w-3.5 h-3.5" />
        </span>
        <span className="onboarding-relaunch-label">Tour</span>
      </button>
    ) : null;
  }

  const Icon = current.icon;
  const isCenter = !current.target || !targetRect;

  return (
    <div className="onboarding-root" role="dialog" aria-modal="true" aria-label={current.title}>
      {/* Spotlight: a darkened SVG with a feathered cutout over the target */}
      <svg className="onboarding-spotlight" aria-hidden="true">
        <defs>
          <mask id="onboarding-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 10}
                y={targetRect.top - 10}
                width={targetRect.width + 20}
                height={targetRect.height + 20}
                rx="22"
                ry="22"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(8, 9, 16, 0.62)"
          mask="url(#onboarding-mask)"
        />
      </svg>

      {/* Pulse ring around the target */}
      {targetRect && (
        <div
          className="onboarding-pulse"
          style={{
            top: targetRect.top - 10,
            left: targetRect.left - 10,
            width: targetRect.width + 20,
            height: targetRect.height + 20,
          }}
          aria-hidden="true"
        />
      )}

      {/* Sculpted guide card */}
      <div
        ref={cardRef}
        className={`onboarding-card ${isCenter ? "is-center" : `is-anchored is-${cardPos?.placement || "bottom"}`}`}
        style={
          isCenter || !cardPos
            ? undefined
            : { top: cardPos.top, left: cardPos.left, width: 360 }
        }
        data-testid={`onboarding-card-${current.id}`}
      >
        {current.celebrate && <Confetti />}
        <div className="onboarding-card-head">
          <span className="onboarding-card-medallion" aria-hidden="true">
            <Icon className="w-4 h-4" />
          </span>
          <button
            type="button"
            className="onboarding-card-close"
            onClick={skip}
            aria-label="Skip tour"
            data-testid="button-onboarding-close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <h3 className="onboarding-card-title" data-testid="text-onboarding-title">
          {current.title}
        </h3>
        <p className="onboarding-card-body">{renderRichBody(current.body)}</p>
        <div className="onboarding-card-footer">
          <div className="onboarding-dots" role="tablist" aria-label="Tour progress">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`onboarding-dot ${i === step ? "is-active" : ""} ${i < step ? "is-done" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`Go to step ${i + 1}`}
                aria-current={i === step}
                data-testid={`onboarding-dot-${i}`}
              />
            ))}
          </div>
          <div className="onboarding-card-actions">
            {current.secondary && (
              <button
                type="button"
                className="onboarding-btn onboarding-btn-ghost"
                onClick={skip}
                data-testid="button-onboarding-skip"
              >
                {current.secondary}
              </button>
            )}
            {current.primary && (
              <button
                type="button"
                className="onboarding-btn onboarding-btn-primary"
                onClick={next}
                data-testid="button-onboarding-primary"
              >
                <span>{current.primary}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tiny CSS-only confetti burst from card center for the final step. */
function Confetti() {
  const particles = useMemo(() => {
    const palette = ["violet", "gold", "teal", "white"] as const;
    return Array.from({ length: 28 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.5;
      const dist = 70 + Math.random() * 110;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      return {
        dx: Math.round(dx),
        dy: Math.round(dy),
        rot: Math.round((Math.random() - 0.5) * 720),
        delay: Math.round(Math.random() * 90),
        duration: 950 + Math.round(Math.random() * 700),
        color: palette[i % palette.length],
        shape: i % 2 === 0 ? "square" : "circle",
        size: 6 + Math.round(Math.random() * 4),
      };
    });
  }, []);

  return (
    <div className="onboarding-confetti" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className={`confetti-piece confetti-${p.color} confetti-${p.shape}`}
          style={
            {
              width: `${p.size}px`,
              height: `${p.size}px`,
              marginLeft: `-${p.size / 2}px`,
              marginTop: `-${p.size / 2}px`,
              ["--dx" as any]: `${p.dx}px`,
              ["--dy" as any]: `${p.dy}px`,
              ["--rot" as any]: `${p.rot}deg`,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
