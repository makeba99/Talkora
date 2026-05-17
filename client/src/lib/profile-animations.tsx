/**
 * Profile Animation system — card-level overlay effects visible to all
 * participants in a voice room. Distinct from avatar-frame ProfileDecorations:
 * these animate the entire participant card background / edges.
 *
 * All animations are pure-CSS (keyframes defined in index.css with the
 * `pa-` prefix) so there are zero JS animation loops and no canvas overhead.
 */

export const PROFILE_ANIMATIONS = [
  { id: "none",         label: "None",         description: "No card animation",          emoji: null },
  { id: "aurora",       label: "Aurora",        description: "Shifting aurora gradient",    emoji: "🌌" },
  { id: "neon-pulse",   label: "Neon Pulse",    description: "Pulsing neon border glow",   emoji: "💫" },
  { id: "cyber-scan",   label: "Cyber Scan",    description: "Holographic scan line",      emoji: "🔵" },
  { id: "starfield",    label: "Starfield",     description: "Twinkling star particles",   emoji: "✨" },
  { id: "galaxy",       label: "Galaxy",        description: "Rotating galaxy swirl",      emoji: "🌀" },
  { id: "fire-aura",    label: "Fire Aura",     description: "Rising fire glow",           emoji: "🔥" },
  { id: "frost",        label: "Frost",         description: "Icy blue shimmer",           emoji: "❄️" },
  { id: "golden",       label: "Golden",        description: "Golden light sweep",         emoji: "✨" },
  { id: "rainbow-flow", label: "Rainbow",       description: "Rainbow gradient flow",      emoji: "🌈" },
] as const;

export type ProfileAnimationId = typeof PROFILE_ANIMATIONS[number]["id"];

// Pre-generated star positions so the starfield renders without JS loops
const STARS = Array.from({ length: 14 }, (_, i) => ({
  left:     `${8  + (i * 73  + i * i * 17) % 84}%`,
  top:      `${5  + (i * 53  + i * i * 29) % 88}%`,
  size:     1.5  + (i % 3) * 0.5,
  delay:    `${(i * 0.37) % 2.5}s`,
  duration: `${1.8 + (i * 0.23) % 1.4}s`,
  color:    i % 3 === 0 ? "#c4b5fd" : i % 3 === 1 ? "#67e8f9" : "#ffffff",
}));

interface OverlayProps {
  /** The animation id stored on the user record. Null / undefined → no effect. */
  animationId: string | null | undefined;
  /**
   * Host / room-owner participants render at full intensity; other participants
   * render at 70% so the host's card stands out in the grid.
   */
  isHost?: boolean;
  className?: string;
}

/**
 * Drop this component as the *first* child inside any absolutely-positioned
 * container (participant card, profile preview) that has `overflow-hidden`.
 * It renders `position:absolute; inset:0; pointer-events:none; z-index:5`
 * so it sits behind interactive controls but above the raw avatar image.
 */
export function ProfileAnimationOverlay({
  animationId,
  isHost = false,
  className = "",
}: OverlayProps) {
  if (!animationId || animationId === "none") return null;

  const opacity = isHost ? 1 : 0.7;
  const base = `absolute inset-0 pointer-events-none overflow-hidden ${className}`;

  switch (animationId) {

    case "aurora":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(135deg, rgba(99,102,241,0.38), rgba(168,85,247,0.32), rgba(6,182,212,0.28), rgba(99,102,241,0.38))",
            backgroundSize: "300% 300%",
            animation: "pa-aurora-shift 6s ease infinite",
          }} />
        </div>
      );

    case "neon-pulse":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          <div style={{
            position: "absolute", inset: 0,
            boxShadow: "inset 0 0 18px rgba(99,102,241,0.65), inset 0 0 36px rgba(168,85,247,0.28)",
            animation: "pa-neon-pulse 2s ease-in-out infinite",
          }} />
        </div>
      );

    case "cyber-scan":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          {/* Moving horizontal beam */}
          <div style={{
            position: "absolute", left: 0, right: 0, height: "22%",
            background: "linear-gradient(180deg, transparent, rgba(0,229,255,0.18), transparent)",
            animation: "pa-scan-line 3s linear infinite",
          }} />
          {/* Subtle scanline texture */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,229,255,0.04) 3px, rgba(0,229,255,0.04) 4px)",
          }} />
        </div>
      );

    case "starfield":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          {STARS.map((star, i) => (
            <div key={i} style={{
              position: "absolute",
              left: star.left, top: star.top,
              width: star.size, height: star.size,
              borderRadius: "50%",
              background: star.color,
              animation: `pa-star-twinkle ${star.duration} ease-in-out infinite ${star.delay}`,
            }} />
          ))}
        </div>
      );

    case "galaxy":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          <div style={{
            position: "absolute",
            inset: "-50%",
            background: "conic-gradient(from 0deg, rgba(99,102,241,0.28), rgba(168,85,247,0.22), rgba(6,182,212,0.18), rgba(16,185,129,0.12), rgba(99,102,241,0.28))",
            animation: "pa-galaxy-spin 9s linear infinite",
          }} />
        </div>
      );

    case "fire-aura":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: "65%",
            background: "linear-gradient(0deg, rgba(239,68,68,0.42) 0%, rgba(249,115,22,0.28) 45%, transparent 100%)",
            animation: "pa-fire-rise 2.4s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: "40%",
            background: "linear-gradient(0deg, rgba(234,179,8,0.22) 0%, rgba(249,115,22,0.12) 60%, transparent 100%)",
            animation: "pa-fire-rise 1.8s ease-in-out infinite 0.6s",
          }} />
        </div>
      );

    case "frost":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at top left, rgba(186,230,253,0.28) 0%, transparent 62%), radial-gradient(ellipse at bottom right, rgba(147,197,253,0.22) 0%, transparent 62%)",
            animation: "pa-frost-pulse 3s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            boxShadow: "inset 0 0 22px rgba(125,211,252,0.18)",
            animation: "pa-frost-pulse 3s ease-in-out infinite 1.5s",
          }} />
        </div>
      );

    case "golden":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          <div style={{
            position: "absolute", top: 0, bottom: 0, width: "35%",
            background: "linear-gradient(90deg, transparent, rgba(250,204,21,0.42), rgba(251,191,36,0.28), transparent)",
            animation: "pa-golden-sweep 3.6s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            boxShadow: "inset 0 0 18px rgba(250,204,21,0.1)",
          }} />
        </div>
      );

    case "rainbow-flow":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(135deg, rgba(239,68,68,0.22), rgba(249,115,22,0.2), rgba(234,179,8,0.2), rgba(34,197,94,0.18), rgba(6,182,212,0.2), rgba(99,102,241,0.2), rgba(168,85,247,0.22))",
            backgroundSize: "200% 200%",
            animation: "pa-rainbow-flow 4s linear infinite",
          }} />
        </div>
      );

    default:
      return null;
  }
}
