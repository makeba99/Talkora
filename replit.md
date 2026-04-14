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
  App.tsx              - Root component with providers
  hooks/
    use-auth.ts         - Replit Auth hook (useAuth)
  lib/
    theme.tsx           - Dark/light theme provider
    socket.tsx          - Socket.IO context provider
    utils.ts            - getUserDisplayName, getUserInitials helpers
    queryClient.ts      - TanStack Query client
  components/
    room-card.tsx       - Voice room card with room-theme gradient border + participant decorations
    create-room-dialog.tsx - Room creation dialog
    voice-room.tsx      - Active voice room with WebRTC + chat + tools + room theme panel
    profile-decorations.tsx - ProfileDecoration component + ROOM_THEMES + getRoomThemeStyle helpers
    social-panel.tsx    - Friends/followers side panel
    dm-view.tsx         - Direct messaging view
    profile-dropdown.tsx - Profile menu with decoration picker, avatar ring, flair badge
    notifications-dropdown.tsx - Notifications bell dropdown
    theme-toggle.tsx    - Dark/light mode toggle
  pages/
    lobby.tsx           - Main lobby (visible to all, auth-gated actions)
    landing.tsx         - Landing page (unused, lobby is default)
    room.tsx            - Voice room page (auth required)
    dm.tsx              - Direct messages page (auth required)

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

## Admin System
- Super Admin / Platform Owner: hardcoded by email (`dj55jggg@gmail.com`) and automatically elevated on auth user fetch.
- Platform Admins: assigned only by the Super Admin from `/admin`; can view users, review/dismiss reports, issue warnings, and bypass room capacity checks.
- Warnings: increment `users.warningCount`, create stored notifications, emit real-time warning events, and visually flag warned users in the admin UI.
- Reports: stored in `reports` with reporter/reported metadata, category, reason, and status (`pending`, `reviewed`, `dismissed`).
- UI: `/admin` dashboard uses gated visibility, role badges, warning indicators, premium owner badge styling, and custom gradient scrollbars.

## User Model
Users table (shared/models/auth.ts):
- id (varchar PK), email, firstName, lastName, displayName, profileImageUrl, bio, avatarRing, flairBadge, profileDecoration, status, createdAt, updatedAt

Rooms table (shared/schema.ts):
- id, title, language, level, maxUsers, ownerId, isPublic, activeUsers, roomTheme (varchar 50), createdAt

## Design
- Primary color: Cyan (195 100% 50%)
- Secondary color: Purple (260 60% 60%)
- Font: Space Grotesk
- Dark-first design with light mode support
- Gradient borders on room cards (cyan to purple)
- Colored avatar gradient rings per participant
- Animated pulse ring on speaking users

## User Preferences
- No landing page gate - lobby always shown
- Collapse/expand for language filters instead of scrollbar
- Armenian language included
- Horizontal card layout in voice rooms
- Rooms open in new tab from lobby (leave closes tab)
- YouTube uses real-time search (not URL paste)
