import {
  type User,
  type UpsertUser,
  type Room,
  type InsertRoom,
  type Message,
  type InsertMessage,
  type Follow,
  type InsertFollow,
  type RoomMessage,
  type InsertRoomMessage,
  type Notification,
  type UserNote,
  users,
  rooms,
  messages,
  follows,
  roomMessages,
  notifications,
  userNotes,
  blocks,
  reports,
  roomVotes,
  type Block,
  type InsertBlock,
  type Report,
  type InsertReport,
  teachers,
  bookings,
  teacherReviews,
  teacherApplications,
  type Teacher,
  type InsertTeacher,
  type Booking,
  type InsertBooking,
  type TeacherReview,
  type InsertTeacherReview,
  type TeacherApplication,
  type InsertTeacherApplication,
  userComments,
  type UserComment,
  type InsertUserComment,
  userBadges,
  type UserBadge,
  type InsertUserBadge,
  badgeApplications,
  type BadgeApplication,
  type InsertBadgeApplication,
  announcements,
  type Announcement,
  type InsertAnnouncement,
  announcementReceipts,
  type AnnouncementReceipt,
  securityEvents,
  type SecurityEvent,
  paymentMethods,
  type PaymentMethod,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, ne, inArray } from "drizzle-orm";
import { userCache, roomCache } from "./cache";
import { randomBytes } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUsersByIds(ids: string[]): Promise<Map<string, User>>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserStatus(id: string, status: string): Promise<void>;

  createRoom(room: InsertRoom & { ownerId: string }): Promise<Room>;
  getRoom(id: string): Promise<Room | undefined>;
  getRoomByShortId(shortId: string): Promise<Room | undefined>;
  getAllRooms(): Promise<Room[]>;
  getRoomsByOwner(ownerId: string): Promise<Room[]>;
  updateRoom(id: string, data: Partial<{ title: string; language: string; level: string; maxUsers: number; ownerId: string; roomTheme: string | null; hologramVideoUrl: string | null; welcomeMessage: string | null; welcomeMediaUrls: string[]; welcomeMediaTypes: string[]; welcomeMediaPosition: string; welcomeAccentColor: string }>): Promise<Room | undefined>;
  updateRoomActiveUsers(id: string, count: number): Promise<void>;
  deleteRoom(id: string): Promise<void>;

  createMessage(msg: InsertMessage): Promise<Message>;
  getMessages(userId1: string, userId2: string): Promise<Message[]>;
  getUnreadMessageCount(userId: string): Promise<number>;
  getConversations(userId: string): Promise<{ otherUserId: string; lastMessage: string; lastMessageAt: Date; unreadCount: number }[]>;
  markConversationRead(userId: string, otherUserId: string): Promise<void>;

  createFollow(follow: InsertFollow): Promise<Follow>;
  deleteFollow(followerId: string, followingId: string): Promise<void>;
  getFollowing(userId: string): Promise<Follow[]>;
  getFollowers(userId: string): Promise<Follow[]>;
  getFollowerCounts(userIds: string[]): Promise<Record<string, number>>;

  createRoomMessage(msg: InsertRoomMessage): Promise<RoomMessage>;
  getRoomMessages(roomId: string): Promise<RoomMessage[]>;

  createNotification(data: { userId: string; fromUserId: string; type: string }): Promise<Notification>;
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationsRead(userId: string): Promise<void>;

  createBlock(block: InsertBlock): Promise<Block>;
  deleteBlock(blockerId: string, blockedId: string): Promise<void>;
  getBlockedIds(userId: string): Promise<{ id: string; blockType: string }[]>;
  getBlocksByBlocker(blockerId: string): Promise<{ blockedId: string; blockType: string }[]>;
  
  createReport(report: InsertReport & { reporterName?: string; reportedName?: string; category?: string }): Promise<Report>;
  getAllReports(): Promise<Report[]>;
  updateReport(id: string, data: Partial<Report>): Promise<Report | undefined>;
  getUserReportCount(userId: string): Promise<number>;
  warnUser(userId: string): Promise<User | undefined>;
  setUserRole(userId: string, role: string): Promise<User | undefined>;
  restrictUser(userId: string, data: { restrictedUntil: Date | null; restrictedReason: string | null; restrictedById: string | null }): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  deleteUser(userId: string): Promise<void>;

  addVote(roomId: string, userId: string): Promise<void>;
  removeVote(roomId: string, userId: string): Promise<void>;
  getVoteCounts(roomIds: string[]): Promise<Record<string, number>>;
  getUserVotes(userId: string, roomIds: string[]): Promise<Record<string, boolean>>;

  getAllTeachers(): Promise<Teacher[]>;
  getTeacher(id: string): Promise<Teacher | undefined>;
  createTeacher(data: InsertTeacher): Promise<Teacher>;
  updateTeacher(id: string, data: Partial<Teacher>): Promise<Teacher | undefined>;
  deleteTeacher(id: string): Promise<void>;

  createBooking(data: InsertBooking & { userId: string }): Promise<Booking>;
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingsByUser(userId: string): Promise<Booking[]>;
  getBookingsByTeacher(teacherId: string): Promise<Booking[]>;
  updateBookingStatus(id: string, status: string): Promise<Booking | undefined>;
  cancelBooking(id: string): Promise<void>;

  createTeacherReview(data: InsertTeacherReview): Promise<TeacherReview>;
  getTeacherReviews(teacherId: string): Promise<TeacherReview[]>;
  hasUserReviewedTeacher(userId: string, teacherId: string): Promise<boolean>;

  createTeacherApplication(data: InsertTeacherApplication & { userId: string }): Promise<TeacherApplication>;
  getTeacherApplicationByUser(userId: string): Promise<TeacherApplication | undefined>;
  getAllTeacherApplications(): Promise<TeacherApplication[]>;
  updateTeacherApplication(id: string, data: Partial<TeacherApplication>): Promise<TeacherApplication | undefined>;
  getPendingApplicationCount(): Promise<number>;

  getUserComments(targetUserId: string): Promise<(UserComment & { authorName: string; authorAvatar: string | null })[]>;
  createUserComment(data: InsertUserComment): Promise<UserComment>;
  deleteUserComment(commentId: string, authorId: string): Promise<void>;

  awardBadge(data: InsertUserBadge): Promise<UserBadge>;
  getUserBadges(userId: string): Promise<UserBadge[]>;
  getBadgesForUsers(userIds: string[]): Promise<Record<string, UserBadge[]>>;
  removeBadge(badgeId: string): Promise<void>;
  createBadgeApplication(data: InsertBadgeApplication): Promise<BadgeApplication>;
  getBadgeApplicationByUserAndType(userId: string, badgeType: string): Promise<BadgeApplication | undefined>;
  getBadgeApplications(userId?: string): Promise<BadgeApplication[]>;
  updateBadgeApplication(id: string, data: Partial<BadgeApplication>): Promise<BadgeApplication | undefined>;

  createAnnouncement(data: InsertAnnouncement): Promise<Announcement>;
  getAnnouncement(id: string): Promise<Announcement | undefined>;
  getAnnouncements(): Promise<(Announcement & { viewCount: number; dismissCount: number })[]>;
  getPublishedAnnouncements(limit?: number, userId?: string): Promise<(Announcement & { viewedAt?: Date | null; dismissedAt?: Date | null })[]>;
  updateAnnouncement(id: string, data: Partial<Announcement>): Promise<Announcement | undefined>;
  deleteAnnouncement(id: string): Promise<void>;
  markAnnouncementViewed(announcementId: string, userId: string): Promise<AnnouncementReceipt>;
  dismissAnnouncement(announcementId: string, userId: string): Promise<AnnouncementReceipt>;
  getAnnouncementReceiptCounts(announcementIds: string[]): Promise<Record<string, { viewCount: number; dismissCount: number }>>;

  getSecurityEvents(limit?: number, unresolvedOnly?: boolean): Promise<SecurityEvent[]>;
  resolveSecurityEvent(id: string, resolvedById: string): Promise<SecurityEvent | undefined>;
  getUnresolvedSecurityEventCount(): Promise<number>;

  getPaymentMethods(userId: string): Promise<PaymentMethod[]>;
  addPaymentMethod(data: { userId: string; last4: string; brand: string; expMonth: number; expYear: number; cardholderName: string }): Promise<PaymentMethod>;
  deletePaymentMethod(id: string, userId: string): Promise<void>;
  setDefaultPaymentMethod(id: string, userId: string): Promise<void>;
  getDefaultPaymentMethod(userId: string): Promise<PaymentMethod | undefined>;

  getUserNote(authorId: string, subjectId: string): Promise<import("@shared/schema").UserNote | undefined>;
  upsertUserNote(authorId: string, subjectId: string, note: string): Promise<import("@shared/schema").UserNote>;
  getExpiredRestrictions(): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  private generateAccessKey(): string {
    return randomBytes(12).toString("base64url").slice(0, 16);
  }

  private async generateUniqueShortId(): Promise<string> {
    for (let i = 0; i < 12; i++) {
      const shortId = `iw${randomBytes(4).toString("hex").slice(0, 5)}`;
      const [existing] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.shortId, shortId));
      if (!existing) return shortId;
    }
    return `iw${Date.now().toString(36).slice(-8)}`;
  }

  private async ensureRoomAccessFields(room: Room): Promise<Room> {
    if (room.shortId && room.accessKey) return room;
    const shortId = room.shortId || await this.generateUniqueShortId();
    const accessKey = room.accessKey || this.generateAccessKey();
    const [updated] = await db
      .update(rooms)
      .set({ shortId, accessKey })
      .where(eq(rooms.id, room.id))
      .returning();
    const result = updated || room;
    roomCache.set(`room:${result.id}`, result);
    if (result.shortId) roomCache.set(`room:short:${result.shortId}`, result);
    roomCache.delete("rooms:all");
    return result;
  }

  async getUser(id: string): Promise<User | undefined> {
    const cached = userCache.get(`user:${id}`);
    if (cached) return cached;
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (user) userCache.set(`user:${id}`, user);
    return user;
  }

  async getUsersByIds(ids: string[]): Promise<Map<string, User>> {
    if (ids.length === 0) return new Map();
    const result = new Map<string, User>();
    const missing: string[] = [];
    for (const id of ids) {
      const cached = userCache.get(`user:${id}`);
      if (cached) result.set(id, cached);
      else missing.push(id);
    }
    if (missing.length > 0) {
      const rows = await db.select().from(users).where(inArray(users.id, missing));
      for (const row of rows) {
        userCache.set(`user:${row.id}`, row);
        result.set(row.id, row);
      }
    }
    return result;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (user) userCache.set(`user:${id}`, user);
    userCache.delete("users:all");
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    const cached = userCache.get("users:all");
    if (cached) return cached;
    const result = await db.select().from(users);
    userCache.set("users:all", result, 15_000);
    return result;
  }

  async updateUserStatus(id: string, status: string): Promise<void> {
    await db.update(users).set({ status }).where(eq(users.id, id));
    userCache.delete(`user:${id}`);
    userCache.delete("users:all");
  }

  async createRoom(roomData: InsertRoom & { ownerId: string }): Promise<Room> {
    const [room] = await db.insert(rooms).values({
      ...roomData,
      shortId: await this.generateUniqueShortId(),
      accessKey: this.generateAccessKey(),
    }).returning();
    roomCache.delete("rooms:all");
    return room;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const cached = roomCache.get(`room:${id}`);
    if (cached) return cached;
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    if (!room) return undefined;
    const result = await this.ensureRoomAccessFields(room);
    roomCache.set(`room:${id}`, result);
    return result;
  }

  async getRoomByShortId(shortId: string): Promise<Room | undefined> {
    const cached = roomCache.get(`room:short:${shortId}`);
    if (cached) return cached;
    const [room] = await db.select().from(rooms).where(eq(rooms.shortId, shortId));
    if (!room) return undefined;
    const result = await this.ensureRoomAccessFields(room);
    roomCache.set(`room:short:${shortId}`, result);
    return result;
  }

  async getAllRooms(): Promise<Room[]> {
    const cached = roomCache.get("rooms:all");
    if (cached) return cached;
    const result = await db.select().from(rooms).orderBy(desc(rooms.createdAt));
    const normalized = await Promise.all(result.map((room) => this.ensureRoomAccessFields(room)));
    roomCache.set("rooms:all", normalized, 5_000);
    return normalized;
  }

  async getRoomsByOwner(ownerId: string): Promise<Room[]> {
    return db.select().from(rooms).where(eq(rooms.ownerId, ownerId));
  }

  async updateRoom(id: string, data: Partial<{ title: string; language: string; level: string; maxUsers: number; ownerId: string; roomTheme: string | null; hologramVideoUrl: string | null; welcomeMessage: string | null; welcomeMediaUrls: string[]; welcomeMediaTypes: string[]; welcomeMediaPosition: string; welcomeAccentColor: string }>): Promise<Room | undefined> {
    const [room] = await db.update(rooms).set(data).where(eq(rooms.id, id)).returning();
    if (room) roomCache.set(`room:${id}`, room);
    roomCache.delete("rooms:all");
    return room;
  }

  async updateRoomActiveUsers(id: string, count: number): Promise<void> {
    await db.update(rooms).set({ activeUsers: count }).where(eq(rooms.id, id));
    roomCache.delete(`room:${id}`);
    roomCache.delete("rooms:all");
  }

  async deleteRoom(id: string): Promise<void> {
    await db.delete(roomMessages).where(eq(roomMessages.roomId, id));
    await db.delete(roomVotes).where(eq(roomVotes.roomId, id));
    await db.delete(rooms).where(eq(rooms.id, id));
    roomCache.delete(`room:${id}`);
    roomCache.delete("rooms:all");
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(msg).returning();
    return message;
  }

  async getMessages(userId1: string, userId2: string): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(
        or(
          and(eq(messages.fromId, userId1), eq(messages.toId, userId2)),
          and(eq(messages.fromId, userId2), eq(messages.toId, userId1))
        )
      )
      .orderBy(messages.createdAt);
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.toId, userId), eq(messages.read, false)));
    return result[0]?.count || 0;
  }

  async getConversations(userId: string): Promise<{ otherUserId: string; lastMessage: string; lastMessageAt: Date; unreadCount: number }[]> {
    const result = await db.execute(sql`
      WITH latest_per_conversation AS (
        SELECT DISTINCT ON (
          LEAST(from_id, to_id),
          GREATEST(from_id, to_id)
        )
          CASE WHEN from_id = ${userId} THEN to_id ELSE from_id END AS other_user_id,
          text AS last_message,
          created_at AS last_message_at
        FROM messages
        WHERE from_id = ${userId} OR to_id = ${userId}
        ORDER BY
          LEAST(from_id, to_id),
          GREATEST(from_id, to_id),
          created_at DESC
      ),
      unread_counts AS (
        SELECT from_id AS other_user_id, COUNT(*)::int AS unread_count
        FROM messages
        WHERE to_id = ${userId} AND read = false
        GROUP BY from_id
      )
      SELECT
        l.other_user_id AS "otherUserId",
        l.last_message   AS "lastMessage",
        l.last_message_at AS "lastMessageAt",
        COALESCE(u.unread_count, 0) AS "unreadCount"
      FROM latest_per_conversation l
      LEFT JOIN unread_counts u ON l.other_user_id = u.other_user_id
      ORDER BY l.last_message_at DESC
    `);
    return (result.rows as any[]).map((row) => ({
      otherUserId: row.otherUserId,
      lastMessage: row.lastMessage,
      lastMessageAt: new Date(row.lastMessageAt),
      unreadCount: Number(row.unreadCount),
    }));
  }

  async markConversationRead(userId: string, otherUserId: string): Promise<void> {
    await db
      .update(messages)
      .set({ read: true })
      .where(and(eq(messages.toId, userId), eq(messages.fromId, otherUserId), eq(messages.read, false)));
  }

  async createFollow(follow: InsertFollow): Promise<Follow> {
    const [result] = await db.insert(follows).values(follow).returning();
    return result;
  }

  async deleteFollow(followerId: string, followingId: string): Promise<void> {
    await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      );
  }

  async getFollowing(userId: string): Promise<Follow[]> {
    return db
      .select()
      .from(follows)
      .where(eq(follows.followerId, userId));
  }

  async getFollowers(userId: string): Promise<Follow[]> {
    return db
      .select()
      .from(follows)
      .where(eq(follows.followingId, userId));
  }

  async getFollowerCounts(userIds: string[]): Promise<Record<string, number>> {
    if (userIds.length === 0) return {};
    const result = await db
      .select({ followingId: follows.followingId, count: sql<number>`count(*)::int` })
      .from(follows)
      .where(inArray(follows.followingId, userIds))
      .groupBy(follows.followingId);
    const counts: Record<string, number> = {};
    for (const uid of userIds) counts[uid] = 0;
    for (const r of result) counts[r.followingId] = r.count;
    return counts;
  }

  async createRoomMessage(msg: InsertRoomMessage): Promise<RoomMessage> {
    const [message] = await db.insert(roomMessages).values(msg).returning();
    return message;
  }

  async getRoomMessages(roomId: string): Promise<RoomMessage[]> {
    return db
      .select()
      .from(roomMessages)
      .where(eq(roomMessages.roomId, roomId))
      .orderBy(roomMessages.createdAt);
  }

  async createNotification(data: { userId: string; fromUserId: string; type: string }): Promise<Notification> {
    const [notif] = await db.insert(notifications).values(data).returning();
    return notif;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }

  async createBlock(block: InsertBlock): Promise<Block> {
    const [result] = await db.insert(blocks).values(block).returning();
    return result;
  }

  async getBlockedIds(userId: string): Promise<{ id: string; blockType: string }[]> {
    const rows = await db
      .select()
      .from(blocks)
      .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
    return rows.map(r => ({
      id: r.blockerId === userId ? r.blockedId : r.blockerId,
      blockType: r.blockType,
    }));
  }

  async deleteBlock(blockerId: string, blockedId: string): Promise<void> {
    await db
      .delete(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)),
          and(eq(blocks.blockerId, blockedId), eq(blocks.blockedId, blockerId))
        )
      );
  }

  async getBlocksByBlocker(blockerId: string): Promise<{ blockedId: string; blockType: string }[]> {
    const rows = await db
      .select({ blockedId: blocks.blockedId, blockType: blocks.blockType })
      .from(blocks)
      .where(eq(blocks.blockerId, blockerId));
    return rows;
  }

  async createReport(report: InsertReport & { reporterName?: string; reportedName?: string; category?: string }): Promise<Report> {
    const [result] = await db.insert(reports).values({
      reporterId: report.reporterId,
      reportedId: report.reportedId,
      reason: report.reason,
      reporterName: report.reporterName,
      reportedName: report.reportedName,
      category: report.category,
      status: "pending",
    }).returning();
    return result;
  }

  async getAllReports(): Promise<Report[]> {
    return db.select().from(reports).orderBy(desc(reports.createdAt));
  }

  async updateReport(id: string, data: Partial<Report>): Promise<Report | undefined> {
    const [result] = await db.update(reports).set(data).where(eq(reports.id, id)).returning();
    return result;
  }

  async getUserReportCount(userId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(eq(reports.reportedId, userId));
    return row?.count ?? 0;
  }

  async warnUser(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ warningCount: sql`${users.warningCount} + 1`, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (user) userCache.set(`user:${userId}`, user);
    userCache.delete("users:all");
    return user;
  }

  async setUserRole(userId: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (user) userCache.set(`user:${userId}`, user);
    userCache.delete("users:all");
    return user;
  }

  async restrictUser(userId: string, data: { restrictedUntil: Date | null; restrictedReason: string | null; restrictedById: string | null }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (user) userCache.set(`user:${userId}`, user);
    userCache.delete("users:all");
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    const ownedRooms = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.ownerId, userId));
    const ownedRoomIds = ownedRooms.map((room) => room.id);
    const ownedTeachers = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.userId, userId));
    const ownedTeacherIds = ownedTeachers.map((teacher) => teacher.id);
    const ownedAnnouncements = await db.select({ id: announcements.id }).from(announcements).where(eq(announcements.createdById, userId));
    const ownedAnnouncementIds = ownedAnnouncements.map((announcement) => announcement.id);

    await db.transaction(async (tx) => {
      if (ownedRoomIds.length > 0) {
        await tx.delete(roomMessages).where(inArray(roomMessages.roomId, ownedRoomIds));
        await tx.delete(roomVotes).where(inArray(roomVotes.roomId, ownedRoomIds));
        await tx.delete(rooms).where(inArray(rooms.id, ownedRoomIds));
      }

      if (ownedTeacherIds.length > 0) {
        await tx.delete(bookings).where(inArray(bookings.teacherId, ownedTeacherIds));
        await tx.delete(teacherReviews).where(inArray(teacherReviews.teacherId, ownedTeacherIds));
        await tx.delete(teachers).where(inArray(teachers.id, ownedTeacherIds));
      }

      if (ownedAnnouncementIds.length > 0) {
        await tx.delete(announcementReceipts).where(inArray(announcementReceipts.announcementId, ownedAnnouncementIds));
        await tx.delete(announcements).where(inArray(announcements.id, ownedAnnouncementIds));
      }

      await tx.delete(messages).where(or(eq(messages.fromId, userId), eq(messages.toId, userId)));
      await tx.delete(follows).where(or(eq(follows.followerId, userId), eq(follows.followingId, userId)));
      await tx.delete(notifications).where(or(eq(notifications.userId, userId), eq(notifications.fromUserId, userId)));
      await tx.delete(blocks).where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
      await tx.delete(reports).where(or(eq(reports.reporterId, userId), eq(reports.reportedId, userId)));
      await tx.delete(roomVotes).where(eq(roomVotes.userId, userId));
      await tx.delete(roomMessages).where(eq(roomMessages.userId, userId));
      await tx.delete(bookings).where(eq(bookings.userId, userId));
      await tx.delete(teacherReviews).where(eq(teacherReviews.userId, userId));
      await tx.delete(teacherApplications).where(eq(teacherApplications.userId, userId));
      await tx.delete(userComments).where(or(eq(userComments.targetUserId, userId), eq(userComments.authorId, userId)));
      await tx.delete(userBadges).where(or(eq(userBadges.userId, userId), eq(userBadges.awardedById, userId)));
      await tx.delete(badgeApplications).where(or(eq(badgeApplications.userId, userId), eq(badgeApplications.reviewedById, userId)));
      await tx.delete(announcementReceipts).where(eq(announcementReceipts.userId, userId));
      await tx.delete(securityEvents).where(or(eq(securityEvents.userId, userId), eq(securityEvents.resolvedById, userId)));
      await tx.delete(users).where(eq(users.id, userId));
    });

    userCache.delete(`user:${userId}`);
    userCache.delete("users:all");
    for (const roomId of ownedRoomIds) roomCache.delete(`room:${roomId}`);
    roomCache.delete("rooms:all");
  }

  async addVote(roomId: string, userId: string): Promise<void> {
    const [existing] = await db.select().from(roomVotes)
      .where(and(eq(roomVotes.roomId, roomId), eq(roomVotes.userId, userId)));
    if (!existing) {
      await db.insert(roomVotes).values({ roomId, userId });
    }
  }

  async removeVote(roomId: string, userId: string): Promise<void> {
    await db.delete(roomVotes)
      .where(and(eq(roomVotes.roomId, roomId), eq(roomVotes.userId, userId)));
  }

  async getVoteCounts(roomIds: string[]): Promise<Record<string, number>> {
    if (roomIds.length === 0) return {};
    const result = await db
      .select({ roomId: roomVotes.roomId, count: sql<number>`count(*)::int` })
      .from(roomVotes)
      .where(inArray(roomVotes.roomId, roomIds))
      .groupBy(roomVotes.roomId);
    const counts: Record<string, number> = {};
    for (const id of roomIds) counts[id] = 0;
    for (const r of result) counts[r.roomId] = r.count;
    return counts;
  }

  async getUserVotes(userId: string, roomIds: string[]): Promise<Record<string, boolean>> {
    if (roomIds.length === 0) return {};
    const result = await db.select().from(roomVotes)
      .where(and(eq(roomVotes.userId, userId), inArray(roomVotes.roomId, roomIds)));
    const votes: Record<string, boolean> = {};
    for (const id of roomIds) votes[id] = false;
    for (const r of result) votes[r.roomId] = true;
    return votes;
  }

  async getAllTeachers(): Promise<Teacher[]> {
    return db.select().from(teachers).orderBy(desc(teachers.createdAt));
  }

  async getTeacher(id: string): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, id));
    return teacher;
  }

  async createTeacher(data: InsertTeacher): Promise<Teacher> {
    const [teacher] = await db.insert(teachers).values(data).returning();
    return teacher;
  }

  async updateTeacher(id: string, data: Partial<Teacher>): Promise<Teacher | undefined> {
    const [teacher] = await db.update(teachers).set(data).where(eq(teachers.id, id)).returning();
    return teacher;
  }

  async deleteTeacher(id: string): Promise<void> {
    await db.delete(bookings).where(eq(bookings.teacherId, id));
    await db.delete(teacherReviews).where(eq(teacherReviews.teacherId, id));
    await db.delete(teachers).where(eq(teachers.id, id));
  }

  async createBooking(data: InsertBooking & { userId: string }): Promise<Booking> {
    const [booking] = await db.insert(bookings).values({ ...data, status: "pending" }).returning();
    return booking;
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async getBookingsByUser(userId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.userId, userId)).orderBy(desc(bookings.scheduledAt));
  }

  async getBookingsByTeacher(teacherId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.teacherId, teacherId)).orderBy(desc(bookings.scheduledAt));
  }

  async updateBookingStatus(id: string, status: string): Promise<Booking | undefined> {
    const [booking] = await db.update(bookings).set({ status }).where(eq(bookings.id, id)).returning();
    return booking;
  }

  async cancelBooking(id: string): Promise<void> {
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id));
  }

  async createTeacherReview(data: InsertTeacherReview): Promise<TeacherReview> {
    const [review] = await db.insert(teacherReviews).values(data).returning();
    const allReviews = await db.select().from(teacherReviews).where(eq(teacherReviews.teacherId, data.teacherId));
    const avgRating = Math.round(allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length);
    await db.update(teachers).set({ rating: avgRating, reviewCount: allReviews.length }).where(eq(teachers.id, data.teacherId));
    return review;
  }

  async getTeacherReviews(teacherId: string): Promise<TeacherReview[]> {
    return db.select().from(teacherReviews).where(eq(teacherReviews.teacherId, teacherId)).orderBy(desc(teacherReviews.createdAt));
  }

  async hasUserReviewedTeacher(userId: string, teacherId: string): Promise<boolean> {
    const [existing] = await db.select().from(teacherReviews)
      .where(and(eq(teacherReviews.userId, userId), eq(teacherReviews.teacherId, teacherId)));
    return !!existing;
  }

  async createTeacherApplication(data: InsertTeacherApplication & { userId: string }): Promise<TeacherApplication> {
    const [app] = await db.insert(teacherApplications).values({ ...data, status: "pending" }).returning();
    return app;
  }

  async getTeacherApplicationByUser(userId: string): Promise<TeacherApplication | undefined> {
    const [app] = await db.select().from(teacherApplications).where(eq(teacherApplications.userId, userId)).orderBy(desc(teacherApplications.createdAt));
    return app;
  }

  async getAllTeacherApplications(): Promise<TeacherApplication[]> {
    return db.select().from(teacherApplications).orderBy(desc(teacherApplications.createdAt));
  }

  async updateTeacherApplication(id: string, data: Partial<TeacherApplication>): Promise<TeacherApplication | undefined> {
    const [app] = await db.update(teacherApplications).set({ ...data, updatedAt: new Date() }).where(eq(teacherApplications.id, id)).returning();
    return app;
  }

  async getPendingApplicationCount(): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(teacherApplications).where(eq(teacherApplications.status, "pending"));
    return row?.count ?? 0;
  }

  async getUserComments(targetUserId: string): Promise<(UserComment & { authorName: string; authorAvatar: string | null })[]> {
    const rows = await db
      .select({
        id: userComments.id,
        targetUserId: userComments.targetUserId,
        authorId: userComments.authorId,
        text: userComments.text,
        createdAt: userComments.createdAt,
        authorName: sql<string>`coalesce(${users.displayName}, concat(${users.firstName}, ' ', ${users.lastName}), ${users.email}, 'User')`,
        authorAvatar: users.profileImageUrl,
      })
      .from(userComments)
      .leftJoin(users, eq(userComments.authorId, users.id))
      .where(eq(userComments.targetUserId, targetUserId))
      .orderBy(desc(userComments.createdAt));
    return rows as (UserComment & { authorName: string; authorAvatar: string | null })[];
  }

  async createUserComment(data: InsertUserComment): Promise<UserComment> {
    const [comment] = await db.insert(userComments).values(data).returning();
    return comment;
  }

  async deleteUserComment(commentId: string, authorId: string): Promise<void> {
    await db.delete(userComments).where(and(eq(userComments.id, commentId), eq(userComments.authorId, authorId)));
  }

  async awardBadge(data: InsertUserBadge): Promise<UserBadge> {
    const [badge] = await db.insert(userBadges).values(data).returning();
    return badge;
  }

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    return db.select().from(userBadges).where(eq(userBadges.userId, userId)).orderBy(desc(userBadges.createdAt));
  }

  async getBadgesForUsers(userIds: string[]): Promise<Record<string, UserBadge[]>> {
    if (userIds.length === 0) return {};
    const rows = await db
      .select()
      .from(userBadges)
      .where(inArray(userBadges.userId, userIds))
      .orderBy(desc(userBadges.createdAt));
    const grouped: Record<string, UserBadge[]> = {};
    for (const id of userIds) grouped[id] = [];
    for (const badge of rows) {
      if (!grouped[badge.userId]) grouped[badge.userId] = [];
      grouped[badge.userId].push(badge);
    }
    return grouped;
  }

  async removeBadge(badgeId: string): Promise<void> {
    await db.delete(userBadges).where(eq(userBadges.id, badgeId));
  }

  async createBadgeApplication(data: InsertBadgeApplication): Promise<BadgeApplication> {
    const [application] = await db.insert(badgeApplications).values(data).returning();
    return application;
  }

  async getBadgeApplicationByUserAndType(userId: string, badgeType: string): Promise<BadgeApplication | undefined> {
    const [application] = await db
      .select()
      .from(badgeApplications)
      .where(and(eq(badgeApplications.userId, userId), eq(badgeApplications.badgeType, badgeType)))
      .orderBy(desc(badgeApplications.createdAt));
    return application;
  }

  async getBadgeApplications(userId?: string): Promise<BadgeApplication[]> {
    const query = db.select().from(badgeApplications).orderBy(desc(badgeApplications.createdAt));
    if (!userId) return query;
    return db
      .select()
      .from(badgeApplications)
      .where(eq(badgeApplications.userId, userId))
      .orderBy(desc(badgeApplications.createdAt));
  }

  async updateBadgeApplication(id: string, data: Partial<BadgeApplication>): Promise<BadgeApplication | undefined> {
    const [application] = await db
      .update(badgeApplications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(badgeApplications.id, id))
      .returning();
    return application;
  }

  async createAnnouncement(data: InsertAnnouncement): Promise<Announcement> {
    const [announcement] = await db.insert(announcements).values({
      ...data,
      publishedAt: data.status === "published" ? new Date() : null,
    }).returning();
    return announcement;
  }

  async getAnnouncement(id: string): Promise<Announcement | undefined> {
    const [announcement] = await db.select().from(announcements).where(eq(announcements.id, id));
    return announcement;
  }

  async getAnnouncements(): Promise<(Announcement & { viewCount: number; dismissCount: number })[]> {
    const rows = await db.select().from(announcements).orderBy(desc(announcements.updatedAt));
    const counts = await this.getAnnouncementReceiptCounts(rows.map((announcement) => announcement.id));
    return rows.map((announcement) => ({
      ...announcement,
      viewCount: counts[announcement.id]?.viewCount || 0,
      dismissCount: counts[announcement.id]?.dismissCount || 0,
    }));
  }

  async getPublishedAnnouncements(limit = 5, userId?: string, lobbyOnly = false): Promise<(Announcement & { viewedAt?: Date | null; dismissedAt?: Date | null })[]> {
    const rows = await db
      .select()
      .from(announcements)
      .where(lobbyOnly
        ? and(eq(announcements.status, "published"), eq(announcements.showOnLobby, true))
        : eq(announcements.status, "published"))
      .orderBy(desc(announcements.publishedAt))
      .limit(userId ? Math.max(limit * 4, 20) : limit);

    if (!userId) return rows;

    const receipts = await db
      .select()
      .from(announcementReceipts)
      .where(eq(announcementReceipts.userId, userId));
    const receiptsByAnnouncement = new Map(receipts.map((receipt) => [receipt.announcementId, receipt]));

    return rows
      .filter((announcement) => !receiptsByAnnouncement.get(announcement.id)?.dismissedAt)
      .slice(0, limit)
      .map((announcement) => {
        const receipt = receiptsByAnnouncement.get(announcement.id);
        return {
          ...announcement,
          viewedAt: receipt?.viewedAt || null,
          dismissedAt: receipt?.dismissedAt || null,
        };
      });
  }

  async updateAnnouncement(id: string, data: Partial<Announcement>): Promise<Announcement | undefined> {
    const [announcement] = await db
      .update(announcements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();
    return announcement;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await db.delete(announcementReceipts).where(eq(announcementReceipts.announcementId, id));
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  async markAnnouncementViewed(announcementId: string, userId: string): Promise<AnnouncementReceipt> {
    const [receipt] = await db
      .insert(announcementReceipts)
      .values({ announcementId, userId, viewedAt: new Date() })
      .onConflictDoUpdate({
        target: [announcementReceipts.announcementId, announcementReceipts.userId],
        set: { viewedAt: new Date(), updatedAt: new Date() },
      })
      .returning();
    return receipt;
  }

  async dismissAnnouncement(announcementId: string, userId: string): Promise<AnnouncementReceipt> {
    const now = new Date();
    const [receipt] = await db
      .insert(announcementReceipts)
      .values({ announcementId, userId, viewedAt: now, dismissedAt: now })
      .onConflictDoUpdate({
        target: [announcementReceipts.announcementId, announcementReceipts.userId],
        set: { viewedAt: now, dismissedAt: now, updatedAt: now },
      })
      .returning();
    return receipt;
  }

  async getAnnouncementReceiptCounts(announcementIds: string[]): Promise<Record<string, { viewCount: number; dismissCount: number }>> {
    if (announcementIds.length === 0) return {};
    const rows = await db
      .select({
        announcementId: announcementReceipts.announcementId,
        viewCount: sql<number>`count(*) filter (where ${announcementReceipts.viewedAt} is not null)`,
        dismissCount: sql<number>`count(*) filter (where ${announcementReceipts.dismissedAt} is not null)`,
      })
      .from(announcementReceipts)
      .where(inArray(announcementReceipts.announcementId, announcementIds))
      .groupBy(announcementReceipts.announcementId);

    return Object.fromEntries(rows.map((row) => [
      row.announcementId,
      {
        viewCount: Number(row.viewCount) || 0,
        dismissCount: Number(row.dismissCount) || 0,
      },
    ]));
  }

  async getSecurityEvents(limit = 100, unresolvedOnly = false): Promise<SecurityEvent[]> {
    let query = db
      .select()
      .from(securityEvents)
      .orderBy(desc(securityEvents.createdAt))
      .limit(limit) as any;
    if (unresolvedOnly) {
      query = db
        .select()
        .from(securityEvents)
        .where(eq(securityEvents.resolved, false))
        .orderBy(desc(securityEvents.createdAt))
        .limit(limit);
    }
    return query;
  }

  async resolveSecurityEvent(id: string, resolvedById: string): Promise<SecurityEvent | undefined> {
    const [event] = await db
      .update(securityEvents)
      .set({ resolved: true, resolvedById })
      .where(eq(securityEvents.id, id))
      .returning();
    return event;
  }

  async getUnresolvedSecurityEventCount(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(securityEvents)
      .where(eq(securityEvents.resolved, false));
    return Number(row?.count) || 0;
  }

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    return db.select().from(paymentMethods).where(eq(paymentMethods.userId, userId)).orderBy(desc(paymentMethods.createdAt));
  }

  async addPaymentMethod(data: { userId: string; last4: string; brand: string; expMonth: number; expYear: number; cardholderName: string }): Promise<PaymentMethod> {
    const existing = await this.getPaymentMethods(data.userId);
    const isDefault = existing.length === 0;
    const [pm] = await db.insert(paymentMethods).values({ ...data, isDefault }).returning();
    return pm;
  }

  async deletePaymentMethod(id: string, userId: string): Promise<void> {
    const [pm] = await db.select().from(paymentMethods).where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)));
    await db.delete(paymentMethods).where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)));
    if (pm?.isDefault) {
      const remaining = await this.getPaymentMethods(userId);
      if (remaining.length > 0) {
        await db.update(paymentMethods).set({ isDefault: true }).where(eq(paymentMethods.id, remaining[0].id));
      }
    }
  }

  async setDefaultPaymentMethod(id: string, userId: string): Promise<void> {
    await db.update(paymentMethods).set({ isDefault: false }).where(eq(paymentMethods.userId, userId));
    await db.update(paymentMethods).set({ isDefault: true }).where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)));
  }

  async getDefaultPaymentMethod(userId: string): Promise<PaymentMethod | undefined> {
    const [pm] = await db.select().from(paymentMethods).where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isDefault, true)));
    return pm;
  }

  async getUserNote(authorId: string, subjectId: string): Promise<UserNote | undefined> {
    const [note] = await db
      .select()
      .from(userNotes)
      .where(and(eq(userNotes.authorId, authorId), eq(userNotes.subjectId, subjectId)));
    return note;
  }

  async upsertUserNote(authorId: string, subjectId: string, note: string): Promise<UserNote> {
    const [result] = await db
      .insert(userNotes)
      .values({ authorId, subjectId, note, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [userNotes.authorId, userNotes.subjectId],
        set: { note, updatedAt: new Date() },
      })
      .returning();
    return result;
  }

  async getExpiredRestrictions(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(sql`restricted_until IS NOT NULL AND restricted_until <= NOW()`);
  }
}

export const storage = new DatabaseStorage();
