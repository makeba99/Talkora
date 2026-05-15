// ─── Vextorn Content Moderation Word List ─────────────────────────────────────
// Edit this file to add / remove terms without touching any logic.
// All terms are lowercase. The filter normalises input before matching.
//
// WORD_TERMS  → checked with word boundaries (\b…\b) — won't fire inside
//               legitimate words (e.g. "ass" won't match "class").
// PHRASE_TERMS → multi-word expressions checked as substring after normalisation.

export type FilterCategory = "profanity" | "sexual_content" | "slur" | "hate_speech";

export interface BannedEntry {
  term: string;
  category: FilterCategory;
}

// ── Single words (word-boundary matched) ──────────────────────────────────────
export const WORD_TERMS: BannedEntry[] = [
  // Core profanity
  { term: "fuck",          category: "profanity" },
  { term: "fucker",        category: "profanity" },
  { term: "fucking",       category: "profanity" },
  { term: "fucks",         category: "profanity" },
  { term: "fucked",        category: "profanity" },
  { term: "motherfucker",  category: "profanity" },
  { term: "mf",            category: "profanity" },
  { term: "shit",          category: "profanity" },
  { term: "shitting",      category: "profanity" },
  { term: "shitty",        category: "profanity" },
  { term: "shithead",      category: "profanity" },
  { term: "bullshit",      category: "profanity" },
  { term: "horseshit",     category: "profanity" },
  { term: "bitch",         category: "profanity" },
  { term: "bitching",      category: "profanity" },
  { term: "bitchy",        category: "profanity" },
  { term: "bastard",       category: "profanity" },
  { term: "asshole",       category: "profanity" },
  { term: "assholes",      category: "profanity" },
  { term: "arsehole",      category: "profanity" },
  { term: "douchebag",     category: "profanity" },
  { term: "douche",        category: "profanity" },
  { term: "prick",         category: "profanity" },
  { term: "jackass",       category: "profanity" },
  { term: "wanker",        category: "profanity" },
  { term: "tosser",        category: "profanity" },
  { term: "bollocks",      category: "profanity" },
  { term: "bellend",       category: "profanity" },
  { term: "crap",          category: "profanity" },

  // Sexual / explicit
  { term: "cock",          category: "sexual_content" },
  { term: "cocks",         category: "sexual_content" },
  { term: "dick",          category: "sexual_content" },
  { term: "dicks",         category: "sexual_content" },
  { term: "pussy",         category: "sexual_content" },
  { term: "cunt",          category: "sexual_content" },
  { term: "twat",          category: "sexual_content" },
  { term: "tits",          category: "sexual_content" },
  { term: "titties",       category: "sexual_content" },
  { term: "boobs",         category: "sexual_content" },
  { term: "blowjob",       category: "sexual_content" },
  { term: "handjob",       category: "sexual_content" },
  { term: "masturbate",    category: "sexual_content" },
  { term: "masturbation",  category: "sexual_content" },
  { term: "orgasm",        category: "sexual_content" },
  { term: "ejaculate",     category: "sexual_content" },
  { term: "jizz",          category: "sexual_content" },
  { term: "cum",           category: "sexual_content" },
  { term: "cumshot",       category: "sexual_content" },
  { term: "dildo",         category: "sexual_content" },
  { term: "porn",          category: "sexual_content" },
  { term: "porno",         category: "sexual_content" },
  { term: "pornography",   category: "sexual_content" },
  { term: "xxx",           category: "sexual_content" },
  { term: "onlyfans",      category: "sexual_content" },
  { term: "camgirl",       category: "sexual_content" },
  { term: "camboy",        category: "sexual_content" },
  { term: "prostitute",    category: "sexual_content" },
  { term: "prostitution",  category: "sexual_content" },
  { term: "whore",         category: "sexual_content" },
  { term: "slut",          category: "sexual_content" },
  { term: "hoe",           category: "sexual_content" },
  { term: "hooker",        category: "sexual_content" },
  { term: "skank",         category: "sexual_content" },
  { term: "anal",          category: "sexual_content" },
  { term: "anus",          category: "sexual_content" },

  // Slurs & hate speech
  { term: "nigger",        category: "slur" },
  { term: "nigga",         category: "slur" },
  { term: "faggot",        category: "slur" },
  { term: "fag",           category: "slur" },
  { term: "dyke",          category: "slur" },
  { term: "kike",          category: "slur" },
  { term: "spic",          category: "slur" },
  { term: "chink",         category: "slur" },
  { term: "gook",          category: "slur" },
  { term: "wetback",       category: "slur" },
  { term: "raghead",       category: "slur" },
  { term: "towelhead",     category: "slur" },
  { term: "beaner",        category: "slur" },
  { term: "tranny",        category: "slur" },
  { term: "retard",        category: "slur" },
  { term: "retarded",      category: "slur" },
  { term: "cracker",       category: "slur" },

  // Self-harm abbreviations
  { term: "kys",           category: "hate_speech" },
  { term: "kms",           category: "hate_speech" },
];

// ── Multi-word phrases (substring matched after normalisation) ─────────────────
export const PHRASE_TERMS: BannedEntry[] = [
  { term: "kill yourself",      category: "hate_speech" },
  { term: "kill ur self",       category: "hate_speech" },
  { term: "go kill yourself",   category: "hate_speech" },
  { term: "neck yourself",      category: "hate_speech" },
  { term: "hang yourself",      category: "hate_speech" },
  { term: "go die",             category: "hate_speech" },
  { term: "i will rape",        category: "hate_speech" },
  { term: "i'll rape",          category: "hate_speech" },
  { term: "i will kill you",    category: "hate_speech" },
  { term: "i'll kill you",      category: "hate_speech" },
  { term: "rape you",           category: "hate_speech" },
  { term: "sex tape",           category: "sexual_content" },
  { term: "child porn",         category: "sexual_content" },
  { term: "cp link",            category: "sexual_content" },
  { term: "send nudes",         category: "sexual_content" },
  { term: "show me your",       category: "sexual_content" },
  { term: "mother fucker",      category: "profanity" },
  { term: "son of a bitch",     category: "profanity" },
];

// ── User-facing messages per category ─────────────────────────────────────────
export const CATEGORY_MESSAGES: Record<FilterCategory, string> = {
  profanity:
    "Your content contains language that violates our community guidelines and wasn't sent. Please keep conversations respectful.",
  sexual_content:
    "Your content contains sexually explicit language that violates our community guidelines and wasn't sent.",
  slur:
    "Your content contains a slur or hate speech that violates our community guidelines and wasn't sent. Vextorn is an inclusive space for everyone.",
  hate_speech:
    "Your content contains language that promotes harm or hatred, which violates our community guidelines. It wasn't sent.",
};
