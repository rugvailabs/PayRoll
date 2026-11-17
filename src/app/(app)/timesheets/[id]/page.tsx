import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { fullName } from "@/lib/format";
import { EDITABLE_STATUSES } from "@/lib/timesheets";
import { TimesheetEditor } from "../editor";
import { ReviewPanel } from "../review-panel";
import { editorAttachments, editorDays, TIMESHEET_INCLUDE, TimesheetSummary } from "../view";

export const metadata: Metadata = { title: "Timesheet" };

export default async function TimesheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const user = await requirePermission("timesheets.approve");
  const { id } = await params;
  const { done } = await searchParams;
  const ts = await db.timesheet.findFirst({ where: { id, organizationId: user.organizationId }, include: TIMESHEET_INCLUDE });
  if (!ts) notFound();
  const editable = EDITABLE_STATUSES.includes(ts.status);

  return (
    <>
      <PageHeader title={`${fullName(ts.employee)} · ${ts.placement.client.name}`} subtitle="Timesheet"
        back={{ href: "/timesheets", label: "Timesheets" }} />
      {done === "approve" && <div className="mb-4"><Alert tone="success">Timesheet saved and approved.</Alert></div>}
      {ts.status === "REJECTED" && ts.reviewNote && <div className="mb-4"><Alert tone="error"><b>Rejected:</b> {ts.reviewNote}</Alert></div>}
      {ts.invoiceId && (
        <div className="mb-4"><Alert tone="info">Included on <Link className="font-medium underline" href={`/invoices/${ts.invoiceId}`}>an invoice</Link>.</Alert></div>
      )}
      <TimesheetSummary ts={ts} />
      {(ts.status === "SUBMITTED" || ts.status === "APPROVED") && (
        <ReviewPanel id={ts.id} status={ts.status} locked={!!(ts.invoiceId || ts.payslipId)} />
      )}
      <TimesheetEditor
        id={ts.id}
        days={editorDays(ts)}
        editable={editable}
        canApprove
        note={ts.employeeNote ?? ""}
        attachments={editorAttachments(ts)}
      />
    </>
  );
}
