/**
 * Web Push notification service — VAPID / web-push fan-out.
 * Keeps send logic out of React and route handlers.
 */
import webpush from "web-push";
import { storage } from "./storage";
import type { PushSubscription } from "@shared/schema";

export type PushAudience =
  | "all_subscribed"
  | "active_7d"
  | "inactive_1d"
  | "inactive_3d"
  | "inactive_7d"
  | "inactive_14d"
  | "inactive_30d"
  | "vip"
  | "non_vip"
  | "never_joined_room"
  | "test_self";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  image?: string;
  campaignId?: string;
};

export type PushSendResult = {
  campaignId: string | null;
  targetUsers: number;
  targetDevices: number;
  attempted: number;
  accepted: number;
  failed: number;
  invalidRemoved: number;
};

const VAPID_SUBJECT = "mailto:hello@vextorn.app";

function ensureVapidConfigured(): { publicKey: string; privateKey: string } {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw Object.assign(new Error("VAPID keys not configured"), { status: 503 });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
  return { publicKey, privateKey };
}

/** Only allow relative app paths or same-origin absolute URLs. */
export function sanitizePushUrl(raw: string | undefined | null): string {
  const fallback = "/";
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    // Block javascript: and data: smuggled into path somehow
    if (/[\x00-\x1f]/.test(trimmed)) return fallback;
    return trimmed.slice(0, 500);
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return fallback;
    // Relative-ize known production hosts later; for now keep path+search only
    // if hostname matches request host — callers should prefer relative paths.
    return `${u.pathname}${u.search}${u.hash}`.slice(0, 500) || fallback;
  } catch {
    return fallback;
  }
}

export function sanitizePushText(raw: string, max: number): string {
  return String(raw || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

function inactiveDaysForAudience(audience: PushAudience): number | null {
  switch (audience) {
    case "inactive_1d": return 1;
    case "inactive_3d": return 3;
    case "inactive_7d": return 7;
    case "inactive_14d": return 14;
    case "inactive_30d": return 30;
    default: return null;
  }
}

export async function resolvePushSubscriptions(opts: {
  audience: PushAudience;
  adminUserId: string;
}): Promise<{ subs: PushSubscription[]; userIds: Set<string> }> {
  const { audience, adminUserId } = opts;

  if (audience === "test_self") {
    const mine = await storage.getActivePushSubscriptionsByUser(adminUserId);
    return { subs: mine, userIds: new Set(mine.map((s) => s.userId)) };
  }

  let subs = await storage.getActivePushSubscriptions();

  if (audience === "all_subscribed") {
    return { subs, userIds: new Set(subs.map((s) => s.userId)) };
  }

  const userIds = [...new Set(subs.map((s) => s.userId))];
  if (userIds.length === 0) return { subs: [], userIds: new Set() };

  const profilesMap = await storage.getUsersByIds(userIds);
  const profiles = Array.from(profilesMap.values());

  const inactiveDays = inactiveDaysForAudience(audience);
  const now = Date.now();

  const allowed = new Set<string>();

  if (audience === "vip" || audience === "non_vip") {
    for (const u of profiles) {
      const isVip = !!(u.vipTier && String(u.vipTier).length > 0 && u.vipTier !== "none");
      if (audience === "vip" ? isVip : !isVip) allowed.add(u.id);
    }
  } else if (audience === "active_7d") {
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    for (const u of profiles) {
      const seen = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
      const updated = u.updatedAt ? new Date(u.updatedAt).getTime() : 0;
      if (Math.max(seen, updated) >= cutoff) allowed.add(u.id);
    }
  } else if (inactiveDays != null) {
    const cutoff = now - inactiveDays * 24 * 60 * 60 * 1000;
    for (const u of profiles) {
      const seen = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
      const updated = u.updatedAt ? new Date(u.updatedAt).getTime() : 0;
      const last = Math.max(seen, updated);
      // Never-seen users (no lastSeen) count as inactive
      if (!last || last < cutoff) allowed.add(u.id);
    }
  } else if (audience === "never_joined_room") {
    const joined = await storage.getUserIdsWhoJoinedRooms(userIds);
    for (const id of userIds) {
      if (!joined.has(id)) allowed.add(id);
    }
  } else {
    for (const id of userIds) allowed.add(id);
  }

  subs = subs.filter((s) => allowed.has(s.userId));
  return { subs, userIds: allowed };
}

export async function previewPushAudience(opts: {
  audience: PushAudience;
  adminUserId: string;
}): Promise<{ users: number; devices: number }> {
  const { subs, userIds } = await resolvePushSubscriptions(opts);
  return { users: userIds.size, devices: subs.length };
}

async function sendToSubscription(
  sub: PushSubscription,
  payloadJson: string,
): Promise<"accepted" | "invalid" | "failed"> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payloadJson,
      { TTL: 60 * 60 * 12, urgency: "normal" },
    );
    await storage.touchPushSubscriptionSuccess(sub.endpoint).catch(() => {});
    return "accepted";
  } catch (err: any) {
    const code = err?.statusCode ?? err?.status;
    // Gone / Not Found → permanently invalid
    if (code === 404 || code === 410) {
      await storage.deactivatePushSubscription(sub.endpoint, true).catch(() => {});
      return "invalid";
    }
    // Unauthorized / Forbidden often means keys rotated or sub revoked
    if (code === 401 || code === 403) {
      await storage.deactivatePushSubscription(sub.endpoint, true).catch(() => {});
      return "invalid";
    }
    await storage.incrementPushSubscriptionFailure(sub.endpoint).catch(() => {});
    return "failed";
  }
}

