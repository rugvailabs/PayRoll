"use client";

import { useActionState, useState } from "react";
import { Alert, Card, FormSection, LinkButton, SelectField, TextField } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { FREQUENCIES } from "@/lib/format";
import { savePlacementAction, type PlacementFormState } from "./actions";

type Opt = { value: string; label: string };

export function PlacementForm({
  defaults = {},
  employees,
  clients,
  returnTo,
  locked,
}: {
  defaults?: Record<string, string>;
  employees: Opt[];
  clients: (Opt & { frequency: string })[];
  returnTo?: string;
  locked?: boolean;
}) {
  const [state, action] = useActionState<PlacementFormState, FormData>(savePlacementAction, undefined);
  const fe = state?.fieldErrors ?? {};
  const d = (k: string) => defaults[k] ?? "";
  const [clientId, setClientId] = useState(d("clientId"));
  const [bill, setBill] = useState(d("billRate"));
  const [pay, setPay] = useState(d("payRate"));
  const margin = (parseFloat(bill) || 0) - (parseFloat(pay) || 0);
  const marginPct = parseFloat(bill) ? (margin / parseFloat(bill)) * 100 : 0;

  return (
    <form action={action} noValidate>
      {d("id") && <input type="hidden" name="id" value={d("id")} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {state?.error && <div className="mb-4"><Alert tone="error">{state.error}</Alert></div>}
      <Card>
        <FormSection title="Assignment" description="Which employee works for which client.">
          <SelectField label="Employee" name="employeeId" options={employees} required defaultValue={d("employeeId")}
            error={fe.employeeId} disabled={locked} />
          <SelectField label="Client" name="clientId" options={clients} required value={clientId} disabled={locked}
            onChange={(e) => setClientId(e.target.value)} error={fe.clientId} />
          <TextField label="Job title at client" name="jobTitle" defaultValue={d("jobTitle")} />
          <TextField label="Project name" name="projectName" defaultValue={d("projectName")} />
          <TextField label="PO number" name="poNumber" defaultValue={d("poNumber")} />
          <SelectField label="Timesheet frequency" name="timesheetFrequency" options={FREQUENCIES} placeholder={false}
            key={clientId} defaultValue={d("timesheetFrequency") || clients.find((c) => c.value === clientId)?.frequency || "MONTHLY"} />
          <TextField label="Start date" name="startDate" type="date" required defaultValue={d("startDate")} error={fe.startDate} />
          <TextField label="End date" name="endDate" type="date" defaultValue={d("endDate")} error={fe.endDate} hint="Leave blank if ongoing" />
          <SelectField label="Status" name="status" placeholder={false} defaultValue={d("status") || "ACTIVE"}
            options={[{ value: "ACTIVE", label: "Active" }, { value: "ENDED", label: "Ended" }]} />
        </FormSection>
        <FormSection title="Rates (USD / hour)" description="Bill rate is invoiced to the client. Pay rate is used for payroll.">
          <TextField label="Bill rate" name="billRate" inputMode="decimal" required placeholder="0.00" value={bill}
            onChange={(e) => setBill(e.target.value)} error={fe.billRate} />
          <TextField label="Pay rate" name="payRate" inputMode="decimal" required placeholder="0.00" value={pay}
            onChange={(e) => setPay(e.target.value)} error={fe.payRate} />
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Margin / hour</p>
            <p className={`mt-1 text-lg font-semibold ${margin < 0 ? "text-red-600" : "text-emerald-700"}`}>
              ${margin.toFixed(2)} <span className="text-sm font-normal text-slate-500">({marginPct.toFixed(1)}%)</span>
            </p>
          </div>
          <TextField label="Overtime bill rate" name="otBillRate" inputMode="decimal" placeholder="0.00" defaultValue={d("otBillRate")} error={fe.otBillRate}
            hint="Leave 0 to bill overtime at 1.5× bill rate" />
          <TextField label="Overtime pay rate" name="otPayRate" inputMode="decimal" placeholder="0.00" defaultValue={d("otPayRate")} error={fe.otPayRate}
            hint="Leave 0 to pay overtime at 1.5× pay rate" />
        </FormSection>
        <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-5 py-4">
          <LinkButton href={returnTo ?? "/placements"} variant="secondary">Cancel</LinkButton>
          <SubmitButton>{d("id") ? "Save placement" : "Create placement"}</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
