// ─── Grammar Check Engine ────────────────────────────────────────────────────
// Pure client-side, zero-latency (regex, <2ms). Returns ALL suggestions ranked
// by severity so the UI can show the most important ones first.

export type SuggestionSeverity = "error" | "warning" | "style";
export type SuggestionCategory =
  | "grammar"
  | "apostrophe"
  | "capitalization"
  | "spelling"
  | "punctuation"
  | "word-choice"
  | "clarity"
  | "tone";

export type GrammarSuggestion = {
  id: string;
  original: string;
  corrected: string;
  message: string;
  category: SuggestionCategory;
  severity: SuggestionSeverity;
};

const SEVERITY_ORDER: Record<SuggestionSeverity, number> = { error: 0, warning: 1, style: 2 };

type Rule = {
  id: string;
  pattern: RegExp;
  replacement: string;
  message: string;
  category: SuggestionCategory;
  severity: SuggestionSeverity;
};

// ─── Rule Definitions ────────────────────────────────────────────────────────
const RULES: Rule[] = [
  // ── Homophones & Confusion Errors (error) ───────────────────────────────
  { id: "your-welcome",     pattern: /\byour welcome\b/gi,                                    replacement: "you're welcome",   message: '"your" should be "you\'re"',           category: "grammar",       severity: "error" },
  { id: "their-there-v",    pattern: /\btheir (is|are|was|were)\b/gi,                         replacement: "there $1",         message: '"their" should be "there"',            category: "grammar",       severity: "error" },
  { id: "there-their-n",    pattern: /\bthere (car|house|dog|cat|phone|bag|shirt|friend|family|room|place|stuff|things|money|kids|children|team|job|work)\b/gi, replacement: "their $1", message: '"there" should be "their"', category: "grammar", severity: "error" },
  { id: "there-theyre",     pattern: /\bthere going\b/gi,                                     replacement: "they're going",    message: '"there" should be "they\'re"',          category: "grammar",       severity: "error" },
  { id: "its-apostrophe",   pattern: /\bits a\b/gi,                                           replacement: "it's a",           message: '"its" should be "it\'s"',              category: "grammar",       severity: "error" },
  { id: "your-youre-adj",   pattern: /\byour (going|coming|right|wrong|sure|crazy|kidding|joking)\b/gi, replacement: "you're $1", message: '"your" should be "you\'re"',   category: "grammar",       severity: "error" },
  { id: "to-too-adj",       pattern: /\bto (much|many|late|early|fast|slow|loud|quiet|big|small|long|short|hot|cold|far|close)\b/gi, replacement: "too $1", message: '"to" should be "too"', category: "grammar", severity: "error" },
  { id: "better-then",      pattern: /\bbetter then\b/gi,                                     replacement: "better than",      message: '"then" should be "than" for comparisons', category: "grammar",   severity: "error" },
  { id: "should-of",        pattern: /\bshould of\b/gi,                                       replacement: "should have",      message: '"should of" → "should have"',          category: "grammar",       severity: "error" },
  { id: "could-of",         pattern: /\bcould of\b/gi,                                        replacement: "could have",       message: '"could of" → "could have"',            category: "grammar",       severity: "error" },
  { id: "would-of",         pattern: /\bwould of\b/gi,                                        replacement: "would have",       message: '"would of" → "would have"',            category: "grammar",       severity: "error" },
  { id: "must-of",          pattern: /\bmust of\b/gi,                                         replacement: "must have",        message: '"must of" → "must have"',              category: "grammar",       severity: "error" },
  { id: "might-of",         pattern: /\bmight of\b/gi,                                        replacement: "might have",       message: '"might of" → "might have"',            category: "grammar",       severity: "error" },
  { id: "less-fewer",       pattern: /\bless (people|items|things|words|options|choices|steps|points|details|examples)\b/gi, replacement: "fewer $1", message: 'Use "fewer" for countable nouns', category: "word-choice", severity: "warning" },
  { id: "play-good",        pattern: /\b(play|speak|write|draw|sing|dance|cook|work|sleep|run|swim) good\b/gi, replacement: "$1 well", message: 'Use "well" (adverb) not "good" after verbs', category: "grammar", severity: "error" },

  // ── Missing Apostrophes (error) ──────────────────────────────────────────
  { id: "dont",             pattern: /\bdont\b/gi,                                            replacement: "don't",            message: 'Missing apostrophe: "dont" → "don\'t"', category: "apostrophe",    severity: "error" },
  { id: "cant",             pattern: /\bcant\b/gi,                                            replacement: "can't",            message: 'Missing apostrophe: "cant" → "can\'t"', category: "apostrophe",    severity: "error" },
  { id: "wont",             pattern: /\bwont\b/gi,                                            replacement: "won't",            message: 'Missing apostrophe: "wont" → "won\'t"', category: "apostrophe",    severity: "error" },
  { id: "wasnt",            pattern: /\bwasnt\b/gi,                                           replacement: "wasn't",           message: 'Missing apostrophe: "wasnt" → "wasn\'t"', category: "apostrophe",  severity: "error" },
  { id: "isnt",             pattern: /\bisnt\b/gi,                                            replacement: "isn't",            message: 'Missing apostrophe: "isnt" → "isn\'t"', category: "apostrophe",    severity: "error" },
  { id: "didnt",            pattern: /\bdidnt\b/gi,                                           replacement: "didn't",           message: 'Missing apostrophe: "didnt" → "didn\'t"', category: "apostrophe",  severity: "error" },
  { id: "couldnt",          pattern: /\bcouldnt\b/gi,                                         replacement: "couldn't",         message: 'Missing apostrophe: "couldnt" → "couldn\'t"', category: "apostrophe", severity: "error" },
  { id: "wouldnt",          pattern: /\bwouldnt\b/gi,                                         replacement: "wouldn't",         message: 'Missing apostrophe: "wouldnt" → "wouldn\'t"', category: "apostrophe", severity: "error" },
  { id: "shouldnt",         pattern: /\bshouldnt\b/gi,                                        replacement: "shouldn't",        message: 'Missing apostrophe: "shouldnt" → "shouldn\'t"', category: "apostrophe", severity: "error" },
  { id: "havent",           pattern: /\bhavent\b/gi,                                          replacement: "haven't",          message: 'Missing apostrophe: "havent" → "haven\'t"', category: "apostrophe",  severity: "error" },
  { id: "hasnt",            pattern: /\bhasnt\b/gi,                                           replacement: "hasn't",           message: 'Missing apostrophe: "hasnt" → "hasn\'t"', category: "apostrophe",   severity: "error" },
  { id: "hadnt",            pattern: /\bhadnt\b/gi,                                           replacement: "hadn't",           message: 'Missing apostrophe: "hadnt" → "hadn\'t"', category: "apostrophe",   severity: "error" },
  { id: "arent",            pattern: /\barent\b/gi,                                           replacement: "aren't",           message: 'Missing apostrophe: "arent" → "aren\'t"', category: "apostrophe",   severity: "error" },
  { id: "werent",           pattern: /\bwerent\b/gi,                                          replacement: "weren't",          message: 'Missing apostrophe: "werent" → "weren\'t"', category: "apostrophe",  severity: "error" },
  { id: "doesnt",           pattern: /\bdoesnt\b/gi,                                          replacement: "doesn't",          message: 'Missing apostrophe: "doesnt" → "doesn\'t"', category: "apostrophe",  severity: "error" },
  { id: "im",               pattern: /\bim\b/gi,                                              replacement: "I'm",              message: '"im" → "I\'m"',                        category: "apostrophe",    severity: "error" },
  { id: "whos",             pattern: /\bwhos\b/gi,                                            replacement: "who's",            message: '"whos" → "who\'s"',                    category: "apostrophe",    severity: "error" },
  { id: "thats",            pattern: /\bthats\b/gi,                                           replacement: "that's",           message: '"thats" → "that\'s"',                  category: "apostrophe",    severity: "error" },
  { id: "whats",            pattern: /\bwhats\b/gi,                                           replacement: "what's",           message: '"whats" → "what\'s"',                  category: "apostrophe",    severity: "error" },
  { id: "its-going",        pattern: /\bits (going|getting|been|happening|okay|fine|good|bad|great|amazing|terrible|working|not)\b/gi, replacement: "it's $1", message: '"its" → "it\'s"', category: "apostrophe", severity: "error" },
  { id: "lets-go",          pattern: /\blets (go|do|try|see|check|start|begin|make)\b/gi,     replacement: "let's $1",         message: '"lets" → "let\'s"',                    category: "apostrophe",    severity: "error" },
  { id: "theyre",           pattern: /\btheyre\b/gi,                                          replacement: "they're",          message: '"theyre" → "they\'re"',                category: "apostrophe",    severity: "error" },
  { id: "youre",            pattern: /\byoure\b/gi,                                           replacement: "you're",           message: '"youre" → "you\'re"',                  category: "apostrophe",    severity: "error" },
  { id: "were-contraction", pattern: /\bwere (going|planning|trying|hoping|thinking|expecting|waiting)\b/gi, replacement: "we're $1", message: '"were" → "we\'re" (contraction)', category: "apostrophe", severity: "warning" },

  // ── Capitalization (error) ───────────────────────────────────────────────
  { id: "i-lowercase",      pattern: /\bi\b(?=[ ,.'!?—–]|\s+[a-z])/g,                        replacement: "I",                message: 'Lowercase "i" should be "I"',          category: "capitalization", severity: "error" },
  { id: "im-cap",           pattern: /\bi'm\b/gi,                                             replacement: "I'm",              message: '"i\'m" → "I\'m"',                      category: "capitalization", severity: "error" },
  { id: "ive-cap",          pattern: /\bi've\b/gi,                                            replacement: "I've",             message: '"i\'ve" → "I\'ve"',                    category: "capitalization", severity: "error" },
  { id: "ill-cap",          pattern: /\bi'll\b/gi,                                            replacement: "I'll",             message: '"i\'ll" → "I\'ll"',                    category: "capitalization", severity: "error" },
  { id: "id-cap",           pattern: /\bi'd\b/gi,                                             replacement: "I'd",              message: '"i\'d" → "I\'d"',                      category: "capitalization", severity: "error" },
  { id: "i-was",            pattern: /\bi was\b/gi,                                           replacement: "I was",            message: '"i" → "I"',                            category: "capitalization", severity: "error" },
  { id: "i-am",             pattern: /\bi am\b/gi,                                            replacement: "I am",             message: '"i am" → "I am"',                      category: "capitalization", severity: "error" },
  { id: "i-verb",           pattern: /\bi (think|know|feel|believe|guess|hope|wish|mean|need|want|have|got)\b/gi, replacement: "I $1", message: '"i" → "I"', category: "capitalization", severity: "error" },

  // ── Common Misspellings (error) ──────────────────────────────────────────
  { id: "alot",             pattern: /\balot\b/gi,                                            replacement: "a lot",            message: '"alot" is not a word — use "a lot"',   category: "spelling",       severity: "error" },
  { id: "definately",       pattern: /\bdefinately\b/gi,                                      replacement: "definitely",       message: '"definately" → "definitely"',          category: "spelling",       severity: "error" },
  { id: "recieve",          pattern: /\brecieve\b/gi,                                         replacement: "receive",          message: '"recieve" → "receive"',                category: "spelling",       severity: "error" },
  { id: "occured",          pattern: /\boccured\b/gi,                                         replacement: "occurred",         message: '"occured" → "occurred"',               category: "spelling",       severity: "error" },
  { id: "seperate",         pattern: /\bseperate\b/gi,                                        replacement: "separate",         message: '"seperate" → "separate"',              category: "spelling",       severity: "error" },
  { id: "independant",      pattern: /\bindependant\b/gi,                                     replacement: "independent",      message: '"independant" → "independent"',        category: "spelling",       severity: "error" },
  { id: "tommorrow",        pattern: /\btommorrow\b/gi,                                       replacement: "tomorrow",         message: '"tommorrow" → "tomorrow"',             category: "spelling",       severity: "error" },
  { id: "tomorow",          pattern: /\btomorow\b/gi,                                         replacement: "tomorrow",         message: '"tomorow" → "tomorrow"',               category: "spelling",       severity: "error" },
  { id: "untill",           pattern: /\buntill\b/gi,                                          replacement: "until",            message: '"untill" → "until"',                   category: "spelling",       severity: "error" },
  { id: "beleive",          pattern: /\bbeleive\b/gi,                                         replacement: "believe",          message: '"beleive" → "believe"',                category: "spelling",       severity: "error" },
  { id: "wierd",            pattern: /\bwierd\b/gi,                                           replacement: "weird",            message: '"wierd" → "weird"',                    category: "spelling",       severity: "error" },
  { id: "freind",           pattern: /\bfreind\b/gi,                                          replacement: "friend",           message: '"freind" → "friend"',                  category: "spelling",       severity: "error" },
  { id: "knowlege",         pattern: /\bknowlege\b/gi,                                        replacement: "knowledge",        message: '"knowlege" → "knowledge"',             category: "spelling",       severity: "error" },
  { id: "excercise",        pattern: /\bexcercise\b/gi,                                       replacement: "exercise",         message: '"excercise" → "exercise"',             category: "spelling",       severity: "error" },
  { id: "enviroment",       pattern: /\benviroment\b/gi,                                      replacement: "environment",      message: '"enviroment" → "environment"',         category: "spelling",       severity: "error" },
  { id: "goverment",        pattern: /\bgoverment\b/gi,                                       replacement: "government",       message: '"goverment" → "government"',           category: "spelling",       severity: "error" },
  { id: "experiance",       pattern: /\bexperiance\b/gi,                                      replacement: "experience",       message: '"experiance" → "experience"',          category: "spelling",       severity: "error" },
  { id: "becuase",          pattern: /\bbecuase\b/gi,                                         replacement: "because",          message: '"becuase" → "because"',                category: "spelling",       severity: "error" },
  { id: "becouse",          pattern: /\bbecouse\b/gi,                                         replacement: "because",          message: '"becouse" → "because"',                category: "spelling",       severity: "error" },
  { id: "languge",          pattern: /\blanguge\b/gi,                                         replacement: "language",         message: '"languge" → "language"',               category: "spelling",       severity: "error" },
  { id: "grammer",          pattern: /\bgrammer\b/gi,                                         replacement: "grammar",          message: '"grammer" → "grammar"',                category: "spelling",       severity: "error" },
  { id: "accross",          pattern: /\baccross\b/gi,                                         replacement: "across",           message: '"accross" → "across"',                 category: "spelling",       severity: "error" },
  { id: "begining",         pattern: /\bbegining\b/gi,                                        replacement: "beginning",        message: '"begining" → "beginning"',             category: "spelling",       severity: "error" },
  { id: "writting",         pattern: /\bwritting\b/gi,                                        replacement: "writing",          message: '"writting" → "writing"',               category: "spelling",       severity: "error" },
  { id: "studing",          pattern: /\bstuding\b/gi,                                         replacement: "studying",         message: '"studing" → "studying"',               category: "spelling",       severity: "error" },
  { id: "lisening",         pattern: /\blisening\b/gi,                                        replacement: "listening",        message: '"lisening" → "listening"',             category: "spelling",       severity: "error" },
  { id: "speach",           pattern: /\bspeach\b/gi,                                          replacement: "speech",           message: '"speach" → "speech"',                  category: "spelling",       severity: "error" },
  { id: "pronounciation",   pattern: /\bpronounciation\b/gi,                                  replacement: "pronunciation",    message: '"pronounciation" → "pronunciation"',   category: "spelling",       severity: "error" },
  { id: "nobody",           pattern: /\bno body\b/gi,                                         replacement: "nobody",           message: '"no body" → "nobody"',                 category: "spelling",       severity: "warning" },
  { id: "sometimes",        pattern: /\bsome times\b/gi,                                      replacement: "sometimes",        message: '"some times" → "sometimes"',           category: "spelling",       severity: "warning" },
  { id: "awhile",           pattern: /\bawhile ago\b/gi,                                      replacement: "a while ago",      message: '"awhile" → "a while" after ago',       category: "spelling",       severity: "warning" },

  // ── Punctuation (warning) ────────────────────────────────────────────────
  { id: "comma-space",      pattern: /,([^ \n'"])/g,                                          replacement: ", $1",             message: "Add space after comma",                category: "punctuation",    severity: "warning" },
  { id: "period-space",     pattern: /\.([A-Z])/g,                                            replacement: ". $1",             message: "Add space after period",               category: "punctuation",    severity: "warning" },
  { id: "double-space",     pattern: /  +/g,                                                  replacement: " ",                message: "Extra space detected",                 category: "punctuation",    severity: "warning" },
  { id: "question-space",   pattern: /\?([A-Za-z])/g,                                         replacement: "? $1",             message: "Add space after question mark",        category: "punctuation",    severity: "warning" },
  { id: "exclaim-space",    pattern: /!([A-Za-z])/g,                                          replacement: "! $1",             message: "Add space after exclamation mark",     category: "punctuation",    severity: "warning" },
  { id: "triple-period",    pattern: /\.{4,}/g,                                               replacement: "...",              message: "Use exactly three dots for ellipsis",  category: "punctuation",    severity: "warning" },
  { id: "multi-exclaim",    pattern: /!{3,}/g,                                                replacement: "!",                message: "Avoid multiple exclamation marks",      category: "punctuation",    severity: "style" },
  { id: "multi-question",   pattern: /\?{2,}/g,                                               replacement: "?",                message: "Avoid multiple question marks",         category: "punctuation",    severity: "style" },

  // ── Word Choice / Clarity (style) ─────────────────────────────────────────
  { id: "very-very",        pattern: /\bvery very\b/gi,                                       replacement: "very",             message: 'Redundant "very very"',                 category: "clarity",        severity: "style" },
  { id: "in-order-to",      pattern: /\bin order to\b/gi,                                     replacement: "to",               message: '"In order to" → simpler "to"',         category: "clarity",        severity: "style" },
  { id: "due-to-fact",      pattern: /\bdue to the fact that\b/gi,                            replacement: "because",          message: '"Due to the fact that" → "because"',   category: "clarity",        severity: "style" },
  { id: "at-this-point",    pattern: /\bat this point in time\b/gi,                           replacement: "now",              message: '"At this point in time" → "now"',      category: "clarity",        severity: "style" },
  { id: "each-and-every",   pattern: /\beach and every\b/gi,                                  replacement: "every",            message: '"Each and every" → just "every"',      category: "clarity",        severity: "style" },
  { id: "end-result",       pattern: /\bend result\b/gi,                                      replacement: "result",           message: '"End result" is redundant',            category: "clarity",        severity: "style" },
  { id: "past-history",     pattern: /\bpast history\b/gi,                                    replacement: "history",          message: '"Past history" is redundant',          category: "clarity",        severity: "style" },
  { id: "free-gift",        pattern: /\bfree gift\b/gi,                                       replacement: "gift",             message: '"Free gift" is redundant',             category: "clarity",        severity: "style" },
  { id: "close-proximity",  pattern: /\bclose proximity\b/gi,                                 replacement: "proximity",        message: '"Close proximity" is redundant',        category: "clarity",        severity: "style" },
  { id: "utilize",          pattern: /\butilize\b/gi,                                          replacement: "use",              message: '"Utilize" → simpler "use"',             category: "word-choice",    severity: "style" },
  { id: "commence",         pattern: /\bcommence\b/gi,                                        replacement: "start",            message: '"Commence" → simpler "start"',          category: "word-choice",    severity: "style" },
  { id: "obtain",           pattern: /\bobtain\b/gi,                                          replacement: "get",              message: '"Obtain" → simpler "get"',              category: "word-choice",    severity: "style" },
];

// ─── Severity colour metadata used by the UI ─────────────────────────────────
export const CATEGORY_META: Record<SuggestionCategory, { label: string; color: string; bg: string }> = {
  grammar:        { label: "Grammar",       color: "rgb(248,113,113)",   bg: "rgba(248,113,113,0.12)"  },
  apostrophe:     { label: "Apostrophe",    color: "rgb(251,146,60)",    bg: "rgba(251,146,60,0.12)"   },
  capitalization: { label: "Capital",       color: "rgb(250,204,21)",    bg: "rgba(250,204,21,0.10)"   },
  spelling:       { label: "Spelling",      color: "rgb(248,113,113)",   bg: "rgba(248,113,113,0.12)"  },
  punctuation:    { label: "Punctuation",   color: "rgb(251,146,60)",    bg: "rgba(251,146,60,0.10)"   },
  "word-choice":  { label: "Word Choice",   color: "rgb(129,140,248)",   bg: "rgba(129,140,248,0.12)"  },
  clarity:        { label: "Clarity",       color: "rgb(52,211,153)",    bg: "rgba(52,211,153,0.10)"   },
  tone:           { label: "Tone",          color: "rgb(167,139,250)",   bg: "rgba(167,139,250,0.12)"  },
};

export const SEVERITY_META: Record<SuggestionSeverity, { label: string; dot: string }> = {
  error:   { label: "Error",   dot: "bg-red-400"    },
  warning: { label: "Warning", dot: "bg-amber-400"  },
  style:   { label: "Style",   dot: "bg-indigo-400" },
};

// ─── Core: return ALL matching suggestions, de-duplicated, severity-ranked ────
export function checkGrammarAll(text: string): GrammarSuggestion[] {
  const trimmed = text.trim();
  if (trimmed.length < 3) return [];

  const seen = new Set<string>();
  const results: GrammarSuggestion[] = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    if (!rule.pattern.test(trimmed)) {
      rule.pattern.lastIndex = 0;
      continue;
    }
    rule.pattern.lastIndex = 0;

    if (seen.has(rule.id)) continue;

    const corrected = trimmed.replace(rule.pattern, rule.replacement);
    rule.pattern.lastIndex = 0;

    if (corrected === trimmed) continue;
    seen.add(rule.id);

    results.push({
      id: rule.id,
      original: trimmed,
      corrected,
      message: rule.message,
      category: rule.category,
      severity: rule.severity,
    });
  }

  // Sort: errors first, then warnings, then style
  results.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return results;
}

// ─── Legacy single-suggestion compat ─────────────────────────────────────────
export function checkGrammar(text: string): GrammarSuggestion | null {
  return checkGrammarAll(text)[0] ?? null;
}
