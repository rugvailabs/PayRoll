import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, cn } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney, todayUtc } from "@/lib/format";
import { AGING_BUCKETS, agingBucket, balanceOf, daysOverdue, type BucketKey } from "@/lib/finance";
import { RunRemindersButton } from "./run-button";

export const metadata: Metadata = { title: "Payments & Aging" };

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ min?: string }> }) {
  const user = await requirePermission("payments.manage");
  const oid = user.organizationId;
  const { min = "30" } = await searchParams;
  const minDays = Math.max(0, parseInt(min, 10) || 0);
  const today = todayUtc();

  const [invoices, recentPayments] = await Promise.all([
    db.invoice.findMany({
      where: { organizationId: oid, status: { in: ["SENT", "PARTIAL"] } },
      include: { client: true },
      orderBy: { dueDate: "asc" },
    }),
    db.payment.findMany({
      where: { organizationId: oid },
      include: { client: true, invoice: { select: { invoiceNumber: true } } },
      orderBy: { paidOn: "desc" },
      take: 10,
    }),
  ]);

  const emptyBuckets = (): Record<BucketKey, number> => ({ current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 });
  const totals = emptyBuckets();
  const byClient = new Map<string, { id: string; name: string; buckets: Record<BucketKey, number>; total: number; oldest: number }>();
  for (const i of invoices) {
    const bal = balanceOf(i);
    if (bal <= 0) continue;
    const b = agingBucket(i, today);
    totals[b] += bal;
    const row = byClient.get(i.clientId) ?? { id: i.clientId, name: i.client.name, buckets: emptyBuckets(), total: 0, oldest: 0 };
    row.buckets[b] += bal;
    row.total += bal;
    row.oldest = Math.max(row.oldest, daysOverdue(i, today));
    byClient.set(i.clientId, row);
  }
  const clientRows = [...byClient.values()].sort((a, b) => b.oldest - a.oldest || b.total - a.total);
  const outstanding = Object.values(totals).reduce((a, b) => a + b, 0);
  const overdueTotal = outstanding - totals.current;
  const unpaid = invoices.filter((i) => balanceOf(i) > 0 && daysOverdue(i, today) > minDays);

  const bucketTone: Record<BucketKey, string> = {
    current: "text-slate-700",
    "1-30": "text-amber-600",
    "31-60": "text-orange-600",
    "61-90": "text-red-600",
    "90+": "text-red-700 font-semibold",
  };

  return (
    <>
      <PageHeader
        title="Payments & aging"
        subtitle="Who owes you money, how long it has been pending, and recent payments."
        actions={<RunRemindersButton />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total outstanding" value={formatMoney(outstanding)} tone="blue" hint={`${invoices.length} open invoice(s)`} />
        <StatCard label="Overdue" value={formatMoney(overdueTotal)} tone="red" />
        <StatCard label="Over 30 days" value={formatMoney(totals["31-60"] + totals["61-90"] + totals["90+"])} tone="red" />
        <StatCard label="Not yet due" value={formatMoney(totals.current)} tone="green" />
      </div>

      <Card className="mb-6">
        <CardHeader title="Aging summary by client" subtitle="Outstanding balances grouped by days past due date" />
        {clientRows.length === 0 ? (
          <EmptyState title="Nothing outstanding" description="All sent invoices are paid." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  {AGING_BUCKETS.map((b) => <th key={b.key} className="text-right">{b.label}</th>)}
                  <th className="text-right">Total</th>
                  <th className="text-right">Oldest (days)</th>
                </tr>
              </thead>
              <tbody>
                {clientRows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/clients/${r.id}?tab=invoices`} className="font-medium text-slate-900 hover:text-brand-600">{r.name}</Link></td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b.key} className={cn("text-right tabular-nums", r.buckets[b.key] ? bucketTone[b.key] : "text-slate-300")}>
                        {r.buckets[b.key] ? formatMoney(r.buckets[b.key]) : "—"}
                      </td>
                    ))}
                    <td className="text-right font-semibold tabular-nums">{formatMoney(r.total)}</td>
                    <td className={cn("text-right tabular-nums", r.oldest > 30 && "font-semibold text-red-600")}>{r.oldest || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  {AGING_BUCKETS.map((b) => <td key={b.key} className="px-4 py-3 text-right tabular-nums">{formatMoney(totals[b.key])}</td>)}
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(outstanding)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card className="mb-6 border-red-200">
        <CardHeader
          title={minDays ? `Clients who have not paid for more than ${minDays} days` : "All overdue invoices"}
          subtitle="Pending payments past their due date. Open an invoice to record a payment or resend it."
          actions={
            <form className="flex items-center gap-2 text-sm">
              <label htmlFor="min" className="text-slate-500">Overdue more than</label>
              <select id="min" name="min" defaultValue={String(minDays)} className="control h-8 w-28 py-1">
                <option value="0">0 days</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
              <button className="inline-flex h-8 items-center rounded-lg bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">Apply</button>
            </form>
          }
        />
        {unpaid.length === 0 ? (
          <EmptyState title="No pending payments in this range" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Client</th><th>Invoice</th><th>Billing contact</th><th>Due date</th><th className="text-right">Days overdue</th>
                  <th className="text-right">Balance</th><th>Last reminder</th><th>Status</th></tr>
              </thead>
              <tbody>
                {unpaid.map((i) => (
                  <tr key={i.id}>
                    <td><Link href={`/clients/${i.clientId}`} className="font-medium text-slate-900 hover:text-brand-600">{i.client.name}</Link></td>
                    <td><Link href={`/invoices/${i.id}`} className="text-brand-600 hover:underline">{i.invoiceNumber}</Link></td>
                    <td>
                      <span className="block">{i.client.billingContactName ?? "—"}</span>
                      <span className="block text-xs text-slate-500">{i.client.billingEmail}</span>
                    </td>
                    <td>{formatDate(i.dueDate)}</td>
                    <td className="text-right font-semibold tabular-nums text-red-600">{daysOverdue(i, today)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatMoney(balanceOf(i))}</td>
                    <td className="text-xs">{formatDateTime(i.lastReminderAt)}</td>
                    <td>{i.onHold ? <Badge status="ON_HOLD" /> : <Badge status={i.status === "PARTIAL" ? "PARTIAL" : "OVERDUE"} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Recent payments" />
        {recentPayments.length === 0 ? (
          <EmptyState title="No payments recorded yet" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Client</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.paidOn)}</td>
                    <td>{p.client.name}</td>
                    <td><Link href={`/invoices/${p.invoiceId}`} className="hover:text-brand-600">{p.invoice.invoiceNumber}</Link></td>
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
