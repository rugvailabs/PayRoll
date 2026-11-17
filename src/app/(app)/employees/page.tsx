import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Badge, Card, EmptyState, LinkButton, PageHeader, Tabs } from "@/components/ui";
import { can, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, fullName } from "@/lib/format";
import { employmentTypeLabel } from "@/lib/options";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; client?: string }>;
}) {
  const user = await requirePermission("employees.view");
  const oid = user.organizationId;
  const { q = "", status = "ACTIVE", client = "" } = await searchParams;

  const where: Prisma.EmployeeWhereInput = { organizationId: oid };
  if (status !== "ALL") where.status = status;
  if (q.trim()) {
    const s = q.trim();
    where.OR = [
      { firstName: { contains: s } },
      { lastName: { contains: s } },
      { email: { contains: s } },
      { employeeCode: { contains: s } },
    ];
  }
  if (client) where.placements = { some: { clientId: client, status: "ACTIVE" } };

  const [employees, counts, clients] = await Promise.all([
    db.employee.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: {
        jobTitle: true,
        user: { select: { isActive: true, passwordHash: true, lastLoginAt: true } },
        placements: { where: { status: "ACTIVE" }, include: { client: { select: { name: true } } } },
      },
      take: 500,
    }),
    db.employee.groupBy({ by: ["status"], where: { organizationId: oid }, _count: true }),
    db.client.findMany({ where: { organizationId: oid }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const total = counts.reduce((a, c) => a + c._count, 0);
  const qs = (s: string) => `/employees?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}${client ? `&client=${client}` : ""}`;

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="All employees and consultants in your organization."
        actions={can(user.role, "employees.manage") && <LinkButton href="/employees/new">+ Add employee</LinkButton>}
      />
      <Tabs
        active={status}
        tabs={[
          { key: "ACTIVE", label: "Active", href: qs("ACTIVE"), count: countOf("ACTIVE") },
          { key: "INACTIVE", label: "Inactive", href: qs("INACTIVE"), count: countOf("INACTIVE") },
          { key: "TERMINATED", label: "Terminated", href: qs("TERMINATED"), count: countOf("TERMINATED") },
          { key: "ALL", label: "All", href: qs("ALL"), count: total },
        ]}
      />
      <Card>
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Search name, email or employee ID…" className="control max-w-xs" />
          <select name="client" defaultValue={client} className="control max-w-56">
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-900">Filter</button>
          {(q || client) && (
            <Link href={`/employees?status=${status}`} className="self-center text-sm text-slate-500 hover:underline">Clear</Link>
          )}
        </form>
        {employees.length === 0 ? (
          <EmptyState
            title="No employees found"
            description={q || client ? "Try a different search or filter." : "Add your first employee to get started."}
            action={can(user.role, "employees.manage") && !q && <LinkButton href="/employees/new">+ Add employee</LinkButton>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Job title</th>
                  <th>Type</th>
                  <th>Current client</th>
                  <th>Joined</th>
                  <th>Portal login</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/employees/${e.id}`} className="flex items-center gap-3">
                        <Avatar name={fullName(e)} size="sm" />
                        <span>
                          <span className="block font-medium text-slate-900 hover:text-brand-600">{fullName(e)}</span>
                          <span className="block text-xs text-slate-500">{e.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{e.employeeCode}</td>
                    <td>{e.jobTitle?.name ?? "—"}</td>
                    <td>{employmentTypeLabel(e.employmentType)}</td>
                    <td>{e.placements.map((p) => p.client.name).join(", ") || <span className="text-slate-400">Bench</span>}</td>
                    <td>{formatDate(e.dateOfJoining)}</td>
                    <td>
                      {!e.user ? (
                        <span className="text-xs text-slate-400">No login</span>
                      ) : !e.user.isActive ? (
                        <Badge status="INACTIVE">Disabled</Badge>
                      ) : e.user.lastLoginAt ? (
                        <Badge status="ACTIVE">Active</Badge>
                      ) : (
                        <Badge status="SENT">Invited</Badge>
                      )}
                    </td>
                    <td><Badge status={e.status} /></td>
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
