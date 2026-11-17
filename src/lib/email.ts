import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";

type Attachment = { filename: string; content: Buffer | Uint8Array; contentType?: string };

let transporter: Transporter | null = null;
function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Sends an email and records it in EmailLog. When SMTP is not configured the
 * email is only logged (status LOGGED) and visible on the Email Outbox page.
 */
export async function sendEmail(opts: {
  organizationId: string;
  to: string;
  cc?: string | null;
  subject: string;
  html: string;
  type: string;
  relatedId?: string;
  attachments?: Attachment[];
}) {
  const t = getTransporter();
  let status = "LOGGED";
  let error: string | null = null;
  if (t) {
    try {
      await t.sendMail({
        from: process.env.SMTP_FROM,
        to: opts.to,
        cc: opts.cc || undefined,
        subject: opts.subject,
        html: opts.html,
        attachments: opts.attachments?.map((a) => ({ ...a, content: Buffer.from(a.content) })),
      });
      status = "SENT";
    } catch (e) {
      status = "FAILED";
      error = e instanceof Error ? e.message : String(e);
    }
  }
  await db.emailLog.create({
    data: {
      organizationId: opts.organizationId,
      to: opts.to,
      cc: opts.cc ?? null,
      subject: opts.subject,
      html: opts.html,
      type: opts.type,
      status,
      error,
      relatedId: opts.relatedId,
    },
  });
  return { status, error };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Simple branded email layout. `body` must already be escaped HTML. */
export function emailLayout(orgName: string, title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#0f2a4a;color:#fff;padding:18px 24px;font-size:18px;font-weight:600">${esc(orgName)}</td></tr>
<tr><td style="padding:24px"><h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>${body}
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${esc(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:14px 24px;background:#f9fafb;font-size:12px;color:#6b7280">This is an automated message from ${esc(orgName)}.</td></tr>
</table></td></tr></table></body></html>`;
}

export { esc };
