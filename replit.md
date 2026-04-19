# Connect2Talk - Real-time Voice Chat Platform

## Overview
Connect2Talk is a browser-based, real-time voice chat platform for language practice. Users join public voice rooms organized by language and skill level, with a lightweight social layer (friends, followers, DMs). Rooms are visible to everyone; creating/joining requires Replit Auth login.

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
72. YouTube watch-together CSP and playback support — security headers allow YouTube embeds, playback uses a direct youtube-nocookie iframe for better reliability inside Replit preview, and users can paste YouTube URLs or video IDs into the room YouTube search box to play them directly.
73. Room-observable AI Tutor — one participant can speak with AI Tutor while other room participants see the LivePortrait-style animated SVG face, live caption, speaking state, and hear the same generated response through local speech synthesis. The avatar has neutral/listening and engaged/speaking expression states, and its mouth uses TTS-driven viseme timing for lip sync. AI Tutor settings persist locally, with the browser TTS voice ID and LivePortrait avatar appearance decoupled so neither changes unless the user explicitly changes it. AI model routing prioritizes NVIDIA Nemotron when `NVIDIA_API_KEY` is configured, with concise voice-first replies that listen to the user's exact input.
74. AI Tutor hardening — listening mode keeps avatar eyebrows static while preserving listening bars/blink/ambient face motion, and server-side AI model routing ignores `NVIDIA_API_KEY` values that are accidentally set to database connection strings.
75. AI Tutor avatar realism step 1 — the existing circular SVG avatar now uses skin micro-texture, realistic facial depth highlights/shadows, layered natural brows, hair strand lighting, deeper iris/pupil rendering, and subtle nose/cheek contouring while preserving the holographic AI Tutor frame and viseme-driven lip-sync overlay.
76. AI Tutor compact voice/visual update — AI Tutor now resets to the Female voice on load, stops saving browser auto-selected voice IDs that could drift to male voices, avoids common male TTS voices when choosing a female voice, limits visible avatar presets to female human options, uses more natural hair/eye/skin colors, and renders in a smaller responsive overlay with a narrower chat panel.
77. AI Tutor mouth placement fix — removed the static painted smile that created a duplicate mouth, simplified the nose shading so it cannot read as a second mouth, repositioned the single viseme-driven mouth to the correct lower-face area, softened lip colors, and tuned the default female avatar closer to the silver-hair/blue-eye reference.
78. AI Tutor reference-style face and listening eyes — the avatar now includes a glowing headset, darker high-collar suit, additional silver hair strands, separated iris/pupil highlights, natural blink timing, and listening-only eye tracking while keeping brows static and the mouth closed unless speaking.

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
- Primary color: Cyan (195 100% 50%)
- Secondary color: Purple (260 60% 60%)
- Font: Space Grotesk
- Dark-first design with light mode support
- Gradient borders on room cards (cyan to purple)
- Colored avatar gradient rings per participant
- Animated pulse ring on speaking users
- Premium badge pips use each badge color with subtle glow and tooltips

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
