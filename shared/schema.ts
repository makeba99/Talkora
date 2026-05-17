import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
// Re-export pure data constants from the zero-dependency constants module.
// This lets server code import them from @shared/schema as before, while
// client code can import from @shared/constants to avoid bundling drizzle/zod.
export { TALK_PERMISSIONS, FEATURE_PERMISSIONS, BADGE_TYPES, BADGE_TYPES as BADGE_TYPE_MAP, LANGUAGES, LEVELS, SPECIALIZATIONS } from "./constants";
export type { TalkPermission, FeaturePermission, BadgeType } from "./constants";

export const rooms = pgTable("rooms", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  shortId: varchar("short_id", { length: 16 }),
  accessKey: varchar("access_key", { length: 32 }),
  title: text("title").notNull(),
  language: text("language").notNull(),
  level: text("level").notNull(),
  maxUsers: integer("max_users").notNull().default(8),
  ownerId: varchar("owner_id", { length: 36 }).notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  activeUsers: integer("active_users").notNull().default(0),
  roomTheme: varchar("room_theme", { length: 50 }),
  hologramVideoUrl: varchar("hologram_video_url", { length: 500 }),
  welcomeMessage: text("welcome_message"),
  welcomeMediaUrls: text("welcome_media_urls").array().notNull().default(sql`'{}'::text[]`),
  welcomeMediaTypes: text("welcome_media_types").array().notNull().default(sql`'{}'::text[]`),
  welcomeMediaPosition: varchar("welcome_media_position", { length: 20 }).notNull().default("below"),
  welcomeAccentColor: varchar("welcome_accent_color", { length: 30 }).notNull().default("#8B5CF6"),
  talkPermission: varchar("talk_permission", { length: 20 }).notNull().default("everyone"),
  cameraPermission: varchar("camera_permission", { length: 20 }).notNull().default("everyone"),
  screenPermission: varchar("screen_permission", { length: 20 }).notNull().default("everyone"),
  youtubePermission: varchar("youtube_permission", { length: 20 }).notNull().default("everyone"),
  chatPermission: varchar("chat_permission", { length: 20 }).notNull().default("everyone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  roomsShortIdIdx: uniqueIndex("rooms_short_id_idx").on(table.shortId),
  roomsOwnerIdx: index("rooms_owner_id_idx").on(table.ownerId),
  roomsCreatedAtIdx: index("rooms_created_at_idx").on(table.createdAt),
}));

// TALK_PERMISSIONS, FEATURE_PERMISSIONS and their types are re-exported from
// ./constants above — do not redefine them here.

export const insertRoomSchema = createInsertSchema(rooms).pick({
  title: true,
  language: true,
  level: true,
  maxUsers: true,
  isPublic: true,
  roomTheme: true,
  hologramVideoUrl: true,
  talkPermission: true,
  cameraPermission: true,
  screenPermission: true,
  youtubePermission: true,
  chatPermission: true,
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
}, (table) => ({
  messagesFromIdx: index("messages_from_id_idx").on(table.fromId),
  messagesToIdx: index("messages_to_id_idx").on(table.toId),
  messagesConversationIdx: index("messages_conversation_idx").on(table.fromId, table.toId),
  messagesCreatedAtIdx: index("messages_created_at_idx").on(table.createdAt),
}));

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
}, (table) => ({
  followsFollowerIdx: index("follows_follower_id_idx").on(table.followerId),
  followsFollowingIdx: index("follows_following_id_idx").on(table.followingId),
}));

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
}, (table) => ({
  roomMessagesRoomIdx: index("room_messages_room_id_idx").on(table.roomId),
  roomMessagesUserIdx: index("room_messages_user_id_idx").on(table.userId),
  roomMessagesCreatedAtIdx: index("room_messages_created_at_idx").on(table.createdAt),
}));

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
}, (table) => ({
  notificationsUserIdx: index("notifications_user_id_idx").on(table.userId),
  notificationsCreatedAtIdx: index("notifications_created_at_idx").on(table.createdAt),
}));

export type Notification = typeof notifications.$inferSelect;

