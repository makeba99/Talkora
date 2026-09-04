import { Label } from "@/components/ui/label";
import {
  DEFAULT_LOBBY_PROFILE_STYLE,
  type LobbyProfileStyle,
} from "@shared/constants";
import { LOBBY_PROFILE_RADIUS } from "@/lib/lobby-profile";

const STYLES: { id: LobbyProfileStyle; label: string }[] = [
  { id: "tile", label: "Square" },
  { id: "circle", label: "Round" },
];

interface LobbyProfilePickerProps {
  style: LobbyProfileStyle;
  onStyleChange: (style: LobbyProfileStyle) => void;
  testIdPrefix?: string;
}

export function LobbyProfilePicker({
  style = DEFAULT_LOBBY_PROFILE_STYLE,
  onStyleChange,
  testIdPrefix = "lobby-profile",
}: LobbyProfilePickerProps) {
  return (
    <div className="space-y-3" data-testid={`${testIdPrefix}-picker`}>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Profiles on lobby card
        </Label>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Square or round on this room’s home-page card. Inside the room, profiles stay square.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
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
    </div>
  );
}
