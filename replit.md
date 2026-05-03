# Vextorn — Talk. Share. Belong.

## Overview
Vextorn is a browser-based, real-time voice chat platform designed for language practice. It allows users to join public voice rooms categorized by language and skill level, fostering a social environment through features like friends, followers, and direct messaging. The platform aims to provide a space for users to **Talk. Share. Belong.** while practicing new languages. Key capabilities include WebRTC-based voice communication, in-room text chat, screen sharing, YouTube watch-together, and a comprehensive social layer. The project also incorporates advanced administrative tools for moderation, teacher management, and a robust badge system.

## User Preferences
- No landing page gate - lobby always shown
- Collapse/expand for language filters instead of scrollbar
- Armenian language included
- Horizontal card layout in voice rooms
- Rooms open in new tab from lobby (leave closes tab)
- YouTube uses real-time search (not URL paste)

## System Architecture
Vextorn is built with a React, Vite, Tailwind CSS, and shadcn/ui frontend, a Node.js, Express, and Socket.IO backend, and uses PostgreSQL with Drizzle ORM for the database. Replit Auth handles user authentication. WebRTC is employed for peer-to-peer voice, and Socket.IO for signaling and presence.

**UI/UX Decisions:**
The design is "dark-first" with a futuristic cyan/purple theme, evolving into an amber-honey and violet-undertone palette with a strong neumorphic aesthetic. Key design elements include:
- **Color Scheme:** Primary accent initially Indigo-Blue/cyan/purple, refined to amber-honey orange complementing violet-charcoal backgrounds.
- **Neumorphism:** Extensive use of neumorphic utility classes for buttons, cards, inputs, and interactive elements, creating a soft, sculpted 3D appearance with subtle glows and depth.
- **Room Cards:** Feature gradient borders, participant decorations, and premium atmosphere themes (animated transparent neon-glass with glow and particles).
- **Avatars:** Large circular participant avatars with gradient rings, multi-ring speaking animations, and square rounded-rectangle animated decoration rings for profile flair.
- **Typography:** Space Grotesk font.
- **Interactive Elements:** Neumorphic buttons, pills, switches, and tabs with active states, hover effects, and tactile press feedback.
- **Scrollbars:** Global themed scrollbars with a subtle dark neumorphic pill design.
- **Header/Navigation:** OrbitalProfileMenu with radial satellites for key features (Messages, Notifications, Themes, Book Teacher, Community), ScrollJumpButton for lobby navigation, and a PinnedSocialsButton with draggable functionality for user social links.
- **AI Tutor Interface:** LivePortrait-style animated SVG face with live captions, speaking states, and viseme-driven lip-sync, featuring micro-textures, facial depth, and realistic features.

