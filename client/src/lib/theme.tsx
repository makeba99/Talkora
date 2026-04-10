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
  | "aurora";

export interface ThemeDefinition {
  id: Theme;
  label: string;
  description: string;
  swatchColors: string[];
  isDark: boolean;
  animationClass: string;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "dark",
    label: "Dark",
    description: "Classic dark mode",
    swatchColors: ["#0f1117", "#17193a", "#00c8ff"],
    isDark: true,
    animationClass: "animate-theme-default",
  },
  {
    id: "light",
    label: "Light",
    description: "Clean bright mode",
    swatchColors: ["#f4f6fb", "#edf0f7", "#00acd9"],
    isDark: false,
    animationClass: "animate-theme-default",
  },
  {
    id: "midnight-purple",
    label: "Midnight Purple",
    description: "Deep violet nights",
    swatchColors: ["#0d0a1a", "#160d2b", "#a855f7"],
    isDark: true,
    animationClass: "animate-theme-purple",
  },
  {
    id: "warm-sepia",
    label: "Warm Sepia",
    description: "Vintage golden warmth",
    swatchColors: ["#faf3e0", "#f5e6c8", "#c2813a"],
    isDark: false,
    animationClass: "animate-theme-sepia",
  },
  {
    id: "neon-cyberpunk",
    label: "Neon Cyberpunk",
    description: "Electric neon on black",
    swatchColors: ["#050505", "#0f0f14", "#00ff9f"],
    isDark: true,
    animationClass: "animate-theme-neon",
  },
  {
    id: "frosted-glass",
    label: "Frosted Glass",
    description: "Icy translucent clarity",
    swatchColors: ["#e8f0fe", "#dce8fb", "#3b82f6"],
    isDark: false,
    animationClass: "animate-theme-frost",
  },
  {
    id: "ocean-deep",
    label: "Ocean Deep",
    description: "Dark abyssal teal",
    swatchColors: ["#071820", "#091f2c", "#06b6d4"],
    isDark: true,
    animationClass: "animate-theme-ocean",
  },
  {
    id: "forest-dark",
    label: "Forest Dark",
    description: "Deep woodland greens",
    swatchColors: ["#0a120a", "#0f1a0f", "#4ade80"],
    isDark: true,
    animationClass: "animate-theme-forest",
  },
  {
    id: "rose-gold",
    label: "Rose Gold",
    description: "Warm pink sophistication",
    swatchColors: ["#fdf2f4", "#fae6ea", "#e8657d"],
    isDark: false,
    animationClass: "animate-theme-rose",
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Northern lights ambiance",
    swatchColors: ["#050e12", "#071522", "#10d9a0"],
    isDark: true,
    animationClass: "animate-theme-aurora",
  },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  currentThemeDef: ThemeDefinition;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
  currentThemeDef: THEMES[0],
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    const allThemeClasses = THEMES.map((t) => t.id);
    root.classList.remove(...allThemeClasses, "dark");

    const def = THEMES.find((t) => t.id === theme);
    root.classList.add(theme);
    if (def?.isDark) {
      root.classList.add("dark");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

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
