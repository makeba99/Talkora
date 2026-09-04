import { useEffect, useState } from "react";

/**
 * Full-viewport fireworks burst for badge awards in live rooms.
 * Pure CSS/DOM — no GIF dependency, works offline after first paint.
 */
export function BadgeFireworksOverlay({
  active,
  durationMs = 8000,
  onDone,
}: {
  active: boolean;
  durationMs?: number;
  onDone?: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    setVisible(true);
    setTick(0);
    const start = Date.now();
    let raf = 0;
    const loop = () => {
      const elapsed = Date.now() - start;
      setTick(Math.floor(elapsed / 50));
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(loop);
      } else {
        setVisible(false);
        onDone?.();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs, onDone]);

  if (!visible) return null;

  const BURST_COUNT = 6;
  return (
    <div
      aria-hidden
      data-testid="badge-fireworks-overlay"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9997,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: BURST_COUNT }).map((_, b) => {
        const burstTick = (tick + b * 31) % 60;
        const progress = burstTick / 60;
        const cx = 12 + ((b * 17 + Math.floor(tick / 60) * 13) % 76);
        const cy = 12 + ((b * 23 + Math.floor(tick / 60) * 11) % 58);
        const hue = (b * 72 + Math.floor(tick / 60) * 137) % 360;
        const burst = progress > 0.15;
        const alpha = burst ? Math.max(0, 1 - (progress - 0.15) / 0.85) : progress / 0.15;
        if (!burst) {
          return (
            <div
              key={b}
              style={{
                position: "absolute",
                left: `${cx}%`,
                bottom: `${(1 - progress / 0.15) * 45}%`,
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: `hsl(${hue},100%,90%)`,
                boxShadow: `0 0 6px 3px hsl(${hue},100%,70%)`,
                opacity: alpha,
              }}
            />
          );
        }
        const r = ((progress - 0.15) / 0.85) * 22;
        return (
          <div key={b} style={{ position: "absolute", left: `${cx}%`, top: `${cy}%` }}>
            {Array.from({ length: 18 }).map((_, p) => {
              const angle = (p / 18) * Math.PI * 2;
              const px = Math.cos(angle) * r;
              const py = Math.sin(angle) * r + (progress - 0.15) * 8;
              const pHue = (hue + p * 20) % 360;
              return (
                <div
                  key={p}
                  style={{
                    position: "absolute",
                    left: `${px}vw`,
                    top: `${py}vh`,
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: `hsl(${pHue},100%,75%)`,
                    boxShadow: `0 0 5px 2px hsl(${pHue},100%,65%)`,
                    transform: "translate(-50%,-50%)",
                    opacity: alpha * (0.6 + (p % 3) * 0.13),
                  }}
                />
              );
            })}
            {Array.from({ length: 8 }).map((_, s) => {
              const sa = (s / 8) * Math.PI * 2 + 0.4;
              const sr = ((progress - 0.15) / 0.85) * 30;
              return (
                <div
                  key={`s${s}`}
                  style={{
                    position: "absolute",
                    left: `${Math.cos(sa) * sr}vw`,
                    top: `${Math.sin(sa) * sr}vh`,
                    fontSize: 11,
                    transform: "translate(-50%,-50%)",
                    opacity: alpha * 0.9,
                  }}
                >
                  ✦
                </div>
              );
            })}
          </div>
        );
      })}
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={`sp${i}`}
          style={{
            position: "absolute",
            left: `${(i * 4.2 + tick * 0.45) % 100}%`,
            top: `${(tick * 0.75 + i * 17) % 105 - 5}%`,
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: `hsl(${(i * 18 + tick * 3) % 360},100%,80%)`,
            opacity: 0.35 + Math.abs(Math.sin(tick * 0.1 + i)) * 0.5,
          }}
        />
      ))}
    </div>
  );
}
