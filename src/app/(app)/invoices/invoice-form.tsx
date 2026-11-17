"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert, Card, CardHeader, LinkButton, TextAreaField, TextField } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { createInvoiceAction, type InvState } from "./actions";

type Row = { id: string; employee: string; period: string; hours: string; amount: number };
const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

export function InvoiceForm({
  clientId,
  rows,
  issueDate,
  dueDate,
  termsDays,
}: {
  clientId: string;
  rows: Row[];
  issueDate: string;
  dueDate: string;
  termsDays: number;
}) {
  const [state, action] = useActionState<InvState, FormData>(createInvoiceAction, undefined);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.map((r) => r.id)));
  const [extra, setExtra] = useState("");
  const fe = state?.fieldErrors ?? {};
  const total = useMemo(
    () => rows.filter((r) => selected.has(r.id)).reduce((a, r) => a + r.amount, 0) + Math.round((parseFloat(extra) || 0) * 100),
    [rows, selected, extra],
  );
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="space-y-6 xl:col-span-2">
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <Card>
          <CardHeader title="Approved timesheets" subtitle="Approved timesheets for this client that are not yet invoiced." />
          {rows.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No approved, un-invoiced timesheets for this client. You can still add a manual line item.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8">
                      <input type="checkbox" className="h-4 w-4 accent-brand-600" aria-label="Select all"
                        checked={selected.size === rows.length}
                        onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
                    </th>
                    <th>Employee</th><th>Period</th><th className="text-right">Hours</th><th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => toggle(r.id)} className="cursor-pointer">
                      <td>
                        <input type="checkbox" name="timesheetIds" value={r.id} checked={selected.has(r.id)} onChange={() => toggle(r.id)}
                          onClick={(e) => e.stopPropagation()} className="h-4 w-4 accent-brand-600" />
                      </td>
                      <td className="font-medium text-slate-900">{r.employee}</td>
                      <td>{r.period}</td>
                      <td className="text-right tabular-nums">{r.hours}</td>
                      <td className="text-right tabular-nums">{money(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Additional line item" subtitle="Optional: expenses, fees or adjustments (use a negative amount for a discount)." />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <TextField label="Description" name="extraDescription" className="sm:col-span-2" error={fe.extraDescription} />
            <TextField label="Amount (USD)" name="extraAmount" inputMode="decimal" placeholder="0.00" value={extra}
              onChange={(e) => setExtra(e.target.value)} error={fe.extraAmount} />
          </div>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader title="Invoice details" />
        <div className="space-y-4 p-5">
          <TextField label="Issue date" name="issueDate" type="date" required defaultValue={issueDate} error={fe.issueDate} />
          <TextField label="Due date" name="dueDate" type="date" defaultValue={dueDate} error={fe.dueDate} hint={`Client terms: Net ${termsDays}`} />
          <TextAreaField label="Notes on invoice" name="notes" placeholder="Payment instructions, PO reference…" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sendNow" defaultChecked className="h-4 w-4 accent-brand-600" />
            Email invoice PDF to the client now
          </label>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Invoice total</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{money(total)}</p>
          </div>
          <div className="flex gap-2">
            <LinkButton href="/invoices" variant="secondary" className="flex-1">Cancel</LinkButton>
            <SubmitButton className="flex-1" pendingText="Creating…">Create invoice</SubmitButton>
          </div>
        </div>
      </Card>
    </form>
  );
}
