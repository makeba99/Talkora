// Lightweight subset of profile-decorations.tsx.
// Only ROOM_THEMES and getRoomThemeBorderClass are imported by room-card.tsx
// on the critical lobby path. By putting them here, room-card.tsx avoids
// pulling in the full 1,900-line decoration library (with its massive SVG
// arrays) during the initial paint — that file stays in its own lazy chunk
// and only loads when ProfileDecoration is actually needed.

export const ROOM_THEMES = [
  { id: "none", label: "Default", description: "Standard theme", bg: "", preview: "from-slate-600 to-slate-800", img: "https://images.unsplash.com/photo-1497091071254-cc9b2ba7c48a?w=160&h=90&fit=crop" },
  { id: "premium-atmosphere", label: "💎 Premium Atmosphere", description: "Transparent neon glass with luxury cosmic motion", bg: "premium-atmosphere", preview: "from-purple-400 via-fuchsia-400 to-teal-400", img: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=160&h=90&fit=crop" },
  { id: "plasma", label: "⚡ Plasma", description: "Electric purple & blue plasma energy", bg: "plasma", preview: "from-purple-600 via-violet-500 to-blue-500", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=160&h=90&fit=crop" },
  { id: "neon", label: "🌆 Neon City", description: "Cyan & purple neon glow", bg: "neon", preview: "from-cyan-400 via-sky-500 to-purple-600", img: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=160&h=90&fit=crop" },
  { id: "galaxy", label: "🌌 Galaxy", description: "Deep space starfield", bg: "galaxy", preview: "from-indigo-900 via-slate-800 to-purple-900", img: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=160&h=90&fit=crop" },
  { id: "sunset", label: "🌅 Sunset", description: "Warm orange glow", bg: "sunset", preview: "from-orange-400 via-rose-400 to-pink-500", img: "https://images.unsplash.com/photo-1503803548695-c2a7b4a5b875?w=160&h=90&fit=crop" },
  { id: "forest", label: "🌿 Forest", description: "Green nature vibes", bg: "forest", preview: "from-green-700 via-emerald-500 to-teal-400", img: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=160&h=90&fit=crop" },
  { id: "cyberpunk", label: "🤖 Cyberpunk", description: "Yellow & cyan grid", bg: "cyberpunk", preview: "from-yellow-400 via-lime-400 to-cyan-400", img: "https://images.unsplash.com/photo-1620503374956-c942862f0372?w=160&h=90&fit=crop" },
  { id: "ocean", label: "🌊 Ocean", description: "Deep blue waves", bg: "ocean", preview: "from-blue-800 via-blue-600 to-cyan-400", img: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=160&h=90&fit=crop" },
  { id: "cherry", label: "🌸 Cherry Blossom", description: "Pink floral dream", bg: "cherry", preview: "from-pink-300 via-pink-400 to-rose-500", img: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=160&h=90&fit=crop" },
  { id: "aurora", label: "🌌 Aurora", description: "Northern lights", bg: "aurora", preview: "from-green-400 via-teal-500 to-purple-600", img: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=160&h=90&fit=crop" },
  { id: "matrix", label: "💻 Matrix", description: "Digital rain", bg: "matrix", preview: "from-green-900 via-green-700 to-green-500", img: "https://images.unsplash.com/photo-1526378722484-bd91ca387e72?w=160&h=90&fit=crop" },
  { id: "storm", label: "⛈️ Thunderstorm", description: "Rain & lightning", bg: "storm", preview: "from-slate-700 via-slate-600 to-blue-700", img: "https://images.unsplash.com/photo-1504370805625-d37c82b94a8e?w=160&h=90&fit=crop" },
  { id: "volcanic", label: "🌋 Volcanic", description: "Lava & embers", bg: "volcanic", preview: "from-red-700 via-orange-500 to-yellow-500", img: "https://images.unsplash.com/photo-1495953557-73f0ba4c50af?w=160&h=90&fit=crop" },
] as const;

export type RoomThemeId = typeof ROOM_THEMES[number]["id"];

export function getRoomThemeBorderClass(themeId: string | null | undefined): string {
  switch (themeId) {
    case "premium-atmosphere": return "from-cyan-400 via-fuchsia-500 to-orange-400";
    case "neon": return "from-cyan-400 to-purple-500";
    case "galaxy": return "from-indigo-500 to-purple-700";
    case "sunset": return "from-orange-400 to-red-500";
    case "forest": return "from-green-400 to-emerald-600";
    case "cyberpunk": return "from-yellow-400 to-cyan-400";
    case "ocean": return "from-blue-400 to-cyan-600";
    case "cherry": return "from-pink-400 to-rose-500";
    case "gold": return "from-yellow-300 to-amber-500";
    case "violet": return "from-violet-400 to-fuchsia-600";
    case "aurora": return "from-teal-400 to-green-400";
    case "matrix": return "from-green-400 to-green-700";
    case "storm": return "from-blue-500 to-slate-600";
    case "volcanic": return "from-red-500 to-orange-400";
    default: return "from-cyan-500 to-purple-500";
  }
}
