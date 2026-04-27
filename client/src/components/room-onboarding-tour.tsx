import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { ChevronRight, X, Sparkles, Mic, Video, MonitorPlay, MessageSquare, Youtube, BookOpen, Gamepad2, Share2, Users, Settings, LogOut, Bot, Compass } from "lucide-react";
import type { User } from "@shared/schema";

const STORAGE_KEY = "vextorn:room-onboarding:v1";
const STORAGE_STEP_KEY = "vextorn:room-onboarding:v1:step";
/** Auto-launch only for accounts created within this many days. */
const NEW_USER_WINDOW_DAYS = 14;

type RoomTourStep = {
  id: string;
  target?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  primary?: string;
  secondary?: string;
  /** Skip this step entirely if the predicate returns false (e.g. host-only steps). */
  showIf?: (ctx: { isOwner: boolean }) => boolean;
};

const STEPS: RoomTourStep[] = [
  {
    id: "welcome",
    icon: Compass,
    title: "Welcome to your first room.",
    body: "Quick 60-second tour of everything inside this room — mic, camera, AI tutor, books, games and more. You can skip anytime.",
    primary: "Show me around",
    secondary: "Skip tour",
  },
  {
    id: "mic",
    target: '[data-testid="button-toggle-mute"]',
    icon: Mic,
    title: "Your microphone.",
    body: "Tap to **mute or unmute**. Listening only is totally fine — most people lurk for a while before they jump in. The host can also limit who can speak.",
    primary: "Got it",
    secondary: "Skip tour",
  },
  {
    id: "camera",
    target: '[data-testid="button-toggle-video"]',
    icon: Video,
    title: "Camera (optional).",
    body: "Turn your **camera** on if you want face-to-face. Your video appears as a tile next to your avatar — great for tutoring or close conversations.",
    primary: "Next",
    secondary: "Skip tour",
  },
  {
    id: "screen",
    target: '[data-testid="button-screen-share"]',
    icon: MonitorPlay,
    title: "Share your screen.",
    body: "Show a slide deck, a website, your code editor — anything. Everyone in the room sees your screen in real time.",
    primary: "Next",
    secondary: "Skip tour",
  },
  {
    id: "ai-tutor",
    target: '[data-testid="button-toggle-ai-tutor"]',
    icon: Bot,
    title: "Bring in the AI tutor.",
    body: "Stuck on a word, grammar point or pronunciation? Wake the **AI tutor** and ask out loud. It listens to the room and answers naturally — like a real teacher dropping in.",
    primary: "Cool, what else?",
    secondary: "Skip tour",
  },
  {
    id: "chat",
    target: '[data-testid="tab-chat"]',
    icon: MessageSquare,
    title: "Text chat alongside voice.",
    body: "Drop links, share emojis, send GIFs — perfect for things you don't want to interrupt the conversation for. Pinned messages stay at the top.",
    primary: "Next",
    secondary: "Skip tour",
  },
  {
    id: "youtube",
    target: '[data-testid="tab-youtube"]',
    icon: Youtube,
    title: "Watch YouTube together.",
    body: "Search any video and play it for the whole room — synced for everyone. Great for music, lessons, news clips or quick reaction parties.",
    primary: "Next",
    secondary: "Skip tour",
  },
  {
    id: "read",
    target: '[data-testid="tab-read"]',
    icon: BookOpen,
    title: "Read together.",
    body: "Open a **book or article** and read aloud as a group. The page scrolls in sync, so newcomers always know where you are. Ideal for book clubs and reading practice.",
    primary: "Next",
    secondary: "Skip tour",
  },
  {
    id: "games",
    target: '[data-testid="tab-chess"]',
    icon: Gamepad2,
    title: "Play games while you talk.",
    body: "Pull up **chess** (more games coming) and play someone in the room while keeping the conversation going. Spectators can watch live.",
    primary: "Next",
    secondary: "Skip tour",
  },
  {
    id: "share",
    target: '[data-testid="tab-golive"]',
    icon: Share2,
    title: "Go live & invite friends.",
    body: "Generate a **share link**, post the room outside Vextorn, or stream it. Anyone who taps the link lands straight in here.",
    primary: "Next",
    secondary: "Skip tour",
  },
  {
    id: "people",
    target: '[data-testid="tab-people"]',
    icon: Users,
    title: "Who's here.",
    body: "See **everyone in the room** — host, co-hosts and guests. Tap a name to follow, DM, or (if you're host) promote them.",
    primary: "Next",
    secondary: "Skip tour",
  },
  {
    id: "host-settings",
    target: '[data-testid="button-host-settings"]',
    icon: Settings,
    title: "Host controls.",
    body: "As the host you can rename the room, set who can talk / use camera / share screen, swap the room theme, change the welcome message, and pick co-hosts. Everything lives behind this gear.",
    primary: "Next",
    secondary: "Skip tour",
    showIf: ({ isOwner }) => isOwner,
  },
  {
    id: "guest-info",
    target: '[data-testid="button-non-host-settings"]',
    icon: Settings,
    title: "Room info.",
    body: "Peek at the room's rules, language, level and host. The actual settings (who can talk, themes, etc.) belong to the host — you'll see them if you ever host your own.",
    primary: "Next",
    secondary: "Skip tour",
    showIf: ({ isOwner }) => !isOwner,
  },
  {
    id: "leave",
    target: '[data-testid="button-leave-room"]',
    icon: LogOut,
    title: "Leave whenever you like.",
    body: "Tap to step out. The room stays open for everyone else — you can pop back anytime from the lobby. No goodbye necessary.",
    primary: "Almost done",
    secondary: "Skip tour",
  },
  {
    id: "done",
    icon: Sparkles,
    title: "That's the room.",
    body: "Have fun. The little Tour button in the corner brings this back anytime you need a refresher.",
    primary: "Start chatting",
  },
];

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

