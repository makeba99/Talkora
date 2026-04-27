import { useState } from "react";
import { Palette, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme, THEMES, type Theme } from "@/lib/theme";

const CATEGORIES = [
  { label: "All", ids: null },
  { label: "Dark", ids: THEMES.filter((t) => t.isDark && !t.animated).map((t) => t.id) },
  { label: "Light", ids: THEMES.filter((t) => !t.isDark).map((t) => t.id) },
  { label: "Animated", ids: THEMES.filter((t) => t.animated).map((t) => t.id) },
];

interface ThemePickerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function ThemePicker({ open: controlledOpen, onOpenChange, hideTrigger }: ThemePickerProps = {}) {
  const { theme, setTheme } = useTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [hovered, setHovered] = useState<Theme | null>(null);
  const [category, setCategory] = useState<string>("All");

  const previewTheme = hovered ?? theme;
  const previewDef = THEMES.find((t) => t.id === previewTheme) ?? THEMES[0];
  const activeDef  = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  const cat = CATEGORIES.find((c) => c.label === category);
  const visibleThemes = cat?.ids
    ? THEMES.filter((t) => cat.ids!.includes(t.id))
    : THEMES;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {hideTrigger ? (
          <span aria-hidden="true" style={{ display: "none" }} />
        ) : (
          <Button
            size="icon"
            variant="ghost"
            data-testid="button-theme-picker"
            className="relative"
            title="Choose theme"
          >
            <Palette className="w-4 h-4" />
            <span
              className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-background"
              style={{ background: activeDef.swatchColors[2] }}
            />
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-3 animate-scale-in"
        data-testid="popover-theme-picker"
      >
        {/* Header preview */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Appearance
          </p>
          <div className="flex items-center gap-1.5">
            {previewDef.swatchColors.map((c, i) => (
              <span
                key={i}
                className="w-3 h-3 rounded-full border border-border transition-colors duration-200"
                style={{ background: c }}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1 transition-all duration-200">
              {previewDef.label}
            </span>
            {previewDef.animated && (
              <Sparkles className="w-3 h-3 text-primary ml-0.5" />
            )}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-1 mb-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              onClick={() => setCategory(c.label)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                category === c.label
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-theme-cat-${c.label.toLowerCase()}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-0.5">
          {visibleThemes.map((def) => {
            const isActive = theme === def.id;
            return (
              <button
                key={def.id}
                data-testid={`button-theme-${def.id}`}
                onClick={() => {
                  setTheme(def.id);
                  setOpen(false);
                }}
                onMouseEnter={() => setHovered(def.id)}
                onMouseLeave={() => setHovered(null)}
                className={`
                  relative group flex flex-col gap-1.5 p-2 rounded-lg border text-left
                  transition-all duration-200 cursor-pointer
                  ${isActive
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40 hover:bg-accent"
                  }
                `}
              >
                {/* Color swatches */}
                <div className="flex items-center gap-1">
                  <span
                    className="w-5 h-5 rounded-md shadow-sm border border-white/10"
                    style={{ background: def.swatchColors[0] }}
                  />
                  <span
                    className="w-5 h-5 rounded-md shadow-sm border border-white/10"
                    style={{ background: def.swatchColors[1] }}
                  />
                  <span
                    className="w-5 h-5 rounded-full shadow-sm border border-white/10"
                    style={{ background: def.swatchColors[2] }}
                  />
                  <span className="ml-auto flex items-center gap-0.5">
                    {def.animated && (
                      <Sparkles className="w-2.5 h-2.5 text-primary opacity-70" />
                    )}
                    {isActive && (
                      <Check className="w-3 h-3 text-primary" />
                    )}
                  </span>
                </div>

                {/* Label */}
                <div>
                  <p className="text-xs font-medium leading-tight">{def.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">
                    {def.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
            = animated background
          </p>
          <p className="text-[10px] text-muted-foreground">Saved automatically</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
