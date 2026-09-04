import { TITLE_COLOR_PALETTE } from "@shared/entitlements";

const TITLE_STYLES = [
  { id: "normal", label: "Normal" },
  { id: "bold", label: "Bold" },
  { id: "italic", label: "Italic" },
  { id: "gradient", label: "Gradient" },
  { id: "glow", label: "Glow" },
  { id: "neon", label: "Neon" },
] as const;

export type TitleStyleId = (typeof TITLE_STYLES)[number]["id"];

type Props = {
  color: string;
  style: string;
  previewText: string;
  onColorChange: (value: string) => void;
  onStyleChange: (value: string) => void;
  testIdPrefix?: string;
};

/**
 * Compact title color + style controls for Create/Edit room panels.
 * Small swatches (20px) keep the dialog scannable without losing options.
 */
export function TitleAppearancePicker({
  color,
  style,
  previewText,
  onColorChange,
  onStyleChange,
  testIdPrefix = "title",
}: Props) {
  return (
    <div className="space-y-2.5 rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Title look
        </span>
        <span
          className="min-w-0 max-w-[55%] truncate text-xs font-extrabold"
          style={{
            color: style === "gradient" ? undefined : color || undefined,
            fontStyle: style === "italic" ? "italic" : undefined,
            fontWeight: style === "bold" ? 900 : 700,
            textShadow:
              style === "glow"
                ? `0 0 6px ${color || "#8B5CF6"}, 0 0 12px ${color || "#8B5CF6"}55`
                : style === "neon"
                  ? `0 0 3px #fff, 0 0 8px ${color || "#00e5ff"}, 0 0 14px ${color || "#00e5ff"}`
                  : undefined,
            ...(style === "gradient"
              ? {
                  background: `linear-gradient(90deg, ${color || "#8B5CF6"}, #38bdf8)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }
              : {}),
          }}
          data-testid={`${testIdPrefix}-preview`}
        >
          {previewText.trim() || "Room title"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="listbox" aria-label="Title color">
        {TITLE_COLOR_PALETTE.map((c) => {
          const active = color === c.value;
          return (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onColorChange(c.value)}
              className={`h-5 w-5 shrink-0 rounded-full border transition-transform ${
                active
                  ? "scale-110 border-white ring-2 ring-primary/50"
                  : "border-white/15 hover:border-white/45 hover:scale-105"
              }`}
              style={{
                background: c.value || "linear-gradient(135deg, #9ca3af, #e5e7eb)",
              }}
              title={c.label}
              aria-label={c.label}
              data-testid={`${testIdPrefix}-color-${c.id}`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1" role="listbox" aria-label="Title style">
        {TITLE_STYLES.map((s) => {
          const active = style === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onStyleChange(s.id)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                active
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/40 text-muted-foreground hover:bg-muted/40"
              }`}
              data-testid={`${testIdPrefix}-style-${s.id}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
