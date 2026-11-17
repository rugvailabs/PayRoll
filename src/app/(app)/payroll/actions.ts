"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit, notifyUsers } from "@/lib/notify";
import { emailLayout, esc, sendEmail } from "@/lib/email";
import { formatDate, formatMoney, fullName, parseDate, parseMoney } from "@/lib/format";
import { payrollPreview } from "@/lib/payroll";
import { payslipPdf } from "@/lib/pdf";

export type PrState = { error?: string; ok?: string } | undefined;

export async function createPayrollRunAction(_: PrState, fd: FormData): Promise<PrState> {
  const user = await requirePermission("payroll.manage");
  const oid = user.organizationId;
  const start = parseDate(fd.get("periodStart"));
  const end = parseDate(fd.get("periodEnd"));
  const payDate = parseDate(fd.get("payDate"));
  if (!start || !end || !payDate) return { error: "Enter the period and pay date." };
  if (end < start) return { error: "Period end must be after the start." };
  const selected = new Set(fd.getAll("employeeIds").map(String));
  const rows = (await payrollPreview(oid, start, end, fd.get("includeSalaried") === "on")).filter((r) => selected.has(r.employeeId));
  if (!rows.length) return { error: "Select at least one employee to pay." };

  const run = await db.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({
      data: {
        organizationId: oid, periodStart: start, periodEnd: end, payDate, createdById: user.id,
        totalGross: rows.reduce((a, r) => a + r.grossPay, 0),
      },
    });
    for (const r of rows) {
      const slip = await tx.payslip.create({
        data: {
          organizationId: oid, payrollRunId: run.id, employeeId: r.employeeId,
          regularMinutes: r.regularMinutes, overtimeMinutes: r.overtimeMinutes,
          regularPay: r.regularPay, overtimePay: r.overtimePay, grossPay: r.grossPay,
        },
      });
      if (r.timesheetIds.length) {
        const claimed = await tx.timesheet.updateMany({
          where: { id: { in: r.timesheetIds }, payslipId: null, status: "APPROVED" },
          data: { payslipId: slip.id },
        });
        if (claimed.count !== r.timesheetIds.length) throw new Error("Some timesheets changed. Reload and try again.");
      }
    }
    return run;
  }).catch((e: Error) => e);
  if (run instanceof Error) return { error: run.message };
  await audit(oid, user.id, "CREATE", "PayrollRun", run.id);
  redirect(`/payroll/${run.id}?created=1`);
}

async function loadRun(id: string) {
  const user = await requirePermission("payroll.manage");
  const run = await db.payrollRun.findFirst({ where: { id, organizationId: user.organizationId } });
  return { user, run };
}

async function recalcRun(runId: string) {
  const agg = await db.payslip.aggregate({ where: { payrollRunId: runId }, _sum: { grossPay: true } });
  await db.payrollRun.update({ where: { id: runId }, data: { totalGross: agg._sum.grossPay ?? 0 } });
}

export async function adjustPayslipAction(_: PrState, fd: FormData): Promise<PrState> {
  const user = await requirePermission("payroll.manage");
  const slip = await db.payslip.findFirst({
    where: { id: String(fd.get("payslipId")), organizationId: user.organizationId },
    include: { payrollRun: true },
  });
  if (!slip) return { error: "Payslip not found." };
  if (slip.payrollRun.status !== "DRAFT") return { error: "Only draft payroll can be adjusted." };
  const adj = parseMoney(fd.get("adjustments"));
  if (isNaN(adj)) return { error: "Enter an amount like 150.00 or -50.00." };
  const gross = slip.regularPay + slip.overtimePay + adj;
  if (gross < 0) return { error: "Gross pay cannot be negative." };
  await db.payslip.update({ where: { id: slip.id }, data: { adjustments: adj, grossPay: gross } });
  await recalcRun(slip.payrollRunId);
  await audit(user.organizationId, user.id, "ADJUST", "Payslip", slip.id, formatMoney(adj));
  revalidatePath(`/payroll/${slip.payrollRunId}`);
  return { ok: "Adjustment saved." };
}

