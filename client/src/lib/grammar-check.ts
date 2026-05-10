// ─── Grammar Check Engine ────────────────────────────────────────────────────
// Pure client-side, zero-latency (regex + dictionary). Grammarly-style:
// grammar, spelling, word choice, clarity, tone, and semantic meaning.

export type SuggestionSeverity = "error" | "warning" | "style";
export type SuggestionCategory =
  | "grammar"
  | "apostrophe"
  | "capitalization"
  | "spelling"
  | "punctuation"
  | "word-choice"
  | "clarity"
  | "tone"
  | "meaning";

export type GrammarSuggestion = {
  id: string;
  original: string;
  corrected: string;
  message: string;
  category: SuggestionCategory;
  severity: SuggestionSeverity;
  changedWord?: string;
  replacementWord?: string;
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
  { id: "your-welcome",     pattern: /\byour welcome\b/gi,      replacement: "you're welcome",   message: '"your" should be "you\'re"',           category: "grammar",       severity: "error" },
  { id: "their-there-v",    pattern: /\btheir (is|are|was|were)\b/gi, replacement: "there $1", message: '"their" should be "there"',            category: "grammar",       severity: "error" },
  { id: "there-their-n",    pattern: /\bthere (car|house|dog|cat|phone|bag|shirt|friend|family|room|place|stuff|things|money|kids|children|team|job|work)\b/gi, replacement: "their $1", message: '"there" should be "their"', category: "grammar", severity: "error" },
  { id: "there-theyre",     pattern: /\bthere going\b/gi,       replacement: "they're going",    message: '"there" should be "they\'re"',          category: "grammar",       severity: "error" },
  { id: "its-apostrophe",   pattern: /\bits a\b/gi,             replacement: "it's a",           message: '"its" should be "it\'s"',              category: "grammar",       severity: "error" },
  { id: "your-youre-adj",   pattern: /\byour (going|coming|right|wrong|sure|crazy|kidding|joking|welcome|awesome|amazing)\b/gi, replacement: "you're $1", message: '"your" should be "you\'re"', category: "grammar", severity: "error" },
  { id: "to-too-adj",       pattern: /\bto (much|many|late|early|fast|slow|loud|quiet|big|small|long|short|hot|cold|far|close|good|bad|hard|easy)\b/gi, replacement: "too $1", message: '"to" should be "too"', category: "grammar", severity: "error" },
  { id: "better-then",      pattern: /\bbetter then\b/gi,       replacement: "better than",      message: '"then" should be "than" for comparisons', category: "grammar",   severity: "error" },
  { id: "other-then",       pattern: /\bother then\b/gi,        replacement: "other than",       message: '"then" should be "than"',              category: "grammar",       severity: "error" },
  { id: "more-then",        pattern: /\bmore then\b/gi,         replacement: "more than",        message: '"then" should be "than"',              category: "grammar",       severity: "error" },
  { id: "less-then",        pattern: /\bless then\b/gi,         replacement: "less than",        message: '"then" should be "than"',              category: "grammar",       severity: "error" },
  { id: "should-of",        pattern: /\bshould of\b/gi,         replacement: "should have",      message: '"should of" → "should have"',          category: "grammar",       severity: "error" },
  { id: "could-of",         pattern: /\bcould of\b/gi,          replacement: "could have",       message: '"could of" → "could have"',            category: "grammar",       severity: "error" },
  { id: "would-of",         pattern: /\bwould of\b/gi,          replacement: "would have",       message: '"would of" → "would have"',            category: "grammar",       severity: "error" },
  { id: "must-of",          pattern: /\bmust of\b/gi,           replacement: "must have",        message: '"must of" → "must have"',              category: "grammar",       severity: "error" },
  { id: "might-of",         pattern: /\bmight of\b/gi,          replacement: "might have",       message: '"might of" → "might have"',            category: "grammar",       severity: "error" },
  { id: "less-fewer",       pattern: /\bless (people|items|things|words|options|choices|steps|points|details|examples|reasons|chances)\b/gi, replacement: "fewer $1", message: 'Use "fewer" for countable nouns', category: "word-choice", severity: "warning" },
  { id: "play-good",        pattern: /\b(play|speak|write|draw|sing|dance|cook|work|sleep|run|swim|drive|read|teach|learn) good\b/gi, replacement: "$1 well", message: 'Use "well" (adverb), not "good" after verbs', category: "grammar", severity: "error" },
  { id: "feel-badly",       pattern: /\bfeel badly\b/gi,        replacement: "feel bad",         message: '"feel badly" → "feel bad"',            category: "grammar",       severity: "warning" },
  { id: "affect-effect",    pattern: /\bthe affect\b/gi,        replacement: "the effect",       message: '"affect" is a verb; "effect" is the noun', category: "meaning",   severity: "error" },
  { id: "effect-affect",    pattern: /\beffect the\b/gi,        replacement: "affect the",       message: '"effect" is a noun; "affect" means to influence', category: "meaning", severity: "error" },
  { id: "compliment-complement", pattern: /\bcompliment(s|ed|ing|ary)? (your|their|the|a|his|her)\b/gi, replacement: "complement$1 $2", message: '"compliment" = praise; "complement" = goes well with', category: "meaning", severity: "warning" },
  { id: "principal-principle", pattern: /\bprincipal reason\b/gi, replacement: "main reason",   message: '"principal" here means main/chief',     category: "meaning",       severity: "style" },
  { id: "accept-except",    pattern: /\bexcept (it|that|this|the offer|the invitation|the challenge)\b/gi, replacement: "accept $1", message: '"except" means to exclude; "accept" means to receive', category: "meaning", severity: "error" },
  { id: "lose-loose",       pattern: /\bloose (the game|the match|the bet|the race|the argument|weight|my keys|my phone|my mind)\b/gi, replacement: "lose $1", message: '"loose" = not tight; "lose" = to fail to win', category: "meaning", severity: "error" },
  { id: "lay-lie",          pattern: /\b(I|she|he|it) lays (down|there|here|in bed|on the couch)\b/gi, replacement: "$1 lies $2", message: '"lay" needs an object; "lie" = to recline', category: "grammar", severity: "warning" },
  { id: "bring-take",       pattern: /\bbring (it|that|this|them) (there|away|with you|home)\b/gi, replacement: "take $1 $2", message: '"bring" = toward the speaker; "take" = away from speaker', category: "meaning", severity: "style" },

  // ── Missing Apostrophes (error) ──────────────────────────────────────────
  { id: "dont",             pattern: /\bdont\b/gi,              replacement: "don't",            message: '"dont" → "don\'t"',                    category: "apostrophe",    severity: "error" },
  { id: "cant",             pattern: /\bcant\b/gi,              replacement: "can't",            message: '"cant" → "can\'t"',                    category: "apostrophe",    severity: "error" },
  { id: "wont",             pattern: /\bwont\b/gi,              replacement: "won't",            message: '"wont" → "won\'t"',                    category: "apostrophe",    severity: "error" },
  { id: "wasnt",            pattern: /\bwasnt\b/gi,             replacement: "wasn't",           message: '"wasnt" → "wasn\'t"',                  category: "apostrophe",    severity: "error" },
  { id: "isnt",             pattern: /\bisnt\b/gi,              replacement: "isn't",            message: '"isnt" → "isn\'t"',                    category: "apostrophe",    severity: "error" },
  { id: "didnt",            pattern: /\bdidnt\b/gi,             replacement: "didn't",           message: '"didnt" → "didn\'t"',                  category: "apostrophe",    severity: "error" },
  { id: "couldnt",          pattern: /\bcouldnt\b/gi,           replacement: "couldn't",         message: '"couldnt" → "couldn\'t"',              category: "apostrophe",    severity: "error" },
  { id: "wouldnt",          pattern: /\bwouldnt\b/gi,           replacement: "wouldn't",         message: '"wouldnt" → "wouldn\'t"',              category: "apostrophe",    severity: "error" },
  { id: "shouldnt",         pattern: /\bshouldnt\b/gi,          replacement: "shouldn't",        message: '"shouldnt" → "shouldn\'t"',            category: "apostrophe",    severity: "error" },
  { id: "havent",           pattern: /\bhavent\b/gi,            replacement: "haven't",          message: '"havent" → "haven\'t"',                category: "apostrophe",    severity: "error" },
  { id: "hasnt",            pattern: /\bhasnt\b/gi,             replacement: "hasn't",           message: '"hasnt" → "hasn\'t"',                  category: "apostrophe",    severity: "error" },
  { id: "hadnt",            pattern: /\bhadnt\b/gi,             replacement: "hadn't",           message: '"hadnt" → "hadn\'t"',                  category: "apostrophe",    severity: "error" },
  { id: "arent",            pattern: /\barent\b/gi,             replacement: "aren't",           message: '"arent" → "aren\'t"',                  category: "apostrophe",    severity: "error" },
  { id: "werent",           pattern: /\bwerent\b/gi,            replacement: "weren't",          message: '"werent" → "weren\'t"',                category: "apostrophe",    severity: "error" },
  { id: "doesnt",           pattern: /\bdoesnt\b/gi,            replacement: "doesn't",          message: '"doesnt" → "doesn\'t"',                category: "apostrophe",    severity: "error" },
  { id: "im",               pattern: /\bim\b/gi,                replacement: "I'm",              message: '"im" → "I\'m"',                        category: "apostrophe",    severity: "error" },
  { id: "whos",             pattern: /\bwhos\b/gi,              replacement: "who's",            message: '"whos" → "who\'s"',                    category: "apostrophe",    severity: "error" },
  { id: "thats",            pattern: /\bthats\b/gi,             replacement: "that's",           message: '"thats" → "that\'s"',                  category: "apostrophe",    severity: "error" },
  { id: "whats",            pattern: /\bwhats\b/gi,             replacement: "what's",           message: '"whats" → "what\'s"',                  category: "apostrophe",    severity: "error" },
  { id: "its-going",        pattern: /\bits (going|getting|been|happening|okay|fine|good|bad|great|amazing|terrible|working|not)\b/gi, replacement: "it's $1", message: '"its" → "it\'s"', category: "apostrophe", severity: "error" },
  { id: "lets-go",          pattern: /\blets (go|do|try|see|check|start|begin|make|talk|work|finish|meet)\b/gi, replacement: "let's $1", message: '"lets" → "let\'s"', category: "apostrophe", severity: "error" },
  { id: "theyre",           pattern: /\btheyre\b/gi,            replacement: "they're",          message: '"theyre" → "they\'re"',                category: "apostrophe",    severity: "error" },
  { id: "youre",            pattern: /\byoure\b/gi,             replacement: "you're",           message: '"youre" → "you\'re"',                  category: "apostrophe",    severity: "error" },
  { id: "were-contraction", pattern: /\bwere (going|planning|trying|hoping|thinking|expecting|waiting|just|about)\b/gi, replacement: "we're $1", message: '"were" → "we\'re"', category: "apostrophe", severity: "warning" },
  { id: "wed",              pattern: /\bwed (love|like|hate|prefer|rather|be|go|do|say)\b/gi, replacement: "we'd $1", message: '"wed" → "we\'d"', category: "apostrophe", severity: "error" },
  { id: "id-verb",          pattern: /\bid (love|like|prefer|rather|say|go|do|be)\b/gi, replacement: "I'd $1", message: '"id" → "I\'d"', category: "apostrophe", severity: "error" },
  { id: "ive",              pattern: /\bive\b/gi,               replacement: "I've",             message: '"ive" → "I\'ve"',                      category: "apostrophe",    severity: "error" },
  { id: "ill",              pattern: /\bill (do|go|try|be|make|say|have|come|send|help|check)\b/gi, replacement: "I'll $1", message: '"ill" → "I\'ll"', category: "apostrophe", severity: "error" },
  { id: "weve",             pattern: /\bweve\b/gi,              replacement: "we've",            message: '"weve" → "we\'ve"',                    category: "apostrophe",    severity: "error" },
  { id: "theyve",           pattern: /\btheyve\b/gi,            replacement: "they've",          message: '"theyve" → "they\'ve"',                category: "apostrophe",    severity: "error" },
  { id: "youve",            pattern: /\byouve\b/gi,             replacement: "you've",           message: '"youve" → "you\'ve"',                  category: "apostrophe",    severity: "error" },
  { id: "couldve",          pattern: /\bcouldve\b/gi,           replacement: "could've",         message: '"couldve" → "could\'ve"',              category: "apostrophe",    severity: "error" },
  { id: "wouldve",          pattern: /\bwouldve\b/gi,           replacement: "would've",         message: '"wouldve" → "would\'ve"',              category: "apostrophe",    severity: "error" },
  { id: "shouldve",         pattern: /\bshouldve\b/gi,          replacement: "should've",        message: '"shouldve" → "should\'ve"',            category: "apostrophe",    severity: "error" },
  { id: "mightve",          pattern: /\bmightve\b/gi,           replacement: "might've",         message: '"mightve" → "might\'ve"',              category: "apostrophe",    severity: "error" },

  // ── Capitalization (error) ───────────────────────────────────────────────
  { id: "i-lowercase",      pattern: /\bi\b(?=[ ,.'!?—–]|\s+[a-z])/g,  replacement: "I",       message: 'Lowercase "i" should be "I"',          category: "capitalization", severity: "error" },
  { id: "im-cap",           pattern: /\bi'm\b/gi,              replacement: "I'm",              message: '"i\'m" → "I\'m"',                      category: "capitalization", severity: "error" },
  { id: "ive-cap",          pattern: /\bi've\b/gi,             replacement: "I've",             message: '"i\'ve" → "I\'ve"',                    category: "capitalization", severity: "error" },
  { id: "ill-cap",          pattern: /\bi'll\b/gi,             replacement: "I'll",             message: '"i\'ll" → "I\'ll"',                    category: "capitalization", severity: "error" },
  { id: "id-cap",           pattern: /\bi'd\b/gi,              replacement: "I'd",              message: '"i\'d" → "I\'d"',                      category: "capitalization", severity: "error" },
  { id: "i-was",            pattern: /\bi was\b/gi,            replacement: "I was",            message: '"i" → "I"',                            category: "capitalization", severity: "error" },
  { id: "i-am",             pattern: /\bi am\b/gi,             replacement: "I am",             message: '"i am" → "I am"',                      category: "capitalization", severity: "error" },
  { id: "i-verb",           pattern: /\bi (think|know|feel|believe|guess|hope|wish|mean|need|want|have|got|see|heard|said|told|asked|tried|went|came|found|learned|understood|realized)\b/gi, replacement: "I $1", message: '"i" → "I"', category: "capitalization", severity: "error" },

  // ── Common Misspellings — Expanded (error) ───────────────────────────────
  { id: "alot",             pattern: /\balot\b/gi,             replacement: "a lot",            message: '"alot" is not a word',                 category: "spelling",       severity: "error" },
  { id: "definately",       pattern: /\bdefinately\b/gi,       replacement: "definitely",       message: '"definately" → "definitely"',          category: "spelling",       severity: "error" },
  { id: "recieve",          pattern: /\brecieve\b/gi,          replacement: "receive",          message: '"recieve" → "receive"',                category: "spelling",       severity: "error" },
  { id: "occured",          pattern: /\boccured\b/gi,          replacement: "occurred",         message: '"occured" → "occurred"',               category: "spelling",       severity: "error" },
  { id: "seperate",         pattern: /\bseperate\b/gi,         replacement: "separate",         message: '"seperate" → "separate"',              category: "spelling",       severity: "error" },
  { id: "independant",      pattern: /\bindependant\b/gi,      replacement: "independent",      message: '"independant" → "independent"',        category: "spelling",       severity: "error" },
  { id: "tommorrow",        pattern: /\btommorrow\b/gi,        replacement: "tomorrow",         message: '"tommorrow" → "tomorrow"',             category: "spelling",       severity: "error" },
  { id: "tomorow",          pattern: /\btomorow\b/gi,          replacement: "tomorrow",         message: '"tomorow" → "tomorrow"',               category: "spelling",       severity: "error" },
  { id: "untill",           pattern: /\buntill\b/gi,           replacement: "until",            message: '"untill" → "until"',                   category: "spelling",       severity: "error" },
  { id: "beleive",          pattern: /\bbeleive\b/gi,          replacement: "believe",          message: '"beleive" → "believe"',                category: "spelling",       severity: "error" },
  { id: "wierd",            pattern: /\bwierd\b/gi,            replacement: "weird",            message: '"wierd" → "weird"',                    category: "spelling",       severity: "error" },
  { id: "freind",           pattern: /\bfreind\b/gi,           replacement: "friend",           message: '"freind" → "friend"',                  category: "spelling",       severity: "error" },
  { id: "knowlege",         pattern: /\bknowlege\b/gi,         replacement: "knowledge",        message: '"knowlege" → "knowledge"',             category: "spelling",       severity: "error" },
  { id: "excercise",        pattern: /\bexcercise\b/gi,        replacement: "exercise",         message: '"excercise" → "exercise"',             category: "spelling",       severity: "error" },
  { id: "enviroment",       pattern: /\benviroment\b/gi,       replacement: "environment",      message: '"enviroment" → "environment"',         category: "spelling",       severity: "error" },
  { id: "goverment",        pattern: /\bgoverment\b/gi,        replacement: "government",       message: '"goverment" → "government"',           category: "spelling",       severity: "error" },
  { id: "experiance",       pattern: /\bexperiance\b/gi,       replacement: "experience",       message: '"experiance" → "experience"',          category: "spelling",       severity: "error" },
  { id: "becuase",          pattern: /\bbecuase\b/gi,           replacement: "because",          message: '"becuase" → "because"',                category: "spelling",       severity: "error" },
  { id: "becouse",          pattern: /\bbecouse\b/gi,           replacement: "because",          message: '"becouse" → "because"',                category: "spelling",       severity: "error" },
  { id: "languge",          pattern: /\blanguge\b/gi,           replacement: "language",         message: '"languge" → "language"',               category: "spelling",       severity: "error" },
  { id: "grammer",          pattern: /\bgrammer\b/gi,           replacement: "grammar",          message: '"grammer" → "grammar"',                category: "spelling",       severity: "error" },
  { id: "accross",          pattern: /\baccross\b/gi,           replacement: "across",           message: '"accross" → "across"',                 category: "spelling",       severity: "error" },
  { id: "begining",         pattern: /\bbegining\b/gi,          replacement: "beginning",        message: '"begining" → "beginning"',             category: "spelling",       severity: "error" },
  { id: "writting",         pattern: /\bwritting\b/gi,          replacement: "writing",          message: '"writting" → "writing"',               category: "spelling",       severity: "error" },
  { id: "studing",          pattern: /\bstuding\b/gi,           replacement: "studying",         message: '"studing" → "studying"',               category: "spelling",       severity: "error" },
  { id: "lisening",         pattern: /\blisening\b/gi,          replacement: "listening",        message: '"lisening" → "listening"',             category: "spelling",       severity: "error" },
  { id: "speach",           pattern: /\bspeach\b/gi,            replacement: "speech",           message: '"speach" → "speech"',                  category: "spelling",       severity: "error" },
  { id: "pronounciation",   pattern: /\bpronounciation\b/gi,    replacement: "pronunciation",    message: '"pronounciation" → "pronunciation"',   category: "spelling",       severity: "error" },
  { id: "nobody",           pattern: /\bno body\b/gi,           replacement: "nobody",           message: '"no body" → "nobody"',                 category: "spelling",       severity: "warning" },
  { id: "sometimes",        pattern: /\bsome times\b/gi,        replacement: "sometimes",        message: '"some times" → "sometimes"',           category: "spelling",       severity: "warning" },
  { id: "awhile",           pattern: /\bawhile ago\b/gi,        replacement: "a while ago",      message: '"awhile" → "a while" after ago',       category: "spelling",       severity: "warning" },
  { id: "accomodate",       pattern: /\baccomodate\b/gi,        replacement: "accommodate",      message: '"accomodate" → "accommodate"',         category: "spelling",       severity: "error" },
  { id: "achive",           pattern: /\bachive\b/gi,            replacement: "achieve",          message: '"achive" → "achieve"',                 category: "spelling",       severity: "error" },
  { id: "acomplish",        pattern: /\bacomplish\b/gi,         replacement: "accomplish",       message: '"acomplish" → "accomplish"',           category: "spelling",       severity: "error" },
  { id: "adress",           pattern: /\badress\b/gi,            replacement: "address",          message: '"adress" → "address"',                 category: "spelling",       severity: "error" },
  { id: "agressive",        pattern: /\bagressive\b/gi,         replacement: "aggressive",       message: '"agressive" → "aggressive"',           category: "spelling",       severity: "error" },
  { id: "apparant",         pattern: /\bapparant\b/gi,          replacement: "apparent",         message: '"apparant" → "apparent"',              category: "spelling",       severity: "error" },
  { id: "arguement",        pattern: /\bargument\b/gi,          replacement: "argument",         message: '"arguement" → "argument"',             category: "spelling",       severity: "error" },
  { id: "assasinate",       pattern: /\bassasinate\b/gi,        replacement: "assassinate",      message: '"assasinate" → "assassinate"',         category: "spelling",       severity: "error" },
  { id: "atached",          pattern: /\batached\b/gi,           replacement: "attached",         message: '"atached" → "attached"',               category: "spelling",       severity: "error" },
  { id: "awfull",           pattern: /\bawfull\b/gi,            replacement: "awful",            message: '"awfull" → "awful"',                   category: "spelling",       severity: "error" },
  { id: "basicly",          pattern: /\bbasicly\b/gi,           replacement: "basically",        message: '"basicly" → "basically"',              category: "spelling",       severity: "error" },
  { id: "beautifull",       pattern: /\bbeautifull\b/gi,        replacement: "beautiful",        message: '"beautifull" → "beautiful"',           category: "spelling",       severity: "error" },
  { id: "carefull",         pattern: /\bcarefull\b/gi,          replacement: "careful",          message: '"carefull" → "careful"',               category: "spelling",       severity: "error" },
  { id: "calender",         pattern: /\bcalender\b/gi,          replacement: "calendar",         message: '"calender" → "calendar"',              category: "spelling",       severity: "error" },
  { id: "colum",            pattern: /\bcolum\b/gi,             replacement: "column",           message: '"colum" → "column"',                   category: "spelling",       severity: "error" },
  { id: "concious",         pattern: /\bconcious\b/gi,          replacement: "conscious",        message: '"concious" → "conscious"',             category: "spelling",       severity: "error" },
  { id: "consistant",       pattern: /\bconsistant\b/gi,        replacement: "consistent",       message: '"consistant" → "consistent"',          category: "spelling",       severity: "error" },
  { id: "convience",        pattern: /\bconvience\b/gi,         replacement: "convenience",      message: '"convience" → "convenience"',          category: "spelling",       severity: "error" },
  { id: "copywrite",        pattern: /\bcopywrite\b/gi,         replacement: "copyright",        message: '"copywrite" → "copyright"',            category: "spelling",       severity: "error" },
  { id: "critisism",        pattern: /\bcritisism\b/gi,         replacement: "criticism",        message: '"critisism" → "criticism"',            category: "spelling",       severity: "error" },
  { id: "definite",         pattern: /\bdefinate\b/gi,          replacement: "definite",         message: '"definate" → "definite"',              category: "spelling",       severity: "error" },
  { id: "disapoint",        pattern: /\bdisapoint\b/gi,         replacement: "disappoint",       message: '"disapoint" → "disappoint"',           category: "spelling",       severity: "error" },
  { id: "embarrass",        pattern: /\bembarass\b/gi,          replacement: "embarrass",        message: '"embarass" → "embarrass"',             category: "spelling",       severity: "error" },
  { id: "equiptment",       pattern: /\bequiptment\b/gi,        replacement: "equipment",        message: '"equiptment" → "equipment"',           category: "spelling",       severity: "error" },
  { id: "especialy",        pattern: /\bespecialy\b/gi,         replacement: "especially",       message: '"especialy" → "especially"',           category: "spelling",       severity: "error" },
  { id: "excelent",         pattern: /\bexcelent\b/gi,          replacement: "excellent",        message: '"excelent" → "excellent"',             category: "spelling",       severity: "error" },
  { id: "existance",        pattern: /\bexistance\b/gi,         replacement: "existence",        message: '"existance" → "existence"',            category: "spelling",       severity: "error" },
  { id: "familier",         pattern: /\bfamilier\b/gi,          replacement: "familiar",         message: '"familier" → "familiar"',              category: "spelling",       severity: "error" },
  { id: "finaly",           pattern: /\bfinaly\b/gi,            replacement: "finally",          message: '"finaly" → "finally"',                 category: "spelling",       severity: "error" },
  { id: "florescent",       pattern: /\bflorescent\b/gi,        replacement: "fluorescent",      message: '"florescent" → "fluorescent"',         category: "spelling",       severity: "error" },
  { id: "foriegn",          pattern: /\bforiegn\b/gi,           replacement: "foreign",          message: '"foriegn" → "foreign"',                category: "spelling",       severity: "error" },
  { id: "fourty",           pattern: /\bfourty\b/gi,            replacement: "forty",            message: '"fourty" → "forty"',                   category: "spelling",       severity: "error" },
  { id: "garentee",         pattern: /\bgarentee\b/gi,          replacement: "guarantee",        message: '"garentee" → "guarantee"',             category: "spelling",       severity: "error" },
  { id: "guidence",         pattern: /\bguidence\b/gi,          replacement: "guidance",         message: '"guidence" → "guidance"',              category: "spelling",       severity: "error" },
  { id: "happenned",        pattern: /\bhappenned\b/gi,         replacement: "happened",         message: '"happenned" → "happened"',             category: "spelling",       severity: "error" },
  { id: "harass",           pattern: /\bharas\b/gi,             replacement: "harass",           message: '"haras" → "harass"',                   category: "spelling",       severity: "error" },
  { id: "humerous",         pattern: /\bhumerous\b/gi,          replacement: "humorous",         message: '"humerous" → "humorous"',              category: "spelling",       severity: "error" },
  { id: "imediate",         pattern: /\bimediate\b/gi,          replacement: "immediate",        message: '"imediate" → "immediate"',             category: "spelling",       severity: "error" },
  { id: "incedent",         pattern: /\bincedent\b/gi,          replacement: "incident",         message: '"incedent" → "incident"',              category: "spelling",       severity: "error" },
  { id: "intelligance",     pattern: /\bintelligance\b/gi,      replacement: "intelligence",     message: '"intelligance" → "intelligence"',      category: "spelling",       severity: "error" },
  { id: "intresting",       pattern: /\bintresting\b/gi,        replacement: "interesting",      message: '"intresting" → "interesting"',         category: "spelling",       severity: "error" },
  { id: "judgement-alt",    pattern: /\bjudgement\b/gi,         replacement: "judgment",         message: '"judgement" → "judgment" (US English)', category: "spelling",      severity: "style" },
  { id: "absense",          pattern: /\babsense\b/gi,           replacement: "absence",          message: '"absense" → "absence"',                category: "spelling",       severity: "error" },
  { id: "libary",           pattern: /\blibary\b/gi,            replacement: "library",          message: '"libary" → "library"',                 category: "spelling",       severity: "error" },
  { id: "lisense",          pattern: /\blisense\b/gi,           replacement: "license",          message: '"lisense" → "license"',                category: "spelling",       severity: "error" },
  { id: "maintainance",     pattern: /\bmaintainance\b/gi,      replacement: "maintenance",      message: '"maintainance" → "maintenance"',       category: "spelling",       severity: "error" },
  { id: "millenium",        pattern: /\bmillenium\b/gi,         replacement: "millennium",       message: '"millenium" → "millennium"',           category: "spelling",       severity: "error" },
  { id: "mischevious",      pattern: /\bmischevious\b/gi,       replacement: "mischievous",      message: '"mischevious" → "mischievous"',        category: "spelling",       severity: "error" },
  { id: "misspell-misspel", pattern: /\bmisspel\b/gi,           replacement: "misspell",         message: '"misspel" → "misspell"',               category: "spelling",       severity: "error" },
  { id: "neccessary",       pattern: /\bneccessary\b/gi,        replacement: "necessary",        message: '"neccessary" → "necessary"',           category: "spelling",       severity: "error" },
  { id: "necesary",         pattern: /\bnecesary\b/gi,          replacement: "necessary",        message: '"necesary" → "necessary"',             category: "spelling",       severity: "error" },
  { id: "noticable",        pattern: /\bnoticable\b/gi,         replacement: "noticeable",       message: '"noticable" → "noticeable"',           category: "spelling",       severity: "error" },
  { id: "occassion",        pattern: /\boccassion\b/gi,         replacement: "occasion",         message: '"occassion" → "occasion"',             category: "spelling",       severity: "error" },
  { id: "ommit",            pattern: /\bommit\b/gi,             replacement: "omit",             message: '"ommit" → "omit"',                     category: "spelling",       severity: "error" },
  { id: "persistance",      pattern: /\bpersistance\b/gi,       replacement: "persistence",      message: '"persistance" → "persistence"',        category: "spelling",       severity: "error" },
  { id: "posession",        pattern: /\bposession\b/gi,         replacement: "possession",       message: '"posession" → "possession"',           category: "spelling",       severity: "error" },
  { id: "preceed",          pattern: /\bpreceed\b/gi,           replacement: "precede",          message: '"preceed" → "precede"',                category: "spelling",       severity: "error" },
  { id: "priviledge",       pattern: /\bpriviledge\b/gi,        replacement: "privilege",        message: '"priviledge" → "privilege"',           category: "spelling",       severity: "error" },
  { id: "questionaire",     pattern: /\bquestionaire\b/gi,      replacement: "questionnaire",    message: '"questionaire" → "questionnaire"',     category: "spelling",       severity: "error" },
  { id: "reccomend",        pattern: /\breccomend\b/gi,         replacement: "recommend",        message: '"reccomend" → "recommend"',            category: "spelling",       severity: "error" },
  { id: "rediculous",       pattern: /\brediculous\b/gi,        replacement: "ridiculous",       message: '"rediculous" → "ridiculous"',          category: "spelling",       severity: "error" },
  { id: "relevent",         pattern: /\brelevent\b/gi,          replacement: "relevant",         message: '"relevent" → "relevant"',              category: "spelling",       severity: "error" },
  { id: "rember",           pattern: /\brember\b/gi,            replacement: "remember",         message: '"rember" → "remember"',                category: "spelling",       severity: "error" },
  { id: "remeber",          pattern: /\bremeber\b/gi,           replacement: "remember",         message: '"remeber" → "remember"',               category: "spelling",       severity: "error" },
  { id: "repitition",       pattern: /\brepitition\b/gi,        replacement: "repetition",       message: '"repitition" → "repetition"',          category: "spelling",       severity: "error" },
  { id: "resturant",        pattern: /\bresturant\b/gi,         replacement: "restaurant",       message: '"resturant" → "restaurant"',           category: "spelling",       severity: "error" },
  { id: "rythem",           pattern: /\brythem\b/gi,            replacement: "rhythm",           message: '"rythem" → "rhythm"',                  category: "spelling",       severity: "error" },
  { id: "sence",            pattern: /\bsence\b/gi,             replacement: "sense",            message: '"sence" → "sense"',                    category: "spelling",       severity: "error" },
  { id: "similer",          pattern: /\bsimiler\b/gi,           replacement: "similar",          message: '"similer" → "similar"',                category: "spelling",       severity: "error" },
  { id: "sincerely-sicerely", pattern: /\bsicerely\b/gi,        replacement: "sincerely",        message: '"sicerely" → "sincerely"',             category: "spelling",       severity: "error" },
  { id: "succesful",        pattern: /\bsuccesful\b/gi,         replacement: "successful",       message: '"succesful" → "successful"',           category: "spelling",       severity: "error" },
  { id: "supose",           pattern: /\bsupose\b/gi,            replacement: "suppose",          message: '"supose" → "suppose"',                 category: "spelling",       severity: "error" },
  { id: "suprise",          pattern: /\bsuprise\b/gi,           replacement: "surprise",         message: '"suprise" → "surprise"',               category: "spelling",       severity: "error" },
  { id: "temperament-alt",  pattern: /\btemprement\b/gi,        replacement: "temperament",      message: '"temprement" → "temperament"',         category: "spelling",       severity: "error" },
  { id: "truely",           pattern: /\btruely\b/gi,            replacement: "truly",            message: '"truely" → "truly"',                   category: "spelling",       severity: "error" },
  { id: "unfortunatly",     pattern: /\bunfortunatly\b/gi,      replacement: "unfortunately",    message: '"unfortunatly" → "unfortunately"',     category: "spelling",       severity: "error" },
  { id: "usally",           pattern: /\busally\b/gi,            replacement: "usually",          message: '"usally" → "usually"',                 category: "spelling",       severity: "error" },
  { id: "usefull",          pattern: /\busefull\b/gi,           replacement: "useful",           message: '"usefull" → "useful"',                 category: "spelling",       severity: "error" },
  { id: "welth",            pattern: /\bwelth\b/gi,             replacement: "wealth",           message: '"welth" → "wealth"',                   category: "spelling",       severity: "error" },
  { id: "wich",             pattern: /\bwich\b/gi,              replacement: "which",            message: '"wich" → "which"',                     category: "spelling",       severity: "error" },
  { id: "withing",          pattern: /\bwithing\b/gi,           replacement: "within",           message: '"withing" → "within"',                 category: "spelling",       severity: "error" },

  // ── Punctuation (warning) ────────────────────────────────────────────────
  { id: "comma-space",      pattern: /,([^ \n'"])/g,            replacement: ", $1",             message: "Add space after comma",                category: "punctuation",    severity: "warning" },
  { id: "period-space",     pattern: /\.([A-Z])/g,              replacement: ". $1",             message: "Add space after period",               category: "punctuation",    severity: "warning" },
  { id: "double-space",     pattern: /  +/g,                    replacement: " ",                message: "Extra space detected",                 category: "punctuation",    severity: "warning" },
  { id: "question-space",   pattern: /\?([A-Za-z])/g,          replacement: "? $1",             message: "Add space after question mark",        category: "punctuation",    severity: "warning" },
  { id: "exclaim-space",    pattern: /!([A-Za-z])/g,           replacement: "! $1",             message: "Add space after exclamation mark",     category: "punctuation",    severity: "warning" },
  { id: "triple-period",    pattern: /\.{4,}/g,                 replacement: "...",              message: "Use exactly three dots for ellipsis",  category: "punctuation",    severity: "warning" },
  { id: "multi-exclaim",    pattern: /!{3,}/g,                  replacement: "!",                message: "Avoid multiple exclamation marks",      category: "punctuation",    severity: "style" },
  { id: "multi-question",   pattern: /\?{2,}/g,                 replacement: "?",                message: "Avoid multiple question marks",         category: "punctuation",    severity: "style" },

  // ── Clarity — Verbose Phrases → Concise (style) ──────────────────────────
  { id: "very-very",        pattern: /\bvery very\b/gi,         replacement: "extremely",        message: '"very very" → "extremely"',            category: "clarity",        severity: "style" },
  { id: "in-order-to",      pattern: /\bin order to\b/gi,       replacement: "to",               message: '"In order to" → simpler "to"',         category: "clarity",        severity: "style" },
  { id: "due-to-fact",      pattern: /\bdue to the fact that\b/gi, replacement: "because",       message: '"Due to the fact that" → "because"',   category: "clarity",        severity: "style" },
  { id: "at-this-point",    pattern: /\bat this point in time\b/gi, replacement: "now",          message: '"At this point in time" → "now"',      category: "clarity",        severity: "style" },
  { id: "each-and-every",   pattern: /\beach and every\b/gi,    replacement: "every",            message: '"Each and every" → just "every"',      category: "clarity",        severity: "style" },
  { id: "end-result",       pattern: /\bend result\b/gi,        replacement: "result",           message: '"End result" is redundant',            category: "clarity",        severity: "style" },
  { id: "past-history",     pattern: /\bpast history\b/gi,      replacement: "history",          message: '"Past history" is redundant',          category: "clarity",        severity: "style" },
  { id: "free-gift",        pattern: /\bfree gift\b/gi,         replacement: "gift",             message: '"Free gift" is redundant',             category: "clarity",        severity: "style" },
  { id: "close-proximity",  pattern: /\bclose proximity\b/gi,   replacement: "proximity",        message: '"Close proximity" is redundant',        category: "clarity",        severity: "style" },
  { id: "utilize",          pattern: /\butilize\b/gi,           replacement: "use",              message: '"Utilize" → simpler "use"',             category: "word-choice",    severity: "style" },
  { id: "commence",         pattern: /\bcommence\b/gi,          replacement: "start",            message: '"Commence" → simpler "start"',          category: "word-choice",    severity: "style" },
  { id: "obtain",           pattern: /\bobtain\b/gi,            replacement: "get",              message: '"Obtain" → simpler "get"',              category: "word-choice",    severity: "style" },
  { id: "on-a-daily-basis", pattern: /\bon a daily basis\b/gi,  replacement: "daily",            message: '"On a daily basis" → "daily"',          category: "clarity",        severity: "style" },
  { id: "on-a-weekly-basis",pattern: /\bon a weekly basis\b/gi, replacement: "weekly",           message: '"On a weekly basis" → "weekly"',        category: "clarity",        severity: "style" },
  { id: "in-spite-of",      pattern: /\bin spite of the fact that\b/gi, replacement: "although", message: '"In spite of the fact that" → "although"', category: "clarity",   severity: "style" },
  { id: "inasmuch-as",      pattern: /\binasmuch as\b/gi,       replacement: "since",            message: '"Inasmuch as" → simpler "since"',       category: "clarity",        severity: "style" },
  { id: "in-the-event-that",pattern: /\bin the event that\b/gi, replacement: "if",               message: '"In the event that" → simpler "if"',    category: "clarity",        severity: "style" },
  { id: "in-the-near-future",pattern: /\bin the near future\b/gi, replacement: "soon",           message: '"In the near future" → "soon"',         category: "clarity",        severity: "style" },
  { id: "at-this-moment",   pattern: /\bat this moment in time\b/gi, replacement: "now",         message: '"At this moment in time" → "now"',      category: "clarity",        severity: "style" },
  { id: "consensus-opinion",pattern: /\bconsensus of opinion\b/gi, replacement: "consensus",     message: '"Consensus of opinion" is redundant',   category: "clarity",        severity: "style" },
  { id: "added-bonus",      pattern: /\badded bonus\b/gi,       replacement: "bonus",            message: '"Added bonus" is redundant',            category: "clarity",        severity: "style" },
  { id: "basic-fundamentals",pattern: /\bbasic fundamentals\b/gi, replacement: "fundamentals",   message: '"Basic fundamentals" is redundant',     category: "clarity",        severity: "style" },
  { id: "absolutely-certain",pattern: /\babsolutely certain\b/gi, replacement: "certain",        message: '"Absolutely certain" — "certain" already implies absolute', category: "clarity", severity: "style" },

  // ── Weak Words → Stronger (style) ────────────────────────────────────────
  { id: "very-good",        pattern: /\bvery good\b/gi,         replacement: "excellent",        message: '"Very good" → "excellent"',             category: "word-choice",    severity: "style" },
  { id: "very-bad",         pattern: /\bvery bad\b/gi,          replacement: "terrible",         message: '"Very bad" → "terrible"',               category: "word-choice",    severity: "style" },
  { id: "very-big",         pattern: /\bvery big\b/gi,          replacement: "enormous",         message: '"Very big" → "enormous"',               category: "word-choice",    severity: "style" },
  { id: "very-small",       pattern: /\bvery small\b/gi,        replacement: "tiny",             message: '"Very small" → "tiny"',                 category: "word-choice",    severity: "style" },
  { id: "very-cold",        pattern: /\bvery cold\b/gi,         replacement: "freezing",         message: '"Very cold" → "freezing"',              category: "word-choice",    severity: "style" },
  { id: "very-hot",         pattern: /\bvery hot\b/gi,          replacement: "scorching",        message: '"Very hot" → "scorching"',              category: "word-choice",    severity: "style" },
  { id: "very-fast",        pattern: /\bvery fast\b/gi,         replacement: "rapid",            message: '"Very fast" → "rapid"',                 category: "word-choice",    severity: "style" },
  { id: "very-slow",        pattern: /\bvery slow\b/gi,         replacement: "sluggish",         message: '"Very slow" → "sluggish"',              category: "word-choice",    severity: "style" },
  { id: "very-hard",        pattern: /\bvery hard\b/gi,         replacement: "extremely difficult", message: '"Very hard" → "extremely difficult"', category: "word-choice",    severity: "style" },
  { id: "very-easy",        pattern: /\bvery easy\b/gi,         replacement: "effortless",       message: '"Very easy" → "effortless"',            category: "word-choice",    severity: "style" },
  { id: "very-happy",       pattern: /\bvery happy\b/gi,        replacement: "thrilled",         message: '"Very happy" → "thrilled"',             category: "word-choice",    severity: "style" },
  { id: "very-sad",         pattern: /\bvery sad\b/gi,          replacement: "devastated",       message: '"Very sad" → "devastated"',             category: "word-choice",    severity: "style" },
  { id: "very-tired",       pattern: /\bvery tired\b/gi,        replacement: "exhausted",        message: '"Very tired" → "exhausted"',            category: "word-choice",    severity: "style" },
  { id: "very-important",   pattern: /\bvery important\b/gi,    replacement: "crucial",          message: '"Very important" → "crucial"',          category: "word-choice",    severity: "style" },
  { id: "very-interesting", pattern: /\bvery interesting\b/gi,  replacement: "fascinating",      message: '"Very interesting" → "fascinating"',    category: "word-choice",    severity: "style" },
  { id: "very-surprised",   pattern: /\bvery surprised\b/gi,    replacement: "astonished",       message: '"Very surprised" → "astonished"',       category: "word-choice",    severity: "style" },
  { id: "very-confused",    pattern: /\bvery confused\b/gi,     replacement: "baffled",          message: '"Very confused" → "baffled"',           category: "word-choice",    severity: "style" },
  { id: "very-angry",       pattern: /\bvery angry\b/gi,        replacement: "furious",          message: '"Very angry" → "furious"',              category: "word-choice",    severity: "style" },
  { id: "very-scared",      pattern: /\bvery scared\b/gi,       replacement: "terrified",        message: '"Very scared" → "terrified"',           category: "word-choice",    severity: "style" },
  { id: "very-funny",       pattern: /\bvery funny\b/gi,        replacement: "hilarious",        message: '"Very funny" → "hilarious"',            category: "word-choice",    severity: "style" },
  { id: "very-nice",        pattern: /\bvery nice\b/gi,         replacement: "wonderful",        message: '"Very nice" → "wonderful"',             category: "word-choice",    severity: "style" },
  { id: "very-pretty",      pattern: /\bvery pretty\b/gi,       replacement: "stunning",         message: '"Very pretty" → "stunning"',            category: "word-choice",    severity: "style" },
  { id: "very-smart",       pattern: /\bvery smart\b/gi,        replacement: "brilliant",        message: '"Very smart" → "brilliant"',            category: "word-choice",    severity: "style" },
  { id: "very-creative",    pattern: /\bvery creative\b/gi,     replacement: "innovative",       message: '"Very creative" → "innovative"',        category: "word-choice",    severity: "style" },
  { id: "very-brave",       pattern: /\bvery brave\b/gi,        replacement: "courageous",       message: '"Very brave" → "courageous"',           category: "word-choice",    severity: "style" },
  { id: "very-kind",        pattern: /\bvery kind\b/gi,         replacement: "generous",         message: '"Very kind" → "generous"',              category: "word-choice",    severity: "style" },
  { id: "very-powerful",    pattern: /\bvery powerful\b/gi,     replacement: "formidable",       message: '"Very powerful" → "formidable"',        category: "word-choice",    severity: "style" },
  { id: "really-good",      pattern: /\breally good\b/gi,       replacement: "outstanding",      message: '"Really good" → "outstanding"',         category: "word-choice",    severity: "style" },
  { id: "really-bad",       pattern: /\breally bad\b/gi,        replacement: "dreadful",         message: '"Really bad" → "dreadful"',             category: "word-choice",    severity: "style" },
  { id: "really-nice",      pattern: /\breally nice\b/gi,       replacement: "delightful",       message: '"Really nice" → "delightful"',          category: "word-choice",    severity: "style" },
  { id: "really-hard",      pattern: /\breally hard\b/gi,       replacement: "challenging",      message: '"Really hard" → "challenging"',         category: "word-choice",    severity: "style" },
  { id: "really-cool",      pattern: /\breally cool\b/gi,       replacement: "impressive",       message: '"Really cool" → "impressive"',          category: "word-choice",    severity: "style" },
  { id: "sort-of",          pattern: /\bsort of\b/gi,           replacement: "somewhat",         message: '"Sort of" → "somewhat"',                category: "word-choice",    severity: "style" },
  { id: "kind-of",          pattern: /\bkind of\b/gi,           replacement: "rather",           message: '"Kind of" → "rather"',                  category: "word-choice",    severity: "style" },
  { id: "a-lot-of",         pattern: /\ba lot of\b/gi,          replacement: "many",             message: '"A lot of" → "many" (or "much")',        category: "word-choice",    severity: "style" },
  { id: "lots-of",          pattern: /\blots of\b/gi,           replacement: "numerous",         message: '"Lots of" → "numerous"',                category: "word-choice",    severity: "style" },
  { id: "big-deal",         pattern: /\bbig deal\b/gi,          replacement: "significant matter", message: '"Big deal" → "significant matter"',   category: "word-choice",    severity: "style" },
  { id: "get-better",       pattern: /\bget better\b/gi,        replacement: "improve",          message: '"Get better" → "improve"',              category: "word-choice",    severity: "style" },
  { id: "get-worse",        pattern: /\bget worse\b/gi,         replacement: "deteriorate",      message: '"Get worse" → "deteriorate"',           category: "word-choice",    severity: "style" },
  { id: "get-started",      pattern: /\bget started\b/gi,       replacement: "begin",            message: '"Get started" → "begin"',               category: "word-choice",    severity: "style" },
  { id: "get-rid-of",       pattern: /\bget rid of\b/gi,        replacement: "eliminate",        message: '"Get rid of" → "eliminate"',            category: "word-choice",    severity: "style" },
  { id: "take-care-of",     pattern: /\btake care of\b/gi,      replacement: "handle",           message: '"Take care of" → "handle"',             category: "word-choice",    severity: "style" },
  { id: "make-sure",        pattern: /\bmake sure\b/gi,         replacement: "ensure",           message: '"Make sure" → "ensure"',                category: "word-choice",    severity: "style" },
  { id: "find-out",         pattern: /\bfind out\b/gi,          replacement: "discover",         message: '"Find out" → "discover"',               category: "word-choice",    severity: "style" },
  { id: "think-about",      pattern: /\bthink about\b/gi,       replacement: "consider",         message: '"Think about" → "consider"',            category: "word-choice",    severity: "style" },
  { id: "talk-about",       pattern: /\btalk about\b/gi,        replacement: "discuss",          message: '"Talk about" → "discuss"',              category: "word-choice",    severity: "style" },
  { id: "show-off",         pattern: /\bshow off\b/gi,          replacement: "demonstrate",      message: '"Show off" → "demonstrate"',            category: "word-choice",    severity: "style" },
  { id: "put-off",          pattern: /\bput off\b/gi,           replacement: "postpone",         message: '"Put off" → "postpone"',                category: "word-choice",    severity: "style" },
  { id: "come-up-with",     pattern: /\bcome up with\b/gi,      replacement: "develop",          message: '"Come up with" → "develop"',            category: "word-choice",    severity: "style" },
  { id: "look-into",        pattern: /\blook into\b/gi,         replacement: "investigate",      message: '"Look into" → "investigate"',           category: "word-choice",    severity: "style" },
  { id: "go-along-with",    pattern: /\bgo along with\b/gi,     replacement: "agree with",       message: '"Go along with" → "agree with"',        category: "word-choice",    severity: "style" },
  { id: "deal-with",        pattern: /\bdeal with\b/gi,         replacement: "address",          message: '"Deal with" → "address"',               category: "word-choice",    severity: "style" },
  { id: "end-up",           pattern: /\bend up\b/gi,            replacement: "ultimately",       message: '"End up" → "ultimately"',               category: "word-choice",    severity: "style" },
  { id: "go-ahead",         pattern: /\bgo ahead\b/gi,          replacement: "proceed",          message: '"Go ahead" → "proceed"',                category: "word-choice",    severity: "style" },
  { id: "pick-up",          pattern: /\bpick up\b/gi,           replacement: "collect",          message: '"Pick up" → "collect"',                 category: "word-choice",    severity: "style" },
  { id: "bring-up",         pattern: /\bbring up\b/gi,          replacement: "mention",          message: '"Bring up" → "mention"',                category: "word-choice",    severity: "style" },
  { id: "set-up",           pattern: /\bset up\b/gi,            replacement: "establish",        message: '"Set up" → "establish"',                category: "word-choice",    severity: "style" },
  { id: "point-out",        pattern: /\bpoint out\b/gi,         replacement: "highlight",        message: '"Point out" → "highlight"',             category: "word-choice",    severity: "style" },
  { id: "ask-for",          pattern: /\bask for\b/gi,           replacement: "request",          message: '"Ask for" → "request"',                 category: "word-choice",    severity: "style" },
];

// ─── Word Alternatives Dictionary ─────────────────────────────────────────────
// Maps common/weak words to stronger, more precise alternatives
// Used for real-time chip suggestions as the user types
export const WORD_ALTERNATIVES: Record<string, string[]> = {
  // Common adjectives → stronger
  "good":        ["great", "excellent", "superb", "outstanding", "exceptional"],
  "bad":         ["poor", "terrible", "dreadful", "awful", "unacceptable"],
  "big":         ["large", "enormous", "substantial", "massive", "significant"],
  "small":       ["tiny", "minuscule", "compact", "minimal", "negligible"],
  "nice":        ["pleasant", "delightful", "wonderful", "charming", "lovely"],
  "cool":        ["impressive", "remarkable", "exceptional", "admirable"],
  "awesome":     ["incredible", "spectacular", "phenomenal", "extraordinary"],
  "amazing":     ["astounding", "remarkable", "extraordinary", "breathtaking"],
  "great":       ["superb", "outstanding", "exceptional", "magnificent", "splendid"],
  "terrible":    ["dreadful", "atrocious", "horrendous", "appalling", "disastrous"],
  "horrible":    ["dreadful", "atrocious", "appalling", "ghastly", "abysmal"],
  "awful":       ["dreadful", "atrocious", "appalling", "horrendous", "ghastly"],
  "funny":       ["hilarious", "amusing", "comical", "witty", "entertaining"],
  "pretty":      ["beautiful", "stunning", "gorgeous", "exquisite", "elegant"],
  "ugly":        ["unattractive", "unsightly", "hideous", "grotesque"],
  "smart":       ["intelligent", "brilliant", "clever", "astute", "perceptive"],
  "dumb":        ["unintelligent", "foolish", "misguided", "unwise"],
  "stupid":      ["foolish", "unwise", "absurd", "irrational", "illogical"],
  "happy":       ["delighted", "elated", "thrilled", "overjoyed", "ecstatic"],
  "sad":         ["sorrowful", "melancholic", "dejected", "heartbroken", "dismayed"],
  "angry":       ["furious", "irate", "indignant", "enraged", "incensed"],
  "tired":       ["exhausted", "fatigued", "weary", "drained", "spent"],
  "scared":      ["terrified", "petrified", "horrified", "apprehensive", "anxious"],
  "surprised":   ["astonished", "astounded", "amazed", "stunned", "bewildered"],
  "confused":    ["baffled", "perplexed", "puzzled", "bewildered", "disoriented"],
  "excited":     ["thrilled", "elated", "enthusiastic", "exhilarated", "eager"],
  "boring":      ["tedious", "monotonous", "mundane", "uninteresting", "dull"],
  "interesting": ["fascinating", "intriguing", "captivating", "compelling", "engaging"],
  "important":   ["crucial", "essential", "vital", "significant", "critical"],
  "difficult":   ["challenging", "demanding", "complex", "arduous", "formidable"],
  "easy":        ["effortless", "straightforward", "simple", "uncomplicated", "manageable"],
  "fast":        ["rapid", "swift", "brisk", "speedy", "expeditious"],
  "slow":        ["gradual", "sluggish", "leisurely", "unhurried", "deliberate"],
  "old":         ["ancient", "aged", "vintage", "archaic", "dated"],
  "new":         ["innovative", "novel", "modern", "fresh", "contemporary"],
  "hot":         ["scorching", "sweltering", "boiling", "blazing", "intense"],
  "cold":        ["frigid", "freezing", "icy", "chilly", "bitter"],
  "loud":        ["deafening", "booming", "thunderous", "piercing", "resonant"],
  "quiet":       ["silent", "hushed", "subdued", "tranquil", "serene"],
  "clean":       ["immaculate", "spotless", "pristine", "flawless", "unblemished"],
  "dirty":       ["filthy", "grimy", "contaminated", "unsanitary", "foul"],
  "strange":     ["peculiar", "bizarre", "unusual", "eccentric", "unconventional"],
  "normal":      ["typical", "conventional", "standard", "ordinary", "routine"],
  "strong":      ["powerful", "robust", "formidable", "vigorous", "resilient"],
  "weak":        ["frail", "vulnerable", "feeble", "inadequate", "insufficient"],
  "brave":       ["courageous", "valiant", "fearless", "bold", "audacious"],
  "creative":    ["innovative", "inventive", "imaginative", "ingenious", "original"],
  "kind":        ["compassionate", "generous", "benevolent", "thoughtful", "considerate"],
  "mean":        ["cruel", "malicious", "unkind", "spiteful", "harsh"],
  "rich":        ["wealthy", "affluent", "prosperous", "well-off", "opulent"],
  "poor":        ["impoverished", "destitute", "underprivileged", "struggling"],
  "talented":    ["gifted", "skilled", "accomplished", "exceptional", "proficient"],

  // Common verbs → stronger
  "get":         ["obtain", "acquire", "receive", "retrieve", "secure"],
  "got":         ["obtained", "acquired", "received", "secured", "achieved"],
  "go":          ["proceed", "advance", "travel", "navigate", "venture"],
  "went":        ["proceeded", "advanced", "traveled", "ventured", "journeyed"],
  "do":          ["perform", "execute", "accomplish", "complete", "implement"],
  "did":         ["performed", "executed", "accomplished", "achieved", "implemented"],
  "make":        ["create", "produce", "develop", "construct", "generate"],
  "made":        ["created", "produced", "developed", "constructed", "generated"],
  "say":         ["state", "express", "declare", "assert", "communicate"],
  "said":        ["stated", "expressed", "declared", "asserted", "communicated"],
  "tell":        ["inform", "notify", "advise", "communicate", "convey"],
  "told":        ["informed", "notified", "advised", "communicated", "conveyed"],
  "think":       ["believe", "consider", "conclude", "perceive", "determine"],
  "know":        ["understand", "comprehend", "recognize", "realize", "grasp"],
  "see":         ["observe", "notice", "perceive", "witness", "detect"],
  "look":        ["examine", "inspect", "observe", "review", "assess"],
  "want":        ["desire", "seek", "aim for", "aspire to", "require"],
  "need":        ["require", "demand", "necessitate", "depend on"],
  "try":         ["attempt", "endeavor", "strive", "pursue", "undertake"],
  "help":        ["assist", "support", "aid", "facilitate", "guide"],
  "use":         ["utilize", "apply", "employ", "leverage", "implement"],
  "start":       ["initiate", "commence", "launch", "introduce", "establish"],
  "stop":        ["cease", "halt", "discontinue", "terminate", "conclude"],
  "show":        ["demonstrate", "illustrate", "reveal", "display", "present"],
  "keep":        ["maintain", "preserve", "retain", "sustain", "uphold"],
  "change":      ["modify", "alter", "transform", "adjust", "revise"],
  "give":        ["provide", "offer", "deliver", "supply", "present"],
  "take":        ["obtain", "acquire", "seize", "capture", "assume"],
  "find":        ["discover", "locate", "identify", "detect", "uncover"],
  "ask":         ["inquire", "request", "question", "consult", "query"],
  "work":        ["function", "operate", "perform", "effort", "endeavor"],
  "talk":        ["discuss", "communicate", "converse", "consult", "deliberate"],
  "learn":       ["acquire knowledge", "study", "master", "develop", "absorb"],
  "understand":  ["comprehend", "grasp", "recognize", "appreciate", "perceive"],
  "explain":     ["clarify", "describe", "illustrate", "elaborate", "detail"],
  "share":       ["distribute", "communicate", "convey", "disclose", "exchange"],
  "improve":     ["enhance", "develop", "optimize", "refine", "advance"],
  "create":      ["develop", "design", "build", "establish", "produce"],
  "increase":    ["enhance", "amplify", "boost", "expand", "grow"],
  "decrease":    ["reduce", "diminish", "lower", "minimize", "decline"],

  // Common nouns → stronger
  "thing":       ["item", "element", "factor", "aspect", "component"],
  "things":      ["items", "elements", "factors", "aspects", "components"],
  "idea":        ["concept", "notion", "proposal", "approach", "strategy"],
  "problem":     ["challenge", "issue", "obstacle", "complication", "difficulty"],
  "solution":    ["resolution", "remedy", "answer", "fix", "approach"],
  "way":         ["method", "approach", "strategy", "technique", "process"],
  "place":       ["location", "site", "venue", "position", "destination"],
  "time":        ["moment", "period", "duration", "phase", "occasion"],
  "part":        ["component", "element", "section", "aspect", "portion"],
  "point":       ["argument", "statement", "observation", "conclusion", "insight"],
  "reason":      ["rationale", "justification", "explanation", "motive", "basis"],
  "result":      ["outcome", "consequence", "effect", "conclusion", "impact"],
  "goal":        ["objective", "target", "aim", "ambition", "aspiration"],
  "plan":        ["strategy", "approach", "framework", "blueprint", "roadmap"],
  "job":         ["position", "role", "responsibility", "career", "profession"],
  "task":        ["project", "assignment", "responsibility", "objective", "endeavor"],
  "friend":      ["companion", "ally", "colleague", "associate", "confidant"],
  "group":       ["team", "collective", "cohort", "community", "assembly"],
  "information": ["data", "details", "knowledge", "intelligence", "insight"],
  "story":       ["narrative", "account", "report", "description", "chronicle"],

  // Common adverbs
  "very":        ["extremely", "remarkably", "exceptionally", "significantly", "profoundly"],
  "really":      ["genuinely", "truly", "thoroughly", "absolutely", "considerably"],
  "just":        ["simply", "merely", "only", "precisely", "exactly"],
  "quite":       ["rather", "fairly", "considerably", "notably", "substantially"],
  "always":      ["consistently", "invariably", "perpetually", "constantly", "unfailingly"],
  "never":       ["not once", "at no time", "under no circumstances"],
  "often":       ["frequently", "regularly", "commonly", "consistently", "repeatedly"],
  "sometimes":   ["occasionally", "periodically", "intermittently", "sporadically"],
  "quickly":     ["rapidly", "swiftly", "promptly", "expeditiously", "briskly"],
  "slowly":      ["gradually", "leisurely", "unhurriedly", "deliberately"],
  "clearly":     ["evidently", "obviously", "plainly", "unmistakably", "transparently"],
  "easily":      ["effortlessly", "readily", "smoothly", "without difficulty"],
  "strongly":    ["powerfully", "forcefully", "vigorously", "firmly", "resolutely"],
  "basically":   ["fundamentally", "essentially", "primarily", "in essence"],
  "honestly":    ["candidly", "sincerely", "frankly", "truthfully", "genuinely"],
  "personally":  ["individually", "in my view", "from my perspective"],
  "actually":    ["in fact", "indeed", "in reality", "genuinely", "truly"],
  "probably":    ["likely", "presumably", "in all likelihood", "arguably"],
  "definitely":  ["certainly", "undoubtedly", "absolutely", "unquestionably"],
  "exactly":     ["precisely", "accurately", "specifically", "meticulously"],
  "almost":      ["nearly", "practically", "virtually", "approximately"],
};

// ─── Category & Severity Metadata ────────────────────────────────────────────
export const CATEGORY_META: Record<SuggestionCategory, { label: string; color: string; bg: string }> = {
  grammar:        { label: "Grammar",       color: "rgb(248,113,113)",   bg: "rgba(248,113,113,0.12)"  },
  apostrophe:     { label: "Apostrophe",    color: "rgb(251,146,60)",    bg: "rgba(251,146,60,0.12)"   },
  capitalization: { label: "Capital",       color: "rgb(250,204,21)",    bg: "rgba(250,204,21,0.10)"   },
  spelling:       { label: "Spelling",      color: "rgb(248,113,113)",   bg: "rgba(248,113,113,0.12)"  },
  punctuation:    { label: "Punctuation",   color: "rgb(251,146,60)",    bg: "rgba(251,146,60,0.10)"   },
  "word-choice":  { label: "Word Choice",   color: "rgb(129,140,248)",   bg: "rgba(129,140,248,0.12)"  },
  clarity:        { label: "Clarity",       color: "rgb(52,211,153)",    bg: "rgba(52,211,153,0.10)"   },
  tone:           { label: "Tone",          color: "rgb(167,139,250)",   bg: "rgba(167,139,250,0.12)"  },
  meaning:        { label: "Meaning",       color: "rgb(34,211,238)",    bg: "rgba(34,211,238,0.10)"   },
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

// ─── Apply all non-conflicting suggestions at once ────────────────────────────
export function applyAllSuggestions(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 3) return text;

  let result = trimmed;
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(result)) {
      rule.pattern.lastIndex = 0;
      result = result.replace(rule.pattern, rule.replacement);
      rule.pattern.lastIndex = 0;
    }
  }
  return result;
}

// ─── Get word alternatives for the last fully-typed word ─────────────────────
export function getWordAlternatives(text: string, cursorPos: number): { word: string; alternatives: string[]; wordStart: number; wordEnd: number } | null {
  if (!text || cursorPos < 1) return null;

  // Find word boundaries around cursor
  let start = cursorPos;
  while (start > 0 && /\w/.test(text[start - 1])) start--;
  let end = cursorPos;
  while (end < text.length && /\w/.test(text[end])) end++;

  const word = text.slice(start, end).toLowerCase();
  if (!word || word.length < 2) return null;

  const alternatives = WORD_ALTERNATIVES[word];
  if (!alternatives || alternatives.length === 0) return null;

  return { word, alternatives, wordStart: start, wordEnd: end };
}

// ─── Apply a word alternative at a specific position ─────────────────────────
export function applyWordAlternative(text: string, wordStart: number, wordEnd: number, alternative: string): string {
  const before = text.slice(0, wordStart);
  const after = text.slice(wordEnd);
  // Preserve original capitalization if the word was capitalized
  const original = text.slice(wordStart, wordEnd);
  let result = alternative;
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    result = alternative[0].toUpperCase() + alternative.slice(1);
  }
  return before + result + after;
}

// ─── Legacy single-suggestion compat ─────────────────────────────────────────
export function checkGrammar(text: string): GrammarSuggestion | null {
  return checkGrammarAll(text)[0] ?? null;
}
