import { useState, useEffect, useRef } from "react";
import {
  VIP_OVERLAY_FRAMES,
  type VipOverlayId,
  type DecorationDensity,
} from "@/components/vip-avatar-frames";
import { AvatarShell } from "@/components/avatar-shell";

/**
 * Premium character decorations — Free4Talk / Discord Nitro overlay model.
 * Abstract glow rings removed; VIP frames are character art (cat, dragon, fox…).
 */
export const PROFILE_DECORATIONS = [
  { id: "none", label: "None", description: "No decoration", category: "core", vip: false },
  { id: "sleeping-cat", label: "Sleeping Cat", description: "Cozy cat napping on your avatar", category: "vip", vip: true },
  { id: "dragon-coil", label: "Dragon Coil", description: "Emerald dragon wrapping your frame", category: "vip", vip: true },
  { id: "fox-spirit", label: "Fox Spirit", description: "Animated fox ears and collar", category: "vip", vip: true },
  { id: "sakura-orbit", label: "Sakura Orbit", description: "Cherry blossoms circling you", category: "vip", vip: true },
  { id: "ember-flame", label: "Ember Flame", description: "Warm fire rim overlay", category: "vip", vip: true },
  { id: "luna-butterflies", label: "Luna Butterflies", description: "Neon butterflies in orbit", category: "vip", vip: true },
] as const;

export type DecorationId = typeof PROFILE_DECORATIONS[number]["id"];
export type DecorationCategory = typeof PROFILE_DECORATIONS[number]["category"];

/** Map retired decoration ids → character VIP overlays. */
export const LEGACY_DECORATION_MAP: Record<string, DecorationId> = {
  quantum: "dragon-coil",
  helix: "sakura-orbit",
  sentinel: "dragon-coil",
  tactical: "dragon-coil",
  aurora: "luna-butterflies",
  pulse: "sakura-orbit",
  executive: "fox-spirit",
  hologram: "dragon-coil",
  crimson: "ember-flame",
  circuit: "dragon-coil",
  cosmic: "sakura-orbit",
  rainbow: "sakura-orbit",
  stars: "sakura-orbit",
  sparkles: "luna-butterflies",
  fire: "ember-flame",
  lightning: "ember-flame",
  snow: "sleeping-cat",
  hearts: "fox-spirit",
  bubbles: "sakura-orbit",
  flowers: "sakura-orbit",
  catears: "sleeping-cat",
  crystals: "sakura-orbit",
  "crystals-aqua": "sakura-orbit",
  "neon-chaos": "dragon-coil",
  "neon-chaos-purple": "luna-butterflies",
  dragon: "dragon-coil",
  "dragon-ruby": "dragon-coil",
  "solar-eclipse": "ember-flame",
  "inferno-skull": "ember-flame",
  "violet-roses": "fox-spirit",
  "crystal-halo": "sakura-orbit",
  "neon-arcade": "dragon-coil",
};

export function resolveDecorationId(id: string | null | undefined): DecorationId | "none" {
  if (!id || id === "none") return "none";
  if (PROFILE_DECORATIONS.some((d) => d.id === id)) return id as DecorationId;
  return LEGACY_DECORATION_MAP[id] || "none";
}


function uid(prefix: string, i: number) { return `${prefix}-${i}`; }

/* ── Tile ring helpers ─────────────────────────────────────────────
   Avatar tiles in room cards are rounded-2xl (16px), not a squircle. */
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
  const pad = Math.round(size * 0.22);
  const w = size + pad * 2;
  const h = size + pad * 2;
  const cx = w / 2;
  const count = 5;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: h, pointerEvents: "none", zIndex: 20, opacity: 0.55 }}>
      <svg width={w} height={h} style={{ overflow: "visible" }}>
        <defs>
          {Array.from({ length: count }).map((_, i) => {
            const hue = 18 + (i / count) * 28;
            return (
              <radialGradient key={i} id={`fg${size}${i}`} cx="50%" cy="80%" r="60%">
                <stop offset="0%" stopColor={`hsl(${hue},95%,58%)`} stopOpacity="0.7" />
                <stop offset="70%" stopColor={`hsl(${hue + 16},90%,42%)`} stopOpacity="0.28" />
                <stop offset="100%" stopColor={`hsl(${hue + 24},90%,35%)`} stopOpacity="0" />
              </radialGradient>
            );
          })}
        </defs>
        {Array.from({ length: count }).map((_, i) => {
          const angle = ((i / count) * 2 - 1) * 0.7;
          const bx = cx + Math.sin(angle) * (size * 0.42);
          const fw = 10 + i * 2;
          const fh = 22 + i * 4;
          const delay = (i / count) * 1.2;
          const dur = 1.6 + (i % 3) * 0.25;
          return (
            <ellipse
              key={i}
              cx={bx}
              cy={h - pad * 0.15}
              rx={fw / 2}
              ry={fh / 2}
              fill={`url(#fg${size}${i})`}
              style={{
                animation: `dec-float-up ${dur}s ease-out ${delay}s infinite`,
                transformOrigin: `${bx}px ${h - pad * 0.15}px`,
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

/* ═══════════════════════════════════════════════════════════════════════
   Legendary set — Free4Talk-inspired premium animated frames
   ═══════════════════════════════════════════════════════════════════════ */

function CrystalsFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.55;
  const cr = AVATAR_TILE_RADIUS + pad * 0.55;
  const id = `crys${size}`;
  const crystals = 10;
  const sparkles = 14;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <filter id={`${id}gl`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-float { 0%,100%{transform:translateY(0) scale(1);opacity:.85} 50%{transform:translateY(-3px) scale(1.08);opacity:1} }
          @keyframes ${id}-sparkle { 0%,100%{opacity:0;transform:scale(0.3)} 50%{opacity:1;transform:scale(1)} }
        `}</style>
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke={`url(#${id}g)`} strokeWidth="2" opacity="0.5" />
        {Array.from({ length: crystals }, (_, i) => {
          const p = pointOnRoundedRect(c, c, half, cr, i / crystals);
          const angle = Math.atan2(p.y - c, p.x - c) * (180 / Math.PI);
          const len = 6 + (i % 3) * 3;
          return (
            <g key={i} style={{ animation: `${id}-float ${2 + (i % 3) * 0.7}s ease-in-out ${i * 0.2}s infinite` }}>
              <polygon
                points={`${p.x},${p.y - len} ${p.x + 3},${p.y} ${p.x},${p.y + len * 0.4} ${p.x - 3},${p.y}`}
                fill={`url(#${id}g)`}
                filter={`url(#${id}gl)`}
                transform={`rotate(${angle},${p.x},${p.y})`}
                opacity="0.9"
              />
            </g>
          );
        })}
        {Array.from({ length: sparkles }, (_, i) => {
          const p = pointOnRoundedRect(c, c, half * 1.1, cr, i / sparkles + 0.05);
          return (
            <circle key={`s${i}`} cx={p.x} cy={p.y} r={1.2} fill="#e9d5ff"
              style={{ animation: `${id}-sparkle ${1.5 + (i % 4) * 0.4}s ease-in-out ${i * 0.3}s infinite` }} />
          );
        })}
      </svg>
    </div>
  );
}

function CrystalsAquaFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.55;
  const cr = AVATAR_TILE_RADIUS + pad * 0.55;
  const id = `cryaq${size}`;
  const crystals = 10;
  const sparkles = 14;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id={`${id}gl`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-float { 0%,100%{transform:translateY(0) scale(1);opacity:.85} 50%{transform:translateY(-3px) scale(1.08);opacity:1} }
          @keyframes ${id}-sparkle { 0%,100%{opacity:0;transform:scale(0.3)} 50%{opacity:1;transform:scale(1)} }
        `}</style>
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke={`url(#${id}g)`} strokeWidth="2" opacity="0.5" />
        {Array.from({ length: crystals }, (_, i) => {
          const p = pointOnRoundedRect(c, c, half, cr, i / crystals);
          const angle = Math.atan2(p.y - c, p.x - c) * (180 / Math.PI);
          const len = 6 + (i % 3) * 3;
          return (
            <g key={i} style={{ animation: `${id}-float ${2 + (i % 3) * 0.7}s ease-in-out ${i * 0.2}s infinite` }}>
              <polygon
                points={`${p.x},${p.y - len} ${p.x + 3},${p.y} ${p.x},${p.y + len * 0.4} ${p.x - 3},${p.y}`}
                fill={`url(#${id}g)`}
                filter={`url(#${id}gl)`}
                transform={`rotate(${angle},${p.x},${p.y})`}
                opacity="0.9"
              />
            </g>
          );
        })}
        {Array.from({ length: sparkles }, (_, i) => {
          const p = pointOnRoundedRect(c, c, half * 1.1, cr, i / sparkles + 0.05);
          return (
            <circle key={`s${i}`} cx={p.x} cy={p.y} r={1.2} fill="#cffafe"
              style={{ animation: `${id}-sparkle ${1.5 + (i % 4) * 0.4}s ease-in-out ${i * 0.3}s infinite` }} />
          );
        })}
      </svg>
    </div>
  );
}

function NeonChaosFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.6;
  const cr = AVATAR_TILE_RADIUS + pad * 0.6;
  const id = `nch${size}`;

  const butterflyWing = (cx: number, cy: number, s: number, flip: boolean) => {
    const f = flip ? -1 : 1;
    return `M${cx},${cy} C${cx + f * s * 0.8},${cy - s * 1.2} ${cx + f * s * 1.5},${cy - s * 0.3} ${cx + f * s * 0.3},${cy + s * 0.4} C${cx + f * s * 0.6},${cy + s * 0.1} ${cx + f * s * 0.2},${cy + s * 0.5} ${cx},${cy}`;
  };

  const corners = [
    { t: 0.125, rot: 45 }, { t: 0.375, rot: 135 },
    { t: 0.625, rot: 225 }, { t: 0.875, rot: 315 },
  ];

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`${id}gl`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
          <filter id={`${id}gl2`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-pulse { 0%,100%{opacity:.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.12)} }
          @keyframes ${id}-glow { 0%,100%{opacity:.4} 50%{opacity:.9} }
          @keyframes ${id}-dot { 0%,100%{opacity:0} 30%,70%{opacity:1} }
        `}</style>
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="#ff2d95" strokeWidth="1.5" opacity="0.3" filter={`url(#${id}gl)`} />
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="#ff2d95" strokeWidth="0.8" opacity="0.15"
          style={{ animation: `${id}-glow 2s ease-in-out infinite` }} filter={`url(#${id}gl2)`} />
        {corners.map((co, i) => {
          const p = pointOnRoundedRect(c, c, half, cr, co.t);
          const bSize = 7;
          return (
            <g key={i} style={{ animation: `${id}-pulse ${2.5 + i * 0.3}s ease-in-out ${i * 0.4}s infinite`, transformOrigin: `${p.x}px ${p.y}px` }}>
              <path d={butterflyWing(p.x, p.y, bSize, false)} fill="#ff2d95" opacity="0.8" filter={`url(#${id}gl)`} />
              <path d={butterflyWing(p.x, p.y, bSize, true)} fill="#ff69b4" opacity="0.7" filter={`url(#${id}gl)`} />
              <circle cx={p.x} cy={p.y} r={1.5} fill="#fff" opacity="0.9" />
            </g>
          );
        })}
        {Array.from({ length: 8 }, (_, i) => {
          const p = pointOnRoundedRect(c, c, half * 0.95, cr, i / 8 + 0.0625);
          return (
            <circle key={`d${i}`} cx={p.x} cy={p.y} r={1} fill="#39ff14"
              style={{ animation: `${id}-dot ${1.8 + i * 0.2}s ease-in-out ${i * 0.25}s infinite` }} />
          );
        })}
      </svg>
    </div>
  );
}

function NeonChaosPurpleFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.6;
  const cr = AVATAR_TILE_RADIUS + pad * 0.6;
  const id = `nchp${size}`;

  const butterflyWing = (cx: number, cy: number, s: number, flip: boolean) => {
    const f = flip ? -1 : 1;
    return `M${cx},${cy} C${cx + f * s * 0.8},${cy - s * 1.2} ${cx + f * s * 1.5},${cy - s * 0.3} ${cx + f * s * 0.3},${cy + s * 0.4} C${cx + f * s * 0.6},${cy + s * 0.1} ${cx + f * s * 0.2},${cy + s * 0.5} ${cx},${cy}`;
  };

  const corners = [
    { t: 0.125, rot: 45 }, { t: 0.375, rot: 135 },
    { t: 0.625, rot: 225 }, { t: 0.875, rot: 315 },
  ];

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`${id}gl`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
          <filter id={`${id}gl2`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-pulse { 0%,100%{opacity:.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.12)} }
          @keyframes ${id}-glow { 0%,100%{opacity:.4} 50%{opacity:.9} }
          @keyframes ${id}-dot { 0%,100%{opacity:0} 30%,70%{opacity:1} }
        `}</style>
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.3" filter={`url(#${id}gl)`} />
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="#8b5cf6" strokeWidth="0.8" opacity="0.15"
          style={{ animation: `${id}-glow 2s ease-in-out infinite` }} filter={`url(#${id}gl2)`} />
        {corners.map((co, i) => {
          const p = pointOnRoundedRect(c, c, half, cr, co.t);
          const bSize = 7;
          return (
            <g key={i} style={{ animation: `${id}-pulse ${2.5 + i * 0.3}s ease-in-out ${i * 0.4}s infinite`, transformOrigin: `${p.x}px ${p.y}px` }}>
              <path d={butterflyWing(p.x, p.y, bSize, false)} fill="#8b5cf6" opacity="0.8" filter={`url(#${id}gl)`} />
              <path d={butterflyWing(p.x, p.y, bSize, true)} fill="#a78bfa" opacity="0.7" filter={`url(#${id}gl)`} />
              <circle cx={p.x} cy={p.y} r={1.5} fill="#fff" opacity="0.9" />
            </g>
          );
        })}
        {Array.from({ length: 8 }, (_, i) => {
          const p = pointOnRoundedRect(c, c, half * 0.95, cr, i / 8 + 0.0625);
          return (
            <circle key={`d${i}`} cx={p.x} cy={p.y} r={1} fill="#60a5fa"
              style={{ animation: `${id}-dot ${1.8 + i * 0.2}s ease-in-out ${i * 0.25}s infinite` }} />
          );
        })}
      </svg>
    </div>
  );
}

function DragonFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.55;
  const cr = AVATAR_TILE_RADIUS + pad * 0.55;
  const id = `drg${size}`;
  const segments = 20;
  const fireParticles = 8;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <filter id={`${id}gl`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${id}fire`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-slither { 0%,100%{transform:translate(0,0)} 25%{transform:translate(1px,-1px)} 50%{transform:translate(0,1px)} 75%{transform:translate(-1px,0)} }
          @keyframes ${id}-scale { 0%,100%{opacity:.6} 50%{opacity:1} }
          @keyframes ${id}-fire { 0%{transform:translateY(0) scale(1);opacity:.9} 100%{transform:translateY(-8px) scale(0.3);opacity:0} }
        `}</style>
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke={`url(#${id}g)`} strokeWidth="2.5" opacity="0.4" />
        <g style={{ animation: `${id}-slither 3s ease-in-out infinite` }}>
          {Array.from({ length: segments }, (_, i) => {
            const t = i / segments;
            const p = pointOnRoundedRect(c, c, half, cr, t);
            const segSize = 3 + Math.sin(i * 0.8) * 1.5;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={segSize} fill={`url(#${id}g)`} opacity={0.7 + Math.sin(i * 0.5) * 0.3}
                  filter={`url(#${id}gl)`}
                  style={{ animation: `${id}-scale ${2 + (i % 4) * 0.3}s ease-in-out ${i * 0.1}s infinite` }} />
                {i % 3 === 0 && (
                  <circle cx={p.x} cy={p.y} r={segSize * 0.4} fill="#5eead4" opacity="0.6" />
                )}
              </g>
            );
          })}
        </g>
        {/* Dragon head fire at t=0 position */}
        {Array.from({ length: fireParticles }, (_, i) => {
          const headPos = pointOnRoundedRect(c, c, half, cr, 0);
          const spread = (i - fireParticles / 2) * 2;
          return (
            <circle key={`f${i}`} cx={headPos.x + spread} cy={headPos.y} r={2 + Math.random()}
              fill={i % 2 === 0 ? "#5eead4" : "#99f6e4"} opacity="0.8"
              filter={`url(#${id}fire)`}
              style={{ animation: `${id}-fire ${1 + i * 0.15}s ease-out ${i * 0.1}s infinite` }} />
          );
        })}
      </svg>
    </div>
  );
}

function DragonRubyFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.55;
  const cr = AVATAR_TILE_RADIUS + pad * 0.55;
  const id = `drgr${size}`;
  const segments = 20;
  const fireParticles = 8;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="50%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <filter id={`${id}gl`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${id}fire`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-slither { 0%,100%{transform:translate(0,0)} 25%{transform:translate(1px,-1px)} 50%{transform:translate(0,1px)} 75%{transform:translate(-1px,0)} }
          @keyframes ${id}-scale { 0%,100%{opacity:.6} 50%{opacity:1} }
          @keyframes ${id}-fire { 0%{transform:translateY(0) scale(1);opacity:.9} 100%{transform:translateY(-8px) scale(0.3);opacity:0} }
        `}</style>
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke={`url(#${id}g)`} strokeWidth="2.5" opacity="0.4" />
        <g style={{ animation: `${id}-slither 3s ease-in-out infinite` }}>
          {Array.from({ length: segments }, (_, i) => {
            const t = i / segments;
            const p = pointOnRoundedRect(c, c, half, cr, t);
            const segSize = 3 + Math.sin(i * 0.8) * 1.5;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={segSize} fill={`url(#${id}g)`} opacity={0.7 + Math.sin(i * 0.5) * 0.3}
                  filter={`url(#${id}gl)`}
                  style={{ animation: `${id}-scale ${2 + (i % 4) * 0.3}s ease-in-out ${i * 0.1}s infinite` }} />
                {i % 3 === 0 && (
                  <circle cx={p.x} cy={p.y} r={segSize * 0.4} fill="#fbbf24" opacity="0.6" />
                )}
              </g>
            );
          })}
        </g>
        {Array.from({ length: fireParticles }, (_, i) => {
          const headPos = pointOnRoundedRect(c, c, half, cr, 0);
          const spread = (i - fireParticles / 2) * 2;
          return (
            <circle key={`f${i}`} cx={headPos.x + spread} cy={headPos.y} r={2 + Math.random()}
              fill={i % 2 === 0 ? "#f87171" : "#fbbf24"} opacity="0.8"
              filter={`url(#${id}fire)`}
              style={{ animation: `${id}-fire ${1 + i * 0.15}s ease-out ${i * 0.1}s infinite` }} />
          );
        })}
      </svg>
    </div>
  );
}

function SolarEclipseFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.55;
  const cr = AVATAR_TILE_RADIUS + pad * 0.55;
  const id = `solec${size}`;
  const rays = 16;
  const stars = 12;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id={`${id}rg`} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#1c1917" stopOpacity="0" />
            <stop offset="85%" stopColor="#f59e0b" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}gl`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${id}gl2`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-flare { 0%,100%{opacity:.5;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(1.3)} }
          @keyframes ${id}-star { 0%,100%{opacity:0} 50%{opacity:.8} }
          @keyframes ${id}-corona { 0%,100%{opacity:.6} 50%{opacity:1} }
        `}</style>
        <rect x="0" y="0" width={w} height={w} fill={`url(#${id}rg)`} />
        {/* Corona glow ring */}
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="#f59e0b" strokeWidth="3" opacity="0.6"
          filter={`url(#${id}gl2)`} style={{ animation: `${id}-corona 3s ease-in-out infinite` }} />
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.8" />
        {/* Corona rays */}
        {Array.from({ length: rays }, (_, i) => {
          const p1 = pointOnRoundedRect(c, c, half, cr, i / rays);
          const p2 = pointOnRoundedRect(c, c, half * 1.2, cr * 1.1, i / rays);
          const rayLen = 4 + (i % 3) * 3;
          const dx = p2.x - p1.x, dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / len, ny = dy / len;
          return (
            <line key={i} x1={p1.x} y1={p1.y} x2={p1.x + nx * rayLen} y2={p1.y + ny * rayLen}
              stroke={i % 2 === 0 ? "#f59e0b" : "#fbbf24"} strokeWidth={1.5} opacity="0.7"
              filter={`url(#${id}gl)`}
              style={{ animation: `${id}-flare ${2 + (i % 4) * 0.5}s ease-in-out ${i * 0.2}s infinite`, transformOrigin: `${p1.x}px ${p1.y}px` }} />
          );
        })}
        {/* Background stars */}
        {Array.from({ length: stars }, (_, i) => {
          const angle = (i / stars) * Math.PI * 2;
          const dist = half * 1.3 + (i % 3) * 4;
          const sx = c + Math.cos(angle) * dist;
          const sy = c + Math.sin(angle) * dist;
          return (
            <circle key={`st${i}`} cx={sx} cy={sy} r={0.8} fill="#fef3c7"
              style={{ animation: `${id}-star ${2 + (i % 5) * 0.6}s ease-in-out ${i * 0.4}s infinite` }} />
          );
        })}
      </svg>
    </div>
  );
}

