/**
 * Central feature entitlements — single source of truth for VIP / admin / limits.
 * Frontend may mirror these for UX; backend MUST enforce the same helpers.
 */

import { vipRank } from "./constants";

export type AppFeature =
  | "talking_ai"
  | "ai_voice"
  | "title_color"
  | "vip_rings"
  | "profile_premium"
  | "vip_shoutout";

export type EntitlementUser = {
  id?: string;
  role?: string | null;
  email?: string | null;
  vipTier?: string | null;
};

const SUPER_ADMIN_EMAIL = "dj55jggg@gmail.com";

/** Non-VIP daily Talking AI message budget (server-enforced). */
export const TALKING_AI_FREE_DAILY_LIMIT = 20;

export function isPlatformAdmin(user: EntitlementUser | null | undefined): boolean {
  if (!user) return false;
  if (user.email === SUPER_ADMIN_EMAIL) return true;
  return user.role === "admin" || user.role === "superadmin";
}

export function isVipEntitled(user: EntitlementUser | null | undefined): boolean {
  if (isPlatformAdmin(user)) return true;
  return vipRank(user?.vipTier) > 0;
}

export function canUseFeature(
  user: EntitlementUser | null | undefined,
  feature: AppFeature,
): boolean {
  if (isPlatformAdmin(user)) return true;
  switch (feature) {
    case "talking_ai":
      return true; // everyone can try; usage limit applied separately
    case "ai_voice":
      return true; // voice follows talking_ai session; limit is on messages
    case "title_color":
    case "vip_rings":
    case "profile_premium":
    case "vip_shoutout":
      return isVipEntitled(user);
    default:
      return false;
  }
}

export function talkingAiDailyLimit(user: EntitlementUser | null | undefined): number | null {
  if (isPlatformAdmin(user) || isVipEntitled(user)) return null; // unlimited
  return TALKING_AI_FREE_DAILY_LIMIT;
}

/** Safe preset title colors (no arbitrary CSS injection). */
export const TITLE_COLOR_PALETTE = [
  { id: "default", label: "Default", value: "" },
  { id: "amber", label: "Amber", value: "#fbbf24" },
  { id: "rose", label: "Rose", value: "#fb7185" },
  { id: "violet", label: "Violet", value: "#a78bfa" },
  { id: "sky", label: "Sky", value: "#38bdf8" },
  { id: "emerald", label: "Emerald", value: "#34d399" },
  { id: "orange", label: "Orange", value: "#fb923c" },
  { id: "pink", label: "Pink", value: "#f472b6" },
] as const;

export function normalizeTitleColor(raw: string | null | undefined): string | null {
  if (raw == null || raw === "" || raw === "default") return null;
  const match = TITLE_COLOR_PALETTE.find((c) => c.value === raw || c.id === raw);
  return match && match.value ? match.value : null;
}
