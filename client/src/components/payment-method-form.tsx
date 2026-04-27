import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, CreditCard, CheckCircle2, ShieldCheck, Trash2, Star } from "lucide-react";

type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

function detectBrand(number: string): CardBrand {
  const n = number.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(6011|65|64[4-9])/.test(n)) return "discover";
  return "unknown";
}

function BrandLogo({ brand, size = "md" }: { brand: CardBrand; size?: "sm" | "md" | "lg" }) {
  const h = size === "lg" ? "h-7" : size === "sm" ? "h-4" : "h-5";
  if (brand === "visa") return (
    <svg viewBox="0 0 60 20" className={`${h} w-auto`}>
      <text x="0" y="16" fontFamily="Arial Black, sans-serif" fontStyle="italic" fontWeight="900" fontSize="18" fill="#fff">VISA</text>
    </svg>
  );
  if (brand === "mastercard") return (
    <svg viewBox="0 0 42 26" className={`${h} w-auto`}>
      <circle cx="15" cy="13" r="12" fill="#EB001B" />
      <circle cx="27" cy="13" r="12" fill="#F79E1B" />
      <path d="M21 4.7A12 12 0 0 1 26 13a12 12 0 0 1 -5 8.3A12 12 0 0 1 16 13 12 12 0 0 1 21 4.7z" fill="#FF5F00" />
    </svg>
  );
  if (brand === "amex") return (
    <svg viewBox="0 0 60 20" className={`${h} w-auto`}>
      <rect width="60" height="20" rx="3" fill="#2E77BC" />
      <text x="6" y="14" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="10" fill="#fff" letterSpacing="1">AMEX</text>
    </svg>
  );
  if (brand === "discover") return (
    <svg viewBox="0 0 80 20" className={`${h} w-auto`}>
      <text x="0" y="15" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="13" fill="#fff">DISC<tspan fill="#FF6E1B">●</tspan>VER</text>
    </svg>
  );
  return <CreditCard className="w-5 h-5 text-white/55" />;
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

function maskedDisplay(number: string, brand: CardBrand): string {
  const groups = brand === "amex" ? [4, 6, 5] : [4, 4, 4, 4];
  const digits = number.replace(/\D/g, "");
  let cursor = 0;
  const out = groups.map((g) => {
    const slice = digits.slice(cursor, cursor + g);
    cursor += g;
    return (slice + "•".repeat(Math.max(0, g - slice.length)));
  });
  return out.join(" ");
}

/** Animated 3D credit-card preview that flips on CVV focus. */
export function CreditCardPreview({
  number,
  expiry,
  cvv,
  name,
  flipped,
}: {
  number: string;
  expiry: string;
  cvv: string;
  name: string;
  flipped: boolean;
}) {
  const brand = detectBrand(number);
  return (
    <div className="neu-credit-card-wrap" data-testid="preview-credit-card">
      <div className={`neu-credit-card ${flipped ? "is-flipped" : ""}`}>
        {/* FRONT */}
        <div className="neu-cc-face">
          <div className="neu-cc-row">
            <div className="neu-cc-chip" />
            <div className="neu-cc-wave" />
          </div>
          <div className="neu-cc-number" data-testid="preview-cc-number">
            {maskedDisplay(number, brand)}
          </div>
          <div className="neu-cc-row items-end">
            <div className="min-w-0 flex-1">
              <div className="neu-cc-label">Cardholder</div>
              <div className="neu-cc-value" data-testid="preview-cc-name">
                {name.trim() || "YOUR NAME"}
              </div>
            </div>
            <div className="text-right">
              <div className="neu-cc-label">Expires</div>
              <div className="neu-cc-value" data-testid="preview-cc-expiry">
                {expiry || "MM/YY"}
              </div>
            </div>
            <div className="ml-2">
              {brand === "unknown"
                ? <span className="neu-cc-brand">VEXTORN</span>
                : <BrandLogo brand={brand} size="lg" />}
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="neu-cc-face neu-cc-back">
          <div className="neu-cc-mag" />
          <div className="neu-cc-cvv-row">
            <div className="neu-cc-cvv-strip" />
            <div className="neu-cc-cvv-box" data-testid="preview-cc-cvv">
              {cvv ? cvv.padEnd(brand === "amex" ? 4 : 3, "•") : (brand === "amex" ? "••••" : "•••")}
            </div>
          </div>
          <div className="neu-cc-back-label">Authorized signature · {brand !== "unknown" ? brand.toUpperCase() : "VEXTORN"}</div>
        </div>
      </div>
    </div>
  );
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
  /** Optionally hide the embedded card preview (when caller renders its own). */
  hidePreview?: boolean;
}

export function PaymentMethodForm({ onSubmit, onCancel, isPending, submitLabel = "Save Card", hidePreview = false }: Props) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [cvvFocused, setCvvFocused] = useState(false);

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

  function wellClass(key: string) {
    return `neu-input-well ${touched[key] && errors[key] ? "is-error" : ""}`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!hidePreview && (
        <CreditCardPreview
          number={cardNumber}
          expiry={expiry}
          cvv={cvv}
          name={name}
          flipped={cvvFocused}
        />
      )}

      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold tracking-wider uppercase text-white/45">Card Number</Label>
        <div className={wellClass("cardNumber")}>
          <CreditCard className="w-4 h-4 text-white/35 flex-shrink-0" />
          <input
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
            className="font-mono tracking-wider"
            data-testid="input-card-number"
          />
          <BrandLogo brand={brand} size="sm" />
        </div>
        {touched.cardNumber && errors.cardNumber && (
          <p className="text-[11px] text-red-400 pl-1" data-testid="error-card-number">{errors.cardNumber}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold tracking-wider uppercase text-white/45">Expiry</Label>
          <div className={wellClass("expiry")}>
            <input
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
              className="font-mono"
              data-testid="input-card-expiry"
            />
          </div>
          {touched.expiry && errors.expiry && (
            <p className="text-[11px] text-red-400 pl-1" data-testid="error-card-expiry">{errors.expiry}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold tracking-wider uppercase text-white/45">CVV</Label>
          <div className={wellClass("cvv")}>
            <input
              value={cvv}
              onChange={(e) => {
                setCvv(e.target.value.replace(/\D/g, "").slice(0, cvvLen));
                setErrors((p) => ({ ...p, cvv: "" }));
              }}
              onFocus={() => setCvvFocused(true)}
              onBlur={() => { setCvvFocused(false); setTouched((p) => ({ ...p, cvv: true })); }}
              placeholder={"•".repeat(cvvLen)}
              maxLength={cvvLen}
              inputMode="numeric"
              autoComplete="cc-csc"
              type="password"
              className="font-mono"
              data-testid="input-card-cvv"
            />
            <Lock className="w-3.5 h-3.5 text-white/30" />
          </div>
          {touched.cvv && errors.cvv && (
            <p className="text-[11px] text-red-400 pl-1" data-testid="error-card-cvv">{errors.cvv}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold tracking-wider uppercase text-white/45">Cardholder Name</Label>
        <div className={wellClass("name")}>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((p) => ({ ...p, name: "" }));
            }}
            onBlur={() => setTouched((p) => ({ ...p, name: true }))}
            placeholder="Full name as on card"
            autoComplete="cc-name"
            data-testid="input-cardholder-name"
          />
        </div>
        {touched.name && errors.name && (
          <p className="text-[11px] text-red-400 pl-1" data-testid="error-cardholder-name">{errors.name}</p>
        )}
      </div>

      <div className="neu-lock-badge">
        <ShieldCheck className="w-4 h-4 text-emerald-400/85 flex-shrink-0" />
        <p className="text-[11px] text-white/55 leading-tight">
          End-to-end encrypted. We never store your full card — only the last 4 digits.
        </p>
      </div>

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            className="flex-1 h-10"
            onClick={onCancel}
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            data-testid="button-payment-cancel"
          >
            Cancel
          </Button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 neu-book-button h-10 justify-center"
          data-testid="button-payment-submit"
        >
          <Lock className="w-3.5 h-3.5" />
          {isPending ? "Saving…" : submitLabel}
        </button>
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
      className={`neu-saved-card ${selected ? "is-selected" : ""}`}
      data-testid={`card-payment-method-${last4}`}
    >
      <div className="neu-saved-card-brand">
        <BrandLogo brand={brand as CardBrand} size="sm" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-bold text-white/92 tracking-wide">
            {brandLabel} <span className="text-white/45 mx-0.5">•••• ••••</span> {last4}
          </span>
          {isDefault && (
            <span className="neu-status-pill is-trial !text-[8px] !py-[2px] !px-[6px]">
              <Star className="w-2.5 h-2.5" />
              Default
            </span>
          )}
        </div>
        <div className="text-[11px] text-white/45 mt-0.5 font-medium">{cardholderName} · Exp {exp}</div>
      </div>
      {selected && <CheckCircle2 className="w-5 h-5 text-violet-300 flex-shrink-0" style={{ filter: "drop-shadow(0 0 6px rgba(167,139,250,0.65))" }} />}
      {showActions && (
        <div className="flex items-center gap-1 ml-2">
          {!isDefault && onSetDefault && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
              className="text-[10px] text-white/45 hover:text-violet-300 px-2 py-1 rounded-md transition-colors"
              style={{
                background: "linear-gradient(150deg, hsl(228 14% 17%) 0%, hsl(228 14% 13%) 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 1px 2px 4px rgba(0,0,0,0.4)",
              }}
              data-testid={`button-set-default-${last4}`}
            >
              Set default
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-red-400/70 hover:text-red-400 p-1.5 rounded-md transition-colors"
              style={{
                background: "linear-gradient(150deg, hsl(228 14% 17%) 0%, hsl(228 14% 13%) 100%)",
                border: "1px solid rgba(239,68,68,0.18)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 1px 2px 4px rgba(0,0,0,0.4)",
              }}
              data-testid={`button-delete-card-${last4}`}
              title="Remove card"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
