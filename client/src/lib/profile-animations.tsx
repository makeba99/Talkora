/**
 * Profile Animation system — card-level overlay effects visible to all
 * participants in a voice room. Distinct from avatar-frame ProfileDecorations:
 * these animate around the participant card, not over the portrait.
 *
 * All animations are pure-CSS (keyframes defined in index.css with the
 * `pa-` prefix) so there are zero JS animation loops and no canvas overhead.
 */

export const PROFILE_ANIMATIONS = [
  { id: "none", label: "None", description: "No card animation", emoji: null },
  { id: "aurora", label: "Aurora", description: "Shifting aurora halo", emoji: "🌌" },
  { id: "neon-pulse", label: "Neon Pulse", description: "Pulsing neon rim", emoji: "💫" },
  { id: "starfield", label: "Starfield", description: "Orbiting sparkles", emoji: "✨" },
  { id: "fire-aura", label: "Ember", description: "Warm fire around the card", emoji: "🔥" },
  { id: "frost", label: "Frost", description: "Icy corner shimmer", emoji: "❄️" },
  { id: "golden", label: "Golden", description: "VIP gold rim sweep", emoji: "👑" },
  { id: "cherry-blossom", label: "Blossom", description: "Petals around the portrait", emoji: "🌸" },
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

const RING = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
  return {
    left: `${50 + Math.cos(a) * 54}%`,
    top: `${50 + Math.sin(a) * 54}%`,
    delay: `${(i * 0.22) % 2.4}s`,
    duration: `${1.6 + (i % 4) * 0.28}s`,
    size: 2 + (i % 3),
    color: i % 3 === 0 ? "#c4b5fd" : i % 3 === 1 ? "#67e8f9" : "#ffffff",
  };
});

const PETALS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
  return {
    left: `${50 + Math.cos(a) * 56}%`,
    top: `${50 + Math.sin(a) * 56}%`,
    size: 5 + (i % 3) * 2,
    delay: `${(i * 0.41) % 3.2}s`,
    duration: `${3.2 + (i * 0.27) % 1.8}s`,
    color: i % 3 === 0 ? "rgba(255,183,197,0.85)" : i % 3 === 1 ? "rgba(255,150,170,0.75)" : "rgba(255,200,210,0.8)",
  };
});

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
 * Renders around the portrait (negative inset, overflow visible) so the photo
 * stays readable. Parent must allow overflow.
 */
export function ProfileAnimationOverlay({
  animationId,
  isHost = false,
  className = "",
}: OverlayProps) {
  const resolved = resolveProfileAnimationId(animationId);
  if (!resolved || resolved === "none") return null;

  const opacity = isHost ? 1 : 0.78;
  const base = `absolute pointer-events-none overflow-visible pa-around ${className}`;
  const wrapStyle = { inset: "-14%", zIndex: 6, opacity } as const;

  switch (resolved) {

    case "aurora":
      return (
        <div className={base} style={wrapStyle}>
          <div className="pa-around-ring pa-around-aurora" />
        </div>
      );

    case "neon-pulse":
      return (
        <div className={base} style={wrapStyle}>
          <div className="pa-around-ring pa-around-neon" />
        </div>
      );

    case "starfield":
      return (
        <div className={base} style={wrapStyle}>
          {RING.map((star, i) => (
            <div key={i} style={{
              position: "absolute",
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              marginLeft: -star.size / 2,
              marginTop: -star.size / 2,
              borderRadius: "50%",
              background: star.color,
              boxShadow: `0 0 6px ${star.color}`,
              animation: `pa-star-twinkle ${star.duration} ease-in-out infinite ${star.delay}`,
            }} />
          ))}
        </div>
      );

    case "fire-aura":
      return (
        <div className={base} style={wrapStyle}>
          <div className="pa-around-fire" />
        </div>
      );

    case "frost":
      return (
        <div className={base} style={wrapStyle}>
          <div className="pa-around-ring pa-around-frost" />
        </div>
      );

    case "golden":
      return (
        <div className={base} style={wrapStyle}>
          <div className="pa-around-ring pa-around-gold" />
        </div>
      );

    case "cherry-blossom":
      return (
        <div className={base} style={wrapStyle}>
          {PETALS.map((petal, i) => (
            <div key={i} style={{
              position: "absolute",
              left: petal.left,
              top: petal.top,
              width: petal.size,
              height: petal.size * 0.75,
              marginLeft: -petal.size / 2,
              marginTop: -petal.size / 2,
              borderRadius: "50% 0 50% 50%",
              background: petal.color,
              animation: `pa-petal-orbit ${petal.duration} ease-in-out infinite ${petal.delay}`,
              transform: `rotate(${(i * 37) % 360}deg)`,
            }} />
          ))}
        </div>
      );

    default:
      return null;
  }
}
