"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, TextField } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import {
  changePasswordAction,
  loginAction,
  setPasswordAction,
  signupAction,
  type FormState,
} from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
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
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-slate-500">
        New organization?{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
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
