import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CircleDollarSign, Clock, Download, Wallet } from "lucide-react";
import { Badge, buttonClass, Card, CardHeader, EmptyState, PageHeader, StatCard, Tabs, cn } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney, todayUtc } from "@/lib/format";
import { AGING_BUCKETS, agingBucket, balanceByCandidate, balanceOf, candidateNames, CANDIDATE_INCLUDE, daysOverdue, type BucketKey } from "@/lib/finance";
import { RunRemindersButton } from "./run-button";

export const metadata: Metadata = { title: "Payments & Aging" };

type Row = { key: string; name: string; sub?: string; href: string; buckets: Record<BucketKey, number>; total: number; oldest: number };

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ min?: string; view?: string }> }) {
  const user = await requirePermission("payments.manage");
  const oid = user.organizationId;
  const { min = "30", view = "client" } = await searchParams;
  const byCandidate = view === "candidate";
  const minDays = Math.max(0, parseInt(min, 10) || 0);
  const today = todayUtc();

  const [invoices, recentPayments] = await Promise.all([
    db.invoice.findMany({
      where: { organizationId: oid, status: { in: ["SENT", "PARTIAL"] } },
      include: { client: true, ...CANDIDATE_INCLUDE },
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
  const rows = new Map<string, Row>();
  const add = (key: string, init: Omit<Row, "buckets" | "total" | "oldest">, bucket: BucketKey, amount: number, days: number) => {
    const r = rows.get(key) ?? { ...init, buckets: emptyBuckets(), total: 0, oldest: 0 };
    r.buckets[bucket] += amount;
    r.total += amount;
    r.oldest = Math.max(r.oldest, days);
    rows.set(key, r);
  };
  for (const i of invoices) {
    const bal = balanceOf(i);
    if (bal <= 0) continue;
    const b = agingBucket(i, today);
    const d = daysOverdue(i, today);
    totals[b] += bal;
    if (byCandidate) {
      for (const p of balanceByCandidate(i)) {
        if (!p.balance) continue;
        add(`${p.id}:${i.clientId}`, {
          key: `${p.id}:${i.clientId}`, name: p.name, sub: i.client.name,
          href: p.id === "_other" ? `/clients/${i.clientId}?tab=invoices` : `/invoices?status=OPEN&candidate=${p.id}`,
        }, b, p.balance, d);
      }
    } else {
      add(i.clientId, { key: i.clientId, name: i.client.name, href: `/clients/${i.clientId}?tab=invoices` }, b, bal, d);
    }
  }
  const aging = [...rows.values()].sort((a, b) => b.oldest - a.oldest || b.total - a.total);
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
  const label = byCandidate ? "candidate" : "client";

  return (
    <>
      <PageHeader
        title="Payments & aging"
        subtitle="Who owes you money, how long it has been pending, and recent payments."
        actions={
          <>
            <a href={`/api/export/aging?by=${label}`} className={buttonClass("secondary")}><Download size={16} /> Export aging by {label}</a>
            <RunRemindersButton />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total outstanding" value={formatMoney(outstanding)} tone="blue" hint={`${invoices.length} open invoice(s)`} icon={<CircleDollarSign size={18} />} />
        <StatCard label="Overdue" value={formatMoney(overdueTotal)} tone={overdueTotal ? "red" : "green"} icon={<Clock size={18} />} />
        <StatCard label="Over 30 days" value={formatMoney(totals["31-60"] + totals["61-90"] + totals["90+"])} tone="red" icon={<AlertTriangle size={18} />} />
        <StatCard label="Not yet due" value={formatMoney(totals.current)} tone="green" icon={<Wallet size={18} />} />
      </div>

      <Tabs
        active={view}
        tabs={[
          { key: "client", label: "By client", href: `/receivables?view=client&min=${minDays}` },
          { key: "candidate", label: "By candidate", href: `/receivables?view=candidate&min=${minDays}` },
        ]}
      />

      <Card className="mb-6">
        <CardHeader
          title={`Aging summary by ${label}`}
          subtitle={byCandidate ? "Each candidate's share of open invoices, grouped by days past due" : "Outstanding balances grouped by days past due"}
        />
        {aging.length === 0 ? (
          <EmptyState title="Nothing outstanding" description="All sent invoices are paid." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{byCandidate ? "Candidate" : "Client"}</th>
                  {byCandidate && <th>Client</th>}
                  {AGING_BUCKETS.map((b) => <th key={b.key} className="text-right">{b.label}</th>)}
                  <th className="text-right">Total</th>
                  <th className="text-right">Oldest (days)</th>
                </tr>
              </thead>
              <tbody>
                {aging.map((r) => (
                  <tr key={r.key}>
                    <td><Link href={r.href} className="font-medium text-slate-900 hover:text-brand-600">{r.name}</Link></td>
                    {byCandidate && <td>{r.sub}</td>}
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
                  <td className="px-4 py-3" colSpan={byCandidate ? 2 : 1}>Total</td>
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
          title={minDays ? `Not paid for more than ${minDays} days` : "All overdue invoices"}
          subtitle="Pending payments past their due date, with the candidate on each invoice. Open an invoice to record a payment or resend it."
          actions={
            <form className="flex items-center gap-2 text-sm">
              <input type="hidden" name="view" value={view} />
              <label htmlFor="min" className="whitespace-nowrap text-slate-500">Overdue more than</label>
              <select id="min" name="min" defaultValue={String(minDays)} className="control h-8 w-28 py-1">
                <option value="0">0 days</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
              <button className={buttonClass("secondary", "sm")}>Apply</button>
            </form>
          }
        />
        {unpaid.length === 0 ? (
          <EmptyState title="No pending payments in this range" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Candidate</th><th>Client</th><th>Invoice</th><th>Billing contact</th><th>Due date</th><th className="text-right">Days overdue</th>
                  <th className="text-right">Balance</th><th>Last reminder</th><th>Status</th><th className="text-right">PDF</th></tr>
              </thead>
              <tbody>
                {unpaid.map((i) => (
                  <tr key={i.id}>
                    <td className="max-w-52 truncate font-medium text-slate-900">{candidateNames(i) || "—"}</td>
                    <td><Link href={`/clients/${i.clientId}`} className="hover:text-brand-600">{i.client.name}</Link></td>
                    <td><Link href={`/invoices/${i.id}`} className="font-medium text-brand-600 hover:underline">{i.invoiceNumber}</Link></td>
                    <td>
                      <span className="block">{i.client.billingContactName ?? "—"}</span>
                      <span className="block text-xs text-slate-500">{i.client.billingEmail}</span>
                    </td>
                    <td>{formatDate(i.dueDate)}</td>
                    <td className="text-right font-semibold tabular-nums text-red-600">{daysOverdue(i, today)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatMoney(balanceOf(i))}</td>
                    <td className="text-xs">{formatDateTime(i.lastReminderAt)}</td>
                    <td>{i.onHold ? <Badge status="ON_HOLD" /> : <Badge status={i.status === "PARTIAL" ? "PARTIAL" : "OVERDUE"} />}</td>
                    <td className="text-right">
                      <a href={`/api/invoices/${i.id}/pdf`} target="_blank" className="inline-flex rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600" aria-label={`Download ${i.invoiceNumber}`}>
                        <Download size={15} />
                      </a>
                    </td>
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
