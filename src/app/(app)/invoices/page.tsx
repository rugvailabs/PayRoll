import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Tabs } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, todayUtc } from "@/lib/format";
import { balanceOf, daysOverdue, displayStatus } from "@/lib/finance";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requirePermission("invoices.manage");
  const oid = user.organizationId;
  const { status = "OPEN", q = "" } = await searchParams;
  const today = todayUtc();

  const where: Prisma.InvoiceWhereInput = { organizationId: oid };
  if (status === "OPEN") where.status = { in: ["SENT", "PARTIAL"] };
  else if (status === "OVERDUE") Object.assign(where, { status: { in: ["SENT", "PARTIAL"] }, dueDate: { lt: today } });
  else if (status !== "ALL") where.status = status;
  if (q.trim()) where.OR = [{ invoiceNumber: { contains: q.trim() } }, { client: { name: { contains: q.trim() } } }];

  const invoices = await db.invoice.findMany({ where, include: { client: true }, orderBy: { issueDate: "desc" }, take: 300 });
  const qs = (s: string) => `/invoices?status=${s}`;

  return (
    <>
      <PageHeader title="Invoices" subtitle="Bills sent to clients for approved hours."
        actions={<LinkButton href="/invoices/new">+ Create invoice</LinkButton>} />
      <Tabs
        active={status}
        tabs={[
          { key: "OPEN", label: "Open", href: qs("OPEN") },
          { key: "OVERDUE", label: "Overdue", href: qs("OVERDUE") },
          { key: "DRAFT", label: "Drafts", href: qs("DRAFT") },
          { key: "PAID", label: "Paid", href: qs("PAID") },
          { key: "VOID", label: "Void", href: qs("VOID") },
          { key: "ALL", label: "All", href: qs("ALL") },
        ]}
      />
      <Card>
        <form className="flex gap-2 border-b border-slate-100 p-4">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Invoice # or client…" className="control max-w-xs" />
          <button className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">Search</button>
        </form>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices" action={<LinkButton href="/invoices/new">+ Create invoice</LinkButton>} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Invoice #</th><th>Client</th><th>Issued</th><th>Due</th><th className="text-right">Days overdue</th>
                  <th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th></tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const st = displayStatus(i);
                  const od = st === "OVERDUE" ? daysOverdue(i, today) : 0;
                  return (
                    <tr key={i.id}>
                      <td><Link href={`/invoices/${i.id}`} className="font-medium text-slate-900 hover:text-brand-600">{i.invoiceNumber}</Link></td>
                      <td><Link href={`/clients/${i.clientId}`} className="hover:text-brand-600">{i.client.name}</Link></td>
                      <td>{formatDate(i.issueDate)}</td>
                      <td>{formatDate(i.dueDate)}</td>
                      <td className={`text-right tabular-nums ${od ? "font-semibold text-red-600" : "text-slate-400"}`}>{od || "—"}</td>
                      <td className="text-right tabular-nums">{formatMoney(i.total)}</td>
                      <td className="text-right tabular-nums">{formatMoney(i.amountPaid)}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(i.status === "VOID" ? 0 : balanceOf(i))}</td>
                      <td><Badge status={st} /></td>
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
