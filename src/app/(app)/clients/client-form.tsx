"use client";

import { useActionState } from "react";
import { Alert, Card, Field, FormSection, LinkButton, SelectField, TextAreaField, TextField } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { FREQUENCIES } from "@/lib/format";
import { INDUSTRIES, US_STATES } from "@/lib/options";
import { saveClientAction, type ClientFormState } from "./actions";

export function ClientForm({ defaults = {} }: { defaults?: Record<string, string> }) {
  const [state, action] = useActionState<ClientFormState, FormData>(saveClientAction, undefined);
  const fe = state?.fieldErrors ?? {};
  const d = (k: string) => defaults[k] ?? "";
  const editing = !!defaults.id;

  return (
    <form action={action} noValidate>
      {editing && <input type="hidden" name="id" value={d("id")} />}
      {state?.error && <div className="mb-4"><Alert tone="error">{state.error}</Alert></div>}
      <Card>
        <FormSection title="Company" description="The client company your employees work for.">
          <TextField label="Client name" name="name" required defaultValue={d("name")} error={fe.name} className="sm:col-span-2" />
          <TextField label="Client code" name="clientCode" defaultValue={d("clientCode")} error={fe.clientCode}
            hint={editing ? undefined : "Leave blank to auto-generate"} />
          <SelectField label="Industry" name="industry" options={INDUSTRIES} defaultValue={d("industry")} />
          <TextField label="Website" name="website" defaultValue={d("website")} placeholder="https://" />
          <TextField label="Phone" name="phone" type="tel" defaultValue={d("phone")} />
          <TextField label="Tax ID / EIN" name="taxId" defaultValue={d("taxId")} />
          <SelectField label="Status" name="status" placeholder={false} defaultValue={d("status") || "ACTIVE"}
            options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
        </FormSection>

        <FormSection title="Address">
          <TextField label="Street address" name="addressLine" defaultValue={d("addressLine")} className="sm:col-span-2 xl:col-span-3" />
          <TextField label="City" name="city" defaultValue={d("city")} />
          <SelectField label="State" name="state" options={US_STATES} defaultValue={d("state")} />
          <TextField label="ZIP" name="zip" defaultValue={d("zip")} />
        </FormSection>

        <FormSection title="Billing" description="Invoices, payroll documents and payment reminders are sent here.">
          <TextField label="Billing contact name" name="billingContactName" defaultValue={d("billingContactName")} />
          <TextField label="Billing email" name="billingEmail" type="email" required defaultValue={d("billingEmail")} error={fe.billingEmail} />
          <TextField label="CC emails" name="billingCcEmails" defaultValue={d("billingCcEmails")} error={fe.billingCcEmails}
            hint="Separate multiple emails with commas" />
          <TextField label="Payment terms (days)" name="paymentTermsDays" type="number" min={0} max={365}
            defaultValue={d("paymentTermsDays") || "30"} error={fe.paymentTermsDays} hint="Net days until the invoice is due" />
          <SelectField label="Invoice / timesheet frequency" name="invoiceFrequency" options={FREQUENCIES} placeholder={false}
            defaultValue={d("invoiceFrequency") || "MONTHLY"} error={fe.invoiceFrequency} />
          <Field label="Payment reminders">
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" name="remindersEnabled" defaultChecked={d("remindersEnabled") !== "false"} className="h-4 w-4 accent-brand-600" />
              Send automatic due &amp; overdue reminders
            </label>
          </Field>
        </FormSection>

        <FormSection title="Timesheet approver" description="Person at the client who signs off on hours.">
          <TextField label="Approver name" name="approverName" defaultValue={d("approverName")} />
          <TextField label="Approver email" name="approverEmail" type="email" defaultValue={d("approverEmail")} error={fe.approverEmail} />
        </FormSection>

        <FormSection title="Notes">
          <TextAreaField label="Internal notes" name="notes" defaultValue={d("notes")} className="sm:col-span-2 xl:col-span-3" />
        </FormSection>

        <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-5 py-4">
          <LinkButton href={editing ? `/clients/${d("id")}` : "/clients"} variant="secondary">Cancel</LinkButton>
          <SubmitButton>{editing ? "Save changes" : "Create client"}</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
