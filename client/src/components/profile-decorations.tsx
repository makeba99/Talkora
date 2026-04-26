import React from "react";

// Profile decorations come in three tiers:
//   • "professional" — restrained, premium-feeling animations suitable for
//     work-like contexts (verified accounts, teachers, executives). Subtle
//     palettes (indigo / violet / cyan / platinum / teal), slow motion,
//     never gimmicky.
//   • "tactical"     — Discord-inspired sci-fi / HUD frames. Detailed,
//     visually rich rings with tick marks, corner brackets, sword-blade
//     crescents, and traveling circuit pulses. The "premium loot drop" tier.
//   • "expressive"   — the original playful set (fire, hearts, sparkles…)
//     for users who want personality on their profile.
// The "category" field lets the picker UI group them into separate sections
// instead of one undifferentiated grid.
export const PROFILE_DECORATIONS = [
  { id: "none", label: "None", description: "No decoration", category: "core" },

  // ── Professional ──────────────────────────────────────────────────────
  { id: "aurora", label: "Aurora", description: "Soft indigo-violet aurora ring", category: "professional" },
  { id: "executive", label: "Executive", description: "Brushed platinum highlight sweep", category: "professional" },
  { id: "pulse", label: "Pulse", description: "Gentle teal breathing ring", category: "professional" },
  { id: "quantum", label: "Quantum", description: "Three precise orbiting nodes", category: "professional" },
  { id: "helix", label: "Helix", description: "Counter-rotating energy arcs", category: "professional" },
  { id: "sentinel", label: "Sentinel", description: "Expanding security ring", category: "professional" },

  // ── Tactical (Discord-inspired premium frames) ────────────────────────
  { id: "hologram", label: "Hologram", description: "Cyan HUD ring with tick markers", category: "tactical" },
  { id: "tactical", label: "Tactical", description: "HUD targeting bracket reticle", category: "tactical" },
  { id: "crimson", label: "Crimson Blade", description: "Sweeping crimson sword crescent", category: "tactical" },
  { id: "circuit", label: "Circuit Core", description: "Segmented ring with traveling pulse", category: "tactical" },

  // ── Expressive ────────────────────────────────────────────────────────
  { id: "cosmic", label: "🌀 Cosmic Ring", description: "Holographic orbiting ring", category: "expressive" },
  { id: "fire", label: "🔥 Fire Aura", description: "Blazing flame aura", category: "expressive" },
  { id: "lightning", label: "⚡ Lightning", description: "Electric energy arc", category: "expressive" },
  { id: "sparkles", label: "✨ Sparkles", description: "Shimmering sparkles halo", category: "expressive" },
  { id: "rainbow", label: "🌈 Rainbow", description: "Chromatic glow ring", category: "expressive" },
  { id: "snow", label: "❄️ Frost", description: "Icy frost aura", category: "expressive" },
  { id: "hearts", label: "💕 Hearts", description: "Floating heart aura", category: "expressive" },
  { id: "stars", label: "⭐ Stars", description: "Orbiting star ring", category: "expressive" },
  { id: "bubbles", label: "🫧 Bubbles", description: "Rising bubble aura", category: "expressive" },
  { id: "flowers", label: "🌸 Flowers", description: "Petal shower", category: "expressive" },
  { id: "catears", label: "🐱 Cat Ears", description: "Cute cat ears", category: "expressive" },
] as const;

export type DecorationId = typeof PROFILE_DECORATIONS[number]["id"];
export type DecorationCategory = typeof PROFILE_DECORATIONS[number]["category"];

const DECO_STYLES = `
  @keyframes dec-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes dec-spin-rev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
  @keyframes dec-pulse { 0%,100% { opacity:0.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.08); } }
  @keyframes dec-flicker { 0%,100%{opacity:1;} 30%{opacity:0.3;} 60%{opacity:0.8;} 80%{opacity:0.1;} }
  @keyframes dec-float-up { 0%{transform:translateY(0) scale(1);opacity:1;} 100%{transform:translateY(-60px) scale(0.3);opacity:0;} }
  @keyframes dec-float-up2 { 0%{transform:translateY(0) translateX(0) scale(1);opacity:1;} 100%{transform:translateY(-55px) translateX(8px) scale(0.2);opacity:0;} }
  @keyframes dec-snow-fall { 0%{transform:translateY(-10px) rotate(0deg);opacity:0;} 15%{opacity:1;} 85%{opacity:0.6;} 100%{transform:translateY(80px) rotate(360deg);opacity:0;} }
  @keyframes dec-orbit { from{transform:rotate(var(--a)) translateX(var(--r));} to{transform:rotate(calc(var(--a) + 360deg)) translateX(var(--r));} }
  @keyframes dec-twinkle { 0%,100%{opacity:0;transform:scale(0) rotate(0deg);} 40%{opacity:1;transform:scale(1.4) rotate(60deg);} 70%{opacity:0.8;transform:scale(1) rotate(120deg);} }
  @keyframes dec-heart-float { 0%{opacity:0;transform:translate(0,0) scale(0.5) rotate(-10deg);} 20%{opacity:1;} 80%{opacity:0.6;} 100%{opacity:0;transform:translate(var(--hx),var(--hy)) scale(0.9) rotate(10deg);} }
  @keyframes dec-bubble-rise { 0%{opacity:0;transform:translateY(0) scale(0.4);} 20%{opacity:0.9;} 80%{opacity:0.5;} 100%{opacity:0;transform:translateY(-70px) scale(1.1);} }
  @keyframes dec-petal { 0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(0.5);} 20%{opacity:1;} 80%{opacity:0.7;} 100%{opacity:0;transform:translate(var(--px),var(--py)) rotate(var(--pr)) scale(1);} }
  @keyframes dec-rainbow-spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
  @keyframes dec-glow-pulse { 0%,100%{filter:brightness(1) blur(2px);} 50%{filter:brightness(1.5) blur(3px);} }
  @keyframes dec-arc-flash { 0%{opacity:0;stroke-dashoffset:200;} 20%{opacity:1;stroke-dashoffset:100;} 50%{opacity:0.8;stroke-dashoffset:0;} 80%{opacity:0.4;} 100%{opacity:0;stroke-dashoffset:-100;} }
  @keyframes dec-particle-orbit { from{transform:rotate(var(--a)) translateX(var(--r)) rotate(calc(-1 * var(--a)));} to{transform:rotate(calc(var(--a) + 360deg)) translateX(var(--r)) rotate(calc(-1 * (var(--a) + 360deg)));} }

  /* Professional decoration keyframes — restrained motion only.
     All use transform/opacity so the GPU can composite them cheaply. */
  @keyframes dec-breath { 0%,100% { opacity:0.55; } 50% { opacity:1; } }
  @keyframes dec-sentinel-expand {
    0% { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(1.32); opacity: 0; }
  }
  @keyframes dec-aurora-shimmer {
    0%,100% { opacity: 0.85; }
    50% { opacity: 1; }
  }

  /* Accessibility — disable decoration animations entirely for users who
     have requested reduced motion. The static ring/shape is still drawn,
     just without movement. */
  @media (prefers-reduced-motion: reduce) {
    .deco-wrap *,
    .deco-wrap *::before,
    .deco-wrap *::after {
      animation: none !important;
      transition: none !important;
    }
  }
`;

function uid(prefix: string, i: number) { return `${prefix}-${i}`; }

/* ── Rounded-rect ring helpers ─────────────────────────────────────
   Avatar tiles in room cards are `rounded-2xl` (16px corner). All
   decoration rings/auras now trace a rounded square instead of a
   circle so they hug the actual tile shape. */
const AVATAR_TILE_RADIUS = 16;

function roundedRectPath(cx: number, cy: number, halfSize: number, cornerRadius: number): string {
  const r = Math.max(0, Math.min(cornerRadius, halfSize));
  const x = cx - halfSize, y = cy - halfSize, s = halfSize * 2;
  return (
    `M${x + r},${y} L${x + s - r},${y} ` +
    `A${r},${r} 0 0 1 ${x + s},${y + r} L${x + s},${y + s - r} ` +
    `A${r},${r} 0 0 1 ${x + s - r},${y + s} L${x + r},${y + s} ` +
    `A${r},${r} 0 0 1 ${x},${y + s - r} L${x},${y + r} ` +
    `A${r},${r} 0 0 1 ${x + r},${y} Z`
  );
}

/* Sample a point on a rounded-rect perimeter at parameter t (0..1).
   Starts at top-center going clockwise (matches angle = -PI/2 mapping
   to t = 0 of the equivalent circle). */
function pointOnRoundedRect(
  t: number,
  cx: number,
  cy: number,
  halfSize: number,
  cornerRadius: number
): { x: number; y: number } {
  const r = Math.max(0, Math.min(cornerRadius, halfSize));
  const s = halfSize * 2;
  const straight = s - 2 * r;
  const arcLen = (Math.PI / 2) * r;
  const perim = 4 * straight + 4 * arcLen;
  const halfTop = straight / 2;
  let d = (((t % 1) + 1) % 1) * perim;
  if (d < halfTop) return { x: cx + d, y: cy - halfSize };
  d -= halfTop;
  if (d < arcLen) {
    const a = (d / arcLen) * (Math.PI / 2) - Math.PI / 2;
    return { x: cx + halfTop + r * Math.cos(a), y: cy - halfSize + r + r * Math.sin(a) };
  }
  d -= arcLen;
  if (d < straight) return { x: cx + halfSize, y: cy - halfSize + r + d };
  d -= straight;
  if (d < arcLen) {
    const a = (d / arcLen) * (Math.PI / 2);
    return { x: cx + halfSize - r + r * Math.cos(a), y: cy + halfSize - r + r * Math.sin(a) };
  }
  d -= arcLen;
  if (d < straight) return { x: cx + halfSize - r - d, y: cy + halfSize };
  d -= straight;
  if (d < arcLen) {
    const a = (d / arcLen) * (Math.PI / 2) + Math.PI / 2;
    return { x: cx - halfSize + r + r * Math.cos(a), y: cy + halfSize - r + r * Math.sin(a) };
  }
  d -= arcLen;
  if (d < straight) return { x: cx - halfSize, y: cy + halfSize - r - d };
  d -= straight;
  if (d < arcLen) {
    const a = (d / arcLen) * (Math.PI / 2) + Math.PI;
    return { x: cx - halfSize + r + r * Math.cos(a), y: cy - halfSize + r + r * Math.sin(a) };
  }
  d -= arcLen;
  return { x: cx - halfSize + r + d, y: cy - halfSize };
}

