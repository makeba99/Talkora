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
    // Modern browsers (ES2022 target) natively support modulepreload — the
    // Vite polyfill is dead weight for our audience. Removing it saves ~1 kB.
    modulePreload: { polyfill: false },
    // Skips the post-build re-compression pass that prints gzip sizes. Since
    // static.ts pre-compresses at max Brotli quality at runtime, the build-time
    // gzip estimate is misleading anyway. Removing it cuts ~3-5s off CI time.
    reportCompressedSize: false,
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
        // Long-term-cacheable vendor chunks.
        //
        // CRITICAL: React must live in the SAME chunk as anything that calls
        // React.forwardRef / React.createContext at module-evaluation time
        // (@radix-ui, @floating-ui, react-query). Splitting them causes a
        // runtime race — the secondary chunk can execute before react-vendor
        // has finished, leaving React undefined. This was previously attempted
        // as a "radix-vendor" split to gain parallel parse time, but the
        // `Cannot read properties of undefined (reading 'forwardRef')` error
        // proves the race is real. Keep everything that touches React APIs at
        // eval time in one chunk.
        //
        // framer-motion and react-hook-form/@hookform are only used by
        // lazy-loaded routes (badge-announcement, lobby forms). Splitting them
        // pulls ~80–120 kB out of the critical first-paint download for users
        // who never trigger those code paths — safe because they never call
        // React APIs at module-evaluation time.
        manualChunks(id, { getModuleInfo }) {
          // Force the zero-dep shared constants into a predictable named chunk
          // so server/static.ts can inject <link rel="modulepreload"> for it.
          // shared/constants.ts is imported by 9+ lazy route chunks; without a
          // stable name Rollup generates a hash-only filename we can't match.
          // Placing this BEFORE the node_modules guard is intentional — the
          // guard would short-circuit and return undefined for app code.
          if (id.includes("/shared/constants")) return "app-constants";

          // profile-decorations is 1,900 lines of inline SVG data — it must
          // never land in the initial JS bundle. This named chunk makes it
          // lazy-loadable by room-card.tsx (ProfileDecoration) and
          // profile-dropdown.tsx without touching the critical paint path.
          if (id.includes("profile-decorations")) return "decorations-vendor";

          // Consolidate all shadcn/ui wrapper components (button, popover,
          // avatar, select, label, toast, etc.) into one preloadable chunk.
          // Without this, Rollup splits every ~2–3 KB component into its own
          // file → 8+ extra HTTP round-trips on the LCP critical path.
          // These are app-level files (not node_modules), so this rule must
          // appear BEFORE the node_modules guard below.
          if (id.includes("/components/ui/") && !id.includes("node_modules")) return "ui-components";

          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("scheduler") ||
            id.includes("wouter") ||
            id.includes("@tanstack/react-query") ||
            id.includes("@radix-ui") ||
            id.includes("@floating-ui")
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

          // ── Lucide-react icon splitting ──────────────────────────────────
          // Previously ALL lucide icons landed in a single "icons-vendor" chunk
          // that was preloaded on the lobby — including ~50 voice-room-only and
          // ~30 admin-only icons that are never used during lobby paint. Those
          // contributed ~30-40 KiB of unused JS on the lobby page.
          //
          // Strategy: only force icons into the preloadable "icons-vendor" chunk
          // if at least one of their importers is a lobby-critical module. Icons
          // that are exclusively consumed by lazy routes (voice-room, admin,
          // teachers, etc.) fall through — Rollup places them in those lazy chunks
          // and they are never downloaded on the lobby.
          //
          // NOTE: lucide-react uses a barrel (index.js) that Rollup inlines at
          // tree-shake time. After DCE the per-icon module's immediate importers
          // are often the barrel itself, but in Rollup's module graph the BARREL's
          // importers are the real consumers. We therefore walk one level up
          // through barrel-like modules (those whose own id contains "lucide-react")
          // to reach the true consumer files, then test their paths.
          if (id.includes("lucide-react")) {
            const info = getModuleInfo(id);
            if (!info) return "icons-vendor"; // safe fallback

            // Lobby-critical source paths — any icon imported (directly or
            // transitively through the barrel) by one of these modules must be
            // in icons-vendor so it is preloaded on first paint.
            const LOBBY_PATHS = [
              "/pages/lobby",
              "/components/room-card",
              "/components/user-badge-pips",
              "/components/vextorn-logo",
              "/components/login-screen",
              "/components/update-available-toast",
              "/components/pwa-install-banner",
              "/components/ui/", // shadcn UI primitives used eagerly
              "/App.tsx",
            ];

            function isLobbyImporter(moduleId: string): boolean {
              return LOBBY_PATHS.some((p) => moduleId.includes(p));
            }

            // Walk importers: if this module is the barrel, check the barrel's
            // importers. If it is an individual icon module, check its importers
            // (which may be the barrel — in that case recurse one more level).
            const directImporters = info.importers ?? [];
            for (const imp of directImporters) {
              if (isLobbyImporter(imp)) return "icons-vendor";
              // imp might be the lucide barrel itself — look at barrel importers
              if (imp.includes("lucide-react")) {
                const barrelInfo = getModuleInfo(imp);
                for (const barrelImp of barrelInfo?.importers ?? []) {
                  if (isLobbyImporter(barrelImp)) return "icons-vendor";
                }
              }
            }

            // No lobby importer found → leave to Rollup (goes to consumer chunk)
            return undefined;
          }

          if (id.includes("react-icons")) return "social-icons-vendor";
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
