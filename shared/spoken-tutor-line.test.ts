import { describe, expect, it } from "vitest";
import { extractCompleteSentences, sanitizeSpokenTutorLine } from "./spoken-tutor-line";

describe("sanitizeSpokenTutorLine", () => {
  it("drops hmm/mm fillers and stall phrases", () => {
    expect(sanitizeSpokenTutorLine("Hmm.")).toBeNull();
    expect(sanitizeSpokenTutorLine("Mm.")).toBeNull();
    expect(sanitizeSpokenTutorLine("Mm-hmm.")).toBeNull();
    expect(sanitizeSpokenTutorLine("Let me think. What city was that?")).toBe("What city was that?");
  });

  it("drops incomplete fragments", () => {
    expect(sanitizeSpokenTutorLine("I was thinking about the")).toBeNull();
    expect(sanitizeSpokenTutorLine("So anyway...")).toBeNull();
  });

  it("keeps complete spoken answers", () => {
    expect(sanitizeSpokenTutorLine("Paris is great in the spring.")).toBe("Paris is great in the spring.");
  });
});

describe("extractCompleteSentences", () => {
  it("does not flush a trailing unfinished clause", () => {
    const [done, rest] = extractCompleteSentences("Nice. I was thinking about the");
    expect(done).toEqual(["Nice."]);
    expect(rest).toContain("thinking about the");
  });
});
