import { describe, expect, it } from "vitest";
import { detectRepetitiveHistory, isDuplicateReply, lastAssistantText } from "./ai-anti-repeat";

describe("anti-repeat", () => {
  it("detects identical and near-duplicate replies", () => {
    expect(isDuplicateReply("How are you today?", "How are you today?")).toBe(true);
    expect(
      isDuplicateReply(
        "Nice! What did you like most about Paris?",
        "Nice what did you like most about paris",
      ),
    ).toBe(true);
    expect(isDuplicateReply("The food in Paris was amazing.", "How are you?")).toBe(false);
  });

  it("flags looping history", () => {
    expect(detectRepetitiveHistory(["how are you?", "how are you?"])).toBe(true);
    expect(detectRepetitiveHistory(["nice, what about paris?", "the food was the best part"])).toBe(false);
  });

  it("reads the last assistant turn", () => {
    expect(
      lastAssistantText([
        { role: "user", content: "hi" },
        { role: "assistant", content: "Hey!" },
        { role: "user", content: "paris" },
      ]),
    ).toBe("Hey!");
  });
});
