import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

async function loadReplitDevPlugins(): Promise<PluginOption[]> {
  // These packages are Replit-only (devDependencies). Vite bundles this
  // config at startup, so a static import — or even import("literal") —
  // fails the Railway build when the package is not in node_modules.
  if (process.env.NODE_ENV === "production") return [];

  const plugins: PluginOption[] = [];
  const replit = (name: string) => import(["@replit", name].join("/"));

  try {
    const { default: runtimeErrorOverlay } = await replit(
      "vite-plugin-runtime-error-modal",
    );
    plugins.push(runtimeErrorOverlay());
  } catch {
    // Optional: local/Railway installs without the Replit overlay.
  }

  if (process.env.REPL_ID !== undefined) {
    try {
      const [{ cartographer }, { devBanner }] = await Promise.all([
        replit("vite-plugin-cartographer"),
        replit("vite-plugin-dev-banner"),
      ]);
      plugins.push(cartographer(), devBanner());
    } catch {
      // Optional: not running on Replit.
    }
  }

  return plugins;
}

export default defineConfig({
  plugins: [
    react(),
    ...(await loadReplitDevPlugins()),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "framer-motion": path.resolve(import.meta.dirname, "node_modules/framer-motion/dist/cjs/index.js"),
    },
    dedupe: ["react", "react-dom"],
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

          // room-card.tsx is 1,300+ lines of complex JSX. Splitting it into
          // its own named chunk lets the browser download and parse it in
          // parallel with lobby.tsx instead of as one large sequential task.
          // Two ~50 ms evaluation tasks produce far less TBT than one 100+ ms
          // monolithic task. server/static.ts already matches the pattern
          // /^room-card-[\w-]+\.js$/ for modulepreload injection so both
          // chunks are pre-warmed before React mounts.
          if (id.includes("/components/room-card") && !id.includes("node_modules")) return "room-card";

          // shadcn/ui wrapper components — split into two tiers:
          //
          // LOBBY-CRITICAL (ui-components): components used in the lobby's
          // initial synchronous render (room-card.tsx, lobby.tsx, App.tsx).
          // These are preloaded via Link header so they arrive before React
          // mounts — keeping them in one named chunk avoids 8+ round-trips.
          //
          // NON-CRITICAL: components only used inside lazy-loaded routes
          // (accordion in voice-room, switch/slider in create-room-dialog,
          // tabs/progress in admin, toast/toaster in DeferredToasts, etc.).
          // Returning `undefined` lets Rollup co-locate them with their
          // consumer chunks — they are never downloaded on the lobby cold path.
          //
          // These rules must appear BEFORE the node_modules guard below
          // because /components/ui/ is app-level code, not node_modules.
          if (id.includes("/components/ui/") && !id.includes("node_modules")) {
            // Only include components that are ACTUALLY rendered on the lobby's
            // initial synchronous paint (room-card.tsx + lobby.tsx direct imports).
            //
            // Removed from critical list (moved to their lazy consumer chunks):
            //   dialog       → only used by lazy ProfileDropdown, CreateRoomDialog,
            //                  DmDialog, ReportDialog, RoomEditDialog, SiteFooter
            //   dropdown-menu→ only used by lazy ProfileDropdown
            //   label        → only used by lazy CreateRoomDialog, RoomEditDialog,
            //                  ProfileDropdown, PaymentMethodForm
            //   scroll-area  → only used by lazy MessagesDropdown,
            //                  NotificationsDropdown, ProfileDropdown, SocialPanel
            //   separator    → only used by lazy ProfileDropdown / Sidebar
            //
            // Keeping them in ui-components would ship ~20-30 KB of JS that is
            // parsed but never called on the lobby's first paint, directly
            // contributing to the "Reduce unused JavaScript" Lighthouse audit.
            const LOBBY_CRITICAL_UI = [
              "/components/ui/button",
              "/components/ui/badge",
              "/components/ui/avatar",
              "/components/ui/popover",
              "/components/ui/input",
              "/components/ui/skeleton",
              "/components/ui/tooltip",
              // select removed: neither lobby.tsx nor room-card.tsx import it;
              // it only appears in lazy CreateRoomDialog / RoomEditDialog / admin.
            ];
            if (LOBBY_CRITICAL_UI.some((p) => id.includes(p))) return "ui-components";
            // Non-critical UI: follows its consumer into their lazy chunk.
            return undefined;
          }

          if (!id.includes("node_modules")) return undefined;

          // ── Radix UI + Floating UI chunk strategy ─────────────────────────
          //
          // BACKGROUND: React must live in the SAME chunk as libraries that
          // call React.forwardRef / React.createContext at module-evaluation
          // time. Previously ALL @radix-ui was forced into react-vendor to
          // avoid a runtime race (splitting caused `Cannot read properties of
          // undefined (reading 'forwardRef')`). That was safe but wasteful —
          // every lobby visitor downloaded ~40 KB of Radix primitives that are
          // only ever used inside lazy voice-room / admin / teacher routes.
          //
          // SOLUTION: Only the Radix components on the lobby's initial render
          // path stay in react-vendor. The rest go to "radix-deferred" — a
          // named chunk that is NOT in the Link preload header and therefore
          // not downloaded until a consumer lazy-chunk requests it. Because
          // radix-deferred statically imports React from react-vendor via ES
          // module `import` statements, the browser's module linker guarantees
          // react-vendor finishes executing BEFORE radix-deferred starts,
          // eliminating any possibility of the forwardRef race.
          //
          // Lobby-critical Radix (stay in react-vendor):
          //   slot → Button (every lobby render); avatar → RoomCard avatars;
          //   popover → lobby search suggestions + language filter;
          //   tooltip → App.tsx TooltipProvider (wraps entire app);
          //   collapsible → language tag expand/collapse in lobby.
          //   (dialog, dropdown-menu, select, separator, label, scroll-area
          //    are all deferred — see RADIX_DEFERRED list below.)
          //
          // Non-critical Radix (→ "radix-deferred", loaded lazily):
          //   accordion, alert-dialog, aspect-ratio, checkbox, context-menu,
          //   dialog, dropdown-menu, hover-card, label, menubar,
          //   navigation-menu, radio-group, scroll-area, select, separator,
          //   slider, switch, toast, toggle, toggle-group — only used in
          //   lazy routes (never needed during lobby first paint).
          // NOTE: radix-deferred chunk removed — Radix UI packages call React APIs
          // (useLayoutEffect, forwardRef, createContext) at module-evaluation time,
          // so splitting them from react-vendor causes a runtime race in production
          // ("Cannot read properties of undefined (reading 'useLayoutEffect')").
          // All @radix-ui packages fall through to the react-vendor rule below.

          // ── react-query split ────────────────────────────────────────────
          // @tanstack/react-query + query-core are safe to move out of
          // react-vendor because they only use React via static ES module
          // imports. The browser's module linker guarantees react-vendor
          // executes before query-vendor, so createContext/createRef are
          // available by the time query-vendor evaluates. Splitting this
          // out shrinks react-vendor by ~10-12 KB gzipped and lets the
          // browser's background parser handle both chunks in parallel.
          if (
            id.includes("@tanstack/react-query") ||
            id.includes("@tanstack/query-core")
          ) {
            return "query-vendor";
          }

          // ── @floating-ui split ───────────────────────────────────────────
          // @floating-ui/core, /dom, and /utils are pure positioning-math
          // libraries — they have zero React dependency and call no React APIs
          // at module-evaluation time. Splitting them into their own chunk:
          //
          //  1. Lets the browser download and parse them in parallel with
          //     react-vendor (which imports them via @floating-ui/react).
          //  2. Reduces react-vendor's size by ~20 KB, cutting its parse/eval
          //     time (fewer long tasks → lower TBT).
          //  3. The ES-module linker guarantees floating-vendor evaluates
          //     BEFORE react-vendor because react-vendor statically imports it
          //     via @floating-ui/react → @floating-ui/core — no runtime race.
          //
          // @floating-ui/react and @floating-ui/react-dom DO call
          // React.createContext / React.useLayoutEffect at module-eval time,
          // so they MUST remain in react-vendor alongside React itself.
          if (
            id.includes("@floating-ui/core") ||
            id.includes("@floating-ui/dom") ||
            id.includes("@floating-ui/utils")
          ) {
            return "floating-vendor";
          }

          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("scheduler") ||
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
              // login-screen: not imported anywhere eagerly — icons go to its
              // own lazy chunk, never forced into icons-vendor.
              // update-available-toast: lazy (DeferredToasts, 4 s delay) —
              //   RefreshCw must NOT be forced into the critical icons-vendor.
              // pwa-install-banner: lazy (DeferredOverlays, 8 s delay) —
              //   Share, PlusSquare, MoreVertical, Download, X must stay out
              //   of the critical icons-vendor chunk.
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
          if (id.includes("date-fns") || id.includes("zod")) return "forms-vendor";
          // recharts internally imports every d3-* sub-package. Putting them all into
          // one flat "charts-vendor" chunk removes Rollup's dependency-ordering info,
          // causing d3 const bindings to be accessed before they initialise → TDZ
          // "Cannot access 'T' before initialization". Splitting into two chunks
          // lets the browser's ES-module linker guarantee d3-vendor finishes
          // executing BEFORE recharts-vendor starts — eliminating the TDZ crash.
          if (id.includes("recharts")) return "recharts-vendor";
          if (id.includes("d3-")) return "d3-vendor";
          if (id.includes("emoji-picker-react")) return "emoji-vendor";
          if (id.includes("chess.js") || id.includes("react-chessboard")) return "chess-vendor";
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "tailwindcss-animate",
      "@tailwindcss/typography",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-slot",
      "@radix-ui/react-avatar",
      "@radix-ui/react-popover",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-label",
      "@radix-ui/react-slider",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-visually-hidden",
      "@tanstack/react-query",
      "wouter",
    ],
    exclude: ["framer-motion"],
  },
  server: {
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
