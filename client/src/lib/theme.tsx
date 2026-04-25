import { createContext, useContext, useEffect, useState } from "react";

export type Theme =
  | "dark"
  | "light"
  | "midnight-purple"
  | "warm-sepia"
  | "neon-cyberpunk"
  | "frosted-glass"
  | "ocean-deep"
  | "forest-dark"
  | "rose-gold"
  | "aurora"
  | "starfield"
  | "galaxy"
  | "synthwave"
  | "blood-moon"
  | "slate-noir"
  | "neural-pulse"
  | "premium-atmosphere"
  | "neomorphic-dark"
  | "neomorphic-light";

export interface ThemeDefinition {
  id: Theme;
  label: string;
  description: string;
  swatchColors: string[];
  isDark: boolean;
  animated?: boolean;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "premium-atmosphere",
    label: "Premium Atmosphere",
    description: "Luxury animated neon glass",
    swatchColors: ["#03050f", "#1a0b2f", "#ff5c31"],
    isDark: true,
    animated: true,
  },
  {
    id: "neomorphic-dark",
    label: "Neomorphic Dark",
    description: "Sculpted soft 3D depth",
    swatchColors: ["#1c1b29", "#252338", "#c026d3"],
    isDark: true,
  },
  {
    id: "neomorphic-light",
    label: "Neomorphic Light",
    description: "Soft tactile lightness",
    swatchColors: ["#e6e7ee", "#f0f1f7", "#7c5cff"],
    isDark: false,
  },
  {
    id: "dark",
    label: "Dark",
    description: "Classic dark mode",
    swatchColors: ["#0f1117", "#17193a", "#00c8ff"],
    isDark: true,
  },
  {
    id: "light",
    label: "Light",
    description: "Clean bright mode",
    swatchColors: ["#f4f6fb", "#edf0f7", "#00acd9"],
    isDark: false,
  },
  {
    id: "midnight-purple",
    label: "Midnight Purple",
    description: "Particle nebula cosmos",
    swatchColors: ["#0d0a1a", "#160d2b", "#a855f7"],
    isDark: true,
    animated: true,
  },
  {
    id: "warm-sepia",
    label: "Warm Sepia",
    description: "Vintage golden warmth",
    swatchColors: ["#faf3e0", "#f5e6c8", "#c2813a"],
    isDark: false,
  },
  {
    id: "neon-cyberpunk",
    label: "Neon Cyberpunk",
    description: "Electric neon on black",
    swatchColors: ["#050505", "#0f0f14", "#00ff9f"],
    isDark: true,
  },
  {
    id: "frosted-glass",
    label: "Frosted Glass",
    description: "Icy translucent clarity",
    swatchColors: ["#e8f0fe", "#dce8fb", "#3b82f6"],
    isDark: false,
  },
  {
    id: "ocean-deep",
    label: "Ocean Deep",
    description: "Dark abyssal teal",
    swatchColors: ["#071820", "#091f2c", "#06b6d4"],
    isDark: true,
  },
  {
    id: "forest-dark",
    label: "Forest Dark",
    description: "Deep woodland greens",
    swatchColors: ["#0a120a", "#0f1a0f", "#4ade80"],
    isDark: true,
  },
  {
    id: "rose-gold",
    label: "Rose Gold",
    description: "Warm pink sophistication",
    swatchColors: ["#fdf2f4", "#fae6ea", "#e8657d"],
    isDark: false,
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Northern lights ambiance",
    swatchColors: ["#050e12", "#071522", "#10d9a0"],
    isDark: true,
    animated: true,
  },
  {
    id: "starfield",
    label: "Starfield",
    description: "Animated star canvas",
    swatchColors: ["#080c18", "#0d1120", "#93c5fd"],
    isDark: true,
    animated: true,
  },
  {
    id: "galaxy",
    label: "Galaxy",
    description: "Swirling nebula cosmos",
    swatchColors: ["#0b0814", "#120c1e", "#c084fc"],
    isDark: true,
    animated: true,
  },
  {
    id: "synthwave",
    label: "Synthwave",
    description: "Retro 80s neon grid",
    swatchColors: ["#0e080f", "#170b18", "#ff3cb4"],
    isDark: true,
    animated: true,
  },
  {
    id: "blood-moon",
    label: "Blood Moon",
    description: "Crimson moon atmospheric",
    swatchColors: ["#0d0404", "#160707", "#dc2626"],
    isDark: true,
    animated: true,
  },
  {
    id: "slate-noir",
    label: "Slate Noir",
    description: "Desaturated film noir",
    swatchColors: ["#0b0d10", "#10131a", "#6b9fd4"],
    isDark: true,
  },
  {
    id: "neural-pulse",
    label: "Neural Pulse",
    description: "AI network live connections",
    swatchColors: ["#03050e", "#080f1f", "#00d4ff"],
    isDark: true,
    animated: true,
  },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  currentThemeDef: ThemeDefinition;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "premium-atmosphere",
  setTheme: () => {},
  toggleTheme: () => {},
  currentThemeDef: THEMES.find(t => t.id === "premium-atmosphere") ?? THEMES[0],
});

const DEFAULT_THEME: Theme = "neomorphic-dark";
const THEME_DEFAULT_VERSION = "v2-violet-2026-04-25";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const storedDefaultVersion = localStorage.getItem("theme-default-version");
      if (storedDefaultVersion !== THEME_DEFAULT_VERSION) {
        localStorage.setItem("theme-default-version", THEME_DEFAULT_VERSION);
        localStorage.setItem("theme", DEFAULT_THEME);
        localStorage.removeItem("theme-chosen");
        return DEFAULT_THEME;
      }
      const saved = localStorage.getItem("theme") as Theme | null;
      const hasExplicitChoice = localStorage.getItem("theme-chosen") === "1";
      if (saved && hasExplicitChoice) return saved;
      return DEFAULT_THEME;
    }
    return DEFAULT_THEME;
  });

  useEffect(() => {
    const root = document.documentElement;
    const allThemeIds = THEMES.map((t) => t.id);
    root.classList.remove(...allThemeIds, "dark");

    const def = THEMES.find((t) => t.id === theme);
    root.classList.add(theme);
    if (def?.isDark) {
      root.classList.add("dark");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem("theme-chosen", "1");
    setThemeState(t);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const currentThemeDef = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, currentThemeDef }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
