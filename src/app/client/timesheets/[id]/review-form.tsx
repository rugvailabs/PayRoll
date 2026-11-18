"use client";

import { useActionState } from "react";
import { Alert, Card, CardHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { clientReviewAction, type ClientState } from "../../actions";

export function ClientReviewForm({ id }: { id: string }) {
  const [state, action] = useActionState<ClientState, FormData>(clientReviewAction, undefined);
  if (state?.ok) {
    return (
      <Card className="mb-6 border-emerald-200">
        <div className="p-5"><Alert tone="success">{state.ok}</Alert></div>
      </Card>
    );
  }
  return (
    <Card className="mb-6 border-brand-200">
      <CardHeader title="Your approval" subtitle="Please confirm the hours below are correct." />
      <form action={action} className="space-y-3 p-5">
        <input type="hidden" name="id" value={id} />
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <textarea name="reviewNote" placeholder="Comment (required if rejecting)" className="control min-h-16" />
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="decision" value="approve" variant="success" pendingText="Approving…">Approve hours</SubmitButton>
          <SubmitButton name="decision" value="reject" variant="danger" pendingText="Rejecting…">Reject</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
