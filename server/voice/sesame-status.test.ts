import { afterEach, describe, expect, it } from "vitest";
import {
  getSesameHostSnapshot,
  recordSesameHostResult,
  resetSesameHostSnapshotForTests,
  sesameHostAlertFromSnapshot,
} from "./sesame-status";

const saved = {
  FAL_KEY: process.env.FAL_KEY,
  FAL_API_KEY: process.env.FAL_API_KEY,
  AI_VOICE_FAL_KEY: process.env.AI_VOICE_FAL_KEY,
  DEEPINFRA_TOKEN: process.env.DEEPINFRA_TOKEN,
  DEEPINFRA_API_KEY: process.env.DEEPINFRA_API_KEY,
  AI_VOICE_DEEPINFRA_TOKEN: process.env.AI_VOICE_DEEPINFRA_TOKEN,
  HF_TOKEN: process.env.HF_TOKEN,
  AI_VOICE_HF_TOKEN: process.env.AI_VOICE_HF_TOKEN,
  HUGGINGFACE_TOKEN: process.env.HUGGINGFACE_TOKEN,
  HUGGING_FACE_HUB_TOKEN: process.env.HUGGING_FACE_HUB_TOKEN,
  HUGGINGFACEHUB_API_TOKEN: process.env.HUGGINGFACEHUB_API_TOKEN,
};

afterEach(() => {
  resetSesameHostSnapshotForTests();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("sesame host snapshot", () => {
  it("treats dual GPU keys as durable and never-expiring by date", () => {
    process.env.FAL_KEY = "fal-test";
    process.env.DEEPINFRA_TOKEN = "di-test";
    delete process.env.FAL_API_KEY;
    delete process.env.AI_VOICE_FAL_KEY;
    delete process.env.DEEPINFRA_API_KEY;
    delete process.env.AI_VOICE_DEEPINFRA_TOKEN;
    delete process.env.HF_TOKEN;
    delete process.env.AI_VOICE_HF_TOKEN;
    delete process.env.HUGGINGFACE_TOKEN;
    delete process.env.HUGGING_FACE_HUB_TOKEN;
    delete process.env.HUGGINGFACEHUB_API_TOKEN;
    const snap = getSesameHostSnapshot();
    expect(snap.durableKeys).toBe(true);
    expect(snap.hasFalKey).toBe(true);
    expect(snap.hasDeepinfraKey).toBe(true);
    expect(snap.guidance.some((line) => /do not expire by calendar date/i.test(line))).toBe(true);
  });

  it("alerts on credits (402) without calling it token expiry", () => {
    process.env.FAL_KEY = "fal-test";
    recordSesameHostResult(false, "HTTP 402 Payment Required insufficient credits");
    const snap = getSesameHostSnapshot();
    expect(snap.state).toBe("credits");
    const alert = sesameHostAlertFromSnapshot(snap);
    expect(alert?.title).toMatch(/credits/i);
    expect(alert?.message).toMatch(/did not expire/i);
  });

  it("alerts on unauthorized (401) and tells you to mint keys with no expiry", () => {
    process.env.DEEPINFRA_TOKEN = "di-test";
    recordSesameHostResult(false, "401 unauthorized invalid token");
    const snap = getSesameHostSnapshot();
    expect(snap.state).toBe("unauthorized");
    const alert = sesameHostAlertFromSnapshot(snap);
    expect(alert?.title).toMatch(/rejected/i);
    expect(alert?.message).toMatch(/no expiry/i);
  });
});
