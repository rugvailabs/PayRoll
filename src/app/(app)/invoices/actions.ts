"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit, notifyRoles } from "@/lib/notify";
import { emailLayout, esc, sendEmail } from "@/lib/email";
import { addDays, formatDate, formatMoney, parseDate, parseMoney, str } from "@/lib/format";
import { emailInvoice, linesFromTimesheets } from "@/lib/invoicing";
import { balanceOf } from "@/lib/finance";

export type InvState = { error?: string; ok?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createInvoiceAction(_: InvState, fd: FormData): Promise<InvState> {
  const user = await requirePermission("invoices.manage");
  const oid = user.organizationId;
  const clientId = String(fd.get("clientId") ?? "");
  const client = await db.client.findFirst({ where: { id: clientId, organizationId: oid } });
  if (!client) return { error: "Choose a client." };

  const ids = fd.getAll("timesheetIds").map(String);
  const timesheets = ids.length
    ? await db.timesheet.findMany({
        where: { id: { in: ids }, organizationId: oid, status: "APPROVED", invoiceId: null, placement: { clientId } },
        include: { employee: true, placement: true },
        orderBy: [{ employee: { firstName: "asc" } }, { periodStart: "asc" }],
      })
    : [];
  if (timesheets.length !== ids.length) return { error: "Some timesheets are no longer available. Reload the page." };

  const lines: { description: string; minutes: number; rate: number; amount: number; timesheetId?: string }[] =
    linesFromTimesheets(timesheets);

  // Optional manual line (e.g. expenses, adjustments, fixed fees).
  const extraDesc = str(fd.get("extraDescription"));
  const extraAmount = parseMoney(fd.get("extraAmount"));
  if (extraDesc || fd.get("extraAmount")) {
    if (!extraDesc) return { fieldErrors: { extraDescription: "Description required" } };
    if (isNaN(extraAmount) || extraAmount === 0) return { fieldErrors: { extraAmount: "Enter an amount" } };
    lines.push({ description: extraDesc, minutes: 0, rate: 0, amount: extraAmount });
  }
  if (lines.length === 0) return { error: "Select at least one approved timesheet or add a line item." };

  const issueDate = parseDate(fd.get("issueDate"));
  if (!issueDate) return { fieldErrors: { issueDate: "Issue date is required" } };
  const dueDate = parseDate(fd.get("dueDate")) ?? addDays(issueDate, client.paymentTermsDays);
  if (dueDate < issueDate) return { fieldErrors: { dueDate: "Due date must be on or after the issue date" } };
  const total = lines.reduce((a, l) => a + l.amount, 0);
  if (total <= 0) return { error: "Invoice total must be greater than zero." };

  const periodStart = timesheets.length ? new Date(Math.min(...timesheets.map((t) => t.periodStart.getTime()))) : null;
  const periodEnd = timesheets.length ? new Date(Math.max(...timesheets.map((t) => t.periodEnd.getTime()))) : null;

  const invoice = await db.$transaction(async (tx) => {
    const org = await tx.organization.update({ where: { id: oid }, data: { nextInvoiceNo: { increment: 1 } } });
    const invoiceNumber = `${org.invoicePrefix}${org.nextInvoiceNo - 1}`;
    const inv = await tx.invoice.create({
      data: {
        organizationId: oid,
        clientId,
        invoiceNumber,
        issueDate,
        dueDate,
        periodStart,
        periodEnd,
        subtotal: total,
        total,
        notes: str(fd.get("notes")),
        lines: { create: lines },
      },
    });
    // Guard against double invoicing under concurrency.
    const claimed = await tx.timesheet.updateMany({
      where: { id: { in: timesheets.map((t) => t.id) }, invoiceId: null },
      data: { invoiceId: inv.id },
    });
    if (claimed.count !== timesheets.length) throw new Error("Timesheets were invoiced by someone else.");
    return inv;
  }).catch((e: Error) => e);
  if (invoice instanceof Error) return { error: invoice.message };

  await audit(oid, user.id, "CREATE", "Invoice", invoice.id, invoice.invoiceNumber);
  if (fd.get("sendNow") === "on") {
    await emailInvoice(oid, invoice.id);
    await audit(oid, user.id, "SEND", "Invoice", invoice.id);
  }
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}?created=1`);
}

export async function invoiceOpAction(_: InvState, fd: FormData): Promise<InvState> {
  const user = await requirePermission("invoices.manage");
  const oid = user.organizationId;
  const id = String(fd.get("id"));
  const op = String(fd.get("op"));
  const inv = await db.invoice.findFirst({ where: { id, organizationId: oid } });
  if (!inv) return { error: "Invoice not found." };

  switch (op) {
    case "send": {
      if (inv.status === "VOID") return { error: "Void invoices cannot be sent." };
      const r = await emailInvoice(oid, id, inv.status === "DRAFT" ? "INVOICE_SENT" : "INVOICE_RESENT");
      await audit(oid, user.id, "SEND", "Invoice", id);
      revalidatePath(`/invoices/${id}`);
      return r.status === "FAILED"
        ? { error: `Email failed: ${r.error}` }
        : { ok: r.status === "LOGGED" ? "Invoice marked as sent. SMTP is not configured, so the email was saved to the Email Outbox." : "Invoice emailed to the client." };
    }
    case "hold":
      await db.invoice.update({ where: { id }, data: { onHold: !inv.onHold } });
      await audit(oid, user.id, inv.onHold ? "RELEASE_HOLD" : "HOLD", "Invoice", id);
      revalidatePath(`/invoices/${id}`);
      return { ok: inv.onHold ? "Reminders resumed." : "Invoice on hold. Automatic reminders are paused." };
    case "void":
      if (inv.amountPaid > 0) return { error: "This invoice has payments. Remove them before voiding." };
      await db.$transaction([
        db.timesheet.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } }),
        db.invoice.update({ where: { id }, data: { status: "VOID" } }),
      ]);
      await audit(oid, user.id, "VOID", "Invoice", id);
      revalidatePath(`/invoices/${id}`);
      return { ok: "Invoice voided. Its timesheets can be invoiced again." };
    case "due": {
      const due = parseDate(fd.get("dueDate"));
      if (!due || due < inv.issueDate) return { error: "Enter a due date on or after the issue date." };
      await db.invoice.update({ where: { id }, data: { dueDate: due, remindersSent: "" } });
      await audit(oid, user.id, "CHANGE_DUE", "Invoice", id, formatDate(due));
      revalidatePath(`/invoices/${id}`);
      return { ok: "Due date updated." };
    }
  }
  return { error: "Unknown action." };
}

export async function recordPaymentAction(_: InvState, fd: FormData): Promise<InvState> {
  const user = await requirePermission("payments.manage");
  const oid = user.organizationId;
  const id = String(fd.get("invoiceId"));
  const inv = await db.invoice.findFirst({ where: { id, organizationId: oid }, include: { client: true } });
  if (!inv) return { error: "Invoice not found." };
  if (inv.status === "DRAFT") return { error: "Send the invoice before recording a payment." };
  if (inv.status === "VOID" || inv.status === "PAID") return { error: "This invoice is not open." };

  const amount = parseMoney(fd.get("amount"));
  const paidOn = parseDate(fd.get("paidOn"));
  const fe: Record<string, string> = {};
  if (isNaN(amount) || amount <= 0) fe.amount = "Enter the amount received";
  else if (amount > balanceOf(inv)) fe.amount = `Cannot exceed the balance of ${formatMoney(balanceOf(inv))}`;
  if (!paidOn) fe.paidOn = "Payment date is required";
  const method = str(fd.get("method")) ?? "ACH";
  if (!["ACH", "WIRE", "CHECK", "CARD", "OTHER"].includes(method)) fe.method = "Invalid method";
  if (Object.keys(fe).length) return { fieldErrors: fe };

  const newPaid = inv.amountPaid + amount;
  const status = newPaid >= inv.total ? "PAID" : "PARTIAL";
  await db.$transaction([
    db.payment.create({
      data: {
        organizationId: oid,
        invoiceId: id,
        clientId: inv.clientId,
        amount,
        paidOn: paidOn!,
        method,
        reference: str(fd.get("reference")),
        notes: str(fd.get("notes")),
        recordedById: user.id,
      },
    }),
    db.invoice.update({ where: { id }, data: { amountPaid: newPaid, status } }),
  ]);
  await audit(oid, user.id, "PAYMENT", "Invoice", id, formatMoney(amount));
  await notifyRoles(oid, ["ADMIN", "ACCOUNTANT"], {
    type: "PAYMENT_RECEIVED",
    title: `Payment received: ${inv.client.name}`,
    body: `${formatMoney(amount)} on ${inv.invoiceNumber} · ${status === "PAID" ? "paid in full" : `balance ${formatMoney(inv.total - newPaid)}`}`,
    link: `/invoices/${id}`,
  });
  if (fd.get("sendReceipt") === "on") {
    await sendEmail({
      organizationId: oid,
      to: inv.client.billingEmail,
      cc: inv.client.billingCcEmails,
      subject: `Payment received — ${inv.invoiceNumber}`,
      type: "PAYMENT_RECEIPT",
      relatedId: id,
      html: emailLayout(
        user.organization.name,
        "Thank you for your payment",
        `<p>Hello ${esc(inv.client.billingContactName ?? inv.client.name)},</p>
         <p>We received <b>${formatMoney(amount)}</b> on ${formatDate(paidOn!)} for invoice <b>${esc(inv.invoiceNumber)}</b>.</p>
         <p>${status === "PAID" ? "This invoice is now paid in full." : `Remaining balance: <b>${formatMoney(inv.total - newPaid)}</b>.`}</p>`,
      ),
    });
  }
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/receivables");
  return { ok: `Payment of ${formatMoney(amount)} recorded.` };
}

export async function deletePaymentAction(_: InvState, fd: FormData): Promise<InvState> {
  const user = await requirePermission("payments.manage");
  const oid = user.organizationId;
  const p = await db.payment.findFirst({ where: { id: String(fd.get("paymentId")), organizationId: oid }, include: { invoice: true } });
  if (!p) return { error: "Payment not found." };
  const newPaid = Math.max(0, p.invoice.amountPaid - p.amount);
  await db.$transaction([
    db.payment.delete({ where: { id: p.id } }),
    db.invoice.update({ where: { id: p.invoiceId }, data: { amountPaid: newPaid, status: newPaid === 0 ? "SENT" : "PARTIAL" } }),
  ]);
  await audit(oid, user.id, "DELETE_PAYMENT", "Invoice", p.invoiceId, formatMoney(p.amount));
  revalidatePath(`/invoices/${p.invoiceId}`);
  return { ok: "Payment removed." };
}
