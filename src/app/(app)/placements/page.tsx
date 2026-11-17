import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, frequencyLabel, fullName } from "@/lib/format";

export const metadata: Metadata = { title: "Placements" };

export default async function PlacementsPage({ searchParams }: { searchParams: Promise<{ status?: string; saved?: string }> }) {
  const user = await requirePermission("placements.manage");
  const { status = "ACTIVE", saved } = await searchParams;
  const placements = await db.placement.findMany({
    where: { organizationId: user.organizationId, ...(status !== "ALL" ? { status } : {}) },
    include: { employee: true, client: true },
    orderBy: { startDate: "desc" },
  });
  return (
    <>
      <PageHeader title="Placements" subtitle="Employee-to-client assignments with bill and pay rates."
        actions={<LinkButton href="/placements/new">+ Create placement</LinkButton>} />
      {saved && <div className="mb-4"><Alert tone="success">Placement saved.</Alert></div>}
      <Card>
        <form className="flex gap-2 border-b border-slate-100 p-4">
          <select name="status" defaultValue={status} className="control max-w-40">
            <option value="ACTIVE">Active</option>
            <option value="ENDED">Ended</option>
            <option value="ALL">All</option>
          </select>
          <button className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">Filter</button>
        </form>
        {placements.length === 0 ? (
          <EmptyState title="No placements" description="Assign an employee to a client to start collecting timesheets."
            action={<LinkButton href="/placements/new">+ Create placement</LinkButton>} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Employee</th><th>Client</th><th>Project</th><th>Start</th><th>End</th><th>Frequency</th>
                  <th className="text-right">Bill</th><th className="text-right">Pay</th><th className="text-right">Margin</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {placements.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/employees/${p.employeeId}`} className="font-medium text-slate-900 hover:text-brand-600">{fullName(p.employee)}</Link></td>
                    <td><Link href={`/clients/${p.clientId}`} className="hover:text-brand-600">{p.client.name}</Link></td>
                    <td>{p.projectName ?? "—"}</td>
                    <td>{formatDate(p.startDate)}</td>
                    <td>{formatDate(p.endDate)}</td>
                    <td>{frequencyLabel(p.timesheetFrequency)}</td>
                    <td className="text-right tabular-nums">{formatMoney(p.billRate)}</td>
                    <td className="text-right tabular-nums">{formatMoney(p.payRate)}</td>
                    <td className="text-right tabular-nums text-emerald-700">{formatMoney(p.billRate - p.payRate)}</td>
                    <td><Badge status={p.status} /></td>
                    <td><Link href={`/placements/${p.id}`} className="text-brand-600 hover:underline">Edit</Link></td>
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
