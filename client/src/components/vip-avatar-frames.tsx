/**
 * Discord / Free4Talk / DecoProfile technique:
 * transparent animated frame asset layered OVER a circular avatar.
 *
 * Best-in-class library found: `decoprofile` (MIT) — 334 Discord-style avatar
 * decorations + profile effects. It requires React 19; this app is on React 18,
 * so we mirror the same compositing model with self-hosted premium overlays
 * instead of pulling in a second React runtime.
 *
 * Assets: /decorations/*.svg (hollow center so the avatar shows through).
 */

export const VIP_OVERLAY_FRAMES = {
  "luna-butterflies": "/decorations/luna-butterflies.svg",
  "violet-roses": "/decorations/violet-roses.svg",
  "ember-flame": "/decorations/ember-flame.svg",
  "crystal-halo": "/decorations/crystal-halo.svg",
  "sakura-orbit": "/decorations/sakura-orbit.svg",
  "neon-arcade": "/decorations/neon-arcade.svg",
} as const;

export type VipOverlayId = keyof typeof VIP_OVERLAY_FRAMES;

/** Animated transparent overlay — Discord Nitro / Free4Talk / DecoProfile model. */
export function AvatarFrameOverlay({
  src,
  size,
}: {
  src: string;
  size: number;
}) {
  // Frame is larger than the avatar so ornaments sit outside the face.
  const pad = Math.round(size * 0.38);
  const outer = size + pad * 2;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
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

export function SakuraOrbitFrame({ size }: { size: number }) {
  return <AvatarFrameOverlay src={VIP_OVERLAY_FRAMES["sakura-orbit"]} size={size} />;
}

export function NeonArcadeFrame({ size }: { size: number }) {
  return <AvatarFrameOverlay src={VIP_OVERLAY_FRAMES["neon-arcade"]} size={size} />;
}
