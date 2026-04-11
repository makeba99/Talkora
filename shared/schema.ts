import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const rooms = pgTable("rooms", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  language: text("language").notNull(),
  level: text("level").notNull(),
  maxUsers: integer("max_users").notNull().default(8),
  ownerId: varchar("owner_id", { length: 36 }).notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  activeUsers: integer("active_users").notNull().default(0),
  roomTheme: varchar("room_theme", { length: 50 }),
  hologramVideoUrl: varchar("hologram_video_url", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRoomSchema = createInsertSchema(rooms).pick({
  title: true,
  language: true,
  level: true,
  maxUsers: true,
  isPublic: true,
});

export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;

export const messages = pgTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  fromId: varchar("from_id", { length: 36 }).notNull(),
  toId: varchar("to_id", { length: 36 }).notNull(),
  text: text("text").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  fromId: true,
  toId: true,
  text: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const follows = pgTable("follows", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id", { length: 36 }).notNull(),
  followingId: varchar("following_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFollowSchema = createInsertSchema(follows).pick({
  followerId: true,
  followingId: true,
});

export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof follows.$inferSelect;

export const roomMessages = pgTable("room_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRoomMessageSchema = createInsertSchema(roomMessages).pick({
  roomId: true,
  userId: true,
  text: true,
});

export type InsertRoomMessage = z.infer<typeof insertRoomMessageSchema>;
export type RoomMessage = typeof roomMessages.$inferSelect;

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  fromUserId: varchar("from_user_id", { length: 36 }).notNull(),
  type: text("type").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;

export const blocks = pgTable("blocks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id", { length: 36 }).notNull(),
  blockedId: varchar("blocked_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBlockSchema = createInsertSchema(blocks).pick({
  blockerId: true,
  blockedId: true,
});

export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type Block = typeof blocks.$inferSelect;

export const reports = pgTable("reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id", { length: 36 }).notNull(),
  reportedId: varchar("reported_id", { length: 36 }).notNull(),
  reporterName: varchar("reporter_name", { length: 100 }),
  reportedName: varchar("reported_name", { length: 100 }),
  category: varchar("category", { length: 100 }),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reports).pick({
  reporterId: true,
  reportedId: true,
  reason: true,
});

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

export const roomVotes = pgTable("room_votes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RoomVote = typeof roomVotes.$inferSelect;

export const LANGUAGES = [
  "All",
  "English",
  "Spanish",
  "French",
  "German",
  "Hindi",
  "Arabic",
  "Armenian",
  "Indonesian",
  "Japanese",
  "Korean",
  "Portuguese",
  "Chinese",
] as const;

export const LEVELS = ["Beginner", "Intermediate", "Advanced", "Native"] as const;
