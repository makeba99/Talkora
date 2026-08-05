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
  updateRoom(id: string, data: Partial<{ title: string; language: string; level: string; maxUsers: number; ownerId: string; roomTheme: string | null }>): Promise<Room | undefined>;
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
  getBlockedIds(userId: string): Promise<string[]>;
  getBlocksByBlocker(blockerId: string): Promise<{ blockedId: string }[]>;
  
  createReport(report: InsertReport): Promise<Report>;

  addVote(roomId: string, userId: string): Promise<void>;
  removeVote(roomId: string, userId: string): Promise<void>;
  getVoteCounts(roomIds: string[]): Promise<Record<string, number>>;
  getUserVotes(userId: string, roomIds: string[]): Promise<Record<string, boolean>>;
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

  async updateRoom(id: string, data: Partial<{ title: string; language: string; level: string; maxUsers: number; ownerId: string; roomTheme: string }>): Promise<Room | undefined> {
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

  async getBlockedIds(userId: string): Promise<string[]> {
    const rows = await db
      .select()
      .from(blocks)
      .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
    return rows.map(r => r.blockerId === userId ? r.blockedId : r.blockerId);
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

  async getBlocksByBlocker(blockerId: string): Promise<{ blockedId: string }[]> {
    const rows = await db
      .select({ blockedId: blocks.blockedId })
      .from(blocks)
      .where(eq(blocks.blockerId, blockerId));
    return rows;
  }

  async createReport(report: InsertReport): Promise<Report> {
    const [result] = await db.insert(reports).values(report).returning();
    return result;
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
}

export const storage = new DatabaseStorage();
