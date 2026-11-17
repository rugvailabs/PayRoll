import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardHeader, PageHeader, Tabs } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { addLookupAction, removeLookupAction } from "./actions";
import { OrgForm } from "./org-form";

export const metadata: Metadata = { title: "Settings" };

function LookupCard({ title, kind, items }: { title: string; kind: string; items: { id: string; name: string; _count: { employees: number } }[] }) {
  return (
    <Card>
      <CardHeader title={title} />
      <ul className="divide-y divide-slate-100">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <span>{i.name} <span className="text-xs text-slate-400">({i._count.employees})</span></span>
            {i._count.employees === 0 && (
              <form action={removeLookupAction}>
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="id" value={i.id} />
                <button className="text-xs text-slate-400 hover:text-red-600">Remove</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <form action={addLookupAction} className="flex gap-2 border-t border-slate-100 p-4">
        <input type="hidden" name="kind" value={kind} />
        <input name="name" placeholder={`New ${title.toLowerCase().replace(/s$/, "")}`} className="control" required />
        <button className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">Add</button>
      </form>
    </Card>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("settings.manage");
  const { tab = "general" } = await searchParams;
  const oid = user.organizationId;
  const org = user.organization;

  const d: Record<string, string> = {};
  for (const [k, v] of Object.entries(org)) if (v !== null && !(v instanceof Date)) d[k] = String(v);

  const [departments, jobTitles, users] = await Promise.all([
    tab === "lists" ? db.department.findMany({ where: { organizationId: oid }, orderBy: { name: "asc" }, include: { _count: { select: { employees: true } } } }) : [],
    tab === "lists" ? db.jobTitle.findMany({ where: { organizationId: oid }, orderBy: { name: "asc" }, include: { _count: { select: { employees: true } } } }) : [],
    tab === "users" ? db.user.findMany({ where: { organizationId: oid }, include: { employee: true }, orderBy: { name: "asc" } }) : [],
  ]);

  return (
    <>
      <PageHeader title="Settings" subtitle={org.name} />
      <Tabs
        active={tab}
        tabs={[
          { key: "general", label: "General & alerts", href: "/settings" },
          { key: "lists", label: "Departments & job titles", href: "/settings?tab=lists" },
          { key: "users", label: "Users & roles", href: "/settings?tab=users" },
        ]}
      />
      {tab === "general" && <OrgForm d={d} />}
      {tab === "lists" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <LookupCard title="Departments" kind="department" items={departments} />
          <LookupCard title="Job titles" kind="jobTitle" items={jobTitles} />
        </div>
      )}
      {tab === "users" && (
        <Card>
          <CardHeader title="Portal users" subtitle="Manage an employee's login and role from their employee profile." />
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th>Status</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.employee ? <Link href={`/employees/${u.employee.id}`} className="font-medium hover:text-brand-600">{u.name}</Link> : <span className="font-medium">{u.name}</span>}</td>
                    <td>{u.email}</td>
                    <td>{u.role.charAt(0) + u.role.slice(1).toLowerCase()}</td>
                    <td>{formatDateTime(u.lastLoginAt)}</td>
                    <td><Badge status={u.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
