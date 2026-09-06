import { Mic, MicOff, Plus, Crown, Heart } from "lucide-react";
import {
  AvatarFrameOverlay,
  VIP_OVERLAY_FRAMES,
  densityFromSize,
} from "@/components/vip-avatar-frames";
import { isVipOverlayDecoration } from "@/lib/square-profile-style";
import { getAvatarRingClass } from "@/lib/avatar-ring";
import { BADGE_TYPES } from "@shared/constants";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";
import type { User, UserBadge } from "@shared/schema";

function formatFollowerCount(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}m`;
  }
  if (n >= 1000) {
    const v = n / 1000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}k`;
  }
  return String(n);
}

function heartTone(n: number): "quiet" | "warm" | "hot" | "gold" {
  if (n >= 300) return "gold";
  if (n >= 100) return "hot";
  if (n >= 1) return "warm";
  return "quiet";
}

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
  followerCount,
  showName = false,
}: {
  participant: User;
  size: number;
  badges?: UserBadge[];
  isHost?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  followerCount?: number;
  showName?: boolean;
}) {
  const fullName = getUserDisplayName(participant);
  const name = compactName(fullName);
  const rawDeco = (participant as any).profileDecoration as string | null | undefined;
  const overlayId = isVipOverlayDecoration(rawDeco) ? rawDeco : null;
  const sources = buildAvatarSources(participant.profileImageUrl);
  const state = isSpeaking ? "speaking" : isMuted ? "muted" : "idle";
  const pipDef = badges[0]
    ? BADGE_TYPES[badges[0].badgeType as keyof typeof BADGE_TYPES]
    : undefined;
  const showFollowers = typeof followerCount === "number";
  const tone = heartTone(followerCount ?? 0);
  const ringId = (participant as any).avatarRing as string | null | undefined;
  const ringClass = getAvatarRingClass(ringId);
  const hasRing = !!ringClass;

  return (
    <div
      className="rup"
      data-state={state}
      data-heart={tone}
      data-overlay={overlayId ? "1" : undefined}
      data-named={showName ? "1" : undefined}
      data-ring={hasRing ? ringId : undefined}
      style={{
        ["--rup-size" as string]: `${size}px`,
        ["--avatar-size" as string]: `${size}px`,
      }}
    >
      <div className="rup__stage">
        <div className={`rup__card${hasRing ? ` ${ringClass}` : ""}`}>
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
        </div>
        {overlayId && (
          <AvatarFrameOverlay
            src={VIP_OVERLAY_FRAMES[overlayId]}
            decorationId={overlayId}
            density={densityFromSize(size)}
          />
        )}
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
        {isSpeaking && (
          <span className="rup__pip rup__pip--speak" title="Speaking" aria-label="Speaking">
            <Mic />
          </span>
        )}
        {pipDef && (
          <span className="rup__ach" title={pipDef.label} data-testid={`badges-lobby-${participant.id}`}>
            {pipDef.emoji}
          </span>
        )}
        {showName && (
          <span className="rup__name" title={fullName}>{name}</span>
        )}
      </div>
      {showFollowers && (
        <span className="rup__hearts" title={`${followerCount} followers`}>
          <Heart
            className="rup__heart"
            aria-hidden="true"
            fill={(followerCount ?? 0) > 0 ? "currentColor" : "none"}
          />
          <span className="rup__heart-n">{formatFollowerCount(followerCount)}</span>
        </span>
      )}
    </div>
  );
}

export function RoomUserEmptySlot({ size }: { size: number }) {
  return (
    <div className="rup rup--empty" style={{ ["--rup-size" as string]: `${size}px` }} aria-hidden="true">
      <div className="rup__stage">
        <div className="rup__card">
          <Plus className="rup__plus" />
        </div>
      </div>
      <span className="rup__hearts rup__hearts--spacer" />
    </div>
  );
}
