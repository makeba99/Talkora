import { describe, expect, it } from "vitest";
import { extractCompleteSentences, packSpokenUtterances, sanitizeSpokenTutorLine, shapeSpokenProsody } from "./spoken-tutor-line";

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

  it("keeps spoken emotional reactions that a voice can actually say", () => {
    expect(sanitizeSpokenTutorLine("Oh wow, that sounds amazing.")).toBe("Oh wow, that sounds amazing.");
    expect(sanitizeSpokenTutorLine("Haha, I can picture that.")).toBe("Haha, I can picture that.");
    expect(sanitizeSpokenTutorLine("Aww, I'm happy for you.")).toBe("Aww, I'm happy for you.");
    expect(sanitizeSpokenTutorLine("Ah, that's so sweet.")).toBe("Ah, that's so sweet.");
  });

  it("keeps complete spoken answers", () => {
    expect(sanitizeSpokenTutorLine("Paris is great in the spring.")).toBe("Paris is great in the spring.");
  });

  it("never speaks unavailable / system-status lines", () => {
    expect(sanitizeSpokenTutorLine("Talking AI is unavailable right now. Please try again in a moment.")).toBeNull();
    expect(sanitizeSpokenTutorLine("Configured AI voice unavailable")).toBeNull();
  });
});

describe("extractCompleteSentences", () => {
  it("does not flush a trailing unfinished clause", () => {
    const [done, rest] = extractCompleteSentences("Nice. I was thinking about the");
    expect(done).toEqual(["Nice."]);
    expect(rest).toContain("thinking about the");
  });
});

describe("shapeSpokenProsody", () => {
  it("turns dashes and ellipses into comma breaths Sesame can speak", () => {
    expect(shapeSpokenProsody("I missed that — could you say it again?")).toBe(
      "I missed that, could you say it again?",
    );
    expect(shapeSpokenProsody("Wait... really?")).toBe("Wait, really?");
  });

  it("adds a comma after a spoken reaction and drops stage directions", () => {
    expect(shapeSpokenProsody("Oh wow that sounds amazing.")).toBe("Oh wow, that sounds amazing.");
    expect(shapeSpokenProsody("Haha I can picture that.")).toBe("Haha, I can picture that.");
    expect(shapeSpokenProsody("Aww, I'm happy for you. *laughs*")).toBe("Aww, I'm happy for you.");
  });

  it("is safe to run twice", () => {
    const once = shapeSpokenProsody("Oh wow that is huge!");
    expect(shapeSpokenProsody(once)).toBe(once);
  });
});

describe("packSpokenUtterances", () => {
  it("keeps reaction and insight in one spoken chunk", () => {
    expect(
      packSpokenUtterances(["Oh wow, that sounds amazing.", "Tell me what you liked most about Paris."]),
    ).toEqual(["Oh wow, that sounds amazing. Tell me what you liked most about Paris."]);
  });

  it("leaves a leftover third sentence as its own chunk", () => {
    expect(packSpokenUtterances(["One.", "Two.", "Three."])).toEqual(["One. Two.", "Three."]);
  });
});
