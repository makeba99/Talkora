export type GrammarSuggestion = {
  original: string;
  corrected: string;
  message: string;
};

const RULES: Array<{
  pattern: RegExp;
  replacement: string;
  message: string;
}> = [
  { pattern: /\byour welcome\b/gi, replacement: "you're welcome", message: "\"your\" → \"you're\"" },
  { pattern: /\btheir is\b/gi, replacement: "there is", message: "\"their\" → \"there\"" },
  { pattern: /\bthere going\b/gi, replacement: "they're going", message: "\"there\" → \"they're\"" },
  { pattern: /\bits a\b/gi, replacement: "it's a", message: "\"its\" → \"it's\"" },
  { pattern: /\bi\b(?!\s*[a-z])/g, replacement: "I", message: "\"i\" should be capitalised to \"I\"" },
  { pattern: /\bi'm\b/gi, replacement: "I'm", message: "\"i'm\" → \"I'm\"" },
  { pattern: /\bi've\b/gi, replacement: "I've", message: "\"i've\" → \"I've\"" },
  { pattern: /\bi'll\b/gi, replacement: "I'll", message: "\"i'll\" → \"I'll\"" },
  { pattern: /\bi'd\b/gi, replacement: "I'd", message: "\"i'd\" → \"I'd\"" },
  { pattern: /\bi was\b/gi, replacement: "I was", message: "\"i\" → \"I\"" },
  { pattern: /\bi am\b/gi, replacement: "I am", message: "\"i am\" → \"I am\"" },
  { pattern: /\bdont\b/gi, replacement: "don't", message: "Missing apostrophe: \"dont\" → \"don't\"" },
  { pattern: /\bcant\b/gi, replacement: "can't", message: "Missing apostrophe: \"cant\" → \"can't\"" },
  { pattern: /\bwont\b/gi, replacement: "won't", message: "Missing apostrophe: \"wont\" → \"won't\"" },
  { pattern: /\bwasnt\b/gi, replacement: "wasn't", message: "Missing apostrophe: \"wasnt\" → \"wasn't\"" },
  { pattern: /\bisnt\b/gi, replacement: "isn't", message: "Missing apostrophe: \"isnt\" → \"isn't\"" },
  { pattern: /\bdidnt\b/gi, replacement: "didn't", message: "Missing apostrophe: \"didnt\" → \"didn't\"" },
  { pattern: /\bcouldnt\b/gi, replacement: "couldn't", message: "Missing apostrophe: \"couldnt\" → \"couldn't\"" },
  { pattern: /\bwouldnt\b/gi, replacement: "wouldn't", message: "Missing apostrophe: \"wouldnt\" → \"wouldn't\"" },
  { pattern: /\bshouldnt\b/gi, replacement: "shouldn't", message: "Missing apostrophe: \"shouldnt\" → \"shouldn't\"" },
  { pattern: /\bhavent\b/gi, replacement: "haven't", message: "Missing apostrophe: \"havent\" → \"haven't\"" },
  { pattern: /\bhasnt\b/gi, replacement: "hasn't", message: "Missing apostrophe: \"hasnt\" → \"hasn't\"" },
  { pattern: /\bim\b/gi, replacement: "I'm", message: "\"im\" → \"I'm\"" },
  { pattern: /  +/g, replacement: " ", message: "Extra space detected" },
  { pattern: /,([^ \n])/g, replacement: ", $1", message: "Missing space after comma" },
  { pattern: /\.([A-Z])/g, replacement: ". $1", message: "Missing space after period" },
  { pattern: /\bshould of\b/gi, replacement: "should have", message: "\"should of\" → \"should have\"" },
  { pattern: /\bcould of\b/gi, replacement: "could have", message: "\"could of\" → \"could have\"" },
  { pattern: /\bwould of\b/gi, replacement: "would have", message: "\"would of\" → \"would have\"" },
  { pattern: /\bmust of\b/gi, replacement: "must have", message: "\"must of\" → \"must have\"" },
  { pattern: /\bto much\b/gi, replacement: "too much", message: "\"to much\" → \"too much\"" },
  { pattern: /\bto many\b/gi, replacement: "too many", message: "\"to many\" → \"too many\"" },
  { pattern: /\balot\b/gi, replacement: "a lot", message: "\"alot\" → \"a lot\"" },
  { pattern: /\bno body\b/gi, replacement: "nobody", message: "\"no body\" → \"nobody\"" },
  { pattern: /\bsome times\b/gi, replacement: "sometimes", message: "\"some times\" → \"sometimes\"" },
  { pattern: /\bof course\b/gi, replacement: "of course", message: "" },
];

export function checkGrammar(text: string): GrammarSuggestion | null {
  const trimmed = text.trim();
  if (trimmed.length < 4) return null;

  for (const rule of RULES) {
    if (!rule.message) continue;
    if (rule.pattern.test(trimmed)) {
      rule.pattern.lastIndex = 0;
      const corrected = trimmed.replace(rule.pattern, rule.replacement);
      if (corrected !== trimmed) {
        return { original: trimmed, corrected, message: rule.message };
      }
    }
    rule.pattern.lastIndex = 0;
  }
  return null;
}
