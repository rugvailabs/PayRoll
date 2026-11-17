"use client";

import { useActionState } from "react";
import { Alert, Card, CardHeader, SelectField, TextField } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { PAYMENT_METHODS } from "@/lib/options";
import { deletePaymentAction, invoiceOpAction, recordPaymentAction, type InvState } from "../actions";

export function InvoiceActions({ id, status, onHold, canVoid, dueDate }: { id: string; status: string; onHold: boolean; canVoid: boolean; dueDate: string }) {
  const [state, action] = useActionState<InvState, FormData>(invoiceOpAction, undefined);
  const btn = (op: string, label: string, variant: "primary" | "secondary" | "danger" = "secondary", confirm?: string) => (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <SubmitButton variant={variant} size="md" pendingText="Working…" confirm={confirm}>{label}</SubmitButton>
    </form>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`/api/invoices/${id}/pdf`} target="_blank" className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Download PDF
        </a>
        {status !== "VOID" && btn("send", status === "DRAFT" ? "Send to client" : "Resend to client", status === "DRAFT" ? "primary" : "secondary")}
        {(status === "SENT" || status === "PARTIAL") && btn("hold", onHold ? "Resume reminders" : "Put on hold")}
        {canVoid && status !== "VOID" && btn("void", "Void", "danger", "Void this invoice?")}
      </div>
      {(status === "SENT" || status === "PARTIAL" || status === "DRAFT") && (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="op" value="due" />
          <TextField label="Change due date" name="dueDate" type="date" defaultValue={dueDate} />
          <SubmitButton variant="secondary" size="md">Update</SubmitButton>
        </form>
      )}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
    </div>
  );
}

export function PaymentForm({ invoiceId, balance, today }: { invoiceId: string; balance: string; today: string }) {
  const [state, action] = useActionState<InvState, FormData>(recordPaymentAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader title="Record payment" subtitle="Money received from the client for this invoice." />
      <form action={action} className="space-y-4 p-5">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        {state?.ok && <Alert tone="success">{state.ok}</Alert>}
        <TextField label="Amount received (USD)" name="amount" inputMode="decimal" required defaultValue={balance} error={fe.amount} />
        <TextField label="Payment date" name="paidOn" type="date" required defaultValue={today} error={fe.paidOn} />
        <SelectField label="Method" name="method" options={PAYMENT_METHODS} placeholder={false} defaultValue="ACH" error={fe.method} />
        <TextField label="Reference / check #" name="reference" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sendReceipt" defaultChecked className="h-4 w-4 accent-brand-600" />
          Email a payment receipt to the client
        </label>
        <SubmitButton variant="success" className="w-full" pendingText="Recording…">Record payment</SubmitButton>
      </form>
    </Card>
  );
}

export function DeletePayment({ paymentId }: { paymentId: string }) {
  const [state, action] = useActionState<InvState, FormData>(deletePaymentAction, undefined);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="paymentId" value={paymentId} />
      <SubmitButton variant="ghost" size="sm" confirm="Remove?" pendingText="…">Remove</SubmitButton>
      {state?.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
