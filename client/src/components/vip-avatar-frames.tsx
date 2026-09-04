/**
 * Discord / Free4Talk decoration technique:
 * transparent animated frame asset layered OVER the avatar (hollow center).
 *
 * Character frames (sleeping cat, dragon, fox) — high-impact Free4Talk-style art.
 * Official Discord shop assets are not redistributable; these are original SVGs.
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

/** Animated transparent overlay — Discord Nitro / Free4Talk compositing model. */
export function AvatarFrameOverlay({
  src,
  size,
}: {
  src: string;
  size: number;
}) {
  // Dense grids need tighter bleed so frames don't collide with neighbors
  const padRatio = size <= 52 ? 0.14 : size <= 72 ? 0.2 : size <= 96 ? 0.26 : 0.3;
  const pad = Math.round(size * padRatio);
  const outer = size + pad * 2;
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
        top: -pad,
        left: -pad,
        width: outer,
        height: outer,
        pointerEvents: "none",
        zIndex: 25,
        objectFit: "contain",
        userSelect: "none",
      }}
    />
  );
}

function frame(id: VipOverlayId) {
  return function Frame({ size }: { size: number }) {
    return <AvatarFrameOverlay src={VIP_OVERLAY_FRAMES[id]} size={size} />;
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
