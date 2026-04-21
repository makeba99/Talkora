/**
 * Automated Data Cleanup Scheduler
 *
 * Configurable via environment variables (all values in days):
 *   CLEANUP_MESSAGES_DAYS        - delete direct messages older than N days  (default: 90)
 *   CLEANUP_ROOM_MESSAGES_DAYS   - delete room chat messages older than N days (default: 30)
 *   CLEANUP_NOTIFICATIONS_DAYS   - delete read notifications older than N days (default: 60)
 *   CLEANUP_REPORTS_DAYS         - delete resolved/dismissed reports older than N days (default: 180)
 *   CLEANUP_ORPHAN_FILES_DAYS    - delete unreferenced uploaded files older than N days (default: 7)
 *   CLEANUP_INTERVAL_MINUTES     - how often the cleanup job runs (default: 60)
 *   CLEANUP_ENABLED              - set to "false" to disable entirely (default: true)
 *
 * Cleanup runs asynchronously and never blocks live traffic.
 * All deletions are logged to the console for audit purposes.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import type { Server as SocketIOServer } from "socket.io";
import type { IStorage } from "./storage";

const uploadsDir = path.join(process.cwd(), "uploads");

function getEnvDays(key: string, defaultDays: number): number {
  const val = parseInt(process.env[key] ?? "", 10);
  return isNaN(val) || val <= 0 ? defaultDays : val;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function log(message: string) {
  const ts = new Date().toISOString();
  console.log(`[cleanup] ${ts} ${message}`);
}

async function getReferencedUploads(): Promise<Set<string>> {
  const referenced = new Set<string>();
  try {
    const [users, rooms, announcements] = await Promise.all([
      db.execute(sql`
        SELECT profile_image_url FROM users
        WHERE profile_image_url LIKE '/uploads/%'
      `),
      db.execute(sql`
        SELECT hologram_video_url, welcome_media_urls FROM rooms
        WHERE hologram_video_url IS NOT NULL OR array_length(welcome_media_urls, 1) > 0
      `),
      db.execute(sql`
        SELECT media_urls FROM announcements
        WHERE array_length(media_urls, 1) > 0
      `),
    ]);

    for (const row of (users.rows as any[])) {
      if (row.profile_image_url) {
        referenced.add(path.basename(row.profile_image_url));
      }
    }
    for (const row of (rooms.rows as any[])) {
      if (row.hologram_video_url) {
        referenced.add(path.basename(row.hologram_video_url));
      }
      if (Array.isArray(row.welcome_media_urls)) {
        for (const url of row.welcome_media_urls) {
          if (url) referenced.add(path.basename(url));
        }
      }
    }
    for (const row of (announcements.rows as any[])) {
      if (Array.isArray(row.media_urls)) {
        for (const url of row.media_urls) {
          if (url) referenced.add(path.basename(url));
        }
      }
    }
  } catch (err: any) {
    log(`ERROR collecting referenced uploads: ${err.message}`);
  }
  return referenced;
}

async function cleanOrphanedFiles(orphanDays: number): Promise<void> {
  if (!fs.existsSync(uploadsDir)) return;
  try {
    const cutoff = daysAgo(orphanDays).getTime();
    const referenced = await getReferencedUploads();
    const files = fs.readdirSync(uploadsDir);
    let deleted = 0;
    for (const filename of files) {
      if (referenced.has(filename)) continue;
      const filepath = path.join(uploadsDir, filename);
      try {
        const stat = fs.statSync(filepath);
        if (!stat.isFile()) continue;
        if (stat.mtimeMs > cutoff) continue;
        fs.unlinkSync(filepath);
        deleted++;
        log(`Deleted orphaned file: ${filename} (modified ${new Date(stat.mtimeMs).toISOString()})`);
      } catch {
        /* skip files that can't be read/deleted */
      }
    }
    if (deleted > 0) {
      log(`Deleted ${deleted} orphaned upload file(s) older than ${orphanDays} days`);
    }
  } catch (err: any) {
    log(`ERROR cleaning orphaned files: ${err.message}`);
  }
}

