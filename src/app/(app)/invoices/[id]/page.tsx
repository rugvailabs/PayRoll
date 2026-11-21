import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, CardBody, CardHeader, DescList, PageHeader, StatCard } from "@/components/ui";
import { can, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsToInput, dateToInput, formatDate, formatDateTime, formatMinutes, formatMoney, fullName, todayUtc } from "@/lib/format";
import { balanceOf, daysOverdue, displayStatus } from "@/lib/finance";
import { DeletePayment, InvoiceActions, PaymentForm } from "./panels";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requirePermission("invoices.manage");
  const { id } = await params;
  const { created } = await searchParams;
  const inv = await db.invoice.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      client: true,
      lines: true,
      payments: { orderBy: { paidOn: "desc" } },
      timesheets: { include: { employee: true, attachments: true }, orderBy: { periodStart: "asc" } },
    },
  });
  if (!inv) notFound();
  const emails = await db.emailLog.findMany({
    where: { organizationId: user.organizationId, relatedId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const st = displayStatus(inv);
  const balance = inv.status === "VOID" ? 0 : balanceOf(inv);
  const od = st === "OVERDUE" ? daysOverdue(inv) : 0;

  return (
    <>
      <PageHeader
        back={{ href: "/invoices", label: "Invoices" }}
        title={<span className="flex items-center gap-3">{inv.invoiceNumber} <Badge status={st} /></span>}
        subtitle={
          <span>
            <Link href={`/clients/${inv.clientId}`} className="hover:text-brand-600">{inv.client.name}</Link>
            {inv.timesheets.length > 0 && <> · Candidate: <span className="font-medium text-slate-700">{[...new Set(inv.timesheets.map((t) => fullName(t.employee)))].join(", ")}</span></>}
          </span>
        }
      />
      {created && <div className="mb-4"><Alert tone="success">Invoice created{inv.status === "SENT" ? " and sent to the client" : ""}.</Alert></div>}
      {od > 0 && <div className="mb-4"><Alert tone="error">This invoice is <b>{od} days overdue</b>. Balance {formatMoney(balance)}.</Alert></div>}
      {inv.onHold && <div className="mb-4"><Alert tone="warning">On hold: automatic payment reminders are paused.</Alert></div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={formatMoney(inv.total)} tone="blue" />
        <StatCard label="Paid" value={formatMoney(inv.amountPaid)} tone="green" />
        <StatCard label="Balance due" value={formatMoney(balance)} tone={od ? "red" : "amber"} hint={`Due ${formatDate(inv.dueDate)}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardBody>
              <InvoiceActions id={inv.id} status={inv.status} onHold={inv.onHold} canVoid={inv.amountPaid === 0} dueDate={dateToInput(inv.dueDate)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Line items" />
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Description</th><th className="text-right">Hours</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {inv.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-normal">
                        {l.timesheetId ? <Link href={`/timesheets/${l.timesheetId}`} className="hover:text-brand-600">{l.description}</Link> : l.description}
                      </td>
                      <td className="text-right tabular-nums">{l.minutes ? formatMinutes(l.minutes) : ""}</td>
                      <td className="text-right tabular-nums">{l.rate ? formatMoney(l.rate) : ""}</td>
                      <td className="text-right tabular-nums">{formatMoney(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold"><td className="px-4 py-3" colSpan={3}>Total</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(inv.total)}</td></tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader title="Payments received" />
            {inv.payments.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No payments recorded yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th><th /></tr></thead>
                  <tbody>
                    {inv.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.paidOn)}</td>
                        <td>{p.method}</td>
                        <td>{p.reference ?? "—"}</td>
                        <td className="text-right font-medium tabular-nums">{formatMoney(p.amount)}</td>
                        <td className="text-right"><DeletePayment paymentId={p.id} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Email history" subtitle="Invoices, reminders and receipts sent to the client" />
            {emails.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Nothing sent yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {emails.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span>
                      <span className="font-medium text-slate-800">{e.subject}</span>
                      <span className="block text-xs text-slate-500">To {e.to}{e.cc ? `, cc ${e.cc}` : ""}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      {formatDateTime(e.createdAt)}
                      <Badge status={e.status === "SENT" ? "APPROVED" : e.status === "FAILED" ? "REJECTED" : "DRAFT"}>{e.status === "LOGGED" ? "Logged" : e.status === "SENT" ? "Sent" : "Failed"}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {can(user.role, "payments.manage") && (inv.status === "SENT" || inv.status === "PARTIAL") && (
            <PaymentForm invoiceId={inv.id} balance={centsToInput(balance)} today={dateToInput(todayUtc())} />
          )}
          {inv.timesheets.length > 0 && (
            <Card>
              <CardHeader title="Approved timesheets" subtitle="Attached to the email sent to the client" />
              <ul className="divide-y divide-slate-100">
                {inv.timesheets.map((t) => (
                  <li key={t.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/timesheets/${t.id}`} className="font-medium text-slate-900 hover:text-brand-600">{fullName(t.employee)}</Link>
                      <a href={`/api/timesheets/${t.id}/pdf`} target="_blank" className="text-[13px] font-medium text-brand-600 hover:underline">Timesheet PDF</a>
                    </div>
                    <p className="text-xs text-slate-500">{formatDate(t.periodStart)} – {formatDate(t.periodEnd)} · {formatMinutes(t.totalMinutes)} hrs</p>
                    {t.attachments.map((a) => (
                      <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" className="mt-1 block truncate text-xs text-slate-500 hover:text-brand-600">📎 {a.fileName}</a>
                    ))}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <DescList items={[
                { label: "Issue date", value: formatDate(inv.issueDate) },
                { label: "Due date", value: formatDate(inv.dueDate) },
                { label: "Service period", value: inv.periodStart ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}` : null },
                { label: "Sent", value: formatDateTime(inv.sentAt) },
                { label: "Last reminder", value: formatDateTime(inv.lastReminderAt) },
                { label: "Bill to", value: inv.client.billingEmail },
              ]} />
              {inv.notes && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{inv.notes}</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
