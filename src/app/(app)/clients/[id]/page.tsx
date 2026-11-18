import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Alert, Avatar, Badge, Card, CardBody, CardHeader, DescList, EmptyState, LinkButton, PageHeader, StatCard, Tabs,
} from "@/components/ui";
import { can, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, frequencyLabel, fullName } from "@/lib/format";
import { balanceOf, daysOverdue, displayStatus } from "@/lib/finance";
import { PortalUsers } from "./portal-users";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; created?: string; updated?: string; show?: string }>;
}) {
  const user = await requirePermission("clients.view");
  const { id } = await params;
  const { tab = "employees", created, updated, show = "current" } = await searchParams;
  const c = await db.client.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      placements: { include: { employee: { include: { jobTitle: true } } }, orderBy: { startDate: "desc" } },
      invoices: { orderBy: { issueDate: "desc" } },
      payments: { orderBy: { paidOn: "desc" }, include: { invoice: { select: { invoiceNumber: true, id: true } } } },
      users: { where: { role: "CLIENT" }, orderBy: { name: "asc" } },
    },
  });
  if (!c) notFound();

  const open = c.invoices.filter((i) => i.status === "SENT" || i.status === "PARTIAL");
  const outstanding = open.reduce((a, i) => a + balanceOf(i), 0);
  const overdueInv = open.filter((i) => daysOverdue(i) > 0);
  const overdue = overdueInv.reduce((a, i) => a + balanceOf(i), 0);
  const paidYtd = c.payments
    .filter((p) => p.paidOn.getUTCFullYear() === new Date().getUTCFullYear())
    .reduce((a, p) => a + p.amount, 0);
  const activePlacements = c.placements.filter((p) => p.status === "ACTIVE");
  const shownPlacements = show === "all" ? c.placements : activePlacements;
  const base = `/clients/${id}`;

  return (
    <>
      <PageHeader
        back={{ href: "/clients", label: "Clients" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.name} <Badge status={c.status} />
          </span>
        }
        subtitle={`${c.clientCode} · Net ${c.paymentTermsDays} · ${frequencyLabel(c.invoiceFrequency)} billing`}
        actions={
          <>
            {can(user.role, "placements.manage") && <LinkButton variant="secondary" href={`/placements/new?client=${id}`}>+ Assign employee</LinkButton>}
            {can(user.role, "invoices.manage") && <LinkButton variant="secondary" href={`/invoices/new?client=${id}`}>Create invoice</LinkButton>}
            {can(user.role, "clients.manage") && <LinkButton href={`${base}/edit`}>Edit client</LinkButton>}
          </>
        }
      />
      {created && <div className="mb-4"><Alert tone="success">Client created. Next, assign employees to this client.</Alert></div>}
      {updated && <div className="mb-4"><Alert tone="success">Changes saved.</Alert></div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active employees" value={activePlacements.length} tone="blue" />
        <StatCard label="Outstanding" value={formatMoney(outstanding)} hint={`${open.length} open invoice(s)`} tone="amber" />
        <StatCard label="Overdue" value={formatMoney(overdue)} hint={`${overdueInv.length} invoice(s) past due`} tone={overdue ? "red" : "green"} />
        <StatCard label="Paid this year" value={formatMoney(paidYtd)} tone="green" />
      </div>

      <Tabs
        active={tab}
        tabs={[
          { key: "employees", label: "Employees", href: base, count: activePlacements.length },
          { key: "invoices", label: "Invoices", href: `${base}?tab=invoices`, count: c.invoices.length },
          { key: "payments", label: "Payments", href: `${base}?tab=payments`, count: c.payments.length },
          { key: "portal", label: "Portal logins", href: `${base}?tab=portal`, count: c.users.length },
          { key: "details", label: "Details", href: `${base}?tab=details` },
        ]}
      />

      {tab === "employees" && (
        <Card>
          <CardHeader
            title={show === "all" ? "All employees (current & past)" : "Current employees"}
            actions={
              <Link href={show === "all" ? base : `${base}?show=all`} className="text-sm text-brand-600 hover:underline">
                {show === "all" ? "Show current only" : `Show all incl. past (${c.placements.length})`}
              </Link>
            }
          />
          {shownPlacements.length === 0 ? (
            <EmptyState
              title="No employees at this client"
              action={can(user.role, "placements.manage") && <LinkButton href={`/placements/new?client=${id}`}>+ Assign employee</LinkButton>}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Employee</th><th>Job title</th><th>Project</th><th>Start</th><th>End</th><th>Timesheets</th><th className="text-right">Bill rate</th><th className="text-right">Pay rate</th><th className="text-right">Margin</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {shownPlacements.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/employees/${p.employeeId}`} className="flex items-center gap-2.5">
                          <Avatar name={fullName(p.employee)} size="sm" />
                          <span className="font-medium text-slate-900 hover:text-brand-600">{fullName(p.employee)}</span>
                        </Link>
                      </td>
                      <td>{p.jobTitle ?? p.employee.jobTitle?.name ?? "—"}</td>
                      <td>{p.projectName ?? "—"}</td>
                      <td>{formatDate(p.startDate)}</td>
                      <td>{formatDate(p.endDate)}</td>
                      <td>{frequencyLabel(p.timesheetFrequency)}</td>
                      <td className="text-right tabular-nums">{formatMoney(p.billRate)}</td>
                      <td className="text-right tabular-nums">{formatMoney(p.payRate)}</td>
                      <td className="text-right tabular-nums text-emerald-700">{formatMoney(p.billRate - p.payRate)}</td>
                      <td><Badge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "invoices" && (
        <Card>
          {c.invoices.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th className="text-right">Total</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
                <tbody>
                  {c.invoices.map((i) => (
                    <tr key={i.id}>
                      <td><Link href={`/invoices/${i.id}`} className="font-medium text-slate-900 hover:text-brand-600">{i.invoiceNumber}</Link></td>
                      <td>{formatDate(i.issueDate)}</td>
                      <td>{formatDate(i.dueDate)}</td>
                      <td className="text-right tabular-nums">{formatMoney(i.total)}</td>
                      <td className="text-right tabular-nums">{formatMoney(balanceOf(i))}</td>
                      <td><Badge status={displayStatus(i)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "payments" && (
        <Card>
          {c.payments.length === 0 ? (
            <EmptyState title="No payments recorded" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {c.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.paidOn)}</td>
                      <td><Link href={`/invoices/${p.invoice.id}`} className="hover:text-brand-600">{p.invoice.invoiceNumber}</Link></td>
                      <td>{p.method}</td>
                      <td>{p.reference ?? "—"}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "portal" && (
        can(user.role, "clients.manage") ? (
          <PortalUsers
            clientId={c.id}
            approverName={c.approverName ?? c.billingContactName ?? ""}
            approverEmail={c.approverEmail ?? c.billingEmail}
            users={c.users.map((u) => ({
              id: u.id, name: u.name, email: u.email, jobTitle: u.jobTitle, isActive: u.isActive,
              lastLoginAt: u.lastLoginAt?.toISOString() ?? null, invited: !!u.inviteToken,
            }))}
          />
        ) : (
          <Card><EmptyState title="You don't have permission to manage client logins" /></Card>
        )
      )}

      {tab === "details" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Company" />
            <CardBody>
              <DescList items={[
                { label: "Website", value: c.website },
                { label: "Phone", value: c.phone },
                { label: "Industry", value: c.industry },
                { label: "Tax ID", value: c.taxId },
                { label: "Address", value: [c.addressLine, c.city, c.state, c.zip].filter(Boolean).join(", ") },
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Billing & approvals" />
            <CardBody>
              <DescList items={[
                { label: "Billing contact", value: c.billingContactName },
                { label: "Billing email", value: c.billingEmail },
                { label: "CC", value: c.billingCcEmails },
                { label: "Payment terms", value: `Net ${c.paymentTermsDays}` },
                { label: "Reminders", value: c.remindersEnabled ? "Enabled" : "Disabled" },
                { label: "Portal approval", value: c.portalApproval ? "Client approves timesheets online" : "Approved by your team" },
                { label: "Timesheet approver", value: [c.approverName, c.approverEmail].filter(Boolean).join(" · ") },
              ]} />
            </CardBody>
          </Card>
          {c.notes && (
            <Card className="lg:col-span-2">
              <CardHeader title="Notes" />
              <CardBody><p className="whitespace-pre-wrap text-sm">{c.notes}</p></CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
