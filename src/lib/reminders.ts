import "server-only";
import { db } from "./db";
import { emailLayout, esc, sendEmail } from "./email";
import { notifyClientUsers, notifyRoles, notifyUsers } from "./notify";
import { addDays, dateToInput, daysBetween, formatDate, formatMoney, periodFor, todayUtc } from "./format";
import { balanceOf } from "./finance";

function parseOffsets(s: string) {
  return [...new Set(s.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isInteger(n) && n >= -60 && n <= 365))].sort((a, b) => a - b);
}

/**
 * Payment reminders for one organization.
 * For each open invoice, sends at most one email per run: the latest schedule offset
 * that has been reached and not yet sent. Earlier missed offsets are marked as sent
 * so a client never receives a burst of catch-up reminders.
 */
export async function runPaymentReminders(organizationId: string) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  if (!org.remindersEnabled) return { sent: 0 };
  const offsets = parseOffsets(org.reminderOffsets);
  if (!offsets.length) return { sent: 0 };
  const today = todayUtc();

  const invoices = await db.invoice.findMany({
    where: { organizationId, status: { in: ["SENT", "PARTIAL"] }, onHold: false, client: { remindersEnabled: true } },
    include: { client: true },
  });

  let sent = 0;
  const overdueForAdmins: string[] = [];
  for (const inv of invoices) {
    const balance = balanceOf(inv);
    if (balance <= 0) continue;
    const d = daysBetween(inv.dueDate, today); // negative = days until due
    const already = new Set(inv.remindersSent.split(",").filter(Boolean).map(Number));
    const reached = offsets.filter((o) => o <= d && !already.has(o));
    if (!reached.length) continue;
    const offset = reached[reached.length - 1];

    const title =
      offset < 0 ? `Payment reminder: due in ${-d} day${-d === 1 ? "" : "s"}`
      : offset === 0 ? "Payment due today"
      : `Payment overdue by ${d} day${d === 1 ? "" : "s"}`;
    const intro =
      offset < 0
        ? `This is a friendly reminder that invoice <b>${esc(inv.invoiceNumber)}</b> is due on <b>${formatDate(inv.dueDate)}</b>.`
        : offset === 0
          ? `Invoice <b>${esc(inv.invoiceNumber)}</b> is due <b>today</b>.`
          : `Our records show invoice <b>${esc(inv.invoiceNumber)}</b> was due on <b>${formatDate(inv.dueDate)}</b> and is now <b>${d} days overdue</b>.`;

    await sendEmail({
      organizationId,
      to: inv.client.billingEmail,
      cc: inv.client.billingCcEmails,
      subject: `${title} — ${inv.invoiceNumber} (${formatMoney(balance)})`,
      type: offset > 0 ? "PAYMENT_OVERDUE" : "PAYMENT_REMINDER",
      relatedId: inv.id,
      html: emailLayout(
        org.name,
        title,
        `<p>Hello ${esc(inv.client.billingContactName ?? inv.client.name)},</p>
         <p>${intro}</p>
         <p>Outstanding balance: <b>${formatMoney(balance)}</b></p>
         <p>If you have already sent payment, please disregard this message or reply with the payment reference. Thank you.</p>`,
      ),
    });
    await notifyClientUsers(organizationId, inv.clientId, {
      type: offset > 0 ? "PAYMENT_OVERDUE" : "PAYMENT_REMINDER",
      title: `${title} · ${inv.invoiceNumber}`,
      body: `Balance ${formatMoney(balance)} · due ${formatDate(inv.dueDate)}`,
      link: `/client/invoices/${inv.id}`,
    });
    await db.invoice.update({
      where: { id: inv.id },
      data: {
        lastReminderAt: new Date(),
        remindersSent: [...already, ...reached].sort((a, b) => a - b).join(","),
      },
    });
    sent++;
    if (offset > 0) overdueForAdmins.push(`${inv.client.name} · ${inv.invoiceNumber} · ${formatMoney(balance)} · ${d} days`);
    if (offset > 0) {
      await notifyRoles(organizationId, ["ADMIN", "ACCOUNTANT"], {
        type: "PAYMENT_OVERDUE",
        title: `Overdue ${d} days: ${inv.client.name}`,
        body: `${inv.invoiceNumber} · balance ${formatMoney(balance)} · reminder emailed to client`,
        link: `/invoices/${inv.id}`,
      });
    }
  }

  // Daily overdue summary email to admins/accountants (once per day).
  const overdueAll = invoices.filter((i) => balanceOf(i) > 0 && daysBetween(i.dueDate, today) > 0);
  if (overdueAll.length) {
    const already = await db.emailLog.findFirst({
      where: { organizationId, type: "OVERDUE_SUMMARY", relatedId: dateToInput(today) },
    });
    if (!already) {
      const admins = await db.user.findMany({ where: { organizationId, role: { in: ["ADMIN", "ACCOUNTANT"] }, isActive: true } });
      const total = overdueAll.reduce((a, i) => a + balanceOf(i), 0);
      const rows = overdueAll
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .map((i) => `<tr><td>${esc(i.client.name)}</td><td>${esc(i.invoiceNumber)}</td><td align="right">${daysBetween(i.dueDate, today)}</td><td align="right">${formatMoney(balanceOf(i))}</td></tr>`)
        .join("");
      for (const a of admins) {
        await sendEmail({
          organizationId,
          to: a.email,
          subject: `Overdue payments: ${overdueAll.length} invoice(s), ${formatMoney(total)}`,
          type: "OVERDUE_SUMMARY",
          relatedId: dateToInput(today),
          html: emailLayout(
            org.name,
            "Overdue client payments",
            `<p>${overdueAll.length} invoice(s) are past due, totaling <b>${formatMoney(total)}</b>.</p>
             <table width="100%" cellpadding="6" style="border-collapse:collapse;font-size:13px">
             <tr style="background:#f3f4f6"><th align="left">Client</th><th align="left">Invoice</th><th align="right">Days</th><th align="right">Balance</th></tr>${rows}</table>`,
            { label: "Open aging report", url: `${process.env.APP_URL}/receivables` },
          ),
        });
      }
    }
  }
  return { sent };
}

