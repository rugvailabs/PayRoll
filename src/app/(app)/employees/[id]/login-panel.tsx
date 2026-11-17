"use client";

import { useActionState } from "react";
import { Alert, SelectField } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { USER_ROLES } from "@/lib/options";
import { manageLoginAction, type EmployeeFormState } from "../actions";
import { TempPasswordBox } from "../temp-password";

export function LoginPanel({
  employeeId,
  user,
  isSelf,
}: {
  employeeId: string;
  user: null | { email: string; role: string; isActive: boolean; hasPassword: boolean; lastLoginAt: string | null; inviteExpires: string | null };
  isSelf: boolean;
}) {
  const [state, action] = useActionState<EmployeeFormState, FormData>(manageLoginAction, undefined);

  const result = (
    <>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      {state?.tempPassword && <TempPasswordBox password={state.tempPassword} />}
    </>
  );

  if (!user) {
    return (
      <div className="space-y-4">
        {result}
        <p className="text-sm text-slate-600">This employee does not have a portal login yet.</p>
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={employeeId} />
          <input type="hidden" name="op" value="create" />
          <SelectField label="System role" name="role" options={USER_ROLES} placeholder={false} defaultValue="EMPLOYEE" />
          <SelectField
            label="Deliver credentials"
            name="credentialMode"
            placeholder={false}
            options={[
              { value: "INVITE", label: "Email a set-password link (recommended)" },
              { value: "TEMP_EMAIL", label: "Email a temporary password" },
              { value: "TEMP_MANUAL", label: "Show temporary password (share manually)" },
            ]}
          />
          <SubmitButton className="w-full" pendingText="Creating…">Create login</SubmitButton>
        </form>
      </div>
    );
  }

  const statusText = !user.isActive
    ? "Disabled"
    : user.lastLoginAt
      ? `Last sign-in ${new Date(user.lastLoginAt).toLocaleString()}`
      : user.hasPassword
        ? "Credentials sent – not signed in yet"
        : user.inviteExpires
          ? `Invite pending (expires ${new Date(user.inviteExpires).toLocaleDateString()})`
          : "Invite not sent";

  const op = (name: string, label: string, variant: "secondary" | "danger" | "success" = "secondary", confirm?: string) => (
    <form action={action}>
      <input type="hidden" name="id" value={employeeId} />
      <input type="hidden" name="op" value={name} />
      <SubmitButton variant={variant} size="sm" className="w-full" pendingText="Working…" confirm={confirm}>
        {label}
      </SubmitButton>
    </form>
  );

  return (
    <div className="space-y-4">
      {result}
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-medium text-slate-800">{user.email}</p>
        <p className="text-slate-500">{statusText}</p>
      </div>
      {user.isActive && (
        <div className="grid gap-2">
          {op("invite", "Resend invite email")}
          {op("temp-email", "Email new temporary password", "secondary", "Reset password?")}
          {op("temp-manual", "Generate password to share manually", "secondary", "Reset password?")}
        </div>
      )}
      <form action={action} className="flex items-end gap-2">
        <input type="hidden" name="id" value={employeeId} />
        <input type="hidden" name="op" value="role" />
        <SelectField label="Role" name="role" options={USER_ROLES} placeholder={false} defaultValue={user.role} className="flex-1" disabled={isSelf} />
        {!isSelf && <SubmitButton size="md" variant="secondary">Update</SubmitButton>}
      </form>
      {!isSelf && (user.isActive ? op("disable", "Disable login", "danger", "Disable access?") : op("enable", "Enable login", "success"))}
    </div>
  );
}
