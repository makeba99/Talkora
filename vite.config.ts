import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    // Runtime error overlay is a dev-only debugging aid (full-screen modal on
    // unhandled errors). Including it in production ships ~3 KB of overlay
    // JS that runs on every page load. Dev-only keeps the prod bundle clean.
    ...(process.env.NODE_ENV !== "production" ? [runtimeErrorOverlay()] : []),
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
  // esbuild transforms every .ts/.tsx — running these prod-only options here
  // (rather than under `build.esbuild`, which doesn't exist) applies them to
  // the prod bundle while leaving dev untouched so we keep dev-time logging.
  //
  // - `drop: ["debugger"]`: strips any stray `debugger;` statements (zero
  //   functional change, removes ~bytes per occurrence).
  // - `pure: ["console.log", "console.debug", "console.info", "console.trace"]`:
  //   tells esbuild that calls to these are side-effect-free, so the
  //   minifier deletes them entirely. We INTENTIONALLY keep console.warn
  //   and console.error so production runtime issues stay observable in
  //   the browser dev tools (useful for user bug reports).
  //
  // Net effect on the prod bundle: dozens of debug log calls disappear
  // from voice-room, ai-tutor, dm-view etc. — fewer bytes shipped, less
  // main-thread work parsing them, and zero string-formatting cost at
  // runtime. Pure invisibility from a UX standpoint.
  esbuild:
    process.env.NODE_ENV === "production"
      ? {
          drop: ["debugger"],
          pure: ["console.log", "console.debug", "console.info", "console.trace"],
          legalComments: "none",
        }
      : undefined,
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Modern target = smaller bundles (no transpiled async/await, optional
    // chaining, nullish coalescing, etc). Replit's served browsers are all
    // evergreen, so we don't need the es2020 baseline.
    target: "es2022",
    cssCodeSplit: true,
    // Defer the warning floor — our manual-chunk strategy guarantees the
    // critical-path chunks stay small, but a few lazy chunks (voice-room
    // at ~500 kB source, recharts/d3) legitimately exceed 500 kB. The
    // default 500 kB warning fires on those and clutters CI output.
    chunkSizeWarningLimit: 800,
    // Also enables CSS minification at the maximum esbuild level. Vite
    // already does this by default in build mode, but pinning it makes
    // the intent explicit.
    cssMinify: "esbuild",
    rollupOptions: {
      output: {
        // Long-term-cacheable vendor chunks. React must be in the same chunk
        // as anything that calls React.forwardRef / React.createContext at
        // module-evaluation time (Radix, react-query) to guarantee load
        // order. Keeping them together avoids the race where a secondary
        // chunk executes before react-vendor is evaluated.
        //
        // framer-motion and react-hook-form/@hookform were previously
        // bundled into react-vendor "to be safe", but they are only used
        // by lazy-loaded routes/components (badge-announcement and lobby
        // forms respectively). Splitting them into their own chunks pulls
        // ~80–120 kB out of the critical first-paint download for users
        // who never trigger those code paths.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // React core + anything that reads React.* at module scope
          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("scheduler") ||
            id.includes("wouter") ||
            id.includes("@radix-ui") ||
            id.includes("@floating-ui") ||
            id.includes("@tanstack/react-query")
          ) {
            return "react-vendor";
          }
          // Lazy-only deps: only load when the consumer chunk loads.
          if (
            id.includes("framer-motion") ||
            id.includes("motion-dom") ||
            id.includes("motion-utils")
          ) {
            return "motion-vendor";
          }
          if (id.includes("react-hook-form") || id.includes("@hookform")) {
            return "form-vendor";
          }
          if (id.includes("lucide-react") || id.includes("react-icons")) return "icons-vendor";
          if (id.includes("socket.io-client") || id.includes("engine.io-client")) return "socket-vendor";
          if (id.includes("date-fns") || id.includes("zod") || id.includes("zod-validation-error")) return "forms-vendor";
          if (id.includes("recharts") || id.includes("d3-")) return "charts-vendor";
          if (id.includes("emoji-picker-react")) return "emoji-vendor";
          if (id.includes("chess.js") || id.includes("react-chessboard")) return "chess-vendor";
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
