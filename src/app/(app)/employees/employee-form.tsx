"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, buttonClass, Card, Field, FormSection, LinkButton, SelectField, TextAreaField, TextField } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import {
  CATEGORIES, EMPLOYEE_STATUS, EMPLOYMENT_TYPES, ETHNICITIES, GENDERS, MARITAL, PAY_TYPES,
  US_STATES, USER_ROLES, VETERAN, WORK_AUTH,
} from "@/lib/options";
import { FREQUENCIES } from "@/lib/format";
import { createEmployeeAction, updateEmployeeAction, type EmployeeFormState } from "./actions";
import { TempPasswordBox } from "./temp-password";

type Opt = { value: string; label: string };
export type EmployeeDefaults = Partial<Record<string, string>>;

export function EmployeeForm({
  mode,
  defaults = {},
  jobTitles,
  departments,
  managers,
  clients,
}: {
  mode: "create" | "edit";
  defaults?: EmployeeDefaults;
  jobTitles: Opt[];
  departments: Opt[];
  managers: Opt[];
  clients: (Opt & { frequency: string })[];
}) {
  const [state, action] = useActionState<EmployeeFormState, FormData>(
    mode === "create" ? createEmployeeAction : updateEmployeeAction,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  const [createLogin, setCreateLogin] = useState(true);
  const [assignClient, setAssignClient] = useState("");
  const d = (k: string) => defaults[k] ?? "";

  if (state?.createdId) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">✓</div>
        <h2 className="text-lg font-semibold">{state.ok}</h2>
        {state.tempPassword && (
          <div className="mt-6 text-left">
            <TempPasswordBox password={state.tempPassword} />
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <LinkButton href={`/employees/${state.createdId}`}>View employee</LinkButton>
          {/* Full reload so the form state resets. */}
          <button type="button" onClick={() => window.location.assign("/employees/new")} className={buttonClass("secondary")}>
            Add another
          </button>
        </div>
      </Card>
    );
  }

  return (
    <form action={action} noValidate>
      {mode === "edit" && <input type="hidden" name="id" value={d("id")} />}
      {state?.error && (
        <div className="mb-4">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}
      <Card>
        <FormSection title="Personal details" description="Basic identity information.">
          <TextField label="First name" name="firstName" required defaultValue={d("firstName")} error={fe.firstName} />
          <TextField label="Middle name" name="middleName" defaultValue={d("middleName")} />
          <TextField label="Last name" name="lastName" required defaultValue={d("lastName")} error={fe.lastName} />
          <TextField label="Short name" name="shortName" defaultValue={d("shortName")} hint="Preferred / display name" />
          <TextField label="Date of birth" name="dateOfBirth" type="date" defaultValue={d("dateOfBirth")} />
          <SelectField label="Gender" name="gender" options={GENDERS} defaultValue={d("gender")} />
          <TextField
            label="SSN (last 4 digits)"
            name="ssnLast4"
            inputMode="numeric"
            maxLength={4}
            defaultValue={d("ssnLast4")}
            error={fe.ssnLast4}
            hint="Only the last 4 digits are stored."
          />
          <SelectField label="Ethnicity" name="ethnicity" options={ETHNICITIES} defaultValue={d("ethnicity")} />
          <SelectField label="Marital status" name="maritalStatus" options={MARITAL} defaultValue={d("maritalStatus")} />
          <SelectField label="Veteran status" name="veteranStatus" options={VETERAN} defaultValue={d("veteranStatus")} />
        </FormSection>

        <FormSection title="Contact" description="Login credentials and notifications are sent to the primary email.">
          <TextField label="Email address" name="email" type="email" required defaultValue={d("email")} error={fe.email} />
          <TextField label="Alternate email" name="alternateEmail" type="email" defaultValue={d("alternateEmail")} error={fe.alternateEmail} />
          <TextField label="Contact number" name="phone" type="tel" defaultValue={d("phone")} />
          <TextField label="Street address" name="addressLine" defaultValue={d("addressLine")} className="sm:col-span-2" />
          <TextField label="City" name="city" defaultValue={d("city")} />
          <SelectField label="State" name="state" options={US_STATES} defaultValue={d("state") || "Texas"} />
          <TextField label="ZIP" name="zip" defaultValue={d("zip")} />
        </FormSection>

        <FormSection title="Employment" description="Job, reporting and classification.">
          <TextField label="Employee ID" name="employeeCode" defaultValue={d("employeeCode")} error={fe.employeeCode}
            hint={mode === "create" ? "Leave blank to auto-generate" : undefined} />
          <SelectField label="Job title" name="jobTitleId" options={jobTitles} defaultValue={d("jobTitleId")} />
          <SelectField label="Department" name="departmentId" options={departments} defaultValue={d("departmentId")} />
          <SelectField label="Employment type" name="employmentType" options={EMPLOYMENT_TYPES} placeholder={false} defaultValue={d("employmentType") || "W2"} />
          <SelectField label="Reporting manager" name="reportingManagerId" options={managers} defaultValue={d("reportingManagerId")} error={fe.reportingManagerId} />
          <TextField label="Date of joining" name="dateOfJoining" type="date" defaultValue={d("dateOfJoining")} />
          <SelectField label="Work authorization" name="workAuthorization" options={WORK_AUTH} defaultValue={d("workAuthorization")} />
          <SelectField label="Category" name="category" options={CATEGORIES} defaultValue={d("category")} />
          <SelectField label="Employee status" name="status" options={EMPLOYEE_STATUS} placeholder={false} defaultValue={d("status") || "ACTIVE"} />
          <Field label="Classification">
            <div className="flex h-9 items-center gap-4 text-sm">
              {[["BILLABLE", "Billable"], ["NON_BILLABLE", "Non-billable"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input type="radio" name="classification" value={v} defaultChecked={(d("classification") || "BILLABLE") === v} className="accent-brand-600" />
                  {l}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Profile type">
            <div className="flex h-9 items-center gap-4 text-sm">
              {[["WORKER", "Worker"], ["BACK_OFFICE", "Back-office staff"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input type="radio" name="profileType" value={v} defaultChecked={(d("profileType") || "WORKER") === v} className="accent-brand-600" />
                  {l}
                </label>
              ))}
            </div>
          </Field>
          <TextField label="Payroll ID" name="payrollId" defaultValue={d("payrollId")} />
          <TextField label="Worker ID" name="workerId" defaultValue={d("workerId")} />
        </FormSection>

        <FormSection title="Pay & bank" description="Default pay used when no client-specific rate applies.">
          <SelectField label="Pay type" name="payType" options={PAY_TYPES} placeholder={false} defaultValue={d("payType") || "HOURLY"} />
          <TextField label="Default pay rate (USD)" name="defaultPayRate" inputMode="decimal" placeholder="0.00"
            defaultValue={d("defaultPayRate")} error={fe.defaultPayRate} />
          <TextField label="Bank name" name="bankName" defaultValue={d("bankName")} />
          <TextField label="Routing number" name="bankRouting" inputMode="numeric" maxLength={9} defaultValue={d("bankRouting")} error={fe.bankRouting} />
          <TextField label="Account number (last 4)" name="bankAccountLast4" inputMode="numeric" maxLength={4}
            defaultValue={d("bankAccountLast4")} error={fe.bankAccountLast4} hint="Only the last 4 digits are stored." />
        </FormSection>

        {mode === "create" && (
          <FormSection
            title="Assign to client"
            description="Optional. Place this employee at a client now with bill and pay rates. You can also do this later from Placements."
          >
            {clients.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-3">
                <Alert tone="info">
                  No clients yet. <Link href="/clients/new" className="font-medium underline">Add a client</Link> first to assign this employee.
                </Alert>
              </div>
            ) : (
              <>
                <SelectField label="Client" name="placementClientId" options={clients} placeholder="Do not assign now"
                  value={assignClient} onChange={(e) => setAssignClient(e.target.value)} error={fe.placementClientId} />
                {assignClient && (
                  <>
                    <TextField label="Start date" name="placementStart" type="date" required error={fe.placementStart} />
                    <SelectField label="Timesheet frequency" name="placementFrequency" options={FREQUENCIES} placeholder={false}
                      defaultValue={clients.find((c) => c.value === assignClient)?.frequency} />
                    <TextField label="Bill rate / hr (client pays)" name="placementBillRate" inputMode="decimal" required placeholder="0.00" error={fe.placementBillRate} />
                    <TextField label="Pay rate / hr (employee gets)" name="placementPayRate" inputMode="decimal" required placeholder="0.00" error={fe.placementPayRate} />
                    <TextField label="Project name" name="placementProject" />
                    <TextField label="OT bill rate / hr" name="placementOtBillRate" inputMode="decimal" placeholder="0.00" error={fe.placementOtBillRate} />
                    <TextField label="OT pay rate / hr" name="placementOtPayRate" inputMode="decimal" placeholder="0.00" error={fe.placementOtPayRate} />
                    <TextField label="PO number" name="placementPo" />
                  </>
                )}
              </>
            )}
          </FormSection>
        )}

        {mode === "create" && (
          <FormSection title="Portal login" description="The employee uses the portal to submit timesheets and view pay statements.">
            <label className="flex items-start gap-2.5 text-sm sm:col-span-2 xl:col-span-3">
              <input type="checkbox" name="createLogin" checked={createLogin} onChange={(e) => setCreateLogin(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-600" />
              <span>
                <span className="font-medium text-slate-800">Create a user account for this employee</span>
                <span className="block text-slate-500">Login credentials will be sent to the employee’s email.</span>
              </span>
            </label>
            {createLogin && (
              <>
                <SelectField label="System role" name="role" options={USER_ROLES} placeholder={false} defaultValue="EMPLOYEE" error={fe.role} />
                <Field label="How to deliver credentials" className="sm:col-span-1 xl:col-span-2">
                  <div className="space-y-2 text-sm">
                    {[
                      ["INVITE", "Email a secure “set your password” link", "Recommended"],
                      ["TEMP_EMAIL", "Email a temporary password", "Also shown to you once"],
                      ["TEMP_MANUAL", "Don’t email. Show me a temporary password to share manually", ""],
                    ].map(([v, l, h]) => (
                      <label key={v} className="flex items-start gap-2">
                        <input type="radio" name="credentialMode" value={v} defaultChecked={v === "INVITE"} className="mt-0.5 accent-brand-600" />
                        <span>
                          {l}
                          {h && <span className="ml-1.5 text-xs text-slate-500">{h}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>
              </>
            )}
          </FormSection>
        )}

        <FormSection title="Notes">
          <TextAreaField label="Internal notes" name="notes" defaultValue={d("notes")} className="sm:col-span-2 xl:col-span-3" />
        </FormSection>

        <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-5 py-4">
          <LinkButton href={mode === "edit" ? `/employees/${d("id")}` : "/employees"} variant="secondary">
            Cancel
          </LinkButton>
          <SubmitButton>{mode === "create" ? "Register employee" : "Save changes"}</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
