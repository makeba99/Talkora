/**
 * Profile Animation system — card-level overlay effects visible to all
 * participants in a voice room. Distinct from avatar-frame ProfileDecorations:
 * these animate the entire participant card background / edges.
 *
 * All animations are pure-CSS (keyframes defined in index.css with the
 * `pa-` prefix) so there are zero JS animation loops and no canvas overhead.
 */

export const PROFILE_ANIMATIONS = [
  { id: "none", label: "None", description: "No card animation", emoji: null },
  { id: "aurora", label: "Aurora", description: "Shifting aurora gradient", emoji: "🌌" },
  { id: "neon-pulse", label: "Neon Pulse", description: "Pulsing neon border glow", emoji: "💫" },
  { id: "starfield", label: "Starfield", description: "Soft star sparkles", emoji: "✨" },
  { id: "fire-aura", label: "Ember", description: "Warm fire glow", emoji: "🔥" },
  { id: "frost", label: "Frost", description: "Cool icy shimmer", emoji: "❄️" },
  { id: "golden", label: "Golden", description: "VIP gold light sweep", emoji: "👑" },
  { id: "cherry-blossom", label: "Blossom", description: "Soft falling petals", emoji: "🌸" },
] as const;


export type ProfileAnimationId = typeof PROFILE_ANIMATIONS[number]["id"];

const LEGACY_ANIMATION_MAP: Record<string, ProfileAnimationId> = {
  "cyber-scan": "neon-pulse",
  galaxy: "aurora",
  "rainbow-flow": "aurora",
  corruption: "neon-pulse",
  "solar-flare": "fire-aura",
  "void-portal": "neon-pulse",
  "matrix-rain": "starfield",
  "plasma-storm": "neon-pulse",
};

export function resolveProfileAnimationId(id: string | null | undefined): ProfileAnimationId | "none" {
  if (!id || id === "none") return "none";
  if (PROFILE_ANIMATIONS.some((a) => a.id === id)) return id as ProfileAnimationId;
  return LEGACY_ANIMATION_MAP[id] || "none";
}

// Pre-generated star positions so the starfield renders without JS loops
const STARS = Array.from({ length: 14 }, (_, i) => ({
  left:     `${8  + (i * 73  + i * i * 17) % 84}%`,
  top:      `${5  + (i * 53  + i * i * 29) % 88}%`,
  size:     1.5  + (i % 3) * 0.5,
  delay:    `${(i * 0.37) % 2.5}s`,
  duration: `${1.8 + (i * 0.23) % 1.4}s`,
  color:    i % 3 === 0 ? "#c4b5fd" : i % 3 === 1 ? "#67e8f9" : "#ffffff",
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
  const resolved = resolveProfileAnimationId(animationId);
  if (!resolved || resolved === "none") return null;

  const opacity = isHost ? 1 : 0.7;
  const base = `absolute inset-0 pointer-events-none overflow-hidden ${className}`;

  switch (resolved) {

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

    case "cherry-blossom":
      return (
        <div className={base} style={{ opacity, zIndex: 5 }}>
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
