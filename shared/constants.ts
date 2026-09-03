/**
 * Pure client-safe constants — no drizzle-orm, drizzle-zod, or zod imports.
 *
 * These are the data arrays / lookup objects that both the server (via
 * shared/schema.ts re-exports) and the client bundle need. Keeping them in a
 * separate file means client code can `import from "@shared/constants"` without
 * pulling in the server-only database schema (drizzle-orm/pg-core, drizzle-zod,
 * zod) — those packages add ~90 kB of unused JS to the client bundle when
 * imported transitively through @shared/schema.
 */

export const TALK_PERMISSIONS = ["everyone", "co_owners", "owner_only", "muted"] as const;
export type TalkPermission = typeof TALK_PERMISSIONS[number];

export const FEATURE_PERMISSIONS = ["everyone", "co_owners", "owner_only"] as const;
export type FeaturePermission = typeof FEATURE_PERMISSIONS[number];

export const BADGE_TYPES = {
  lovely_user: {
    id: "lovely_user",
    label: "Lovely User",
    emoji: "💜",
    color: "#a855f7",
    quote: "Your warmth and kindness make this community a better place.",
  },
  trusted_user: {
    id: "trusted_user",
    label: "Trusted User",
    emoji: "✅",
    color: "#22c55e",
    quote: "Your integrity and reliability have earned the trust of everyone here.",
  },
  platform_best_friend: {
    id: "platform_best_friend",
    label: "Platform Best Friend",
    emoji: "🤝",
    color: "#f59e0b",
    quote: "You've become an irreplaceable part of our family.",
  },
  top_speaker: {
    id: "top_speaker",
    label: "Top Speaker",
    emoji: "🎤",
    color: "#3b82f6",
    quote: "Your voice inspires learners everywhere. Keep speaking!",
  },
  language_champion: {
    id: "language_champion",
    label: "Language Champion",
    emoji: "🏆",
    color: "#f97316",
    quote: "You've shown what true dedication to language learning looks like.",
  },
  community_star: {
    id: "community_star",
    label: "Community Star",
    emoji: "⭐",
    color: "#eab308",
    quote: "You light up our community with your incredible presence.",
  },
  helping_hand: {
    id: "helping_hand",
    label: "Helping Hand",
    emoji: "🙌",
    color: "#06b6d4",
    quote: "Your support and help mean the world to everyone here.",
  },
  rising_star: {
    id: "rising_star",
    label: "Rising Star",
    emoji: "🌟",
    color: "#ec4899",
    quote: "Watch out world — a remarkable new star has risen!",
  },
  platform_legend: {
    id: "platform_legend",
    label: "Platform Nigga",
    emoji: "👑",
    color: "#f59e0b",
    quote: "A real one. Born on this platform, built with this platform.",
  },
  streak_3: {
    id: "streak_3",
    label: "3-Day Streak",
    emoji: "🔥",
    color: "#f97316",
    quote: "Three days in a row! You're building a powerful habit.",
  },
  streak_7: {
    id: "streak_7",
    label: "7-Day Streak",
    emoji: "🔥",
    color: "#ef4444",
    quote: "A full week of dedication! Your consistency is inspiring.",
  },
  streak_14: {
    id: "streak_14",
    label: "14-Day Streak",
    emoji: "⚡",
    color: "#8b5cf6",
    quote: "Two weeks strong! You're an unstoppable force of learning.",
  },
  streak_30: {
    id: "streak_30",
    label: "30-Day Streak",
    emoji: "💎",
    color: "#06b6d4",
    quote: "A month of mastery! You're a true language learning legend.",
  },
  vip_coffee: {
    id: "vip_coffee",
    label: "VIP Coffee",
    emoji: "☕",
    color: "#d97706",
    quote: "You bought the house a coffee. The room is warmer because of you.",
  },
  vip_plus: {
    id: "vip_plus",
    label: "VIP Plus",
    emoji: "✨",
    color: "#a855f7",
    quote: "A true supporter. Your glow is now part of the platform.",
  },
  vip_elite: {
    id: "vip_elite",
    label: "VIP Elite",
    emoji: "👑",
    color: "#f59e0b",
    quote: "Elite VIP. You didn't just join the room — you own the night.",
  },
} as const;