async function runCleanup(): Promise<void> {
  const messagesDays       = getEnvDays("CLEANUP_MESSAGES_DAYS",       7);
  const roomMessagesDays   = getEnvDays("CLEANUP_ROOM_MESSAGES_DAYS",  7);
  const notificationsDays  = getEnvDays("CLEANUP_NOTIFICATIONS_DAYS",  14);
  const reportsDays        = getEnvDays("CLEANUP_REPORTS_DAYS",        30);
  const orphanFilesDays    = getEnvDays("CLEANUP_ORPHAN_FILES_DAYS",   7);

  log("Starting scheduled data cleanup...");

  try {
    const cutoffMessages = daysAgo(messagesDays);
    const msgResult = await db.execute(
      sql`DELETE FROM messages WHERE created_at < ${cutoffMessages}`
    );
    const msgCount = (msgResult as any).rowCount ?? 0;
    if (msgCount > 0) {
      log(`Deleted ${msgCount} direct message(s) older than ${messagesDays} days (before ${cutoffMessages.toISOString()})`);
    }
  } catch (err: any) {
    log(`ERROR cleaning messages: ${err.message}`);
  }

  try {
    const cutoffRoomMessages = daysAgo(roomMessagesDays);
    const rmResult = await db.execute(
      sql`DELETE FROM room_messages WHERE created_at < ${cutoffRoomMessages}`
    );
    const rmCount = (rmResult as any).rowCount ?? 0;
    if (rmCount > 0) {
      log(`Deleted ${rmCount} room message(s) older than ${roomMessagesDays} days (before ${cutoffRoomMessages.toISOString()})`);
    }
  } catch (err: any) {
    log(`ERROR cleaning room_messages: ${err.message}`);
  }

  try {
    const cutoffNotifications = daysAgo(notificationsDays);
    const notifResult = await db.execute(
      sql`DELETE FROM notifications WHERE read = true AND created_at < ${cutoffNotifications}`
    );
    const notifCount = (notifResult as any).rowCount ?? 0;
    if (notifCount > 0) {
      log(`Deleted ${notifCount} read notification(s) older than ${notificationsDays} days (before ${cutoffNotifications.toISOString()})`);
    }
  } catch (err: any) {
    log(`ERROR cleaning notifications: ${err.message}`);
  }

  try {
    const cutoffReports = daysAgo(reportsDays);
    const reportsResult = await db.execute(
      sql`DELETE FROM reports WHERE status IN ('resolved', 'dismissed') AND created_at < ${cutoffReports}`
    );
    const reportsCount = (reportsResult as any).rowCount ?? 0;
    if (reportsCount > 0) {
      log(`Deleted ${reportsCount} resolved/dismissed report(s) older than ${reportsDays} days (before ${cutoffReports.toISOString()})`);
    }
  } catch (err: any) {
    log(`ERROR cleaning reports: ${err.message}`);
  }

  await cleanOrphanedFiles(orphanFilesDays);

  log("Cleanup complete.");
}

let _io: SocketIOServer | undefined;
let _storage: IStorage | undefined;
const userSocketsRef: Map<string, string> = new Map();

export function setCleanupContext(io: SocketIOServer, storage: IStorage, userSockets: Map<string, string>): void {
  _io = io;
  _storage = storage;
  // Copy reference so cleanup always reads the latest socket map
  userSockets.forEach((v, k) => userSocketsRef.set(k, v));
}

async function handleExpiredRestrictions(): Promise<void> {
  if (!_storage) return;
  try {
    const expired = await _storage.getExpiredRestrictions();
    for (const user of expired) {
      const adminId = user.restrictedById ?? user.id;
      await _storage.restrictUser(user.id, {
        restrictedUntil: null,
        restrictedReason: null,
        restrictedById: null,
      });
      await _storage.createNotification({ userId: user.id, fromUserId: adminId, type: "admin_restriction_lifted" });
      if (_io) {
        const socketId = userSocketsRef.get(user.id);
        if (socketId) {
          _io.to(socketId).emit("admin:restriction-lifted");
          _io.to(socketId).emit("admin:notification", { type: "admin_restriction_lifted" });
        }
      }
      log(`Cleared expired restriction for user ${user.id}`);
    }
  } catch (err: any) {
    log(`ERROR handling expired restrictions: ${err.message}`);
  }
}

export function startCleanupScheduler(): void {
  if (process.env.CLEANUP_ENABLED === "false") {
    log("Cleanup scheduler disabled via CLEANUP_ENABLED=false");
    return;
  }

  const intervalMinutes = getEnvDays("CLEANUP_INTERVAL_MINUTES", 60);

  log(`Cleanup scheduler started — runs every ${intervalMinutes} minute(s)`);
  log(
    `Retention: messages=${getEnvDays("CLEANUP_MESSAGES_DAYS", 7)}d, ` +
    `room_messages=${getEnvDays("CLEANUP_ROOM_MESSAGES_DAYS", 7)}d, ` +
    `notifications=${getEnvDays("CLEANUP_NOTIFICATIONS_DAYS", 14)}d, ` +
    `reports=${getEnvDays("CLEANUP_REPORTS_DAYS", 30)}d, ` +
    `orphan_files=${getEnvDays("CLEANUP_ORPHAN_FILES_DAYS", 7)}d`
  );

  const runAll = async () => {
    await runCleanup();
    await handleExpiredRestrictions();
  };

  runAll().catch((err) => log(`Startup cleanup error: ${err.message}`));

  setInterval(() => {
    runAll().catch((err) => log(`Interval cleanup error: ${err.message}`));
  }, intervalMinutes * 60 * 1000);
}
