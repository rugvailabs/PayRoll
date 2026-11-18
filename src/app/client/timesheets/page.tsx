import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { requireClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMinutes, frequencyLabel, fullName } from "@/lib/format";

export const metadata: Metadata = { title: "Timesheets" };

const VISIBLE = ["SUBMITTED", "APPROVED", "REJECTED"];

export default async function ClientTimesheetsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireClientUser();
  const { status = "SUBMITTED" } = await searchParams;
  const where = { organizationId: user.organizationId, placement: { clientId: user.client.id } };
  const [counts, timesheets] = await Promise.all([
    db.timesheet.groupBy({ by: ["status"], where: { ...where, status: { in: VISIBLE } }, _count: true }),
    db.timesheet.findMany({
      where: { ...where, status: status === "ALL" ? { in: VISIBLE } : VISIBLE.includes(status) ? status : "SUBMITTED" },
      include: { employee: true, placement: true, _count: { select: { attachments: true } } },
      orderBy: [{ submittedAt: "desc" }],
      take: 300,
    }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader title="Timesheets" subtitle="Hours submitted by your consultants." />
      {!user.client.portalApproval && (
        <div className="mb-4"><Alert tone="info">Timesheets are approved by {user.organization.name}. You can view them here.</Alert></div>
      )}
      <Tabs
        active={status}
        tabs={[
          { key: "SUBMITTED", label: user.client.portalApproval ? "Awaiting my approval" : "Submitted", href: "/client/timesheets", count: countOf("SUBMITTED") },
          { key: "APPROVED", label: "Approved", href: "/client/timesheets?status=APPROVED", count: countOf("APPROVED") },
          { key: "REJECTED", label: "Rejected", href: "/client/timesheets?status=REJECTED", count: countOf("REJECTED") },
          { key: "ALL", label: "All", href: "/client/timesheets?status=ALL" },
        ]}
      />
      <Card>
        {timesheets.length === 0 ? (
          <EmptyState title="No timesheets here" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Consultant</th><th>From</th><th>To</th><th>Submitted</th><th className="text-right">Regular</th><th className="text-right">Overtime</th>
                  <th className="text-right">Total</th><th>Frequency</th><th>Files</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {timesheets.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium text-slate-900">{fullName(t.employee)}</td>
                    <td>{formatDate(t.periodStart)}</td>
                    <td>{formatDate(t.periodEnd)}</td>
                    <td>{formatDate(t.submittedAt)}</td>
                    <td className="text-right tabular-nums">{formatMinutes(t.regularMinutes)}</td>
                    <td className="text-right tabular-nums">{formatMinutes(t.overtimeMinutes)}</td>
                    <td className="text-right font-medium tabular-nums">{formatMinutes(t.totalMinutes)}</td>
                    <td>{frequencyLabel(t.placement.timesheetFrequency)}</td>
                    <td>{t._count.attachments ? `📎 ${t._count.attachments}` : "—"}</td>
                    <td><Badge status={t.status} /></td>
                    <td>
                      <Link href={`/client/timesheets/${t.id}`} className="text-brand-600 hover:underline">
                        {t.status === "SUBMITTED" && user.client.portalApproval ? "Review" : "View"}
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
