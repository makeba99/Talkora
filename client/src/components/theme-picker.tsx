import { useState } from "react";
import { Palette, Check, Sparkles, ShoppingBag, ChevronDown, ChevronUp, Loader2, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme, THEMES, type Theme } from "@/lib/theme";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

type ThemeOrder = {
  id: string;
  themeName: string;
  description: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

export function ThemePicker({ open: controlledOpen, onOpenChange, hideTrigger }: ThemePickerProps = {}) {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [hovered, setHovered] = useState<Theme | null>(null);
  const [category, setCategory] = useState<string>("All");
  const [showRequest, setShowRequest] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [showMyOrders, setShowMyOrders] = useState(false);

  const previewTheme = hovered ?? theme;
  const previewDef = THEMES.find((t) => t.id === previewTheme) ?? THEMES[0];
  const activeDef  = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  const cat = CATEGORIES.find((c) => c.label === category);
  const visibleThemes = cat?.ids
    ? THEMES.filter((t) => cat.ids!.includes(t.id))
    : THEMES;

  const { data: myOrders = [] } = useQuery<ThemeOrder[]>({
    queryKey: ["/api/themes/my-orders"],
    enabled: open && showMyOrders,
  });

  const submitOrder = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/themes/order", { themeName: reqName.trim(), description: reqDesc.trim() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/themes/my-orders"] });
      toast({ title: "Theme request sent!", description: "The admin will review your request." });
      setReqName("");
      setReqDesc("");
      setShowRequest(false);
      setShowMyOrders(true);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle className="w-3 h-3 text-green-400" />;
    if (status === "denied") return <XCircle className="w-3 h-3 text-red-400" />;
    return <Clock className="w-3 h-3 text-amber-400" />;
  };

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
            aria-label="Choose theme"
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
        <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-0.5">
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

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
              = animated background
            </p>
            <p className="text-[10px] text-muted-foreground">Saved automatically</p>
          </div>

          {/* Request a Theme section */}
          <div className="border-t border-border/50 pt-2">
            <button
              onClick={() => { setShowRequest((v) => !v); setShowMyOrders(false); }}
              className="w-full flex items-center gap-2 text-left py-1 px-1 rounded hover:bg-muted/40 transition-colors"
              data-testid="button-request-theme-toggle"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[11px] font-medium text-foreground flex-1">Request a Theme</span>
              {showRequest ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
            </button>

            {showRequest && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Theme name (e.g. Midnight Rose)"
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  maxLength={100}
                  className="w-full text-xs bg-muted/40 border border-border rounded px-2.5 py-1.5 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                  data-testid="input-theme-request-name"
                />
                <textarea
                  placeholder="Describe the vibe, colors, style you'd like... (min 10 chars)"
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="w-full text-xs bg-muted/40 border border-border rounded px-2.5 py-1.5 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  data-testid="input-theme-request-desc"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowRequest(false)}
                    className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => submitOrder.mutate()}
                    disabled={submitOrder.isPending || reqName.trim().length < 2 || reqDesc.trim().length < 10}
                    className="flex items-center gap-1 text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 rounded transition-colors"
                    data-testid="button-submit-theme-request"
                  >
                    {submitOrder.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ShoppingBag className="w-2.5 h-2.5" />}
                    Send Request
                  </button>
                </div>
              </div>
            )}

            {/* My orders toggle */}
            <button
              onClick={() => { setShowMyOrders((v) => !v); setShowRequest(false); }}
              className="w-full flex items-center gap-2 text-left py-1 px-1 rounded hover:bg-muted/40 transition-colors mt-1"
              data-testid="button-my-orders-toggle"
            >
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground flex-1">My requests</span>
              {showMyOrders ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
            </button>

            {showMyOrders && (
              <div className="mt-1 space-y-1.5 max-h-40 overflow-y-auto">
                {myOrders.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-3">No requests yet.</p>
                ) : myOrders.map((order) => (
                  <div key={order.id} className="rounded border border-border/40 bg-muted/20 p-2">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(order.status)}
                      <span className="text-[11px] font-medium truncate flex-1">{order.themeName}</span>
                      <span className={`text-[9px] capitalize font-medium ${
                        order.status === "approved" ? "text-green-400" :
                        order.status === "denied" ? "text-red-400" : "text-amber-400"
                      }`}>{order.status}</span>
                    </div>
                    {order.adminNote && (
                      <p className="text-[10px] text-muted-foreground mt-1 italic">"{order.adminNote}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
