import { db } from "./db";
import { users, rooms } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) return;

  const seedUsers = await db
    .insert(users)
    .values([
      { displayName: "Sakura", status: "online" },
      { displayName: "Carlos", status: "online" },
      { displayName: "Amira", status: "offline" },
      { displayName: "Liam", status: "online" },
      { displayName: "Yuki", status: "offline" },
    ])
    .returning();

  await db.insert(rooms).values([
    {
      title: "English Beginners Welcome",
      language: "English",
      level: "Beginner",
      maxUsers: 8,
      ownerId: seedUsers[0].id,
      isPublic: true,
      activeUsers: 0,
    },
    {
      title: "Spanish Conversation Club",
      language: "Spanish",
      level: "Intermediate",
      maxUsers: 6,
      ownerId: seedUsers[1].id,
      isPublic: true,
      activeUsers: 0,
    },
    {
      title: "Japanese Practice Room",
      language: "Japanese",
      level: "Beginner",
      maxUsers: 4,
      ownerId: seedUsers[4].id,
      isPublic: true,
      activeUsers: 0,
    },
    {
      title: "Advanced French Discussion",
      language: "French",
      level: "Advanced",
      maxUsers: 8,
      ownerId: seedUsers[3].id,
      isPublic: true,
      activeUsers: 0,
    },
    {
      title: "Hindi for Beginners",
      language: "Hindi",
      level: "Beginner",
      maxUsers: 6,
      ownerId: seedUsers[2].id,
      isPublic: true,
      activeUsers: 0,
    },
    {
      title: "Arabic Native Speakers",
      language: "Arabic",
      level: "Native",
      maxUsers: 10,
      ownerId: seedUsers[2].id,
      isPublic: true,
      activeUsers: 0,
    },
  ]);

  console.log("Database seeded successfully");
}
