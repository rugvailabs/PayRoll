import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { requireClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMinutes, formatMoney, frequencyLabel, fullName } from "@/lib/format";

export const metadata: Metadata = { title: "Our Consultants" };

export default async function ClientEmployeesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireClientUser();
  const { show = "current" } = await searchParams;
  const placements = await db.placement.findMany({
    where: { organizationId: user.organizationId, clientId: user.client.id, ...(show === "all" ? {} : { status: "ACTIVE" }) },
    include: {
      employee: { include: { jobTitle: true } },
      timesheets: { where: { status: "APPROVED" }, select: { totalMinutes: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  const total = await db.placement.count({ where: { organizationId: user.organizationId, clientId: user.client.id } });

  return (
    <>
      <PageHeader title="Our consultants" subtitle={`Consultants from ${user.organization.name} working at ${user.client.name}.`} />
      <Tabs
        active={show}
        tabs={[
          { key: "current", label: "Current", href: "/client/employees" },
          { key: "all", label: "All (incl. past)", href: "/client/employees?show=all", count: total },
        ]}
      />
      <Card>
        {placements.length === 0 ? (
          <EmptyState title="No consultants" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Consultant</th><th>Role</th><th>Project</th><th>PO #</th><th>Start</th><th>End</th><th>Timesheets</th>
                  <th className="text-right">Rate / hr</th><th className="text-right">Approved hours</th><th>Status</th></tr>
              </thead>
              <tbody>
                {placements.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={fullName(p.employee)} size="sm" />
                        <span>
                          <span className="block font-medium text-slate-900">{fullName(p.employee)}</span>
                          <span className="block text-xs text-slate-500">{p.employee.email}</span>
                        </span>
                      </span>
                    </td>
                    <td>{p.jobTitle ?? p.employee.jobTitle?.name ?? "—"}</td>
                    <td>{p.projectName ?? "—"}</td>
                    <td>{p.poNumber ?? "—"}</td>
                    <td>{formatDate(p.startDate)}</td>
                    <td>{formatDate(p.endDate)}</td>
                    <td>{frequencyLabel(p.timesheetFrequency)}</td>
                    <td className="text-right tabular-nums">{formatMoney(p.billRate)}</td>
                    <td className="text-right tabular-nums">{formatMinutes(p.timesheets.reduce((a, t) => a + t.totalMinutes, 0))}</td>
                    <td><Badge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        Need a change to an assignment? Contact {user.organization.name}
        {user.organization.email ? ` at ${user.organization.email}` : ""}. <Link href="/client/timesheets" className="text-brand-600 hover:underline">View timesheets</Link>
      </p>
    </>
  );
}
