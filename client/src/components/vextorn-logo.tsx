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
      viewBox="0 0 200 200"
      role="img"
      aria-label="Vextorn"
      className={className}
    >
      <defs>
        <linearGradient id={`vx-left-${uid}`} x1="0.2" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#9D86FF" />
          <stop offset="55%" stopColor="#7B5CF6" />
          <stop offset="100%" stopColor="#5B3CE0" />
        </linearGradient>
        <linearGradient id={`vx-right-${uid}`} x1="0.4" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#3D8FFF" />
          <stop offset="55%" stopColor="#3385FF" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={`vx-head-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9D86FF" />
          <stop offset="100%" stopColor="#3D8FFF" />
        </linearGradient>
      </defs>
      <path
        d="M 100 180 C 86 152, 68 114, 50 72 C 40 48, 38 24, 58 22 C 74 20, 84 34, 90 64 C 94 102, 98 144, 100 180 Z"
        fill={`url(#vx-left-${uid})`}
      />
      <path
        d="M 100 180 C 114 152, 132 114, 150 72 C 160 48, 162 24, 142 22 C 126 20, 116 34, 110 64 C 106 102, 102 144, 100 180 Z"
        fill={`url(#vx-right-${uid})`}
      />
      <circle cx="100" cy="56" r="11" fill={`url(#vx-head-${uid})`} />
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
        fontWeight: 700,
        letterSpacing: "-0.02em",
        fontFamily:
          '"Space Grotesk", "SF Pro Display", "Helvetica Neue", system-ui, -apple-system, sans-serif',
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
            wordmarkClassName ?? "text-lg font-bold tracking-tight"
          }
        />
        {showTagline && (
          <span
            className={
              taglineClassName ??
              "text-[11px] mt-1 font-semibold bg-gradient-to-r from-[#9D86FF] via-[#7B5CF6] to-[#3D8FFF] bg-clip-text text-transparent"
            }
            style={{ letterSpacing: "0.01em" }}
          >
            Talk. Share. Belong.
          </span>
        )}
      </div>
    </div>
  );
}
