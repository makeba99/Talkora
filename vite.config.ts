import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Long-term-cacheable vendor chunks. Keeps the per-route chunk small,
        // and means a deploy that only touches app code doesn't bust the
        // ~500 KB of stable third-party JS.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler") || id.includes("wouter")) {
            return "react-vendor";
          }
          if (id.includes("@tanstack/react-query")) return "query-vendor";
          if (id.includes("@radix-ui")) return "radix-vendor";
          if (id.includes("lucide-react") || id.includes("react-icons")) return "icons-vendor";
          if (id.includes("socket.io-client") || id.includes("engine.io-client")) return "socket-vendor";
          if (id.includes("date-fns") || id.includes("zod") || id.includes("react-hook-form") || id.includes("@hookform")) {
            return "forms-vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
