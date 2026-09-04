/**
 * Free4Talk / Discord Nitro decoration technique:
 * transparent animated frame asset layered OVER a circular avatar.
 * Assets live in /decorations/*.svg (hollow center = avatar shows through).
 */

export const VIP_OVERLAY_FRAMES = {
  "luna-butterflies": "/decorations/luna-butterflies.svg",
  "violet-roses": "/decorations/violet-roses.svg",
  "ember-flame": "/decorations/ember-flame.svg",
  "crystal-halo": "/decorations/crystal-halo.svg",
} as const;

export type VipOverlayId = keyof typeof VIP_OVERLAY_FRAMES;

/** Animated transparent overlay — same compositing model Free4Talk / Discord use. */
export function AvatarFrameOverlay({
  src,
  size,
}: {
  src: string;
  size: number;
}) {
  // Frame is larger than the avatar so butterflies/flames sit outside the face.
  const pad = Math.round(size * 0.36);
  const outer = size + pad * 2;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      data-testid="avatar-frame-overlay"
      style={{
        position: "absolute",
        top: -pad,
        left: -pad,
        width: outer,
        height: outer,
        pointerEvents: "none",
        zIndex: 20,
        objectFit: "contain",
        userSelect: "none",
      }}
    />
  );
}

export function LunaButterfliesFrame({ size }: { size: number }) {
  return <AvatarFrameOverlay src={VIP_OVERLAY_FRAMES["luna-butterflies"]} size={size} />;
}

export function VioletRosesFrame({ size }: { size: number }) {
  return <AvatarFrameOverlay src={VIP_OVERLAY_FRAMES["violet-roses"]} size={size} />;
}

export function EmberFlameFrame({ size }: { size: number }) {
  return <AvatarFrameOverlay src={VIP_OVERLAY_FRAMES["ember-flame"]} size={size} />;
}

export function CrystalHaloFrame({ size }: { size: number }) {
  return <AvatarFrameOverlay src={VIP_OVERLAY_FRAMES["crystal-halo"]} size={size} />;
}