export const userNotes = pgTable("user_notes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id", { length: 36 }).notNull(),
  subjectId: varchar("subject_id", { length: 36 }).notNull(),
  note: text("note").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userNotesAuthorSubjectIdx: uniqueIndex("user_notes_author_subject_idx").on(table.authorId, table.subjectId),
  userNotesAuthorIdx: index("user_notes_author_idx").on(table.authorId),
}));

export type UserNote = typeof userNotes.$inferSelect;

export const blocks = pgTable("blocks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id", { length: 36 }).notNull(),
  blockedId: varchar("blocked_id", { length: 36 }).notNull(),
  blockType: varchar("block_type", { length: 20 }).notNull().default("ordinary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  blocksBlockerIdx: index("blocks_blocker_id_idx").on(table.blockerId),
  blocksBlockedIdx: index("blocks_blocked_id_idx").on(table.blockedId),
}));

export const insertBlockSchema = createInsertSchema(blocks).pick({
  blockerId: true,
  blockedId: true,
  blockType: true,
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
}, (table) => ({
  reportsReportedIdx: index("reports_reported_id_idx").on(table.reportedId),
  reportsCreatedAtIdx: index("reports_created_at_idx").on(table.createdAt),
}));

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
}, (table) => ({
  roomVotesRoomIdx: index("room_votes_room_id_idx").on(table.roomId),
  roomVotesUserRoomIdx: index("room_votes_user_room_idx").on(table.userId, table.roomId),
}));

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
}, (table) => ({
  bookingsTeacherIdx: index("bookings_teacher_id_idx").on(table.teacherId),
  bookingsUserIdx: index("bookings_user_id_idx").on(table.userId),
}));

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
}, (table) => ({
  teacherReviewsTeacherIdx: index("teacher_reviews_teacher_id_idx").on(table.teacherId),
  teacherReviewsUserTeacherIdx: index("teacher_reviews_user_teacher_idx").on(table.userId, table.teacherId),
}));

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
}, (table) => ({
  teacherAppUserIdx: index("teacher_applications_user_id_idx").on(table.userId),
  teacherAppStatusIdx: index("teacher_applications_status_idx").on(table.status),
}));

export const insertTeacherApplicationSchema = createInsertSchema(teacherApplications).omit({ id: true, createdAt: true, updatedAt: true, status: true, adminNotes: true, approvedRate: true });
export type InsertTeacherApplication = z.infer<typeof insertTeacherApplicationSchema>;
export type TeacherApplication = typeof teacherApplications.$inferSelect;

export const userComments = pgTable("user_comments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  targetUserId: varchar("target_user_id", { length: 36 }).notNull(),
  authorId: varchar("author_id", { length: 36 }).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userCommentsTargetIdx: index("user_comments_target_user_id_idx").on(table.targetUserId),
  userCommentsAuthorIdx: index("user_comments_author_id_idx").on(table.authorId),
}));

export const insertUserCommentSchema = createInsertSchema(userComments).pick({
  targetUserId: true,
  authorId: true,
  text: true,
}).extend({ text: z.string().min(1).max(500) });

export type InsertUserComment = z.infer<typeof insertUserCommentSchema>;
export type UserComment = typeof userComments.$inferSelect;

// BADGE_TYPES and BadgeType are re-exported from ./constants above.

export const userBadges = pgTable("user_badges", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  badgeType: varchar("badge_type", { length: 50 }).notNull(),
  awardedById: varchar("awarded_by_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userBadgesUserIdx: index("user_badges_user_id_idx").on(table.userId),
}));

export const insertUserBadgeSchema = createInsertSchema(userBadges).pick({
  userId: true,
  badgeType: true,
  awardedById: true,
});

export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;

export const badgeApplications = pgTable("badge_applications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  badgeType: varchar("badge_type", { length: 50 }).notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  reviewedById: varchar("reviewed_by_id", { length: 36 }),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  badgeAppsUserIdx: index("badge_applications_user_id_idx").on(table.userId),
  badgeAppsUserTypeIdx: index("badge_applications_user_type_idx").on(table.userId, table.badgeType),
  badgeAppsStatusIdx: index("badge_applications_status_idx").on(table.status),
}));

