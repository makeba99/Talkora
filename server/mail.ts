import nodemailer from "nodemailer";

export const SMTP_USER_DEFAULT = "a46947314@gmail.com";
export const SMTP_FROM_NAME_DEFAULT = "Hello Vextorn";
export const SMTP_REPLY_TO = "hello@vextorn.app";

export function getSmtpUser(): string {
  return (process.env.SMTP_USER || SMTP_USER_DEFAULT).trim();
}

export function getSmtpPass(): string {
  return (process.env.SMTP_PASS || "").replace(/\s+/g, "");
}

export function getSmtpFromName(): string {
  return (process.env.SMTP_FROM_NAME || SMTP_FROM_NAME_DEFAULT).trim() || SMTP_FROM_NAME_DEFAULT;
}

export function getMailFrom(): string {
  return `"${getSmtpFromName()}" <${getSmtpUser()}>`;
}

export function isMailConfigured(): boolean {
  return Boolean(getSmtpPass());
}

export function createMailTransport() {
  const pass = getSmtpPass();
  if (!pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: getSmtpUser(), pass },
  });
}

export function greetingName(user: {
  displayName?: string | null;
  firstName?: string | null;
  email?: string | null;
}): string {
  const name = (user.displayName || user.firstName || "").trim();
  if (name) return name.split(/\s+/)[0];
  if (user.email) return user.email.split("@")[0];
  return "there";
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapLinksForTracking(text: string, campaignId: string, base: string): string {
  return text.replace(/https?:\/\/[^\s<>"]+[^\s<>".,!?;:)]/g, (url) =>
    `${base}/t/c/${campaignId}?url=${encodeURIComponent(url)}`
  );
}

export function renderOutreachEmail(opts: {
  name: string;
  bodyHtml: string;
  bodyText: string;
  imageUrl?: string;
  trackingPixelHtml?: string;
}): { html: string; text: string } {
  const safeName = escapeHtml(opts.name);
  const imageBlock = opts.imageUrl?.trim()
    ? `<img src="${escapeHtml(opts.imageUrl.trim())}" alt="" style="display:block;width:100%;max-width:560px;border-radius:12px;margin:20px 0 8px" />`
    : "";
  const html = `<div style="margin:0;padding:0;background:#070b16">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#0b1020;color:#f4f4f5;border-radius:16px;overflow:hidden">
    <div style="padding:28px 32px 22px;background:linear-gradient(135deg,#1e1b4b 0%,#0f172a 70%);border-bottom:1px solid #1e293b">
      <p style="margin:0;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#fbbf24;font-weight:700">Vextorn</p>
      <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;color:#ffffff;font-weight:700">Hello Vextorn</h1>
    </div>
    <div style="padding:28px 32px 8px;font-size:16px;line-height:1.65;color:#e2e8f0">
      <p style="margin:0 0 16px;font-size:18px;color:#fff">Hello ${safeName},</p>
      <div>${opts.bodyHtml}</div>
      ${imageBlock}
    </div>
    <div style="padding:20px 32px 28px;font-size:12px;line-height:1.5;color:#94a3b8">
      You're receiving this because you have a Vextorn account.
      <br />
      <a href="https://vextorn.app" style="color:#fbbf24;text-decoration:none">Open Vextorn</a>
    </div>
  </div>
  ${opts.trackingPixelHtml || ""}
</div>`;

  const text = `Hello Vextorn\n\nHello ${opts.name},\n\n${opts.bodyText}\n\nOpen Vextorn: https://vextorn.app`;
  return { html, text };
}
