"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/client";
import { runRemindersNowAction } from "./actions";

export function RunRemindersButton() {
  const [state, action] = useActionState(runRemindersNowAction, undefined);
  return (
    <form action={action} className="flex items-center gap-3">
      {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      <SubmitButton variant="secondary" pendingText="Sending…">Send due reminders now</SubmitButton>
    </form>
  );
}
