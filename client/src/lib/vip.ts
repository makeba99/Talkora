import { vipRank } from "@shared/constants";
import { isPlatformAdmin, isVipEntitled, normalizeTitleColor } from "@shared/entitlements";

export function isVipUser(user: { vipTier?: string | null; role?: string | null; email?: string | null } | null | undefined): boolean {
  return isVipEntitled(user);
}

export function isAdminUser(user: { role?: string | null; email?: string | null } | null | undefined): boolean {
  return isPlatformAdmin(user);
}

export function vipNameClass(user: { vipTier?: string | null; role?: string | null; email?: string | null } | null | undefined): string {
  if (isPlatformAdmin(user)) {
    return "text-amber-300 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]";
  }
  const rank = vipRank(user?.vipTier);
  if (rank >= 3) return "text-amber-300 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]";
  if (rank >= 2) return "text-fuchsia-300 font-semibold";
  if (rank >= 1) return "text-amber-200/90 font-semibold";
  return "";
}

/** Inline style for custom title color (VIP palette). Returns undefined when unset. */
export function titleColorStyle(
  user: { titleColor?: string | null; vipTier?: string | null; role?: string | null; email?: string | null } | null | undefined,
): { color: string } | undefined {
  const color = normalizeTitleColor(user?.titleColor);
  if (!color) return undefined;
  // Admins / VIP may display custom colors; non-VIP stored colors are ignored for safety.
  if (!isVipEntitled(user)) return undefined;
  return { color };
}
