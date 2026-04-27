import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

const NEAR_TOP = 200;
const NEAR_BOTTOM = 200;

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
  const targetRef = useRef<HTMLElement | null>(null);

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
    const onScroll = () => recompute();
    const onResize = () => recompute();

    target.addEventListener("scroll", onScroll, { passive: true } as AddEventListenerOptions);
    window.addEventListener("resize", onResize);

    const observer = new MutationObserver(() => recompute());
    observer.observe(document.body, { childList: true, subtree: true });

    const interval = window.setInterval(recompute, 1500);

    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [recompute, resolveTarget]);

  if (!scrollable) return null;

  const handleUp = () => {
    const el = targetRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
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
  };

  return (
    <div className="scroll-jump" data-testid="scroll-jump">
      <button
        type="button"
        className="scroll-jump-btn scroll-jump-up"
        onClick={handleUp}
        disabled={atTop}
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
        aria-label="Scroll to bottom"
        data-testid="button-scroll-down"
      >
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
}
