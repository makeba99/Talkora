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

async function cleanOrphanedFiles(orphanDays: number): Promise<{ deleted: number; bytes: number }> {
  if (!fs.existsSync(uploadsDir)) return { deleted: 0, bytes: 0 };
  let deleted = 0;
  let bytes = 0;
  try {
    const cutoff = daysAgo(orphanDays).getTime();
    const referenced = await getReferencedUploads();
    const files = fs.readdirSync(uploadsDir);
    for (const filename of files) {
      if (referenced.has(filename)) continue;
      const filepath = path.join(uploadsDir, filename);
      try {
        const stat = fs.statSync(filepath);
        if (!stat.isFile()) continue;
        if (stat.mtimeMs > cutoff) continue;
        const size = stat.size;
        fs.unlinkSync(filepath);
        deleted++;
        bytes += size;
        log(`Deleted orphaned file: ${filename} (${size} bytes, modified ${new Date(stat.mtimeMs).toISOString()})`);
      } catch {
        /* skip files that can't be read/deleted */
      }
    }
    if (deleted > 0) {
      log(`Deleted ${deleted} orphaned upload file(s) (${bytes} bytes) older than ${orphanDays} days`);
    }
  } catch (err: any) {
    log(`ERROR cleaning orphaned files: ${err.message}`);
  }
  return { deleted, bytes };
}

export type CleanupRunRecord = {
  ts: number;
  trigger: "scheduled" | "manual";
  filesDeleted: number;
  bytesFreed: number;
  messagesDeleted: number;
  roomMessagesDeleted: number;
  notificationsDeleted: number;
  reportsDeleted: number;
  durationMs: number;
};

export type CleanupStats = {
  enabled: boolean;
  intervalMinutes: number;
  retention: {
    messagesDays: number;
    roomMessagesDays: number;
    notificationsDays: number;
    reportsDays: number;
    orphanFilesDays: number;
  };
  totals: {
    runs: number;
    filesDeleted: number;
    bytesFreed: number;
    messagesDeleted: number;
    roomMessagesDeleted: number;
    notificationsDeleted: number;
    reportsDeleted: number;
  };
  lastRun: CleanupRunRecord | null;
  history: CleanupRunRecord[];
  uploads: {
    totalFiles: number;
    totalBytes: number;
  };
  isRunning: boolean;
};

const stats: Omit<CleanupStats, "retention" | "intervalMinutes" | "enabled" | "uploads" | "isRunning"> = {
  totals: {
    runs: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    messagesDeleted: 0,
    roomMessagesDeleted: 0,
    notificationsDeleted: 0,
    reportsDeleted: 0,
  },
  lastRun: null,
  history: [],
};

let isRunning = false;

function getRetention() {
  return {
    messagesDays:      getEnvDays("CLEANUP_MESSAGES_DAYS", 7),
    roomMessagesDays:  getEnvDays("CLEANUP_ROOM_MESSAGES_DAYS", 7),
    notificationsDays: getEnvDays("CLEANUP_NOTIFICATIONS_DAYS", 14),
    reportsDays:       getEnvDays("CLEANUP_REPORTS_DAYS", 30),
    orphanFilesDays:   getEnvDays("CLEANUP_ORPHAN_FILES_DAYS", 7),
  };
}

function measureUploads(): { totalFiles: number; totalBytes: number } {
  let totalFiles = 0;
  let totalBytes = 0;
  try {
    if (!fs.existsSync(uploadsDir)) return { totalFiles, totalBytes };
    const files = fs.readdirSync(uploadsDir);
    for (const filename of files) {
      try {
        const s = fs.statSync(path.join(uploadsDir, filename));
        if (s.isFile()) { totalFiles++; totalBytes += s.size; }
      } catch {}
    }
  } catch {}
  return { totalFiles, totalBytes };
}

export function getCleanupStats(): CleanupStats {
  return {
    enabled: process.env.CLEANUP_ENABLED !== "false",
    intervalMinutes: getEnvDays("CLEANUP_INTERVAL_MINUTES", 60),
    retention: getRetention(),
    totals: { ...stats.totals },
    lastRun: stats.lastRun,
    history: [...stats.history],
    uploads: measureUploads(),
    isRunning,
  };
}

