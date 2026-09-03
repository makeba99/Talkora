import { vipRank } from "@shared/constants";

export function isVipUser(user: { vipTier?: string | null } | null | undefined): boolean {
  return vipRank(user?.vipTier) > 0;
}

export function vipNameClass(user: { vipTier?: string | null } | null | undefined): string {
  const rank = vipRank(user?.vipTier);
  if (rank >= 3) return "text-amber-300 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]";
  if (rank >= 2) return "text-fuchsia-300 font-semibold";
  if (rank >= 1) return "text-amber-200/90 font-semibold";
  return "";
}
