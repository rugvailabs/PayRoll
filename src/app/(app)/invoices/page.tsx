import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileArchive, Send } from "lucide-react";
import { Alert, Badge, buttonClass, Card, EmptyState, LinkButton, PageHeader, Tabs, Toolbar } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { DownloadSelected, SelectAll } from "@/components/select-all";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, fullName, todayUtc } from "@/lib/format";
import { balanceOf, candidateNames, daysOverdue, displayStatus } from "@/lib/finance";
import { invoiceWhere } from "@/lib/invoice-query";
import { sendInvoicesAction } from "./actions";

export const metadata: Metadata = { title: "Invoices" };

type SP = { status?: string; q?: string; candidate?: string; client?: string; raised?: string; payslips?: string; run?: string; sent?: string; failed?: string };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("invoices.manage");
  const oid = user.organizationId;
  const sp = await searchParams;
  const { status = "OPEN", q = "", candidate = "", client = "" } = sp;
  const today = todayUtc();

  const [invoices, candidates, clients, draftCount] = await Promise.all([
    db.invoice.findMany({
      where: invoiceWhere(oid, { status, q, candidate, client }),
      include: { client: true, timesheets: { select: { employee: { select: { firstName: true, middleName: true, lastName: true } } } } },
      orderBy: { issueDate: "desc" },
      take: 500,
    }),
    db.employee.findMany({ where: { organizationId: oid, timesheets: { some: { invoiceId: { not: null } } } }, orderBy: { firstName: "asc" } }),
    db.client.findMany({ where: { organizationId: oid }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.invoice.count({ where: { organizationId: oid, status: "DRAFT" } }),
  ]);
  const filters = new URLSearchParams({ status, ...(q && { q }), ...(candidate && { candidate }), ...(client && { client }) });
  const qs = (s: string) => {
    const f = new URLSearchParams(filters);
    f.set("status", s);
    return `/invoices?${f}`;
  };
  const isDraft = status === "DRAFT";

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Bills sent to clients for approved hours, by candidate."
        actions={
          <>
            <a href={`/api/export/invoices?${filters}`} className={buttonClass("secondary")}><Download size={16} /> Export to Excel</a>
            <LinkButton href="/invoices/new">+ Create invoice</LinkButton>
          </>
        }
      />

      {sp.raised !== undefined && (
        <div className="mb-4">
          <Alert tone="success">
            Raised <b>{sp.raised}</b> draft invoice(s)
            {sp.payslips && Number(sp.payslips) > 0 && <> and a draft payroll run with <b>{sp.payslips}</b> payslip(s) (<Link href={`/payroll/${sp.run}`} className="font-semibold underline">review payroll</Link>)</>}.
            Recheck the drafts below, then select them and click <b>Send to clients</b>.
          </Alert>
        </div>
      )}
      {sp.sent && (
        <div className="mb-4">
          <Alert tone={sp.failed ? "warning" : "success"}>
            {sp.sent} invoice(s) emailed to clients with the invoice PDF and approved timesheets attached.
            {sp.failed && ` ${sp.failed} failed to send. Check the Email Outbox.`}
          </Alert>
        </div>
      )}

      <Tabs
        active={status}
        tabs={[
          { key: "OPEN", label: "Open", href: qs("OPEN") },
          { key: "OVERDUE", label: "Overdue", href: qs("OVERDUE") },
          { key: "DRAFT", label: "Drafts", href: qs("DRAFT"), count: draftCount },
          { key: "PAID", label: "Paid", href: qs("PAID") },
          { key: "VOID", label: "Void", href: qs("VOID") },
          { key: "ALL", label: "All", href: qs("ALL") },
        ]}
      />
      <Card>
        <form>
          <Toolbar>
            <input type="hidden" name="status" value={status} />
            <input name="q" defaultValue={q} placeholder="Invoice # or client…" className="control max-w-60" />
            <select name="candidate" defaultValue={candidate} className="control max-w-56" aria-label="Candidate">
              <option value="">All candidates</option>
              {candidates.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
            </select>
            <select name="client" defaultValue={client} className="control max-w-56" aria-label="Client">
              <option value="">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className={buttonClass("secondary")}>Apply</button>
            {(q || candidate || client) && <Link href={`/invoices?status=${status}`} className="text-sm text-slate-500 hover:underline">Clear</Link>}
          </Toolbar>
        </form>

        {invoices.length === 0 ? (
          <EmptyState
            title={isDraft ? "No draft invoices" : "No invoices"}
            description={isDraft ? "Raise drafts from Timesheets → Approved by selecting timesheets." : undefined}
            action={isDraft ? <LinkButton href="/timesheets?status=APPROVED">Go to approved timesheets</LinkButton> : <LinkButton href="/invoices/new">+ Create invoice</LinkButton>}
          />
        ) : (
          <form action={sendInvoicesAction}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8"><SelectAll /></th>
                    <th>Invoice #</th><th>Candidate</th><th>Client</th><th>Issued</th><th>Due</th><th className="text-right">Days overdue</th>
                    <th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th><th className="text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => {
                    const st = displayStatus(i);
                    const od = st === "OVERDUE" ? daysOverdue(i, today) : 0;
                    return (
                      <tr key={i.id}>
                        <td><input type="checkbox" name="ids" value={i.id} className="h-4 w-4" aria-label={`Select ${i.invoiceNumber}`} /></td>
                        <td><Link href={`/invoices/${i.id}`} className="font-semibold text-slate-900 hover:text-brand-600">{i.invoiceNumber}</Link></td>
                        <td className="max-w-56 truncate">{candidateNames(i) || <span className="text-slate-400">—</span>}</td>
                        <td><Link href={`/clients/${i.clientId}`} className="hover:text-brand-600">{i.client.name}</Link></td>
                        <td>{formatDate(i.issueDate)}</td>
                        <td>{formatDate(i.dueDate)}</td>
                        <td className={`text-right tabular-nums ${od ? (od > 30 ? "font-semibold text-red-600" : "font-semibold text-amber-700") : "text-slate-400"}`}>{od || "—"}</td>
                        <td className="text-right tabular-nums">{formatMoney(i.total)}</td>
                        <td className="text-right tabular-nums">{formatMoney(i.amountPaid)}</td>
                        <td className="text-right font-semibold tabular-nums">{formatMoney(i.status === "VOID" ? 0 : balanceOf(i))}</td>
                        <td><Badge status={st} /></td>
                        <td className="text-right">
                          <a href={`/api/invoices/${i.id}/pdf`} target="_blank" className="inline-flex rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600" aria-label={`Download ${i.invoiceNumber} PDF`}>
                            <Download size={15} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-slate-200 bg-white/90 p-4 backdrop-blur">
              <p className="text-xs text-slate-500">{invoices.length} invoice(s). Select rows to download their PDFs{isDraft ? " or send them" : ""}.</p>
              <div className="flex flex-wrap gap-2">
                <DownloadSelected href="/api/export/invoices-zip" className={buttonClass("secondary")}>
                  <FileArchive size={16} /> Download PDFs (ZIP)
                </DownloadSelected>
                {isDraft && (
                  <SubmitButton pendingText="Sending…"><Send size={16} /> Send to clients</SubmitButton>
                )}
              </div>
            </div>
          </form>
        )}
      </Card>
    </>
  );
}
