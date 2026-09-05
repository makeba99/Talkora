/**
 * Square lobby/room profile frames.
 * Independent of VIP overlays, avatar rings, and room theme.
 * Saved as `user.profileDecoration` (same field as before).
 */

export const SQUARE_PROFILE_STYLES = [
  { id: "none", label: "None", description: "Clean square card", vip: false },
  { id: "glass", label: "Glass", description: "Soft glass edge", vip: false },
  { id: "neon", label: "Neon", description: "Violet neon frame", vip: false },
  { id: "aurora", label: "Aurora", description: "Moving aurora edge", vip: false },
  { id: "fire", label: "Fire", description: "Warm ember rim", vip: false },
  { id: "stars", label: "Stars", description: "Corner sparkles", vip: false },
  { id: "cyber", label: "Cyber", description: "HUD corner brackets", vip: false },
  { id: "ocean", label: "Ocean", description: "Cool cyan glass", vip: false },
  { id: "sunset", label: "Sunset", description: "Warm peach rim", vip: false },
  { id: "nature", label: "Nature", description: "Soft leaf-green edge", vip: false },
  { id: "seasonal", label: "Seasonal", description: "Blossom-tinted rim", vip: false },
  { id: "royal", label: "Royal", description: "Gold premium frame", vip: true },
  { id: "galaxy", label: "Galaxy", description: "Cosmic purple rim", vip: true },
  { id: "crystal", label: "Crystal", description: "Icy prism edge", vip: true },
] as const;

export type SquareProfileStyleId = typeof SQUARE_PROFILE_STYLES[number]["id"];

const SQUARE_IDS = new Set<string>(SQUARE_PROFILE_STYLES.map((s) => s.id));

/** Retired / VIP overlay ids → square frame style. */
const LEGACY_TO_SQUARE: Record<string, SquareProfileStyleId> = {
  "sleeping-cat": "nature",
  "dragon-coil": "cyber",
  "fox-spirit": "sunset",
  "sakura-orbit": "seasonal",
  "ember-flame": "fire",
  "luna-butterflies": "aurora",
  quantum: "cyber",
  helix: "seasonal",
  sentinel: "cyber",
  tactical: "cyber",
  pulse: "neon",
  executive: "royal",
  hologram: "cyber",
  crimson: "fire",
  circuit: "cyber",
  cosmic: "galaxy",
  rainbow: "galaxy",
  sparkles: "stars",
  lightning: "fire",
  snow: "crystal",
  hearts: "sunset",
  bubbles: "ocean",
  flowers: "nature",
  catears: "nature",
  crystals: "crystal",
  "crystals-aqua": "crystal",
  "neon-chaos": "neon",
  "neon-chaos-purple": "neon",
  dragon: "cyber",
  "dragon-ruby": "fire",
  "solar-eclipse": "galaxy",
  "inferno-skull": "fire",
  "violet-roses": "sunset",
  "crystal-halo": "crystal",
  "neon-arcade": "cyber",
};

const RING_TO_SQUARE: Record<string, SquareProfileStyleId> = {
  "pulse-cyan": "ocean",
  "pulse-purple": "neon",
  "glow-gold": "royal",
  "glow-green": "nature",
  "glow-pink": "sunset",
  rainbow: "galaxy",
  fire: "fire",
  ice: "crystal",
  "vip-crown": "royal",
  "vip-aurora": "aurora",
};

export function resolveSquareProfileStyle(
  decorationId?: string | null,
  _avatarRing?: string | null,
): SquareProfileStyleId {
  if (decorationId && SQUARE_IDS.has(decorationId)) {
    return decorationId as SquareProfileStyleId;
  }
  if (decorationId && LEGACY_TO_SQUARE[decorationId]) {
    return LEGACY_TO_SQUARE[decorationId];
  }
  return "none";
}
