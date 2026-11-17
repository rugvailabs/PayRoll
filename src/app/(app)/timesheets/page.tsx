import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, Tabs } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, dateToInput, formatDate, formatMinutes, frequencyLabel, fullName, periodFor, todayUtc } from "@/lib/format";
import { bulkApproveAction } from "./actions";

export const metadata: Metadata = { title: "Timesheets" };

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; approved?: string }>;
}) {
  const user = await requirePermission("timesheets.approve");
  const oid = user.organizationId;
  const { status = "SUBMITTED", client = "", approved } = await searchParams;

  const [counts, clients] = await Promise.all([
    db.timesheet.groupBy({ by: ["status"], where: { organizationId: oid }, _count: true }),
    db.client.findMany({ where: { organizationId: oid }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const qs = (s: string) => `/timesheets?status=${s}${client ? `&client=${client}` : ""}`;

  // "Missing": active placements whose last completed period has no submitted/approved timesheet.
  let missing: { key: string; employeeId: string; name: string; code: string; client: string; start: Date; end: Date; frequency: string; status?: string }[] = [];
  if (status === "MISSING") {
    const placements = await db.placement.findMany({
      where: { organizationId: oid, status: "ACTIVE", employee: { status: "ACTIVE" }, ...(client ? { clientId: client } : {}) },
      include: { employee: true, client: true, timesheets: true },
    });
    for (const p of placements) {
      const current = periodFor(p.timesheetFrequency, todayUtc());
      const last = periodFor(p.timesheetFrequency, addDays(current.start, -1));
      if (last.end < p.startDate) continue;
      const ts = p.timesheets.find((t) => dateToInput(t.periodStart) === dateToInput(last.start));
      if (!ts || ts.status === "DRAFT" || ts.status === "REJECTED") {
        missing.push({
          key: p.id, employeeId: p.employeeId, name: fullName(p.employee), code: p.employee.employeeCode,
          client: p.client.name, start: last.start, end: last.end, frequency: p.timesheetFrequency, status: ts?.status,
        });
      }
    }
    missing = missing.sort((a, b) => a.name.localeCompare(b.name));
  }

  const timesheets =
    status === "MISSING"
      ? []
      : await db.timesheet.findMany({
          where: {
            organizationId: oid,
            ...(status !== "ALL" ? { status } : {}),
            ...(client ? { placement: { clientId: client } } : {}),
          },
          include: { employee: true, placement: { include: { client: true } }, _count: { select: { attachments: true } } },
          orderBy: [{ submittedAt: "desc" }, { periodStart: "desc" }],
          take: 300,
        });

  return (
    <>
      <PageHeader
        title="Timesheets"
        subtitle="Review submitted timesheets and approve them for invoicing and payroll."
        actions={<LinkButton href="/timesheets/new" variant="secondary">+ Enter timesheet</LinkButton>}
      />
      {approved && <div className="mb-4"><Alert tone="success">{approved} timesheet(s) approved.</Alert></div>}
      <Tabs
        active={status}
        tabs={[
          { key: "SUBMITTED", label: "Pending approval", href: qs("SUBMITTED"), count: countOf("SUBMITTED") },
          { key: "APPROVED", label: "Approved", href: qs("APPROVED"), count: countOf("APPROVED") },
          { key: "REJECTED", label: "Rejected", href: qs("REJECTED"), count: countOf("REJECTED") },
          { key: "DRAFT", label: "Drafts", href: qs("DRAFT"), count: countOf("DRAFT") },
          { key: "MISSING", label: "Missing", href: qs("MISSING") },
          { key: "ALL", label: "All", href: qs("ALL") },
        ]}
      />
      <Card>
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <input type="hidden" name="status" value={status} />
          <select name="client" defaultValue={client} className="control max-w-64">
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">Filter</button>
        </form>

        {status === "MISSING" ? (
          missing.length === 0 ? (
            <EmptyState title="Nothing missing" description="Every active placement has submitted its last completed period." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Employee ID</th><th>Client</th><th>From</th><th>To</th><th>Frequency</th><th>State</th></tr></thead>
                <tbody>
                  {missing.map((m) => (
                    <tr key={m.key}>
                      <td><Link href={`/employees/${m.employeeId}?tab=timesheets`} className="font-medium hover:text-brand-600">{m.name}</Link></td>
                      <td className="font-mono text-xs">{m.code}</td>
                      <td>{m.client}</td>
                      <td>{formatDate(m.start)}</td>
                      <td>{formatDate(m.end)}</td>
                      <td>{frequencyLabel(m.frequency)}</td>
                      <td>{m.status ? <Badge status={m.status} /> : <Badge status="OVERDUE">Not started</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : timesheets.length === 0 ? (
          <EmptyState title="No timesheets" description={status === "SUBMITTED" ? "Nothing is waiting for approval." : undefined} />
        ) : (
          <form action={bulkApproveAction}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {status === "SUBMITTED" && <th className="w-8" />}
                    <th>Employee name</th><th>From date</th><th>To date</th><th>Submitted on</th>
                    <th className="text-right">Total hours</th><th className="text-right">Billable hours</th>
                    <th>Status</th><th>Client</th><th>Frequency</th><th>Employee ID</th><th>Files</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.map((t) => (
                    <tr key={t.id}>
                      {status === "SUBMITTED" && (
                        <td><input type="checkbox" name="ids" value={t.id} className="h-4 w-4 accent-brand-600" aria-label="Select" /></td>
                      )}
                      <td><Link href={`/timesheets/${t.id}`} className="font-medium text-slate-900 hover:text-brand-600">{fullName(t.employee)}</Link></td>
                      <td>{formatDate(t.periodStart)}</td>
                      <td>{formatDate(t.periodEnd)}</td>
                      <td>{formatDate(t.submittedAt)}</td>
                      <td className="text-right tabular-nums">{formatMinutes(t.totalMinutes)}</td>
                      <td className="text-right tabular-nums">{formatMinutes(t.billableMinutes)}</td>
                      <td><Badge status={t.status} /></td>
                      <td>{t.placement.client.name}</td>
                      <td>{frequencyLabel(t.placement.timesheetFrequency)}</td>
                      <td className="font-mono text-xs">{t.employee.employeeCode}</td>
                      <td>{t._count.attachments ? `📎 ${t._count.attachments}` : <span className="text-red-500">None</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {status === "SUBMITTED" && (
              <div className="flex justify-end border-t border-slate-100 p-4">
                <SubmitButton variant="success" pendingText="Approving…">Approve selected</SubmitButton>
              </div>
            )}
          </form>
        )}
      </Card>
    </>
  );
}
