import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CircleDollarSign, ClipboardCheck, Users } from "lucide-react";
import { Alert, Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMinutes, formatMoney, fullName, todayUtc } from "@/lib/format";
import { balanceOf, daysOverdue, displayStatus } from "@/lib/finance";

export const metadata: Metadata = { title: "Client Dashboard" };

export default async function ClientDashboard() {
  const user = await requireClientUser();
  const cid = user.client.id;
  const oid = user.organizationId;
  const today = todayUtc();

  const [placements, pending, invoices, payments] = await Promise.all([
    db.placement.findMany({
      where: { organizationId: oid, clientId: cid, status: "ACTIVE" },
      include: { employee: { include: { jobTitle: true } } },
      orderBy: { startDate: "desc" },
    }),
    db.timesheet.findMany({
      where: { organizationId: oid, status: "SUBMITTED", placement: { clientId: cid } },
      include: { employee: true },
      orderBy: { submittedAt: "asc" },
    }),
    db.invoice.findMany({
      where: { organizationId: oid, clientId: cid, status: { in: ["SENT", "PARTIAL", "PAID"] } },
      orderBy: { issueDate: "desc" },
    }),
    db.payment.findMany({ where: { organizationId: oid, clientId: cid }, orderBy: { paidOn: "desc" }, take: 5, include: { invoice: { select: { invoiceNumber: true } } } }),
  ]);
  const open = invoices.filter((i) => i.status === "SENT" || i.status === "PARTIAL");
  const outstanding = open.reduce((a, i) => a + balanceOf(i), 0);
  const overdue = open.filter((i) => daysOverdue(i, today) > 0);
  const overdueAmt = overdue.reduce((a, i) => a + balanceOf(i), 0);
  const nextDue = open.filter((i) => daysOverdue(i, today) === 0).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle={`${user.client.name} · services by ${user.organization.name}`} />

      {user.client.portalApproval && pending.length > 0 && (
        <div className="mb-4">
          <Alert tone="info">
            <b>{pending.length} timesheet(s)</b> are waiting for your approval.{" "}
            <Link href="/client/timesheets" className="font-medium underline">Review now</Link>
          </Alert>
        </div>
      )}
      {overdue.length > 0 && (
        <div className="mb-4">
          <Alert tone="error">
            {overdue.length} invoice(s) totaling <b>{formatMoney(overdueAmt)}</b> are past due.{" "}
            <Link href="/client/payments" className="font-medium underline">View balance</Link>
          </Alert>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active consultants" value={placements.length} tone="blue" href="/client/employees" icon={<Users size={18} />} />
        <StatCard label="Timesheets to review" value={pending.length} tone={pending.length ? "amber" : "green"} href="/client/timesheets" icon={<ClipboardCheck size={18} />} />
        <StatCard label="Outstanding balance" value={formatMoney(outstanding)} hint={nextDue ? `Next due ${formatDate(nextDue.dueDate)}` : undefined} tone="slate" href="/client/payments" icon={<CircleDollarSign size={18} />} />
        <StatCard label="Past due" value={formatMoney(overdueAmt)} tone={overdueAmt ? "red" : "green"} href="/client/payments" icon={<AlertTriangle size={18} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Timesheets awaiting review" actions={<Link href="/client/timesheets" className="text-sm text-brand-600 hover:underline">All timesheets</Link>} />
          {pending.length === 0 ? (
            <EmptyState title="Nothing to review" description="New timesheets from your consultants will appear here." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Consultant</th><th>Period</th><th className="text-right">Hours</th><th>Submitted</th><th /></tr></thead>
                <tbody>
                  {pending.map((t) => (
                    <tr key={t.id}>
                      <td className="font-medium text-slate-900">{fullName(t.employee)}</td>
                      <td>{formatDate(t.periodStart)} – {formatDate(t.periodEnd)}</td>
                      <td className="text-right tabular-nums">{formatMinutes(t.totalMinutes)}</td>
                      <td>{formatDate(t.submittedAt)}</td>
                      <td><Link href={`/client/timesheets/${t.id}`} className="text-brand-600 hover:underline">{user.client.portalApproval ? "Review" : "View"}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Our consultants" actions={<Link href="/client/employees" className="text-sm text-brand-600 hover:underline">All</Link>} />
          {placements.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No active consultants.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {placements.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={fullName(p.employee)} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{fullName(p.employee)}</span>
                    <span className="block truncate text-xs text-slate-500">{p.jobTitle ?? p.employee.jobTitle?.name ?? "Consultant"} · since {formatDate(p.startDate)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Recent invoices" actions={<Link href="/client/invoices" className="text-sm text-brand-600 hover:underline">All invoices</Link>} />
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th className="text-right">Amount</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
                <tbody>
                  {invoices.slice(0, 6).map((i) => (
                    <tr key={i.id}>
                      <td><Link href={`/client/invoices/${i.id}`} className="font-medium text-slate-900 hover:text-brand-600">{i.invoiceNumber}</Link></td>
                      <td>{formatDate(i.issueDate)}</td>
                      <td>{formatDate(i.dueDate)}</td>
                      <td className="text-right tabular-nums">{formatMoney(i.total)}</td>
                      <td className="text-right tabular-nums">{formatMoney(balanceOf(i))}</td>
                      <td><Badge status={displayStatus(i) === "ON_HOLD" ? "SENT" : displayStatus(i)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent payments" />
          {payments.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between px-5 py-3 text-sm">
                  <span>
                    <span className="block font-medium text-slate-900">{p.invoice.invoiceNumber}</span>
                    <span className="block text-xs text-slate-500">{formatDate(p.paidOn)} · {p.method}</span>
                  </span>
                  <span className="font-medium tabular-nums text-emerald-700">{formatMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
