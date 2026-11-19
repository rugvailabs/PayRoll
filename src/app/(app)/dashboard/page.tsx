import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle, ArrowRight, Briefcase, Building2, CircleDollarSign, ClipboardCheck, Clock, FileText, UserPlus, Users, Wallet,
} from "lucide-react";
import { Alert, Avatar, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatCard } from "@/components/ui";
import { BarList, BillingChart } from "@/components/charts";
import { can, requireUser } from "@/lib/auth";
import type { Role } from "@/lib/session";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMinutes, formatMoney, fullName, todayUtc } from "@/lib/format";
import { AGING_BUCKETS, agingBucket, balanceOf, daysOverdue, type BucketKey } from "@/lib/finance";

export const metadata: Metadata = { title: "Dashboard" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string }> }) {
  const user = await requireUser();
  const { welcome, denied } = await searchParams;
  if (user.role === "EMPLOYEE") redirect("/my");
  const today = todayUtc();

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        subtitle={`${user.organization.name} · ${today.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" })}`}
        actions={
          <>
            {can(user.role, "timesheets.approve") && <LinkButton href="/timesheets" variant="secondary"><ClipboardCheck size={16} /> Review timesheets</LinkButton>}
            {can(user.role, "invoices.manage") && <LinkButton href="/invoices/new"><FileText size={16} /> Create invoice</LinkButton>}
          </>
        }
      />
      {welcome && (
        <div className="mb-6">
          <Alert tone="success">
            Your organization is ready. Start by <Link href="/clients/new" className="font-semibold underline">adding a client</Link>, then{" "}
            <Link href="/employees/new" className="font-semibold underline">add employees</Link> and assign them.
          </Alert>
        </div>
      )}
      {denied && <div className="mb-6"><Alert tone="warning">You do not have access to that page.</Alert></div>}
      <StaffDashboard oid={user.organizationId} role={user.role} />
    </>
  );
}

