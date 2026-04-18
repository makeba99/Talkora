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
  users,
  rooms,
  messages,
  follows,
  roomMessages,
  notifications,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, ne, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserStatus(id: string, status: string): Promise<void>;

  createRoom(room: InsertRoom & { ownerId: string }): Promise<Room>;
  getRoom(id: string): Promise<Room | undefined>;
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUserStatus(id: string, status: string): Promise<void> {
    await db.update(users).set({ status }).where(eq(users.id, id));
  }

  async createRoom(roomData: InsertRoom & { ownerId: string }): Promise<Room> {
    const [room] = await db.insert(rooms).values(roomData).returning();
    return room;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async getAllRooms(): Promise<Room[]> {
    return db.select().from(rooms).orderBy(desc(rooms.createdAt));
  }

  async getRoomsByOwner(ownerId: string): Promise<Room[]> {
    return db.select().from(rooms).where(eq(rooms.ownerId, ownerId));
  }

  async updateRoom(id: string, data: Partial<{ title: string; language: string; level: string; maxUsers: number; ownerId: string; roomTheme: string | null; hologramVideoUrl: string | null; welcomeMessage: string | null; welcomeMediaUrls: string[]; welcomeMediaTypes: string[]; welcomeMediaPosition: string; welcomeAccentColor: string }>): Promise<Room | undefined> {
    const [room] = await db.update(rooms).set(data).where(eq(rooms.id, id)).returning();
    return room;
  }

  async updateRoomActiveUsers(id: string, count: number): Promise<void> {
    await db
      .update(rooms)
      .set({ activeUsers: count })
      .where(eq(rooms.id, id));
  }

  async deleteRoom(id: string): Promise<void> {
    await db.delete(roomMessages).where(eq(roomMessages.roomId, id));
    await db.delete(rooms).where(eq(rooms.id, id));
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
    const allMessages = await db
      .select()
      .from(messages)
      .where(or(eq(messages.fromId, userId), eq(messages.toId, userId)))
      .orderBy(desc(messages.createdAt));

    const convMap = new Map<string, { otherUserId: string; lastMessage: string; lastMessageAt: Date; unreadCount: number }>();
    for (const msg of allMessages) {
      const otherUserId = msg.fromId === userId ? msg.toId : msg.fromId;
      if (!convMap.has(otherUserId)) {
        convMap.set(otherUserId, {
          otherUserId,
          lastMessage: msg.text,
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
        });
      }
      if (msg.toId === userId && !msg.read) {
        const conv = convMap.get(otherUserId)!;
        conv.unreadCount++;
      }
    }
    return Array.from(convMap.values()).sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
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
    return user;
  }

  async setUserRole(userId: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async restrictUser(userId: string, data: { restrictedUntil: Date | null; restrictedReason: string | null; restrictedById: string | null }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
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
}

export const storage = new DatabaseStorage();
