# Vextorn — Talk. Share. Belong.

## Overview
Vextorn (formerly Connect2Talk) is a browser-based, real-time voice chat platform for language practice. Users join public voice rooms organized by language and skill level, with a lightweight social layer (friends, followers, DMs). Rooms are visible to everyone; creating/joining requires Replit Auth login. Tagline: **Talk. Share. Belong.** Brand assets live in `attached_assets/brand/` (mark, horizontal lockup, stacked lockup) and PNG icons in `client/public/` (`vextorn-mark.svg`, `vextorn-icon-192.png`, `vextorn-icon-512.png`, `favicon.png`). The reusable in-app brand component is `client/src/components/vextorn-logo.tsx` (`<VextornMark />`, `<VextornWordmark />`, `<VextornLockup />`).

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + Socket.IO
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (Google, GitHub, X, Apple, email/password)
- **Real-time**: WebRTC for voice, Socket.IO for signaling/presence
- **Routing**: wouter (client-side)

## Project Structure
```
client/src/
  App.tsx              - Root component with providers and global socket events
  hooks/
    use-auth.ts         - Replit Auth hook (useAuth)
  lib/
    theme.tsx           - Dark/light theme provider
    socket.tsx          - Socket.IO context provider
    utils.ts            - getUserDisplayName, getUserInitials helpers
    queryClient.ts      - TanStack Query client
  components/
    room-card.tsx       - Voice room card with room-theme gradient border + participant decorations + badge pips
    user-badge-pips.tsx - Compact badge display used on room avatars and popovers
    create-room-dialog.tsx - Room creation dialog
    onboarding-tour.tsx - First-visit guided tour for the lobby (welcome → rooms → languages → search → done) with sculpted neumorphic card, inverse-depth SVG spotlight, dot progress, and bottom-left "Tour" relauncher capsule. State persisted in localStorage (`vextorn:onboarding:v1`, `…:v1:step`). Step targets resolved via `[data-tour-target="..."]` attributes on the lobby's first room card, Languages chip, and search shell.
    voice-room.tsx      - Active voice room with WebRTC + chat + tools + room theme panel
    profile-decorations.tsx - ProfileDecoration component + ROOM_THEMES + getRoomThemeStyle helpers
    social-panel.tsx    - Friends/followers side panel
    dm-view.tsx         - Direct messaging view
    profile-dropdown.tsx - Profile menu with decoration picker, avatar ring, flair badge, blocked users, and badge applications
    notifications-dropdown.tsx - Notifications bell dropdown
    theme-toggle.tsx    - Dark/light mode toggle
  pages/
    lobby.tsx           - Main lobby (visible to all, auth-gated actions)
    landing.tsx         - Landing page (unused, lobby is default)
    room.tsx            - Voice room page (auth required)
    dm.tsx              - Direct messages page (auth required)
    admin.tsx           - Admin Command Center with reports, users, teacher apps, badges, announcements

server/
  index.ts             - Express server entry
  routes.ts            - API routes + Socket.IO handlers
  storage.ts           - Database storage interface (IStorage)
  db.ts                - Drizzle database connection
  replit_integrations/  - Replit Auth middleware

shared/
  schema.ts            - Drizzle schemas + TypeScript types
  models/auth.ts       - Users + sessions table definitions
```

