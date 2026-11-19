"use client";

import { useActionState } from "react";
import { Alert, Card, FormSection, SelectField, TextField } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { US_STATES } from "@/lib/options";
import { saveOrgAction, type SetState } from "./actions";

export function OrgForm({ d }: { d: Record<string, string> }) {
  const [state, action] = useActionState<SetState, FormData>(saveOrgAction, undefined);
  return (
    <form action={action}>
      <Card>
        {(state?.error || state?.ok) && (
          <div className="px-5 pt-5">
            {state.error ? <Alert tone="error">{state.error}</Alert> : <Alert tone="success">{state.ok}</Alert>}
          </div>
        )}
        <FormSection title="Organization" description="Shown on invoices, pay statements and emails.">
          <TextField label="Organization name" name="name" required defaultValue={d.name} className="sm:col-span-2" />
          <TextField label="Company code" name="slug" defaultValue={d.slug} disabled hint="Employees use this to sign in" />
          <TextField label="Email" name="email" type="email" defaultValue={d.email} />
          <TextField label="Phone" name="phone" defaultValue={d.phone} />
          <TextField label="Tax ID / EIN" name="taxId" defaultValue={d.taxId} />
          <TextField label="Street address" name="address" defaultValue={d.address} className="sm:col-span-2 xl:col-span-3" />
          <TextField label="City" name="city" defaultValue={d.city} />
          <SelectField label="State" name="state" options={US_STATES} defaultValue={d.state} />
          <TextField label="ZIP" name="zip" defaultValue={d.zip} />
        </FormSection>
        <FormSection title="Invoicing">
          <TextField label="Invoice prefix" name="invoicePrefix" defaultValue={d.invoicePrefix} />
          <TextField label="Next invoice number" name="nextInvoiceNo" type="number" min={1} defaultValue={d.nextInvoiceNo} />
          <TextField label="Default payment terms (days)" name="defaultTermsDays" type="number" min={0} max={365} defaultValue={d.defaultTermsDays} />
        </FormSection>
        <FormSection title="Payment alerts" description="Automatic emails to clients before and after the invoice due date, plus admin alerts.">
          <label className="flex items-center gap-2 text-sm sm:col-span-2 xl:col-span-3">
            <input type="checkbox" name="remindersEnabled" defaultChecked={d.remindersEnabled === "true"} className="h-4 w-4 accent-brand-600" />
            Send automatic payment reminders
          </label>
          <TextField
            label="Reminder schedule (days relative to due date)"
            name="reminderOffsets"
            defaultValue={d.reminderOffsets}
            className="sm:col-span-2"
            hint="Negative = before due date, 0 = on due date, positive = days overdue. Example: -3,0,1,7,15,30,60"
          />
        </FormSection>
        <div className="sticky bottom-0 z-10 flex justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
