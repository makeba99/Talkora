import { useCallback, useEffect, useRef, useState } from "react";
import { Infinity as InfinityIcon } from "lucide-react";

/* Steps run from solo (1) on the left up through 12, with the
   Unlimited (∞) option pinned to the right end of the rail. */
const STEPS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Solo", short: "1" },
  { value: 2, label: "2 people", short: "2" },
  { value: 3, label: "3 people", short: "3" },
  { value: 4, label: "4 people", short: "4" },
  { value: 6, label: "6 people", short: "6" },
  { value: 8, label: "8 people", short: "8" },
  { value: 10, label: "10 people", short: "10" },
  { value: 12, label: "12 people", short: "12" },
  { value: 0, label: "Unlimited", short: "∞" },
];

const KNOB = 26;

interface NeuParticipantSliderProps {
  value: number;
  onChange: (v: number) => void;
  testId?: string;
}

export function NeuParticipantSlider({ value, onChange, testId }: NeuParticipantSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.value === value));
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const current = STEPS[safeIndex];

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const usable = rect.width - KNOB;
      const x = Math.max(0, Math.min(usable, clientX - rect.left - KNOB / 2));
      const ratio = usable === 0 ? 0 : x / usable;
      const idx = Math.round(ratio * (STEPS.length - 1));
      const next = STEPS[idx].value;
      if (next !== value) onChange(next);
    },
    [onChange, value],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      setFromClientX(clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, setFromClientX]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && safeIndex > 0) {
      e.preventDefault();
      onChange(STEPS[safeIndex - 1].value);
    } else if (e.key === "ArrowRight" && safeIndex < STEPS.length - 1) {
      e.preventDefault();
      onChange(STEPS[safeIndex + 1].value);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(STEPS[0].value);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(STEPS[STEPS.length - 1].value);
    }
  };

  const ratio = safeIndex / (STEPS.length - 1);
  const fillWidth = `calc(${KNOB / 2}px + ${ratio} * (100% - ${KNOB}px))`;

  return (
    <div className="space-y-2" data-testid={testId}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={STEPS.length - 1}
        aria-valuenow={safeIndex}
        aria-valuetext={current.label}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => {
          setDragging(true);
          setFromClientX(e.clientX);
        }}
        onTouchStart={(e) => {
          setDragging(true);
          setFromClientX(e.touches[0].clientX);
        }}
        className="neu-participant-track relative w-full rounded-full select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/40"
        style={{ height: 30 }}
        data-testid={testId ? `${testId}-track` : undefined}
      >
        {/* Fill from start to knob center */}
        <div
          className="neu-participant-fill pointer-events-none absolute left-0 top-0 bottom-0 rounded-full"
          style={{
            width: fillWidth,
            transition: dragging ? "none" : "width 220ms cubic-bezier(0.4, 0.0, 0.2, 1)",
          }}
        />

        {/* Step tick marks */}
        <div className="pointer-events-none absolute inset-0 flex items-center" style={{ paddingLeft: KNOB / 2, paddingRight: KNOB / 2 }}>
          <div className="relative flex-1 h-px">
            {STEPS.map((s, i) => {
              const left = (i / (STEPS.length - 1)) * 100;
              const isPast = i <= safeIndex;
              return (
                <span
                  key={s.value}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-200 ${
                    isPast ? "w-1 h-1 bg-white/40" : "w-1 h-1 bg-white/12"
                  }`}
                  style={{ left: `${left}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Knob */}
        <div
          className="neu-participant-knob absolute top-1/2 -translate-y-1/2 flex items-center justify-center text-[10px] font-bold text-white/90"
          style={{
            width: KNOB,
            height: KNOB,
            left: `calc(${ratio} * (100% - ${KNOB}px))`,
            transition: dragging ? "none" : "left 220ms cubic-bezier(0.4, 0.0, 0.2, 1)",
          }}
          data-testid={testId ? `${testId}-knob` : undefined}
        >
          {current.value === 0 ? <InfinityIcon className="w-3 h-3" /> : current.short}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-white/40 flex items-center gap-1">
          <span className="font-medium">1</span>
          <span>min</span>
        </span>
        <span
          className="text-orange-200/90 font-semibold tracking-wide"
          data-testid={testId ? `${testId}-label` : undefined}
        >
          {current.value === 0
            ? "∞ Unlimited room"
            : current.value === 1
              ? "1 person · solo"
              : `${current.value} people`}
        </span>
        <span className="text-white/40 flex items-center gap-1">
          <InfinityIcon className="w-2.5 h-2.5" />
          <span>Unlimited</span>
        </span>
      </div>
    </div>
  );
}
