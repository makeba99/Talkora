/**
 * Avatar ring helpers — extracted into a tiny module so the lobby's
 * room cards (which only need this lookup table) don't have to pull in
 * the entire ~1.2k-line profile-dropdown component on first paint.
 *
 * profile-dropdown.tsx re-exports AVATAR_RINGS / getAvatarRingClass from
 * here so existing imports keep working.
 */
export const AVATAR_RINGS = [
  { id: "none", label: "None", className: "" },
  { id: "pulse-cyan", label: "Pulse Cyan", className: "animate-pulse ring-2 ring-cyan-400" },
  { id: "pulse-purple", label: "Pulse Purple", className: "animate-pulse ring-2 ring-purple-400" },
  { id: "glow-gold", label: "Glow Gold", className: "ring-2 ring-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" },
  { id: "glow-green", label: "Glow Green", className: "ring-2 ring-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" },
  { id: "glow-pink", label: "Glow Pink", className: "ring-2 ring-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.6)]" },
  { id: "rainbow", label: "Rainbow", className: "ring-2 ring-transparent bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 bg-clip-border" },
  { id: "fire", label: "Fire", className: "ring-2 ring-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.7)] animate-pulse" },
  { id: "ice", label: "Ice", className: "ring-2 ring-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.6)]" },
] as const;

export function getAvatarRingClass(ringId: string | null | undefined): string {
  if (!ringId || ringId === "none") return "";
  const ring = AVATAR_RINGS.find((r) => r.id === ringId);
  return ring?.className || "";
}

export const FLAIR_BADGES = [
  { id: "none", label: "None", icon: null },
  { id: "crown", label: "Crown", icon: "crown" },
  { id: "star", label: "Star", icon: "star" },
  { id: "lightning", label: "Lightning", icon: "lightning" },
  { id: "heart", label: "Heart", icon: "heart" },
  { id: "diamond", label: "Diamond", icon: "diamond" },
  { id: "cat", label: "Cat", icon: "cat" },
  { id: "dog", label: "Dog", icon: "dog" },
  { id: "bear", label: "Bear", icon: "bear" },
  { id: "fox", label: "Fox", icon: "fox" },
  { id: "wolf", label: "Wolf", icon: "wolf" },
  { id: "panda", label: "Panda", icon: "panda" },
] as const;

export function getFlairIcon(badgeId: string | null | undefined): string | null {
  if (!badgeId || badgeId === "none") return null;
  const badge = FLAIR_BADGES.find((b) => b.id === badgeId);
  return badge?.icon || null;
}

const FLAIR_ICON_MAP: Record<string, string> = {
  crown: "\u{1F451}",
  star: "\u2B50",
  lightning: "\u26A1",
  heart: "\u2764\uFE0F",
  diamond: "\u{1F48E}",
  cat: "\u{1F431}",
  dog: "\u{1F436}",
  bear: "\u{1F43B}",
  fox: "\u{1F98A}",
  wolf: "\u{1F43A}",
  panda: "\u{1F43C}",
};

export function getFlairEmoji(badgeId: string | null | undefined): string | null {
  const icon = getFlairIcon(badgeId);
  if (!icon) return null;
  return FLAIR_ICON_MAP[icon] ?? null;
}