export const insertBadgeApplicationSchema = createInsertSchema(badgeApplications).pick({
  userId: true,
  badgeType: true,
  reason: true,
});

export type InsertBadgeApplication = z.infer<typeof insertBadgeApplicationSchema>;
export type BadgeApplication = typeof badgeApplications.$inferSelect;

export const announcements = pgTable("announcements", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  body: text("body").notNull(),
  bodyAfterMedia: text("body_after_media"),
  mediaPosition: varchar("media_position", { length: 20 }).notNull().default("below"),
  kind: varchar("kind", { length: 30 }).notNull().default("platform"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  mediaUrls: text("media_urls").array().notNull().default(sql`'{}'::text[]`),
  mediaTypes: text("media_types").array().notNull().default(sql`'{}'::text[]`),
  showOnLobby: boolean("show_on_lobby").notNull().default(false),
  createdById: varchar("created_by_id", { length: 36 }).notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  announcementsStatusIdx: index("announcements_status_idx").on(table.status),
  announcementsPublishedAtIdx: index("announcements_published_at_idx").on(table.publishedAt),
}));

export const insertAnnouncementSchema = createInsertSchema(announcements)
  .omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true })
  .extend({
    title: z.string().trim().min(3).max(140),
    body: z.string().trim().min(1).max(5000),
    bodyAfterMedia: z.string().trim().max(5000).nullable().optional(),
    mediaPosition: z.enum(["above", "below", "between"]).default("below"),
    kind: z.enum(["platform", "maintenance", "safety", "celebration"]).default("platform"),
    status: z.enum(["draft", "published"]).default("draft"),
    mediaUrls: z.array(
      z.string().refine(
        (url) => url.startsWith("/uploads/") || url.startsWith("https://") || url.startsWith("http://"),
        { message: "Media URL must be an uploaded file path (/uploads/...) or a full http(s) URL" }
      )
    ).max(4).default([]),
    mediaTypes: z.array(z.enum(["image", "gif"])).max(4).default([]),
    showOnLobby: z.boolean().default(false),
  });

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

export const announcementReceipts = pgTable("announcement_receipts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  announcementId: varchar("announcement_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  viewedAt: timestamp("viewed_at"),
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  announcementUserUnique: uniqueIndex("announcement_receipts_announcement_user_idx").on(table.announcementId, table.userId),
  announcementReceiptsUserIdx: index("announcement_receipts_user_id_idx").on(table.userId),
}));

export const insertAnnouncementReceiptSchema = createInsertSchema(announcementReceipts)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type InsertAnnouncementReceipt = z.infer<typeof insertAnnouncementReceiptSchema>;
export type AnnouncementReceipt = typeof announcementReceipts.$inferSelect;

export const securityEvents = pgTable("security_events", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("medium"),
  description: text("description").notNull(),
  userAgent: text("user_agent"),
  requestPath: varchar("request_path", { length: 255 }),
  resolved: boolean("resolved").notNull().default(false),
  resolvedById: varchar("resolved_by_id", { length: 36 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  securityEventsUserIdx: index("security_events_user_id_idx").on(table.userId),
  securityEventsTypeIdx: index("security_events_type_idx").on(table.eventType),
  securityEventsSeverityIdx: index("security_events_severity_idx").on(table.severity),
  securityEventsResolvedIdx: index("security_events_resolved_idx").on(table.resolved),
  securityEventsCreatedAtIdx: index("security_events_created_at_idx").on(table.createdAt),
}));

export const insertSecurityEventSchema = createInsertSchema(securityEvents).omit({ id: true, createdAt: true, resolved: true, resolvedById: true });
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type SecurityEvent = typeof securityEvents.$inferSelect;

export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  last4: varchar("last4", { length: 4 }).notNull(),
  brand: varchar("brand", { length: 20 }).notNull(),
  expMonth: integer("exp_month").notNull(),
  expYear: integer("exp_year").notNull(),
  cardholderName: text("cardholder_name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  paymentMethodsUserIdx: index("payment_methods_user_id_idx").on(table.userId),
}));

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({ id: true, createdAt: true, isDefault: true });
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

