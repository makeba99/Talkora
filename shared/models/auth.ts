import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  displayName: varchar("display_name"),
  profileImageUrl: varchar("profile_image_url"),
  bio: text("bio"),
  avatarRing: varchar("avatar_ring"),
  flairBadge: varchar("flair_badge"),
  profileDecoration: varchar("profile_decoration"),
  instagramUrl: varchar("instagram_url"),
  linkedinUrl: varchar("linkedin_url"),
  facebookUrl: varchar("facebook_url"),
  socialsPinned: boolean("socials_pinned").notNull().default(false),
  status: text("status").notNull().default("offline"),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  warningCount: integer("warning_count").notNull().default(0),
  restrictedUntil: timestamp("restricted_until"),
  restrictedReason: text("restricted_reason"),
  restrictedById: varchar("restricted_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
