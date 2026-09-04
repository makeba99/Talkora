/**
 * Single source of truth for crawlable marketing / entity pages.
 * Used by client routes, static sitemap, and production sitemap/robots.
 */
export type SeoStaticPage = {
  path: string;
  /** Title without trailing "| Vextorn" — hook / server add brand when needed. */
  title: string;
  description: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
};

export const SEO_STATIC_PAGES: SeoStaticPage[] = [
  {
    path: "/about",
    title: "About Vextorn — voice rooms for language practice",
    description:
      "Learn what Vextorn is: a free, real-time voice community for language exchange, conversation practice, and meeting people from around the world.",
    changefreq: "monthly",
    priority: "0.85",
  },
  {
    path: "/faq",
    title: "FAQ — language exchange & voice rooms",
    description:
      "Answers about Vextorn: how voice rooms work, languages, safety, free access, AI tutor, teachers, and how it differs from random chat apps.",
    changefreq: "monthly",
    priority: "0.85",
  },
  {
    path: "/contact",
    title: "Contact Vextorn",
    description:
      "Contact the Vextorn team for support, partnerships, or press. Email hello@vextorn.app.",
    changefreq: "yearly",
    priority: "0.5",
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "How Vextorn handles account data, messages, cookies, and retention. We do not sell your data or record voice rooms.",
    changefreq: "yearly",
    priority: "0.4",
  },
  {
    path: "/terms",
    title: "Terms of Service",
    description:
      "Community rules for using Vextorn voice rooms, accounts, and language practice features. Ages 13+.",
    changefreq: "yearly",
    priority: "0.4",
  },
  {
    path: "/language-exchange",
    title: "Language exchange with real people",
    description:
      "Practice languages through live conversation on Vextorn. Join voice rooms by language and level for free language exchange.",
    changefreq: "weekly",
    priority: "0.9",
  },
  {
    path: "/language-exchange/english",
    title: "English language exchange & speaking practice",
    description:
      "Practice English speaking with real people in live Vextorn voice rooms — beginner to advanced conversation partners.",
    changefreq: "weekly",
    priority: "0.85",
  },
  {
    path: "/speaking-practice",
    title: "Online speaking practice",
    description:
      "Build speaking confidence in live voice rooms. Practice conversation with people worldwide — free on Vextorn.",
    changefreq: "weekly",
    priority: "0.9",
  },
  {
    path: "/meet-people-online",
    title: "Meet people online & make international friends",
    description:
      "Meet people from other countries in live voice rooms. A safer, language-focused alternative to random chat.",
    changefreq: "weekly",
    priority: "0.85",
  },
  {
    path: "/alternatives/omegle",
    title: "Omegle alternatives for meeting people & language practice",
    description:
      "Looking for Omegle alternatives? Compare Vextorn’s language-focused voice rooms with random video chat — no affiliation with Omegle.",
    changefreq: "monthly",
    priority: "0.75",
  },
  {
    path: "/alternatives/free4talk",
    title: "Free4Talk alternatives for language practice",
    description:
      "Explore Free4Talk alternatives for speaking practice. See how Vextorn’s live voice rooms compare — independent overview, no affiliation.",
    changefreq: "monthly",
    priority: "0.75",
  },
  {
    path: "/alternatives/hellotalk",
    title: "HelloTalk alternatives for speaking practice",
    description:
      "HelloTalk alternatives focused on live group conversation. Learn how Vextorn voice rooms fit language exchange — no affiliation.",
    changefreq: "monthly",
    priority: "0.75",
  },
];

export const SITE_ORIGIN = "https://vextorn.com";
export const SUPPORT_EMAIL = "hello@vextorn.app";
export const BRAND_NAME = "Vextorn";
export const BRAND_TAGLINE = "Talk. Share. Belong.";
