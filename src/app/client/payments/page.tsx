import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, StatCard, cn } from "@/components/ui";
import { requireClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, todayUtc } from "@/lib/format";
import { AGING_BUCKETS, agingBucket, balanceOf, daysOverdue, type BucketKey } from "@/lib/finance";

export const metadata: Metadata = { title: "Payments & Balance" };

export default async function ClientPaymentsPage() {
  const user = await requireClientUser();
  const today = todayUtc();
  const where = { organizationId: user.organizationId, clientId: user.client.id };
  const [open, payments] = await Promise.all([
    db.invoice.findMany({ where: { ...where, status: { in: ["SENT", "PARTIAL"] } }, orderBy: { dueDate: "asc" } }),
    db.payment.findMany({ where, include: { invoice: { select: { invoiceNumber: true, id: true } } }, orderBy: { paidOn: "desc" } }),
  ]);
  const buckets: Record<BucketKey, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const i of open) buckets[agingBucket(i, today)] += balanceOf(i);
  const outstanding = Object.values(buckets).reduce((a, b) => a + b, 0);
  const paidYtd = payments.filter((p) => p.paidOn.getUTCFullYear() === today.getUTCFullYear()).reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <PageHeader title="Payments & balance" subtitle={`Your account with ${user.organization.name}.`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total outstanding" value={formatMoney(outstanding)} tone="blue" hint={`${open.length} open invoice(s)`} />
        <StatCard label="Past due" value={formatMoney(outstanding - buckets.current)} tone={outstanding - buckets.current ? "red" : "green"} />
        <StatCard label="Paid this year" value={formatMoney(paidYtd)} tone="green" />
      </div>

      <Card className="mb-6">
        <CardHeader title="Balance by age" subtitle="Days past the invoice due date" />
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-5">
          {AGING_BUCKETS.map((b) => (
            <div key={b.key} className="bg-white p-4">
              <p className="text-xs text-slate-500">{b.label}</p>
              <p className={cn("mt-1 text-lg font-semibold tabular-nums", buckets[b.key] && b.key !== "current" ? "text-red-600" : "text-slate-900")}>
                {formatMoney(buckets[b.key])}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Open invoices" />
        {open.length === 0 ? (
          <EmptyState title="You're all paid up" description="No open invoices. Thank you!" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Invoice</th><th>Due date</th><th className="text-right">Days past due</th><th className="text-right">Amount</th><th className="text-right">Balance</th><th /></tr></thead>
              <tbody>
                {open.map((i) => {
                  const od = daysOverdue(i, today);
                  return (
                    <tr key={i.id}>
                      <td><Link href={`/client/invoices/${i.id}`} className="font-medium text-slate-900 hover:text-brand-600">{i.invoiceNumber}</Link></td>
                      <td>{formatDate(i.dueDate)}</td>
                      <td className={cn("text-right tabular-nums", od ? "font-semibold text-red-600" : "text-slate-400")}>{od || "—"}</td>
                      <td className="text-right tabular-nums">{formatMoney(i.total)}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(balanceOf(i))}</td>
                      <td><a href={`/api/invoices/${i.id}/pdf`} target="_blank" className="text-brand-600 hover:underline">PDF</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Payment history" />
        {payments.length === 0 ? (
          <EmptyState title="No payments recorded yet" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.paidOn)}</td>
                    <td><Link href={`/client/invoices/${p.invoice.id}`} className="hover:text-brand-600">{p.invoice.invoiceNumber}</Link></td>
                    <td>{p.method}</td>
                    <td>{p.reference ?? "—"}</td>
                    <td className="text-right font-medium tabular-nums text-emerald-700">{formatMoney(p.amount)}</td>
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
