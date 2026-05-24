import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { PaymentMethod } from "@shared/schema";
import { PaymentMethodForm, SavedCardItem, type CardFormData } from "@/components/payment-method-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Plus, ShieldCheck } from "lucide-react";

export default function PaymentMethodsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data: methods = [], isLoading, refetch } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (data: CardFormData) => {
      const res = await apiRequest("POST", "/api/payment-methods", data);
      return res.json();
    },
    onSuccess: (pm: PaymentMethod) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setShowForm(false);
      toast({ title: "Card added!", description: `${pm.cardholderName}'s card ending in ${pm.last4} saved.` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add card", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/payment-methods/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({ title: "Card removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove card", description: err.message, variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/payment-methods/${id}/default`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({ title: "Default payment method updated" });
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080b14" }}>
        <p className="text-white/50 text-sm">Please sign in to manage payment methods.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#080b14" }}>
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate("/teachers")}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white/80 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            data-testid="button-back-to-teachers"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-[18px] font-semibold text-white">Payment Methods</h1>
            <p className="text-[12px] text-white/40">Manage your saved payment cards</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {isLoading ? (
            [0, 1].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl animate-pulse"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            ))
          ) : methods.length === 0 && !showForm ? (
            <div
              className="text-center py-12 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)" }}
            >
              <CreditCard className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-[13px] text-white/40 mb-1">No payment methods yet</p>
              <p className="text-[11px] text-white/25">Add a card to speed up booking</p>
            </div>
          ) : (
            methods.map((pm) => (
              <SavedCardItem
                key={pm.id}
                {...pm}
                showActions
                onSetDefault={() => setDefaultMutation.mutate(pm.id)}
                onDelete={() => deleteMutation.mutate(pm.id)}
              />
            ))
          )}
        </div>

        {showForm ? (
          <div
            className="rounded-xl p-5"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <h2 className="text-[14px] font-semibold text-white/80 mb-4">Add New Card</h2>
            <PaymentMethodForm
              onSubmit={(data) => addMutation.mutate(data)}
              onCancel={() => setShowForm(false)}
              isPending={addMutation.isPending}
            />
          </div>
        ) : (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full h-10 gap-2"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px dashed rgba(0,200,255,0.3)",
              color: "rgba(0,200,255,0.75)",
            }}
            data-testid="button-add-payment-method"
          >
            <Plus className="w-4 h-4" />
            Add Payment Method
          </Button>
        )}

        <div
          className="flex items-start gap-2.5 mt-6 px-4 py-3 rounded-xl"
          style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.12)" }}
        >
          <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/35 leading-relaxed">
            Your payment information is encrypted and secure. We never store full card numbers — only the last 4 digits and card type are saved to identify your card.
          </p>
        </div>
      </div>
    </div>
  );
}
