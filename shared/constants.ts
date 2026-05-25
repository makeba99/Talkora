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
} as const;

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
