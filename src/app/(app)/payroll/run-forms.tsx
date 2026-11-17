"use client";

import { useActionState } from "react";
import { Alert, Card, CardHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { adjustPayslipAction, createPayrollRunAction, payrollRunOpAction, type PrState } from "./actions";

const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
const hrs = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export function CreateRunForm({
  start, end, payDate, includeSalaried,
  rows,
}: {
  start: string; end: string; payDate: string; includeSalaried: boolean;
  rows: { employeeId: string; name: string; code: string; payType: string; timesheets: number; regularMinutes: number; overtimeMinutes: number; grossPay: number }[];
}) {
  const [state, action] = useActionState<PrState, FormData>(createPayrollRunAction, undefined);
  const total = rows.reduce((a, r) => a + r.grossPay, 0);
  return (
    <form action={action}>
      <input type="hidden" name="periodStart" value={start} />
      <input type="hidden" name="periodEnd" value={end} />
      <input type="hidden" name="payDate" value={payDate} />
      {includeSalaried && <input type="hidden" name="includeSalaried" value="on" />}
      <Card>
        <CardHeader title="Employees to pay" subtitle="Approved timesheets in this period that have not been paid yet." />
        {state?.error && <div className="px-5 pt-4"><Alert tone="error">{state.error}</Alert></div>}
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No approved, unpaid timesheets fall inside this period.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th className="w-8" /><th>Employee</th><th>Employee ID</th><th>Basis</th><th className="text-right">Regular hrs</th><th className="text-right">OT hrs</th><th className="text-right">Gross pay</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td><input type="checkbox" name="employeeIds" value={r.employeeId} defaultChecked className="h-4 w-4 accent-brand-600" /></td>
                    <td className="font-medium text-slate-900">{r.name}</td>
                    <td className="font-mono text-xs">{r.code}</td>
                    <td>{r.payType === "SALARY" ? "Salary" : `${r.timesheets} timesheet(s)`}</td>
                    <td className="text-right tabular-nums">{hrs(r.regularMinutes)}</td>
                    <td className="text-right tabular-nums">{hrs(r.overtimeMinutes)}</td>
                    <td className="text-right font-medium tabular-nums">{money(r.grossPay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-slate-50 font-semibold"><td colSpan={6} className="px-4 py-3">Total gross</td><td className="px-4 py-3 text-right tabular-nums">{money(total)}</td></tr></tfoot>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="flex justify-end border-t border-slate-100 p-4">
            <SubmitButton pendingText="Creating…">Create payroll run</SubmitButton>
          </div>
        )}
      </Card>
    </form>
  );
}

export function RunActions({ id, status }: { id: string; status: string }) {
  const [state, action] = useActionState<PrState, FormData>(payrollRunOpAction, undefined);
  const btn = (op: string, label: string, variant: "primary" | "secondary" | "danger" | "success", confirm?: string) => (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <SubmitButton variant={variant} confirm={confirm} pendingText="Working…">{label}</SubmitButton>
    </form>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && btn("approve", "Approve payroll", "primary")}
        {status === "APPROVED" && btn("paid", "Mark as paid & notify employees", "success", "Money transferred?")}
        {status === "APPROVED" && btn("reopen", "Back to draft", "secondary")}
        {status !== "PAID" && btn("delete", "Delete run", "danger", "Delete this payroll run?")}
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
    </div>
  );
}

export function AdjustForm({ payslipId, value }: { payslipId: string; value: string }) {
  const [state, action] = useActionState<PrState, FormData>(adjustPayslipAction, undefined);
  return (
    <form action={action} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="payslipId" value={payslipId} />
      <input name="adjustments" defaultValue={value} inputMode="decimal" className="control h-8 w-24 py-1 text-right" aria-label="Adjustment" />
      <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
