import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import path from "path";
import fs from "fs";
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
 * Run pending migrations at startup in an idempotent way.
 *
 * Instead of relying on Drizzle's migrate() (which fails when tables already
 * exist because it doesn't use IF NOT EXISTS), we read the SQL files directly
 * and patch each CREATE TABLE / CREATE INDEX / CREATE TYPE / CREATE SEQUENCE
 * statement to include IF NOT EXISTS before executing. This is safe to run on
 * both a fresh database and a database that was bootstrapped via drizzle-kit push.
 *
 * In production the migrations folder is copied to dist/migrations/ by the
 * build script, so the path resolution tries the bundle-adjacent folder first.
 */
export async function runMigrations(): Promise<void> {
  // Resolve migrations folder for both environments:
  //   Dev  (ESM):  server/db.ts   → baseDir = <root>/server/ → ../migrations
  //   Prod (CJS):  dist/index.cjs → __dirname = <root>/dist/ → ./migrations
  const baseDir: string = (() => {
    try { return (import.meta as any).dirname as string; } catch { /* CJS */ }
    return typeof __dirname !== "undefined" ? __dirname : process.cwd();
  })();

  const candidates = [
    path.resolve(baseDir, "migrations"),     // production: dist/migrations/
    path.resolve(baseDir, "../migrations"),  // development: <root>/migrations/
    path.resolve(process.cwd(), "migrations"),
  ];

  const migrationsFolder = candidates.find((p) =>
    fs.existsSync(path.join(p, "meta/_journal.json"))
  );

  if (!migrationsFolder) {
    console.warn("[db] No migrations folder found — skipping migrations");
    return;
  }

  console.log(`[db] migrations folder: ${migrationsFolder}`);

  // Read the Drizzle journal to get the ordered list of migration files.
  const journalPath = path.join(migrationsFolder, "meta/_journal.json");
  const journal: { entries: Array<{ tag: string; when: number }> } =
    JSON.parse(fs.readFileSync(journalPath, "utf8"));

  // Ensure our own simple tracking table exists (public schema, no conflicts
  // with Drizzle's drizzle.__drizzle_migrations which uses a different check).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.__vxt_migrations (
      tag        text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // Fetch already-applied tags.
  const { rows } = await pool.query<{ tag: string }>(
    `SELECT tag FROM public.__vxt_migrations`
  );
  const applied = new Set(rows.map((r) => r.tag));

  let ran = 0;
  let skipped = 0;

  for (const entry of journal.entries) {
    if (applied.has(entry.tag)) {
      skipped++;
      continue;
    }

    const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`[db] Migration file not found: ${sqlPath}`);
      continue;
    }

    const raw = fs.readFileSync(sqlPath, "utf8");

    // Make every DDL statement idempotent so re-running on an existing schema
    // is harmless. We patch the raw SQL before splitting on breakpoints.
    const safe = raw
      .replace(/\bCREATE TABLE\s+(?!IF NOT EXISTS)/gi,   "CREATE TABLE IF NOT EXISTS ")
      .replace(/\bCREATE INDEX\s+(?!IF NOT EXISTS)/gi,   "CREATE INDEX IF NOT EXISTS ")
      .replace(/\bCREATE UNIQUE INDEX\s+(?!IF NOT EXISTS)/gi, "CREATE UNIQUE INDEX IF NOT EXISTS ")
      .replace(/\bCREATE SEQUENCE\s+(?!IF NOT EXISTS)/gi,"CREATE SEQUENCE IF NOT EXISTS ")
      .replace(/\bCREATE TYPE\s+(?!IF NOT EXISTS)/gi,    "CREATE TYPE IF NOT EXISTS ");

    const statements = safe
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    // Run each statement individually so a single failure doesn't roll back
    // the whole migration, and log which ones we skip (already-exist errors).
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        // 42P07 = duplicate_table, 42710 = duplicate_object (type/index/sequence)
        if (err.code === "42P07" || err.code === "42710" || err.code === "42701") {
          // Object already exists — safe to ignore after our IF NOT EXISTS patch.
          console.warn(`[db] Skipping already-existing object in ${entry.tag}: ${err.message.split("\n")[0]}`);
        } else {
          console.error(`[db] Statement failed in ${entry.tag}:`, err.message);
          throw err;
        }
      }
    }

    await pool.query(
      `INSERT INTO public.__vxt_migrations (tag) VALUES ($1) ON CONFLICT DO NOTHING`,
      [entry.tag]
    );
    ran++;
    console.log(`[db] Applied migration: ${entry.tag}`);
  }

  console.log(`[db] Migrations complete — ${ran} applied, ${skipped} already up-to-date`);
}
