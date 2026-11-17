import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMinutes, frequencyLabel } from "@/lib/format";

export const metadata: Metadata = { title: "My Timesheets" };

export default async function MyTimesheetsPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const user = await requireUser();
  if (!user.employee) redirect("/dashboard");
  const { submitted } = await searchParams;
  const timesheets = await db.timesheet.findMany({
    where: { employeeId: user.employee.id, organizationId: user.organizationId },
    include: { placement: { include: { client: true } } },
    orderBy: { periodStart: "desc" },
  });
  return (
    <>
      <PageHeader title="My timesheets" subtitle="Enter hours, attach the client-approved sheet and submit for approval."
        actions={<LinkButton href="/my/timesheets/new">+ Submit timesheet</LinkButton>} />
      {submitted && <div className="mb-4"><Alert tone="success">Timesheet submitted. You will be notified when it is reviewed.</Alert></div>}
      <Card>
        {timesheets.length === 0 ? (
          <EmptyState title="No timesheets yet" description="Start your first timesheet for the current period."
            action={<LinkButton href="/my/timesheets/new">+ Submit timesheet</LinkButton>} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Client</th><th>From</th><th>To</th><th>Frequency</th><th>Submitted</th><th className="text-right">Total hours</th><th>Status</th><th /></tr></thead>
              <tbody>
                {timesheets.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium text-slate-900">{t.placement.client.name}</td>
                    <td>{formatDate(t.periodStart)}</td>
                    <td>{formatDate(t.periodEnd)}</td>
                    <td>{frequencyLabel(t.placement.timesheetFrequency)}</td>
                    <td>{formatDate(t.submittedAt)}</td>
                    <td className="text-right tabular-nums">{formatMinutes(t.totalMinutes)}</td>
                    <td><Badge status={t.status} /></td>
                    <td>
                      <Link href={`/my/timesheets/${t.id}`} className="text-brand-600 hover:underline">
                        {t.status === "DRAFT" || t.status === "REJECTED" ? "Edit" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
