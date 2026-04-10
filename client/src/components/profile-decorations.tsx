import React from "react";

export const PROFILE_DECORATIONS = [
  { id: "none", label: "None", description: "No decoration" },
  { id: "cosmic", label: "🌀 Cosmic Ring", description: "Holographic orbiting ring" },
  { id: "fire", label: "🔥 Fire Aura", description: "Blazing flame aura" },
  { id: "lightning", label: "⚡ Lightning", description: "Electric energy arc" },
  { id: "sparkles", label: "✨ Sparkles", description: "Shimmering sparkles halo" },
  { id: "rainbow", label: "🌈 Rainbow", description: "Chromatic glow ring" },
  { id: "snow", label: "❄️ Frost", description: "Icy frost aura" },
  { id: "hearts", label: "💕 Hearts", description: "Floating heart aura" },
  { id: "stars", label: "⭐ Stars", description: "Orbiting star ring" },
  { id: "bubbles", label: "🫧 Bubbles", description: "Rising bubble aura" },
  { id: "flowers", label: "🌸 Flowers", description: "Petal shower" },
  { id: "catears", label: "🐱 Cat Ears", description: "Cute cat ears" },
] as const;

export type DecorationId = typeof PROFILE_DECORATIONS[number]["id"];

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
`;

function uid(prefix: string, i: number) { return `${prefix}-${i}`; }

function CosmicRing({ size }: { size: number }) {
  const pad = Math.round(size * 0.32);
  const w = size + pad * 2;
  const c = w / 2;
  const r1 = size / 2 + pad * 0.38;
  const r2 = size / 2 + pad * 0.72;
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
          <circle cx={c} cy={c} r={r2} fill="none" stroke={`url(#${id}g1)`} strokeWidth="3.5" filter={`url(#${id}glow2)`} />
        </g>
        <g style={{ animation: `dec-spin-rev 3s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          <circle cx={c} cy={c} r={r2 - 4} fill="none" stroke={`url(#${id}g2)`} strokeWidth="1.5" opacity="0.5" />
        </g>
        <g style={{ animation: `dec-spin-rev 6s linear infinite`, transformOrigin: `${c}px ${c}px` }}>
          <circle cx={c} cy={c} r={r1} fill="none" stroke="#00e5ff" strokeWidth="1" strokeDasharray="6 5" opacity="0.55" filter={`url(#${id}glow)`} />
        </g>
        {Array.from({ length: dots }).map((_, i) => {
          const angle = (i / dots) * 2 * Math.PI;
          const dx = Math.cos(angle) * r2;
          const dy = Math.sin(angle) * r2;
          return (
            <circle
              key={i}
              cx={c + dx}
              cy={c + dy}
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
  const r = size / 2 + pad * 0.55;
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
          const a1 = ((i / arcs) * 360 - 20) * (Math.PI / 180);
          const a2 = ((i / arcs) * 360 + 50) * (Math.PI / 180);
          const x1 = c + Math.cos(a1) * r;
          const y1 = c + Math.sin(a1) * r;
          const x2 = c + Math.cos(a2) * r;
          const y2 = c + Math.sin(a2) * r;
          const mx = c + Math.cos((a1 + a2) / 2) * (r * 1.25);
          const my = c + Math.sin((a1 + a2) / 2) * (r * 1.25);
          const dur = 0.4 + Math.random() * 0.5;
          const delay = (i / arcs) * 1.5;
          return (
            <g key={i} style={{ animation: `dec-flicker ${dur}s ease-in-out ${delay}s infinite` }}>
              <path
                d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
                fill="none"
                stroke="#00cfff"
                strokeWidth="2.5"
                strokeLinecap="round"
                filter={`url(#lf${size})`}
              />
              <path
                d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.8"
                strokeLinecap="round"
                opacity="0.9"
              />
            </g>
          );
        })}
        <circle cx={c} cy={c} r={r} fill="none" stroke="#00cfff" strokeWidth="1" opacity="0.25"
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
          const angle = (i / count) * 2 * Math.PI;
          const rVar = (size / 2 + pad * 0.45) + (i % 3) * pad * 0.18;
          const x = c + Math.cos(angle) * rVar;
          const y = c + Math.sin(angle) * rVar;
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
  const r = size / 2 + pad * 0.55;
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
          <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${id}lg)`} strokeWidth="5" filter={`url(#${id}gf)`} />
          <circle cx={c} cy={c} r={r + 5} fill="none" stroke={`url(#${id}lg)`} strokeWidth="1.5" opacity="0.4" />
          <circle cx={c} cy={c} r={r - 5} fill="none" stroke={`url(#${id}lg)`} strokeWidth="1.5" opacity="0.4" />
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
            const angle = (i / count) * 2 * Math.PI;
            const rVar = (size / 2 + pad * 0.4) + (i % 3) * pad * 0.22;
            const sx = c + Math.cos(angle) * rVar;
            const sy = c + Math.sin(angle) * rVar;
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
        <circle cx={c} cy={c} r={size / 2 + pad * 0.2} fill="none" stroke="#a8f4ff" strokeWidth="1" opacity="0.25"
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
          const angle = (i / count) * 2 * Math.PI;
          const rVar = size / 2 + pad * 0.38 + (i % 3) * pad * 0.2;
          const sx = c + Math.cos(angle) * rVar;
          const sy = c + Math.sin(angle) * rVar;
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
            const angle = (i / count) * 2 * Math.PI;
            const rVar = size / 2 + pad * 0.5 + (i % 3) * pad * 0.15;
            const x = c + Math.cos(angle) * rVar;
            const y = c + Math.sin(angle) * rVar;
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
        <circle cx={c} cy={c} r={size / 2 + pad * 0.3} fill="none" stroke="#ffe96e" strokeWidth="0.8" opacity="0.2"
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
          const angle = (i / count) * 2 * Math.PI + Math.random() * 0.5;
          const rx = c + Math.cos(angle) * (size / 2 + pad * 0.3 + (i % 3) * pad * 0.15);
          const ry = c + Math.sin(angle) * (size / 2 + pad * 0.3 + (i % 3) * pad * 0.15);
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
          const angle = (i / count) * 2 * Math.PI;
          const sx = c + Math.cos(angle) * (size / 2 + pad * 0.3 + (i % 3) * pad * 0.2);
          const sy = c + Math.sin(angle) * (size / 2 + pad * 0.3 + (i % 3) * pad * 0.2);
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
    <div style={wrapStyle}>
      <style>{DECO_STYLES}</style>
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
  { id: "none", label: "Default", description: "Standard theme", bg: "" },
  { id: "neon", label: "⚡ Neon City", description: "Cyan & purple neon glow", bg: "neon" },
  { id: "galaxy", label: "🌌 Galaxy", description: "Deep space starfield", bg: "galaxy" },
  { id: "sunset", label: "🌅 Sunset", description: "Warm orange glow", bg: "sunset" },
  { id: "forest", label: "🌿 Forest", description: "Green nature vibes", bg: "forest" },
  { id: "cyberpunk", label: "🤖 Cyberpunk", description: "Yellow & cyan grid", bg: "cyberpunk" },
  { id: "ocean", label: "🌊 Ocean", description: "Deep blue waves", bg: "ocean" },
  { id: "cherry", label: "🌸 Cherry Blossom", description: "Pink floral dream", bg: "cherry" },
] as const;

export type RoomThemeId = typeof ROOM_THEMES[number]["id"];

const ROOM_THEME_KEYFRAMES = `
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
`;

export function getRoomThemeStyle(themeId: string | null | undefined): React.CSSProperties {
  switch (themeId) {
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
    default:
      return {};
  }
}

export function RoomThemeOverlay({ themeId }: { themeId: string | null | undefined }) {
  if (!themeId || themeId === "none") return null;

  const base: React.CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 };

  switch (themeId) {
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

    default:
      return null;
  }
}

export function getRoomThemeBorderClass(themeId: string | null | undefined): string {
  switch (themeId) {
    case "neon": return "from-cyan-400 to-purple-500";
    case "galaxy": return "from-indigo-500 to-purple-700";
    case "sunset": return "from-orange-400 to-red-500";
    case "forest": return "from-green-400 to-emerald-600";
    case "cyberpunk": return "from-yellow-400 to-cyan-400";
    case "ocean": return "from-blue-400 to-cyan-600";
    case "cherry": return "from-pink-400 to-rose-500";
    case "gold": return "from-yellow-300 to-amber-500";
    case "violet": return "from-violet-400 to-fuchsia-600";
    default: return "from-cyan-500 to-purple-500";
  }
}
