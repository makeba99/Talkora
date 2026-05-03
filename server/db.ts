import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import * as schema from "@shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: false,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });
export { pool };

/**
 * Run pending Drizzle migrations at startup.
 * Safe to call on every boot — already-applied migrations are skipped.
 * In production the migrations folder is copied to dist/migrations by the
 * build script so __dirname resolves correctly from dist/index.cjs.
 */
export async function runMigrations(): Promise<void> {
  // import.meta.dirname is available in Node 20.11+ and works for both the
  // dev ESM entry (server/db.ts) and the production CJS bundle (dist/index.cjs
  // where __dirname IS defined). esbuild replaces import.meta.dirname with
  // __dirname in the CJS output so the resolved path is always correct.
  const baseDir = (import.meta as any).dirname ?? __dirname;
  const migrationsFolder = path.resolve(baseDir, "../migrations");

  // ── Seed migration journal for pre-existing databases ─────────────────────
  // If the app tables already exist (e.g. the DB was set up via drizzle-kit
  // push before migrations were introduced), Drizzle's migrate() would fail
  // with "relation already exists". We detect this and pre-populate the
  // __drizzle_migrations journal so migrate() sees everything as applied and
  // skips re-running the SQL.
  try {
    const journalPath = path.join(migrationsFolder, "meta/_journal.json");
    if (!fs.existsSync(journalPath)) {
      console.log("[db] No migration journal found — skipping migrations");
      return;
    }

    // Check whether the Drizzle journal table already exists.
    const { rows: journalRows } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'
       ) AS exists`
    );
    const hasJournal = journalRows[0].exists;

    if (!hasJournal) {
      // Check if our app tables exist (existing database with no migration history).
      const { rows: tableRows } = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'rooms'
         ) AS exists`
      );
      const hasAppTables = tableRows[0].exists;

      if (hasAppTables) {
        // Database already has the schema applied via drizzle-kit push.
        // Create the journal table and mark all existing migrations as done
        // so migrate() skips re-running their CREATE TABLE statements.
        await pool.query(`
          CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
            id        SERIAL PRIMARY KEY,
            hash      text   NOT NULL,
            created_at bigint
          )
        `);

        const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
        for (const entry of journal.entries) {
          const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
          if (!fs.existsSync(sqlPath)) continue;
          const sql = fs.readFileSync(sqlPath, "utf8");
          const hash = crypto.createHash("sha256").update(sql).digest("hex");
          await pool.query(
            `INSERT INTO "__drizzle_migrations" (hash, created_at)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [hash, entry.when]
          );
        }
        console.log("[db] Seeded migration journal for existing database — no SQL changes needed");
        return;
      }
    }
  } catch (seedErr) {
    console.warn("[db] Migration journal seeding failed:", (seedErr as Error).message);
  }

  // ── Normal path: run any pending migrations ────────────────────────────────
  try {
    await migrate(db, { migrationsFolder });
    console.log("[db] Migrations applied successfully");
  } catch (err) {
    console.error("[db] Migration failed:", (err as Error).message);
    throw err;
  }
}
