import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Alert, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EDITABLE_STATUSES } from "@/lib/timesheets";
import { TimesheetEditor } from "../../../timesheets/editor";
import { editorAttachments, editorDays, TIMESHEET_INCLUDE, TimesheetSummary } from "../../../timesheets/view";

export const metadata: Metadata = { title: "Timesheet" };

export default async function MyTimesheetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user.employee) redirect("/dashboard");
  const { id } = await params;
  const ts = await db.timesheet.findFirst({
    where: { id, organizationId: user.organizationId, employeeId: user.employee.id },
    include: TIMESHEET_INCLUDE,
  });
  if (!ts) notFound();
  const editable = EDITABLE_STATUSES.includes(ts.status);
  return (
    <>
      <PageHeader title={`Timesheet · ${ts.placement.client.name}`} back={{ href: "/my/timesheets", label: "My timesheets" }} />
      {ts.status === "REJECTED" && ts.reviewNote && (
        <div className="mb-4"><Alert tone="error"><b>Rejected:</b> {ts.reviewNote}. Please correct and resubmit.</Alert></div>
      )}
      {ts.status === "SUBMITTED" && <div className="mb-4"><Alert tone="info">Submitted and waiting for approval.</Alert></div>}
      <TimesheetSummary ts={ts} />
      <TimesheetEditor
        id={ts.id}
        days={editorDays(ts)}
        editable={editable}
        canApprove={false}
        note={ts.employeeNote ?? ""}
        attachments={editorAttachments(ts)}
      />
    </>
  );
}
