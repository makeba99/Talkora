import { useEffect, useState } from "react";
import { Zap, ZapOff } from "lucide-react";
import { isBoostMode, onBoostModeChange, setBoostMode } from "@/lib/perf-bus";
import { useToast } from "@/hooks/use-toast";

export function BoostModeToggle() {
  const [enabled, setEnabled] = useState(() => isBoostMode());
  const { toast } = useToast();

  useEffect(() => {
    return onBoostModeChange(setEnabled);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setBoostMode(next);
    toast({
      title: next ? "Boost mode ON" : "Boost mode OFF",
      description: next
        ? "Animations paused & heavy visuals trimmed for faster scrolling and longer battery life."
        : "Full visuals and background animations are back on.",
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`boost-toggle ${enabled ? "is-on" : ""}`}
      aria-pressed={enabled}
      aria-label={enabled ? "Turn off boost mode" : "Turn on boost mode"}
      title={enabled ? "Boost mode is ON — tap to restore full visuals" : "Boost mode — tap for faster scrolling on mobile"}
      data-testid="button-boost-mode"
    >
      {enabled ? (
        <Zap className="w-[15px] h-[15px]" strokeWidth={2.5} />
      ) : (
        <ZapOff className="w-[15px] h-[15px]" strokeWidth={2.2} />
      )}
      <span className="boost-toggle-label">{enabled ? "Boost on" : "Boost"}</span>
    </button>
  );
}
