import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, CardBody, CardHeader, DescList, PageHeader, StatCard } from "@/components/ui";
import { requireClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMinutes, formatMoney } from "@/lib/format";
import { balanceOf, daysOverdue, displayStatus } from "@/lib/finance";

export const metadata: Metadata = { title: "Invoice" };

export default async function ClientInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClientUser();
  const { id } = await params;
  const inv = await db.invoice.findFirst({
    where: { id, organizationId: user.organizationId, clientId: user.client.id, status: { in: ["SENT", "PARTIAL", "PAID"] } },
    include: { lines: true, payments: { orderBy: { paidOn: "desc" } } },
  });
  if (!inv) notFound();
  const st = displayStatus(inv) === "ON_HOLD" ? inv.status : displayStatus(inv);
  const od = st === "OVERDUE" ? daysOverdue(inv) : 0;
  const org = user.organization;

  return (
    <>
      <PageHeader
        back={{ href: "/client/invoices", label: "Invoices" }}
        title={<span className="flex items-center gap-3">{inv.invoiceNumber} <Badge status={st} /></span>}
        subtitle={`Issued ${formatDate(inv.issueDate)} · Due ${formatDate(inv.dueDate)}`}
        actions={
          <a href={`/api/invoices/${inv.id}/pdf`} target="_blank"
            className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
            Download PDF
          </a>
        }
      />
      {od > 0 && <div className="mb-4"><Alert tone="error">This invoice is <b>{od} days past due</b>. Please arrange payment of {formatMoney(balanceOf(inv))}.</Alert></div>}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Invoice amount" value={formatMoney(inv.total)} tone="blue" />
        <StatCard label="Paid" value={formatMoney(inv.amountPaid)} tone="green" />
        <StatCard label="Balance due" value={formatMoney(balanceOf(inv))} tone={od ? "red" : "amber"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Line items" />
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Description</th><th className="text-right">Hours</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {inv.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-normal">{l.description}</td>
                    <td className="text-right tabular-nums">{l.minutes ? formatMinutes(l.minutes) : ""}</td>
                    <td className="text-right tabular-nums">{l.rate ? formatMoney(l.rate) : ""}</td>
                    <td className="text-right tabular-nums">{formatMoney(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-slate-50 font-semibold"><td className="px-4 py-3" colSpan={3}>Total</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(inv.total)}</td></tr></tfoot>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Payments received" />
            {inv.payments.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex justify-between px-5 py-3 text-sm">
                    <span>
                      <span className="block">{formatDate(p.paidOn)} · {p.method}</span>
                      {p.reference && <span className="block text-xs text-slate-500">Ref {p.reference}</span>}
                    </span>
                    <span className="font-medium tabular-nums text-emerald-700">{formatMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Pay to" />
            <CardBody>
              <DescList items={[
                { label: "Company", value: org.name },
                { label: "Address", value: [org.address, org.city, org.state, org.zip].filter(Boolean).join(", ") },
                { label: "Contact", value: [org.email, org.phone].filter(Boolean).join(" · ") },
                { label: "Reference", value: inv.invoiceNumber },
              ]} />
              {inv.notes && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{inv.notes}</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
