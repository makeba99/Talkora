/**
 * Central support / VIP feature flags.
 *
 * BuyMeACoffee.com is unavailable in some markets (notably Armenia).
 * Those markets use in-app PayPal VIP instead of an external BMC link.
 * Keep all country/language gating here — do not scatter hard-coded checks.
 */

/** ISO country codes where BuyMeACoffee.com is not a viable checkout path. */
export const BMC_UNSUPPORTED_COUNTRIES = new Set(["AM"]);

/** Room / UI language labels where the old BMC CTA is not appropriate. */
export const BMC_UNSUPPORTED_LANGUAGES = new Set(["Armenian"]);

export type SupportVariant = "paypal-vip" | "hidden";

export function resolveSupportVariant(opts: {
  countryCode?: string | null;
  preferredLanguage?: string | null;
  paypalConfigured: boolean;
}): SupportVariant {
  const country = (opts.countryCode || "").toUpperCase();
  const language = opts.preferredLanguage || "";

  // PayPal VIP replaces Buy Me a Coffee everywhere it is configured.
  // Markets where BMC.com does not work still see PayPal VIP (not a dead link).
  if (opts.paypalConfigured) return "paypal-vip";

  // Without PayPal configured, never show a broken BMC CTA in unsupported markets.
  if (BMC_UNSUPPORTED_COUNTRIES.has(country) || BMC_UNSUPPORTED_LANGUAGES.has(language)) {
    return "hidden";
  }

  // Prefer hiding rather than linking to buymeacoffee.com (removed from the product).
  return "hidden";
}

export function supportNavLabel(variant: SupportVariant, countryCode?: string | null): string {
  if (variant !== "paypal-vip") return "";
  const country = (countryCode || "").toUpperCase();
  // Armenia (and other BMC-blocked markets): avoid the misleading BMC brand name.
  if (BMC_UNSUPPORTED_COUNTRIES.has(country)) return "Become VIP";
  return "Buy Me a Coffee";
}

/** PayPal merchant IDs are typically 13 alphanumeric characters. */
export const PAYPAL_MERCHANT_ID_RE = /^[A-Z0-9]{10,20}$/;

export function normalizePaypalMerchantId(raw: string): string | null {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!PAYPAL_MERCHANT_ID_RE.test(cleaned)) return null;
  return cleaned;
}
