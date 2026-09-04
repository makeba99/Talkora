/**
 * AvatarShell — layout contract for room / lobby / profile customization.
 *
 * Architecture (decoration NEVER drives layout size):
 *
 *   AvatarShell (--avatar-size)
 *     ├── AvatarMedia   (fills shell; hero)
 *     ├── DecorationLayer (absolute, centered, scaled; out of flow)
 *     └── optional Status / Badge slots (absolute overlays)
 *
 * Stacking (local context):
 *   media 10 → decoration 20 → status 30 → badges 40 → controls 50
 */

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  AvatarFrameOverlay,
  VIP_OVERLAY_FRAMES,
  type VipOverlayId,
  getDecorationVisualScale,
  getDecorationBleedPx,
  getMaxDecorationBleedPx,
  type DecorationDensity,
  type DecorationLayoutConfig,
  DECORATION_LAYOUT,
  densityFromSize,
} from "@/components/vip-avatar-frames";

export type { DecorationDensity, DecorationLayoutConfig };

export {
  getDecorationBleedPx,
  getMaxDecorationBleedPx,
  getDecorationVisualScale,
  densityFromSize,
  DECORATION_LAYOUT,
};

/** Map participant count → animation / scale budget. */
export function densityFromParticipantCount(count: number): DecorationDensity {
  if (count >= 17) return "lite";
  if (count >= 9) return "reduced";
  return "full";
}

export type AvatarShellShape = "circle" | "rounded" | "tile";

export interface AvatarShellProps {
  /** Layout size in px — this alone determines the footprint. */
  size: number;
  /** Already-resolved VIP overlay id, or null/none. */
  frameId?: VipOverlayId | null | "none";
  /** Portrait clip: circle (lobby default), rounded squircle, or tile. */
  shape?: AvatarShellShape;
  /** Override auto density (from size). */
  density?: DecorationDensity;
  /** Soften decoration so the avatar stays primary. */
  soft?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Avatar / card content — must fill the shell. */
  children: ReactNode;
  /** Optional absolute overlays (mic, owner badge, etc.) rendered above deco. */
  statusSlot?: ReactNode;
  badgeSlot?: ReactNode;
}

/**
 * Shared shell used by voice-room, lobby cards, and profile decoration picker.
 */
export function AvatarShell({
  size,
  frameId,
  shape,
  density: densityProp,
  soft,
  className,
  style,
  children,
  statusSlot,
  badgeSlot,
}: AvatarShellProps) {
  const hasDeco = !!frameId && frameId !== "none" && frameId in VIP_OVERLAY_FRAMES;
  const id = hasDeco ? (frameId as VipOverlayId) : null;
  const density = densityProp ?? densityFromSize(size);
  const softMode = soft ?? density !== "full";
  const layout = id ? DECORATION_LAYOUT[id] : undefined;
  const visualScale = id ? getDecorationVisualScale(id, density) : 1;
  const bleed = id ? getDecorationBleedPx(size, id, density) : 0;

  const shellStyle: CSSProperties = {
    width: size,
    height: size,
    aspectRatio: "1 / 1",
    position: "relative",
    flexShrink: 0,
    ["--avatar-size" as string]: `${size}px`,
    ["--deco-scale" as string]: String(visualScale),
    ["--deco-bleed" as string]: `${bleed}px`,
    ["--deco-offset-x" as string]: layout ? `${layout.offsetX * 100}%` : "0%",
    ["--deco-offset-y" as string]: layout ? `${layout.offsetY * 100}%` : "0%",
    ...style,
  };

  return (
    <div
      className={cn(
        "avatar-shell",
        hasDeco && "deco-wrap",
        softMode && hasDeco && "deco-wrap--soft",
        density === "lite" && "avatar-shell--lite",
        density === "reduced" && "avatar-shell--reduced",
        className,
      )}
      style={shellStyle}
      data-decoration={id ?? "none"}
      data-density={density}
      {...(shape ? { "data-shape": shape } : {})}
    >
      <div className="avatar-shell__media">{children}</div>

      {id && (
        <div className="avatar-shell__deco" aria-hidden="true">
          <AvatarFrameOverlay
            src={VIP_OVERLAY_FRAMES[id]}
            decorationId={id}
            density={density}
          />
        </div>
      )}

      {statusSlot ? <div className="avatar-shell__status">{statusSlot}</div> : null}
      {badgeSlot ? <div className="avatar-shell__badge">{badgeSlot}</div> : null}
    </div>
  );
}
