import "server-only";
import JSZip from "jszip";
import { db } from "./db";
import { emailLayout, esc, sendEmail } from "./email";
import { invoicePdf } from "./pdf";
import { formatDate, formatMinutes, formatMoney, fullName } from "./format";
import { balanceOf } from "./finance";
import { notifyClientUsers } from "./notify";

/** Overtime rate falls back to 1.5x the regular rate when not set. */
export const otRate = (regular: number, ot: number) => (ot > 0 ? ot : Math.round(regular * 1.5));

/** Amount in cents for `minutes` at an hourly `rate` (cents), rounded to the cent. */
export const amountFor = (minutes: number, rate: number) => Math.round((minutes * rate) / 60);

type TsForLines = {
  id: string;
  regularMinutes: number;
  overtimeMinutes: number;
  periodStart: Date;
  periodEnd: Date;
  employee: { firstName: string; middleName: string | null; lastName: string };
  placement: { billRate: number; otBillRate: number; projectName: string | null };
};

export function linesFromTimesheets(timesheets: TsForLines[]) {
  const lines: { description: string; minutes: number; rate: number; amount: number; timesheetId: string }[] = [];
  for (const t of timesheets) {
    const who = fullName(t.employee);
    const period = `${formatDate(t.periodStart)} - ${formatDate(t.periodEnd)}`;
    const proj = t.placement.projectName ? ` · ${t.placement.projectName}` : "";
    if (t.regularMinutes > 0) {
      lines.push({
        description: `${who}${proj} - ${period}`,
        minutes: t.regularMinutes,
        rate: t.placement.billRate,
        amount: amountFor(t.regularMinutes, t.placement.billRate),
        timesheetId: t.id,
      });
    }
    if (t.overtimeMinutes > 0) {
      const r = otRate(t.placement.billRate, t.placement.otBillRate);
      lines.push({
        description: `${who}${proj} - Overtime ${period}`,
        minutes: t.overtimeMinutes,
        rate: r,
        amount: amountFor(t.overtimeMinutes, r),
        timesheetId: t.id,
      });
    }
  }
  return lines;
}

export async function loadInvoiceForPdf(organizationId: string, id: string) {
  const inv = await db.invoice.findFirst({
    where: { id, organizationId },
    include: { lines: true, client: true, organization: true },
  });
  if (!inv) return null;
  const bytes = await invoicePdf({
    org: { ...inv.organization, address: inv.organization.address },
    invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    client: inv.client,
    lines: inv.lines,
    total: inv.total,
    amountPaid: inv.amountPaid,
    notes: inv.notes,
    termsDays: inv.client.paymentTermsDays,
  });
  return { inv, bytes };
}

/** Emails the invoice PDF to the client billing contact and marks it SENT. */
export async function emailInvoice(organizationId: string, id: string, kind: "INVOICE_SENT" | "INVOICE_RESENT" = "INVOICE_SENT") {
  // Lazy import avoids a circular module dependency (documents.ts imports this file).
  const { invoiceBundle } = await import("./documents");
  const bundle = await invoiceBundle(organizationId, id);
  if (!bundle) throw new Error("Invoice not found");
  const { inv, files } = bundle;
  const tsCount = files.filter((f) => f.filename.startsWith("Timesheet-")).length;
  const hours = inv.lines.reduce((a, l) => a + l.minutes, 0);

  const zip = new JSZip();
  for (const f of files) zip.file(f.filename, f.content);
  const zipBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

  const result = await sendEmail({
    organizationId,
    to: inv.client.billingEmail,
    cc: inv.client.billingCcEmails,
    subject: `Invoice ${inv.invoiceNumber} from ${inv.organization.name} — ${formatMoney(balanceOf(inv))} due ${formatDate(inv.dueDate)}`,
    type: kind,
    relatedId: inv.id,
    attachments: [{ filename: `${inv.invoiceNumber}.zip`, content: zipBytes, contentType: "application/zip" }],
    html: emailLayout(
      inv.organization.name,
      `Invoice ${inv.invoiceNumber}`,
      `<p>Hello ${esc(inv.client.billingContactName ?? inv.client.name)},</p>
       <p>Please find attached a zip file with invoice <b>${esc(inv.invoiceNumber)}</b>${inv.periodStart && inv.periodEnd ? ` for services from ${formatDate(inv.periodStart)} to ${formatDate(inv.periodEnd)}` : ""}${tsCount ? ` and the approved timesheet${tsCount > 1 ? "s" : ""}` : ""}.</p>
       <table cellpadding="6" style="border-collapse:collapse;font-size:14px;margin:12px 0">
         <tr><td style="color:#6b7280">Amount due</td><td><b>${formatMoney(balanceOf(inv))}</b></td></tr>
         <tr><td style="color:#6b7280">Due date</td><td><b>${formatDate(inv.dueDate)}</b></td></tr>
         ${hours ? `<tr><td style="color:#6b7280">Total hours</td><td>${formatMinutes(hours)}</td></tr>` : ""}
       </table>
       <p>Please reference the invoice number with your payment. Thank you.</p>`,
    ),
  });
  if (inv.status === "DRAFT") {
    await db.invoice.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
  }
  await notifyClientUsers(organizationId, inv.clientId, {
    type: "INVOICE_SENT",
    title: `Invoice ${inv.invoiceNumber}`,
    body: `${formatMoney(balanceOf(inv))} due ${formatDate(inv.dueDate)}`,
    link: `/client/invoices/${inv.id}`,
  });
  return result;
}