export async function sendPushCampaign(opts: {
  adminUserId: string;
  title: string;
  body: string;
  url?: string;
  imageUrl?: string;
  audience: PushAudience;
  isTest?: boolean;
}): Promise<PushSendResult> {
  ensureVapidConfigured();

  const title = sanitizePushText(opts.title, 80);
  const body = sanitizePushText(opts.body, 240);
  if (!title || !body) {
    throw Object.assign(new Error("title and body are required"), { status: 400 });
  }

  const destinationUrl = sanitizePushUrl(opts.url);
  const image = opts.imageUrl?.trim() ? sanitizePushText(opts.imageUrl.trim(), 500) : undefined;
  const audience: PushAudience = opts.isTest ? "test_self" : opts.audience;

  const { subs, userIds } = await resolvePushSubscriptions({
    audience,
    adminUserId: opts.adminUserId,
  });

  const campaign = await storage.createPushCampaign({
    adminId: opts.adminUserId,
    title,
    body,
    destinationUrl,
    imageUrl: image || null,
    audience,
    inactiveDays: inactiveDaysForAudience(audience),
    targetUsers: userIds.size,
    targetDevices: subs.length,
    attempted: 0,
    accepted: 0,
    failed: 0,
    invalidRemoved: 0,
    clickCount: 0,
    isTest: !!opts.isTest || audience === "test_self",
  });

  // Append click-tracking query param (privacy-light: campaign id only)
  const clickUrl = (() => {
    try {
      if (destinationUrl.startsWith("/")) {
        const u = new URL(destinationUrl, "https://vextorn.local");
        u.searchParams.set("pc", campaign.id);
        return `${u.pathname}${u.search}${u.hash}`;
      }
      return destinationUrl;
    } catch {
      return destinationUrl;
    }
  })();

  const payloadJson = JSON.stringify({
    title,
    body,
    url: clickUrl,
    image,
    campaignId: campaign.id,
  } satisfies PushPayload);

  let accepted = 0;
  let failed = 0;
  let invalidRemoved = 0;

  // Batch to avoid stampeding huge fan-outs
  const BATCH = 40;
  for (let i = 0; i < subs.length; i += BATCH) {
    const chunk = subs.slice(i, i + BATCH);
    const results = await Promise.all(chunk.map((sub) => sendToSubscription(sub, payloadJson)));
    for (const r of results) {
      if (r === "accepted") accepted++;
      else if (r === "invalid") invalidRemoved++;
      else failed++;
    }
  }

  const attempted = subs.length;
  await storage.updatePushCampaignStats(campaign.id, {
    attempted,
    accepted,
    failed,
    invalidRemoved,
  });

  return {
    campaignId: campaign.id,
    targetUsers: userIds.size,
    targetDevices: subs.length,
    attempted,
    accepted,
    failed,
    invalidRemoved,
  };
}