// LANGUAGES, LEVELS, SPECIALIZATIONS are re-exported from ./constants above.

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type AppSetting = typeof appSettings.$inferSelect;

export const pageViews = pgTable("page_views", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  path: varchar("path", { length: 255 }).notNull(),
  referrer: text("referrer"),
  referrerDomain: varchar("referrer_domain", { length: 120 }),
  country: varchar("country", { length: 2 }),
  sessionHash: varchar("session_hash", { length: 32 }),
  userId: text("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  pvCreatedAtIdx: index("page_views_created_at_idx").on(table.createdAt),
  pvReferrerIdx: index("page_views_referrer_domain_idx").on(table.referrerDomain),
  pvCountryIdx: index("page_views_country_idx").on(table.country),
  pvUserIdx: index("page_views_user_id_idx").on(table.userId),
}));

export const roomJoins = pgTable("room_joins", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  roomId: text("room_id").notNull(),
  userId: text("user_id").notNull(),
  roomName: varchar("room_name", { length: 120 }),
  country: varchar("country", { length: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  rjRoomIdx: index("room_joins_room_id_idx").on(table.roomId),
  rjUserIdx: index("room_joins_user_id_idx").on(table.userId),
  rjCreatedAtIdx: index("room_joins_created_at_idx").on(table.createdAt),
  rjCountryIdx: index("room_joins_country_idx").on(table.country),
}));
export type RoomJoin = typeof roomJoins.$inferSelect;

export const transactions = pgTable("transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id", { length: 36 }),
  userId: varchar("user_id", { length: 36 }).notNull(),
  teacherId: varchar("teacher_id", { length: 36 }),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  platformFee: integer("platform_fee").notNull().default(0),
  teacherAmount: integer("teacher_amount").notNull().default(0),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
  paymentMethodId: varchar("payment_method_id", { length: 36 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  description: text("description"),
  idramOrderId: varchar("idram_order_id", { length: 100 }),
  confirmedById: varchar("confirmed_by_id", { length: 36 }),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  transactionsUserIdx: index("transactions_user_id_idx").on(table.userId),
  transactionsTeacherIdx: index("transactions_teacher_id_idx").on(table.teacherId),
  transactionsStatusIdx: index("transactions_status_idx").on(table.status),
  transactionsCreatedAtIdx: index("transactions_created_at_idx").on(table.createdAt),
}));

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, updatedAt: true, confirmedAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  psUserIdx: index("push_subscriptions_user_id_idx").on(table.userId),
  psEndpointIdx: uniqueIndex("push_subscriptions_endpoint_idx").on(table.endpoint),
}));
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const themeVisibility = pgTable("theme_visibility", {
  themeId: varchar("theme_id", { length: 50 }).primaryKey(),
  visible: boolean("visible").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type ThemeVisibility = typeof themeVisibility.$inferSelect;

export const userThemeAssignments = pgTable("user_theme_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  themeId: varchar("theme_id", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  utaUserIdx: index("uta_user_id_idx").on(table.userId),
  utaUniqueIdx: uniqueIndex("uta_user_theme_idx").on(table.userId, table.themeId),
}));
export type UserThemeAssignment = typeof userThemeAssignments.$inferSelect;

export const themeOrders = pgTable("theme_orders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  themeName: varchar("theme_name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  adminNote: text("admin_note"),
  reviewedBy: varchar("reviewed_by", { length: 36 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
}, (table) => ({
  toUserIdx: index("theme_orders_user_id_idx").on(table.userId),
  toStatusIdx: index("theme_orders_status_idx").on(table.status),
}));
export type ThemeOrder = typeof themeOrders.$inferSelect;

export const emailCampaigns = pgTable("email_campaigns", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  recipientType: varchar("recipient_type", { length: 20 }).notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  openCount: integer("open_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  adminId: varchar("admin_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  ecAdminIdx: index("email_campaigns_admin_id_idx").on(table.adminId),
  ecCreatedAtIdx: index("email_campaigns_created_at_idx").on(table.createdAt),
}));
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