async function runCleanup(trigger: "scheduled" | "manual" = "scheduled"): Promise<CleanupRunRecord> {
  const ret = getRetention();
  const startedAt = Date.now();
  log(`Starting ${trigger} data cleanup...`);

  isRunning = true;
  let messagesDeleted = 0;
  let roomMessagesDeleted = 0;
  let notificationsDeleted = 0;
  let reportsDeleted = 0;

  try {
    const cutoffMessages = daysAgo(ret.messagesDays);
    const msgResult = await db.execute(
      sql`DELETE FROM messages WHERE created_at < ${cutoffMessages}`
    );
    messagesDeleted = (msgResult as any).rowCount ?? 0;
    if (messagesDeleted > 0) {
      log(`Deleted ${messagesDeleted} direct message(s) older than ${ret.messagesDays} days`);
    }
  } catch (err: any) {
    log(`ERROR cleaning messages: ${err.message}`);
  }

  try {
    const cutoffRoomMessages = daysAgo(ret.roomMessagesDays);
    const rmResult = await db.execute(
      sql`DELETE FROM room_messages WHERE created_at < ${cutoffRoomMessages}`
    );
    roomMessagesDeleted = (rmResult as any).rowCount ?? 0;
    if (roomMessagesDeleted > 0) {
      log(`Deleted ${roomMessagesDeleted} room message(s) older than ${ret.roomMessagesDays} days`);
    }
  } catch (err: any) {
    log(`ERROR cleaning room_messages: ${err.message}`);
  }

  try {
    const cutoffNotifications = daysAgo(ret.notificationsDays);
    const notifResult = await db.execute(
      sql`DELETE FROM notifications WHERE read = true AND created_at < ${cutoffNotifications}`
    );
    notificationsDeleted = (notifResult as any).rowCount ?? 0;
    if (notificationsDeleted > 0) {
      log(`Deleted ${notificationsDeleted} read notification(s) older than ${ret.notificationsDays} days`);
    }
  } catch (err: any) {
    log(`ERROR cleaning notifications: ${err.message}`);
  }

  try {
    const cutoffReports = daysAgo(ret.reportsDays);
    const reportsResult = await db.execute(
      sql`DELETE FROM reports WHERE status IN ('resolved', 'dismissed') AND created_at < ${cutoffReports}`
    );
    reportsDeleted = (reportsResult as any).rowCount ?? 0;
    if (reportsDeleted > 0) {
      log(`Deleted ${reportsDeleted} resolved/dismissed report(s) older than ${ret.reportsDays} days`);
    }
  } catch (err: any) {
    log(`ERROR cleaning reports: ${err.message}`);
  }

  const fileResult = await cleanOrphanedFiles(ret.orphanFilesDays);

  const record: CleanupRunRecord = {
    ts: Date.now(),
    trigger,
    filesDeleted: fileResult.deleted,
    bytesFreed: fileResult.bytes,
    messagesDeleted,
    roomMessagesDeleted,
    notificationsDeleted,
    reportsDeleted,
    durationMs: Date.now() - startedAt,
  };

  stats.totals.runs += 1;
  stats.totals.filesDeleted += record.filesDeleted;
  stats.totals.bytesFreed += record.bytesFreed;
  stats.totals.messagesDeleted += record.messagesDeleted;
  stats.totals.roomMessagesDeleted += record.roomMessagesDeleted;
  stats.totals.notificationsDeleted += record.notificationsDeleted;
  stats.totals.reportsDeleted += record.reportsDeleted;
  stats.lastRun = record;
  stats.history.unshift(record);
  if (stats.history.length > 20) stats.history.length = 20;

  isRunning = false;
  log(`Cleanup complete in ${record.durationMs}ms — files=${record.filesDeleted} (${record.bytesFreed} bytes)`);
  return record;
}

export async function runCleanupNow(): Promise<CleanupRunRecord> {
  if (isRunning) {
    throw new Error("Cleanup is already running");
  }
  const record = await runCleanup("manual");
  await handleExpiredRestrictions();
  return record;
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
