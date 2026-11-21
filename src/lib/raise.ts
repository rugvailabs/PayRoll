import "server-only";
import { db } from "./db";
import { addDays, todayUtc } from "./format";
import { linesFromTimesheets } from "./invoicing";
import { rowsFromTimesheets } from "./payroll";

/**
 * Bulk "Raise" from approved timesheets:
 *  - one DRAFT invoice per candidate per client (for timesheets not yet invoiced)
 *  - one DRAFT payroll run with a payslip per candidate (for timesheets not yet on payroll)
 * Nothing is emailed here; the admin reviews the drafts and sends them.
 */
export async function raiseFromTimesheets(organizationId: string, userId: string, ids: string[]) {
  const timesheets = await db.timesheet.findMany({
    where: { id: { in: ids }, organizationId, status: "APPROVED" },
    include: { employee: true, placement: { include: { client: true } } },
    orderBy: [{ employee: { firstName: "asc" } }, { periodStart: "asc" }],
  });
  if (!timesheets.length) return { invoices: 0, runId: null as string | null, payslips: 0, skipped: ids.length };

  const today = todayUtc();
  return db.$transaction(async (tx) => {
    // ---- Draft invoices: group by candidate + client ----
    const toInvoice = timesheets.filter((t) => !t.invoiceId);
    const groups = new Map<string, typeof toInvoice>();
    for (const t of toInvoice) {
      const key = `${t.employeeId}:${t.placement.clientId}`;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    let invoices = 0;
    for (const group of groups.values()) {
      const client = group[0].placement.client;
      const lines = linesFromTimesheets(group);
      const total = lines.reduce((a, l) => a + l.amount, 0);
      if (total <= 0) continue;
      const org = await tx.organization.update({ where: { id: organizationId }, data: { nextInvoiceNo: { increment: 1 } } });
      const inv = await tx.invoice.create({
        data: {
          organizationId,
          clientId: client.id,
          invoiceNumber: `${org.invoicePrefix}${org.nextInvoiceNo - 1}`,
          issueDate: today,
          dueDate: addDays(today, client.paymentTermsDays),
          periodStart: new Date(Math.min(...group.map((t) => t.periodStart.getTime()))),
          periodEnd: new Date(Math.max(...group.map((t) => t.periodEnd.getTime()))),
          subtotal: total,
          total,
          status: "DRAFT",
          lines: { create: lines },
        },
      });
      const claimed = await tx.timesheet.updateMany({
        where: { id: { in: group.map((t) => t.id) }, invoiceId: null },
        data: { invoiceId: inv.id },
      });
      if (claimed.count !== group.length) throw new Error("Some timesheets were invoiced by someone else. Reload and try again.");
      invoices++;
    }

    // ---- Draft payroll run ----
    const toPay = timesheets.filter((t) => !t.payslipId);
    let runId: string | null = null;
    let payslips = 0;
    if (toPay.length) {
      const rows = [...rowsFromTimesheets(toPay).values()];
      const periodEnd = new Date(Math.max(...toPay.map((t) => t.periodEnd.getTime())));
      const run = await tx.payrollRun.create({
        data: {
          organizationId,
          periodStart: new Date(Math.min(...toPay.map((t) => t.periodStart.getTime()))),
          periodEnd,
          payDate: addDays(today > periodEnd ? today : periodEnd, 7),
          createdById: userId,
          totalGross: rows.reduce((a, r) => a + r.grossPay, 0),
          notes: "Raised from approved timesheets",
        },
      });
      for (const r of rows) {
        const slip = await tx.payslip.create({
          data: {
            organizationId, payrollRunId: run.id, employeeId: r.employeeId,
            regularMinutes: r.regularMinutes, overtimeMinutes: r.overtimeMinutes,
            regularPay: r.regularPay, overtimePay: r.overtimePay, grossPay: r.grossPay,
          },
        });
        const claimed = await tx.timesheet.updateMany({ where: { id: { in: r.timesheetIds }, payslipId: null }, data: { payslipId: slip.id } });
        if (claimed.count !== r.timesheetIds.length) throw new Error("Some timesheets were added to payroll by someone else. Reload and try again.");
        payslips++;
      }
      runId = run.id;
    }
    return { invoices, runId, payslips, skipped: ids.length - timesheets.length };
  });
}
