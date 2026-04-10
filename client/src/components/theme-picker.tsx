import { useState } from "react";
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme, THEMES, type Theme } from "@/lib/theme";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<Theme | null>(null);

  const previewTheme = hovered ?? theme;
  const previewDef = THEMES.find((t) => t.id === previewTheme) ?? THEMES[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
            style={{
              background: THEMES.find((t) => t.id === theme)?.swatchColors[2] ?? "#00c8ff",
            }}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 p-3 animate-scale-in"
        data-testid="popover-theme-picker"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Appearance
          </p>
          <div className="flex items-center gap-1.5">
            {previewDef.swatchColors.map((c, i) => (
              <span
                key={i}
                className="w-3 h-3 rounded-full border border-border"
                style={{ background: c }}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1">
              {previewDef.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((def) => {
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
                  relative group flex flex-col gap-1.5 p-2.5 rounded-lg border text-left
                  transition-all duration-200 cursor-pointer
                  ${isActive
                    ? "border-primary bg-primary/8 ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40 hover:bg-accent"
                  }
                `}
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded-md flex-shrink-0 shadow-sm"
                    style={{ background: def.swatchColors[0] }}
                  />
                  <div
                    className="w-5 h-5 rounded-md flex-shrink-0 shadow-sm"
                    style={{ background: def.swatchColors[1] }}
                  />
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm"
                    style={{ background: def.swatchColors[2] }}
                  />
                  {isActive && (
                    <Check className="w-3.5 h-3.5 text-primary ml-auto flex-shrink-0" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium leading-tight">{def.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    {def.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">
            Theme is saved automatically
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
