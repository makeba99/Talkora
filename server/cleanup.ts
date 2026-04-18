/**
 * Automated Data Cleanup Scheduler
 *
 * Configurable via environment variables (all values in days):
 *   CLEANUP_MESSAGES_DAYS        - delete direct messages older than N days  (default: 90)
 *   CLEANUP_ROOM_MESSAGES_DAYS   - delete room chat messages older than N days (default: 30)
 *   CLEANUP_NOTIFICATIONS_DAYS   - delete read notifications older than N days (default: 60)
 *   CLEANUP_REPORTS_DAYS         - delete resolved/dismissed reports older than N days (default: 180)
 *   CLEANUP_INTERVAL_MINUTES     - how often the cleanup job runs (default: 60)
 *   CLEANUP_ENABLED              - set to "false" to disable entirely (default: true)
 *
 * Cleanup runs asynchronously and never blocks live traffic.
 * All deletions are logged to the console for audit purposes.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

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

async function runCleanup(): Promise<void> {
  const messagesDays       = getEnvDays("CLEANUP_MESSAGES_DAYS",       90);
  const roomMessagesDays   = getEnvDays("CLEANUP_ROOM_MESSAGES_DAYS",  30);
  const notificationsDays  = getEnvDays("CLEANUP_NOTIFICATIONS_DAYS",  60);
  const reportsDays        = getEnvDays("CLEANUP_REPORTS_DAYS",        180);

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

  log("Cleanup complete.");
}

export function startCleanupScheduler(): void {
  if (process.env.CLEANUP_ENABLED === "false") {
    log("Cleanup scheduler disabled via CLEANUP_ENABLED=false");
    return;
  }

  const intervalMinutes = getEnvDays("CLEANUP_INTERVAL_MINUTES", 60);

  log(`Cleanup scheduler started — runs every ${intervalMinutes} minute(s)`);
  log(
    `Retention: messages=${getEnvDays("CLEANUP_MESSAGES_DAYS", 90)}d, ` +
    `room_messages=${getEnvDays("CLEANUP_ROOM_MESSAGES_DAYS", 30)}d, ` +
    `notifications=${getEnvDays("CLEANUP_NOTIFICATIONS_DAYS", 60)}d, ` +
    `reports=${getEnvDays("CLEANUP_REPORTS_DAYS", 180)}d`
  );

  runCleanup().catch((err) => log(`Startup cleanup error: ${err.message}`));

  setInterval(() => {
    runCleanup().catch((err) => log(`Interval cleanup error: ${err.message}`));
  }, intervalMinutes * 60 * 1000);
}