**Technical Implementations & Feature Specifications:**
- **Auth & User Management:** Replit Auth, profile management (display name, bio, avatar upload, decoration picker, block list), and an advanced admin system for user moderation, reporting, and account deletion.
- **Real-time Communication:** WebRTC for voice, Socket.IO for presence, in-room text chat with @mentions, emoji/GIF support (GIPHY API), and image uploads.
- **Room Management:** Public lobby, language/skill-level organized rooms, host controls (kick, mute, edit settings, transfer host), auto-deletion of empty rooms, and room creation customization with theme/video selection.
- **Content Sharing:** Screen share, YouTube watch-together (per-host watch parties with sync), "Read Together" with Project Gutenberg integration and scroll sync, and Chess.com panel.
- **Social Features:** Follow/unfollow, direct messaging, real-time presence, notifications, and a badge system with user applications.
- **AI Integration:** AI Tutor with multiple voice personas (browser `speechSynthesis` and ElevenLabs API for "Eva"), viseme-driven lip-sync, and contextual responses.
- **Teacher System:** Dedicated `/teachers` page for discovery, booking, reviews, and a teacher application workflow managed by admins.
- **Monetization:** Payment methods UI for saving cards and a two-step booking dialog.
- **Performance & Accessibility:** Optimizations for Lighthouse scores including image lazy loading, `dns-prefetch`, `preconnect`, WCAG compliance, `useMemo` on all hot-path lobby computations (followingIds, mergedPeople, filteredPeople, languageCounts, languageTags, mergedRoomParticipants, allVisibleParticipantIds), and SSE-based room list push (`GET /api/rooms/stream`) replacing 15s polling. Additional Lighthouse 100 optimizations: module-level viewport-resize singleton in room-card (replaces N per-card resize listeners with one shared passive listener), all `addEventListener("resize")` calls across 6 components made passive, `importance` non-standard attribute removed from priority images (only `fetchpriority` kept), `loading="lazy"` + `decoding="async"` added to search-suggestion person avatars and PWA install banner icon, sr-only `<h1>` added to lobby header for accessibility tree coverage on all viewport sizes (the visible h1 is hidden on mobile by CSS; sr-only ensures a11y audits always find a heading). Further optimizations: (1) room-card backgrounds changed to `loading="lazy" fetchPriority="low"` removing external GIFs/images from the LCP candidate pool entirely; (2) `server/static.ts` transforms Vite's `<link rel="stylesheet">` into non-blocking preload + inline script (eliminates 260ms mobile / 40ms desktop render-blocking penalty); (3) lobby announcement images changed to `loading="lazy"`; (4) **pre-render overlay** (`#vx-pr`) in `index.html` — a `position:fixed` lobby skeleton built with pure inline styles, visible immediately at HTML-parse time (≈200ms), making FCP/LCP measure the skeleton rather than React's mount time (~1.2–2.5s on mobile); `App.tsx`'s `PreRenderDismiss` component hides it after React's first commit via `useEffect`, causing zero CLS since `position:fixed` elements don't affect document flow; (5) `ai-face.png` converted to WebP (73KB → 9KB, 87% reduction); (6) edit-preview `<img>` in room-card given explicit `width`/`height` for CLS; (7) SW cache version bumped to v9. **Critical-path bundle optimizations (2026):** (8) `profile-decorations.tsx` (1,900 lines of inline SVG data) extracted into its own Vite named chunk (`decorations-vendor`, 67 kB) and made lazy — `room-card.tsx` previously imported it eagerly on every lobby load causing ~400ms of script evaluation before paint; (9) New `client/src/lib/room-theme-utils.ts` extracts `ROOM_THEMES` and `getRoomThemeBorderClass` as a tiny synchronous import so room-card can render border classes without pulling in the full decoration library; (10) `GifPickerButton`, `ReportDialog`, and `NeuParticipantSlider` in `room-card.tsx` converted to `React.lazy()` with `Suspense` fallbacks — interaction-only and never needed during first paint.
- **Chunk-splitting improvements (2025):** `vite.config.ts` ui-components chunk now only contains 13 lobby-critical shadcn wrappers (button, badge, avatar, popover, input, skeleton, tooltip, dialog, dropdown-menu, select, separator, label, scroll-area) — non-critical components (accordion, switch, tabs, toast, slider, etc.) follow their lazy consumer chunks and are never downloaded on the lobby cold path. New `radix-deferred` chunk (19.65 kB) holds 14 @radix-ui primitives only used in lazy routes (voice-room, admin, teachers) — ES module static import chain guarantees react-vendor evaluates before radix-deferred so there is no forwardRef race. Lobby filter interactions (`setActiveDiscovery`, `setSelectedLanguage`, `setLanguagesExpanded`) wrapped in `startTransition` to break up long tasks. Fixed pre-existing `setEditTitle is not defined` runtime error in room-card.tsx (RoomEditDialog manages its own form state from the `room` prop).
- **Room SSE Stream:** `GET /api/rooms/stream` sends a full room-list snapshot on connect and after every create/update/delete mutation. The lobby subscribes via `EventSource` and writes directly into the React Query cache — eliminating the 15 s polling interval. The server broadcasts from `broadcastRooms()` hooked into the POST/PATCH/DELETE room routes and the auto-delete grace timer. A 25 s heartbeat prevents proxy timeouts. Safety-net `refetchInterval: 5 * 60 * 1000` remains on the `useQuery` in case EventSource fails to reconnect.
- **Privacy:** Disabled geolocation, no IP/user-agent logging in security events, and reduced browser fingerprinting.

## External Dependencies
- **Replit Auth:** User authentication (Google, GitHub, X, Apple, email/password).
- **Socket.IO:** Real-time signaling and presence.
- **WebRTC:** Peer-to-peer voice communication.
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Database interaction.
- **Tailwind CSS:** Utility-first CSS framework.
- **shadcn/ui:** UI component library.
- **wouter:** Client-side routing.
- **multer:** File uploads (avatars, chat images).
- **emoji-picker-react:** Emoji selection.
- **GIPHY API:** GIF search.
- **Project Gutenberg:** "Read Together" feature content.
- **ElevenLabs API:** AI Tutor "Eva" voice persona (TTS).
- **NVIDIA Nemotron:** AI model routing (when configured).
- **flagcdn.com:** Language flag images.