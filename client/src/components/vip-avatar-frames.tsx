/**
 * VIP avatar frame overlays — configuration-driven decoration layer.
 *
 * Discord / Free4Talk technique: transparent SVG frame over the avatar
 * (hollow center). Official Discord shop assets are not redistributable;
 * frames in /public/decorations are original SVGs.
 *
 * Layout rule: decoration NEVER controls parent size. Overlay is absolutely
 * centered on the avatar shell and scaled via config + density.
 */

export const VIP_OVERLAY_FRAMES = {
  "sleeping-cat": "/decorations/sleeping-cat.svg",
  "dragon-coil": "/decorations/dragon-coil.svg",
  "fox-spirit": "/decorations/fox-spirit.svg",
  "sakura-orbit": "/decorations/sakura-orbit.svg",
  "ember-flame": "/decorations/ember-flame.svg",
  "luna-butterflies": "/decorations/luna-butterflies.svg",
} as const;

export type VipOverlayId = keyof typeof VIP_OVERLAY_FRAMES;

export type DecorationDensity = "full" | "reduced" | "lite";

/** Per-decoration visual fit (fractions of avatar size). */
export type DecorationLayoutConfig = {
  /** Visual size relative to avatar (1 = same as avatar). Keep ≤ ~1.22. */
  scale: number;
  /** Horizontal shift as fraction of avatar size (−0.05 … 0.05). */
  offsetX: number;
  /** Vertical shift as fraction of avatar size. */
  offsetY: number;
};

/**
 * Curated layout per asset. Character art that hangs off the rim gets a
 * slightly higher scale; ring-only assets stay tighter so the avatar stays hero.
 */
export const DECORATION_LAYOUT: Record<VipOverlayId, DecorationLayoutConfig> = {
  "sleeping-cat": { scale: 1.24, offsetX: 0, offsetY: -0.05 },
  "dragon-coil": { scale: 1.22, offsetX: 0.02, offsetY: 0 },
  "fox-spirit": { scale: 1.22, offsetX: 0, offsetY: -0.04 },
  "sakura-orbit": { scale: 1.2, offsetX: 0, offsetY: 0 },
  "ember-flame": { scale: 1.2, offsetX: 0, offsetY: 0.02 },
  "luna-butterflies": { scale: 1.22, offsetX: 0, offsetY: 0 },
};

const DENSITY_SCALE: Record<DecorationDensity, number> = {
  full: 1,
  reduced: 0.9,
  lite: 0.82,
};

export function densityFromSize(size: number): DecorationDensity {
  if (size <= 52) return "lite";
  if (size <= 72) return "reduced";
  return "full";
}

export function getDecorationVisualScale(
  id: VipOverlayId,
  density: DecorationDensity = "full",
): number {
  const base = DECORATION_LAYOUT[id]?.scale ?? 1.16;
  return Math.min(1.28, base * DENSITY_SCALE[density]);
}

/** Half of the extra visual size — use for grid bleed / gap. */
export function getDecorationBleedPx(
  avatarSize: number,
  id?: VipOverlayId | null,
  density: DecorationDensity = densityFromSize(avatarSize),
): number {
  if (!id || !(id in VIP_OVERLAY_FRAMES)) {
    // Reserve a small default bleed for mood / speaking ring
    return Math.round(avatarSize * (density === "lite" ? 0.06 : 0.08));
  }
  const scale = getDecorationVisualScale(id, density);
  return Math.max(4, Math.round((avatarSize * (scale - 1)) / 2));
}

/** Max bleed across unknown decorations — for room grid cell budgeting. */
export function getMaxDecorationBleedPx(
  avatarSize: number,
  density: DecorationDensity = densityFromSize(avatarSize),
): number {
  let maxScale = 1.12;
  for (const id of Object.keys(DECORATION_LAYOUT) as VipOverlayId[]) {
    maxScale = Math.max(maxScale, getDecorationVisualScale(id, density));
  }
  return Math.max(4, Math.round((avatarSize * (maxScale - 1)) / 2));
}

/** Animated transparent overlay — centered on avatar shell, out of document flow. */
export function AvatarFrameOverlay({
  src,
  decorationId,
  density = "full",
}: {
  src: string;
  decorationId: VipOverlayId;
  density?: DecorationDensity;
}) {
  const layout = DECORATION_LAYOUT[decorationId];
  const scale = getDecorationVisualScale(decorationId, density);
  const ox = (layout?.offsetX ?? 0) * 100;
  const oy = (layout?.offsetY ?? 0) * 100;

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      loading="lazy"
      data-testid="avatar-frame-overlay"
      className="avatar-frame-overlay"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: `calc(var(--avatar-size, 100%) * ${scale})`,
        height: `calc(var(--avatar-size, 100%) * ${scale})`,
        transform: `translate(calc(-50% + ${ox}%), calc(-50% + ${oy}%))`,
        pointerEvents: "none",
        zIndex: 20,
        objectFit: "contain",
        userSelect: "none",
      }}
    />
  );
}

function frame(id: VipOverlayId) {
  return function Frame({
    size: _size,
    density = "full",
  }: {
    size?: number;
    density?: DecorationDensity;
  }) {
    return (
      <AvatarFrameOverlay
        src={VIP_OVERLAY_FRAMES[id]}
        decorationId={id}
        density={density}
      />
    );
  };
}

export const SleepingCatFrame = frame("sleeping-cat");
export const DragonCoilFrame = frame("dragon-coil");
export const FoxSpiritFrame = frame("fox-spirit");
export const SakuraOrbitFrame = frame("sakura-orbit");
export const EmberFlameFrame = frame("ember-flame");
export const LunaButterfliesFrame = frame("luna-butterflies");

/** @deprecated legacy names → character frames */
export const VioletRosesFrame = FoxSpiritFrame;
export const CrystalHaloFrame = SakuraOrbitFrame;
export const NeonArcadeFrame = DragonCoilFrame;