/** Reminds employees once per period when the last completed period's timesheet is missing. */
export async function runTimesheetReminders(organizationId: string) {
  const today = todayUtc();
  const placements = await db.placement.findMany({
    where: { organizationId, status: "ACTIVE", employee: { status: "ACTIVE" } },
    include: { employee: true, client: true, timesheets: true, organization: true },
  });
  let sent = 0;
  for (const p of placements) {
    const current = periodFor(p.timesheetFrequency, today);
    const last = periodFor(p.timesheetFrequency, addDays(current.start, -1));
    if (last.end < p.startDate) continue;
    const ts = p.timesheets.find((t) => dateToInput(t.periodStart) === dateToInput(last.start));
    if (ts && (ts.status === "SUBMITTED" || ts.status === "APPROVED")) continue;
    const key = `${p.id}:${dateToInput(last.start)}`;
    if (await db.emailLog.findFirst({ where: { organizationId, type: "TIMESHEET_REMINDER", relatedId: key } })) continue;
    const period = `${formatDate(last.start)} – ${formatDate(last.end)}`;
    await sendEmail({
      organizationId,
      to: p.employee.email,
      subject: `Timesheet due: ${p.client.name} (${period})`,
      type: "TIMESHEET_REMINDER",
      relatedId: key,
      html: emailLayout(
        p.organization.name,
        "Your timesheet is due",
        `<p>Hello ${esc(p.employee.firstName)},</p>
         <p>Please submit your timesheet for <b>${esc(p.client.name)}</b> for <b>${esc(period)}</b>, with the client-approved timesheet attached.</p>`,
        { label: "Submit timesheet", url: `${process.env.APP_URL}/my/timesheets/new` },
      ),
    });
    if (p.employee.userId)
      await notifyUsers(organizationId, [p.employee.userId], {
        type: "TIMESHEET_DUE",
        title: "Timesheet due",
        body: `${p.client.name} · ${period}`,
        link: "/my/timesheets/new",
      });
    sent++;
  }
  return { sent };
}

export async function runAllReminders() {
  const orgs = await db.organization.findMany({ select: { id: true, name: true } });
  const results = [];
  for (const o of orgs) {
    try {
      const pay = await runPaymentReminders(o.id);
      const ts = await runTimesheetReminders(o.id);
      results.push({ org: o.name, paymentReminders: pay.sent, timesheetReminders: ts.sent });
    } catch (e) {
      results.push({ org: o.name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