## Key Features
1. Replit Auth (Google/GitHub/X/Apple/email login)
2. Public lobby - rooms visible without login
3. Voice rooms organized by language + level (13 languages including Armenian)
4. WebRTC peer-to-peer voice communication
5. In-room text chat with tabbed side panel (Chat/People/YouTube/Read/Chess) + @mention support
6. Screen share (fills main content area when active)
7. YouTube watch-together (fills main content area, search in side panel with trending auto-load)
8. Follow/unfollow from within voice rooms (People tab)
9. Host controls (kick/force-mute users)
10. Real-time presence (online/offline)
11. Direct messaging between users
12. Social layer (follow/unfollow, notifications)
13. Profile management (display name, avatar upload via multer)
14. Room auto-delete 90s after last participant leaves
15. Dark mode with futuristic cyan/purple theme
16. Collapse/expand language filter (not scrollbar)
17. Large circular participant avatars with gradient rings
18. Mic muted by default (isMuted starts true, track disabled on getUserMedia)
19. Multi-ring speaking wave animation on active speakers
20. 15-second disconnect grace period to prevent phantom removal
21. Socket.IO reconnection hardened (infinite attempts, re-emit user:online)
22. Emoji picker (emoji-picker-react) in chat - separate button
23. GIF search via GIPHY API (requires GIPHY_API_KEY secret) - separate button
24. Image upload in chat (photos via multer, /api/upload/chat-image)
25. Host can edit room settings (title/language/level/maxUsers) from room card
26. Camera/YouTube/Book status icons on participant avatars
27. Host transfer (via participant popover - previous host becomes co-owner)
28. Role assignment (co-owner/guest) via participant popover for hosts and co-owners
29. Click-to-watch YouTube (opt-in via any participant's popover, matches video/screen behavior)
30. Screen share uses callback ref to fix black screen (srcObject timing)
31. 30-second disconnect grace period, 60s server ping timeout, client heartbeat every 10s
32. Control buttons centered in header bar between room info and panel toggles
33. User bio (editable in profile, shown in popovers and social panel)
34. @mentions use `@[Name]` bracket format for reliable highlighting
35. Social panel "All" tab shows connected users only (following + followers), not all platform users
36. Profile decorations (sparkles/fire/hearts/stars/bubbles/flowers/lightning/snow/cosmic/rainbow/cat ears) - animated particles around avatars
37. Room themes (neon/galaxy/sunset/forest/cyberpunk/ocean/cherry) - host selects via Palette button, applies gradient to room card border and background
38. profileDecoration and roomTheme fields persisted in DB and returned in all user/room API responses
39. Read Together — host opens Project Gutenberg book, all participants get invite banner + scroll sync
40. Book reader count shown per-book; amber book icon shown on participant avatars when reading
41. Chess.com panel with quick links and step-by-step guide (no embed — Chess.com blocks iframe)
42. Go Live button in toolbar — shows OBS streaming guide for YouTube, Twitch, and TikTok
43. Unread message badge on Chat tab and toolbar chat button — increments when messages arrive while not on chat tab, resets when tab opened
44. System messages in public chat for user actions: joining, leaving, role assignments (Host sets X as Co-Owner/Guest), block/unblock events
45. Deleted message placeholder — instead of removing deleted messages, shows "This message was deleted." inline with Trash icon
46. YouTube time-sync on profile click — viewers who click broadcaster's profile and open the video sync to the broadcaster's current playback time via socket round-trip
47. Activity mutual exclusivity — opening book reader stops active YouTube; turning on camera stops YouTube and closes book reader
48. Advanced Admin System — Super Admin is hardcoded to dj55jggg@gmail.com, Platform Admins can moderate reports/warn users/bypass room capacity, and the Admin Command Center is visible only to admins/owner
49. Room chat improvements — long messages wrap correctly, users can choose a chat message color, and temporary private in-room messages can be sent to one selected participant without storing them in room history
50. Chat link previews — pasted links are clickable, and pasted direct image/GIF URLs or GIF pages with preview metadata render as inline chat previews
51. Room creation customization — creators can choose the room card theme and background video during initial room creation, including uploaded videos or YouTube links/search results
52. Premium Atmosphere theme — animated transparent neon-glass room cards with cyan/fuchsia/orange glow, star particles, light sweeps, and matching avatar rings/buttons
53. Book a Teacher feature — dedicated `/teachers` page with teacher discovery, profiles, booking dialog (date/time/duration/session type), star-rated reviews, and "My Bookings" panel with cancellation support
54. Apply to Become a Teacher — users can submit applications from `/teachers` (name, bio, languages, levels, specializations, suggested rate, PayPal email, experience); admins review in the Admin panel "Teacher Applications" tab, approve (setting the rate, auto-creating a teacher profile) or reject with notes; application status shown inline to the applicant
55. Search discovery filters — lobby search now switches between Rooms, Top Speakers, and Famous Users; people filters show real users in a horizontal scroll list with follower counts, online/current-room indicators, follow tracking, and talk/message actions
56. Teacher discovery preview — `/teachers` displays responsive sample teacher cards when no approved teacher records exist yet, matching the app's neon room-card visual language
57. Global themed scrollbars — scrollable areas use thin cyan/violet gradient scrollbars with stable gutter spacing so controls such as Create Room remain accessible on smaller screens
58. Badge system — user badges can be awarded by admins, displayed as premium badge pips on every room card avatar, and announced globally with in-room system chat messages across active rooms
59. Badge applications — users can apply for badges from the profile menu; admins can approve/reject requests in the Admin badges tab, with approvals automatically awarding the badge
60. Owner-only powers — only the Platform Owner can send global announcements, restrict/unrestrict users, and view user emails in admin-facing user/application lists
61. Restrictions — restricted users are blocked from creating rooms, joining rooms, sending room chat, and sending direct messages until the restriction expires
62. Profile block list — users can view blocked users from the profile menu and unblock them
63. Owner announcement management — Platform Owner can draft, edit, publish, and delete announcements with image/GIF attachments; published announcements appear in the lobby and are broadcast live to active users/rooms
64. Announcement read receipts — logged-in users automatically create per-announcement view receipts, can dismiss published announcements from the lobby, and the Platform Owner sees viewed/dismissed counts in the admin announcement list
65. Microphone recovery/settings — voice rooms include an Allow Microphone retry flow with clear blocked-permission guidance and a microphone source selector for switching between connected input devices.
66. Chat unread/reply upgrades — room chat shows a prominent jump-to-latest button with unread counts, and replies now preserve text/image/GIF previews when sending text, pasted images, uploaded images, or selected GIFs.
67. Profile image hardening — avatar components fall back to initials when stored image URLs fail, profile image paths are normalized on update, and legacy imported avatar/image files can still be served when old data references root-level filenames.
68. Short room URLs — rooms keep UUID primary keys internally while storing a short room id plus access key; public rooms open as /room/{shortId} without a key, while private rooms require the host-owned /room/{shortId}?key={accessKey} link and reject unkeyed UUID/short access.
69. Owner-only account deletion — the Platform Owner can permanently delete non-admin user accounts from /admin, with server-side guards and cleanup across user-related records.
70. Payment methods UI — users can save payment cards (stored as last 4 digits + brand + expiry, never raw card data) via a dedicated `/payment-methods` page and inline during booking; the BookingDialog is a 2-step flow (Session Details → Payment) with card brand detection (Visa/Mastercard/Amex/Discover), real-time formatting, expiry/CVV validation, saved card selection, and default card management.
71. Sample room card images — lobby demo room participants use local generated SVG portrait images so room cards show avatars instead of blank initials and avoid external image dependencies.
72. YouTube watch-together CSP and playback support — security headers allow YouTube embeds, playback uses a direct youtube-nocookie iframe for better reliability inside Replit preview, and users can paste YouTube URLs or video IDs into the room YouTube search box to play them directly. Per-host watch parties: each participant owns their own YouTube slot (server tracks `roomYoutubeState` as `Map<roomId, Map<hostId, state>>` and votes/queues are scoped per-host), so one user picking a video no longer hijacks anyone else's player. Other participants see the host's avatar with a stack of watcher avatars above their tile, and can opt in to a host's video from the participant popover.
73. Room-observable AI Tutor — one participant can speak with AI Tutor while other room participants see the LivePortrait-style animated SVG face, live caption, speaking state, and hear the same generated response through local speech synthesis. The avatar has neutral/listening and engaged/speaking expression states, and its mouth uses TTS-driven viseme timing for lip sync. AI Tutor settings persist locally, with the browser TTS voice ID and LivePortrait avatar appearance decoupled so neither changes unless the user explicitly changes it. AI model routing prioritizes NVIDIA Nemotron when `NVIDIA_API_KEY` is configured, with concise voice-first replies that listen to the user's exact input.
74. AI Tutor hardening — listening mode keeps avatar eyebrows static while preserving listening bars/blink/ambient face motion, and server-side AI model routing ignores `NVIDIA_API_KEY` values that are accidentally set to database connection strings.
75. AI Tutor avatar realism step 1 — the existing circular SVG avatar now uses skin micro-texture, realistic facial depth highlights/shadows, layered natural brows, hair strand lighting, deeper iris/pupil rendering, and subtle nose/cheek contouring while preserving the holographic AI Tutor frame and viseme-driven lip-sync overlay.
76. AI Tutor compact voice/visual update — AI Tutor now resets to the Female voice on load, stops saving browser auto-selected voice IDs that could drift to male voices, avoids common male TTS voices when choosing a female voice, limits visible avatar presets to female human options, uses more natural hair/eye/skin colors, and renders in a smaller responsive overlay with a narrower chat panel.
77. AI Tutor mouth placement fix — removed the static painted smile that created a duplicate mouth, simplified the nose shading so it cannot read as a second mouth, repositioned the single viseme-driven mouth to the correct lower-face area, softened lip colors, and tuned the default female avatar closer to the silver-hair/blue-eye reference.
78. AI Tutor reference-style face and listening eyes — the avatar now includes a glowing headset, darker high-collar suit, additional silver hair strands, separated iris/pupil highlights, natural blink timing, and listening-only eye tracking while keeping brows static and the mouth closed unless speaking.
79. ElevenLabs voice integration ("Eva" persona) — AI Tutor adds a third voice persona "Eva" that routes through ElevenLabs hosted TTS via `POST /api/ai-tutor/tts` (proxied by `server/elevenlabs.ts`). Female ("Afi K") and Male ("Dude") personas are unchanged and continue using the browser `speechSynthesis` engine; Eva is the only one that hits the server. Both engines share the same `TtsCallbacks` contract via `createTts()` in `client/src/lib/ai-tutor/tts-factory.ts` — the factory routes per voice (Eva → `EvaTtsEngine` in `eva-tts.ts`, Female/Male → browser `TtsEngine` in `tts.ts`). `EvaTtsEngine` fetches MP3 audio, decodes via Web Audio, and drives mouth visemes from an `AnalyserNode` RMS amplitude loop. Multi-key pooling: `ELEVENLABS_API_KEYS` accepts a comma-separated list of API keys; the proxy rotates round-robin and automatically skips keys that hit 401/402/403/429 (cooled down for 1 hour, then retried). `GET /api/ai-tutor/tts/health` reports `{ available, reachable, keyCount, exhausted }` for diagnostics. Per-failure errors are surfaced to the UI via `window.__vextornOnEvaTtsError` → toast bridge in `voice-room.tsx` (no silent browser-voice fallback when Eva is selected — the user picked Eva on purpose). Active-session gate matches `/api/ai-tutor/chat` so other room participants cannot burn a user's quota.

## Admin System
- Super Admin / Platform Owner: hardcoded by email (`dj55jggg@gmail.com`) and automatically elevated on auth user fetch.
- Platform Admins: assigned only by the Super Admin from `/admin`; can view users, review/dismiss reports, review badge/teacher applications, issue warnings, award badges, and bypass room capacity checks.
- Platform Owner-only actions: view user emails, restrict/unrestrict users, delete non-admin user accounts, send global announcements, and promote/demote platform admins.
- Warnings: increment `users.warningCount`, create stored notifications, emit real-time warning events, and visually flag warned users in the admin UI.
- Restrictions: persist `restrictedUntil`, `restrictedReason`, and `restrictedById`; server routes and sockets enforce active restrictions.
- Reports: stored in `reports` with reporter/reported metadata, category, reason, and status (`pending`, `reviewed`, `dismissed`).
- Badge applications: stored in `badgeApplications` with status (`pending`, `approved`, `rejected`); approval awards the badge and broadcasts a celebration.
- Announcements: stored in `announcements` with title, body, kind, status (`draft`/`published`), image/GIF attachment arrays, creator, and publish timestamps; all CRUD and media uploads are Platform Owner-only. Per-user view/dismiss receipts are stored in `announcementReceipts`.
- UI: `/admin` dashboard uses gated visibility, role badges, warning/restriction indicators, premium owner badge styling, and custom gradient scrollbars.

## User Model
Users table (shared/models/auth.ts):
- id (varchar PK), email, firstName, lastName, displayName, profileImageUrl, bio, avatarRing, flairBadge, profileDecoration, status, role, warningCount, restrictedUntil, restrictedReason, restrictedById, createdAt, updatedAt

Rooms table (shared/schema.ts):
- id, shortId, accessKey, title, language, level, maxUsers, ownerId, isPublic, activeUsers, roomTheme, hologramVideoUrl, welcome settings, createdAt

Badge applications table (shared/schema.ts):
- id, userId, badgeType, reason, status, reviewedById, adminNotes, createdAt, updatedAt

## Design
- Primary accent: Indigo-Blue `--neu-orange: 238 68% 52%` (CSS var kept as `--neu-orange` for naming legacy)
- Surface tokens: `--neu-bg: 228 14% 9%`, `--neu-surface: 228 13% 12%` (dark blue-indigo base)
- Neumorphic utility classes in `client/src/index.css` (~line 2430+):
  `.neu-canvas`, `.neu-surface`, `.neu-inset`, `.neu-btn`, `.neu-btn-orange`,
  `.neu-icon-btn`, `.neu-pill` (+ `.is-active`)
- Create Room button: `Sparkles` icon, `sparkle-icon` CSS animation, magenta-violet gradient
- Active pills, "Step In", "Sign In" buttons all use the rose-magenta accent
- Font: Space Grotesk
- Dark-first design with light mode support
- Per-room theme borders/glow on room cards preserved (owner choice)
- Empty participant slots: neomorphic dark surface + subtle cyan border, no sparkle particles
- Colored avatar gradient rings per participant — NOT affected by room themes
- Animated pulse ring on speaking users uses fuchsia/magenta
- Premium badge pips use each badge color with subtle glow and tooltips
- Voice-room control dock: dark neumorphic surface; ghost/active/AI Tutor buttons use magenta; mic/video/screen-share/leave keep semantic colors
- AI hologram cyan intentionally preserved for the hologram visual effect

## Lobby Neumorphic Redesign (April 2026)
- Active theme `midnight-purple` was unified to a single warm-orange accent family.
  All `--chart-*`, `--primary`, `--secondary`, `--accent`, `--ring`, `--sidebar-primary`
  derive from the orange palette.
- Mixed cyan/blue/teal level labels removed — `levelColor` in `room-card.tsx` maps
  Beginner/Intermediate/Advanced/Native to amber → orange → deep-orange → rose.
- Cyan/blue fallbacks (`text-cyan-400`, `hover:text-blue-*`) replaced with orange.
- Added neumorphic depth tokens (`--neo-bg`, `--neo-shadow-dark`,
  `--neo-shadow-light`) scoped to `html.midnight-purple` and applied as a global
  raised shadow rule on every `[data-testid^="card-room-"]` wrapper.
- New `.neu-icon-btn-red` helper (red gradient + red glow + dual neumorphic
  shadows) is used for the host's room-settings gear in `room-card.tsx`.
- Global scrollbar redesigned to a subtle dark neumorphic pill (raised surface
  thumb on inset track) — no bright accent at rest; faint warm tint on hover.
- Profile decorations and avatar tiles inside lobby cards receive a unified
  `drop-shadow` so colored rings always sit on the same neumorphic base.

## Lobby Neumorphic Polish (Round 3, April 2026)
- Orange palette refined again to **amber-honey** for true harmony with the
  violet-undertone backgrounds: `--neu-orange` 26 78% 48%,
  `--neu-orange-hi` 32 84% 56%, `--neu-orange-lo` 18 72% 34%. Midnight-purple
  primary/secondary/accent/chart values shifted to match. The warmer hue
  creates a complementary contrast with the purple base instead of clashing.
- **In-room "default" theme aligned with the lobby.** `getRoomThemeStyle`
  default is now a midnight-purple radial canvas (deep violet-charcoal
  `#16102a → #060410` with subtle indigo + warm amber aura) and
  `getChatPanelStyle` default uses a violet-charcoal panel with a faint amber
  rim — entering a default-theme room now feels continuous with the lobby.
- New neumorphic depth classes for Create Room dialog elements (in
  `client/src/index.css`):
  - `.neu-tile` / `.neu-tile.is-active` — recessed grooved Card-Theme
    previews with a raised amber rim + glow on the active tile.
  - `.neu-tile-check` — small raised amber confirmation pip on the active tile.
  - `.neu-tile-nav` — tiny neumorphic arrow buttons for the theme carousel.
  - `.neu-tile-dot` — recessed pagination dots; active is raised amber.
  - `.neu-tab-group` / `.neu-tab` / `.neu-tab.is-active` /
    `.neu-tab.is-active-red` — recessed groove containing a raised
    orange (or red, for YouTube) pill on the active tab.
  - `.neu-submit` — proper raised neumorphic orange Create Room button
    (replaces the flat `<Button type="submit">`); pressed state recesses.
  - `.neu-switch` — neumorphic recessed groove track with a raised
    amber-rimmed thumb when checked (replaces the magenta primary toggle).
- `client/src/components/create-room-dialog.tsx` updated to use all the
  new neumorphic classes for tiles, nav arrows, pagination dots,
  upload/youtube tabs, public-room switch, and the submit button.
- **Host gear button restyled.** `.neu-icon-btn-red` (still used on the
  room card's settings gear) is no longer red. It's now a dark neumorphic
  body with a glowing amber icon and a faint amber rim — same material
  language as the Create Room button. Hover deepens the amber glow;
  pressed state recesses into the card. Signals "owner-only" without
  shouting, and no longer clashes with the unified amber theme.
- **Language filter row is now toggleable.** Added a "Languages" pill
  (Globe icon + chevron) on the right side of the discovery row that
  shows/hides the entire language pill row. Active state is the unified
  amber-honey orange. The user's preference persists across reloads
  via `localStorage["vextorn:showLanguageFilters"]`. The toggle only
  appears when "Rooms" is the active discovery filter.
- **Profile Decorations dialog redesigned (square neumorphic tiles).**
  Removed the entire "Animated Decoration" (Flair Badge Animation)
  section from the dialog — `handleSaveDecorations` now always sends
  `profileDecoration: "none"` so prior values clear out. Avatar Ring
  and Flair Badge pickers were converted from rounded rectangles to
  premium square tiles in a 4-column grid via the new `.neu-deco-tile`
  CSS module (`client/src/index.css`). Each tile features:
    - Recessed neumorphic body with amber rim + soft pulse on active.
    - Staggered fade-up + blur-out entrance (`@keyframes neu-deco-enter`,
      35ms / 30ms cascade per item via `--neu-deco-delay` CSS var).
    - Hover lift (-2px), amber sheen sweep (`@keyframes neu-deco-sheen`),
      preview-circle scale, and emoji wiggle.
    - Active state pulses the amber rim glow indefinitely
      (`@keyframes neu-deco-active-pulse`).
    - Inset preview disc with the actual ring sample, or the badge emoji,
      or a slashed-circle "none" indicator.
    - Compact label below preview, all options preserved.
    - Press feedback compresses inward with shorter transition for
      tactile feel.

## Lobby Neumorphic Polish (Round 2, April 2026)
- Toned-down "burnt orange" palette: `--neu-orange` 20 72% 44%, `--neu-orange-hi`
  26 76% 52%, `--neu-orange-lo` 14 70% 32%. Midnight-purple `--primary`,
  `--secondary`, `--accent`, `--chart-*` shifted to match (less saturation,
  lower lightness) so accents stop competing with content.
- Cool blue-tinted inset highlights on `.neu-btn-orange`, `.neu-pill.is-active`
  and `.neu-icon-btn.neu-active` replaced with warm-white insets
  (`rgba(255, 230, 200, …)`) so the orange reads as a single material.
- Step In button: replaced the hard scale-pulse with a calmer cycled
  `step-in-breathe` (3.2s) plus a diagonal `step-in-shine` sweep
  (`::before`, `mix-blend-mode: screen`) for a premium, continuous feel.
- Create Room button: new `.create-room-btn` class — dark neumorphic body with
  a glowing orange Hammer icon (drop-shadow glow on the `.sparkle-icon`).
  No longer inherits `.neu-btn-orange`.
- Removed cyan border (`border-cyan-400`) from the upload-video preview tile
  in the Create Room dialog — now `border-orange-400`.
- Card hover glow softened from 28px @ 0.18 to 16px @ 0.10 to match the
  calmer overall accent intensity.

## Round 5 — Idealistic 3D neumorphic depth pass (lobby)
- `.neu-canvas` (`index.css` ~3047): added a breathing ambient layer
  (`::before`, 14s `neu-aura-breathe`) with warm-amber + indigo corner
  blooms over the existing radial gradients; film grain bumped to 0.022
  with `mix-blend-mode: overlay`. Children get `position: relative; z-index: 1`
  so they sit above the auras.
- `.neu-inset` (~3104): three-stop diagonal gradient + deeper inner
  shadows (`inset 6px 6px 14px / 0.72`), top dark + bottom warm rim
  micro-lines, and a new `.neu-inset:focus-within` state with a 1px
  amber ring + soft 18px amber halo (replaces the prior cool-purple
  focus glow on the search input).
- `.neu-pill` (~3246): three-stop diagonal gradient body, lifted
  highlight/shadow stack, hover adds a 16px amber bloom and 1.5px
  translateY; new `:active` state recesses with subtle amber ring.
- Room cards (`html.neomorphic-dark/light .room-card-shell`,
  `[data-testid^="card-room"]` ~1026): three-stop gradient (deeper at
  bottom-right), heavier dual shadow stack (-10/-10 22px + 12/12 26px),
  warm 1px inner rim (`rgba(255, 200, 140, 0.025)`), and a new `:hover`
  variant that lifts 3px with a 32px amber halo.
- `lobby.tsx` search Input (~951): removed inline focus/blur handlers
  (now driven by `.neu-inset:focus-within`), bumped to `h-11`, added
  `focus-visible:ring-0` to suppress shadcn's default ring so only the
  amber halo shows.
- Scrollbar (`index.css` ~1998): retuned from a chunky 12px sculpted
  pill into a slim 8px deep midnight-navy element. Track now
  `hsl(228 28% 5%) → hsl(228 24% 7%)` with cool inset shadows; thumb
  `hsl(228 22% 16%) → hsl(228 24% 11%)` barely lighter than the track
  so it disappears into the page. Hover keeps the warm amber rim
  (6px @ 0.18) for a quiet hint of life.

## Round 6 — Decoration rings squared to match avatar tiles
- `client/src/components/profile-decorations.tsx`: avatar tiles in
  room cards are now `rounded-2xl` (16px corners), so the animated
  decoration rings/auras were updated to trace a rounded square
  instead of a circle.
- Added module-level helpers `roundedRectPath(cx, cy, halfSize,
  cornerRadius)` and `pointOnRoundedRect(t, cx, cy, halfSize,
  cornerRadius)` plus `AVATAR_TILE_RADIUS = 16`. The path helper emits
  an SVG path for a rounded-rect outline; the perimeter sampler walks
  clockwise starting at top-center so old `(i / count) * 2π` angle
  distributions map directly onto `t = i / count`.
- Each ring's corner radius scales as `AVATAR_TILE_RADIUS + offset`
  so corners stay parallel to the avatar tile as the ring distance
  from center grows.
- Components converted from `<circle>` rings + cos/sin point placement
  to rounded-rect paths + perimeter sampling: `CosmicRing` (3 rings +
  8 dots), `RainbowRing` (3 nested rings), `StarsRing` (10 stars +
  outer halo), `LightningAura` (6 arcs + halo), `FrostAura` (12
  snowflakes + halo), `HeartsAura` (10 spawn points), `SparklesAura`
  (14 sparkle positions), `BubblesAura` (12 bubble origins),
  `PetalsAura` (12 petal origins).
- Untouched: `FireAura` (flames rise from the bottom edge — not a
  ring) and `CatEarsDecoration` (corner-positioned). Remaining
  `<circle>` calls in the file are intentional small dot/bubble/
  flower-center shapes, not ring outlines.

## Round 7 — Burnt-copper orange tone-down
- `client/src/index.css`: muted the neumorphic accent palette so it
  no longer reads as bright neon orange. New values:
  `--neu-orange: 22 68% 46%` (was `20 95% 52%`),
  `--neu-orange-hi: 26 74% 54%` (was `24 100% 60%`),
  `--neu-orange-lo: 16 62% 32%` (was `14 88% 38%`).
- Reduced the `step-in-breathe` keyframe glow halos and
  `.step-in-btn::before` shine alpha (`0.36 → 0.18`) so the lobby
  glow no longer pulses bright.

## Round 8 — Neumorphic look applied inside the voice room
- `client/src/components/voice-room.tsx`: replaced every purple/
  violet/indigo accent (`rgba(139,92,246,…)`, `rgba(167,139,250,…)`,
  `rgba(109,40,217,…)`, `rgba(99,102,241,…)`) used inside the room
  with the burnt-copper palette via `hsla(var(--neu-orange[-hi/-lo])
  / X)`. Affected elements: people-tab toggle, "Welcome" host pill,
  screen-share active button, scroll-to-latest jump pill, people
  filter pills, empty-people state icon, avatar initials fallback,
  DM message button, Follow button.
- People panel **search input** now uses a sculpted neu inset
  (dark gradient bg + amber border + dual inset shadow) instead of
  violet focus ring — matches the lobby search aesthetic.
- Audiobook section header + icon tile recolored from purple to the
  copper palette.
- Announcement category color codes: `platform` cyan→orange,
  `celebration` violet→rose. Maintenance/safety amber/red kept.
- Avatar fallback gradient palette (`avatarGradients`) rebuilt with
  warm amber/orange/yellow stops — removed `from-purple-…`,
  `from-pink-…`, `from-violet-…`, `from-indigo-…` entries so user
  initials never render with rainbow tints.
- Twitch streaming-doc step badges (`bg-purple-600`) intentionally
  left alone — those are Twitch's own brand color in the
  documentation panel.

## Header & Navigation
- The logged-in user header uses an **OrbitalProfileMenu** (in
  `client/src/components/profile-dropdown.tsx`): a glowing radial
  ring of 5 satellites around a central 4-dot core, replacing the
  vertical dropdown. Satellites: Messages, Notifications, Themes,
  Book Teacher, Community. Underneath the orbit is an identity
  card and a 5-button footer (Edit / Settings / Badge / Blocked /
  Logout). The orbit drives **controlled-open** copies of
  `MessagesDropdown`, `NotificationsDropdown`, `ThemePicker`, and
  `SocialPanel` (rendered with `hideTrigger`) so only the avatar
  pill is visible in the header.
- A **ScrollJumpButton** (`client/src/components/scroll-jump-button.tsx`)
  is mounted in the lobby. It targets `.app-scrollbar` (lobby's
  internal scroll surface), shows a fat neumorphic up/down pill on
  the right edge, and auto-hides when the page is not scrollable.
  On mobile (`<= 640px`) the buttons jump to 44×44 tap targets with a
  stronger glow, and the pill keeps a faint baseline opacity so it's
  always discoverable on touch devices that have no hover state.
- A **PinnedSocialsButton**
  (`client/src/components/pinned-socials-button.tsx`) is rendered in
  the lobby for signed-in users when they enable "Pin socials to side"
  in their profile editor. It shows a round floating button on the
  right edge (below the scroll-jump pill) that fans out the user's
  Instagram / LinkedIn / Facebook links, free4talk-style. Backed by
  a `socials_pinned` boolean column on the `users` table (added via
  `shared/models/auth.ts` and synced with `npm run db:push --force`),
  whitelisted in `PATCH /api/users/:id`, and toggled in
  `profile-dropdown.tsx` next to the social URL inputs.
- The onboarding tour's bottom-left **Tour relauncher** capsule has a
  small dismiss `X` that hides it permanently. On touch / mobile
  (`@media (hover: none), (max-width: 640px)`) the X stays visible by
  default (instead of only on hover) so mobile users can actually
  close it.

## User Preferences
- No landing page gate - lobby always shown
- Collapse/expand for language filters instead of scrollbar
- Armenian language included
- Horizontal card layout in voice rooms
- Rooms open in new tab from lobby (leave closes tab)
- YouTube uses real-time search (not URL paste)

## Privacy Controls
- Geolocation is disabled through browser Permissions-Policy headers and a frontend runtime guard that denies geolocation permission checks.
- Security event records intentionally do not store IP addresses or browser user-agent strings.
- API request logs record only method, path, status, and duration; response bodies are not logged.
- Browser fingerprinting surfaces are reduced by denying sensor/client-hint permissions and removing third-party demo avatar/font requests from the default app shell.
