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
