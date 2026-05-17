import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, ShoppingBag, CheckCircle, XCircle, Clock, Lock, Unlock, GripVertical, ChevronUp, ChevronDown, Send, Eye, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { ROOM_THEMES } from "@/lib/room-theme-utils";
import { useDocumentMeta } from "@/hooks/use-document-meta";

type ThemeOrder = {
  id: string; themeName: string; description: string;
  status: string; adminNote: string | null; createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  approved: "bg-green-500/20 text-green-300 border-green-500/30",
  denied:   "bg-red-500/20 text-red-300 border-red-500/30",
};

const THEME_GRADIENT: Record<string, string> = {
  "premium-atmosphere": "from-cyan-400 via-fuchsia-500 to-teal-400",
  plasma:              "from-purple-600 via-violet-500 to-blue-500",
  neon:                "from-cyan-400 via-sky-500 to-purple-600",
  galaxy:              "from-indigo-900 via-slate-800 to-purple-900",
  sunset:              "from-orange-400 via-rose-400 to-pink-500",
  forest:              "from-green-700 via-emerald-500 to-teal-400",
  cyberpunk:           "from-yellow-400 via-lime-400 to-cyan-400",
  ocean:               "from-blue-800 via-blue-600 to-cyan-400",
  cherry:              "from-pink-300 via-pink-400 to-rose-500",
  aurora:              "from-green-400 via-teal-500 to-purple-600",
  matrix:              "from-green-900 via-green-700 to-green-500",
  storm:               "from-slate-700 via-slate-600 to-blue-700",
  volcanic:            "from-red-700 via-orange-500 to-yellow-500",
  disco:               "from-pink-500 via-yellow-400 to-cyan-400",
  "trap-gold":         "from-yellow-600 via-amber-500 to-yellow-300",
  "skeleton-gangsta":  "from-gray-900 via-slate-700 to-stone-400",
  romance:             "from-rose-900 via-amber-700 to-rose-950",
};