export const VIP_PLANS = [
  {
    id: "coffee" as const,
    amount: 5,
    label: "Coffee",
    tagline: "VIP badge + gold name",
    badgeType: "vip_coffee" as const,
    rank: 1,
  },
  {
    id: "plus" as const,
    amount: 15,
    label: "VIP Plus",
    tagline: "Exclusive rings + lobby boost",
    badgeType: "vip_plus" as const,
    rank: 2,
  },
  {
    id: "elite" as const,
    amount: 25,
    label: "VIP Elite",
    tagline: "Crown glow + top of the lobby",
    badgeType: "vip_elite" as const,
    rank: 3,
  },
] as const;

export type VipPlanId = (typeof VIP_PLANS)[number]["id"];

export function vipPlanFromAmount(amount: number): (typeof VIP_PLANS)[number] | null {
  return VIP_PLANS.find((p) => p.amount === Math.round(amount)) ?? null;
}

export function vipRank(tier: string | null | undefined): number {
  return VIP_PLANS.find((p) => p.id === tier)?.rank ?? 0;
}

export type BadgeType = keyof typeof BADGE_TYPES;

export const FLAG_EMOJI: Record<string, string> = {
  English: "🇬🇧", Spanish: "🇪🇸", French: "🇫🇷", German: "🇩🇪",
  Japanese: "🇯🇵", Chinese: "🇨🇳", Korean: "🇰🇷", Portuguese: "🇧🇷",
  Arabic: "🇸🇦", Hindi: "🇮🇳", Russian: "🇷🇺", Italian: "🇮🇹",
  Dutch: "🇳🇱", Turkish: "🇹🇷", Polish: "🇵🇱", Swedish: "🇸🇪",
  Norwegian: "🇳🇴", Danish: "🇩🇰", Finnish: "🇫🇮", Greek: "🇬🇷",
  Hebrew: "🇮🇱", Ukrainian: "🇺🇦", Romanian: "🇷🇴", Hungarian: "🇭🇺",
  Armenian: "🇦🇲", Indonesian: "🇮🇩",
};

// ISO 3166-1 alpha-2 country codes for flagcdn.com image lookup.
// Kept in sync with FLAG_EMOJI above. Used instead of Unicode regional
// indicator emoji because flag emoji do not render as flag images on
// Windows (they appear as two-letter codes: "GB", "ES", etc.).
export const LANGUAGE_COUNTRY_CODE: Record<string, string> = {
  English: "gb",   Spanish: "es",   French: "fr",    German: "de",
  Japanese: "jp",  Chinese: "cn",   Korean: "kr",    Portuguese: "br",
  Arabic: "sa",    Hindi: "in",     Russian: "ru",   Italian: "it",
  Dutch: "nl",     Turkish: "tr",   Polish: "pl",    Swedish: "se",
  Norwegian: "no", Danish: "dk",    Finnish: "fi",   Greek: "gr",
  Hebrew: "il",    Ukrainian: "ua", Romanian: "ro",  Hungarian: "hu",
  Armenian: "am",  Indonesian: "id",
};

export const LANGUAGES = [
  "All",
  "English",
  "Spanish",
  "French",
  "German",
  "Hindi",
  "Arabic",
  "Armenian",
  "Indonesian",
  "Japanese",
  "Korean",
  "Portuguese",
  "Chinese",
] as const;

export const LEVELS = ["Beginner", "Intermediate", "Advanced", "Native"] as const;

export const SPECIALIZATIONS = [
  "General Conversation",
  "Business English",
  "Grammar",
  "Pronunciation",
  "Exam Preparation",
  "Writing",
  "Reading",
  "Listening",
  "Travel",
  "Academic",
  "Children",
  "Slang & Casual",
] as const;

/** Celebration GIF shown platform-wide when a badge is awarded (Tenor, proxy-friendly). */
export const BADGE_CELEBRATION_GIF =
  "https://media.tenor.com/YGF4qF2FeX8AAAAC/congratulations-congrats.gif";

/** Coffee / VIP shoutout flair GIF shown in every live room chat. */
export const VIP_SHOUTOUT_GIF =
  "https://media.tenor.com/6kRT-b0nXwYAAAAC/coffee-love.gif";

/** Max VIP coffee shoutouts per user per rolling 24h. */
export const VIP_SHOUTOUT_DAILY_LIMIT = 3;
