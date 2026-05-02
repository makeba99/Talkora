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
- **Performance & Accessibility:** Optimizations for Lighthouse scores including image lazy loading, `dns-prefetch`, `preconnect`, and WCAG compliance for contrast and accessible naming.
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