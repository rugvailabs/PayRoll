import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, ClipboardCheck, FilePen, Wallet } from "lucide-react";
import { Alert, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, dateToInput, formatDate, formatMinutes, formatMoney, frequencyLabel, periodFor, todayUtc } from "@/lib/format";

export const metadata: Metadata = { title: "My Dashboard" };

export default async function EmployeeDashboard() {
  const user = await requireUser();
  if (!user.employee) redirect("/dashboard");
  const eid = user.employee.id;
  const oid = user.organizationId;
  const today = todayUtc();

  const [placements, timesheets, payslips, notifications] = await Promise.all([
    db.placement.findMany({
      where: { employeeId: eid, organizationId: oid, status: "ACTIVE" },
      include: { client: true, timesheets: { select: { id: true, periodStart: true, status: true } } },
    }),
    db.timesheet.findMany({
      where: { employeeId: eid, organizationId: oid },
      include: { placement: { include: { client: true } } },
      orderBy: { periodStart: "desc" },
      take: 8,
    }),
    db.payslip.findMany({
      where: { employeeId: eid, organizationId: oid, status: "PAID" },
      include: { payrollRun: true },
      orderBy: { paidAt: "desc" },
      take: 12,
    }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const rejected = timesheets.filter((t) => t.status === "REJECTED");
  const drafts = timesheets.filter((t) => t.status === "DRAFT");
  const pending = timesheets.filter((t) => t.status === "SUBMITTED");
  const ytd = payslips.filter((p) => p.payrollRun.payDate.getUTCFullYear() === today.getUTCFullYear()).reduce((a, p) => a + p.grossPay, 0);

  // For each assignment: status of the last completed period and the current one.
  const periods = placements.map((p) => {
    const current = periodFor(p.timesheetFrequency, today);
    const last = periodFor(p.timesheetFrequency, addDays(current.start, -1));
    const find = (d: Date) => p.timesheets.find((t) => dateToInput(t.periodStart) === dateToInput(d));
    return { p, current, last, currentTs: find(current.start), lastTs: last.end >= p.startDate ? find(last.start) : undefined, lastApplies: last.end >= p.startDate };
  });
  const lastDue = periods.filter((x) => x.lastApplies && (!x.lastTs || x.lastTs.status === "DRAFT" || x.lastTs.status === "REJECTED"));

  return (
    <>
      <PageHeader
        title={`Hi ${user.employee.firstName}`}
        subtitle={`${user.organization.name} · Employee ID ${user.employee.employeeCode}`}
        actions={<LinkButton href="/my/timesheets/new">+ Submit timesheet</LinkButton>}
      />

      {lastDue.length > 0 && (
        <div className="mb-4">
          <Alert tone="warning">
            Timesheet due for {lastDue.map((x) => `${x.p.client.name} (${formatDate(x.last.start)} – ${formatDate(x.last.end)})`).join(", ")}.{" "}
            <Link href="/my/timesheets/new" className="font-medium underline">Submit now</Link>
          </Alert>
        </div>
      )}
      {rejected.map((t) => (
        <div key={t.id} className="mb-4">
          <Alert tone="error">
            Timesheet for <b>{t.placement.client.name}</b> ({formatDate(t.periodStart)} – {formatDate(t.periodEnd)}) was rejected
            {t.reviewNote ? `: ${t.reviewNote}` : ""}. <Link href={`/my/timesheets/${t.id}`} className="font-medium underline">Fix and resubmit</Link>
          </Alert>
        </div>
      ))}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current assignments" value={placements.length} hint={placements.map((p) => p.client.name).join(", ") || "Not assigned"} tone="blue" icon={<Briefcase size={18} />} />
        <StatCard label="Awaiting approval" value={pending.length} tone="amber" href="/my/timesheets" icon={<ClipboardCheck size={18} />} />
        <StatCard label="Drafts / rejected" value={drafts.length + rejected.length} tone={drafts.length + rejected.length ? "red" : "green"} href="/my/timesheets" icon={<FilePen size={18} />} />
        <StatCard label="Gross pay this year" value={formatMoney(ytd)} hint={payslips[0] ? `Last paid ${formatDate(payslips[0].payrollRun.payDate)}` : undefined} tone="green" href="/my/payslips" icon={<Wallet size={18} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="My assignments" subtitle="Timesheet status by client" />
          {periods.length === 0 ? (
            <EmptyState title="You are not assigned to a client yet" description="Your administrator will assign you." />
          ) : (
            <div className="divide-y divide-slate-100">
              {periods.map(({ p, current, last, currentTs, lastTs, lastApplies }) => (
                <div key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-48 flex-1">
                    <p className="font-semibold text-slate-900">{p.client.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.projectName ?? p.jobTitle ?? "Assignment"} · {frequencyLabel(p.timesheetFrequency)} timesheets · since {formatDate(p.startDate)}
                    </p>
                  </div>
                  {lastApplies && (
                    <div className="text-sm">
                      <p className="text-xs text-slate-500">Last period ({formatDate(last.start)} – {formatDate(last.end)})</p>
                      {lastTs ? <Badge status={lastTs.status} /> : <Badge status="OVERDUE">Not started</Badge>}
                    </div>
                  )}
                  <div className="text-sm">
                    <p className="text-xs text-slate-500">Current ({formatDate(current.start)} – {formatDate(current.end)})</p>
                    {currentTs ? <Badge status={currentTs.status} /> : <Badge status="DRAFT">Not started</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Notifications" actions={<Link href="/notifications" className="text-sm text-brand-600 hover:underline">All</Link>} />
          {notifications.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <li key={n.id} className="px-5 py-3 text-sm">
                  <p className={n.readAt ? "text-slate-700" : "font-medium text-slate-900"}>{n.title}</p>
                  <p className="text-xs text-slate-500">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Recent timesheets" actions={<Link href="/my/timesheets" className="text-sm text-brand-600 hover:underline">View all</Link>} />
          {timesheets.length === 0 ? (
            <EmptyState title="No timesheets yet" action={<LinkButton href="/my/timesheets/new">+ Submit timesheet</LinkButton>} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Client</th><th>Period</th><th className="text-right">Hours</th><th>Status</th></tr></thead>
                <tbody>
                  {timesheets.map((t) => (
                    <tr key={t.id}>
                      <td><Link href={`/my/timesheets/${t.id}`} className="font-medium hover:text-brand-600">{t.placement.client.name}</Link></td>
                      <td>{formatDate(t.periodStart)} – {formatDate(t.periodEnd)}</td>
                      <td className="text-right tabular-nums">{formatMinutes(t.totalMinutes)}</td>
                      <td><Badge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent pay" actions={<Link href="/my/payslips" className="text-sm text-brand-600 hover:underline">All</Link>} />
          {payslips.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No pay statements yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payslips.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span>
                    <span className="block font-medium text-slate-900">{formatMoney(p.grossPay)}</span>
                    <span className="block text-xs text-slate-500">Paid {formatDate(p.payrollRun.payDate)}</span>
                  </span>
                  <a href={`/api/payslips/${p.id}/pdf`} target="_blank" className="text-brand-600 hover:underline">PDF</a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
