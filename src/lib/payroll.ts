import "server-only";
import { db } from "./db";
import { amountFor, otRate } from "./invoicing";
import { fullName } from "./format";

export type PayrollPreviewRow = {
  employeeId: string;
  name: string;
  code: string;
  payType: string;
  timesheetIds: string[];
  regularMinutes: number;
  overtimeMinutes: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
};

/** Approved timesheets inside the period that are not yet on a payslip, grouped per employee. */
export async function payrollPreview(organizationId: string, start: Date, end: Date, includeSalaried: boolean) {
  const timesheets = await db.timesheet.findMany({
    where: {
      organizationId,
      status: "APPROVED",
      payslipId: null,
      periodStart: { gte: start },
      periodEnd: { lte: end },
    },
    include: { employee: true, placement: true },
  });
  const rows = new Map<string, PayrollPreviewRow>();
  for (const t of timesheets) {
    const r = rows.get(t.employeeId) ?? {
      employeeId: t.employeeId, name: fullName(t.employee), code: t.employee.employeeCode, payType: "HOURLY",
      timesheetIds: [], regularMinutes: 0, overtimeMinutes: 0, regularPay: 0, overtimePay: 0, grossPay: 0,
    };
    r.timesheetIds.push(t.id);
    r.regularMinutes += t.regularMinutes;
    r.overtimeMinutes += t.overtimeMinutes;
    r.regularPay += amountFor(t.regularMinutes, t.placement.payRate);
    r.overtimePay += amountFor(t.overtimeMinutes, otRate(t.placement.payRate, t.placement.otPayRate));
    r.grossPay = r.regularPay + r.overtimePay;
    rows.set(t.employeeId, r);
  }
  if (includeSalaried) {
    const salaried = await db.employee.findMany({
      where: { organizationId, status: "ACTIVE", payType: "SALARY", defaultPayRate: { gt: 0 } },
    });
    for (const e of salaried) {
      if (rows.has(e.id)) continue;
      rows.set(e.id, {
        employeeId: e.id, name: fullName(e), code: e.employeeCode, payType: "SALARY", timesheetIds: [],
        regularMinutes: 0, overtimeMinutes: 0, regularPay: e.defaultPayRate, overtimePay: 0, grossPay: e.defaultPayRate,
      });
    }
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}
