import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { requireClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, todayUtc } from "@/lib/format";
import { balanceOf, candidateNames, daysOverdue, displayStatus } from "@/lib/finance";

export const metadata: Metadata = { title: "Invoices" };

export default async function ClientInvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireClientUser();
  const { status = "OPEN" } = await searchParams;
  const today = todayUtc();
  const invoices = await db.invoice.findMany({
    where: {
      organizationId: user.organizationId,
      clientId: user.client.id,
      status: status === "PAID" ? "PAID" : status === "ALL" ? { in: ["SENT", "PARTIAL", "PAID"] } : { in: ["SENT", "PARTIAL"] },
    },
    include: { timesheets: { select: { employee: { select: { firstName: true, middleName: true, lastName: true } } } } },
    orderBy: { issueDate: "desc" },
  });
  return (
    <>
      <PageHeader title="Invoices" subtitle={`Invoices from ${user.organization.name}.`} />
      <Tabs
        active={status}
        tabs={[
          { key: "OPEN", label: "Open", href: "/client/invoices" },
          { key: "PAID", label: "Paid", href: "/client/invoices?status=PAID" },
          { key: "ALL", label: "All", href: "/client/invoices?status=ALL" },
        ]}
      />
      <Card>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Invoice #</th><th>Consultant</th><th>Service period</th><th>Issued</th><th>Due</th><th className="text-right">Days past due</th>
                <th className="text-right">Amount</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th><th /></tr></thead>
              <tbody>
                {invoices.map((i) => {
                  const st = displayStatus(i) === "ON_HOLD" ? i.status : displayStatus(i);
                  const od = st === "OVERDUE" ? daysOverdue(i, today) : 0;
                  return (
                    <tr key={i.id}>
                      <td><Link href={`/client/invoices/${i.id}`} className="font-medium text-slate-900 hover:text-brand-600">{i.invoiceNumber}</Link></td>
                      <td>{candidateNames(i) || "—"}</td>
                      <td>{i.periodStart ? `${formatDate(i.periodStart)} – ${formatDate(i.periodEnd)}` : "—"}</td>
                      <td>{formatDate(i.issueDate)}</td>
                      <td>{formatDate(i.dueDate)}</td>
                      <td className={`text-right tabular-nums ${od ? "font-semibold text-red-600" : "text-slate-400"}`}>{od || "—"}</td>
                      <td className="text-right tabular-nums">{formatMoney(i.total)}</td>
                      <td className="text-right tabular-nums">{formatMoney(i.amountPaid)}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(balanceOf(i))}</td>
                      <td><Badge status={st} /></td>
                      <td><a href={`/api/invoices/${i.id}/pdf`} target="_blank" className="text-brand-600 hover:underline">PDF</a></td>
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
