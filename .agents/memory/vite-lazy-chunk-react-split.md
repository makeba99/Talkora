---
name: Vite lazy-chunk React split
description: Lazy-loaded modules whose deps aren't in optimizeDeps.include cause Vite to runtime re-optimize, splitting React into two instances and breaking hooks.
---

# Vite lazy-chunk React split

**Rule:** Any package first encountered at runtime via a lazy import that is NOT in `optimizeDeps.include` will trigger Vite's runtime dep re-optimization. This generates a new `browserHash`, so the lazy chunk gets a different React (`v=<newHash>`) than the already-running main bundle (`v=<oldHash>`). Two React instances → `ReactCurrentDispatcher.current` is null → `Cannot read properties of null (reading 'useState')`.

**Why:** Vite pre-bundles known deps at startup. Unknown deps discovered at runtime trigger an incremental re-optimize. If the lazy chunk loads before the reload fires, the hash mismatch causes the hook crash.

**How to apply:** For every package only imported inside a lazy component (React.lazy / dynamic import), add it to `optimizeDeps.include` in `vite.config.ts`. In this project: `socket.io-client` and `engine.io-client` are only imported inside the lazy `SocketLayer` — they must be in `optimizeDeps.include`.

**Symptom:** `TypeError: Cannot read properties of null (reading 'useState')` with `renderWithHooks` in the call stack, plus React's "Invalid hook call" warning citing "more than one copy of React".

**Fixed by:** Adding `"socket.io-client"` and `"engine.io-client"` to `optimizeDeps.include` in `vite.config.ts`.
