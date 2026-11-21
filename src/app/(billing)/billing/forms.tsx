"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { manageBillingAction, startCheckoutAction, type BillingState } from "./actions";

export function CheckoutButton({ provider, label, variant = "primary" }: { provider: string; label: string; variant?: "primary" | "secondary" }) {
  const [state, action] = useActionState<BillingState, FormData>(startCheckoutAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="provider" value={provider} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <SubmitButton variant={variant} size="lg" className="w-full" pendingText="Redirecting to secure checkout…">{label}</SubmitButton>
    </form>
  );
}

export function ManageButton({ op, label, variant = "secondary", confirm }: { op: string; label: string; variant?: "secondary" | "danger"; confirm?: string }) {
  const [state, action] = useActionState<BillingState, FormData>(manageBillingAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="op" value={op} />
      <SubmitButton variant={variant} confirm={confirm} pendingText="Working…">{label}</SubmitButton>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-700">{state.ok}</p>}
    </form>
  );
}
