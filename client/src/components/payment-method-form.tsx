import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, CreditCard, CheckCircle2 } from "lucide-react";

type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

function detectBrand(number: string): CardBrand {
  const n = number.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(6011|65|64[4-9])/.test(n)) return "discover";
  return "unknown";
}

function BrandLogo({ brand }: { brand: CardBrand }) {
  if (brand === "visa") return (
    <svg viewBox="0 0 48 16" className="h-5 w-auto" fill="none">
      <text x="0" y="13" fontFamily="Arial" fontWeight="bold" fontSize="14" fill="#1A1F71">VISA</text>
    </svg>
  );
  if (brand === "mastercard") return (
    <svg viewBox="0 0 38 24" className="h-5 w-auto">
      <circle cx="14" cy="12" r="12" fill="#EB001B" />
      <circle cx="24" cy="12" r="12" fill="#F79E1B" />
      <path d="M19 5.4A12 12 0 0 1 23.6 12 12 12 0 0 1 19 18.6 12 12 0 0 1 14.4 12 12 12 0 0 1 19 5.4z" fill="#FF5F00" />
    </svg>
  );
  if (brand === "amex") return (
    <svg viewBox="0 0 48 16" className="h-5 w-auto">
      <text x="0" y="13" fontFamily="Arial" fontWeight="bold" fontSize="11" fill="#2E77BC">AMEX</text>
    </svg>
  );
  if (brand === "discover") return (
    <svg viewBox="0 0 60 16" className="h-5 w-auto">
      <text x="0" y="13" fontFamily="Arial" fontWeight="bold" fontSize="11" fill="#E65C1B">DISCOVER</text>
    </svg>
  );
  return <CreditCard className="w-5 h-5 text-white/30" />;
}

function formatCardNumber(value: string, brand: CardBrand): string {
  const digits = value.replace(/\D/g, "");
  if (brand === "amex") {
    const parts = [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean);
    return parts.join(" ");
  }
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) parts.push(digits.slice(i, i + 4));
  return parts.join(" ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2, 4);
  if (digits.length === 2) return digits + "/";
  return digits;
}

function validateExpiry(expiry: string): string | null {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return "Enter expiry as MM/YY";
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10) + 2000;
  if (month < 1 || month > 12) return "Month must be 01–12";
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    return "Card has expired";
  }
  return null;
}

export interface CardFormData {
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  cardholderName: string;
}

interface Props {
  onSubmit: (data: CardFormData) => void;
  onCancel?: () => void;
  isPending?: boolean;
  submitLabel?: string;
}

