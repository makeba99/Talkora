import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

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

export function describeSmtpError(err: unknown): string {
  const msg = String((err as any)?.response || (err as any)?.message || err || "");
  if (/Invalid login|Username and Password not accepted|EAUTH|535/i.test(msg)) {
    return "Gmail rejected the login. SMTP_USER must be the Gmail address and SMTP_PASS must be the 16-character App Password with no spaces. Set them in Railway → Variables (not the database), then redeploy.";
  }
  if (/timeout|ETIMEDOUT|ECONNECTION|ESOCKET/i.test(msg)) {
    return "Could not reach Gmail SMTP from the server. Wait a minute and try a test email again.";
  }
  return msg.slice(0, 280) || "Gmail send failed.";
}

export function createMailTransport(): Transporter | null {
  const pass = getSmtpPass();
  if (!pass) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: getSmtpUser(), pass },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
    socketTimeout: 25000,
    pool: true,
    maxConnections: 1,
    maxMessages: 80,
  });
}

export async function verifyMailTransport(): Promise<{ ok: true; transporter: Transporter } | { ok: false; error: string }> {
  const transporter = createMailTransport();
  if (!transporter) {
    return {
      ok: false,
      error: "SMTP_PASS is missing. Add it under Railway → Variables (not the Postgres database), then redeploy.",
    };
  }
  try {
    await transporter.verify();
    return { ok: true, transporter };
  } catch (err) {
    try { transporter.close(); } catch { /* ignore */ }
    return { ok: false, error: describeSmtpError(err) };
  }
}

export type OutreachJob = {
  campaignId: string;
  status: "sending" | "done" | "error";
  sent: number;
  failed: number;
  total: number;
  lastError?: string;
};

let outreachJob: OutreachJob | null = null;

export function getOutreachJob(): OutreachJob | null {
  return outreachJob;
}

export type MailRecipient = { email: string; name: string };

export async function sendOneOutreachMail(
  transporter: Transporter,
  recipient: MailRecipient,
  opts: { subject: string; body: string; bodyHtml: string; imageUrl?: string; trackingPixelHtml?: string },
) {
  const rendered = renderOutreachEmail({
    name: recipient.name,
    bodyHtml: opts.bodyHtml,
    bodyText: opts.body,
    imageUrl: opts.imageUrl,
    trackingPixelHtml: opts.trackingPixelHtml,
  });
  await transporter.sendMail({
    from: getMailFrom(),
    replyTo: SMTP_REPLY_TO,
    to: recipient.email,
    subject: opts.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

export function startOutreachJob(
  campaignId: string,
  recipients: MailRecipient[],
  opts: { subject: string; body: string; bodyHtml: string; imageUrl?: string; trackingPixelHtml?: string },
) {
  outreachJob = {
    campaignId,
    status: "sending",
    sent: 0,
    failed: 0,
    total: recipients.length,
  };
  const job = outreachJob;
  void (async () => {
    const verified = await verifyMailTransport();
    if (!verified.ok) {
      job.status = "error";
      job.lastError = verified.error;
      job.failed = recipients.length;
      return;
    }
    const transporter = verified.transporter;
    try {
      for (const recipient of recipients) {
        try {
          await sendOneOutreachMail(transporter, recipient, opts);
          job.sent += 1;
        } catch (err) {
          job.failed += 1;
          job.lastError = describeSmtpError(err);
          console.error("[outreach] send failed", recipient.email, err);
        }
      }
      job.status = "done";
    } finally {
      try { transporter.close(); } catch { /* ignore */ }
    }
  })();
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
