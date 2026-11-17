import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { can, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney, frequencyLabel } from "@/lib/format";
import { balanceOf, daysOverdue, OPEN_INVOICE_WHERE } from "@/lib/finance";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requirePermission("clients.view");
  const { q = "", status = "ACTIVE" } = await searchParams;
  const clients = await db.client.findMany({
    where: {
      organizationId: user.organizationId,
      ...(status !== "ALL" ? { status } : {}),
      ...(q.trim() ? { OR: [{ name: { contains: q.trim() } }, { clientCode: { contains: q.trim() } }, { billingEmail: { contains: q.trim() } }] } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      placements: { where: { status: "ACTIVE" }, select: { id: true } },
      invoices: { where: OPEN_INVOICE_WHERE, select: { total: true, amountPaid: true, dueDate: true, status: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Companies your employees work for, with outstanding balances."
        actions={can(user.role, "clients.manage") && <LinkButton href="/clients/new">+ Add client</LinkButton>}
      />
      <Card>
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <input name="q" defaultValue={q} placeholder="Search clients…" className="control max-w-xs" />
          <select name="status" defaultValue={status} className="control max-w-40">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ALL">All</option>
          </select>
          <button className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-900">Filter</button>
        </form>
        {clients.length === 0 ? (
          <EmptyState
            title="No clients found"
            description={q ? "Try a different search." : "Add your first client to start placing employees."}
            action={can(user.role, "clients.manage") && !q && <LinkButton href="/clients/new">+ Add client</LinkButton>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th><th>Code</th><th>Billing email</th><th>Terms</th><th>Frequency</th>
                  <th className="text-right">Active employees</th><th className="text-right">Outstanding</th><th className="text-right">Overdue</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const outstanding = c.invoices.reduce((a, i) => a + balanceOf(i), 0);
                  const overdue = c.invoices.filter((i) => daysOverdue(i) > 0).reduce((a, i) => a + balanceOf(i), 0);
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/clients/${c.id}`} className="font-medium text-slate-900 hover:text-brand-600">{c.name}</Link></td>
                      <td className="font-mono text-xs">{c.clientCode}</td>
                      <td>{c.billingEmail}</td>
                      <td>Net {c.paymentTermsDays}</td>
                      <td>{frequencyLabel(c.invoiceFrequency)}</td>
                      <td className="text-right tabular-nums">{c.placements.length}</td>
                      <td className="text-right tabular-nums">{formatMoney(outstanding)}</td>
                      <td className={`text-right tabular-nums ${overdue ? "font-semibold text-red-600" : ""}`}>{formatMoney(overdue)}</td>
                      <td><Badge status={c.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
