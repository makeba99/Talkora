import { useState } from "react";
import { Coffee, Crown, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VIP_PLANS, vipRank } from "@shared/constants";
import { useQuery } from "@tanstack/react-query";
import { isAdminUser, isVipUser } from "@/lib/vip";

type VipConfig = {
  configured: boolean;
  showSupport: boolean;
  variant: "paypal-vip" | "hidden";
  navLabel: string;
  country?: string | null;
  plans: Array<{ id: string; amount: number; label: string; tagline: string }>;
};

export function VipSupportButton({ guest = false }: { guest?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState<number | null>(null);
  const { data: config } = useQuery<VipConfig>({
    queryKey: ["/api/vip/config"],
    queryFn: async () => {
      const res = await fetch("/api/vip/config", { credentials: "include" });
      return res.json();
    },
    staleTime: 60_000,
  });

  const admin = isAdminUser(user);
  const show = config?.showSupport !== false || admin;
  if (config && !show) return null;

  const currentRank = vipRank(user?.vipTier);
  const isVip = isVipUser(user);
  const navLabel = config?.navLabel || "Buy Me a Coffee";
  const triggerClass = guest
    ? "neu-btn inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold"
    : "header-pro-btn inline-flex items-center h-9 px-3.5 rounded-full text-[12px] font-semibold";

  const startCheckout = async (amount: number) => {
    if (!user) {
      window.location.href = "/api/login";
      return;
    }
    setPaying(amount);
    try {
      const res = await fetch("/api/vip/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "PayPal checkout failed");
      window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Could not open PayPal", description: err?.message, variant: "destructive" });
      setPaying(null);
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[420px] border-amber-500/20 bg-[#14101f]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Crown className="w-5 h-5 text-amber-400" />
              Buy Me a Coffee
            </DialogTitle>
            <DialogDescription>
              Support Vextorn and unlock VIP. Payment is via PayPal (Buy Me a Coffee is unavailable in some regions).
            </DialogDescription>
          </DialogHeader>

          {isVip && (
            <p className="text-xs text-amber-300/90 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2" data-testid="text-vip-status">
              VIP status: {user?.vipTier === "elite" ? "VIP Elite" : user?.vipTier === "plus" ? "VIP Plus" : user?.vipTier === "coffee" ? "VIP Coffee" : "Active"}
              {currentRank > 0 ? " — pick a higher tier to upgrade." : ""}
            </p>
          )}

          <div className="grid gap-2">
            {(config?.plans?.length ? config.plans : VIP_PLANS).map((plan) => (
              <button
                key={plan.id}
                type="button"
                disabled={paying !== null}
                onClick={() => startCheckout(plan.amount)}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:border-amber-400/50 hover:bg-amber-500/10 transition-colors disabled:opacity-60"
                data-testid={`button-vip-plan-${plan.id}`}
              >
                <div>
                  <p className="text-sm font-bold text-white">${plan.amount} · {plan.label}</p>
                  <p className="text-[11px] text-white/55 mt-0.5">{plan.tagline}</p>
                </div>
                {paying === plan.amount ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                ) : (
                  <span className="text-[11px] font-semibold text-amber-300">PayPal</span>
                )}
              </button>
            ))}
          </div>

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