async function StaffDashboard({ oid, role }: { oid: string; role: Role }) {
  const today = todayUtc();
  const finance = can(role, "payments.manage");
  const sixAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));

  const [activeEmployees, activeClients, pendingTs, approvedUninvoiced, unpaidForPayroll, openInvoices, recentTs, recentActivity, invoices6, payments6] =
    await Promise.all([
      db.employee.count({ where: { organizationId: oid, status: "ACTIVE" } }),
      db.client.count({ where: { organizationId: oid, status: "ACTIVE" } }),
      db.timesheet.count({ where: { organizationId: oid, status: "SUBMITTED" } }),
      db.timesheet.count({ where: { organizationId: oid, status: "APPROVED", invoiceId: null } }),
      db.timesheet.count({ where: { organizationId: oid, status: "APPROVED", payslipId: null } }),
      db.invoice.findMany({ where: { organizationId: oid, status: { in: ["SENT", "PARTIAL"] } }, include: { client: true }, orderBy: { dueDate: "asc" } }),
      db.timesheet.findMany({
        where: { organizationId: oid, status: "SUBMITTED" },
        include: { employee: true, placement: { include: { client: true } } },
        orderBy: { submittedAt: "desc" },
        take: 6,
      }),
      db.auditLog.findMany({ where: { organizationId: oid, NOT: { action: "LOGIN" } }, orderBy: { createdAt: "desc" }, take: 7 }),
      finance ? db.invoice.findMany({ where: { organizationId: oid, status: { not: "VOID" }, issueDate: { gte: sixAgo } }, select: { issueDate: true, total: true, status: true } }) : [],
      finance ? db.payment.findMany({ where: { organizationId: oid, paidOn: { gte: sixAgo } }, select: { paidOn: true, amount: true } }) : [],
    ]);

  const outstanding = openInvoices.reduce((a, i) => a + balanceOf(i), 0);
  const overdue = openInvoices.filter((i) => daysOverdue(i, today) > 0);
  const over30 = overdue.filter((i) => daysOverdue(i, today) > 30);
  const over30Amt = over30.reduce((a, i) => a + balanceOf(i), 0);

  const months = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(Date.UTC(sixAgo.getUTCFullYear(), sixAgo.getUTCMonth() + k, 1));
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const label = d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
    const inMonth = (x: Date) => `${x.getUTCFullYear()}-${x.getUTCMonth()}` === key;
    return {
      label,
      billed: invoices6.filter((i) => i.status !== "DRAFT" && inMonth(i.issueDate)).reduce((a, i) => a + i.total, 0),
      collected: payments6.filter((p) => inMonth(p.paidOn)).reduce((a, p) => a + p.amount, 0),
    };
  });
  const buckets: Record<BucketKey, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const i of openInvoices) buckets[agingBucket(i, today)] += balanceOf(i);

  const quick = [
    can(role, "employees.manage") && { href: "/employees/new", label: "Add employee", icon: <UserPlus size={18} /> },
    can(role, "clients.manage") && { href: "/clients/new", label: "Add client", icon: <Building2 size={18} /> },
    can(role, "placements.manage") && { href: "/placements/new", label: "Assign to client", icon: <Briefcase size={18} /> },
    can(role, "timesheets.approve") && { href: "/timesheets/new", label: "Enter timesheet", icon: <Clock size={18} /> },
    can(role, "invoices.manage") && { href: "/invoices/new", label: "New invoice", icon: <FileText size={18} /> },
    can(role, "payroll.manage") && { href: "/payroll/new", label: "Run payroll", icon: <Wallet size={18} /> },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active employees" value={activeEmployees} hint={`Across ${activeClients} active client(s)`} tone="blue" icon={<Users size={18} />} href="/employees" />
        <StatCard
          label="Pending approvals"
          value={pendingTs}
          hint={pendingTs ? "Timesheets waiting for review" : "All timesheets reviewed"}
          tone={pendingTs ? "amber" : "green"}
          icon={<ClipboardCheck size={18} />}
          href={can(role, "timesheets.approve") ? "/timesheets" : undefined}
        />
        {finance ? (
          <>
            <StatCard label="Outstanding receivables" value={formatMoney(outstanding)} hint={`${openInvoices.length} open invoice(s)`} tone="slate" icon={<CircleDollarSign size={18} />} href="/receivables" />
            <StatCard
              label="Unpaid over 30 days"
              value={formatMoney(over30Amt)}
              hint={over30.length ? `${over30.length} invoice(s) need follow-up` : "No long-overdue invoices"}
              tone={over30Amt ? "red" : "green"}
              icon={<AlertTriangle size={18} />}
              href="/receivables?min=30"
            />
          </>
        ) : (
          <>
            <StatCard label="Ready to invoice" value={approvedUninvoiced} tone="green" icon={<FileText size={18} />} />
            <StatCard label="Active clients" value={activeClients} tone="slate" icon={<Building2 size={18} />} href="/clients" />
          </>
        )}
      </div>

      {(approvedUninvoiced > 0 && can(role, "invoices.manage")) || (unpaidForPayroll > 0 && can(role, "payroll.manage")) ? (
        <div className="grid gap-3 md:grid-cols-2">
          {approvedUninvoiced > 0 && can(role, "invoices.manage") && (
            <Link href="/invoices/new" className="group flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm transition hover:border-brand-200">
              <span className="text-brand-800"><b>{approvedUninvoiced}</b> approved timesheet(s) ready to invoice</span>
              <ArrowRight size={16} className="text-brand-600 transition group-hover:translate-x-0.5" />
            </Link>
          )}
          {unpaidForPayroll > 0 && can(role, "payroll.manage") && (
            <Link href="/payroll/new" className="group flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm transition hover:border-emerald-200">
              <span className="text-emerald-800"><b>{unpaidForPayroll}</b> approved timesheet(s) waiting for payroll</span>
              <ArrowRight size={16} className="text-emerald-600 transition group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      ) : null}

      {finance && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Billing & collections" subtitle="Invoiced vs. payments received, last 6 months" />
            <div className="px-5 pb-4 pt-4"><BillingChart data={months} /></div>
          </Card>
          <Card>
            <CardHeader title="Receivables aging" subtitle="Open balance by days past due" actions={<Link href="/receivables" className="text-[13px] font-medium text-brand-600 hover:underline">Details</Link>} />
            <div className="p-5">
              <BarList rows={AGING_BUCKETS.map((b) => ({ label: b.label, value: buckets[b.key], emphasis: b.key !== "current" && b.key !== "1-30" }))} />
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                <span className="text-slate-500">Total outstanding</span>
                <span className="font-semibold tabular-nums text-slate-900">{formatMoney(outstanding)}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Waiting for approval" subtitle="Most recent submissions" actions={<Link href="/timesheets" className="text-[13px] font-medium text-brand-600 hover:underline">View all</Link>} />
          {recentTs.length === 0 ? (
            <EmptyState title="All caught up" description="No timesheets are waiting for approval." icon={<ClipboardCheck size={22} />} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Client</th><th>Period</th><th className="text-right">Hours</th><th>Submitted</th></tr></thead>
                <tbody>
                  {recentTs.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/timesheets/${t.id}`} className="flex items-center gap-2.5 font-medium text-slate-900 hover:text-brand-600">
                          <Avatar name={fullName(t.employee)} size="sm" /> {fullName(t.employee)}
                        </Link>
                      </td>
                      <td>{t.placement.client.name}</td>
                      <td>{formatDate(t.periodStart)} – {formatDate(t.periodEnd)}</td>
                      <td className="text-right font-medium tabular-nums">{formatMinutes(t.totalMinutes)}</td>
                      <td className="text-slate-500">{formatDate(t.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick actions" />
          <div className="grid grid-cols-2 gap-2 p-4">
            {quick.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="group flex flex-col items-start gap-2.5 rounded-lg border border-slate-200 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition group-hover:bg-brand-100 group-hover:text-brand-700">{q.icon}</span>
                <span className="text-[13px] font-medium text-slate-800">{q.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {finance && (
          <Card className="xl:col-span-2">
            <CardHeader title="Overdue client payments" subtitle="Oldest first" actions={<Link href="/receivables" className="text-[13px] font-medium text-brand-600 hover:underline">Aging report</Link>} />
            {overdue.length === 0 ? (
              <EmptyState title="No overdue payments" description="Every client is paid up to date." icon={<CircleDollarSign size={22} />} />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Client</th><th>Invoice</th><th>Due date</th><th className="text-right">Days overdue</th><th className="text-right">Balance</th></tr></thead>
                  <tbody>
                    {overdue.slice(0, 6).map((i) => {
                      const d = daysOverdue(i, today);
                      return (
                        <tr key={i.id}>
                          <td className="font-medium text-slate-900">{i.client.name}</td>
                          <td><Link href={`/invoices/${i.id}`} className="font-medium text-brand-600 hover:underline">{i.invoiceNumber}</Link></td>
                          <td>{formatDate(i.dueDate)}</td>
                          <td className="text-right">
                            <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${d > 30 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{d}d</span>
                          </td>
                          <td className="text-right font-semibold tabular-nums text-slate-900">{formatMoney(balanceOf(i))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card className={finance ? "" : "xl:col-span-3"}>
          <CardHeader title="Recent activity" />
          {recentActivity.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ol className="relative px-5 py-4">
              <span className="absolute bottom-6 left-[27px] top-6 w-px bg-slate-200" aria-hidden />
              {recentActivity.map((a) => (
                <li key={a.id} className="relative flex gap-3 py-2">
                  <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
                  <div className="min-w-0 text-[13px]">
                    <p className="text-slate-800">
                      <span className="font-medium capitalize">{a.action.replace(/_/g, " ").toLowerCase()}</span>{" "}
                      <span className="text-slate-500">{a.entity.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}</span>
                      {a.details && <span className="text-slate-500"> · {a.details}</span>}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
