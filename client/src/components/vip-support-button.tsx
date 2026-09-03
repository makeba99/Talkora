import { useEffect, useMemo, useRef, useState } from "react";
import { Coffee, Crown, Loader2, Lock, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VIP_PLANS, vipRank } from "@shared/constants";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isAdminUser, isVipUser } from "@/lib/vip";
import { canUseFeature } from "@shared/entitlements";
import type { Follow, User } from "@shared/schema";

type VipConfig = {
  configured: boolean;
  showSupport: boolean;
  variant: "paypal-vip" | "hidden";
  navLabel: string;
  country?: string | null;
  plans: Array<{ id: string; amount: number; label: string; tagline: string }>;
};

function openPaypalPopup(): Window | null {
  const w = 480;
  const h = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  // Open synchronously on the click path so popup blockers allow it.
  return window.open(
    "about:blank",
    "vextorn-paypal",
    `popup=yes,width=${w},height=${h},left=${left},top=${top},noopener=no,noreferrer=no`,
  );
}

function displayNameOf(u: User): string {
  return u.displayName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "User";
}

export function VipSupportButton({ guest = false }: { guest?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState<number | null>(null);
  const [awaitingPaypal, setAwaitingPaypal] = useState(false);
  const [shoutMessage, setShoutMessage] = useState("");
  const [mentionUserId, setMentionUserId] = useState("");
  const [sendingShout, setSendingShout] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const { data: config } = useQuery<VipConfig>({
    queryKey: ["/api/vip/config"],
    queryFn: async () => {
      const res = await fetch("/api/vip/config", { credentials: "include" });
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: following = [] } = useQuery<Follow[]>({
    queryKey: ["/api/follows/following", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await apiRequest("GET", `/api/follows/following/${user.id}`);
      return res.json();
    },
    enabled: !!user?.id && open,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user?.id && open,
    staleTime: 60_000,
  });

  const followingPeople = useMemo(() => {
    const ids = new Set(following.map((f) => f.followingId));
    return allUsers
      .filter((u) => ids.has(u.id) && u.id !== user?.id)
      .sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b)));
  }, [allUsers, following, user?.id]);

  const finishPaypalFlow = (status: "thanks" | "cancel" | "closed") => {
    try { popupRef.current?.close(); } catch { /* ignore */ }
    popupRef.current = null;
    setPaying(null);
    setAwaitingPaypal(false);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    if (status === "thanks") {
      toast({
        title: "Payment submitted",
        description: "VIP unlocks after PayPal confirms (usually within a minute). Your coffee message will appear in live rooms for people online now.",
      });
      setOpen(true);
    } else if (status === "cancel") {
      toast({ title: "Payment canceled", description: "No charge was made. You can try again anytime." });
    }
  };
  const finishRef = useRef(finishPaypalFlow);
  finishRef.current = finishPaypalFlow;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "vextorn-vip-paypal") return;
      const status = data.status === "cancel" ? "cancel" : "thanks";
      finishRef.current(status);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // If the user closes the PayPal popup manually, clear the waiting state.
  useEffect(() => {
    if (!awaitingPaypal) return;
    const timer = window.setInterval(() => {
      const popup = popupRef.current;
      if (popup && popup.closed) {
        finishRef.current("closed");
      }
    }, 700);
    return () => window.clearInterval(timer);
  }, [awaitingPaypal]);

  const admin = isAdminUser(user);
  const show = config?.showSupport !== false || admin;
  if (config && !show) return null;

  const currentRank = vipRank(user?.vipTier);
  const isVip = isVipUser(user);
  const canShout = canUseFeature(user, "vip_shoutout");
  const navLabel = config?.navLabel || "Buy Me a Coffee";
  const triggerClass = guest
    ? "neu-btn inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold"
    : "header-pro-btn inline-flex items-center h-9 px-3.5 rounded-full text-[12px] font-semibold";

  const startCheckout = async (amount: number) => {
    if (!user) {
      window.location.href = "/api/login";
      return;
    }

    // Must open on the same tick as the click (before await) or blockers win.
    const popup = openPaypalPopup();
    if (!popup) {
      toast({
        title: "Popup blocked",
        description: "Allow popups for Vextorn, then try again. PayPal opens in a small window so this page stays open.",
        variant: "destructive",
      });
      return;
    }
    popupRef.current = popup;
    try {
      popup.document.write(
        `<!DOCTYPE html><title>Opening PayPal…</title><body style="margin:0;background:#0f0b18;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh">Opening PayPal…</body>`,
      );
    } catch { /* cross-origin / closed */ }

    setPaying(amount);
    setAwaitingPaypal(true);
    try {
      const res = await fetch("/api/vip/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          shoutMessage: shoutMessage.trim() || undefined,
          mentionUserId: mentionUserId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "PayPal checkout failed");
      if (!data.url) throw new Error("PayPal URL missing");

      try {
        popup.location.href = data.url;
      } catch {
        // If we can't navigate the existing popup, open the URL as a fallback.
        window.open(data.url, "vextorn-paypal");
      }
    } catch (err: any) {
      try { popup.close(); } catch { /* ignore */ }
      popupRef.current = null;
      setAwaitingPaypal(false);
      setPaying(null);
      toast({ title: "Could not open PayPal", description: err?.message, variant: "destructive" });
    }
  };

  const sendShoutout = async () => {
    if (!canShout) {
      toast({ title: "VIP only", description: "Buy Me a Coffee to shout out people you follow across all live rooms." });
      return;
    }
    if (!mentionUserId) {
      toast({ title: "Pick someone", description: "Choose a person you follow to mention.", variant: "destructive" });
      return;
    }
    if (shoutMessage.trim().length < 2) {
      toast({ title: "Write a message", description: "Say something nice (at least 2 characters).", variant: "destructive" });
      return;
    }
    setSendingShout(true);
    try {
      const res = await apiRequest("POST", "/api/vip/shoutout", {
        mentionUserId,
        message: shoutMessage.trim(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Shoutout failed");
      toast({
        title: "Shoutout sent!",
        description: `Your message appeared in rooms that are live right now.${typeof data.remainingToday === "number" ? ` ${data.remainingToday} left today.` : ""}`,
      });
      setShoutMessage("");
      setMentionUserId("");
    } catch (err: any) {
      toast({ title: "Could not send shoutout", description: err?.message, variant: "destructive" });
    } finally {
      setSendingShout(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        data-testid={guest ? "button-buy-me-coffee-nav-guest" : "button-buy-me-coffee-nav"}
        title="Buy Me a Coffee — become VIP"
        aria-label={navLabel}
        onClick={() => setOpen(true)}
      >
        <Coffee className={`${guest ? "w-3.5 h-3.5 mr-1.5" : "w-4 h-4 sm:mr-1.5"} text-neu-orange`} />
        <span className="hidden sm:inline">{navLabel}</span>
        {isVip && (
          <Crown className="w-3.5 h-3.5 ml-1 text-amber-300 hidden sm:inline" aria-label="VIP active" />
        )}
      </button>

      <Dialog open={open} onOpenChange={(next) => {
        if (!next && awaitingPaypal) {
          // Keep dialog usable while PayPal popup is open — user can dismiss UI.
          setOpen(false);
          return;
        }
        setOpen(next);
      }}>
        <DialogContent className="max-w-[420px] border-amber-500/20 bg-[#14101f] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Crown className="w-5 h-5 text-amber-400" />
              Buy Me a Coffee
            </DialogTitle>
            <DialogDescription>
              Support Vextorn and unlock VIP. PayPal opens in a small popup — this page stays open.
            </DialogDescription>
          </DialogHeader>

          {isVip && (
            <p className="text-xs text-amber-300/90 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2" data-testid="text-vip-status">
              VIP status: {user?.vipTier === "elite" ? "VIP Elite" : user?.vipTier === "plus" ? "VIP Plus" : user?.vipTier === "coffee" ? "VIP Coffee" : "Active"}
              {currentRank > 0 ? " — pick a higher tier to upgrade." : ""}
            </p>
          )}

          {awaitingPaypal && (
            <p
              className="text-xs text-sky-200/90 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 flex items-start gap-2"
              data-testid="text-paypal-waiting"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin mt-0.5 flex-shrink-0" />
              Waiting for PayPal… Finish in the popup, then VIP unlocks when payment confirms.
            </p>
          )}

          {!!user && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-2.5" data-testid="vip-checkout-shoutout-panel">
              <div>
                <p className="text-sm font-semibold text-amber-100 flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5" />
                  Message for live rooms
                </p>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Optional — like an admin announcement. After you buy coffee, this appears once in rooms that are live right now (for currently online users).
                </p>
              </div>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-white/45 font-semibold">Mention (someone you follow)</span>
                <select
                  value={mentionUserId}
                  onChange={(e) => setMentionUserId(e.target.value)}
                  className="w-full h-9 rounded-md border border-white/10 bg-[#0f0b18] px-2 text-sm text-white"
                  data-testid="select-checkout-shoutout-mention"
                >
                  <option value="">
                    {followingPeople.length === 0 ? "Follow someone first (optional)…" : "Choose who to shout out…"}
                  </option>
                  {followingPeople.map((p) => (
                    <option key={p.id} value={p.id}>{displayNameOf(p)}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-white/45 font-semibold">Message</span>
                <textarea
                  value={shoutMessage}
                  onChange={(e) => setShoutMessage(e.target.value.slice(0, 160))}
                  rows={3}
                  maxLength={160}
                  placeholder="Thanks for the great conversations…"
                  className="w-full rounded-md border border-white/10 bg-[#0f0b18] px-2.5 py-2 text-sm text-white placeholder:text-white/30 resize-none"
                  data-testid="input-checkout-shoutout-message"
                />
                <span className="text-[10px] text-white/35">{shoutMessage.length}/160</span>
              </label>
            </div>
          )}

          <div className="space-y-2">
            {VIP_PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                disabled={paying !== null}
                onClick={() => startCheckout(plan.amount)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-3 text-left transition-colors disabled:opacity-60"
                data-testid={`button-vip-plan-${plan.id}`}
              >
                <div>
                  <div className="text-sm font-semibold text-white">{plan.label}</div>
                  <div className="text-[11px] text-white/55">{plan.tagline}</div>
                </div>
                {paying === plan.amount ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                ) : (
                  <span className="text-[11px] font-semibold text-amber-300">PayPal</span>
                )}
              </button>
            ))}
          </div>

          {canShout && (
            <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-2.5" data-testid="vip-shoutout-panel">
              <div>
                <p className="text-sm font-semibold text-amber-100 flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5" />
                  Extra shoutout
                </p>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Already VIP? Send another shoutout to rooms that are live right now.
                </p>
              </div>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-white/45 font-semibold">Mention</span>
                <select
                  value={mentionUserId}
                  onChange={(e) => setMentionUserId(e.target.value)}
                  className="w-full h-9 rounded-md border border-white/10 bg-[#0f0b18] px-2 text-sm text-white"
                  data-testid="select-shoutout-mention"
                >
                  <option value="">
                    {followingPeople.length === 0 ? "Follow someone first…" : "Choose who to shout out…"}
                  </option>
                  {followingPeople.map((p) => (
                    <option key={p.id} value={p.id}>{displayNameOf(p)}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-white/45 font-semibold">Message</span>
                <textarea
                  value={shoutMessage}
                  onChange={(e) => setShoutMessage(e.target.value.slice(0, 160))}
                  rows={3}
                  maxLength={160}
                  placeholder="Thanks for the great conversations…"
                  className="w-full rounded-md border border-white/10 bg-[#0f0b18] px-2.5 py-2 text-sm text-white placeholder:text-white/30 resize-none"
                  data-testid="input-shoutout-message"
                />
                <span className="text-[10px] text-white/35">{shoutMessage.length}/160</span>
              </label>
              <button
                type="button"
                disabled={sendingShout || !mentionUserId || shoutMessage.trim().length < 2}
                onClick={sendShoutout}
                className="w-full h-9 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-[#1a1208] text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                data-testid="button-send-shoutout"
              >
                {sendingShout ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send to live rooms now
              </button>
            </div>
          )}

          {!user && (
            <p className="text-[11px] text-white/50 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Sign in first so VIP can be added to your account after payment.
            </p>
          )}
          {config && !config.configured && (
            <p className="text-[11px] text-amber-200/90">
              PayPal Merchant ID is not set yet. Admins: set PAYPAL_MERCHANT_ID on Railway or save it under Admin → Payments.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
