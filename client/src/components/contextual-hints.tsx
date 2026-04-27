import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { X, Lightbulb } from "lucide-react";
import { subscribeToHints, type HintPayload } from "@/lib/hints";

type LiveHint = HintPayload & {
  pos: { top: number; left: number; placement: "top" | "bottom" };
  uid: number;
};

export function ContextualHints() {
  const [hint, setHint] = useState<LiveHint | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compute = useCallback((p: HintPayload): LiveHint => {
    const cardWidth = 280;
    const cardEstHeight = 110;
    const margin = 12;
    const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
    const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;

    if (p.anchor && p.anchor.getBoundingClientRect) {
      const rect = p.anchor.getBoundingClientRect();
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
      return { ...p, pos: { top, left, placement }, uid: Date.now() };
    }
    // No anchor: pin to top-center
    return {
      ...p,
      pos: {
        top: 80,
        left: viewportW / 2 - cardWidth / 2,
        placement: "bottom",
      },
      uid: Date.now(),
    };
  }, []);

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setHint(null);
  }, []);

  useEffect(() => {
    return subscribeToHints((payload) => {
      const live = compute(payload);
      setHint(live);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        setHint(null);
      }, payload.durationMs ?? 6500);
    });
  }, [compute]);

  // Reposition the hint on window resize / scroll while it's visible
  useLayoutEffect(() => {
    if (!hint?.anchor) return;
    const update = () => {
      setHint((h) => (h ? compute({ ...h }) : h));
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [hint?.uid, compute]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  if (!hint) return null;

  return (
    <div
      key={hint.uid}
      className={`ctx-hint is-${hint.pos.placement}`}
      style={{ top: hint.pos.top, left: hint.pos.left, width: 280 }}
      role="status"
      aria-live="polite"
      data-testid={`ctx-hint-${hint.id}`}
    >
      <div className="ctx-hint-head">
        <span className="ctx-hint-medallion" aria-hidden="true">
          <Lightbulb className="w-3.5 h-3.5" />
        </span>
        <h4 className="ctx-hint-title" data-testid="text-ctx-hint-title">
          {hint.title}
        </h4>
        <button
          type="button"
          className="ctx-hint-close"
          onClick={dismiss}
          aria-label="Dismiss hint"
          data-testid="button-ctx-hint-close"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <p className="ctx-hint-body">{hint.body}</p>
    </div>
  );
}
