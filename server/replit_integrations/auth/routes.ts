import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

const SUPER_ADMIN_EMAIL = "dj55jggg@gmail.com";

export function registerAuthRoutes(app: Express): void {
  // Returns the authenticated user as JSON, or null (200) when not logged in.
  // Using 200+null instead of 401 avoids a browser console error on every
  // unauthenticated page load, which PageSpeed/Lighthouse counts as a Best
  // Practices failure.
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.json(null);
      }
      const userId = req.user.id;
      let user = await authStorage.getUser(userId);
      if (user && user.email === SUPER_ADMIN_EMAIL && user.role !== "superadmin") {
        user = await authStorage.updateUser(userId, { role: "superadmin" }) ?? user;
      }
      return res.json(user ?? null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
