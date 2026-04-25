import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

const SUPER_ADMIN_EMAIL = "dj55jggg@gmail.com";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let user = await authStorage.getUser(userId);
      if (user && user.email === SUPER_ADMIN_EMAIL && user.role !== "superadmin") {
        user = await authStorage.updateUser(userId, { role: "superadmin" }) ?? user;
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
