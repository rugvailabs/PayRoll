"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, TextField } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import {
  changePasswordAction,
  loginAction,
  setPasswordAction,
  signupAction,
  type FormState,
} from "./actions";

const PORTALS = [
  { key: "admin", label: "Admin", title: "Admin & staff sign in", hint: "Manage employees, clients, timesheets, invoices and payroll." },
  { key: "employee", label: "Employee", title: "Employee sign in", hint: "Submit timesheets and download your pay statements." },
  { key: "client", label: "Client", title: "Client sign in", hint: "Review consultants' timesheets, invoices and payments." },
] as const;

export function LoginForm({ next, initialPortal, inactive }: { next?: string; initialPortal?: string; inactive?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, undefined);
  const [portal, setPortal] = useState<string>(PORTALS.some((p) => p.key === initialPortal) ? initialPortal! : "admin");
  const current = PORTALS.find((p) => p.key === portal)!;
  return (
    <>
      <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
        {PORTALS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={portal === p.key}
            onClick={() => setPortal(p.key)}
            className={
              "rounded-lg py-2 text-sm font-medium transition " +
              (portal === p.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-800")
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      <h1 className="text-2xl font-semibold text-slate-900">{current.title}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">{current.hint}</p>
      <form action={action} className="space-y-4">
        {inactive && !state && <Alert tone="warning">Your access is disabled. Contact the administrator.</Alert>}
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <input type="hidden" name="next" value={next ?? ""} />
        <input type="hidden" name="portal" value={portal} />
        <TextField label="Email" name="email" type="email" autoComplete="email" required autoFocus />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
        <TextField
          label="Company code"
          name="company"
          placeholder="Optional"
          hint="Only needed if your email is used by more than one company."
          error={state?.fieldErrors?.company}
        />
        <SubmitButton className="w-full" size="lg" pendingText="Signing in…">
          Sign in as {current.label.toLowerCase()}
        </SubmitButton>
        {portal === "admin" ? (
          <p className="text-center text-sm text-slate-500">
            New organization?{" "}
            <Link href="/signup" className="font-medium text-brand-600 hover:underline">Create an account</Link>
          </p>
        ) : (
          <p className="text-center text-sm text-slate-500">
            No login yet? Your {portal === "client" ? "account manager" : "administrator"} sends you an invite by email.
          </p>
        )}
      </form>
    </>
  );
}

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(signupAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <TextField label="Company name" name="orgName" required error={fe.orgName} autoFocus />
      <TextField label="Your full name" name="name" required error={fe.name} />
      <TextField label="Work email" name="email" type="email" required error={fe.email} />
      <TextField
        label="Password"
        name="password"
        type="password"
        required
        error={fe.password}
        hint="At least 8 characters with letters and numbers."
      />
      <SubmitButton className="w-full" size="lg" pendingText="Creating…">
        Create organization
      </SubmitButton>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(setPasswordAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <TextField label="New password" name="password" type="password" required error={fe.password} autoFocus
        hint="At least 8 characters with letters and numbers." />
      <TextField label="Confirm password" name="confirm" type="password" required error={fe.confirm} />
      <SubmitButton className="w-full" size="lg">Set password &amp; sign in</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <TextField label="Current / temporary password" name="current" type="password" required error={fe.current} autoFocus />
      <TextField label="New password" name="password" type="password" required error={fe.password}
        hint="At least 8 characters with letters and numbers." />
      <TextField label="Confirm new password" name="confirm" type="password" required error={fe.confirm} />
      <SubmitButton className="w-full" size="lg">Update password</SubmitButton>
    </form>
  );
}