function InfernoSkullFrame({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const half = size / 2 + pad * 0.55;
  const cr = AVATAR_TILE_RADIUS + pad * 0.55;
  const id = `infsk${size}`;
  const embers = 16;
  const fireBottom = 10;

  return (
    <div style={{ position: "absolute", top: -pad, left: -pad, width: w, height: w, pointerEvents: "none", zIndex: 20 }}>
      <svg width={w} height={w} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}g`} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="40%" stopColor="#dc2626" />
            <stop offset="80%" stopColor="#7c2d12" />
            <stop offset="100%" stopColor="#581c87" />
          </linearGradient>
          <filter id={`${id}gl`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${id}gl2`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes ${id}-ember { 0%{transform:translateY(0) scale(1);opacity:.8} 100%{transform:translateY(-${pad * 1.5}px) scale(0.2);opacity:0} }
          @keyframes ${id}-fire { 0%{transform:translateY(0) scaleY(1);opacity:.7} 50%{transform:translateY(-4px) scaleY(1.3);opacity:1} 100%{transform:translateY(-8px) scaleY(0.5);opacity:0} }
          @keyframes ${id}-skull { 0%,100%{opacity:.3} 50%{opacity:.6} }
        `}</style>
        {/* Dark gradient frame */}
        <path d={roundedRectPath(c, c, half, cr)} fill="none" stroke={`url(#${id}g)`} strokeWidth="3" filter={`url(#${id}gl)`} />
        <path d={roundedRectPath(c, c, half * 0.97, cr)} fill="none" stroke="#1c1917" strokeWidth="1.5" opacity="0.6" />
        {/* Bottom fire glow */}
        <ellipse cx={c} cy={c + half - 2} rx={half * 0.7} ry={6} fill="#ea580c" opacity="0.25" filter={`url(#${id}gl2)`}
          style={{ animation: `${id}-skull 2s ease-in-out infinite` }} />
        {/* Fire particles rising from bottom */}
        {Array.from({ length: fireBottom }, (_, i) => {
          const fx = c - half * 0.5 + (i / fireBottom) * half;
          const fy = c + half;
          return (
            <ellipse key={`fb${i}`} cx={fx} cy={fy} rx={2} ry={4}
              fill={i % 3 === 0 ? "#f97316" : i % 3 === 1 ? "#ef4444" : "#fbbf24"} opacity="0.7"
              filter={`url(#${id}gl)`}
              style={{ animation: `${id}-fire ${1.5 + (i % 4) * 0.3}s ease-out ${i * 0.15}s infinite` }} />
          );
        })}
        {/* Floating embers */}
        {Array.from({ length: embers }, (_, i) => {
          const p = pointOnRoundedRect(c, c, half, cr, i / embers);
          return (
            <circle key={`e${i}`} cx={p.x} cy={p.y} r={1 + (i % 2)} fill={i % 2 === 0 ? "#f97316" : "#fbbf24"}
              style={{ animation: `${id}-ember ${2 + (i % 5) * 0.5}s ease-out ${i * 0.3}s infinite` }} />
          );
        })}
        {/* Skull hint at center-bottom using simple shapes */}
        <g opacity="0.2" style={{ animation: `${id}-skull 3s ease-in-out infinite` }}>
          <circle cx={c - 4} cy={c + half * 0.6} r={2} fill="#fef2f2" />
          <circle cx={c + 4} cy={c + half * 0.6} r={2} fill="#fef2f2" />
          <ellipse cx={c} cy={c + half * 0.7} rx={3} ry={1.5} fill="#fef2f2" />
        </g>
      </svg>
    </div>
  );
}

interface ProfileDecorationProps {
  decorationId: string | null | undefined;
  /** Avatar shell size in px — decoration does not expand this footprint. */
  size?: number;
  /** Density budget for rooms with many users. */
  density?: DecorationDensity;
  /** Soften decoration so the avatar stays the hero. */
  soft?: boolean;
  /** Portrait clip matching lobby / in-room card shape. */
  shape?: "circle" | "rounded" | "tile";
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared decoration renderer for room, lobby, and profile settings.
 * Uses AvatarShell so layout size is always driven by the avatar, not the frame.
 */
export function ProfileDecoration({
  decorationId,
  size = 56,
  density,
  soft,
  shape,
  className,
  children,
}: ProfileDecorationProps) {
  const id = resolveDecorationId(decorationId);
  const frameId =
    id && id !== "none" && id in VIP_OVERLAY_FRAMES
      ? (id as VipOverlayId)
      : null;

  return (
    <AvatarShell
      size={size}
      frameId={frameId}
      density={density}
      soft={soft}
      shape={shape}
      className={className}
    >
      {children}
    </AvatarShell>
  );
}

// Re-exported from the lightweight utils module so that:
// - room-card.tsx imports ONLY from room-theme-utils (avoids loading this
//   entire 1,900-line file on the critical lobby path)
// - voice-room.tsx / create-room-dialog.tsx / etc. can still import from
//   here as before — the public API is unchanged.
export { ROOM_THEMES, getRoomThemeBorderClass } from "@/lib/room-theme-utils";
export type { RoomThemeId } from "@/lib/room-theme-utils";

// Curated gallery of preset card-background images that hosts can pick from
// without having to upload anything. Each item stores `url` (used as the
// hologram video/image source) plus a tiny `thumb` for the picker grid.
export const PRESET_BACKGROUNDS = [
  { id: "neon-skyline", label: "Neon Skyline", url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=180&h=120&fit=crop&q=70" },
  { id: "violet-galaxy", label: "Violet Galaxy", url: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=180&h=120&fit=crop&q=70" },
  { id: "soft-aurora", label: "Soft Aurora", url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=180&h=120&fit=crop&q=70" },
  { id: "ocean-glow", label: "Ocean Glow", url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=180&h=120&fit=crop&q=70" },
  { id: "warm-sunset", label: "Warm Sunset", url: "https://images.unsplash.com/photo-1503803548695-c2a7b4a5b875?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1503803548695-c2a7b4a5b875?w=180&h=120&fit=crop&q=70" },
  { id: "cherry-petals", label: "Cherry Petals", url: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=180&h=120&fit=crop&q=70" },
  { id: "misty-forest", label: "Misty Forest", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=180&h=120&fit=crop&q=70" },
  { id: "indigo-haze", label: "Indigo Haze", url: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=180&h=120&fit=crop&q=70" },
  { id: "plasma-lights", label: "Plasma Lights", url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=180&h=120&fit=crop&q=70" },
  { id: "lava-embers", label: "Lava Embers", url: "https://images.unsplash.com/photo-1495953557-73f0ba4c50af?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1495953557-73f0ba4c50af?w=180&h=120&fit=crop&q=70" },
  { id: "calm-clouds", label: "Calm Clouds", url: "https://images.unsplash.com/photo-1504370805625-d37c82b94a8e?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1504370805625-d37c82b94a8e?w=180&h=120&fit=crop&q=70" },
  { id: "study-cafe", label: "Study Café", url: "https://images.unsplash.com/photo-1497091071254-cc9b2ba7c48a?w=1280&q=80&auto=format&fit=crop", thumb: "https://images.unsplash.com/photo-1497091071254-cc9b2ba7c48a?w=180&h=120&fit=crop&q=70" },
] as const;

export type PresetBackgroundId = typeof PRESET_BACKGROUNDS[number]["id"];

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
  @keyframes rt-disco-beam {
    0%   { transform: rotate(-40deg) scaleX(1);   opacity: 0.55; }
    20%  { transform: rotate(30deg)  scaleX(1.3);  opacity: 0.9; }
    40%  { transform: rotate(-20deg) scaleX(0.7);  opacity: 0.4; }
    60%  { transform: rotate(55deg)  scaleX(1.15); opacity: 0.85; }
    80%  { transform: rotate(-50deg) scaleX(0.85); opacity: 0.5; }
    100% { transform: rotate(-40deg) scaleX(1);   opacity: 0.55; }
  }
  @keyframes rt-disco-beam2 {
    0%   { transform: rotate(50deg)  scaleX(0.8);  opacity: 0.6; }
    25%  { transform: rotate(-35deg) scaleX(1.2);  opacity: 0.9; }
    50%  { transform: rotate(60deg)  scaleX(0.65); opacity: 0.35; }
    75%  { transform: rotate(-25deg) scaleX(1.1);  opacity: 0.75; }
    100% { transform: rotate(50deg)  scaleX(0.8);  opacity: 0.6; }
  }
  @keyframes rt-disco-glitter {
    0%,100% { opacity: 0;   transform: scale(0.4) rotate(0deg);   }
    12%     { opacity: 1;   transform: scale(1.8) rotate(72deg);  }
    25%     { opacity: 0.1; transform: scale(0.6) rotate(144deg); }
    50%     { opacity: 0.95; transform: scale(2.0) rotate(216deg); }
    75%     { opacity: 0.05; transform: scale(0.5) rotate(288deg); }
    88%     { opacity: 0.8; transform: scale(1.6) rotate(324deg); }
  }
  @keyframes rt-disco-sweep {
    0%   { transform: translateX(-55%) skewX(-4deg); opacity: 0.25; }
    50%  { transform: translateX(55%)  skewX(4deg);  opacity: 0.70; }
    100% { transform: translateX(-55%) skewX(-4deg); opacity: 0.25; }
  }
  @keyframes rt-disco-sweep2 {
    0%   { transform: translateX(50%)  skewX(3deg);  opacity: 0.55; }
    50%  { transform: translateX(-50%) skewX(-3deg); opacity: 0.20; }
    100% { transform: translateX(50%)  skewX(3deg);  opacity: 0.55; }
  }
  @keyframes rt-disco-color {
    0%   { background: rgba(255,0,80,0.10);   }
    16%  { background: rgba(255,200,0,0.10);  }
    33%  { background: rgba(0,255,80,0.10);   }
    50%  { background: rgba(0,200,255,0.10);  }
    66%  { background: rgba(180,0,255,0.10);  }
    83%  { background: rgba(255,60,0,0.10);   }
    100% { background: rgba(255,0,80,0.10);   }
  }
  @keyframes rt-disco-flash {
    0%,86%,89%,92%,96%,100% { opacity: 0; }
    87%  { opacity: 1; }
    90%  { opacity: 0.6; }
    94%  { opacity: 0.8; }
  }
  @keyframes rt-disco-spin {
    from { transform: rotate(0deg) scale(1); }
    to   { transform: rotate(360deg) scale(1); }
  }
  @keyframes rt-disco-laser {
    0%   { transform: rotate(-70deg) scaleX(0.3); opacity: 0; }
    8%   { opacity: 0.95; }
    48%  { transform: rotate(70deg) scaleX(0.3); opacity: 0.95; }
    56%  { opacity: 0; }
    100% { transform: rotate(-70deg) scaleX(0.3); opacity: 0; }
  }
  @keyframes rt-disco-laser2 {
    0%   { transform: rotate(65deg) scaleX(0.3); opacity: 0; }
    8%   { opacity: 0.88; }
    48%  { transform: rotate(-65deg) scaleX(0.3); opacity: 0.88; }
    56%  { opacity: 0; }
    100% { transform: rotate(65deg) scaleX(0.3); opacity: 0; }
  }
  @keyframes rt-disco-pulse {
    0%,100% { transform: scale(1);    opacity: 0.12; }
    50%     { transform: scale(1.22); opacity: 0.32; }
  }
  @keyframes rt-disco-rain-fall {
    0%   { transform: translateY(-5vh);  opacity: 0; }
    8%   { opacity: 0.85; }
    90%  { opacity: 0.55; }
    100% { transform: translateY(108vh); opacity: 0; }
  }
  @keyframes rt-disco-wave {
    0%   { transform: translateY(0) scaleX(1);      opacity: 0.65; }
    50%  { transform: translateY(-28%) scaleX(1.2); opacity: 0.28; }
    100% { transform: translateY(0) scaleX(1);      opacity: 0.65; }
  }
  @keyframes rt-disco-gold-beam {
    0%   { transform: rotate(-22deg) scaleX(1);    opacity: 0.50; }
    28%  { transform: rotate(18deg)  scaleX(1.45); opacity: 0.95; }
    72%  { transform: rotate(-12deg) scaleX(0.8);  opacity: 0.40; }
    100% { transform: rotate(-22deg) scaleX(1);    opacity: 0.50; }
  }
  @keyframes rt-disco-strobe-hard {
    0%   { opacity: 0; }
    1%   { opacity: 1; }
    8%   { opacity: 0; }
    16%  { opacity: 1; }
    24%  { opacity: 0; }
    32%  { opacity: 1; }
    40%  { opacity: 0; }
    100% { opacity: 0; }
  }
  @keyframes rt-disco-name-show {
    0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
    18%  { opacity: 1; transform: translateX(-50%) translateY(0); }
    72%  { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-5px); }
  }
  @keyframes rt-disco-dancer-walk {
    0%   { transform: translateX(-140%); opacity: 0; }
    5%   { opacity: 1; }
    95%  { opacity: 1; }
    100% { transform: translateX(140%); opacity: 0; }
  }
  @keyframes rt-disco-dancer-walk2 {
    0%   { transform: translateX(140%) scaleX(-1); opacity: 0; }
    5%   { opacity: 1; }
    95%  { opacity: 1; }
    100% { transform: translateX(-140%) scaleX(-1); opacity: 0; }
  }
  @keyframes rt-disco-dancer-bob {
    0%,100% { transform: translateY(0) rotate(-5deg) scaleX(0.96); }
    22%     { transform: translateY(-18px) rotate(7deg) scaleX(1.0); }
    50%     { transform: translateY(-8px) rotate(-9deg) scaleX(0.93); }
    75%     { transform: translateY(-22px) rotate(6deg) scaleX(1.04); }
  }
  @keyframes rt-disco-spotlight-swing {
    0%,100% { transform: rotate(-32deg); opacity: 0.72; }
    45%     { transform: rotate(32deg);  opacity: 0.95; }
    65%     { transform: rotate(12deg);  opacity: 0.80; }
  }
  @keyframes rt-disco-ring-burst {
    0%   { transform: scale(0.4); opacity: 0.90; }
    100% { transform: scale(2.8); opacity: 0;   }
  }
  @keyframes rt-disco-sweep-fast {
    0%   { transform: translateX(-70%) scaleX(1.4); opacity: 0.15; }
    28%  { transform: translateX(70%)  scaleX(0.6); opacity: 0.85; }
    60%  { transform: translateX(-30%) scaleX(1.2); opacity: 0.30; }
    100% { transform: translateX(-70%) scaleX(1.4); opacity: 0.15; }
  }
  @keyframes rt-disco-beam-rapid {
    0%   { transform: rotate(-58deg) scaleX(0.4); opacity: 0.20; }
    13%  { transform: rotate(58deg)  scaleX(1.6); opacity: 0.98; }
    26%  { transform: rotate(-28deg) scaleX(0.3); opacity: 0.12; }
    40%  { transform: rotate(68deg)  scaleX(1.5); opacity: 0.92; }
    54%  { transform: rotate(-50deg) scaleX(0.5); opacity: 0.18; }
    68%  { transform: rotate(44deg)  scaleX(1.4); opacity: 0.88; }
    84%  { transform: rotate(-65deg) scaleX(0.2); opacity: 0.08; }
    100% { transform: rotate(-58deg) scaleX(0.4); opacity: 0.20; }
  }
  @keyframes rt-disco-confetti-fall {
    0%   { transform: translateY(-20px) rotate(0deg) scale(1);    opacity: 0; }
    5%   { opacity: 1; }
    88%  { opacity: 0.85; }
    100% { transform: translateY(108vh) rotate(760deg) scale(0.3); opacity: 0; }
  }
  @keyframes rt-disco-bass-slam {
    0%,8%,100% { transform: scale(1);    opacity: 0; }
    3%          { transform: scale(1.18); opacity: 0.75; }
  }
  @keyframes rt-disco-strobe-ultra {
    0%,3%,8%,13%,18%,24%,100% { opacity: 0; }
    1.5% { opacity: 1; }
    5%   { opacity: 0.85; }
    10%  { opacity: 0.65; }
    15%  { opacity: 1; }
    20%  { opacity: 0.40; }
  }
  @keyframes rt-disco-participant-glow {
    0%,100% { box-shadow: 0 0 12px 4px var(--dj-col,rgba(255,0,200,0.80)), 0 0 28px 8px var(--dj-col2,rgba(255,0,200,0.35)); }
    50%     { box-shadow: 0 0 22px 8px var(--dj-col,rgba(255,0,200,0.95)), 0 0 50px 16px var(--dj-col2,rgba(255,0,200,0.55)); }
  }
  @keyframes rt-disco-name-glow {
    0%,100% { opacity: 0.85; filter: drop-shadow(0 0 6px currentColor) drop-shadow(0 0 14px currentColor); }
    50%     { opacity: 1;    filter: drop-shadow(0 0 12px currentColor) drop-shadow(0 0 28px currentColor) drop-shadow(0 0 44px currentColor); }
  }

  @keyframes rt-romance-petal-fall {
    0%   { transform: translateY(-8%) rotate(0deg) translateX(0); opacity: 0; }
    8%   { opacity: 0.72; }
    48%  { transform: translateY(52%) rotate(calc(var(--cr) * 0.48)) translateX(calc(var(--cx) * 0.52)); opacity: 0.60; }
    90%  { opacity: 0.40; }
    100% { transform: translateY(115%) rotate(var(--cr)) translateX(var(--cx)); opacity: 0; }
  }
  @keyframes rt-romance-glow-breathe {
    0%, 100% { opacity: 0.50; transform: scale(1.00); }
    50%       { opacity: 0.88; transform: scale(1.12); }
  }
  @keyframes rt-romance-candle {
    0%,100% { opacity: 0.52; transform: scaleX(1.00) scaleY(1.00); }
    18%     { opacity: 0.70; transform: scaleX(0.96) scaleY(1.05); }
    38%     { opacity: 0.58; transform: scaleX(1.03) scaleY(0.96); }
    60%     { opacity: 0.74; transform: scaleX(0.97) scaleY(1.04); }
    80%     { opacity: 0.55; transform: scaleX(1.02) scaleY(0.97); }
  }
  @keyframes rt-romance-dust {
    0%   { transform: translateY(0) translateX(0) scale(1);    opacity: 0; }
    12%  { opacity: 0.80; }
    80%  { opacity: 0.55; }
    100% { transform: translateY(-70px) translateX(var(--dx,12px)) scale(0.4); opacity: 0; }
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
    case "disco":
      return { background: "rgba(4,0,8,0.80)", backdropFilter: "blur(16px) saturate(1.6)", WebkitBackdropFilter: "blur(16px) saturate(1.6)", borderColor: "rgba(255,0,160,0.30)" };
    case "trap-gold":
      return { background: "rgba(10,6,0,0.82)", backdropFilter: "blur(16px) saturate(1.3)", WebkitBackdropFilter: "blur(16px) saturate(1.3)", borderColor: "rgba(245,158,11,0.28)" };
    case "skeleton-gangsta":
      return { background: "rgba(4,4,4,0.84)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderColor: "rgba(200,192,176,0.18)" };
    case "romance":
      return { background: "rgba(14,4,8,0.80)", backdropFilter: "blur(18px) saturate(1.3)", WebkitBackdropFilter: "blur(18px) saturate(1.3)", borderColor: "rgba(180,60,80,0.26)" };
    default:
      // Default chat panel — matches the room's base dark violet-slate so the
      // panel reads as ONE unified surface with the room background.
      return {
        background: "rgba(18, 20, 28, 0.97)",
        backdropFilter: "blur(20px) saturate(1.1)",
        WebkitBackdropFilter: "blur(20px) saturate(1.1)",
        borderColor: "rgba(255, 255, 255, 0.07)",
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
    case "disco":
      return { background: "#030104" };
    case "trap-gold":
      return { background: "radial-gradient(ellipse at 50% 100%, #1a0e00 0%, #0d0700 50%, #070400 100%)" };
    case "skeleton-gangsta":
      return { background: "#050505" };
    case "romance":
      return { background: "radial-gradient(ellipse at 50% 0%, #1e0810 0%, #130508 45%, #0a0205 100%)" };
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

// ── Dancer silhouette helper ─────────────────────────────────────────────────
function makeDancer(col: string, left: number, dur: number, del: number, walk: "rt-disco-dancer-walk"|"rt-disco-dancer-walk2", sz=1, idx=0): React.ReactNode {
  const h = Math.round(18*sz), w = Math.round(14*sz), bh = Math.round(34*sz), bw = Math.round(12*sz);
  const bobDur = (dur * 0.35).toFixed(2);
  return (
    <div key={`dancer-${walk}-${idx}`} style={{ position:"absolute", bottom:"6%", left:`${left}%`, animation:`${walk} ${dur}s linear infinite ${del}s`, zIndex:4, pointerEvents:"none" }}>
      <div style={{ width:h, height:h, borderRadius:"50%", background:`rgba(${col},0.50)`, boxShadow:`0 0 14px rgba(${col},0.85)`, margin:"0 auto", animation:`rt-disco-dancer-bob ${bobDur}s ease-in-out infinite` }} />
      <div style={{ width:bw, height:bh, borderRadius:"45% 45% 30% 30%", background:`rgba(${col},0.38)`, boxShadow:`0 0 18px rgba(${col},0.65)`, margin:"2px auto 0", animation:`rt-disco-dancer-bob ${bobDur}s ease-in-out infinite 0.14s` }} />
    </div>
  );
}

// ── Spotlight cone from ceiling ───────────────────────────────────────────────
function makeSpotlight(col: string, leftPct: number, swingDur: number, del: number, idx=0): React.ReactNode {
  return (
    <div key={`spot-${idx}`} style={{
      position:"absolute", top:0, left:`${leftPct}%`, width:"16%", height:"88%",
      transformOrigin:"top center",
      background:`linear-gradient(to bottom, rgba(${col},0.28) 0%, rgba(${col},0.10) 45%, rgba(${col},0.03) 70%, transparent 100%)`,
      clipPath:"polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)",
      filter:"blur(4px)",
      animation:`rt-disco-spotlight-swing ${swingDur}s ease-in-out infinite ${del}s`,
      zIndex:3, pointerEvents:"none",
    }} />
  );
}

// ── Confetti burst ────────────────────────────────────────────────────────────
function makeConfetti(cols: string[], count: number): React.ReactNode[] {
  return Array.from({length:count}, (_,i) => {
    const col = cols[i % cols.length];
    const shapes = ["50%", "0%", "30%"];
    return (
      <div key={`conf-${i}`} style={{
        position:"absolute",
        width: 4+(i%5), height: 4+(i%4),
        borderRadius: shapes[i%3],
        background:`rgba(${col},1)`,
        top:`${(i*7+3)%60}%`,
        left:`${(i*17+5)%100}%`,
        boxShadow:`0 0 ${6+(i%4)*3}px rgba(${col},0.90)`,
        animation:`rt-disco-confetti-fall ${1.2+(i%8)*0.28}s linear infinite ${(i*0.11)%4}s`,
        zIndex:5, pointerEvents:"none",
      }} />
    );
  });
}

// ── Cinematic Disco Theme — 7 auto-cycling light show scenes ─────────────────
const DISCO_SCENES = [
  { id: 0, name: "Rainbow Rave",    emoji: "🌈" },
  { id: 1, name: "Red Alert",       emoji: "🔴" },
  { id: 2, name: "Ocean Club",      emoji: "🌊" },
  { id: 3, name: "Purple Rain",     emoji: "💜" },
  { id: 4, name: "Golden Fever",    emoji: "✨" },
  { id: 5, name: "Blackout Strobe", emoji: "⚡" },
  { id: 6, name: "Shadow Dancer",   emoji: "💃" },
] as const;

function renderDiscoScene(idx: number): React.ReactNode {
  switch (idx) {
    case 0: {
      // 🌈 Rainbow Rave — all colors, TURBO chaos with dancers + spotlights
      const COLS = ["255,0,80","0,220,255","80,255,0","255,200,0","180,0,255","255,80,0","0,255,200","255,0,200"];
      const beams = [
        {col:"255,0,80",  left:7,  dur:0.90, del:0,    kf:"rt-disco-beam-rapid"},
        {col:"0,220,255", left:18, dur:1.10, del:0.15, kf:"rt-disco-beam-rapid"},
        {col:"80,255,0",  left:29, dur:0.80, del:0.38, kf:"rt-disco-beam-rapid"},
        {col:"255,200,0", left:40, dur:1.00, del:0.58, kf:"rt-disco-beam-rapid"},
        {col:"180,0,255", left:51, dur:0.85, del:0.22, kf:"rt-disco-beam-rapid"},
        {col:"0,255,200", left:62, dur:1.15, del:0.75, kf:"rt-disco-beam-rapid"},
        {col:"255,80,0",  left:73, dur:0.95, del:0.45, kf:"rt-disco-beam-rapid"},
        {col:"255,0,200", left:84, dur:0.75, del:0.08, kf:"rt-disco-beam-rapid"},
        {col:"255,0,80",  left:13, dur:1.25, del:0.65, kf:"rt-disco-beam"},
        {col:"0,220,255", left:46, dur:1.05, del:0.30, kf:"rt-disco-beam2"},
        {col:"80,255,0",  left:68, dur:0.90, del:0.85, kf:"rt-disco-beam"},
        {col:"255,200,0", left:91, dur:1.20, del:0.12, kf:"rt-disco-beam2"},
      ];
      const glitters = Array.from({length:180}, (_,i) => ({
        col:COLS[i%COLS.length], top:(i*13+7)%100, left:(i*23+11)%100,
        size:1+(i%4), dur:0.18+(i%7)*0.07, del:(i*0.05)%2.0,
      }));
      return (
        <>
          {beams.map((b,i) => (
            <div key={`rb-${i}`} style={{ position:"absolute", top:0, left:`${b.left}%`, width:"6%", height:"100%", transformOrigin:"top center", background:`linear-gradient(to bottom, rgba(${b.col},0.62) 0%, rgba(${b.col},0.22) 32%, rgba(${b.col},0.06) 60%, transparent 100%)`, filter:"blur(4px)", animation:`${b.kf} ${b.dur}s ease-in-out infinite ${b.del}s` }} />
          ))}
          {makeSpotlight("255,200,255", 22, 2.8, 0,   0)}
          {makeSpotlight("200,255,200", 55, 3.4, 1.1, 1)}
          {makeSpotlight("200,200,255", 78, 2.5, 0.5, 2)}
          <div style={{ position:"absolute", top:"3%", left:"50%", width:30, height:30, borderRadius:"50%", transform:"translateX(-50%)", background:"radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(200,200,255,0.3) 50%, transparent 80%)", boxShadow:"0 0 16px 7px rgba(255,255,255,0.30)", animation:"rt-disco-spin 1.4s linear infinite" }} />
          {Array.from({length:18}, (_,i) => (
            <div key={`sp-${i}`} style={{ position:"absolute", top:"3%", left:"50%", width:"1px", height:`${16+((i*7)%14)}%`, transformOrigin:"top center", transform:`translateX(-50%) rotate(${i*20}deg)`, background:`linear-gradient(to bottom, rgba(${COLS[i%COLS.length]},0.65), transparent)`, animation:`rt-disco-spin ${1.4+(i%3)*0.3}s linear infinite ${(i%4)*0.15}s` }} />
          ))}
          {([{col:"255,0,80"},{col:"0,200,255"},{col:"180,0,255"},{col:"80,255,0"}] as {col:string}[]).map((f,i) => (
            <div key={`fw-${i}`} style={{ position:"absolute", bottom:"-8%", left:`${i*25}%`, width:"35%", height:"42%", borderRadius:"50%", background:`radial-gradient(ellipse at 50% 100%, rgba(${f.col},0.22) 0%, rgba(${f.col},0.07) 55%, transparent 85%)`, filter:"blur(16px)", animation:`rt-disco-sweep-fast ${0.9+(i*0.28)}s ease-in-out infinite ${i*0.22}s` }} />
          ))}
          <div style={{ position:"absolute", top:"15%", left:"15%", right:"15%", bottom:"15%", borderRadius:"50%", background:"rgba(255,0,80,0.07)", filter:"blur(55px)", animation:"rt-disco-color 1.2s linear infinite" }} />
          {glitters.map((g,i) => (
            <div key={`gl-${i}`} style={{ position:"absolute", borderRadius:"50%", width:g.size, height:g.size, background:`rgba(${g.col},1)`, top:`${g.top}%`, left:`${g.left}%`, boxShadow:`0 0 ${g.size*4}px rgba(${g.col},0.95)`, animation:`rt-disco-glitter ${g.dur}s ease-in-out infinite ${g.del}s` }} />
          ))}
          {makeConfetti(["255,0,80","0,220,255","80,255,0","255,200,0","180,0,255"], 60)}
          <div style={{ position:"absolute", inset:0, animation:"rt-disco-bass-slam 1.8s ease-out infinite" }} />
        </>
      );
    }

    case 1: {
      // 🔴 Red Alert — crimson emergency with siren dancers
      return (
        <>
          {[
            {left:7, dur:0.70,del:0  },{left:18,dur:0.85,del:0.12},{left:30,dur:0.65,del:0.28},
            {left:42,dur:0.90,del:0.40},{left:54,dur:0.72,del:0.18},{left:66,dur:0.80,del:0.55},
            {left:78,dur:0.68,del:0.35},{left:90,dur:0.88,del:0.08},
          ].map((b,i) => (
            <div key={`rb-${i}`} style={{ position:"absolute", top:0, left:`${b.left}%`, width:"10%", height:"100%", transformOrigin:"top center", background:"linear-gradient(to bottom, rgba(255,10,0,0.70) 0%, rgba(200,0,20,0.30) 38%, rgba(180,0,0,0.07) 68%, transparent 100%)", filter:"blur(6px)", animation:`rt-disco-beam-rapid ${b.dur}s ease-in-out infinite ${b.del}s` }} />
          ))}
          {makeSpotlight("255,60,60", 20, 1.8, 0,   0)}
          {makeSpotlight("255,120,0", 60, 2.2, 0.8, 1)}
          <div style={{ position:"absolute", top:"18%", left:"18%", right:"18%", bottom:"18%", borderRadius:"50%", background:"radial-gradient(circle, rgba(255,0,30,0.26) 0%, rgba(200,0,0,0.09) 55%, transparent 80%)", filter:"blur(50px)", animation:"rt-disco-pulse 1.4s ease-in-out infinite" }} />
          <div style={{ position:"absolute", bottom:"-10%", left:"-5%", width:"55%", height:"58%", borderRadius:"50%", background:"radial-gradient(ellipse at 50% 100%, rgba(255,0,30,0.32) 0%, rgba(200,0,0,0.10) 55%, transparent 85%)", filter:"blur(24px)", animation:"rt-disco-sweep-fast 1.2s ease-in-out infinite" }} />
          <div style={{ position:"absolute", bottom:"-10%", right:"-5%", width:"55%", height:"58%", borderRadius:"50%", background:"radial-gradient(ellipse at 50% 100%, rgba(220,40,0,0.28) 0%, rgba(180,0,20,0.09) 55%, transparent 85%)", filter:"blur(24px)", animation:"rt-disco-sweep-fast 1.5s ease-in-out infinite 0.5s" }} />
          <div style={{ position:"absolute", top:"3%", left:"50%", width:30, height:30, borderRadius:"50%", transform:"translateX(-50%)", background:"radial-gradient(circle, rgba(255,80,60,0.98) 0%, rgba(255,0,30,0.55) 50%, transparent 80%)", boxShadow:"0 0 20px 9px rgba(255,0,30,0.45)", animation:"rt-disco-spin 1.2s linear infinite" }} />
          <div style={{ position:"absolute", inset:0, background:"rgba(255,0,30,0.18)", animation:"rt-disco-strobe-ultra 0.9s step-end infinite" }} />
          <div style={{ position:"absolute", inset:0, animation:"rt-disco-bass-slam 1.5s ease-out infinite" }} />
          {Array.from({length:80}, (_,i) => (
            <div key={`rg-${i}`} style={{ position:"absolute", borderRadius:"50%", width:1+(i%3), height:1+(i%3), background:`rgba(${i%2===0?"255,30,0":"255,80,60"},1)`, top:`${(i*17+5)%100}%`, left:`${(i*29+13)%100}%`, boxShadow:`0 0 ${(1+(i%3))*5}px rgba(255,10,0,0.95)`, animation:`rt-disco-glitter ${0.22+(i%5)*0.08}s ease-in-out infinite ${(i*0.06)%1.5}s` }} />
          ))}
        </>
      );
    }

    case 2: {
      // 🌊 Ocean Club — fast wave sweeps + teal dancers
      const cols4 = ["0,200,255","0,180,220","50,220,200","100,180,255"];
      return (
        <>
          {[
            {col:"0,180,255",left:10,dur:0.95,del:0   },{col:"0,220,200",left:24,dur:1.20,del:0.22},
            {col:"50,100,255",left:38,dur:0.85,del:0.45},{col:"0,200,255",left:52,dur:1.10,del:0.65},
            {col:"0,150,220",left:66,dur:0.90,del:0.30},{col:"100,200,255",left:80,dur:1.05,del:0.80},
            {col:"0,220,200",left:92,dur:0.78,del:0.10},
          ].map((b,i) => (
            <div key={`ob-${i}`} style={{ position:"absolute", top:0, left:`${b.left}%`, width:"8%", height:"100%", transformOrigin:"top center", background:`linear-gradient(to bottom, rgba(${b.col},0.55) 0%, rgba(${b.col},0.20) 38%, rgba(${b.col},0.05) 68%, transparent 100%)`, filter:"blur(5px)", animation:`rt-disco-beam-rapid ${b.dur}s ease-in-out infinite ${b.del}s` }} />
          ))}
          {makeSpotlight("150,240,255", 15, 3.2, 0,   0)}
          {makeSpotlight("100,255,220", 50, 2.6, 1.4, 1)}
          {makeSpotlight("180,220,255", 80, 3.8, 0.7, 2)}
          {[
            {col:"0,150,255",left:0, dur:0.80,del:0  },{col:"0,200,220",left:20,dur:0.95,del:0.25},
            {col:"0,220,255",left:45,dur:0.75,del:0.55},{col:"0,180,200",left:65,dur:0.88,del:0.38},
            {col:"50,150,255",left:85,dur:1.00,del:0.14},
          ].map((f,i) => (
            <div key={`wf-${i}`} style={{ position:"absolute", bottom:"-15%", left:`${f.left}%`, width:"45%", height:"55%", borderRadius:"50%", background:`radial-gradient(ellipse at 50% 100%, rgba(${f.col},0.26) 0%, rgba(${f.col},0.08) 55%, transparent 85%)`, filter:"blur(20px)", animation:`rt-disco-sweep-fast ${f.dur}s ease-in-out infinite ${f.del}s` }} />
          ))}
          {[{col:"0,200,255",top:-10,left:-10,w:55,dur:8,del:0},{col:"0,150,220",top:20,left:60,w:45,dur:11,del:2},{col:"50,220,200",top:50,left:20,w:40,dur:10,del:5}].map((o,i) => (
            <div key={`oo-${i}`} style={{ position:"absolute", top:`${o.top}%`, left:`${o.left}%`, width:`${o.w}%`, height:`${o.w}%`, borderRadius:"50%", background:`radial-gradient(circle, rgba(${o.col},0.14) 0%, transparent 65%)`, filter:"blur(25px)", animation:`rt-orb-drift ${o.dur}s ease-in-out infinite ${o.del}s` }} />
          ))}
          <div style={{ position:"absolute", top:"3%", left:"50%", width:28, height:28, borderRadius:"50%", transform:"translateX(-50%)", background:"radial-gradient(circle, rgba(100,220,255,0.98) 0%, rgba(0,180,255,0.45) 50%, transparent 80%)", boxShadow:"0 0 18px 8px rgba(0,200,255,0.35)", animation:"rt-disco-spin 2.5s linear infinite" }} />
          <div style={{ position:"absolute", inset:0, animation:"rt-disco-bass-slam 2.0s ease-out infinite" }} />
          {Array.from({length:120}, (_,i) => (
            <div key={`cg-${i}`} style={{ position:"absolute", borderRadius:"50%", width:1+(i%3), height:1+(i%3), background:`rgba(${cols4[i%4]},1)`, top:`${(i*17+9)%100}%`, left:`${(i*31+7)%100}%`, boxShadow:`0 0 ${(1+(i%3))*3}px rgba(0,200,255,0.92)`, animation:`rt-disco-glitter ${0.25+(i%6)*0.09}s ease-in-out infinite ${(i*0.07)%2}s` }} />
          ))}
        </>
      );
    }

    case 3: {
      // 💜 Purple Rain — fast violet streaks + mystical dancers
      const purpCols = ["200,0,255","150,0,200","255,0,200","180,50,255"];
      const rainDrops = Array.from({length:70}, (_,i) => ({
        left:(i*37+11)%100, dur:0.55+(i%7)*0.12, del:(i*0.07)%2,
        h:10+(i%4)*8, col:i%3===0?"200,0,255":i%3===1?"150,0,200":"255,0,200",
      }));
      return (
        <>
          {rainDrops.map((r,i) => (
            <div key={`pr-${i}`} style={{ position:"absolute", left:`${r.left}%`, width:"2px", height:`${r.h}%`, background:`linear-gradient(to bottom, transparent, rgba(${r.col},0.85), rgba(${r.col},0.30), transparent)`, filter:"blur(1px)", animation:`rt-disco-rain-fall ${r.dur}s linear infinite ${r.del}s` }} />
          ))}
          {[
            {col:"180,0,255",left:12,dur:0.85,del:0   },{col:"120,0,200",left:28,dur:1.05,del:0.22},
            {col:"255,0,180",left:44,dur:0.75,del:0.48},{col:"200,0,255",left:60,dur:0.95,del:0.35},
            {col:"150,50,255",left:76,dur:0.88,del:0.62},{col:"220,0,200",left:90,dur:1.10,del:0.15},
          ].map((b,i) => (
            <div key={`pb-${i}`} style={{ position:"absolute", top:0, left:`${b.left}%`, width:"7%", height:"100%", transformOrigin:"top center", background:`linear-gradient(to bottom, rgba(${b.col},0.55) 0%, rgba(${b.col},0.20) 38%, rgba(${b.col},0.05) 68%, transparent 100%)`, filter:"blur(5px)", animation:`rt-disco-beam-rapid ${b.dur}s ease-in-out infinite ${b.del}s` }} />
          ))}
          {makeSpotlight("220,150,255", 25, 2.8, 0,   0)}
          {makeSpotlight("255,100,255", 62, 3.5, 1.2, 1)}
          {[{col:"180,0,255",top:10,left:10,w:50,dur:9,del:0},{col:"120,0,200",top:30,left:50,w:42,dur:12,del:3},{col:"220,0,180",top:58,left:25,w:36,dur:8,del:5}].map((o,i) => (
            <div key={`po-${i}`} style={{ position:"absolute", top:`${o.top}%`, left:`${o.left}%`, width:`${o.w}%`, height:`${o.w}%`, borderRadius:"50%", background:`radial-gradient(circle, rgba(${o.col},0.18) 0%, transparent 65%)`, filter:"blur(28px)", animation:`rt-orb-drift ${o.dur}s ease-in-out infinite ${o.del}s` }} />
          ))}
          <div style={{ position:"absolute", bottom:"-5%", left:"5%", right:"5%", height:"42%", background:"radial-gradient(ellipse at 50% 100%, rgba(120,0,200,0.24) 0%, rgba(180,0,255,0.09) 55%, transparent 85%)", filter:"blur(28px)", animation:"rt-disco-pulse 1.8s ease-in-out infinite" }} />
          <div style={{ position:"absolute", top:"3%", left:"50%", width:26, height:26, borderRadius:"50%", transform:"translateX(-50%)", background:"radial-gradient(circle, rgba(220,120,255,0.98) 0%, rgba(180,0,255,0.55) 50%, transparent 80%)", boxShadow:"0 0 18px 8px rgba(180,0,255,0.40)", animation:"rt-disco-spin 1.8s linear infinite" }} />
          {makeConfetti(["200,0,255","255,0,200","150,50,255","220,100,255"], 50)}
          <div style={{ position:"absolute", inset:0, animation:"rt-disco-bass-slam 2.2s ease-out infinite" }} />
          {Array.from({length:130}, (_,i) => (
            <div key={`pg-${i}`} style={{ position:"absolute", borderRadius:"50%", width:1+(i%3), height:1+(i%3), background:`rgba(${purpCols[i%4]},1)`, top:`${(i*19+3)%100}%`, left:`${(i*27+17)%100}%`, boxShadow:`0 0 ${(1+(i%3))*4}px rgba(180,0,255,0.92)`, animation:`rt-disco-glitter ${0.22+(i%5)*0.08}s ease-in-out infinite ${(i*0.06)%2}s` }} />
          ))}
        </>
      );
    }

    case 4: {
      // ✨ Golden Fever — warm amber/gold rapid disco + confetti shower
      const goldGlitters = Array.from({length:160}, (_,i) => ({
        col:i%3===0?"255,210,60":i%3===1?"255,180,0":"255,255,200",
        top:(i*11+5)%100, left:(i*29+3)%100, size:1+(i%4), dur:0.22+(i%6)*0.08, del:(i*0.05)%1.8,
      }));
      return (
        <>
          {[
            {col:"255,180,0",left:8, dur:0.88,del:0   },{col:"255,140,0",left:20,dur:1.05,del:0.18},
            {col:"255,210,60",left:32,dur:0.80,del:0.38},{col:"255,160,20",left:44,dur:0.95,del:0.55},
            {col:"255,200,80",left:56,dur:0.85,del:0.25},{col:"240,180,0",left:68,dur:1.10,del:0.70},
            {col:"255,220,0",left:80,dur:0.78,del:0.42},{col:"255,160,40",left:92,dur:1.00,del:0.10},
          ].map((b,i) => (
            <div key={`gb-${i}`} style={{ position:"absolute", top:0, left:`${b.left}%`, width:"8%", height:"100%", transformOrigin:"top center", background:`linear-gradient(to bottom, rgba(${b.col},0.65) 0%, rgba(${b.col},0.24) 38%, rgba(${b.col},0.06) 68%, transparent 100%)`, filter:"blur(5px)", animation:`rt-disco-beam-rapid ${b.dur}s ease-in-out infinite ${b.del}s` }} />
          ))}
          {makeSpotlight("255,240,180", 18, 2.4, 0,   0)}
          {makeSpotlight("255,200,100", 55, 3.0, 1.0, 1)}
          {makeSpotlight("255,220,150", 82, 2.8, 0.5, 2)}
          {[{col:"255,160,0",left:0,dur:0.85,del:0},{col:"255,120,0",left:30,dur:1.00,del:0.3},{col:"255,200,60",left:60,dur:0.75,del:0.6}].map((f,i) => (
            <div key={`gf-${i}`} style={{ position:"absolute", bottom:"-8%", left:`${f.left}%`, width:"45%", height:"50%", borderRadius:"50%", background:`radial-gradient(ellipse at 50% 100%, rgba(${f.col},0.28) 0%, rgba(${f.col},0.09) 55%, transparent 85%)`, filter:"blur(20px)", animation:`rt-disco-sweep-fast ${f.dur}s ease-in-out infinite ${f.del}s` }} />
          ))}
          <div style={{ position:"absolute", top:"20%", left:"20%", right:"20%", bottom:"20%", borderRadius:"50%", background:"radial-gradient(circle, rgba(255,180,0,0.16) 0%, rgba(255,120,0,0.07) 55%, transparent 80%)", filter:"blur(50px)", animation:"rt-disco-pulse 1.5s ease-in-out infinite" }} />
          <div style={{ position:"absolute", top:"3%", left:"50%", width:36, height:36, borderRadius:"50%", transform:"translateX(-50%)", background:"radial-gradient(circle, rgba(255,240,120,0.99) 0%, rgba(255,180,0,0.60) 50%, transparent 80%)", boxShadow:"0 0 22px 10px rgba(255,200,0,0.45), 0 0 50px 20px rgba(255,140,0,0.18)", animation:"rt-disco-spin 1.8s linear infinite" }} />
          {Array.from({length:16}, (_,i) => (
            <div key={`gsp-${i}`} style={{ position:"absolute", top:"3%", left:"50%", width:"1px", height:`${18+((i*9)%12)}%`, transformOrigin:"top center", transform:`translateX(-50%) rotate(${i*22.5}deg)`, background:"linear-gradient(to bottom, rgba(255,220,80,0.70), transparent)", animation:`rt-disco-spin ${1.8+(i%4)*0.22}s linear infinite ${(i%5)*0.14}s` }} />
          ))}
          {goldGlitters.map((g,i) => (
            <div key={`gg-${i}`} style={{ position:"absolute", borderRadius:"50%", width:g.size, height:g.size, background:`rgba(${g.col},1)`, top:`${g.top}%`, left:`${g.left}%`, boxShadow:`0 0 ${g.size*4}px rgba(255,200,0,0.92)`, animation:`rt-disco-glitter ${g.dur}s ease-in-out infinite ${g.del}s` }} />
          ))}
          {makeConfetti(["255,210,60","255,180,0","255,255,150","255,140,0","255,240,100"], 70)}
          <div style={{ position:"absolute", inset:0, animation:"rt-disco-bass-slam 1.8s ease-out infinite" }} />
        </>
      );
    }

    case 5: {
      // ⚡ Blackout Strobe — darkness + ultra-fast white/cyan lasers + silhouettes
      return (
        <>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.60)" }} />
          {[
            {col:"255,255,255",left:12,dur:1.20,del:0,   kf:"rt-disco-beam-rapid"},
            {col:"0,240,255",   left:25,dur:0.95,del:0.18,kf:"rt-disco-beam-rapid"},
            {col:"255,255,255",left:38,dur:1.10,del:0.42,kf:"rt-disco-beam-rapid"},
            {col:"160,0,255",   left:51,dur:0.85,del:0.60,kf:"rt-disco-beam-rapid"},
            {col:"255,255,255",left:64,dur:1.05,del:0.28,kf:"rt-disco-beam-rapid"},
            {col:"0,240,255",   left:77,dur:0.90,del:0.75,kf:"rt-disco-beam-rapid"},
            {col:"255,255,255",left:90,dur:1.15,del:0.10,kf:"rt-disco-beam-rapid"},
          ].map((b,i) => (
            <div key={`lb-${i}`} style={{ position:"absolute", top:0, left:`${b.left}%`, width:"4%", height:"100%", transformOrigin:"top center", background:`linear-gradient(to bottom, rgba(${b.col},0.95) 0%, rgba(${b.col},0.60) 28%, rgba(${b.col},0.18) 62%, transparent 100%)`, filter:"blur(2px)", animation:`${b.kf} ${b.dur}s ease-in-out infinite ${b.del}s` }} />
          ))}
          {[
            {col:"255,255,255",left:6, dur:0.80,del:0.35,kf:"rt-disco-laser2"},
            {col:"0,240,255",   left:44,dur:0.70,del:0.55,kf:"rt-disco-laser"},
            {col:"255,0,200",   left:70,dur:0.88,del:0.20,kf:"rt-disco-laser2"},
          ].map((b,i) => (
            <div key={`lb2-${i}`} style={{ position:"absolute", top:0, left:`${b.left}%`, width:"2px", height:"100%", transformOrigin:"top center", background:`linear-gradient(to bottom, rgba(${b.col},1) 0%, rgba(${b.col},0.75) 38%, rgba(${b.col},0.22) 70%, transparent 100%)`, filter:"blur(0.5px)", animation:`${b.kf} ${b.dur}s ease-in-out infinite ${b.del}s` }} />
          ))}
          <div style={{ position:"absolute", inset:0, background:"rgba(255,255,255,0.28)", animation:"rt-disco-strobe-ultra 0.55s step-end infinite" }} />
          <div style={{ position:"absolute", inset:0, background:"rgba(0,240,255,0.18)", animation:"rt-disco-strobe-ultra 0.85s step-end infinite 0.22s" }} />
          <div style={{ position:"absolute", inset:0, background:"rgba(180,0,255,0.14)", animation:"rt-disco-strobe-ultra 1.10s step-end infinite 0.44s" }} />
          {makeSpotlight("255,255,255", 30, 1.4, 0,   0)}
          {makeSpotlight("200,240,255", 70, 1.8, 0.6, 1)}
          <div style={{ position:"absolute", inset:0, animation:"rt-disco-bass-slam 1.4s ease-out infinite" }} />
          {Array.from({length:80}, (_,i) => (
            <div key={`wg-${i}`} style={{ position:"absolute", borderRadius:"50%", width:1+(i%3), height:1+(i%3), background:`rgba(${i%3===0?"255,255,255":i%3===1?"0,240,255":"200,0,255"},1)`, top:`${(i*23+7)%100}%`, left:`${(i*37+11)%100}%`, boxShadow:`0 0 ${6+(i%3)*3}px rgba(255,255,255,0.95)`, animation:`rt-disco-glitter ${0.14+(i%4)*0.05}s ease-in-out infinite ${(i*0.04)%0.8}s` }} />
          ))}
        </>
      );
    }

    case 6: {
      // 💃 Shadow Dancer — neon green matrix techno, MAXIMUM dancer energy
      const greenCols = ["0,255,80","80,255,0","0,255,160","0,200,100","100,255,50"];
      return (
        <>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 100%, rgba(0,80,30,0.32) 0%, transparent 65%)" }} />
          {[
            {col:"0,255,80", left:8, dur:0.78,del:0,   kf:"rt-disco-beam-rapid"},
            {col:"0,200,100",left:22,dur:0.92,del:0.15,kf:"rt-disco-beam-rapid"},
            {col:"80,255,0", left:36,dur:0.70,del:0.35,kf:"rt-disco-beam-rapid"},
            {col:"0,255,160",left:50,dur:0.85,del:0.55,kf:"rt-disco-beam-rapid"},
            {col:"0,255,80", left:64,dur:0.75,del:0.25,kf:"rt-disco-beam-rapid"},
            {col:"80,255,50",left:78,dur:0.95,del:0.68,kf:"rt-disco-beam-rapid"},
            {col:"0,200,100",left:90,dur:0.80,del:0.08,kf:"rt-disco-beam-rapid"},
          ].map((b,i) => (
            <div key={`sd-${i}`} style={{ position:"absolute", top:0, left:`${b.left}%`, width:"5%", height:"100%", transformOrigin:"top center", background:`linear-gradient(to bottom, rgba(${b.col},0.95) 0%, rgba(${b.col},0.60) 28%, rgba(${b.col},0.14) 62%, transparent 100%)`, filter:"blur(2.5px)", animation:`${b.kf} ${b.dur}s ease-in-out infinite ${b.del}s` }} />
          ))}
          {makeSpotlight("150,255,150", 15, 1.8, 0,   0)}
          {makeSpotlight("100,255,200", 50, 2.4, 0.8, 1)}
          {makeSpotlight("200,255,100", 80, 2.0, 1.6, 2)}
          {[{col:"0,255,80",left:5,dur:0.80,del:0},{col:"0,200,120",left:45,dur:0.95,del:0.4},{col:"80,255,0",left:75,dur:0.75,del:0.7}].map((f,i) => (
            <div key={`sdf-${i}`} style={{ position:"absolute", bottom:"-8%", left:`${f.left}%`, width:"50%", height:"48%", borderRadius:"50%", background:`radial-gradient(ellipse at 50% 100%, rgba(${f.col},0.24) 0%, rgba(${f.col},0.07) 55%, transparent 85%)`, filter:"blur(18px)", animation:`rt-disco-sweep-fast ${f.dur}s ease-in-out infinite ${f.del}s` }} />
          ))}
          <div style={{ position:"absolute", top:"3%", left:"50%", width:28, height:28, borderRadius:"50%", transform:"translateX(-50%)", background:"radial-gradient(circle, rgba(100,255,120,0.98) 0%, rgba(0,255,80,0.50) 50%, transparent 80%)", boxShadow:"0 0 20px 9px rgba(0,255,80,0.42)", animation:"rt-disco-spin 1.0s linear infinite" }} />
          {Array.from({length:14}, (_,i) => (
            <div key={`gsp-${i}`} style={{ position:"absolute", top:"3%", left:"50%", width:"1px", height:`${16+((i*11)%14)}%`, transformOrigin:"top center", transform:`translateX(-50%) rotate(${i*25.7}deg)`, background:"linear-gradient(to bottom, rgba(0,255,80,0.80), transparent)", animation:`rt-disco-spin ${1.0+(i%3)*0.22}s linear infinite ${i*0.12}s` }} />
          ))}
          <div style={{ position:"absolute", inset:0, background:"rgba(0,255,80,0.14)", animation:"rt-disco-strobe-ultra 1.1s step-end infinite" }} />
          <div style={{ position:"absolute", inset:0, animation:"rt-disco-bass-slam 1.6s ease-out infinite" }} />
          {Array.from({length:160}, (_,i) => (
            <div key={`sdg-${i}`} style={{ position:"absolute", borderRadius:"50%", width:1+(i%3), height:1+(i%3), background:`rgba(${greenCols[i%5]},1)`, top:`${(i*13+9)%100}%`, left:`${(i*31+5)%100}%`, boxShadow:`0 0 ${(1+(i%3))*5}px rgba(0,255,80,0.98)`, animation:`rt-disco-glitter ${0.15+(i%6)*0.06}s ease-in-out infinite ${(i*0.05)%1.5}s` }} />
          ))}
        </>
      );
    }

    default:
      return null;
  }
}

function DiscoThemeOverlay({ base, serverSceneIdx, onAdvance }: { base: React.CSSProperties; serverSceneIdx?: number; onAdvance?: () => void }) {
  // Single source-of-truth for what is actually RENDERED.
  // Both server-controlled and local-fallback paths update this state
  // during the "black" (opacity=0) phase so users see:
  //   old scene → fade to black → new scene → fade in
  // rather than new scene flashing in immediately then blinking.
  const [displayedSceneIdx, setDisplayedSceneIdx] = useState(serverSceneIdx ?? 0);
  const [opacity, setOpacity]   = useState(1);
  const [showLabel, setShowLabel] = useState(false);
  const timerRef = useRef<number | null>(null);
  // Separate ref for the host advance timer so its cleanup never cancels crossfade timers.
  const advanceTimerRef = useRef<number | null>(null);
  const prevServerSceneRef = useRef<number | undefined>(serverSceneIdx);

  // Server-controlled crossfade: wait for full 2.7s fade-out BEFORE
  // swapping the rendered scene so users see old→black→new (not new→blink→new).
  useEffect(() => {
    if (serverSceneIdx === undefined) return;
    if (prevServerSceneRef.current === serverSceneIdx) return;
    prevServerSceneRef.current = serverSceneIdx;
    const targetIdx = serverSceneIdx;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setOpacity(0);
    timerRef.current = window.setTimeout(() => {
      setDisplayedSceneIdx(targetIdx); // scene swaps while fully black
      setShowLabel(true);
      timerRef.current = window.setTimeout(() => {
        setOpacity(1);
        timerRef.current = window.setTimeout(() => setShowLabel(false), 3500);
      }, 80);
    }, 2700); // matches the 2.7s CSS opacity transition
  }, [serverSceneIdx]);

  // Local auto-advance: fires when NOT in server-controlled mode.
  useEffect(() => {
    if (serverSceneIdx !== undefined) return;
    const clear = () => { if (timerRef.current !== null) clearTimeout(timerRef.current); };
    const schedule = () => {
      const delay = (28 + Math.random() * 14) * 1000;
      timerRef.current = window.setTimeout(() => {
        setOpacity(0);
        timerRef.current = window.setTimeout(() => {
          setDisplayedSceneIdx(prev => (prev + 1) % 7); // scene swaps while black
          setShowLabel(true);
          timerRef.current = window.setTimeout(() => {
            setOpacity(1);
            timerRef.current = window.setTimeout(() => {
              setShowLabel(false);
              schedule();
            }, 3500);
          }, 80);
        }, 2700);
      }, delay);
    };
    schedule();
    return clear;
  }, [serverSceneIdx]);

  // Host-side auto-advance timer: emits room:disco-advance so the server broadcasts to all.
  // Uses advanceTimerRef (separate from timerRef) so its cleanup NEVER cancels active crossfade timers.
  useEffect(() => {
    if (!onAdvance) return;
    const clear = () => { if (advanceTimerRef.current !== null) clearTimeout(advanceTimerRef.current); };
    const schedule = () => {
      const delay = (28 + Math.random() * 14) * 1000;
      advanceTimerRef.current = window.setTimeout(() => { onAdvance(); schedule(); }, delay);
    };
    schedule();
    return clear;
  }, [onAdvance]);

  const scene = DISCO_SCENES[displayedSceneIdx];

  return (
    <div style={base}>
      <style>{ROOM_THEME_KEYFRAMES}</style>
      {/* Scene content — old scene fades to black, THEN new scene fades in */}
      <div style={{ position:"absolute", inset:0, transition:"opacity 2.7s cubic-bezier(0.4,0,0.2,1)", opacity }}>
        {renderDiscoScene(displayedSceneIdx)}
      </div>
      {/* Scene name flash — appears briefly on every scene change */}
      {showLabel && (
        <div style={{
          position:"absolute", top:"10%", left:"50%",
          background:"rgba(0,0,0,0.70)", backdropFilter:"blur(10px)",
          border:"1px solid rgba(255,255,255,0.18)",
          borderRadius:999, padding:"5px 20px",
          color:"rgba(255,255,255,0.92)", fontSize:12, fontWeight:700,
          letterSpacing:"0.10em", whiteSpace:"nowrap", textTransform:"uppercase",
          animation:"rt-disco-name-show 3.5s ease forwards",
          zIndex:10, pointerEvents:"none",
        }}>
          {scene.emoji} {scene.name}
        </div>
      )}
    </div>
  );
}

export function RoomThemeOverlay({ themeId, discoSceneIdx, onDiscoAdvance }: { themeId: string | null | undefined; discoSceneIdx?: number; onDiscoAdvance?: () => void }) {
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

    case "disco":
      return <DiscoThemeOverlay base={base} serverSceneIdx={discoSceneIdx} onAdvance={onDiscoAdvance} />;

    case "trap-gold": {
      const goldEmbers = Array.from({length:40},(_,i)=>({
        left: 3+(i*2.4)%94,
        size: 1.5+(i%4)*1.2,
        dur: 3+(i%7)*0.7,
        del: (i*0.28)%8,
        ex: -18+(i%5)*9,
        col: i%4===0?"255,215,0":i%4===1?"245,158,11":i%4===2?"251,191,36":"252,211,77",
      }));
      const skylineBlocks = [
        {l:0,w:6,h:28},{l:5,w:4,h:18},{l:8,w:8,h:38},{l:15,w:5,h:24},{l:19,w:3,h:14},
        {l:21,w:7,h:45},{l:27,w:4,h:30},{l:30,w:6,h:20},{l:35,w:5,h:35},{l:39,w:3,h:18},
        {l:41,w:8,h:50},{l:48,w:4,h:28},{l:51,w:6,h:38},{l:56,w:3,h:22},{l:58,w:7,h:42},
        {l:64,w:4,h:30},{l:67,w:5,h:18},{l:71,w:6,h:36},{l:76,w:3,h:24},{l:78,w:8,h:48},
        {l:85,w:4,h:28},{l:88,w:5,h:20},{l:92,w:5,h:34},{l:96,w:4,h:16},
      ];
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          {/* amber glow from below */}
          <div style={{ position:"absolute", bottom:"-5%", left:"-10%", right:"-10%", height:"30%",
            background:"radial-gradient(ellipse at 50% 100%, rgba(245,158,11,0.20) 0%, rgba(180,90,0,0.10) 55%, transparent 80%)",
            animation:"rt-lava-glow 5s ease-in-out infinite" }} />
          {/* top gold shimmer */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"25%",
            background:"radial-gradient(ellipse at 50% 0%, rgba(252,211,77,0.08) 0%, transparent 70%)",
            animation:"rt-orb-drift 8s ease-in-out infinite" }} />
          {/* city skyline silhouette */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"30%" }}>
            {skylineBlocks.map((b,i)=>(
              <div key={i} style={{
                position:"absolute", bottom:0, left:`${b.l}%`, width:`${b.w}%`, height:`${b.h}%`,
                background:"rgba(8,5,0,0.92)",
                boxShadow:"0 0 0 1px rgba(245,158,11,0.10)",
              }} />
            ))}
          </div>
          {/* gold ember particles */}
          {goldEmbers.map((e,i)=>(
            <div key={i} style={{
              position:"absolute", borderRadius:"50%",
              width:e.size, height:e.size,
              left:`${e.left}%`, bottom:"28%",
              background:`radial-gradient(circle, rgba(${e.col},1) 0%, rgba(${e.col},0.3) 70%, transparent 100%)`,
              boxShadow:`0 0 ${e.size*3}px rgba(${e.col},0.7)`,
              ["--ex" as any]:`${e.ex}px`,
              ["--ex2" as any]:`${e.ex}px`,
              animation:`rt-ember-rise ${e.dur}s ease-out infinite ${e.del}s`,
            }} />
          ))}
          {/* inner vignette */}
          <div style={{ position:"absolute", inset:0, boxShadow:"inset 0 60px 80px -40px rgba(0,0,0,0.5), inset 0 -80px 100px -40px rgba(0,0,0,0.35)" }} />
        </div>
      );
    }

    case "skeleton-gangsta": {
      const boneFlakes = Array.from({length:35},(_,i)=>({
        left: 2+(i*2.8)%96,
        size: 1+(i%5)*1.4,
        dur: 4+(i%6)*0.8,
        del: (i*0.31)%9,
        ex: -12+(i%5)*6,
        col: i%3===0?"220,215,200":i%3===1?"190,185,170":"240,235,225",
      }));
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>
          {/* cold fog radials */}
          <div style={{ position:"absolute", bottom:"-10%", left:"-20%", width:"70%", height:"50%",
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(200,195,185,0.06) 0%, transparent 65%)",
            animation:"rt-orb-drift 12s ease-in-out infinite" }} />
          <div style={{ position:"absolute", top:"-10%", right:"-15%", width:"60%", height:"55%",
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(180,175,165,0.05) 0%, transparent 65%)",
            animation:"rt-orb-drift2 15s ease-in-out infinite 3s" }} />
          {/* crack line patterns */}
          {[0,1,2].map(li=>(
            <div key={li} style={{
              position:"absolute",
              left:`${15+li*28}%`, top:`${20+li*15}%`,
              width:"1px", height:`${18+li*8}%`,
              background:`linear-gradient(to bottom, transparent, rgba(200,192,176,${0.10+li*0.04}), transparent)`,
              transform:`rotate(${-8+li*8}deg)`,
              animation:`rt-scanline ${10+li*4}s ease-in-out infinite ${li*2}s`,
            }} />
          ))}
          {/* bone-ash flakes drifting down */}
          {boneFlakes.map((f,i)=>(
            <div key={i} style={{
              position:"absolute",
              width:f.size, height:f.size,
              borderRadius: i%4===0?"0%":"50%",
              left:`${f.left}%`, top:"-2%",
              background:`rgba(${f.col},${0.35+(i%4)*0.12})`,
              boxShadow: i%5===0 ? `0 0 ${f.size*2}px rgba(${f.col},0.4)` : undefined,
              ["--ex" as any]:`${f.ex}px`,
              ["--ex2" as any]:`${f.ex}px`,
              animation:`rt-ember-rise ${f.dur}s ease-in-out infinite ${f.del}s`,
              transform:`rotate(${i*37%180}deg) scaleY(-1)`,
            }} />
          ))}
          {/* heavy vignette */}
          <div style={{ position:"absolute", inset:0,
            boxShadow:"inset 0 0 120px 40px rgba(0,0,0,0.65)",
            background:"radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.28) 100%)" }} />
        </div>
      );
    }

    case "romance": {
      const petals = Array.from({length: 18}, (_, i) => ({
        left:    4 + (i * 5.4) % 92,
        fontSize: 14 + (i % 5) * 6,
        dur:     9 + (i % 7) * 1.6,
        del:     (i * 0.85) % 14,
        cx:      -60 + (i % 6) * 24,
        cr:      130 + (i % 5) * 42,
        emoji:   i % 3 === 0 ? "🌹" : i % 3 === 1 ? "🥀" : "❤️",
      }));
      const goldDust = Array.from({length: 32}, (_, i) => ({
        left: 2 + (i * 3.1) % 96,
        top:  10 + (i * 2.9) % 78,
        size: 1.5 + (i % 3) * 0.8,
        dur:  4 + (i % 6) * 0.9,
        del:  (i * 0.42) % 7,
        dx:   -14 + (i % 5) * 7,
        col:  i % 4 === 0 ? "212,175,55" : i % 4 === 1 ? "201,152,72" : i % 4 === 2 ? "232,201,122" : "180,110,70",
      }));
      return (
        <div style={base}>
          <style>{ROOM_THEME_KEYFRAMES}</style>

          {/* Deep burgundy bloom — slow heartbeat from top-center */}
          <div style={{
            position:"absolute", top:"-18%", left:"15%", right:"15%", height:"55%",
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(140,20,50,0.24) 0%, rgba(100,10,30,0.14) 45%, transparent 75%)",
            filter:"blur(38px)",
            animation:"rt-romance-glow-breathe 8s ease-in-out infinite",
          }} />

          {/* Warm gold ambient from lower-left — candlelight pool */}
          <div style={{
            position:"absolute", bottom:"-10%", left:"-8%", width:"52%", height:"42%",
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(180,110,30,0.18) 0%, rgba(140,70,15,0.10) 55%, transparent 80%)",
            filter:"blur(44px)",
            animation:"rt-romance-candle 6s ease-in-out infinite",
          }} />

          {/* Muted rose shimmer — upper-right depth */}
          <div style={{
            position:"absolute", top:"8%", right:"-12%", width:"48%", height:"48%",
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(160,50,80,0.13) 0%, rgba(120,30,55,0.07) 60%, transparent 85%)",
            filter:"blur(50px)",
            animation:"rt-romance-glow-breathe 11s ease-in-out infinite 3.5s",
          }} />

          {/* Secondary deep burgundy pulse — center warmth */}
          <div style={{
            position:"absolute", top:"30%", left:"25%", right:"25%", height:"35%",
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(120,15,40,0.12) 0%, transparent 70%)",
            filter:"blur(30px)",
            animation:"rt-romance-glow-breathe 13s ease-in-out infinite 6s",
          }} />

          {/* Candleflicker warm pool at the bottom edge */}
          <div style={{
            position:"absolute", bottom:0, left:"20%", right:"20%", height:"22%",
            background:"radial-gradient(ellipse at 50% 100%, rgba(200,100,30,0.16) 0%, rgba(160,60,20,0.08) 55%, transparent 80%)",
            animation:"rt-romance-candle 4.5s ease-in-out infinite 1s",
          }} />

          {/* Slow-drifting rose petals, wilted roses, and hearts */}
          {petals.map((p, i) => (
            <div key={i} style={{
              position:"absolute", fontSize:p.fontSize,
              top:"-4%", left:`${p.left}%`,
              ["--cx" as any]:`${p.cx}px`,
              ["--cr" as any]:`${p.cr}deg`,
              animation:`rt-romance-petal-fall ${p.dur}s cubic-bezier(.3,.1,.7,.9) infinite ${p.del}s`,
              userSelect:"none", opacity:0,
              filter:"drop-shadow(0 2px 6px rgba(140,20,50,0.45))",
            }}>
              {p.emoji}
            </div>
          ))}

          {/* Gold dust particles — shimmer rising from the warmth */}
          {goldDust.map((d, i) => (
            <div key={`gd-${i}`} style={{
              position:"absolute", borderRadius:"50%",
              width:d.size, height:d.size,
              left:`${d.left}%`, top:`${d.top}%`,
              background:`radial-gradient(circle, rgba(${d.col},0.95) 0%, rgba(${d.col},0.30) 70%, transparent 100%)`,
              boxShadow: i % 4 === 0 ? `0 0 ${d.size * 3}px rgba(${d.col},0.55)` : undefined,
              ["--dx" as any]:`${d.dx}px`,
              animation:`rt-romance-dust ${d.dur}s ease-out infinite ${d.del}s`,
            }} />
          ))}

          {/* Thin golden thread lines — elegant filigree suggestion */}
          {[0,1,2].map(li => (
            <div key={`line-${li}`} style={{
              position:"absolute",
              height:"1px", width:`${18+li*12}%`,
              left:`${8+li*26}%`, top:`${22+li*22}%`,
              background:`linear-gradient(90deg, transparent, rgba(201,152,72,${0.18+li*0.06}), rgba(180,110,50,0.12), transparent)`,
              transform:`rotate(${-12+li*10}deg)`,
              animation:`rt-romance-glow-breathe ${7+li*2}s ease-in-out infinite ${li*1.8}s`,
            }} />
          ))}

          {/* Warm vignette — frames the room, draws the eye inward */}
          <div style={{
            position:"absolute", inset:0,
            boxShadow:
              "inset 0 0 80px 30px rgba(0,0,0,0.50), " +
              "inset 0 -60px 90px -20px rgba(100,20,10,0.18)",
            pointerEvents:"none",
          }} />
        </div>
      );
    }

    default:
      return null;
  }
}

