/**
 * Central support / VIP CTA flags.
 * Buy Me a Coffee UI opens in-app PayPal VIP checkout (BMC.com is unavailable in Armenia).
 */

export type SupportVariant = "paypal-vip" | "hidden";

export function resolveSupportVariant(opts: {
  countryCode?: string | null;
  preferredLanguage?: string | null;
  paypalConfigured: boolean;
  isAdmin?: boolean;
}): SupportVariant {
  // Admins always see the CTA so they can test checkout / messaging.
  if (opts.isAdmin) return "paypal-vip";
  // Product surface: always show Buy Me a Coffee → PayPal VIP dialog.
  // Checkout returns a clear error if merchant ID is not configured yet.
  return "paypal-vip";
}

export function supportNavLabel(
  _variant: SupportVariant,
  _countryCode?: string | null,
): string {
  return "Buy Me a Coffee";
}

/** PayPal merchant IDs are typically 13 alphanumeric characters. */
export const PAYPAL_MERCHANT_ID_RE = /^[A-Z0-9]{10,20}$/;

export function normalizePaypalMerchantId(raw: string): string | null {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!PAYPAL_MERCHANT_ID_RE.test(cleaned)) return null;
  return cleaned;
}
