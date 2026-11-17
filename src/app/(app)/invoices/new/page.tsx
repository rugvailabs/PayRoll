import type { Metadata } from "next";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, dateToInput, formatDate, formatMinutes, fullName, todayUtc } from "@/lib/format";
import { linesFromTimesheets } from "@/lib/invoicing";
import { InvoiceForm } from "../invoice-form";

export const metadata: Metadata = { title: "Create Invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await requirePermission("invoices.manage");
  const oid = user.organizationId;
  const { client: clientId } = await searchParams;

  const clients = await db.client.findMany({
    where: { organizationId: oid, status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: { _count: { select: { placements: { where: { timesheets: { some: { status: "APPROVED", invoiceId: null } } } } } } },
  });
  const client = clientId ? clients.find((c) => c.id === clientId) : undefined;

  let rows: { id: string; employee: string; period: string; hours: string; amount: number }[] = [];
  if (client) {
    const timesheets = await db.timesheet.findMany({
      where: { organizationId: oid, status: "APPROVED", invoiceId: null, placement: { clientId: client.id } },
      include: { employee: true, placement: true },
      orderBy: [{ employee: { firstName: "asc" } }, { periodStart: "asc" }],
    });
    rows = timesheets.map((t) => ({
      id: t.id,
      employee: fullName(t.employee),
      period: `${formatDate(t.periodStart)} – ${formatDate(t.periodEnd)}`,
      hours: formatMinutes(t.totalMinutes),
      amount: linesFromTimesheets([t]).reduce((a, l) => a + l.amount, 0),
    }));
  }
  const today = todayUtc();

  return (
    <>
      <PageHeader title="Create invoice" subtitle="Bill a client for approved timesheets." back={{ href: "/invoices", label: "Invoices" }} />
      <Card className="mb-6">
        <CardBody>
          <form className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="client">Client</label>
              <select id="client" name="client" defaultValue={clientId ?? ""} className="control">
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c._count.placements ? ` (${c._count.placements} with approved hours)` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button className="h-9 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">Load timesheets</button>
          </form>
        </CardBody>
      </Card>
      {client && (
        <InvoiceForm
          key={client.id}
          clientId={client.id}
          rows={rows}
          termsDays={client.paymentTermsDays}
          issueDate={dateToInput(today)}
          dueDate={dateToInput(addDays(today, client.paymentTermsDays))}
        />
      )}
    </>
  );
}
