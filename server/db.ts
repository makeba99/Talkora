import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
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
