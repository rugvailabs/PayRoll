"use client";

import { useActionState } from "react";
import { Alert, Badge, Card, CardHeader, SelectField, TextField } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { manageClientUserAction, type PortalUserState } from "../actions";
import { TempPasswordBox } from "../../employees/temp-password";

type PortalUser = { id: string; name: string; email: string; jobTitle: string | null; isActive: boolean; lastLoginAt: string | null; invited: boolean };

export function PortalUsers({ clientId, users, approverName, approverEmail }: {
  clientId: string; users: PortalUser[]; approverName: string; approverEmail: string;
}) {
  const [state, action] = useActionState<PortalUserState, FormData>(manageClientUserAction, undefined);
  const op = (userId: string, name: string, label: string, variant: "secondary" | "danger" | "success" = "secondary", confirm?: string) => (
    <form action={action}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="op" value={name} />
      <SubmitButton size="sm" variant={variant} confirm={confirm} pendingText="…">{label}</SubmitButton>
    </form>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Client portal logins" subtitle="People at this client who can sign in on the Client tab." />
        {(state?.error || state?.ok) && (
          <div className="space-y-3 px-5 pt-4">
            {state.error ? <Alert tone="error">{state.error}</Alert> : <Alert tone="success">{state.ok}</Alert>}
            {state.tempPassword && <TempPasswordBox password={state.tempPassword} />}
          </div>
        )}
        {users.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No portal logins yet. Add the client&apos;s timesheet approver or billing contact.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Last sign-in</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><span className="font-medium text-slate-900">{u.name}</span>{u.jobTitle && <span className="block text-xs text-slate-500">{u.jobTitle}</span>}</td>
                    <td>{u.email}</td>
                    <td>
                      {!u.isActive ? <Badge status="INACTIVE">Disabled</Badge> : u.lastLoginAt ? <Badge status="ACTIVE">Active</Badge> : <Badge status="SENT">Invited</Badge>}
                    </td>
                    <td className="text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {u.isActive && op(u.id, "invite", "Resend invite")}
                        {u.isActive && op(u.id, "temp-manual", "Temp password", "secondary", "Reset?")}
                        {u.isActive ? op(u.id, "disable", "Disable", "danger", "Disable?") : op(u.id, "enable", "Enable", "success")}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="h-fit">
        <CardHeader title="Add portal login" />
        <form action={action} className="space-y-4 p-5">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="op" value="create" />
          <TextField label="Full name" name="name" required defaultValue={users.length === 0 ? approverName : ""} />
          <TextField label="Email" name="email" type="email" required defaultValue={users.length === 0 ? approverEmail : ""} />
          <TextField label="Job title" name="jobTitle" placeholder="e.g. Engineering Manager" />
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
          <SubmitButton className="w-full" pendingText="Creating…">Create client login</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
