import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { Check, Zap, Star, Crown, ArrowLeft, CreditCard, Smartphone, Building2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PLANS = [
  {
    id: "free",
    name: "Free",
    icon: Globe,
    iconColor: "text-cyan-400",
    monthlyPrice: 0,
    yearlyPrice: 0,
    badge: null,
    description: "Everything you need to start practicing languages",
    features: [
      "Join unlimited public voice rooms",
      "In-room text chat & emoji reactions",
      "3 AI Tutor sessions per month",
      "Basic profile & avatar",
      "Follow & message community members",
      "Access to all language rooms",
      "Browser-based — no install needed",
    ],
    cta: "Get Started Free",
    ctaVariant: "outline" as const,
    highlight: false,
  },
  {
    id: "premium",
    name: "Premium",
    icon: Zap,
    iconColor: "text-amber-400",
    monthlyPrice: 9.99,
    yearlyPrice: 7.99,
    badge: "Most Popular",
    description: "Accelerate your language learning with priority access",
    features: [
      "Everything in Free",
      "Unlimited AI Tutor sessions",
      "Priority teacher matching",
      "HD voice quality & screen share",
      "Profile decoration badges",
      "Advanced analytics on your progress",
      "Early access to new features",
      "Ad-free experience",
    ],
    cta: "Start Premium",
    ctaVariant: "default" as const,
    highlight: true,
  },
  {
    id: "pro",
    name: "Teacher Pro",
    icon: Crown,
    iconColor: "text-violet-400",
    monthlyPrice: 19.99,
    yearlyPrice: 15.99,
    badge: "Best for Teachers",
    description: "Teach on the platform and earn from your expertise",
    features: [
      "Everything in Premium",
      "Create your teacher profile",
      "Accept bookings & earn revenue",
      "85% revenue share on sessions",
      "Group class hosting (up to 20)",
      "Integrated session room creation",
      "Teacher analytics dashboard",
      "Priority support & onboarding",
    ],
    cta: "Apply as Teacher",
    ctaVariant: "default" as const,
    highlight: false,
  },
];

const PAYMENT_METHODS = [
  {
    id: "card",
    name: "Credit / Debit Card",
    icon: CreditCard,
    desc: "Visa, Mastercard, ArCa — all major cards accepted",
    popular: true,
  },
  {
    id: "idram",
    name: "Idram",
    icon: Smartphone,
    desc: "Armenia's most popular digital wallet",
    popular: true,
  },
  {
    id: "cash",
    name: "Bank Transfer",
    icon: Building2,
    desc: "AMD bank transfer — admin confirms within 24h",
    popular: false,
  },
];

export default function PricingPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  useDocumentMeta({
    title: "Pricing — Vextorn",
    description: "Choose the plan that fits your language learning goals. Free forever or unlock premium features.",
  });

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, hsl(228 16% 8%) 0%, hsl(260 14% 10%) 50%, hsl(228 16% 8%) 100%)" }}>
      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-white/45 hover:text-white/80 transition-colors"
          data-testid="button-pricing-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to lobby
        </button>
      </div>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5 text-xs font-semibold"
          style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "hsl(38 95% 72%)" }}>
          <Star className="w-3 h-3" />
          Designed for the Armenian market
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
          Simple, transparent<br />
          <span style={{ background: "linear-gradient(90deg, hsl(38 95% 72%), hsl(260 80% 75%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            pricing
          </span>
        </h1>
        <p className="text-white/55 text-lg max-w-xl mx-auto mb-8">
          Start free. Upgrade when you're ready. Cancel anytime — no long-term commitments.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 rounded-full p-1"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={() => setBilling("monthly")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${billing === "monthly" ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70"}`}
            data-testid="button-billing-monthly"
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${billing === "yearly" ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70"}`}
            data-testid="button-billing-yearly"
          >
            Yearly
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
            return (
              <div
                key={plan.id}
                data-testid={`card-plan-${plan.id}`}
                className="relative flex flex-col rounded-2xl overflow-hidden"
                style={{
                  background: plan.highlight
                    ? "linear-gradient(155deg, hsl(228 18% 13%) 0%, hsl(228 20% 10%) 100%)"
                    : "linear-gradient(155deg, hsl(228 16% 11%) 0%, hsl(228 18% 9%) 100%)",
                  border: plan.highlight
                    ? "1px solid rgba(251,191,36,0.35)"
                    : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: plan.highlight
                    ? "0 0 40px rgba(251,191,36,0.08), inset 0 1px 0 rgba(251,191,36,0.15)"
                    : "none",
                }}
              >
                {plan.highlight && (
                  <div className="h-[2px] w-full"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.9), transparent)" }} />
                )}
                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        background: plan.highlight ? "rgba(251,191,36,0.2)" : "rgba(139,92,246,0.2)",
                        color: plan.highlight ? "hsl(38 95% 72%)" : "hsl(260 80% 75%)",
                        border: `1px solid ${plan.highlight ? "rgba(251,191,36,0.4)" : "rgba(139,92,246,0.4)"}`,
                      }}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="p-7 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <Icon className={`w-5 h-5 ${plan.iconColor}`} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                    </div>
                  </div>

                  <div className="mb-2">
                    {price === 0 ? (
                      <div className="text-4xl font-extrabold text-white">Free</div>
                    ) : (
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-extrabold text-white">${price.toFixed(2)}</span>
                        <span className="text-white/45 text-sm mb-1.5">/month</span>
                      </div>
                    )}
                    {billing === "yearly" && price > 0 && (
                      <p className="text-xs text-green-400 mt-0.5">Billed ${(price * 12).toFixed(2)}/year</p>
                    )}
                  </div>
                  <p className="text-sm text-white/50 mb-6">{plan.description}</p>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                        <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    data-testid={`button-plan-cta-${plan.id}`}
                    onClick={() => {
                      if (!user) { navigate("/"); return; }
                      if (plan.id === "free") { navigate("/"); return; }
                      if (plan.id === "pro") { navigate("/teachers"); return; }
                      navigate("/payment-methods");
                    }}
                    className="w-full h-11 rounded-xl font-semibold text-sm transition-all"
                    style={plan.highlight ? {
                      background: "linear-gradient(135deg, hsl(38 95% 62%) 0%, hsl(38 85% 52%) 100%)",
                      color: "#1a1000",
                      boxShadow: "0 4px 20px rgba(251,191,36,0.35)",
                    } : {
                      background: "rgba(255,255,255,0.07)",
                      color: "rgba(255,255,255,0.8)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment methods section */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-2xl p-8"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="text-xl font-bold text-white mb-2 text-center">Payment methods accepted</h2>
          <p className="text-white/45 text-sm text-center mb-8">
            We support the most popular payment options in Armenia and internationally.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PAYMENT_METHODS.map((pm) => {
              const PMIcon = pm.icon;
              return (
                <div key={pm.id}
                  className="flex items-start gap-3 rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  data-testid={`card-payment-method-${pm.id}`}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.07)" }}>
                    <PMIcon className="w-4.5 h-4.5 text-cyan-400" style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{pm.name}</p>
                      {pm.popular && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/45 mt-0.5">{pm.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-xl p-4 flex items-start gap-3"
            style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <div className="w-1.5 h-full min-h-[16px] rounded-full bg-amber-400/60 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300 mb-0.5">Armenia Market Note</p>
              <p className="text-xs text-white/50">
                We accept Idram (Armenia's leading e-wallet) and AMD bank transfers as primary payment methods,
                alongside international cards. Teacher payouts are processed via bank transfer or Idram within 3–5 business days.
                Platform retains a 15% service fee; teachers receive 85% of session revenue.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ section */}
      <div className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently asked questions</h2>
        <div className="space-y-4">
          {[
            {
              q: "Can I switch plans anytime?",
              a: "Yes. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades take effect at the end of your billing cycle.",
            },
            {
              q: "How does Idram payment work?",
              a: "When you choose Idram, you'll receive a unique order ID. Transfer the amount to our Idram account with this ID as a reference. Your subscription activates within a few hours after confirmation.",
            },
            {
              q: "How do teachers get paid?",
              a: "Teachers receive 85% of each session fee. Payouts are processed via Idram or bank transfer within 3–5 business days after session completion.",
            },
            {
              q: "Is there a free trial for Premium?",
              a: "The Free plan gives you full access to core features. We don't currently offer a timed Premium trial, but you can cancel a paid plan at any time with no penalty.",
            },
            {
              q: "What happens to my data if I cancel?",
              a: "Your profile, messages, and history remain intact. You simply lose access to premium-only features.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="font-semibold text-white text-sm mb-1.5">{q}</p>
              <p className="text-sm text-white/50">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
