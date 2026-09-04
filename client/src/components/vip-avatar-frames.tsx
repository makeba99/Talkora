/**
 * High-quality Free4Talk / Discord-style VIP avatar frames.
 * Pure SVG + CSS transforms — no canvas loops, limited glow filters.
 */

function butterflyPath(cx: number, cy: number, s: number, flip = false): string {
  const f = flip ? -1 : 1;
  return (
    `M${cx},${cy}` +
    ` C${cx + f * s * 0.9},${cy - s * 1.15} ${cx + f * s * 1.55},${cy - s * 0.25} ${cx + f * s * 0.35},${cy + s * 0.35}` +
    ` C${cx + f * s * 0.7},${cy + s * 0.05} ${cx + f * s * 0.15},${cy + s * 0.55} ${cx},${cy}` +
    ` C${cx - f * s * 0.15},${cy + s * 0.55} ${cx - f * s * 0.7},${cy + s * 0.05} ${cx - f * s * 0.35},${cy + s * 0.35}` +
    ` C${cx - f * s * 1.55},${cy - s * 0.25} ${cx - f * s * 0.9},${cy - s * 1.15} ${cx},${cy} Z`
  );
}

function rosePetal(cx: number, cy: number, r: number, rot: number): string {
  const rad = (rot * Math.PI) / 180;
  const x1 = cx + Math.cos(rad) * r * 0.15;
  const y1 = cy + Math.sin(rad) * r * 0.15;
  const x2 = cx + Math.cos(rad) * r;
  const y2 = cy + Math.sin(rad) * r;
  const ox = Math.cos(rad + Math.PI / 2) * r * 0.45;
  const oy = Math.sin(rad + Math.PI / 2) * r * 0.45;
  return `M${x1},${y1} Q${x2 + ox},${y2 + oy} ${x2},${y2} Q${x2 - ox},${y2 - oy} ${x1},${y1} Z`;
}

