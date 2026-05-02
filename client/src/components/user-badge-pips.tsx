import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BADGE_TYPES } from "@shared/schema";
import type { UserBadge } from "@shared/schema";

export function UserBadgePips({
  badges = [],
  userId,
  compact = false,
}: {
  badges?: UserBadge[];
  userId?: string;
  compact?: boolean;
}) {
  if (!badges.length) return null;
  const displayed = badges.slice(0, compact ? 2 : 4);
  return (
    <div className={`flex items-center justify-center gap-0.5 ${compact ? "mt-0" : "mt-0.5"}`} data-testid={`badges-user-${userId || "unknown"}`}>
      {displayed.map((badge) => {
        const def = BADGE_TYPES[badge.badgeType as keyof typeof BADGE_TYPES];
        if (!def) return null;
        return (
          <Tooltip key={badge.id}>
            <TooltipTrigger asChild>
              <span
                className={`${compact ? "text-[10px] w-4 h-4" : "text-[12px] w-5 h-5"} inline-flex items-center justify-center rounded-full border shadow-sm cursor-default`}
                style={{
                  background: `${def.color}22`,
                  borderColor: `${def.color}66`,
                  boxShadow: `0 0 10px ${def.color}24`,
                }}
                data-testid={`badge-pip-${badge.id}`}
              >
                {def.emoji}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {def.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {badges.length > displayed.length && (
        <span className="text-[9px] text-white/50 font-semibold" data-testid={`text-badge-more-${userId || "unknown"}`}>
          +{badges.length - displayed.length}
        </span>
      )}
    </div>
  );
}