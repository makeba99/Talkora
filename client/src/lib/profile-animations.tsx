/**
 * Profile Animation system — rim effects around the portrait, never over it.
 * Motion style is inspired by LottieFiles aura / particle-ring loops
 * (https://lottiefiles.com/free-animations/aura) but implemented as CSS so
 * every lobby card can run them without a Lottie runtime.
 *
 * Distinct from avatar-frame ProfileDecorations (character overlays on the rim).
 */

export const PROFILE_ANIMATIONS = [
  { id: "none", label: "None", description: "No card animation", emoji: null },
  { id: "aurora", label: "Aurora", description: "Aurora halo around the card", emoji: "🌌" },
  { id: "neon-pulse", label: "Neon Pulse", description: "Pulsing neon rim", emoji: "💫" },
  { id: "starfield", label: "Starfield", description: "Sparkles on the rim", emoji: "✨" },
  { id: "fire-aura", label: "Ember", description: "Warm fire around the card", emoji: "🔥" },
  { id: "frost", label: "Frost", description: "Icy rim shimmer", emoji: "❄️" },
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

const RING = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2 - Math.PI / 2;
  const orbit = 62 + (i % 3);
  return {
    left: `${50 + Math.cos(a) * orbit}%`,
    top: `${50 + Math.sin(a) * orbit}%`,
    delay: `${(i * 0.16) % 2.2}s`,
    duration: `${1.8 + (i % 5) * 0.22}s`,
    size: 2 + (i % 4),
    color: i % 3 === 0 ? "#e9d5ff" : i % 3 === 1 ? "#67e8f9" : "#fff7ed",
  };
});

const PETALS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 - Math.PI / 2;
  const orbit = 64 + (i % 2) * 4;
  return {
    left: `${50 + Math.cos(a) * orbit}%`,
    top: `${50 + Math.sin(a) * orbit}%`,
    size: 6 + (i % 3) * 2,
    delay: `${(i * 0.28) % 2.8}s`,
    duration: `${3.4 + (i * 0.19) % 1.6}s`,
    color: i % 3 === 0 ? "rgba(255,183,197,0.95)" : i % 3 === 1 ? "rgba(251,113,133,0.8)" : "rgba(255,228,230,0.9)",
  };
});

interface OverlayProps {
  animationId: string | null | undefined;
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

  const opacity = isHost ? 1 : 0.92;
  const base = `absolute pointer-events-none overflow-visible pa-around ${className}`;
  const wrapStyle = { inset: "-22%", zIndex: 6, opacity } as const;

  switch (resolved) {

    case "aurora":
      return (
        <div className={base} style={wrapStyle}>
          <div className="pa-around-ring pa-around-aurora" />
          <div className="pa-around-ring pa-around-aurora pa-around-aurora--rev" />
        </div>
      );

    case "neon-pulse":
      return (
        <div className={base} style={wrapStyle}>
          <div className="pa-around-ring pa-around-neon" />
          <div className="pa-around-ring pa-around-neon pa-around-neon--soft" />
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
              boxShadow: `0 0 8px ${star.color}`,
              animation: `pa-star-twinkle ${star.duration} ease-in-out infinite ${star.delay}`,
            }} />
          ))}
        </div>
      );

    case "fire-aura":
      return (
        <div className={base} style={wrapStyle}>
          <div className="pa-around-fire" />
          <div className="pa-around-fire pa-around-fire--l" />
          <div className="pa-around-fire pa-around-fire--r" />
        </div>
      );

    case "frost":
      return (
        <div className={base} style={wrapStyle}>
          <div className="pa-around-ring pa-around-frost" />
          <div className="pa-around-ring pa-around-frost pa-around-frost--spark" />
        </div>
      );

    case "golden":
      return (
        <div className={base} style={wrapStyle}>
          <div className="pa-around-ring pa-around-gold" />
          <div className="pa-around-ring pa-around-gold pa-around-gold--slow" />
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
