import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Alert, Badge, Card, CardBody, CardHeader, DescList, PageHeader, cn } from "@/components/ui";
import { requireClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateToInput, eachDay, formatDate, formatDateTime, formatMinutes, fullName } from "@/lib/format";
import { ClientReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Timesheet" };

export default async function ClientTimesheetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClientUser();
  const { id } = await params;
  const ts = await db.timesheet.findFirst({
    where: { id, organizationId: user.organizationId, placement: { clientId: user.client.id }, status: { in: ["SUBMITTED", "APPROVED", "REJECTED"] } },
    include: { employee: true, placement: true, entries: true, attachments: { orderBy: { createdAt: "asc" } } },
  });
  if (!ts) notFound();
  const byDay = new Map(ts.entries.map((e) => [dateToInput(e.workDate), e]));
  const days = eachDay(ts.periodStart, ts.periodEnd);

  return (
    <>
      <PageHeader title={`${fullName(ts.employee)}`} subtitle={`Timesheet ${formatDate(ts.periodStart)} – ${formatDate(ts.periodEnd)}`}
        back={{ href: "/client/timesheets", label: "Timesheets" }} />
      {ts.status === "REJECTED" && ts.reviewNote && <div className="mb-4"><Alert tone="error"><b>Rejected:</b> {ts.reviewNote}</Alert></div>}

      <Card className="mb-6">
        <CardBody>
          <DescList items={[
            { label: "Consultant", value: fullName(ts.employee) },
            { label: "Project", value: ts.placement.projectName },
            { label: "Status", value: <Badge status={ts.status} /> },
            { label: "Regular hours", value: formatMinutes(ts.regularMinutes) },
            { label: "Overtime hours", value: formatMinutes(ts.overtimeMinutes) },
            { label: "Total hours", value: <span className="font-semibold">{formatMinutes(ts.totalMinutes)}</span> },
            { label: "Submitted", value: formatDateTime(ts.submittedAt) },
            { label: "Reviewed", value: ts.reviewedAt ? `${formatDateTime(ts.reviewedAt)}${ts.reviewedByName ? ` by ${ts.reviewedByName}` : ""}` : null },
          ]} />
          {ts.employeeNote && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm"><b>Consultant comment:</b> {ts.employeeNote}</p>}
        </CardBody>
      </Card>

      {ts.status === "SUBMITTED" && user.client.portalApproval && <ClientReviewForm id={ts.id} />}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Daily hours" />
          <div className="table-wrap max-h-[560px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0"><tr><th>Date</th><th>Day</th><th className="text-right">Regular</th><th className="text-right">Overtime</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {days.map((d) => {
                  const e = byDay.get(dateToInput(d));
                  const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                  return (
                    <tr key={d.toISOString()} className={cn(weekend && "bg-slate-50/80")}>
                      <td className="font-medium">{d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}</td>
                      <td className="text-slate-500">{d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" })}</td>
                      <td className="text-right tabular-nums">{e?.regularMinutes ? formatMinutes(e.regularMinutes) : "—"}</td>
                      <td className="text-right tabular-nums">{e?.overtimeMinutes ? formatMinutes(e.overtimeMinutes) : "—"}</td>
                      <td className="text-right tabular-nums">{e ? formatMinutes(e.regularMinutes + e.overtimeMinutes) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMinutes(ts.regularMinutes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMinutes(ts.overtimeMinutes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMinutes(ts.totalMinutes)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Attached timesheet" />
          <div className="space-y-2 p-5">
            {ts.attachments.length === 0 && <p className="text-sm text-slate-500">No files attached.</p>}
            {ts.attachments.map((a) => (
              <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank"
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-brand-600 hover:bg-slate-50">
                <Paperclip size={15} className="text-slate-400" />
                <span className="flex-1 truncate">{a.fileName}</span>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
