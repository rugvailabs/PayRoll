"use client";

import { useActionState } from "react";
import { Alert, Card, CardHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { reviewTimesheetAction, type TsState } from "./actions";

export function ReviewPanel({ id, status, locked }: { id: string; status: string; locked: boolean }) {
  const [state, action] = useActionState<TsState, FormData>(reviewTimesheetAction, undefined);
  return (
    <Card className="mb-6 border-brand-200">
      <CardHeader title="Review" subtitle={status === "SUBMITTED" ? "Check the hours against the attached client-approved sheet." : undefined} />
      <form action={action} className="space-y-3 p-5">
        <input type="hidden" name="id" value={id} />
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        {state?.ok && <Alert tone="success">{state.ok}</Alert>}
        {status === "SUBMITTED" && (
          <>
            <textarea name="reviewNote" placeholder="Note to employee (required when rejecting)" className="control min-h-16" />
            <div className="flex flex-wrap gap-2">
              <SubmitButton name="decision" value="approve" variant="success" pendingText="Approving…">Approve</SubmitButton>
              <SubmitButton name="decision" value="reject" variant="danger" pendingText="Rejecting…">Reject</SubmitButton>
            </div>
          </>
        )}
        {status === "APPROVED" && (
          locked ? (
            <p className="text-sm text-slate-600">Approved and already included on an invoice or payroll.</p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">Approved. Ready to invoice and pay.</p>
              <SubmitButton name="decision" value="reopen" variant="secondary" size="sm" confirm="Move back to draft?">Reopen</SubmitButton>
            </div>
          )
        )}
      </form>
    </Card>
  );
}
