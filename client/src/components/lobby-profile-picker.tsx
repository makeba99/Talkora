import { Label } from "@/components/ui/label";
import {
  DEFAULT_LOBBY_PROFILE_SIZE,
  DEFAULT_LOBBY_PROFILE_STYLE,
  type LobbyProfileSize,
  type LobbyProfileStyle,
} from "@shared/constants";
import { LOBBY_PROFILE_RADIUS } from "@/lib/lobby-profile";

const STYLES: { id: LobbyProfileStyle; label: string; hint: string }[] = [
  { id: "circle", label: "Round", hint: "Circular avatars with halo frames" },
  { id: "squircle", label: "Soft square", hint: "Modern rounded tiles" },
  { id: "tile", label: "Card", hint: "Classic square portraits" },
];

const SIZES: { id: LobbyProfileSize; label: string }[] = [
  { id: "sm", label: "Compact" },
  { id: "md", label: "Comfortable" },
  { id: "lg", label: "Large" },
];

interface LobbyProfilePickerProps {
  style: LobbyProfileStyle;
  size: LobbyProfileSize;
  onStyleChange: (style: LobbyProfileStyle) => void;
  onSizeChange: (size: LobbyProfileSize) => void;
  testIdPrefix?: string;
}

export function LobbyProfilePicker({
  style = DEFAULT_LOBBY_PROFILE_STYLE,
  size = DEFAULT_LOBBY_PROFILE_SIZE,
  onStyleChange,
  onSizeChange,
  testIdPrefix = "lobby-profile",
}: LobbyProfilePickerProps) {
  return (
    <div className="space-y-3" data-testid={`${testIdPrefix}-picker`}>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Lobby profiles
        </Label>
        <p className="text-[11px] text-muted-foreground leading-snug">
          How people appear on this room’s card on the main page. Premium frames sit around the portrait, not over it.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {STYLES.map((opt) => {
          const selected = style === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onStyleChange(opt.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-all ${
                selected
                  ? "border-primary/80 bg-primary/10 text-foreground"
                  : "border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/25 hover:text-foreground"
              }`}
              data-testid={`${testIdPrefix}-style-${opt.id}`}
              aria-pressed={selected}
            >
              <span
                className="relative block bg-gradient-to-br from-violet-400/80 to-sky-400/70"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: LOBBY_PROFILE_RADIUS[opt.id],
                  boxShadow: selected ? "0 0 0 2px hsl(var(--primary) / 0.55)" : "0 0 0 1px rgba(255,255,255,0.18)",
                }}
              />
              <span className="text-[11px] font-semibold leading-none">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <div className="flex rounded-lg border border-border/40 overflow-hidden">
        {SIZES.map((opt) => {
          const selected = size === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSizeChange(opt.id)}
              className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
                selected ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/30"
              }`}
              data-testid={`${testIdPrefix}-size-${opt.id}`}
              aria-pressed={selected}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