function CosmicRing({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const off1 = pad * 0.38;
  const off2 = pad * 0.72;
  const half1 = size / 2 + off1;
  const half2 = size / 2 + off2;
  const cr1 = AVATAR_TILE_RADIUS + off1;
  const cr2 = AVATAR_TILE_RADIUS + off2;
  const id = `cr${size}`;
  const dots = 8;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}g1`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.0" />
            <stop offset="35%" stopColor="#00e5ff" stopOpacity="1" />
            <stop offset="65%" stopColor="#aa44ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#aa44ff" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id={`${id}g2`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#aa44ff" stopOpacity="0.0" />
            <stop offset="35%" stopColor="#aa44ff" stopOpacity="0.8" />
            <stop offset="65%" stopColor="#00e5ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.0" />
          </linearGradient>
          <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${id}glow2`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g style={{ animation: `dec-spin 4s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          <path d={roundedRectPath(c, c, half2, cr2)} fill="none" stroke={`url(#${id}g1)`} strokeWidth="3.5" filter={`url(#${id}glow2)`} />
        </g>
        <g style={{ animation: `dec-spin-rev 3s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          <path d={roundedRectPath(c, c, half2 - 4, Math.max(0, cr2 - 4))} fill="none" stroke={`url(#${id}g2)`} strokeWidth="1.5" opacity="0.5" />
        </g>
        <g style={{ animation: `dec-spin-rev 6s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          <path d={roundedRectPath(c, c, half1, cr1)} fill="none" stroke="#00e5ff" strokeWidth="1" strokeDasharray="6 5" opacity="0.55" filter={`url(#${id}glow)`} />
        </g>
        {Array.from({ length: dots }).map((_, i) => {
          const t = i / dots;
          const { x, y } = pointOnRoundedRect(t, c, c, half2, cr2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2.5}
              fill="#00e5ff"
              filter={`url(#${id}glow)`}
              style={{
                animation: `dec-spin ${4}s linear infinite`,
                transformOrigin: `${c}px ${c}px`,
                animationDelay: `${-i * (4 / dots)}s`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function FireAura({ size }: { size: number }) {
  const pad = Math.round(size * 0.3);
  const w = size + pad * 2;
  const h = size + pad * 2.4;
  const cx = w / 2;
  const count = 14;

  return (
    <div style={{ position: "absolute", top: -pad * 1.4, left: -pad, width: w, height: h + pad, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={h + pad} style={{ overflow: "visible" }}>
        <defs>
          {Array.from({ length: count }).map((_, i) => {
            const hue = 15 + (i / count) * 35;
            return (
              <radialGradient key={i} id={`fg${size}${i}`} cx="50%" cy="80%" r="60%">
                <stop offset="0%" stopColor={`hsl(${hue},100%,60%)`} stopOpacity="0.9" />
                <stop offset="60%" stopColor={`hsl(${hue + 20},100%,45%)`} stopOpacity="0.5" />
                <stop offset="100%" stopColor={`hsl(${hue + 30},100%,35%)`} stopOpacity="0" />
              </radialGradient>
            );
          })}
          <filter id={`ff${size}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {Array.from({ length: count }).map((_, i) => {
          const angle = ((i / count) * 2 - 1) * 0.9;
          const bx = cx + Math.sin(angle) * (size * 0.48);
          const fw = 18 + Math.random() * 22;
          const fh = 40 + (Math.random() * 50);
          const delay = (i / count) * 1.8;
          const dur = 1.0 + Math.random() * 0.8;
          return (
            <ellipse
              key={i}
              cx={bx}
              cy={h + pad * 0.3}
              rx={fw / 2}
              ry={fh / 2}
              fill={`url(#fg${size}${i})`}
              filter={`url(#ff${size})`}
              style={{
                animation: `dec-float-up ${dur}s ease-out ${delay}s infinite`,
                transformOrigin: `${bx}px ${h + pad * 0.3}px`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function LightningAura({ size }: { size: number }) {
  const pad = Math.round(size * 0.28);
  const w = size + pad * 2;
  const c = w / 2;
  const off = pad * 0.55;
  const half = size / 2 + off;
  const cr = AVATAR_TILE_RADIUS + off;
  const halfOuter = half * 1.25;
  const crOuter = cr * 1.25;
  const arcs = 6;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`lf${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {Array.from({ length: arcs }).map((_, i) => {
          const t1 = (i / arcs) - 20 / 360;
          const t2 = (i / arcs) + 50 / 360;
          const tm = (t1 + t2) / 2;
          const p1 = pointOnRoundedRect(t1, c, c, half, cr);
          const p2 = pointOnRoundedRect(t2, c, c, half, cr);
          const pm = pointOnRoundedRect(tm, c, c, halfOuter, crOuter);
          const dur = 0.4 + Math.random() * 0.5;
          const delay = (i / arcs) * 1.5;
          return (
            <g key={i} style={{ animation: `dec-flicker ${dur}s ease-in-out ${delay}s infinite` }}>
              <path
                d={`M${p1.x},${p1.y} Q${pm.x},${pm.y} ${p2.x},${p2.y}`}
                fill="none"
                stroke="#00cfff"
                strokeWidth="2.5"
                strokeLinecap="round"
                filter={`url(#lf${size})`}
              />
              <path
                d={`M${p1.x},${p1.y} Q${pm.x},${pm.y} ${p2.x},${p2.y}`}
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.8"
                strokeLinecap="round"
                opacity="0.9"
              />
            </g>
          );
        })}
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="#00cfff" strokeWidth="1" opacity="0.25"
          style={{ animation: `dec-pulse 2s ease-in-out infinite` }} />
      </svg>
    </div>
  );
}

function SparklesAura({ size }: { size: number }) {
  const pad = Math.round(size * 0.35);
  const w = size + pad * 2;
  const c = w / 2;
  const count = 14;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`sf${size}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {Array.from({ length: count }).map((_, i) => {
          const t = i / count;
          const ringOff = pad * 0.45 + (i % 3) * pad * 0.18;
          const half = size / 2 + ringOff;
          const cr = AVATAR_TILE_RADIUS + ringOff;
          const { x, y } = pointOnRoundedRect(t, c, c, half, cr);
          const s = 3 + (i % 4);
          const dur = 1.2 + (i % 5) * 0.35;
          const del = (i / count) * 2.5;
          const colors = ["#fff", "#ffe96e", "#a8f0ff", "#ffb3ff", "#b3ffd6"];
          const col = colors[i % colors.length];
          return (
            <g key={i} style={{ animation: `dec-twinkle ${dur}s ease-in-out ${del}s infinite` }}>
              <line x1={x - s} y1={y} x2={x + s} y2={y} stroke={col} strokeWidth="1.5" strokeLinecap="round" filter={`url(#sf${size})`} />
              <line x1={x} y1={y - s} x2={x} y2={y + s} stroke={col} strokeWidth="1.5" strokeLinecap="round" filter={`url(#sf${size})`} />
              <line x1={x - s * 0.7} y1={y - s * 0.7} x2={x + s * 0.7} y2={y + s * 0.7} stroke={col} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
              <line x1={x - s * 0.7} y1={y + s * 0.7} x2={x + s * 0.7} y2={y - s * 0.7} stroke={col} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RainbowRing({ size }: { size: number }) {
  const pad = Math.round(size * 0.28);
  const w = size + pad * 2;
  const c = w / 2;
  const off = pad * 0.55;
  const halfMid = size / 2 + off;
  const crMid = AVATAR_TILE_RADIUS + off;
  const id = `rr${size}`;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}lg`} x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff0040" />
            <stop offset="16%" stopColor="#ff8800" />
            <stop offset="33%" stopColor="#ffee00" />
            <stop offset="50%" stopColor="#00ff80" />
            <stop offset="66%" stopColor="#0088ff" />
            <stop offset="83%" stopColor="#8800ff" />
            <stop offset="100%" stopColor="#ff0040" />
          </linearGradient>
          <filter id={`${id}gf`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g style={{ animation: `dec-rainbow-spin 3s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          <path d={roundedRectPath(c, c, halfMid, crMid)} fill="none" stroke={`url(#${id}lg)`} strokeWidth="5" filter={`url(#${id}gf)`} />
          <path d={roundedRectPath(c, c, halfMid + 5, crMid + 5)} fill="none" stroke={`url(#${id}lg)`} strokeWidth="1.5" opacity="0.4" />
          <path d={roundedRectPath(c, c, halfMid - 5, Math.max(0, crMid - 5))} fill="none" stroke={`url(#${id}lg)`} strokeWidth="1.5" opacity="0.4" />
        </g>
      </svg>
    </div>
  );
}

function FrostAura({ size }: { size: number }) {
  const pad = Math.round(size * 0.35);
  const w = size + pad * 2;
  const c = w / 2;
  const count = 12;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`frf${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g filter={`url(#frf${size})`}>
          {Array.from({ length: count }).map((_, i) => {
            const t = i / count;
            const ringOff = pad * 0.4 + (i % 3) * pad * 0.22;
            const half = size / 2 + ringOff;
            const cr = AVATAR_TILE_RADIUS + ringOff;
            const { x: sx, y: sy } = pointOnRoundedRect(t, c, c, half, cr);
            const s = 4.5 + (i % 3) * 2;
            const cols = ["#a8f4ff", "#c8f8ff", "#88e8ff", "#e0f8ff"];
            const col = cols[i % cols.length];
            const dur = 2.5 + (i % 4) * 0.5;
            const del = (i / count) * 3;
            return (
              <g key={i} style={{ animation: `dec-snow-fall ${dur}s ease-in-out ${del}s infinite` }} transform={`translate(${sx},${sy})`}>
                <line x1={0} y1={-s} x2={0} y2={s} stroke={col} strokeWidth="1.2" strokeLinecap="round" />
                <line x1={-s} y1={0} x2={s} y2={0} stroke={col} strokeWidth="1.2" strokeLinecap="round" />
                <line x1={-s * 0.7} y1={-s * 0.7} x2={s * 0.7} y2={s * 0.7} stroke={col} strokeWidth="1" strokeLinecap="round" />
                <line x1={s * 0.7} y1={-s * 0.7} x2={-s * 0.7} y2={s * 0.7} stroke={col} strokeWidth="1" strokeLinecap="round" />
                <line x1={0} y1={-s * 0.5} x2={s * 0.35} y2={-s * 0.2} stroke={col} strokeWidth="0.8" strokeLinecap="round" />
                <line x1={0} y1={-s * 0.5} x2={-s * 0.35} y2={-s * 0.2} stroke={col} strokeWidth="0.8" strokeLinecap="round" />
              </g>
            );
          })}
        </g>
        <path d={roundedRectPath(c, c, size / 2 + pad * 0.2, AVATAR_TILE_RADIUS + pad * 0.2)} fill="none" stroke="#a8f4ff" strokeWidth="1" opacity="0.25"
          style={{ animation: `dec-pulse 3s ease-in-out infinite` }} />
      </svg>
    </div>
  );
}

function HeartsAura({ size }: { size: number }) {
  const pad = Math.round(size * 0.38);
  const w = size + pad * 2;
  const c = w / 2;
  const count = 10;
  const colors = ["#ff4d88", "#ff6699", "#ff85aa", "#ff3377", "#ffaacc", "#cc0044"];

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w + pad, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w + pad} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`hf${size}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {Array.from({ length: count }).map((_, i) => {
          const t = i / count;
          const ringOff = pad * 0.38 + (i % 3) * pad * 0.2;
          const half = size / 2 + ringOff;
          const cr = AVATAR_TILE_RADIUS + ringOff;
          const { x: sx, y: sy } = pointOnRoundedRect(t, c, c, half, cr);
          const hx = (Math.random() - 0.5) * 30;
          const hy = -30 - Math.random() * 25;
          const s = 0.45 + (i % 3) * 0.2;
          const dur = 2.0 + (i % 4) * 0.4;
          const del = (i / count) * 3;
          const col = colors[i % colors.length];
          return (
            <g key={i}
              style={{
                animation: `dec-heart-float ${dur}s ease-out ${del}s infinite`,
                ["--hx" as any]: `${hx}px`,
                ["--hy" as any]: `${hy}px`,
              }}
              transform={`translate(${sx},${sy}) scale(${s})`}
              filter={`url(#hf${size})`}
            >
              <path d="M0,-6 C0,-10 -7,-10 -7,-4 C-7,0 0,6 0,6 C0,6 7,0 7,-4 C7,-10 0,-10 0,-6Z" fill={col} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StarsRing({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const count = 10;
  const colors = ["#ffe96e", "#fff5b0", "#ffd700", "#ffffff", "#ffec8b"];
  const haloOff = pad * 0.3;
  const haloHalf = size / 2 + haloOff;
  const haloCr = AVATAR_TILE_RADIUS + haloOff;

  function starPath(cx: number, cy: number, r1: number, r2: number, pts: number) {
    let d = "";
    for (let i = 0; i < pts * 2; i++) {
      const a = (i * Math.PI) / pts - Math.PI / 2;
      const r = i % 2 === 0 ? r1 : r2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      d += (i === 0 ? "M" : "L") + `${x},${y}`;
    }
    return d + "Z";
  }

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`stf${size}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g style={{ animation: `dec-spin ${12}s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          {Array.from({ length: count }).map((_, i) => {
            const t = i / count;
            const ringOff = pad * 0.5 + (i % 3) * pad * 0.15;
            const half = size / 2 + ringOff;
            const cr = AVATAR_TILE_RADIUS + ringOff;
            const { x, y } = pointOnRoundedRect(t, c, c, half, cr);
            const s = 4 + (i % 3) * 2.5;
            const col = colors[i % colors.length];
            const dur = 1.5 + (i % 4) * 0.4;
            const del = (i / count) * 2;
            return (
              <g key={i}
                style={{ animation: `dec-twinkle ${dur}s ease-in-out ${del}s infinite`, transformOrigin: `${x}px ${y}px` }}
                filter={`url(#stf${size})`}
              >
                <path d={starPath(x, y, s, s * 0.42, 4)} fill={col} />
              </g>
            );
          })}
        </g>
        <path d={roundedRectPath(c, c, haloHalf, haloCr)} fill="none" stroke="#ffe96e" strokeWidth="0.8" opacity="0.2"
          style={{ animation: `dec-pulse 3s ease-in-out infinite` }} />
      </svg>
    </div>
  );
}

function BubblesAura({ size }: { size: number }) {
  const pad = Math.round(size * 0.36);
  const w = size + pad * 2;
  const c = w / 2;
  const count = 12;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w + pad, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w + pad} style={{ overflow: "visible" }}>
        <defs>
          {Array.from({ length: count }).map((_, i) => (
            <radialGradient key={i} id={`bbg${size}${i}`} cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#e0f8ff" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#7dcfef" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#4ab8d8" stopOpacity="0.1" />
            </radialGradient>
          ))}
          <filter id={`bbf${size}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {Array.from({ length: count }).map((_, i) => {
          const t = i / count + (Math.random() * 0.5) / (2 * Math.PI);
          const ringOff = pad * 0.3 + (i % 3) * pad * 0.15;
          const half = size / 2 + ringOff;
          const cr = AVATAR_TILE_RADIUS + ringOff;
          const { x: rx, y: ry } = pointOnRoundedRect(t, c, c, half, cr);
          const r = 4 + (i % 4) * 2.5;
          const dur = 2.0 + (i % 5) * 0.4;
          const del = (i / count) * 3.5;
          return (
            <g key={i}
              style={{ animation: `dec-bubble-rise ${dur}s ease-out ${del}s infinite` }}
              filter={`url(#bbf${size})`}
            >
              <circle cx={rx} cy={ry} r={r} fill={`url(#bbg${size}${i})`} />
              <circle cx={rx - r * 0.3} cy={ry - r * 0.35} r={r * 0.22} fill="white" opacity="0.7" />
              <circle cx={rx} cy={ry} r={r} fill="none" stroke="#7dcfef" strokeWidth="0.8" opacity="0.5" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PetalsAura({ size }: { size: number }) {
  const pad = Math.round(size * 0.38);
  const w = size + pad * 2;
  const c = w / 2;
  const count = 12;
  const colors = ["#ffb7c5", "#ff85a1", "#ff69b4", "#ffc0d0", "#ffe0e8"];

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w + pad, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w + pad} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`pf${size}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {Array.from({ length: count }).map((_, i) => {
          const t = i / count;
          const ringOff = pad * 0.3 + (i % 3) * pad * 0.2;
          const half = size / 2 + ringOff;
          const cr = AVATAR_TILE_RADIUS + ringOff;
          const { x: sx, y: sy } = pointOnRoundedRect(t, c, c, half, cr);
          const angle = t * 2 * Math.PI;
          const px = (Math.cos(angle + 0.8) * 25).toFixed(1);
          const py = (Math.sin(angle + 0.8) * 25 + 15).toFixed(1);
          const pr = (Math.random() * 200 - 100).toFixed(0);
          const s = 0.55 + (i % 4) * 0.2;
          const dur = 2.5 + (i % 5) * 0.4;
          const del = (i / count) * 3.5;
          const col = colors[i % colors.length];
          return (
            <g key={i}
              style={{
                animation: `dec-petal ${dur}s ease-out ${del}s infinite`,
                ["--px" as any]: `${px}px`,
                ["--py" as any]: `${py}px`,
                ["--pr" as any]: `${pr}deg`,
                transformOrigin: `${sx}px ${sy}px`,
              }}
              transform={`translate(${sx},${sy}) scale(${s})`}
              filter={`url(#pf${size})`}
            >
              <ellipse cx={0} cy={-4} rx={4.5} ry={7} fill={col} />
              <ellipse cx={4} cy={0} rx={4.5} ry={7} fill={col} transform="rotate(72)" />
              <ellipse cx={2} cy={4} rx={4.5} ry={7} fill={col} transform="rotate(144)" />
              <ellipse cx={-2} cy={4} rx={4.5} ry={7} fill={col} transform="rotate(216)" />
              <ellipse cx={-4} cy={0} rx={4.5} ry={7} fill={col} transform="rotate(288)" />
              <circle cx={0} cy={0} r={2.5} fill="#ffec8b" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CatEarsDecoration({ size }: { size: number }) {
  const earW = size * 0.28;
  const earH = size * 0.32;
  return (
    <>
      <div style={{
        position: "absolute", top: -earH * 0.75, left: size * 0.05,
        width: 0, height: 0,
        borderLeft: `${earW * 0.5}px solid transparent`,
        borderRight: `${earW * 0.5}px solid transparent`,
        borderBottom: `${earH}px solid #ff9ec6`,
        filter: "drop-shadow(0 0 6px #ff6ba8) drop-shadow(0 0 12px #ff4499)",
        zIndex: 20,
      }} />
      <div style={{
        position: "absolute", top: -earH * 0.75, right: size * 0.05,
        width: 0, height: 0,
        borderLeft: `${earW * 0.5}px solid transparent`,
        borderRight: `${earW * 0.5}px solid transparent`,
        borderBottom: `${earH}px solid #ff9ec6`,
        filter: "drop-shadow(0 0 6px #ff6ba8) drop-shadow(0 0 12px #ff4499)",
        zIndex: 20,
      }} />
      <div style={{
        position: "absolute", top: -earH * 0.45, left: size * 0.12,
        width: 0, height: 0,
        borderLeft: `${earW * 0.28}px solid transparent`,
        borderRight: `${earW * 0.28}px solid transparent`,
        borderBottom: `${earH * 0.55}px solid #ffcce0`,
        zIndex: 21,
      }} />
      <div style={{
        position: "absolute", top: -earH * 0.45, right: size * 0.12,
        width: 0, height: 0,
        borderLeft: `${earW * 0.28}px solid transparent`,
        borderRight: `${earW * 0.28}px solid transparent`,
        borderBottom: `${earH * 0.55}px solid #ffcce0`,
        zIndex: 21,
      }} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PROFESSIONAL DECORATIONS
   ──────────────────────────────────────────────────────────────────────
   Restrained, premium-feeling animations. All use the same rounded-rect
   path so they hug the avatar tile shape, animate via transform/opacity
   (GPU-cheap), and respect prefers-reduced-motion via the .deco-wrap
   class on the parent.
   ════════════════════════════════════════════════════════════════════════ */

function AuroraRing({ size }: { size: number }) {
  const pad = Math.round(size * 0.18);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.55;
  const cr = AVATAR_TILE_RADIUS + pad * 0.55;
  const id = `au${size}`;
  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.85" />
          </linearGradient>
          <filter id={`${id}b`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        {/* Crisp inner trace so the ring still reads when motion is off */}
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.8" />
        {/* Slow rotating aurora gradient */}
        <g style={{ animation: `dec-spin 14s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke={`url(#${id}g)`} strokeWidth="2.4" filter={`url(#${id}b)`} style={{ animation: `dec-aurora-shimmer 5s ease-in-out infinite` }} />
        </g>
      </svg>
    </div>
  );
}

function ExecutiveRing({ size }: { size: number }) {
  const pad = Math.round(size * 0.16);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.5;
  const cr = AVATAR_TILE_RADIUS + pad * 0.5;
  const id = `ex${size}`;
  // Sweep dash sized so a single bright highlight slides across the ring.
  // Total perimeter approx: 4*(2*half - 2*cr) + 2π*cr — we don't need exact,
  // a generous gap is fine because we mask to a single visible streak.
  const dashOn = Math.round(w * 0.18);
  const dashOff = Math.round(w * 4);
  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}base`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f4e4ba" />
            <stop offset="50%" stopColor="#c9a557" />
            <stop offset="100%" stopColor="#7d5e1f" />
          </linearGradient>
          <linearGradient id={`${id}sweep`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,250,220,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id={`${id}glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        {/* Base brushed-platinum/gold ring */}
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke={`url(#${id}base)`} strokeWidth="2.4" />
        {/* Light sweep — a short bright dash that travels around the perimeter */}
        <g style={{ animation: `dec-spin 5s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          <path
            d={roundedRectPath(c, c, half, cr)}
            fill="none"
            stroke={`url(#${id}sweep)`}
            strokeWidth="2.6"
            strokeDasharray={`${dashOn} ${dashOff}`}
            opacity="0.9"
            filter={`url(#${id}glow)`}
          />
        </g>
      </svg>
    </div>
  );
}

function PulseRing({ size }: { size: number }) {
  const pad = Math.round(size * 0.14);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.45;
  const cr = AVATAR_TILE_RADIUS + pad * 0.45;
  const id = `pl${size}`;
  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`${id}g`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
        {/* Static thin reference ring (visible even with reduced motion) */}
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="1" />
        {/* Breathing accent ring */}
        <path
          d={roundedRectPath(c, c, half, cr)}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2"
          filter={`url(#${id}g)`}
          style={{ animation: "dec-breath 2.6s ease-in-out infinite" }}
        />
      </svg>
    </div>
  );
}

function QuantumRing({ size }: { size: number }) {
  const pad = Math.round(size * 0.22);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.55;
  const cr = AVATAR_TILE_RADIUS + pad * 0.55;
  const id = `qm${size}`;
  const dots = 3;
  const period = 7; // seconds — slow & deliberate
  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`${id}g`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Faint guide ring */}
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="rgba(139,92,246,0.18)" strokeWidth="1" strokeDasharray="2 6" />
        {/* Three orbiting nodes spaced evenly */}
        {Array.from({ length: dots }).map((_, i) => {
          const t = i / dots;
          const { x, y } = pointOnRoundedRect(t, c, c, half, cr);
          return (
            <circle
              key={uid("qmd", i)}
              cx={x}
              cy={y}
              r={2.6}
              fill="#8b5cf6"
              filter={`url(#${id}g)`}
              style={{
                animation: `dec-spin ${period}s linear infinite`,
                transformOrigin: `${c}px ${c}px`,
                animationDelay: `${-i * (period / dots)}s`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function HelixRing({ size }: { size: number }) {
  const pad = Math.round(size * 0.18);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.55;
  const cr = AVATAR_TILE_RADIUS + pad * 0.55;
  const id = `hx${size}`;
  // Approximate perimeter for the dasharray — exact length isn't critical
  // because the gradient trims the visible portion to a soft arc anyway.
  const sideLen = 2 * half - 2 * cr;
  const arcLen = (Math.PI / 2) * cr;
  const perim = 4 * sideLen + 4 * arcLen;
  const visible = Math.round(perim * 0.22);
  const hidden = Math.round(perim - visible);
  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}a`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(99,102,241,0)" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="rgba(99,102,241,0)" />
          </linearGradient>
          <linearGradient id={`${id}b`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34,211,238,0)" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </linearGradient>
          <filter id={`${id}g`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
        {/* Indigo arc rotating clockwise */}
        <g style={{ animation: `dec-spin 7s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke={`url(#${id}a)`} strokeWidth="2.2" strokeDasharray={`${visible} ${hidden}`} filter={`url(#${id}g)`} />
        </g>
        {/* Cyan arc rotating counter-clockwise */}
        <g style={{ animation: `dec-spin-rev 7s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke={`url(#${id}b)`} strokeWidth="2.2" strokeDasharray={`${visible} ${hidden}`} filter={`url(#${id}g)`} />
        </g>
      </svg>
    </div>
  );
}

function SentinelRing({ size }: { size: number }) {
  const pad = Math.round(size * 0.22);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.32;
  const cr = AVATAR_TILE_RADIUS + pad * 0.32;
  const id = `st${size}`;
  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`${id}g`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        {/* Solid base ring — the "verified" anchor */}
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="#10b981" strokeWidth="1.8" opacity="0.95" />
        {/* Two staggered expanding rings — like a security/scan pulse */}
        <g style={{ animation: "dec-sentinel-expand 2.6s ease-out infinite", transformOrigin: `${c}px ${c}px` }}>
          <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="#10b981" strokeWidth="1.4" filter={`url(#${id}g)`} />
        </g>
        <g style={{ animation: "dec-sentinel-expand 2.6s ease-out infinite", animationDelay: "1.3s", transformOrigin: `${c}px ${c}px` }}>
          <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="#10b981" strokeWidth="1.4" filter={`url(#${id}g)`} />
        </g>
      </svg>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   TACTICAL DECORATIONS
   ──────────────────────────────────────────────────────────────────────
   Discord-inspired premium frames. More visually rich than the Professional
   set — tick marks, HUD brackets, sword-blade crescents, traveling circuit
   pulses. Each one is built to feel like a "loot drop" reward frame.
   ════════════════════════════════════════════════════════════════════════ */

function HologramRing({ size }: { size: number }) {
  // Cyan double-ring with HUD tick markers and a slow rotation. Inspired by
  // Discord's "Hologram Disc" — concentric crisp rings + radial ticks that
  // make the frame read as a sci-fi instrument panel rather than a plain
  // outline.
  const pad = Math.round(size * 0.22);
  const w = size + pad * 2;
  const c = w / 2;
  const halfOuter = size / 2 + pad * 0.7;
  const crOuter = AVATAR_TILE_RADIUS + pad * 0.7;
  const halfInner = size / 2 + pad * 0.3;
  const crInner = AVATAR_TILE_RADIUS + pad * 0.3;
  const id = `hl${size}`;
  const ticks = 16;
  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f5ff" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#00d4ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#0099ff" stopOpacity="0.95" />
          </linearGradient>
          <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Inner sharp ring — stays still so the avatar has a crisp border */}
        <path d={roundedRectPath(c, c, halfInner, crInner)} fill="none" stroke="#00f5ff" strokeWidth="1.2" opacity="0.7" />
        {/* Outer rotating ring + tick markers */}
        <g style={{ animation: "dec-spin 24s linear infinite", transformOrigin: `${c}px ${c}px` }}>
          <path d={roundedRectPath(c, c, halfOuter, crOuter)} fill="none" stroke={`url(#${id}g)`} strokeWidth="2" filter={`url(#${id}glow)`} />
          {Array.from({ length: ticks }).map((_, i) => {
            const t = i / ticks;
            const inner = pointOnRoundedRect(t, c, c, halfOuter - 4, Math.max(0, crOuter - 4));
            const outer = pointOnRoundedRect(t, c, c, halfOuter + 3, crOuter + 3);
            const major = i % 4 === 0;
            return (
              <line
                key={uid("hltk", i)}
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke="#00f5ff"
                strokeWidth={major ? 1.8 : 1}
                opacity={major ? 1 : 0.55}
                filter={`url(#${id}glow)`}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function TacticalRing({ size }: { size: number }) {
  // HUD targeting reticle — four corner L-brackets that breathe. They sit
  // outside the avatar's rounded corners (in the dead space of the bounding
  // box), creating that "the camera is locked on this person" look.
  const pad = Math.round(size * 0.22);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.65;
  const cr = AVATAR_TILE_RADIUS + pad * 0.65;
  const id = `tc${size}`;
  const bracketLen = Math.max(6, pad * 0.55);
  const x1 = c - half, y1 = c - half;
  const x2 = c + half, y2 = c + half;
  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Faint dashed outer reference path — the "targeting halo" */}
        <path d={roundedRectPath(c, c, half - 2, Math.max(0, cr - 2))} fill="none" stroke="rgba(0,229,255,0.20)" strokeWidth="1" strokeDasharray="2 5" />
        {/* Four L-brackets, breathing together */}
        <g
          stroke="#00e5ff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={`url(#${id}glow)`}
          style={{ animation: "dec-breath 2.4s ease-in-out infinite" }}
        >
          <polyline points={`${x1 + bracketLen},${y1} ${x1},${y1} ${x1},${y1 + bracketLen}`} />
          <polyline points={`${x2 - bracketLen},${y1} ${x2},${y1} ${x2},${y1 + bracketLen}`} />
          <polyline points={`${x1},${y2 - bracketLen} ${x1},${y2} ${x1 + bracketLen},${y2}`} />
          <polyline points={`${x2},${y2 - bracketLen} ${x2},${y2} ${x2 - bracketLen},${y2}`} />
        </g>
        {/* Tiny center crosshair tick marks at the four cardinal points */}
        <g stroke="#00e5ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" filter={`url(#${id}glow)`}>
          <line x1={c} y1={y1 - 4} x2={c} y2={y1 + 2} />
          <line x1={c} y1={y2 - 2} x2={c} y2={y2 + 4} />
          <line x1={x1 - 4} y1={c} x2={x1 + 2} y2={c} />
          <line x1={x2 - 2} y1={c} x2={x2 + 4} y2={c} />
        </g>
      </svg>
    </div>
  );
}

function CrimsonBladeRing({ size }: { size: number }) {
  // A crimson sword-blade crescent — about 72% of the perimeter is drawn,
  // with a ~28% "cut" gap. The whole arc rotates slowly so the cut sweeps
  // around the avatar like a slash. Inspired by Discord's "Ares Disc".
  const pad = Math.round(size * 0.22);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.65;
  const cr = AVATAR_TILE_RADIUS + pad * 0.65;
  const id = `cb${size}`;
  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          {/* Gradient runs along path direction — fades in/out at the cut */}
          <linearGradient id={`${id}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7a0d1f" stopOpacity="0" />
            <stop offset="12%" stopColor="#dc143c" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#ff2b4d" stopOpacity="1" />
            <stop offset="88%" stopColor="#dc143c" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#7a0d1f" stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Faint dim ghost arc behind, so users see the avatar is fully framed */}
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="rgba(220,20,60,0.10)" strokeWidth="1" />
        {/* Rotating crescent blade — pathLength + dasharray gives a clean cut */}
        <g style={{ animation: "dec-spin 12s linear infinite", transformOrigin: `${c}px ${c}px` }}>
          <path
            d={roundedRectPath(c, c, half, cr)}
            fill="none"
            stroke={`url(#${id}g)`}
            strokeWidth="2.8"
            pathLength={100}
            strokeDasharray="72 28"
            strokeLinecap="round"
            filter={`url(#${id}glow)`}
            style={{ animation: "dec-aurora-shimmer 3s ease-in-out infinite" }}
          />
        </g>
      </svg>
    </div>
  );
}

function CircuitCoreRing({ size }: { size: number }) {
  // Eight evenly-spaced segments around the perimeter (like LED bars), with
  // a single bright leading segment that travels around the ring as if a
  // pulse of energy is loading. Inspired by sci-fi reactor / "loading"
  // rings in Discord premium frames.
  const pad = Math.round(size * 0.20);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.55;
  const cr = AVATAR_TILE_RADIUS + pad * 0.55;
  const id = `cc${size}`;
  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Dim segmented base — 8 segments of 10% with 2.5% gaps */}
        <path
          d={roundedRectPath(c, c, half, cr)}
          fill="none"
          stroke="rgba(16,185,129,0.55)"
          strokeWidth="2.4"
          pathLength={100}
          strokeDasharray="10 2.5"
          strokeLinecap="butt"
        />
        {/* Bright traveling segment — dasharray "10 90" shows only one
            10% segment at a time, and the parent <g> rotation moves it
            around the perimeter once every 4 seconds. */}
        <g style={{ animation: "dec-spin 4s linear infinite", transformOrigin: `${c}px ${c}px` }}>
          <path
            d={roundedRectPath(c, c, half, cr)}
            fill="none"
            stroke="#10ffaa"
            strokeWidth="2.6"
            pathLength={100}
            strokeDasharray="10 90"
            strokeLinecap="butt"
            filter={`url(#${id}glow)`}
          />
        </g>
      </svg>
    </div>
  );
}

interface ProfileDecorationProps {
  decorationId: string | null | undefined;
  size?: number;
  children: React.ReactNode;
}

export function ProfileDecoration({ decorationId, size = 56, children }: ProfileDecorationProps) {
  if (!decorationId || decorationId === "none") return <>{children}</>;

  const wrapStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    // The "deco-wrap" class is what the prefers-reduced-motion media query
    // hooks into to disable all animations inside this subtree.
    <div style={wrapStyle} className="deco-wrap">
      <style>{DECO_STYLES}</style>
      {/* Professional set */}
      {decorationId === "aurora" && <AuroraRing size={size} />}
      {decorationId === "executive" && <ExecutiveRing size={size} />}
      {decorationId === "pulse" && <PulseRing size={size} />}
      {decorationId === "quantum" && <QuantumRing size={size} />}
      {decorationId === "helix" && <HelixRing size={size} />}
      {decorationId === "sentinel" && <SentinelRing size={size} />}
      {/* Tactical set (Discord-inspired premium frames) */}
      {decorationId === "hologram" && <HologramRing size={size} />}
      {decorationId === "tactical" && <TacticalRing size={size} />}
      {decorationId === "crimson" && <CrimsonBladeRing size={size} />}
      {decorationId === "circuit" && <CircuitCoreRing size={size} />}
      {/* Expressive set */}
      {decorationId === "cosmic" && <CosmicRing size={size} />}
      {decorationId === "fire" && <FireAura size={size} />}
      {decorationId === "lightning" && <LightningAura size={size} />}
      {decorationId === "sparkles" && <SparklesAura size={size} />}
      {decorationId === "rainbow" && <RainbowRing size={size} />}
      {decorationId === "snow" && <FrostAura size={size} />}
      {decorationId === "hearts" && <HeartsAura size={size} />}
      {decorationId === "stars" && <StarsRing size={size} />}
      {decorationId === "bubbles" && <BubblesAura size={size} />}
      {decorationId === "flowers" && <PetalsAura size={size} />}
      {decorationId === "catears" && <CatEarsDecoration size={size} />}
      {children}
    </div>
  );
}

export const ROOM_THEMES = [
  { id: "none", label: "Default", description: "Standard theme", bg: "", preview: "from-slate-600 to-slate-800", img: "https://images.unsplash.com/photo-1497091071254-cc9b2ba7c48a?w=160&h=90&fit=crop" },
  { id: "premium-atmosphere", label: "💎 Premium Atmosphere", description: "Transparent neon glass with luxury cosmic motion", bg: "premium-atmosphere", preview: "from-purple-400 via-fuchsia-400 to-teal-400", img: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=160&h=90&fit=crop" },
  { id: "plasma", label: "⚡ Plasma", description: "Electric purple & blue plasma energy", bg: "plasma", preview: "from-purple-600 via-violet-500 to-blue-500", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=160&h=90&fit=crop" },
  { id: "neon", label: "🌆 Neon City", description: "Cyan & purple neon glow", bg: "neon", preview: "from-cyan-400 via-sky-500 to-purple-600", img: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=160&h=90&fit=crop" },
  { id: "galaxy", label: "🌌 Galaxy", description: "Deep space starfield", bg: "galaxy", preview: "from-indigo-900 via-slate-800 to-purple-900", img: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=160&h=90&fit=crop" },
  { id: "sunset", label: "🌅 Sunset", description: "Warm orange glow", bg: "sunset", preview: "from-orange-400 via-rose-400 to-pink-500", img: "https://images.unsplash.com/photo-1503803548695-c2a7b4a5b875?w=160&h=90&fit=crop" },
  { id: "forest", label: "🌿 Forest", description: "Green nature vibes", bg: "forest", preview: "from-green-700 via-emerald-500 to-teal-400", img: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=160&h=90&fit=crop" },
  { id: "cyberpunk", label: "🤖 Cyberpunk", description: "Yellow & cyan grid", bg: "cyberpunk", preview: "from-yellow-400 via-lime-400 to-cyan-400", img: "https://images.unsplash.com/photo-1620503374956-c942862f0372?w=160&h=90&fit=crop" },
  { id: "ocean", label: "🌊 Ocean", description: "Deep blue waves", bg: "ocean", preview: "from-blue-800 via-blue-600 to-cyan-400", img: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=160&h=90&fit=crop" },
  { id: "cherry", label: "🌸 Cherry Blossom", description: "Pink floral dream", bg: "cherry", preview: "from-pink-300 via-pink-400 to-rose-500", img: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=160&h=90&fit=crop" },
  { id: "aurora", label: "🌌 Aurora", description: "Northern lights", bg: "aurora", preview: "from-green-400 via-teal-500 to-purple-600", img: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=160&h=90&fit=crop" },
  { id: "matrix", label: "💻 Matrix", description: "Digital rain", bg: "matrix", preview: "from-green-900 via-green-700 to-green-500", img: "https://images.unsplash.com/photo-1526378722484-bd91ca387e72?w=160&h=90&fit=crop" },
  { id: "storm", label: "⛈️ Thunderstorm", description: "Rain & lightning", bg: "storm", preview: "from-slate-700 via-slate-600 to-blue-700", img: "https://images.unsplash.com/photo-1504370805625-d37c82b94a8e?w=160&h=90&fit=crop" },
  { id: "volcanic", label: "🌋 Volcanic", description: "Lava & embers", bg: "volcanic", preview: "from-red-700 via-orange-500 to-yellow-500", img: "https://images.unsplash.com/photo-1495953557-73f0ba4c50af?w=160&h=90&fit=crop" },
] as const;

export type RoomThemeId = typeof ROOM_THEMES[number]["id"];

const ROOM_THEME_KEYFRAMES = `
  @keyframes rt-premium-drift {
    0%,100% { transform: translate(0,0) scale(1); opacity: 0.52; }
    35% { transform: translate(24px,-18px) scale(1.08); opacity: 0.82; }
    70% { transform: translate(-18px,14px) scale(0.94); opacity: 0.44; }
  }
  @keyframes rt-premium-constellation {
    0%,100% { opacity: 0.08; transform: scaleX(0.9); }
    50% { opacity: 0.24; transform: scaleX(1.04); }
  }
  @keyframes rt-dust-drift {
    0%   { transform: translate(0,0) scale(1); opacity: var(--dp,0.4); }
    25%  { transform: translate(var(--dx1,4px), var(--dy1,-6px)) scale(1.05); opacity: calc(var(--dp,0.4) * 1.5); }
    50%  { transform: translate(var(--dx2,-3px), var(--dy2,-12px)) scale(0.95); opacity: calc(var(--dp,0.4) * 0.6); }
    75%  { transform: translate(var(--dx3,6px), var(--dy3,-18px)) scale(1.02); opacity: calc(var(--dp,0.4) * 1.2); }
    100% { transform: translate(0, var(--dend,-25px)) scale(0.85); opacity: 0; }
  }
  @keyframes rt-dust-twinkle {
    0%,100% { opacity: var(--dp,0.3); transform: scale(0.8); }
    50%      { opacity: calc(var(--dp,0.3) * 2.5); transform: scale(1.4); }
  }
  @keyframes rt-center-glow {
    0%,100% { opacity: 0.18; transform: scale(1); }
    50%      { opacity: 0.28; transform: scale(1.06); }
  }
  @keyframes rt-orb-drift {
    0%,100% { transform: translate(0,0) scale(1); opacity: 0.55; }
    33%  { transform: translate(22px,-28px) scale(1.08); opacity: 0.75; }
    66%  { transform: translate(-18px,16px) scale(0.94); opacity: 0.45; }
  }
  @keyframes rt-orb-drift2 {
    0%,100% { transform: translate(0,0) scale(1); opacity: 0.45; }
    40%  { transform: translate(-30px,20px) scale(1.12); opacity: 0.65; }
    75%  { transform: translate(18px,-12px) scale(0.9); opacity: 0.35; }
  }
  @keyframes rt-scanline {
    0%   { transform: translateY(-100%); opacity: 0; }
    5%   { opacity: 1; }
    95%  { opacity: 0.6; }
    100% { transform: translateY(120vh); opacity: 0; }
  }
  @keyframes rt-grid-pulse {
    0%,100% { opacity: 0.10; }
    50%      { opacity: 0.22; }
  }
  @keyframes rt-star-twinkle {
    0%,100% { opacity: 0.15; transform: scale(0.7); }
    50%      { opacity: 1;    transform: scale(1.3); }
  }
  @keyframes rt-shooting-star {
    0%   { transform: translate(0,0) rotate(-30deg); opacity: 1; width: 0px; }
    50%  { opacity: 0.8; width: 120px; }
    100% { transform: translate(300px, 120px) rotate(-30deg); opacity: 0; width: 0px; }
  }
  @keyframes rt-aurora {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes rt-firefly {
    0%,100% { opacity: 0; transform: translate(0,0) scale(0.4); }
    25%      { opacity: 0.9; transform: translate(var(--fx1,8px),var(--fy1,-12px)) scale(1.1); }
    75%      { opacity: 0.4; transform: translate(var(--fx2,-6px),var(--fy2,6px)) scale(0.7); }
  }
  @keyframes rt-bubble {
    0%   { opacity: 0; transform: translateY(0) scale(0.4); }
    15%  { opacity: 0.7; }
    85%  { opacity: 0.3; }
    100% { opacity: 0; transform: translateY(-90px) scale(1.15); }
  }
  @keyframes rt-ocean-wave {
    0%,100% { transform: translateX(0) scaleY(1); }
    50%      { transform: translateX(-28px) scaleY(1.06); }
  }
  @keyframes rt-cherry-fall {
    0%   { opacity: 0; transform: translate(0,-10px) rotate(0deg); }
    8%   { opacity: 1; }
    90%  { opacity: 0.7; }
    100% { opacity: 0; transform: translate(var(--cx,40px),110vh) rotate(var(--cr,220deg)); }
  }
  @keyframes rt-glitch {
    0%,92%,100% { clip-path: none; transform: none; opacity: 0; }
    93%          { clip-path: inset(30% 0 40% 0); transform: translateX(-4px); opacity: 0.7; }
    95%          { clip-path: inset(60% 0 10% 0); transform: translateX(4px);  opacity: 0.5; }
    97%          { clip-path: inset(10% 0 70% 0); transform: translateX(-2px); opacity: 0.6; }
  }
  @keyframes rt-nebula-spin {
    from { transform: rotate(0deg) scale(1);   opacity: 0.08; }
    50%  { transform: rotate(180deg) scale(1.1); opacity: 0.14; }
    to   { transform: rotate(360deg) scale(1);   opacity: 0.08; }
  }
  @keyframes rt-petal-drift {
    0%,100% { transform: rotate(0deg) translateX(0); }
    50%      { transform: rotate(8deg) translateX(10px); }
  }
  @keyframes rt-aurora-wave {
    0%,100% { transform: translateX(0%) scaleY(1) skewX(0deg); opacity: var(--ao,0.35); }
    20%     { transform: translateX(4%) scaleY(1.15) skewX(2deg); opacity: calc(var(--ao,0.35)*1.5); }
    50%     { transform: translateX(-6%) scaleY(0.88) skewX(-3deg); opacity: calc(var(--ao,0.35)*0.7); }
    75%     { transform: translateX(3%) scaleY(1.08) skewX(1deg); opacity: calc(var(--ao,0.35)*1.3); }
  }
  @keyframes rt-aurora-float {
    0%,100% { transform: translateY(0) scaleX(1); }
    50%     { transform: translateY(-12px) scaleX(1.04); }
  }
  @keyframes rt-matrix-drop {
    0%   { transform: translateY(-120px); opacity: 0; }
    4%   { opacity: 1; }
    88%  { opacity: 0.85; }
    100% { transform: translateY(110vh); opacity: 0; }
  }
  @keyframes rt-matrix-head {
    0%,100% { text-shadow: 0 0 8px #00ff41, 0 0 16px #00ff41; opacity: 1; }
    50%     { text-shadow: 0 0 14px #00ff41, 0 0 28px #00ff41, 0 0 40px #00ff41; opacity: 1; }
  }
  @keyframes rt-rain-fall {
    0%   { transform: translate(0, -80px) rotate(12deg); opacity: 0; }
    6%   { opacity: var(--ro,0.55); }
    92%  { opacity: var(--ro,0.55); }
    100% { transform: translate(var(--rx,30px), 110vh) rotate(12deg); opacity: 0; }
  }
  @keyframes rt-lightning-flash {
    0%,88%,100% { opacity: 0; }
    89%  { opacity: 0.55; }
    90%  { opacity: 0.02; }
    92%  { opacity: 0.38; }
    93%  { opacity: 0; }
  }
  @keyframes rt-lightning-bolt {
    0%,85%,100% { opacity: 0; }
    86%  { opacity: 1; }
    88%  { opacity: 0; }
    90%  { opacity: 0.6; }
    91%  { opacity: 0; }
  }
  @keyframes rt-ember-rise {
    0%   { transform: translate(0,0) scale(1); opacity: 0; }
    6%   { opacity: 1; }
    50%  { transform: translate(var(--ex,8px),-45vh) scale(0.65); opacity: 0.8; }
    100% { transform: translate(var(--ex2,-12px),-95vh) scale(0.2); opacity: 0; }
  }
  @keyframes rt-lava-glow {
    0%,100% { opacity: 0.18; transform: scaleY(1) scaleX(1); }
    50%     { opacity: 0.28; transform: scaleY(1.08) scaleX(1.03); }
  }
  @keyframes rt-heat-shimmer {
    0%,100% { filter: blur(22px) brightness(1); transform: translateY(0); }
    50%     { filter: blur(28px) brightness(1.15); transform: translateY(-4px); }
  }
`;

export function getChatPanelStyle(themeId: string | null | undefined): React.CSSProperties {
  switch (themeId) {
    case "premium-atmosphere":
      return { background: "rgba(6,8,24,0.58)", backdropFilter: "blur(20px) saturate(1.4)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", borderColor: "rgba(0,220,255,0.24)" };
    case "plasma":
      return { background: "rgba(12,4,28,0.68)", backdropFilter: "blur(18px) saturate(1.5)", WebkitBackdropFilter: "blur(18px) saturate(1.5)", borderColor: "rgba(140,60,255,0.28)" };
    case "neon":
      return { background: "rgba(5,3,14,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(80,40,180,0.22)" };
    case "galaxy":
      return { background: "rgba(6,7,18,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(60,80,200,0.20)" };
    case "sunset":
      return { background: "rgba(12,3,0,0.74)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(180,60,20,0.22)" };
    case "forest":
      return { background: "rgba(2,8,2,0.74)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(30,130,50,0.18)" };
    case "cyberpunk":
      return { background: "rgba(6,6,0,0.76)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(160,150,0,0.22)" };
    case "ocean":
      return { background: "rgba(0,3,18,0.74)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(20,80,200,0.22)" };
    case "cherry":
      return { background: "rgba(10,0,8,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(180,20,100,0.22)" };
    case "aurora":
      return { background: "rgba(0,10,12,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(0,180,100,0.22)" };
    case "matrix":
      return { background: "rgba(0,5,0,0.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(0,200,60,0.25)" };
    case "storm":
      return { background: "rgba(4,8,18,0.78)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(40,80,200,0.22)" };
    case "volcanic":
      return { background: "rgba(14,2,0,0.76)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "rgba(200,40,0,0.22)" };
    default:
      // Default chat panel — matches the lobby's midnight-purple neumorphic
      // surface (deep violet-charcoal with a faint warm amber rim).
      return {
        background: "rgba(20, 14, 30, 0.82)",
        backdropFilter: "blur(18px) saturate(1.15)",
        WebkitBackdropFilter: "blur(18px) saturate(1.15)",
        borderColor: "rgba(255, 168, 92, 0.10)",
      };
  }
}

export function getRoomThemeStyle(themeId: string | null | undefined): React.CSSProperties {
  switch (themeId) {
    case "premium-atmosphere":
      return { background: "radial-gradient(ellipse at 20% 18%, rgba(0,90,255,0.24) 0%, transparent 38%), radial-gradient(ellipse at 82% 34%, rgba(255,75,28,0.18) 0%, transparent 42%), radial-gradient(ellipse at 48% 72%, rgba(255,0,190,0.12) 0%, transparent 46%), #03050f" };
    case "plasma":
      return { background: "radial-gradient(ellipse at 30% 20%, rgba(120,40,255,0.32) 0%, transparent 45%), radial-gradient(ellipse at 75% 65%, rgba(0,120,255,0.22) 0%, transparent 50%), radial-gradient(ellipse at 55% 90%, rgba(200,0,255,0.18) 0%, transparent 40%), #07020f" };
    case "neon":
      return { background: "radial-gradient(ellipse at 30% 40%, #07091c 0%, #060612 55%, #08060e 100%)" };
    case "galaxy":
      return { background: "radial-gradient(ellipse at 20% 25%, #151535 0%, #0b0c12 50%, #090b1e 100%)" };
    case "sunset":
      return { background: "radial-gradient(ellipse at 50% 20%, #1c0800 0%, #0f0400 50%, #070200 100%)" };
    case "forest":
      return { background: "radial-gradient(ellipse at 50% 100%, #041608 0%, #020e05 55%, #010604 100%)" };
    case "cyberpunk":
      return { background: "radial-gradient(ellipse at 50% 50%, #0d0c00 0%, #070600 55%, #040400 100%)" };
    case "ocean":
      return { background: "radial-gradient(ellipse at 50% 80%, #000b28 0%, #000618 55%, #000310 100%)" };
    case "cherry":
      return { background: "radial-gradient(ellipse at 50% 0%, #1c0018 0%, #0d000d 55%, #060006 100%)" };
    case "aurora":
      return { background: "radial-gradient(ellipse at 50% 80%, #001512 0%, #000c0a 55%, #00080a 100%)" };
    case "matrix":
      return { background: "#000300" };
    case "storm":
      return { background: "radial-gradient(ellipse at 50% 0%, #060c1c 0%, #030710 55%, #020510 100%)" };
    case "volcanic":
      return { background: "radial-gradient(ellipse at 50% 100%, #1c0400 0%, #0e0200 55%, #080100 100%)" };
    default:
      // Default room background — a single, unified sculpted neumorphic panel.
      // Deep violet-slate base with a directional top-left light source and a
      // soft bottom-right shadow so the whole room reads as ONE big pressed-in
      // 3D pillow, not a starry sky. The faint corner blooms are violet so it
      // ties back to the platform shell.
      return {
        background:
          "radial-gradient(ellipse 90% 60% at 22% -8%, rgba(220, 215, 255, 0.08) 0%, transparent 55%), " +
          "radial-gradient(ellipse 75% 55% at 12% 12%, hsl(var(--neu-orange-hi) / 0.10) 0%, transparent 60%), " +
          "radial-gradient(ellipse 75% 55% at 88% 18%, hsl(var(--neu-orange) / 0.08) 0%, transparent 62%), " +
          "radial-gradient(ellipse 95% 70% at 78% 110%, rgba(0, 0, 0, 0.55) 0%, transparent 60%), " +
          "radial-gradient(ellipse 95% 75% at 50% 50%, rgba(0, 0, 0, 0.18) 60%, transparent 100%), " +
          "linear-gradient(160deg, hsl(232 16% 19%) 0%, hsl(230 18% 14%) 45%, hsl(228 20% 10%) 100%)",
      };
  }
}

export function RoomThemeOverlay({ themeId }: { themeId: string | null | undefined }) {
  const base: React.CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 };

  if (!themeId || themeId === "none") {
    // Default room overlay — sculpted neumorphic 3D panel.
    // Light source from the upper-left, soft inset rim shadow on the
    // lower-right, breathing violet ambient bloom in the center, and a
    // faint inner vignette so the whole room reads as ONE unified
    // pressed-in pillow rather than a starry sky.
    return (
      <div style={base}>
        <style>{ROOM_THEME_KEYFRAMES}</style>
        {/* directional top-left rim light */}
        <div style={{
          position: "absolute", inset: 0,
          background:
            "radial-gradient(ellipse 70% 55% at 8% 4%, rgba(220, 215, 255, 0.10) 0%, transparent 55%), " +
            "linear-gradient(135deg, rgba(220, 215, 255, 0.05) 0%, transparent 28%)",
        }} />
        {/* soft bottom-right pressed-in shadow */}
        <div style={{
          position: "absolute", inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 100% 100%, rgba(0, 0, 0, 0.45) 0%, transparent 55%), " +
            "linear-gradient(135deg, transparent 65%, rgba(0, 0, 0, 0.30) 100%)",
        }} />
        {/* center violet ambient bloom — gentle breathing */}
        <div style={{
          position: "absolute", top: "18%", left: "22%", right: "22%", bottom: "18%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at 50% 50%, hsl(var(--neu-orange-hi) / 0.10) 0%, hsl(var(--neu-orange) / 0.06) 35%, transparent 70%)",
          filter: "blur(40px)",
          animation: "rt-center-glow 10s ease-in-out infinite",
        }} />
        {/* secondary off-axis violet pillow for depth */}
        <div style={{
          position: "absolute", top: "8%", left: "55%", width: "45%", height: "55%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at 50% 50%, hsl(var(--neu-orange) / 0.08) 0%, transparent 65%)",
          filter: "blur(60px)",
          animation: "rt-orb-drift 14s ease-in-out infinite",
        }} />
        {/* inner edge vignette — completes the inset 3D panel feel */}
        <div style={{
          position: "absolute", inset: 0,
          boxShadow:
            "inset 0 60px 90px -40px rgba(0, 0, 0, 0.45), " +
            "inset 0 -80px 120px -40px rgba(0, 0, 0, 0.55), " +
            "inset 80px 0 100px -50px rgba(0, 0, 0, 0.30), " +
            "inset -80px 0 100px -50px rgba(0, 0, 0, 0.40)",
          pointerEvents: "none",
        }} />
      </div>
    );
  }

  if (themeId === "none") return null;

  switch (themeId) {
    case "premium-atmosphere":
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 15% 12%, rgba(0,220,255,0.18) 0%, transparent 45%), radial-gradient(ellipse at 88% 30%, rgba(255,98,35,0.16) 0%, transparent 42%), radial-gradient(ellipse at 45% 70%, rgba(255,0,200,0.10) 0%, transparent 48%)" }} />
          <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(115deg, transparent 0 28%, rgba(0,220,255,0.10) 30%, transparent 32% 100%), linear-gradient(24deg, transparent 0 42%, rgba(255,128,64,0.10) 44%, transparent 46% 100%)", animation:"rt-premium-constellation 7s ease-in-out infinite" }} />
          {[0,1,2].map((i)=>(
            <div key={i} style={{ position:"absolute", borderRadius:"50%", width:`${38 + i * 18}%`, height:`${38 + i * 18}%`, left:`${-8 + i * 32}%`, top:`${-10 + i * 18}%`, background:i === 0 ? "radial-gradient(circle, rgba(0,220,255,0.14), transparent 66%)" : i === 1 ? "radial-gradient(circle, rgba(255,0,200,0.12), transparent 68%)" : "radial-gradient(circle, rgba(255,118,42,0.14), transparent 68%)", filter:"blur(10px)", animation:`rt-premium-drift ${10 + i * 3}s ease-in-out infinite ${i * 1.6}s` }} />
          ))}
          {Array.from({length:60}).map((_,i)=>(
            <div key={i} style={{ position:"absolute", borderRadius:"50%", width:1+(i%4), height:1+(i%4), background:i%5===0 ? "rgba(255,141,73,0.92)" : i%3===0 ? "rgba(255,0,200,0.84)" : "rgba(170,225,255,0.9)", top:`${(i*19+11)%100}%`, left:`${(i*23+7)%100}%`, boxShadow:i%4===0 ? "0 0 10px currentColor" : undefined, animation:`rt-star-twinkle ${1.6+(i%8)*0.35}s ease-in-out infinite ${(i%11)*0.24}s`, opacity:0.14+(i%6)*0.09 }} />
          ))}
          {Array.from({length:4}).map((_,i)=>(
            <div key={`line-${i}`} style={{ position:"absolute", height:"1px", width:`${24 + i * 10}%`, left:`${8 + i * 20}%`, top:`${18 + i * 17}%`, background:"linear-gradient(90deg, transparent, rgba(0,220,255,0.34), rgba(255,0,200,0.20), transparent)", transform:`rotate(${-16 + i * 11}deg)`, animation:`rt-premium-constellation ${4.8+i}s ease-in-out infinite ${i * 0.6}s` }} />
          ))}
        </div>
      );
    case "plasma":
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", top:"-20%", left:"-15%", width:"60%", height:"60%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(120,40,255,0.18) 0%, transparent 65%)",
            animation:"rt-orb-drift 9s ease-in-out infinite" }} />
          <div style={{ position:"absolute", bottom:"-15%", right:"-12%", width:"55%", height:"55%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(0,120,255,0.14) 0%, transparent 65%)",
            animation:"rt-orb-drift2 12s ease-in-out infinite 2s" }} />
          <div style={{ position:"absolute", top:"30%", right:"10%", width:"40%", height:"40%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(200,0,255,0.10) 0%, transparent 70%)",
            animation:"rt-orb-drift 15s ease-in-out infinite 4s" }} />
          <div style={{ position:"absolute", top:0, left:"38%", width:"1px", height:"100%",
            background:"linear-gradient(to bottom, transparent, rgba(120,40,255,0.22), transparent)",
            animation:"rt-scanline 8s linear infinite" }} />
          <div style={{ position:"absolute", top:0, left:"65%", width:"1px", height:"100%",
            background:"linear-gradient(to bottom, transparent, rgba(0,120,255,0.16), transparent)",
            animation:"rt-scanline 11s linear infinite 3s" }} />
          {Array.from({length:22}).map((_,i)=>(
            <div key={i} style={{ position:"absolute", borderRadius:"50%",
              width: 1.5+(i%3)*1, height: 1.5+(i%3)*1,
              background: i%3===0 ? "#7828ff" : i%3===1 ? "#0078ff" : "#c800ff",
              top:`${(i*17+9)%100}%`, left:`${(i*23+13)%100}%`,
              opacity: 0.22+(i%4)*0.14,
              animation:`rt-star-twinkle ${1.8+(i%5)*0.4}s ease-in-out infinite ${(i%7)*0.35}s` }} />
          ))}
        </div>
      );
    case "neon":
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", top:"-15%", left:"-10%", width:"55%", height:"55%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 65%)",
            animation:"rt-orb-drift 8s ease-in-out infinite" }} />
          <div style={{ position:"absolute", bottom:"-10%", right:"-8%", width:"50%", height:"50%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(180,0,255,0.10) 0%, transparent 65%)",
            animation:"rt-orb-drift2 11s ease-in-out infinite 2s" }} />
          <div style={{ position:"absolute", top:"40%", right:"20%", width:"30%", height:"30%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(0,180,255,0.07) 0%, transparent 70%)",
            animation:"rt-orb-drift 13s ease-in-out infinite 5s" }} />
          <div style={{ position:"absolute", top:0, left:"45%", width:"1px", height:"100%",
            background:"linear-gradient(to bottom, transparent, rgba(0,212,255,0.18), transparent)",
            animation:"rt-scanline 7s linear infinite" }} />
          <div style={{ position:"absolute", top:0, left:"72%", width:"1px", height:"100%",
            background:"linear-gradient(to bottom, transparent, rgba(180,0,255,0.12), transparent)",
            animation:"rt-scanline 9s linear infinite 3s" }} />
          {Array.from({length:18}).map((_,i)=>(
            <div key={i} style={{ position:"absolute", borderRadius:"50%",
              width: 1.5+(i%3)*1, height: 1.5+(i%3)*1,
              background: i%2===0 ? "#00d4ff" : "#b400ff",
              top:`${(i*19+7)%100}%`, left:`${(i*23+11)%100}%`,
              opacity: 0.2+(i%4)*0.12,
              animation:`rt-star-twinkle ${1.8+(i%5)*0.5}s ease-in-out infinite ${(i%7)*0.4}s` }} />
          ))}
        </div>
      );

    case "galaxy":
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", inset:0,
            background:"radial-gradient(ellipse at 25% 35%, rgba(80,0,180,0.10) 0%, transparent 60%)",
            animation:"rt-nebula-spin 60s linear infinite" }} />
          <div style={{ position:"absolute", inset:0,
            background:"radial-gradient(ellipse at 75% 65%, rgba(0,60,180,0.08) 0%, transparent 55%)",
            animation:"rt-nebula-spin 80s linear infinite reverse" }} />
          {Array.from({length:55}).map((_,i)=>(
            <div key={i} style={{ position:"absolute", borderRadius:"50%",
              width: 1+(i%4)*1, height: 1+(i%4)*1,
              background:"#fff",
              top:`${(i*13+3)%100}%`, left:`${(i*19+7)%100}%`,
              animation:`rt-star-twinkle ${1.5+(i%7)*0.4}s ease-in-out infinite ${(i%11)*0.3}s`,
              opacity: 0.1+(i%6)*0.12 }} />
          ))}
          {Array.from({length:3}).map((_,i)=>(
            <div key={i} style={{ position:"absolute",
              top:`${10+i*28}%`, left:`${5+i*30}%`,
              height:"1.5px", background:"linear-gradient(to right, transparent, rgba(255,255,255,0.9), transparent)",
              animation:`rt-shooting-star ${5+i*3}s ease-out infinite ${i*4}s`,
              borderRadius:"9999px" }} />
          ))}
        </div>
      );

    case "sunset":
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", inset:0,
            background:"linear-gradient(160deg, rgba(255,80,0,0.14) 0%, rgba(220,40,0,0.09) 40%, rgba(180,0,20,0.06) 80%, transparent 100%)",
            backgroundSize:"200% 200%", animation:"rt-aurora 12s ease infinite" }} />
          <div style={{ position:"absolute", top:"-20%", left:"-10%", width:"60%", height:"60%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(255,100,0,0.12) 0%, transparent 65%)",
            animation:"rt-orb-drift 10s ease-in-out infinite" }} />
          <div style={{ position:"absolute", bottom:"-15%", right:"-5%", width:"45%", height:"45%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(200,20,0,0.10) 0%, transparent 65%)",
            animation:"rt-orb-drift2 14s ease-in-out infinite 3s" }} />
          {Array.from({length:14}).map((_,i)=>(
            <div key={i} style={{ position:"absolute", borderRadius:"50%",
              width: 2+(i%3)*1.5, height: 2+(i%3)*1.5,
              background: i%2===0 ? "rgba(255,140,0,0.7)" : "rgba(255,60,0,0.6)",
              top:`${(i*17+5)%100}%`, left:`${(i*21+9)%100}%`,
              animation:`rt-star-twinkle ${2+(i%5)*0.6}s ease-in-out infinite ${(i%6)*0.5}s` }} />
          ))}
        </div>
      );

    case "forest":
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"50%",
            background:"radial-gradient(ellipse at 50% 100%, rgba(20,180,60,0.08) 0%, transparent 70%)",
            animation:"rt-orb-drift 10s ease-in-out infinite" }} />
          {Array.from({length:22}).map((_,i)=>(
            <div key={i} style={{ position:"absolute", borderRadius:"50%",
              width: 3+(i%3)*2, height: 3+(i%3)*2,
              background:`radial-gradient(circle, rgba(${80+i*5},255,${100+i*3},0.85) 0%, rgba(0,200,60,0.1) 100%)`,
              top:`${(i*13+20)%100}%`, left:`${(i*17+5)%100}%`,
              animation:`rt-firefly ${3+(i%5)*0.8}s ease-in-out infinite ${(i%9)*0.4}s`,
              ["--fx1" as any]:`${-8+(i%3)*8}px`,
              ["--fy1" as any]:`${-10-(i%4)*5}px`,
              ["--fx2" as any]:`${6-(i%3)*5}px`,
              ["--fy2" as any]:`${8+(i%3)*4}px`,
            }} />
          ))}
          <div style={{ position:"absolute", inset:0,
            background:"radial-gradient(ellipse at 20% 80%, rgba(0,100,30,0.08) 0%, transparent 50%)" }} />
        </div>
      );

    case "cyberpunk":
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          {Array.from({length:10}).map((_,i)=>(
            <div key={`v${i}`} style={{ position:"absolute", top:0, bottom:0, left:`${i*10}%`,
              borderLeft:`1px solid rgba(255,${i%2===0?220:0},${i%2===0?0:220},0.18)`,
              animation:`rt-grid-pulse ${2+i*0.3}s ease-in-out infinite ${i*0.2}s` }} />
          ))}
          {Array.from({length:8}).map((_,i)=>(
            <div key={`h${i}`} style={{ position:"absolute", left:0, right:0, top:`${i*12.5}%`,
              borderTop:`1px solid rgba(0,220,255,0.12)`,
              animation:`rt-grid-pulse ${2.5+i*0.4}s ease-in-out infinite ${i*0.3}s` }} />
          ))}
          <div style={{ position:"absolute", inset:0,
            background:"radial-gradient(ellipse at 50% 50%, rgba(255,220,0,0.05) 0%, transparent 60%)",
            animation:"rt-orb-drift 8s ease-in-out infinite" }} />
          {Array.from({length:8}).map((_,i)=>(
            <div key={`p${i}`} style={{ position:"absolute", borderRadius:"50%",
              width:2, height:2, background: i%2===0 ? "#ffd700":"#00ffff",
              top:`${(i*23+10)%100}%`, left:`${(i*31+5)%100}%`,
              animation:`rt-glitch 6s linear infinite ${i*0.7}s`, opacity:0.8 }} />
          ))}
        </div>
      );

    case "ocean":
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          {Array.from({length:3}).map((_,i)=>(
            <div key={i} style={{ position:"absolute", bottom:`${i*8}%`, left:"-10%", right:"-10%",
              height:`${20+i*6}%`,
              background:`radial-gradient(ellipse at 50% 80%, rgba(0,${80+i*20},${180+i*20},${0.06+i*0.02}) 0%, transparent 70%)`,
              borderRadius:"60%",
              animation:`rt-ocean-wave ${6+i*2}s ease-in-out infinite ${i*1.5}s` }} />
          ))}
          {Array.from({length:20}).map((_,i)=>(
            <div key={i} style={{ position:"absolute", borderRadius:"50%",
              width: 3+(i%4)*2, height: 3+(i%4)*2,
              background:`radial-gradient(circle, rgba(100,220,255,0.7) 0%, rgba(0,180,255,0.1) 100%)`,
              top:`${(i*17+10)%85+10}%`, left:`${(i*23+5)%100}%`,
              animation:`rt-bubble ${3+(i%5)*0.7}s ease-out infinite ${(i%8)*0.5}s` }} />
          ))}
          <div style={{ position:"absolute", top:"-20%", left:"-10%", width:"55%", height:"55%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(0,60,200,0.08) 0%, transparent 65%)",
            animation:"rt-orb-drift 14s ease-in-out infinite" }} />
        </div>
      );

    case "cherry":
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", top:"-20%", left:"20%", width:"60%", height:"60%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(255,80,180,0.10) 0%, transparent 65%)",
            animation:"rt-orb-drift 12s ease-in-out infinite" }} />
          <div style={{ position:"absolute", bottom:"-10%", right:"-5%", width:"40%", height:"40%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(200,0,120,0.08) 0%, transparent 65%)",
            animation:"rt-orb-drift2 15s ease-in-out infinite 4s" }} />
          {Array.from({length:20}).map((_,i)=>(
            <div key={i} style={{ position:"absolute",
              fontSize: 12+(i%4)*5,
              top:`${(i*7)%15-5}%`,
              left:`${(i*17+3)%100}%`,
              animation:`rt-cherry-fall ${5+(i%6)*1.2}s ease-in cubic-bezier(.4,0,.6,1) infinite ${(i%8)*0.7}s`,
              ["--cx" as any]:`${-50+(i%5)*25}px`,
              ["--cr" as any]:`${160+(i%4)*30}deg`,
              userSelect:"none", opacity:0,
            }}>🌸</div>
          ))}
        </div>
      );

    case "aurora": {
      const auroraLayers = [
        { color: "0,220,120", top: 25, h: 18, dur: 14, del: 0, ao: 0.22 },
        { color: "0,180,255", top: 38, h: 14, dur: 18, del: 2, ao: 0.18 },
        { color: "80,40,255", top: 48, h: 10, dur: 22, del: 5, ao: 0.14 },
        { color: "0,255,180", top: 18, h: 20, dur: 16, del: 8, ao: 0.16 },
        { color: "140,0,255", top: 56, h: 12, dur: 20, del: 3, ao: 0.12 },
        { color: "0,240,200", top: 30, h: 8,  dur: 25, del: 11, ao: 0.10 },
      ];
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 100%, rgba(0,40,30,0.30) 0%, transparent 55%)" }} />
          {auroraLayers.map((l,i) => (
            <div key={i} style={{
              position:"absolute", left:"-20%", right:"-20%",
              top:`${l.top}%`, height:`${l.h}%`,
              background:`radial-gradient(ellipse at 50% 50%, rgba(${l.color},0.88) 0%, rgba(${l.color},0.28) 55%, transparent 100%)`,
              borderRadius:"50%",
              filter:"blur(28px)",
              ["--ao" as any]: l.ao,
              animation:`rt-aurora-wave ${l.dur}s ease-in-out infinite ${l.del}s, rt-aurora-float ${l.dur*0.6}s ease-in-out infinite ${l.del*0.5}s`,
            }} />
          ))}
          {Array.from({length:40}).map((_,i)=>(
            <div key={i} style={{ position:"absolute", borderRadius:"50%", width:1+(i%3), height:1+(i%3),
              background:`rgba(${i%3===0?"200,255,240":i%3===1?"180,220,255":"220,180,255"},0.9)`,
              top:`${(i*11+3)%100}%`, left:`${(i*17+7)%100}%`,
              animation:`rt-star-twinkle ${1.5+(i%6)*0.45}s ease-in-out infinite ${(i%9)*0.35}s`,
              opacity:0.1+(i%5)*0.09 }} />
          ))}
        </div>
      );
    }

    case "matrix": {
      const CHARS = "01アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEF0110∑∏Ω∞∂".split("");
      const cols = Array.from({length:36},(_,i)=>({
        left: (i/36)*100,
        chars: Array.from({length:18},(_,j)=>CHARS[(i*7+j*3)%CHARS.length]).join("\n"),
        dur: 1.8+(i%8)*0.35,
        del: (i*0.28)%8,
        opacity: 0.55+(i%5)*0.09,
      }));
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 50%, rgba(0,40,0,0.15) 0%, transparent 65%)" }} />
          {cols.map((c,i)=>(
            <div key={i} style={{
              position:"absolute",
              left:`${c.left}%`, top:0,
              width:"2%", minWidth:"14px",
              fontFamily:"'Courier New',monospace",
              fontSize:"11px",
              lineHeight:"1.4",
              whiteSpace:"pre",
              color:`rgba(0,${180+Math.round((i%8)*9)},${40+(i%4)*10},${c.opacity})`,
              textShadow:`0 0 6px rgba(0,255,65,${c.opacity*0.6})`,
              animation:`rt-matrix-drop ${c.dur}s linear infinite ${c.del}s`,
              userSelect:"none",
            }}>
              {c.chars}
            </div>
          ))}
          <div style={{ position:"absolute", inset:0,
            background:"radial-gradient(ellipse at 50% 50%, rgba(0,60,0,0.08) 0%, transparent 70%)" }} />
        </div>
      );
    }

    case "storm": {
      const rainDrops = Array.from({length:70},(_,i)=>({
        left: (i*1.44)%100,
        height: 28+(i%5)*12,
        dur: 0.45+(i%5)*0.12,
        del: (i*0.11)%3,
        opacity: 0.25+(i%4)*0.10,
        rx: 20+(i%4)*15,
      }));
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 30% 0%, rgba(40,60,180,0.12) 0%, transparent 55%)" }} />
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 70% 0%, rgba(20,40,140,0.09) 0%, transparent 55%)" }} />
          {[0,1,2].map(li=>(
            <div key={li} style={{ position:"absolute", inset:0,
              background:"rgba(200,220,255,0.04)",
              animation:`rt-lightning-flash ${8+li*5}s step-end infinite ${li*3.5}s` }} />
          ))}
          {[0,1].map(li=>(
            <div key={li} style={{
              position:"absolute",
              left:`${25+li*45}%`, top:0, width:"2px", bottom:"30%",
              background:"linear-gradient(to bottom, rgba(200,220,255,0.95), rgba(200,220,255,0.2), transparent)",
              clipPath:"polygon(0 0,100% 0,100% 55%,40% 55%,40% 100%,60% 100%,60% 70%,100% 70%,100% 100%,0 100%)",
              filter:"blur(1px)",
              animation:`rt-lightning-bolt ${9+li*6}s step-end infinite ${li*4+1}s`,
            }} />
          ))}
          {rainDrops.map((d,i)=>(
            <div key={i} style={{
              position:"absolute",
              left:`${d.left}%`, top:0,
              width:"1px", height:`${d.height}px`,
              background:"linear-gradient(to bottom, transparent, rgba(180,210,255,0.75), rgba(140,180,255,0.4), transparent)",
              ["--rx" as any]:`${d.rx}px`,
              ["--ro" as any]: d.opacity,
              animation:`rt-rain-fall ${d.dur}s linear infinite ${d.del}s`,
            }} />
          ))}
        </div>
      );
    }

    case "volcanic": {
      const embers = Array.from({length:45},(_,i)=>({
        left: 5+(i*2.1)%90,
        size: 2+(i%4)*1.5,
        dur: 2.5+(i%8)*0.55,
        del: (i*0.22)%6,
        ex: -20+(i%5)*10,
        ex2: -15+(i%6)*8,
        col: i%5===0?"255,200,0":i%5===1?"255,120,0":i%5===2?"255,60,20":i%5===3?"255,160,0":"255,80,30",
      }));
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          <div style={{ position:"absolute", bottom:"-5%", left:"-10%", right:"-10%", height:"35%",
            background:"radial-gradient(ellipse at 50% 100%, rgba(255,80,0,0.22) 0%, rgba(200,30,0,0.12) 50%, transparent 80%)",
            animation:"rt-lava-glow 4s ease-in-out infinite" }} />
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"18%",
            background:"linear-gradient(to top, rgba(255,60,0,0.18), rgba(200,20,0,0.10), transparent)",
            animation:"rt-heat-shimmer 3s ease-in-out infinite" }} />
          <div style={{ position:"absolute", bottom:"-5%", left:"-10%", right:"-10%", height:"25%",
            background:"radial-gradient(ellipse at 30% 100%, rgba(255,120,0,0.15) 0%, transparent 55%)",
            animation:"rt-lava-glow 6s ease-in-out infinite 2s" }} />
          <div style={{ position:"absolute", bottom:"-5%", left:"-10%", right:"-10%", height:"25%",
            background:"radial-gradient(ellipse at 75% 100%, rgba(220,40,0,0.12) 0%, transparent 55%)",
            animation:"rt-lava-glow 5s ease-in-out infinite 1s" }} />
          {embers.map((e,i)=>(
            <div key={i} style={{
              position:"absolute", borderRadius:"50%",
              width:e.size, height:e.size,
              left:`${e.left}%`, bottom:"0%",
              background:`radial-gradient(circle, rgba(${e.col},1) 0%, rgba(${e.col},0.4) 60%, transparent 100%)`,
              boxShadow:`0 0 ${e.size*2}px rgba(${e.col},0.6)`,
              ["--ex" as any]:`${e.ex}px`,
              ["--ex2" as any]:`${e.ex2}px`,
              animation:`rt-ember-rise ${e.dur}s ease-out infinite ${e.del}s`,
            }} />
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}

export function getRoomThemeBorderClass(themeId: string | null | undefined): string {
  switch (themeId) {
    case "premium-atmosphere": return "from-cyan-400 via-fuchsia-500 to-orange-400";
    case "neon": return "from-cyan-400 to-purple-500";
    case "galaxy": return "from-indigo-500 to-purple-700";
    case "sunset": return "from-orange-400 to-red-500";
    case "forest": return "from-green-400 to-emerald-600";
    case "cyberpunk": return "from-yellow-400 to-cyan-400";
    case "ocean": return "from-blue-400 to-cyan-600";
    case "cherry": return "from-pink-400 to-rose-500";
    case "gold": return "from-yellow-300 to-amber-500";
    case "violet": return "from-violet-400 to-fuchsia-600";
    case "aurora": return "from-teal-400 to-green-400";
    case "matrix": return "from-green-400 to-green-700";
    case "storm": return "from-blue-500 to-slate-600";
    case "volcanic": return "from-red-500 to-orange-400";
    default: return "from-cyan-500 to-purple-500";
  }
}
