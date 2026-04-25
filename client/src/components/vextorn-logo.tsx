import { useId } from "react";

interface VextornMarkProps {
  size?: number;
  className?: string;
}

export function VextornMark({ size = 32, className }: VextornMarkProps) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label="Vextorn"
      className={className}
    >
      <defs>
        <radialGradient id={`vx-talk-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#8B92FF" />
          <stop offset="60%" stopColor="#5B6CFF" />
          <stop offset="100%" stopColor="#3D4BE0" />
        </radialGradient>
        <radialGradient id={`vx-share-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#C896FF" />
          <stop offset="60%" stopColor="#9B5CFF" />
          <stop offset="100%" stopColor="#7C3AED" />
        </radialGradient>
        <radialGradient id={`vx-belong-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FF9FC4" />
          <stop offset="60%" stopColor="#FF6BA1" />
          <stop offset="100%" stopColor="#E1428A" />
        </radialGradient>
      </defs>
      <g transform="rotate(-6 80 80)">
        <circle cx="80" cy="56" r="36" fill={`url(#vx-talk-${uid})`} />
        <circle
          cx="54"
          cy="100"
          r="36"
          fill={`url(#vx-share-${uid})`}
          style={{ mixBlendMode: "multiply" }}
        />
        <circle
          cx="106"
          cy="100"
          r="36"
          fill={`url(#vx-belong-${uid})`}
          style={{ mixBlendMode: "multiply" }}
        />
        <ellipse cx="71" cy="44" rx="6" ry="3.5" fill="#fff" opacity="0.55" />
        <ellipse cx="45" cy="88" rx="6" ry="3.5" fill="#fff" opacity="0.45" />
        <ellipse cx="97" cy="88" rx="6" ry="3.5" fill="#fff" opacity="0.45" />
      </g>
    </svg>
  );
}

interface VextornWordmarkProps {
  className?: string;
}

export function VextornWordmark({ className }: VextornWordmarkProps) {
  return (
    <span
      className={className}
      style={{
        fontWeight: 800,
        letterSpacing: "-0.04em",
        fontFamily:
          'Inter, "SF Pro Display", "Helvetica Neue", system-ui, -apple-system, sans-serif',
      }}
    >
      Vextorn
    </span>
  );
}

interface VextornLockupProps {
  size?: number;
  showTagline?: boolean;
  className?: string;
  wordmarkClassName?: string;
  taglineClassName?: string;
}

export function VextornLockup({
  size = 36,
  showTagline = true,
  className,
  wordmarkClassName,
  taglineClassName,
}: VextornLockupProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <VextornMark size={size} />
      <div className="flex flex-col leading-none">
        <VextornWordmark
          className={
            wordmarkClassName ?? "text-lg font-extrabold tracking-tight"
          }
        />
        {showTagline && (
          <span
            className={
              taglineClassName ??
              "text-[10px] text-muted-foreground mt-1 font-semibold"
            }
            style={{ letterSpacing: "0.18em" }}
          >
            TALK · SHARE · BELONG
          </span>
        )}
      </div>
    </div>
  );
}
