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
  roomTheme: true,
  hologramVideoUrl: true,
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

export const teachers = pgTable("teachers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  bio: text("bio"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
  levels: text("levels").array().notNull().default(sql`'{}'::text[]`),
  specializations: text("specializations").array().notNull().default(sql`'{}'::text[]`),
  hourlyRate: integer("hourly_rate").notNull().default(0),
  sessionDurations: text("session_durations").array().notNull().default(sql`'{30,60}'::text[]`),
  rating: integer("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  userId: varchar("user_id", { length: 36 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({ id: true, createdAt: true });
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Teacher = typeof teachers.$inferSelect;

export const bookings = pgTable("bookings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  sessionType: varchar("session_type", { length: 20 }).notNull().default("private"),
  notes: text("notes"),
  roomId: varchar("room_id", { length: 36 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true, status: true, roomId: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

export const teacherReviews = pgTable("teacher_reviews", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTeacherReviewSchema = createInsertSchema(teacherReviews).omit({ id: true, createdAt: true });
export type InsertTeacherReview = z.infer<typeof insertTeacherReviewSchema>;
export type TeacherReview = typeof teacherReviews.$inferSelect;

export const teacherApplications = pgTable("teacher_applications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  bio: text("bio").notNull(),
  languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
  levels: text("levels").array().notNull().default(sql`'{}'::text[]`),
  specializations: text("specializations").array().notNull().default(sql`'{}'::text[]`),
  suggestedRate: integer("suggested_rate").notNull().default(0),
  paypalEmail: varchar("paypal_email", { length: 255 }).notNull(),
  experience: text("experience"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  adminNotes: text("admin_notes"),
  approvedRate: integer("approved_rate"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTeacherApplicationSchema = createInsertSchema(teacherApplications).omit({ id: true, createdAt: true, updatedAt: true, status: true, adminNotes: true, approvedRate: true });
export type InsertTeacherApplication = z.infer<typeof insertTeacherApplicationSchema>;
export type TeacherApplication = typeof teacherApplications.$inferSelect;

export const userComments = pgTable("user_comments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  targetUserId: varchar("target_user_id", { length: 36 }).notNull(),
  authorId: varchar("author_id", { length: 36 }).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserCommentSchema = createInsertSchema(userComments).pick({
  targetUserId: true,
  authorId: true,
  text: true,
}).extend({ text: z.string().min(1).max(500) });

export type InsertUserComment = z.infer<typeof insertUserCommentSchema>;
export type UserComment = typeof userComments.$inferSelect;

export const BADGE_TYPES = {
  lovely_user: {
    id: "lovely_user",
    label: "Lovely User",
    emoji: "💜",
    color: "#a855f7",
    quote: "Your warmth and kindness make this community a better place.",
  },
  trusted_user: {
    id: "trusted_user",
    label: "Trusted User",
    emoji: "✅",
    color: "#22c55e",
    quote: "Your integrity and reliability have earned the trust of everyone here.",
  },
  platform_best_friend: {
    id: "platform_best_friend",
    label: "Platform Best Friend",
    emoji: "🤝",
    color: "#f59e0b",
    quote: "You've become an irreplaceable part of our family.",
  },
  top_speaker: {
    id: "top_speaker",
    label: "Top Speaker",
    emoji: "🎤",
    color: "#3b82f6",
    quote: "Your voice inspires learners everywhere. Keep speaking!",
  },
  language_champion: {
    id: "language_champion",
    label: "Language Champion",
    emoji: "🏆",
    color: "#f97316",
    quote: "You've shown what true dedication to language learning looks like.",
  },
  community_star: {
    id: "community_star",
    label: "Community Star",
    emoji: "⭐",
    color: "#eab308",
    quote: "You light up our community with your incredible presence.",
  },
  helping_hand: {
    id: "helping_hand",
    label: "Helping Hand",
    emoji: "🙌",
    color: "#06b6d4",
    quote: "Your support and help mean the world to everyone here.",
  },
  rising_star: {
    id: "rising_star",
    label: "Rising Star",
    emoji: "🌟",
    color: "#ec4899",
    quote: "Watch out world — a remarkable new star has risen!",
  },
} as const;

export type BadgeType = keyof typeof BADGE_TYPES;

export const userBadges = pgTable("user_badges", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  badgeType: varchar("badge_type", { length: 50 }).notNull(),
  awardedById: varchar("awarded_by_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).pick({
  userId: true,
  badgeType: true,
  awardedById: true,
});

export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;

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

export const SPECIALIZATIONS = [
  "General Conversation",
  "Business English",
  "Grammar",
  "Pronunciation",
  "Exam Preparation",
  "Writing",
  "Reading",
  "Listening",
  "Travel",
  "Academic",
  "Children",
  "Slang & Casual",
] as const;
