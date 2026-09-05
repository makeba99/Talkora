import { Mic, MicOff, Plus, Crown } from "lucide-react";
import { SquareProfileDecoration } from "@/components/square-profile-decoration";
import { resolveSquareProfileStyle } from "@/lib/square-profile-style";
import { BADGE_TYPES } from "@shared/constants";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import type { User, UserBadge } from "@shared/schema";

function buildAvatarSources(url: string | null | undefined): {
  src: string | undefined;
  srcSet?: string;
} {
  if (!url) return { src: undefined };
  const m = url.match(
    /^(https?:\/\/randomuser\.me\/api\/portraits\/)(men|women)(\/\d+\.jpg)$/,
  );
  if (m) {
    const [, base, gender, file] = m;
    const med = `${base}med/${gender}${file}`;
    const full = `${base}${gender}${file}`;
    return { src: med, srcSet: `${med} 1x, ${full} 2x` };
  }
  return { src: url };
}

function compactName(full: string): string {
  const first = full.trim().split(/\s+/)[0];
  return first || full;
}

export function RoomUserProfile({
  participant,
  size,
  badges = [],
  isHost = false,
  isSpeaking = false,
  isMuted = false,
}: {
  participant: User;
  size: number;
  badges?: UserBadge[];
  isHost?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
}) {
  const fullName = getUserDisplayName(participant);
  const name = compactName(fullName);
  const deco = resolveSquareProfileStyle((participant as any).profileDecoration);
  const sources = buildAvatarSources(participant.profileImageUrl);
  const state = isSpeaking ? "speaking" : isMuted ? "muted" : "idle";
  const pipDef = badges[0]
    ? BADGE_TYPES[badges[0].badgeType as keyof typeof BADGE_TYPES]
    : undefined;

  return (
    <div
      className="rup"
      data-deco={deco}
      data-state={state}
      style={{ ["--rup-size" as string]: `${size}px` }}
    >
      <SquareProfileDecoration styleId={deco} />
      <div className="rup__card">
        {sources.src ? (
          <img
            src={sources.src}
            srcSet={sources.srcSet}
            alt=""
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            className="rup__media"
          />
        ) : (
          <div className="rup__fallback" aria-hidden="true">
            {getUserInitials(participant)}
          </div>
        )}
        <div className="rup__veil">
          <span className="rup__name" title={fullName}>{name}</span>
          {isSpeaking && <Mic className="rup__veil-mic" aria-hidden="true" />}
        </div>
      </div>

      {isHost && (
        <span className="rup__pip rup__pip--host" title="Host" aria-label="Host">
          <Crown />
        </span>
      )}
      {isMuted && !isSpeaking && (
        <span className="rup__pip rup__pip--muted" title="Muted" aria-label="Muted">
          <MicOff />
        </span>
      )}
      {pipDef && (
        <span className="rup__ach" title={pipDef.label} data-testid={`badges-lobby-${participant.id}`}>
          {pipDef.emoji}
        </span>
      )}
    </div>
  );
}

export function RoomUserEmptySlot({ size }: { size: number }) {
  return (
    <div className="rup rup--empty" style={{ ["--rup-size" as string]: `${size}px` }} aria-hidden="true">
      <div className="rup__card">
        <Plus className="rup__plus" />
      </div>
    </div>
  );
}

/** Tiny picker swatch — CSS-only so settings don't need the SVG overlay bundle. */
export function SquareStyleSwatch({
  styleId,
  size = 40,
}: {
  styleId: string;
  size?: number;
}) {
  return (
    <div
      className="rup rup--swatch"
      data-deco={styleId}
      style={{ ["--rup-size" as string]: `${size}px`, width: size, height: size }}
    >
      <SquareProfileDecoration styleId={styleId} />
      <div className="rup__card">
        <div className="rup__fallback" style={{ fontSize: 11 }}>Aa</div>
      </div>
    </div>
  );
}