export async function payrollRunOpAction(_: PrState, fd: FormData): Promise<PrState> {
  const id = String(fd.get("id"));
  const op = String(fd.get("op"));
  const { user, run } = await loadRun(id);
  if (!run) return { error: "Payroll run not found." };
  const oid = user.organizationId;

  if (op === "delete") {
    if (run.status === "PAID") return { error: "Paid payroll cannot be deleted." };
    await db.$transaction([
      db.timesheet.updateMany({ where: { payslip: { payrollRunId: id } }, data: { payslipId: null } }),
      db.payrollRun.delete({ where: { id } }),
    ]);
    await audit(oid, user.id, "DELETE", "PayrollRun", id);
    redirect("/payroll?deleted=1");
  }
  if (op === "approve") {
    if (run.status !== "DRAFT") return { error: "Only draft payroll can be approved." };
    await db.payrollRun.update({ where: { id }, data: { status: "APPROVED" } });
    await audit(oid, user.id, "APPROVE", "PayrollRun", id);
    revalidatePath(`/payroll/${id}`);
    return { ok: "Payroll approved. Mark it as paid once the money has been transferred." };
  }
  if (op === "reopen") {
    if (run.status !== "APPROVED") return { error: "Only approved payroll can be reopened." };
    await db.payrollRun.update({ where: { id }, data: { status: "DRAFT" } });
    revalidatePath(`/payroll/${id}`);
    return { ok: "Payroll moved back to draft." };
  }
  if (op === "paid") {
    if (run.status !== "APPROVED") return { error: "Approve the payroll before marking it paid." };
    const now = new Date();
    await db.$transaction([
      db.payrollRun.update({ where: { id }, data: { status: "PAID" } }),
      db.payslip.updateMany({ where: { payrollRunId: id }, data: { status: "PAID", paidAt: now } }),
    ]);
    await audit(oid, user.id, "PAID", "PayrollRun", id);

    // Notify each employee with their pay statement.
    const slips = await db.payslip.findMany({
      where: { payrollRunId: id },
      include: { employee: true, timesheets: { include: { placement: { include: { client: true } } } } },
    });
    const org = user.organization;
    const period = `${formatDate(run.periodStart)} – ${formatDate(run.periodEnd)}`;
    for (const s of slips) {
      const pdf = await payslipPdf({
        org, employee: { name: fullName(s.employee), code: s.employee.employeeCode, email: s.employee.email },
        periodStart: run.periodStart, periodEnd: run.periodEnd, payDate: run.payDate,
        regularMinutes: s.regularMinutes, overtimeMinutes: s.overtimeMinutes, regularPay: s.regularPay,
        overtimePay: s.overtimePay, adjustments: s.adjustments, grossPay: s.grossPay, status: "PAID",
        lines: s.timesheets.map((t) => ({ client: t.placement.client.name, period: `${formatDate(t.periodStart)} - ${formatDate(t.periodEnd)}`, minutes: t.totalMinutes })),
      });
      await sendEmail({
        organizationId: oid,
        to: s.employee.email,
        subject: `Pay statement: ${period}`,
        type: "PAYROLL_PAID",
        relatedId: s.id,
        attachments: [{ filename: `pay-statement-${formatDate(run.payDate).replace(/\//g, "-")}.pdf`, content: pdf, contentType: "application/pdf" }],
        html: emailLayout(org.name, "Your pay has been processed",
          `<p>Hello ${esc(s.employee.firstName)},</p>
           <p>Your pay for <b>${esc(period)}</b> has been processed with a pay date of <b>${formatDate(run.payDate)}</b>.</p>
           <p>Gross pay: <b>${formatMoney(s.grossPay)}</b></p><p>Your pay statement is attached.</p>`,
          { label: "View pay statements", url: `${process.env.APP_URL}/my/payslips` }),
      });
      if (s.employee.userId)
        await notifyUsers(oid, [s.employee.userId], {
          type: "PAYROLL_PAID", title: "Pay processed", body: `${period} · ${formatMoney(s.grossPay)}`, link: "/my/payslips",
        });
    }
    revalidatePath(`/payroll/${id}`);
    return { ok: `Payroll marked as paid. ${slips.length} employee(s) notified.` };
  }
  return { error: "Unknown action." };
}
