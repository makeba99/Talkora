import { describe, expect, it } from "vitest";
import { talkingAiDailyLimit } from "@shared/entitlements";

describe("talking AI quota helpers", () => {
  it("keeps free users on the daily cap and VIP/admin unlimited", () => {
    expect(talkingAiDailyLimit({ role: "user", vipTier: null })).toBe(20);
    expect(talkingAiDailyLimit({ role: "user", vipTier: "coffee" })).toBeNull();
    expect(talkingAiDailyLimit({ role: "admin", vipTier: null })).toBeNull();
  });
});
