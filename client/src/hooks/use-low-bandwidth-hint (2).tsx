import { useEffect } from "react";
import { isBoostMode, setBoostMode } from "@/lib/perf-bus";
import { useToast } from "@/hooks/use-toast";

const HINT_KEY = "vextorn:boostHintShown";

interface NetworkInformation {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function getConnection(): NetworkInformation | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

function isSlowConnection(): boolean {
  const c = getConnection();
  if (!c) return false;
  if (c.saveData === true) return true;
  if (c.effectiveType === "slow-2g" || c.effectiveType === "2g") return true;
  if (typeof c.downlink === "number" && c.downlink > 0 && c.downlink < 1.5) return true;
  return false;
}

/**
 * Detects low-bandwidth or low-FPS situations and gently suggests Boost Mode
 * the FIRST time it's noticed. Persists a "shown" flag in localStorage so the
 * user is never nagged twice.
 */
export function useLowBandwidthHint() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isBoostMode()) return;
    try {
      if (window.localStorage.getItem(HINT_KEY) === "1") return;
    } catch {
      return;
    }

    let triggered = false;
    const trigger = (reason: string) => {
      if (triggered) return;
      triggered = true;
      try {
        window.localStorage.setItem(HINT_KEY, "1");
      } catch {
        /* ignore */
      }
      toast({
        title: "Slow device detected",
        description: `Boost Mode can make Vextorn smoother (${reason}).`,
        action: (
          <button
            type="button"
            onClick={() => setBoostMode(true)}
            className="boost-hint-action"
            data-testid="button-boost-hint-enable"
          >
            Turn on Boost
          </button>
        ) as any,
        duration: 9000,
      });
    };

    // 1) Network-info heuristic — fast path.
    const conn = getConnection();
    if (isSlowConnection()) {
      const t = window.setTimeout(() => trigger("slow connection"), 1800);
      return () => window.clearTimeout(t);
    }

    // 2) Frame-time sampling — sample 90 frames; if median ≥ 32ms (~< 32fps)
    //    OR ≥ 25% of frames > 50ms, suggest boost.
    const samples: number[] = [];
    const SAMPLE_COUNT = 90;
    let last = performance.now();
    let raf = 0;
    let cancelled = false;

    const step = (now: number) => {
      if (cancelled) return;
      const dt = now - last;
      last = now;
      // Skip first frame to avoid mount-time jank
      if (samples.length || dt < 200) samples.push(dt);
      if (samples.length < SAMPLE_COUNT) {
        raf = window.requestAnimationFrame(step);
      } else {
        const sorted = [...samples].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const slowFrames = samples.filter((d) => d > 50).length;
        const slowRatio = slowFrames / samples.length;
        if (median >= 32 || slowRatio >= 0.25) {
          trigger("low frame rate");
        }
      }
    };
    // Wait for the lobby to settle a bit before sampling
    const startTimer = window.setTimeout(() => {
      last = performance.now();
      raf = window.requestAnimationFrame(step);
    }, 2500);

    // Watch for dynamic connection changes too
    const onConnChange = () => {
      if (isSlowConnection()) trigger("slow connection");
    };
    conn?.addEventListener?.("change", onConnChange);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      if (raf) window.cancelAnimationFrame(raf);
      conn?.removeEventListener?.("change", onConnChange);
    };
  }, [toast]);
}