export default function RoomThemesPage() {
  useDocumentMeta({ title: "Room Themes — Vextorn" });
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [reqName, setReqName] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [showRequest, setShowRequest] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "my-themes" | "orders">("browse");

  const { data: availableData, isLoading: loadingAvailable } = useQuery<{ themeIds: string[]; roomThemesEnabled: boolean }>({
    queryKey: ["/api/themes/available"],
    enabled: !!user,
  });

  const { data: prefsData, isLoading: loadingPrefs } = useQuery<{ orderedThemeIds: string[] }>({
    queryKey: ["/api/themes/preferences"],
    enabled: !!user,
  });

  const { data: myOrders = [], isLoading: loadingOrders } = useQuery<ThemeOrder[]>({
    queryKey: ["/api/themes/my-orders"],
    enabled: !!user && activeTab === "orders",
  });

  const { data: orderStats } = useQuery<{ pendingCount: number; last24hCount: number }>({
    queryKey: ["/api/themes/order-stats"],
    enabled: !!user,
  });

  const availableIds = new Set(availableData?.themeIds ?? []);

  const allThemes = useMemo(() => ROOM_THEMES.filter((t) => t.id !== "none"), []);

  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);
  const effectiveOrder = orderedIds ?? prefsData?.orderedThemeIds ?? [];

  const myThemes = useMemo(() => {
    const available = allThemes.filter((t) => availableIds.has(t.id));
    if (effectiveOrder.length === 0) return available;
    const orderMap = new Map(effectiveOrder.map((id, i) => [id, i]));
    return [...available].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? 9999;
      const bi = orderMap.get(b.id) ?? 9999;
      return ai - bi;
    });
  }, [allThemes, availableIds, effectiveOrder]);

  const savePrefs = useMutation({
    mutationFn: async (orderedThemeIds: string[]) =>
      apiRequest("PUT", "/api/themes/preferences", { orderedThemeIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/themes/preferences"] });
      toast({ title: "Theme order saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitOrder = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/themes/order", { themeName: reqName.trim(), description: reqDesc.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/themes/my-orders"] });
      qc.invalidateQueries({ queryKey: ["/api/themes/order-stats"] });
      setReqName("");
      setReqDesc("");
      setShowRequest(false);
      toast({ title: "Theme request submitted!", description: "An admin will review your request." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const moveTheme = (themeId: string, dir: -1 | 1) => {
    const ids = myThemes.map((t) => t.id);
    const idx = ids.indexOf(themeId);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= ids.length) return;
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    setOrderedIds(ids);
  };

  const hasPending = (orderStats?.pendingCount ?? 0) >= 1;
  const hitDailyLimit = (orderStats?.last24hCount ?? 0) >= 3;
  const requestsLeft = Math.max(0, 3 - (orderStats?.last24hCount ?? 0));
  const pendingOrders = myOrders.filter((o) => o.status === "pending").length;
  const roomThemesEnabled = availableData?.roomThemesEnabled ?? true;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-8 h-8 rounded-full bg-muted/40 hover:bg-muted/70 flex items-center justify-center transition-colors"
            data-testid="button-back-lobby"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">Room Themes</h1>
            <p className="text-xs text-muted-foreground">Visual environments inside voice rooms</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRequest((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/25 transition-colors"
              data-testid="button-request-theme"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Request Custom Theme
            </button>
          </div>
        </div>

        {/* Global disabled banner */}
        {!roomThemesEnabled && !loadingAvailable && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/8 px-4 py-3 flex items-start gap-3">
            <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300">Room Themes Disabled</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Room themes have been temporarily disabled by the platform. You can still browse themes, but they cannot be applied to rooms right now.
              </p>
            </div>
          </div>
        )}

        {/* Custom theme request form */}
        {showRequest && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-amber-300">Request a Custom Room Theme</span>
              {requestsLeft > 0 && (
                <span className="ml-auto text-[11px] text-amber-400/70">{requestsLeft} request{requestsLeft !== 1 ? "s" : ""} left today</span>
              )}
            </div>
            {hasPending && (
              <p className="text-xs text-amber-400/80 flex items-center gap-1">
                <Clock className="w-3 h-3" /> You have a pending request — wait for it to be reviewed.
              </p>
            )}
            {hitDailyLimit && !hasPending && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Daily limit reached (3 requests / 24h).
              </p>
            )}
            <div className="grid gap-2">
              <div>
                <Label className="text-xs mb-1 block">Theme name</Label>
                <Input
                  placeholder="e.g. Retro Wave, Jungle Night…"
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  className="text-sm"
                  maxLength={60}
                  disabled={hasPending || hitDailyLimit}
                  data-testid="input-theme-name"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Description &amp; inspiration</Label>
                <Textarea
                  placeholder="Describe the vibe, colors, atmosphere…"
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  className="text-sm min-h-[72px] resize-none"
                  maxLength={400}
                  disabled={hasPending || hitDailyLimit}
                  data-testid="input-theme-description"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setShowRequest(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs h-8 bg-amber-500/20 text-amber-200 border border-amber-500/30 hover:bg-amber-500/30"
                disabled={!reqName.trim() || !reqDesc.trim() || hasPending || hitDailyLimit || submitOrder.isPending}
                onClick={() => submitOrder.mutate()}
                data-testid="button-submit-theme-request"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                {submitOrder.isPending ? "Submitting…" : "Submit Request"}
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 mb-5">
          {([
            { id: "browse", label: "All Themes" },
            { id: "my-themes", label: `My Themes${myThemes.length > 0 ? ` (${myThemes.length})` : ""}` },
            { id: "orders",   label: `My Requests${pendingOrders > 0 ? ` · ${pendingOrders} pending` : ""}` },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              data-testid={`tab-room-themes-${id}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Browse All Themes ── */}
        {activeTab === "browse" && (
          <div>
            <p className="text-xs text-muted-foreground mb-4">
              Themes marked <Lock className="inline w-3 h-3 mx-0.5" /> require admin assignment. Contact an admin to unlock them.
            </p>
            {loadingAvailable ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {allThemes.map((theme) => {
                  const unlocked = availableIds.has(theme.id);
                  const grad = THEME_GRADIENT[theme.id] ?? "from-slate-600 to-slate-800";
                  return (
                    <div
                      key={theme.id}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                        unlocked ? "border-primary/40" : "border-border/20 opacity-70"
                      }`}
                      data-testid={`card-browse-theme-${theme.id}`}
                    >
                      <div
                        className={`h-20 w-full bg-gradient-to-br ${grad} relative`}
                        style={{ backgroundImage: `url(${theme.img})`, backgroundSize: "cover", backgroundPosition: "center" }}
                      >
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="absolute top-1.5 right-1.5">
                          {unlocked ? (
                            <div className="w-5 h-5 rounded-full bg-green-500/80 flex items-center justify-center backdrop-blur-sm">
                              <Unlock className="w-2.5 h-2.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                              <Lock className="w-2.5 h-2.5 text-white/70" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-2 bg-card/95">
                        <p className="text-[11px] font-semibold text-foreground leading-tight">{theme.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{theme.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── My Themes (reorderable) ── */}
        {activeTab === "my-themes" && (
          <div>
            {loadingPrefs || loadingAvailable ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : myThemes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Lock className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No room themes assigned yet</p>
                <p className="text-xs mt-1">Browse all themes — visible ones are globally available to pick when creating a room. Ask an admin to unlock premium ones.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground">Drag to reorder how themes appear when you create a room.</p>
                  {orderedIds !== null && (
                    <Button
                      size="sm"
                      className="text-xs h-7 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
                      disabled={savePrefs.isPending}
                      onClick={() => savePrefs.mutate(orderedIds!)}
                      data-testid="button-save-theme-order"
                    >
                      <Star className="w-3 h-3 mr-1" />
                      {savePrefs.isPending ? "Saving…" : "Save Order"}
                    </Button>
                  )}
                </div>
                {myThemes.map((theme, idx) => {
                  const grad = THEME_GRADIENT[theme.id] ?? "from-slate-600 to-slate-800";
                  return (
                    <div
                      key={theme.id}
                      className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 overflow-hidden"
                      data-testid={`card-my-theme-${theme.id}`}
                    >
                      <div
                        className={`w-16 h-14 shrink-0 bg-gradient-to-br ${grad} relative`}
                        style={{ backgroundImage: `url(${theme.img})`, backgroundSize: "cover", backgroundPosition: "center" }}
                      >
                        <div className="absolute inset-0 bg-black/10" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{theme.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{theme.description}</p>
                      </div>
                      <div className="flex flex-col gap-0.5 pr-3">
                        <button
                          type="button"
                          onClick={() => moveTheme(theme.id, -1)}
                          disabled={idx === 0}
                          className="w-6 h-5 rounded flex items-center justify-center bg-muted/40 hover:bg-muted/70 disabled:opacity-25 transition-colors"
                          data-testid={`button-theme-up-${theme.id}`}
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTheme(theme.id, 1)}
                          disabled={idx === myThemes.length - 1}
                          className="w-6 h-5 rounded flex items-center justify-center bg-muted/40 hover:bg-muted/70 disabled:opacity-25 transition-colors"
                          data-testid={`button-theme-down-${theme.id}`}
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── My Requests ── */}
        {activeTab === "orders" && (
          <div>
            {loadingOrders ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : myOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No requests yet</p>
                <p className="text-xs mt-1">Use "Request Custom Theme" to ask for a new room visual environment.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-border/40 bg-card/60 p-4"
                    data-testid={`card-my-order-${order.id}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-sm font-bold text-foreground">"{order.themeName}"</p>
                      <Badge className={`text-[10px] px-2 py-0.5 shrink-0 ${STATUS_COLORS[order.status] ?? ""}`}>
                        {order.status === "pending" && <Clock className="w-2.5 h-2.5 mr-1" />}
                        {order.status === "approved" && <CheckCircle className="w-2.5 h-2.5 mr-1" />}
                        {order.status === "denied" && <XCircle className="w-2.5 h-2.5 mr-1" />}
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{order.description}</p>
                    {order.adminNote && (
                      <p className="text-[11px] text-muted-foreground/70 mt-2 italic border-t border-border/30 pt-2">
                        Admin: {order.adminNote}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50 mt-2">
                      {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
