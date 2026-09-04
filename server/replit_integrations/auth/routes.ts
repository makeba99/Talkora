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
    // Private user data — must never be cached by CDNs or shared caches.
    // Explicit no-store makes proxy/CDN behaviour unambiguous and prevents
    // Lighthouse from flagging this endpoint with "Serve static assets with
    // an efficient cache policy". The browser preload hint in index.html
    // still works — it uses the network response directly, not a cache entry.
    res.setHeader("Cache-Control", "private, no-store");
    try {
      if (!req.isAuthenticated()) {
        return res.json(null);
      }
      const userId = req.user.id;
      let user = await authStorage.getUser(userId);
      if (user && user.email === SUPER_ADMIN_EMAIL && user.role !== "superadmin") {
        user = await authStorage.updateUser(userId, { role: "superadmin" }) ?? user;
      }
      // Fire-and-forget activity stamp for re-engagement targeting
      void authStorage.updateUser(userId, { lastSeenAt: new Date() } as any).catch(() => {});
      return res.json(user ?? null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
