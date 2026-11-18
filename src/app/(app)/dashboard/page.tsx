import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatCard } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import type { Role } from "@/lib/session";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMinutes, formatMoney, fullName, todayUtc } from "@/lib/format";
import { balanceOf, daysOverdue } from "@/lib/finance";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string }> }) {
  const user = await requireUser();
  const { welcome, denied } = await searchParams;
  if (user.role === "EMPLOYEE") redirect("/my");
  const oid = user.organizationId;
  const isStaff = true;

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle={user.organization.name} />
      {welcome && (
        <div className="mb-6">
          <Alert tone="success">
            Your organization is ready. Start by <Link href="/clients/new" className="font-medium underline">adding a client</Link>, then{" "}
            <Link href="/employees/new" className="font-medium underline">add employees</Link> and assign them.
          </Alert>
        </div>
      )}
      {denied && <div className="mb-6"><Alert tone="warning">You do not have access to that page.</Alert></div>}
      {isStaff ? <StaffDashboard oid={oid} role={user.role} /> : null}
      {user.employee && <EmployeePanel employeeId={user.employee.id} oid={oid} compact={isStaff} />}
    </>
  );
}

async function StaffDashboard({ oid, role }: { oid: string; role: Role }) {
  const today = todayUtc();
  const [activeEmployees, activeClients, pendingTs, approvedUninvoiced, openInvoices, recentTs, recentActivity] = await Promise.all([
    db.employee.count({ where: { organizationId: oid, status: "ACTIVE" } }),
    db.client.count({ where: { organizationId: oid, status: "ACTIVE" } }),
    db.timesheet.count({ where: { organizationId: oid, status: "SUBMITTED" } }),
    db.timesheet.count({ where: { organizationId: oid, status: "APPROVED", invoiceId: null } }),
    db.invoice.findMany({ where: { organizationId: oid, status: { in: ["SENT", "PARTIAL"] } }, include: { client: true }, orderBy: { dueDate: "asc" } }),
    db.timesheet.findMany({
      where: { organizationId: oid, status: "SUBMITTED" },
      include: { employee: true, placement: { include: { client: true } } },
      orderBy: { submittedAt: "desc" },
      take: 6,
    }),
    db.auditLog.findMany({ where: { organizationId: oid }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const outstanding = openInvoices.reduce((a, i) => a + balanceOf(i), 0);
  const overdue = openInvoices.filter((i) => daysOverdue(i, today) > 0);
  const overdueAmt = overdue.reduce((a, i) => a + balanceOf(i), 0);
  const over30 = overdue.filter((i) => daysOverdue(i, today) > 30);
  const finance = can(role, "payments.manage");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active employees" value={activeEmployees} tone="blue" href="/employees" />
        <StatCard label="Active clients" value={activeClients} tone="slate" href="/clients" />
        <StatCard label="Timesheets to approve" value={pendingTs} tone={pendingTs ? "amber" : "green"} href={can(role, "timesheets.approve") ? "/timesheets" : undefined} />
        {finance ? (
          <StatCard label="Overdue receivables" value={formatMoney(overdueAmt)} hint={`${overdue.length} invoice(s) · ${formatMoney(outstanding)} outstanding`} tone={overdueAmt ? "red" : "green"} href="/receivables" />
        ) : (
          <StatCard label="Ready to invoice" value={approvedUninvoiced} tone="green" />
        )}
      </div>

      {finance && over30.length > 0 && (
        <Alert tone="error">
          <b>{over30.length} invoice(s)</b> have been unpaid for more than 30 days ({formatMoney(over30.reduce((a, i) => a + balanceOf(i), 0))}).{" "}
          <Link href="/receivables?min=30" className="font-medium underline">View pending aging</Link>
        </Alert>
      )}
      {can(role, "invoices.manage") && approvedUninvoiced > 0 && (
        <Alert tone="info">
          {approvedUninvoiced} approved timesheet(s) are ready to invoice. <Link href="/invoices/new" className="font-medium underline">Create invoice</Link>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Waiting for approval" actions={<Link href="/timesheets" className="text-sm text-brand-600 hover:underline">View all</Link>} />
          {recentTs.length === 0 ? (
            <EmptyState title="All caught up" description="No timesheets are waiting for approval." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Client</th><th>Period</th><th className="text-right">Hours</th><th>Submitted</th></tr></thead>
                <tbody>
                  {recentTs.map((t) => (
                    <tr key={t.id}>
                      <td><Link href={`/timesheets/${t.id}`} className="font-medium text-slate-900 hover:text-brand-600">{fullName(t.employee)}</Link></td>
                      <td>{t.placement.client.name}</td>
                      <td>{formatDate(t.periodStart)} – {formatDate(t.periodEnd)}</td>
                      <td className="text-right tabular-nums">{formatMinutes(t.totalMinutes)}</td>
                      <td>{formatDate(t.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick actions" />
          <div className="grid gap-2 p-5">
            {can(role, "employees.manage") && <LinkButton href="/employees/new" variant="secondary">Add employee</LinkButton>}
            {can(role, "clients.manage") && <LinkButton href="/clients/new" variant="secondary">Add client</LinkButton>}
            {can(role, "placements.manage") && <LinkButton href="/placements/new" variant="secondary">Assign employee to client</LinkButton>}
            {can(role, "timesheets.approve") && <LinkButton href="/timesheets/new" variant="secondary">Enter a timesheet</LinkButton>}
            {can(role, "invoices.manage") && <LinkButton href="/invoices/new" variant="secondary">Create invoice</LinkButton>}
            {can(role, "payroll.manage") && <LinkButton href="/payroll/new" variant="secondary">Run payroll</LinkButton>}
          </div>
        </Card>

        {finance && (
          <Card className="xl:col-span-2">
            <CardHeader title="Overdue client payments" actions={<Link href="/receivables" className="text-sm text-brand-600 hover:underline">Aging report</Link>} />
            {overdue.length === 0 ? (
              <EmptyState title="No overdue payments" />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Client</th><th>Invoice</th><th>Due</th><th className="text-right">Days</th><th className="text-right">Balance</th></tr></thead>
                  <tbody>
                    {overdue.slice(0, 8).map((i) => (
                      <tr key={i.id}>
                        <td className="font-medium text-slate-900">{i.client.name}</td>
                        <td><Link href={`/invoices/${i.id}`} className="text-brand-600 hover:underline">{i.invoiceNumber}</Link></td>
                        <td>{formatDate(i.dueDate)}</td>
                        <td className="text-right font-semibold tabular-nums text-red-600">{daysOverdue(i, today)}</td>
                        <td className="text-right tabular-nums">{formatMoney(balanceOf(i))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card>
          <CardHeader title="Recent activity" />
          <ul className="divide-y divide-slate-100">
            {recentActivity.length === 0 && <li className="p-5 text-sm text-slate-500">No activity yet.</li>}
            {recentActivity.map((a) => (
              <li key={a.id} className="px-5 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{a.action.replace(/_/g, " ").toLowerCase()}</span>{" "}
                <span className="text-slate-600">{a.entity.toLowerCase()}</span>
                {a.details && <span className="text-slate-500"> · {a.details}</span>}
                <span className="block text-xs text-slate-400">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

async function EmployeePanel({ employeeId, oid, compact }: { employeeId: string; oid: string; compact: boolean }) {
  const [timesheets, placements, lastPay] = await Promise.all([
    db.timesheet.findMany({
      where: { employeeId, organizationId: oid },
      include: { placement: { include: { client: true } } },
      orderBy: { periodStart: "desc" },
      take: 5,
    }),
    db.placement.findMany({ where: { employeeId, organizationId: oid, status: "ACTIVE" }, include: { client: true } }),
    db.payslip.findFirst({ where: { employeeId, organizationId: oid, status: "PAID" }, include: { payrollRun: true }, orderBy: { paidAt: "desc" } }),
  ]);
  const needsAction = timesheets.filter((t) => t.status === "DRAFT" || t.status === "REJECTED");
  return (
    <div className={compact ? "mt-8" : ""}>
      {compact && <h2 className="mb-4 text-lg font-semibold">My work</h2>}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Current assignments" value={placements.length} hint={placements.map((p) => p.client.name).join(", ") || "None"} tone="blue" />
        <StatCard label="Timesheets needing action" value={needsAction.length} tone={needsAction.length ? "amber" : "green"} href="/my/timesheets" />
        <StatCard label="Last pay" value={lastPay ? formatMoney(lastPay.grossPay) : "—"} hint={lastPay ? `Paid ${formatDate(lastPay.payrollRun.payDate)}` : undefined} tone="green" href="/my/payslips" />
      </div>
      <Card>
        <CardHeader title="My recent timesheets" actions={<LinkButton href="/my/timesheets/new" size="sm">+ Submit timesheet</LinkButton>} />
        {timesheets.length === 0 ? (
          <EmptyState title="No timesheets yet" />
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
    </div>
  );
}
