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
  { id: "corruption",    label: "Corruption",    description: "Dark corruption tendrils",     emoji: "👿" },
  { id: "solar-flare",   label: "Solar Flare",   description: "Blazing solar corona",         emoji: "☀️" },
  { id: "void-portal",   label: "Void Portal",   description: "Swirling void gateway",        emoji: "🕳️" },
  { id: "matrix-rain",   label: "Matrix Rain",   description: "Digital code rain",            emoji: "💻" },
  { id: "plasma-storm",  label: "Plasma Storm",   description: "Electric plasma bolts",        emoji: "⚡" },
  { id: "cherry-blossom",label: "Cherry Blossom", description: "Falling cherry petals",        emoji: "🌸" },
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

// Pre-generated rain drop positions for matrix-rain
const RAIN_DROPS = Array.from({ length: 24 }, (_, i) => ({
  left:     `${3 + (i * 67 + i * i * 13) % 94}%`,
  height:   `${8 + (i * 7) % 18}%`,
  delay:    `${(i * 0.31) % 3.2}s`,
  duration: `${1.2 + (i * 0.19) % 1.6}s`,
  opacity:  0.3 + (i % 4) * 0.15,
}));

// Pre-generated petal positions for cherry-blossom
const PETALS = Array.from({ length: 14 }, (_, i) => ({
  left:     `${4 + (i * 71 + i * i * 19) % 92}%`,
  size:     4 + (i % 4) * 2,
  delay:    `${(i * 0.47) % 4}s`,
  duration: `${3.5 + (i * 0.33) % 2.5}s`,
  drift:    (i % 2 === 0 ? 1 : -1) * (8 + (i * 3) % 12),
  color:    i % 3 === 0 ? "rgba(255,183,197,0.7)" : i % 3 === 1 ? "rgba(255,150,170,0.6)" : "rgba(255,200,210,0.65)",
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

    case "corruption":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          {/* Edge tendrils from all sides */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(0deg, rgba(45,27,105,0.52) 0%, transparent 40%), linear-gradient(180deg, rgba(45,27,105,0.48) 0%, transparent 35%), linear-gradient(90deg, rgba(45,27,105,0.44) 0%, transparent 30%), linear-gradient(270deg, rgba(45,27,105,0.44) 0%, transparent 30%)",
            animation: "pa-corruption-pulse 3s ease-in-out infinite",
          }} />
          {/* Corner smoke */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at 0% 0%, rgba(88,28,135,0.45) 0%, transparent 42%), radial-gradient(ellipse at 100% 100%, rgba(88,28,135,0.4) 0%, transparent 42%), radial-gradient(ellipse at 100% 0%, rgba(59,7,100,0.3) 0%, transparent 35%), radial-gradient(ellipse at 0% 100%, rgba(59,7,100,0.3) 0%, transparent 35%)",
            animation: "pa-corruption-pulse 4s ease-in-out infinite 1s",
          }} />
          {/* Dark vignette */}
          <div style={{
            position: "absolute", inset: 0,
            boxShadow: "inset 0 0 30px rgba(30,0,60,0.35)",
          }} />
        </div>
      );

    case "solar-flare":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          {/* Core radial glow */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 50% 50%, rgba(250,204,21,0.45) 0%, rgba(249,115,22,0.3) 30%, rgba(239,68,68,0.12) 55%, transparent 75%)",
            animation: "pa-solar-pulse 2.8s ease-in-out infinite",
          }} />
          {/* Conic rays */}
          <div style={{
            position: "absolute", inset: "-20%",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(250,204,21,0.18) 8deg, transparent 16deg, transparent 45deg, rgba(249,115,22,0.14) 53deg, transparent 61deg, transparent 90deg, rgba(250,204,21,0.16) 98deg, transparent 106deg, transparent 135deg, rgba(249,115,22,0.12) 143deg, transparent 151deg, transparent 180deg, rgba(250,204,21,0.18) 188deg, transparent 196deg, transparent 225deg, rgba(249,115,22,0.14) 233deg, transparent 241deg, transparent 270deg, rgba(250,204,21,0.16) 278deg, transparent 286deg, transparent 315deg, rgba(249,115,22,0.12) 323deg, transparent 331deg, transparent 360deg)",
            animation: "pa-galaxy-spin 8s linear infinite",
          }} />
          {/* Bright flare spots */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 30% 25%, rgba(255,255,200,0.35) 0%, transparent 12%), radial-gradient(circle at 72% 68%, rgba(255,220,150,0.28) 0%, transparent 10%), radial-gradient(circle at 55% 40%, rgba(255,240,180,0.2) 0%, transparent 8%)",
            animation: "pa-solar-pulse 3.4s ease-in-out infinite 0.8s",
          }} />
        </div>
      );

    case "void-portal":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          {/* Spinning vortex */}
          <div style={{
            position: "absolute", inset: "-40%",
            background: "conic-gradient(from 0deg, rgba(30,10,60,0.5), rgba(76,29,149,0.35), rgba(30,58,138,0.3), rgba(15,5,40,0.45), rgba(76,29,149,0.38), rgba(30,58,138,0.28), rgba(30,10,60,0.5))",
            animation: "pa-galaxy-spin 12s linear infinite",
          }} />
          {/* Dark center vignette */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 35%, transparent 65%)",
          }} />
          {/* Edge glow */}
          <div style={{
            position: "absolute", inset: 0,
            boxShadow: "inset 0 0 28px rgba(76,29,149,0.3)",
          }} />
        </div>
      );

    case "matrix-rain":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          {/* Green ambient glow */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at 50% 30%, rgba(0,255,65,0.06) 0%, transparent 70%)",
          }} />
          {RAIN_DROPS.map((drop, i) => (
            <div key={i} style={{
              position: "absolute",
              left: drop.left,
              top: "-10%",
              width: 2,
              height: drop.height,
              background: `linear-gradient(180deg, transparent, rgba(0,255,65,${drop.opacity}), transparent)`,
              animation: `pa-matrix-fall ${drop.duration} linear infinite ${drop.delay}`,
            }} />
          ))}
        </div>
      );

    case "plasma-storm":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          {/* Electric background glow */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at 40% 30%, rgba(6,182,212,0.2) 0%, transparent 55%), radial-gradient(ellipse at 65% 75%, rgba(59,130,246,0.18) 0%, transparent 50%)",
            animation: "pa-plasma-glow 2s ease-in-out infinite",
          }} />
          {/* Bolt streaks */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(125deg, transparent 20%, rgba(6,182,212,0.35) 21%, transparent 22%, transparent 48%, rgba(59,130,246,0.3) 49%, transparent 50%, transparent 76%, rgba(6,182,212,0.28) 77%, transparent 78%)",
            animation: "pa-plasma-flicker 1.8s steps(2) infinite",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(55deg, transparent 30%, rgba(99,102,241,0.25) 31%, transparent 32%, transparent 62%, rgba(6,182,212,0.22) 63%, transparent 64%)",
            animation: "pa-plasma-flicker 2.4s steps(2) infinite 0.6s",
          }} />
          {/* Ambient box glow */}
          <div style={{
            position: "absolute", inset: 0,
            boxShadow: "inset 0 0 20px rgba(6,182,212,0.15)",
            animation: "pa-plasma-glow 2.5s ease-in-out infinite 0.4s",
          }} />
        </div>
      );

    case "cherry-blossom":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
          {/* Soft pink ambient */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at 50% 60%, rgba(255,183,197,0.1) 0%, transparent 65%)",
          }} />
          {PETALS.map((petal, i) => (
            <div key={i} style={{
              position: "absolute",
              left: petal.left,
              top: "-8%",
              width: petal.size,
              height: petal.size * 0.75,
              borderRadius: "50% 0 50% 50%",
              background: petal.color,
              animation: `pa-petal-fall ${petal.duration} ease-in-out infinite ${petal.delay}`,
              transform: `rotate(${(i * 37) % 360}deg)`,
            }} />
          ))}
        </div>
      );

    default:
      return null;
  }
}