function isNewUser(user: User | null | undefined): boolean {
  if (!user?.createdAt) return false;
  const created = new Date(user.createdAt as any).getTime();
  if (!isFinite(created)) return false;
  const ageDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
  return ageDays <= NEW_USER_WINDOW_DAYS;
}

type RoomOnboardingTourProps = {
  user: User | null | undefined;
  isOwner: boolean;
};

export function RoomOnboardingTour({ user, isOwner }: RoomOnboardingTourProps) {
  // Filter the steps once per render based on host vs guest context.
  const visibleSteps = STEPS.filter((s) => !s.showIf || s.showIf({ isOwner }));

  const [active, setActive] = useState(false);
  const [reopenVisible, setReopenVisible] = useState(false);
  const [step, setStep] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Auto-launch only for newly registered users who have not seen the tour.
  useEffect(() => {
    const status = readSavedStatus();
    const fresh = isNewUser(user);
    if (status === null && fresh) {
      // Let the room mount + audio init settle before popping the spotlight.
      const t = setTimeout(() => setActive(true), 1400);
      return () => clearTimeout(t);
    }
    // Returning new user (skipped/completed) → show tiny relaunch capsule.
    // Old / non-new users see nothing at all unless they previously interacted.
    if (status !== null && fresh) {
      const t = setTimeout(() => setReopenVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [user]);

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
      if (s + 1 >= visibleSteps.length) {
        complete();
        return 0;
      }
      return s + 1;
    });
  }, [complete, visibleSteps.length]);

  const goTo = useCallback((i: number) => {
    if (i >= 0 && i < visibleSteps.length) setStep(i);
  }, [visibleSteps.length]);

  // Clamp the step index if visibleSteps shrank (e.g. host status changed).
  useEffect(() => {
    if (step >= visibleSteps.length) setStep(Math.max(0, visibleSteps.length - 1));
  }, [step, visibleSteps.length]);

  const current = visibleSteps[step];

  // Position the card relative to its target. Falls back to center if the
  // target element is not in the DOM (e.g. the side panel was collapsed).
  useLayoutEffect(() => {
    if (!active || !current) {
      setTargetRect(null);
      setCardPos(null);
      return;
    }
    if (!current.target) {
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
      const cardEstHeight = 240;
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
    const retry2 = window.setTimeout(update, 240);
    const retry3 = window.setTimeout(update, 520);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const interval = window.setInterval(update, 700);
    return () => {
      window.clearTimeout(retry1);
      window.clearTimeout(retry2);
      window.clearTimeout(retry3);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(interval);
    };
  }, [active, current]);

  // Bring the highlighted target into view on each step.
  useEffect(() => {
    if (!active || !current?.target) return;
    const el = document.querySelector(current.target);
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [active, step, current]);

  // Esc to skip.
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
        className="onboarding-relaunch onboarding-relaunch-room"
        onClick={start}
        data-testid="button-room-onboarding-relaunch"
        aria-label="Restart room tour"
        title="Restart room tour"
      >
        <span className="onboarding-relaunch-medallion">
          <Compass className="w-3.5 h-3.5" />
        </span>
        <span className="onboarding-relaunch-label">Tour</span>
      </button>
    ) : null;
  }

  if (!current) return null;

  const Icon = current.icon;
  const isCenter = !current.target || !targetRect;

  return (
    <div className="onboarding-root" role="dialog" aria-modal="true" aria-label={current.title}>
      <svg className="onboarding-spotlight" aria-hidden="true">
        <defs>
          <mask id="room-onboarding-mask">
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
          mask="url(#room-onboarding-mask)"
        />
      </svg>

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

      <div
        ref={cardRef}
        className={`onboarding-card ${isCenter ? "is-center" : `is-anchored is-${cardPos?.placement || "bottom"}`}`}
        style={
          isCenter || !cardPos
            ? undefined
            : { top: cardPos.top, left: cardPos.left, width: 360 }
        }
        data-testid={`room-onboarding-card-${current.id}`}
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
            data-testid="button-room-onboarding-close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <h3 className="onboarding-card-title" data-testid="text-room-onboarding-title">
          {current.title}
        </h3>
        <p className="onboarding-card-body">{renderRichBody(current.body)}</p>
        <div className="onboarding-card-footer">
          <div className="onboarding-dots" role="tablist" aria-label="Tour progress">
            {visibleSteps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`onboarding-dot ${i === step ? "is-active" : ""} ${i < step ? "is-done" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`Go to step ${i + 1}`}
                aria-current={i === step}
                data-testid={`room-onboarding-dot-${i}`}
              />
            ))}
          </div>
          <div className="onboarding-card-actions">
            {current.secondary && (
              <button
                type="button"
                className="onboarding-btn onboarding-btn-ghost"
                onClick={skip}
                data-testid="button-room-onboarding-skip"
              >
                {current.secondary}
              </button>
            )}
            {current.primary && (
              <button
                type="button"
                className="onboarding-btn onboarding-btn-primary"
                onClick={next}
                data-testid="button-room-onboarding-primary"
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