export function PaymentMethodForm({ onSubmit, onCancel, isPending, submitLabel = "Save Card" }: Props) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const brand = detectBrand(cardNumber);
  const maxCardLen = brand === "amex" ? 17 : 19;
  const cvvLen = brand === "amex" ? 4 : 3;

  function validate() {
    const errs: Record<string, string> = {};
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < (brand === "amex" ? 15 : 16)) errs.cardNumber = "Enter a valid card number";
    const expiryErr = validateExpiry(expiry);
    if (expiryErr) errs.expiry = expiryErr;
    if (cvv.length < cvvLen) errs.cvv = `CVV must be ${cvvLen} digits`;
    if (!name.trim()) errs.name = "Cardholder name is required";
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const allTouched: Record<string, boolean> = { cardNumber: true, expiry: true, cvv: true, name: true };
    setTouched(allTouched);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const digits = cardNumber.replace(/\s/g, "");
    const [mm, yy] = expiry.split("/");
    onSubmit({
      last4: digits.slice(-4),
      brand,
      expMonth: parseInt(mm, 10),
      expYear: parseInt(yy, 10),
      cardholderName: name.trim(),
    });
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.92)",
  };

  const errorInputStyle: React.CSSProperties = {
    background: "rgba(239,68,68,0.06)",
    border: "1px solid rgba(239,68,68,0.40)",
    color: "rgba(255,255,255,0.92)",
  };

  function field(key: string) {
    return touched[key] && errors[key] ? errorInputStyle : inputStyle;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[12px] text-white/60">Card Number</Label>
        <div className="relative">
          <Input
            value={cardNumber}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "").slice(0, brand === "amex" ? 15 : 16);
              setCardNumber(formatCardNumber(raw, detectBrand(raw)));
              setErrors((p) => ({ ...p, cardNumber: "" }));
            }}
            onBlur={() => setTouched((p) => ({ ...p, cardNumber: true }))}
            placeholder="1234 5678 9012 3456"
            maxLength={maxCardLen}
            inputMode="numeric"
            autoComplete="cc-number"
            className="h-10 text-sm pr-12 font-mono tracking-wider"
            style={field("cardNumber")}
            data-testid="input-card-number"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <BrandLogo brand={brand} />
          </div>
        </div>
        {touched.cardNumber && errors.cardNumber && (
          <p className="text-[11px] text-red-400" data-testid="error-card-number">{errors.cardNumber}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[12px] text-white/60">Expiry</Label>
          <Input
            value={expiry}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
              setExpiry(formatExpiry(raw));
              setErrors((p) => ({ ...p, expiry: "" }));
            }}
            onBlur={() => setTouched((p) => ({ ...p, expiry: true }))}
            placeholder="MM/YY"
            maxLength={5}
            inputMode="numeric"
            autoComplete="cc-exp"
            className="h-10 text-sm font-mono"
            style={field("expiry")}
            data-testid="input-card-expiry"
          />
          {touched.expiry && errors.expiry && (
            <p className="text-[11px] text-red-400" data-testid="error-card-expiry">{errors.expiry}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label className="text-[12px] text-white/60">CVV</Label>
            <span className="text-[10px] text-white/30" title={`${cvvLen}-digit security code on ${brand === "amex" ? "the front" : "the back"} of your card`}>
              (?)</span>
          </div>
          <Input
            value={cvv}
            onChange={(e) => {
              setCvv(e.target.value.replace(/\D/g, "").slice(0, cvvLen));
              setErrors((p) => ({ ...p, cvv: "" }));
            }}
            onBlur={() => setTouched((p) => ({ ...p, cvv: true }))}
            placeholder={"•".repeat(cvvLen)}
            maxLength={cvvLen}
            inputMode="numeric"
            autoComplete="cc-csc"
            type="password"
            className="h-10 text-sm font-mono"
            style={field("cvv")}
            data-testid="input-card-cvv"
          />
          {touched.cvv && errors.cvv && (
            <p className="text-[11px] text-red-400" data-testid="error-card-cvv">{errors.cvv}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[12px] text-white/60">Cardholder Name</Label>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((p) => ({ ...p, name: "" }));
          }}
          onBlur={() => setTouched((p) => ({ ...p, name: true }))}
          placeholder="Full name as on card"
          autoComplete="cc-name"
          className="h-10 text-sm"
          style={field("name")}
          data-testid="input-cardholder-name"
        />
        {touched.name && errors.name && (
          <p className="text-[11px] text-red-400" data-testid="error-cardholder-name">{errors.name}</p>
        )}
      </div>

      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}
      >
        <Lock className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
        <p className="text-[11px] text-white/45 leading-tight">
          Your card details are encrypted and never stored in full. Only the last 4 digits are saved.
        </p>
      </div>

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            className="flex-1 h-9"
            onClick={onCancel}
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            data-testid="button-payment-cancel"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 h-9 font-semibold"
          style={{
            background: "linear-gradient(135deg, rgba(0,200,255,0.88) 0%, rgba(100,50,240,0.88) 100%)",
            border: "1px solid rgba(0,210,255,0.3)",
            boxShadow: "0 0 16px rgba(0,200,255,0.18)",
          }}
          data-testid="button-payment-submit"
        >
          {isPending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

interface SavedCardProps {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName: string;
  isDefault: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onSetDefault?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export function SavedCardItem({
  brand, last4, expMonth, expYear, cardholderName, isDefault, selected, onSelect, onSetDefault, onDelete, showActions,
}: SavedCardProps) {
  const brandLabel = brand === "visa" ? "Visa" : brand === "mastercard" ? "Mastercard" : brand === "amex" ? "Amex" : brand === "discover" ? "Discover" : "Card";
  const exp = `${String(expMonth).padStart(2, "0")}/${String(expYear).padStart(2, "0")}`;

  return (
    <div
      onClick={onSelect}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${onSelect ? "hover:opacity-90" : ""}`}
      style={{
        background: selected
          ? "linear-gradient(135deg, rgba(0,200,255,0.12) 0%, rgba(100,50,240,0.12) 100%)"
          : "rgba(255,255,255,0.04)",
        border: selected
          ? "1px solid rgba(0,200,255,0.35)"
          : "1px solid rgba(255,255,255,0.09)",
      }}
      data-testid={`card-payment-method-${last4}`}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <BrandLogo brand={brand as CardBrand} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-white/90">{brandLabel} ···· {last4}</span>
          {isDefault && (
            <span
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: "rgba(0,200,255,0.15)", color: "rgba(0,200,255,0.85)", border: "1px solid rgba(0,200,255,0.25)" }}
            >
              Default
            </span>
          )}
        </div>
        <div className="text-[11px] text-white/40 mt-0.5">{cardholderName} · Expires {exp}</div>
      </div>
      {selected && <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
      {showActions && (
        <div className="flex items-center gap-1 ml-2">
          {!isDefault && onSetDefault && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
              className="text-[10px] text-white/40 hover:text-white/70 px-1.5 py-0.5 rounded transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              data-testid={`button-set-default-${last4}`}
            >
              Set default
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-[10px] text-red-400/70 hover:text-red-400 px-1.5 py-0.5 rounded transition-colors"
              style={{ border: "1px solid rgba(239,68,68,0.15)" }}
              data-testid={`button-delete-card-${last4}`}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