/** Neon violet→cyan ring + floating luminous butterflies (Free4Talk style). */
export function LunaButterfliesFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.38);
  const w = size + pad * 2;
  const c = w / 2;
  const r = size / 2 + pad * 0.22;
  const id = `luna${size}`;

  const butterflies = [
    { a: -40, dist: 1.08, s: 0.11, delay: 0 },
    { a: 25, dist: 1.12, s: 0.09, delay: 0.4 },
    { a: 110, dist: 1.05, s: 0.1, delay: 0.8 },
    { a: 165, dist: 1.14, s: 0.08, delay: 1.1 },
    { a: 220, dist: 1.07, s: 0.1, delay: 0.2 },
    { a: 290, dist: 1.1, s: 0.09, delay: 1.5 },
  ];

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}ring`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="45%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <radialGradient id={`${id}wing`} cx="35%" cy="40%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="55%" stopColor="rgba(165,243,252,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id={`${id}glow`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-float {
            0%,100% { transform: translate(0,0) scale(1); opacity: 0.75; }
            50% { transform: translate(2px,-4px) scale(1.06); opacity: 1; }
          }
          @keyframes ${id}-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes ${id}-pulse {
            0%,100% { opacity: 0.55; }
            50% { opacity: 1; }
          }
        `}</style>

        {/* Soft wing watermark behind avatar */}
        <ellipse
          cx={c + r * 0.55}
          cy={c - r * 0.1}
          rx={r * 1.15}
          ry={r * 0.85}
          fill={`url(#${id}wing)`}
          opacity="0.55"
          style={{ animation: `${id}-pulse 4.5s ease-in-out infinite` }}
        />

        {/* Neon ring */}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#${id}ring)`}
          strokeWidth={Math.max(2.5, size * 0.045)}
          filter={`url(#${id}glow)`}
          style={{ transformOrigin: `${c}px ${c}px`, animation: `${id}-spin 18s linear infinite` }}
        />
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />

        {butterflies.map((b, i) => {
          const rad = (b.a * Math.PI) / 180;
          const bx = c + Math.cos(rad) * r * b.dist;
          const by = c + Math.sin(rad) * r * b.dist;
          const s = size * b.s;
          return (
            <g
              key={i}
              filter={`url(#${id}glow)`}
              style={{
                animation: `${id}-float ${2.4 + (i % 3) * 0.35}s ease-in-out ${b.delay}s infinite`,
                transformOrigin: `${bx}px ${by}px`,
              }}
            >
              <path d={butterflyPath(bx, by, s)} fill="rgba(255,255,255,0.92)" />
              <path d={butterflyPath(bx, by, s * 0.72, true)} fill="rgba(165,243,252,0.75)" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Purple rose crown + cyan neon ring (Free4Talk VIP rose frame). */
export function VioletRosesFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.4);
  const w = size + pad * 2;
  const c = w / 2;
  const r = size / 2 + pad * 0.2;
  const id = `rose${size}`;
  const roseCount = 8;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}ring`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>
          <radialGradient id={`${id}rose`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#f5d0fe" />
            <stop offset="40%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#6b21a8" />
          </radialGradient>
          <filter id={`${id}glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-breathe {
            0%,100% { transform: scale(1); }
            50% { transform: scale(1.04); }
          }
          @keyframes ${id}-shimmer {
            0%,100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
        `}</style>

        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#${id}ring)`}
          strokeWidth={Math.max(2.2, size * 0.04)}
          filter={`url(#${id}glow)`}
          style={{ animation: `${id}-shimmer 3s ease-in-out infinite` }}
        />

        {Array.from({ length: roseCount }, (_, i) => {
          const t = (i / roseCount) * Math.PI * 2 - Math.PI / 2;
          const rx = c + Math.cos(t) * r * 1.08;
          const ry = c + Math.sin(t) * r * 1.08;
          const pr = size * (0.085 + (i % 2) * 0.015);
          const rot = (t * 180) / Math.PI;
          return (
            <g
              key={i}
              style={{
                animation: `${id}-breathe ${2.6 + (i % 3) * 0.3}s ease-in-out ${(i * 0.15)}s infinite`,
                transformOrigin: `${rx}px ${ry}px`,
              }}
            >
              {[0, 60, 120, 180, 240, 300].map((ang) => (
                <path
                  key={ang}
                  d={rosePetal(rx, ry, pr, rot + ang)}
                  fill={`url(#${id}rose)`}
                  opacity={0.85}
                />
              ))}
              <circle cx={rx} cy={ry} r={pr * 0.28} fill="#fce7f3" opacity={0.9} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Soft realistic ember rim — for VIP fire look without cartoon particles. */
export function EmberFlameFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const r = size / 2 + pad * 0.18;
  const id = `ember${size}`;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}ring`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="55%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <filter id={`${id}glow`} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-flicker {
            0%,100% { opacity: 0.75; stroke-width: ${Math.max(2.2, size * 0.04)}; }
            50% { opacity: 1; stroke-width: ${Math.max(2.8, size * 0.05)}; }
          }
        `}</style>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#${id}ring)`}
          strokeWidth={Math.max(2.4, size * 0.042)}
          filter={`url(#${id}glow)`}
          style={{ animation: `${id}-flicker 1.8s ease-in-out infinite` }}
        />
        <circle cx={c} cy={c} r={r * 1.08} fill="none" stroke="rgba(251,146,60,0.25)" strokeWidth={6} filter={`url(#${id}glow)`} />
      </svg>
    </div>
  );
}

/** Crystal shard halo — clean premium VIP frame. */
export function CrystalHaloFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.34);
  const w = size + pad * 2;
  const c = w / 2;
  const r = size / 2 + pad * 0.2;
  const id = `chal${size}`;
  const shards = 10;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e9d5ff" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
          <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-twinkle {
            0%,100% { opacity: 0.55; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.08); }
          }
        `}</style>
        <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${id}g)`} strokeWidth={2} opacity={0.7} />
        {Array.from({ length: shards }, (_, i) => {
          const t = (i / shards) * Math.PI * 2 - Math.PI / 2;
          const x = c + Math.cos(t) * r;
          const y = c + Math.sin(t) * r;
          const len = 5 + (i % 3) * 2;
          const ang = (t * 180) / Math.PI;
          return (
            <polygon
              key={i}
              points={`${x},${y - len} ${x + 2.4},${y} ${x},${y + len * 0.35} ${x - 2.4},${y}`}
              fill={`url(#${id}g)`}
              filter={`url(#${id}glow)`}
              transform={`rotate(${ang},${x},${y})`}
              style={{
                animation: `${id}-twinkle ${2 + (i % 4) * 0.4}s ease-in-out ${i * 0.12}s infinite`,
                transformOrigin: `${x}px ${y}px`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
