import { describe, expect, it } from "vitest";
import { isNearDuplicateTurn, matchStopTutorPhrase } from "./tutor-session-phrases";
import { tutorPlaybackRate } from "./tutor-tts-pace";

describe("matchStopTutorPhrase", () => {
  it("closes on bye / close with Maya, Miles, or AI", () => {
    expect(matchStopTutorPhrase("bye Maya")).toBe(true);
    expect(matchStopTutorPhrase("bye Miles")).toBe(true);
    expect(matchStopTutorPhrase("bye Niles")).toBe(true);
    expect(matchStopTutorPhrase("bye AI")).toBe(true);
    expect(matchStopTutorPhrase("ok close")).toBe(true);
    expect(matchStopTutorPhrase("okay close")).toBe(true);
    expect(matchStopTutorPhrase("goodbye")).toBe(true);
    expect(matchStopTutorPhrase("bye I")).toBe(true);
    expect(matchStopTutorPhrase("bye AI have a wonderful day")).toBe(true);
    expect(matchStopTutorPhrase("bye Maya have a great day")).toBe(true);
    expect(matchStopTutorPhrase("by AI")).toBe(true);
  });

  it("does not close on ordinary talk", () => {
    expect(matchStopTutorPhrase("ok")).toBe(false);
    expect(matchStopTutorPhrase("Maya what's 2 plus 2")).toBe(false);
    expect(matchStopTutorPhrase("bye I went to paris")).toBe(false);
  });
});

describe("isNearDuplicateTurn", () => {
  it("flags the same utterance, not a follow-up sentence", () => {
    expect(isNearDuplicateTurn("I like Paris a lot", "i like paris a lot")).toBe(true);
    expect(isNearDuplicateTurn("I like Paris", "What should I visit next in Paris?")).toBe(false);
  });
});

describe("tutorPlaybackRate", () => {
  it("plays Sesame WAV at native speed and Edge MPEG slower", () => {
    expect(tutorPlaybackRate("audio/wav")).toBe(1);
    expect(tutorPlaybackRate("audio/mpeg")).toBe(0.92);
  });
});
