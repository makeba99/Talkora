import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { ChevronRight, X, Sparkles, Mic, Globe, Search } from "lucide-react";

const STORAGE_KEY = "vextorn:onboarding:v1";
const STORAGE_STEP_KEY = "vextorn:onboarding:v1:step";

type OnboardingStep = {
  id: string;
  target?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  primary?: string;
  secondary?: string;
};

const STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    icon: Sparkles,
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
  },
  {
    id: "languages",
    target: '[data-tour-target="languages"]',
    icon: Globe,
    title: "Filter by language.",
    body: "Tune the lobby to whatever you're learning today. You can change this anytime — nothing is locked in.",
    primary: "Cool, what's next?",
    secondary: "Skip tour",
  },
  {
    id: "search",
    target: '[data-tour-target="search"]',
    icon: Search,
    title: "Search like a regular.",
    body: "Type anything — a room, a language, a person — and we'll find it instantly.",
    primary: "Got it",
    secondary: "Skip tour",
  },
  {
    id: "done",
    icon: Sparkles,
    title: "You're all set.",
    body: "Wander around. I'll be in the corner if you need me again.",
    primary: "Start exploring",
  },
];

function readSavedStatus(): "completed" | "skipped" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "completed" || v === "skipped" ? v : null;
}

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [reopenVisible, setReopenVisible] = useState(false);
  const [step, setStep] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const saved = window.localStorage.getItem(STORAGE_STEP_KEY);
    const n = saved ? parseInt(saved, 10) : 0;
    return Number.isFinite(n) && n >= 0 && n < STEPS.length ? n : 0;
  });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Auto-launch on first visit (after letting the lobby settle for 1.2s)
  useEffect(() => {
    const status = readSavedStatus();
    if (status === null) {
      const t = setTimeout(() => setActive(true), 1200);
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

  // Recompute target rect + card position whenever step / size changes
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
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    // Catch any layout settling that happens after mount (images loading etc.)
    const interval = window.setInterval(update, 600);
    return () => {
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
          <Sparkles className="w-3.5 h-3.5" />
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
        <p className="onboarding-card-body">{current.body}</p>
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
