import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

const NEAR_TOP = 80;
const NEAR_BOTTOM = 80;
// How long the jump pill stays visible after the last scroll movement.
const IDLE_HIDE_MS = 1400;

interface ScrollJumpButtonProps {
  /**
   * CSS selector for the scrollable container. Falls back to the window if no
   * matching element is found. Defaults to `.app-scrollbar` which is the
   * project's standard scroll surface for full-page layouts.
   */
  targetSelector?: string;
}

export function ScrollJumpButton({ targetSelector = ".app-scrollbar" }: ScrollJumpButtonProps = {}) {
  const [scrollable, setScrollable] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  // The pill is hidden by default and only appears while the user is actively
  // scrolling (or hovering it, so they can complete a click).
  const [isScrolling, setIsScrolling] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolveTarget = useCallback((): HTMLElement | Window => {
    if (targetSelector) {
      const el = document.querySelector<HTMLElement>(targetSelector);
      if (el) {
        targetRef.current = el;
        return el;
      }
    }
    targetRef.current = null;
    return window;
  }, [targetSelector]);

  const recompute = useCallback(() => {
    const target = resolveTarget();
    let scrollTop = 0;
    let viewport = 0;
    let fullHeight = 0;

    if (target === window) {
      const doc = document.documentElement;
      scrollTop = window.scrollY || doc.scrollTop || 0;
      viewport = window.innerHeight || doc.clientHeight || 0;
      fullHeight = Math.max(
        doc.scrollHeight,
        doc.offsetHeight,
        document.body?.scrollHeight ?? 0,
        document.body?.offsetHeight ?? 0,
      );
    } else {
      const el = target as HTMLElement;
      scrollTop = el.scrollTop;
      viewport = el.clientHeight;
      fullHeight = el.scrollHeight;
    }

    const canScroll = fullHeight - viewport > 24;
    setScrollable(canScroll);
    setAtTop(scrollTop <= NEAR_TOP);
    setAtBottom(scrollTop + viewport >= fullHeight - NEAR_BOTTOM);
  }, [resolveTarget]);

  useEffect(() => {
    recompute();
    const target = resolveTarget();
    const handleScrollActivity = () => {
      recompute();
      setIsScrolling(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
        idleTimerRef.current = null;
      }, IDLE_HIDE_MS);
    };
    const onResize = () => recompute();

    target.addEventListener("scroll", handleScrollActivity, { passive: true } as AddEventListenerOptions);
    window.addEventListener("resize", onResize);

    const observer = new MutationObserver(() => recompute());
    observer.observe(document.body, { childList: true, subtree: true });

    const interval = window.setInterval(recompute, 2000);

    return () => {
      target.removeEventListener("scroll", handleScrollActivity);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      window.clearInterval(interval);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [recompute, resolveTarget]);

  // Don't even render if scrolling isn't meaningful here.
  if (!scrollable) return null;
  // Hide unless the user is actively scrolling or pointer is on the pill.
  // We KEEP rendering the wrapper (with opacity 0) so the fade transition feels
  // smooth instead of popping in/out abruptly.
  const visible = isScrolling || isHovering;

  const handleUp = () => {
    const el = targetRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
    import("@/lib/sound-fx").then((m) => m.sfxScrollEdge()).catch(() => {});
  };

  const handleDown = () => {
    const el = targetRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      const doc = document.documentElement;
      const fullHeight = Math.max(
        doc.scrollHeight,
        doc.offsetHeight,
        document.body?.scrollHeight ?? 0,
        document.body?.offsetHeight ?? 0,
      );
      window.scrollTo({ top: fullHeight, behavior: "smooth" });
    }
    import("@/lib/sound-fx").then((m) => m.sfxScrollEdge()).catch(() => {});
  };

  return (
    <div
      className="scroll-jump"
      data-testid="scroll-jump"
      data-visible={visible ? "true" : "false"}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <button
        type="button"
        className="scroll-jump-btn scroll-jump-up"
        onClick={handleUp}
        disabled={atTop}
        tabIndex={visible ? 0 : -1}
        aria-label="Scroll to top"
        data-testid="button-scroll-up"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
      <span className="scroll-jump-spacer" aria-hidden="true" />
      <button
        type="button"
        className="scroll-jump-btn scroll-jump-down"
        onClick={handleDown}
        disabled={atBottom}
        tabIndex={visible ? 0 : -1}
        aria-label="Scroll to bottom"
        data-testid="button-scroll-down"
      >
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
}
