import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileText, Users } from "lucide-react";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, fullName } from "@/lib/format";
import { balanceOf, displayStatus } from "@/lib/finance";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/my");
  const q = ((await searchParams).q ?? "").trim();
  const oid = user.organizationId;
  const has = q.length > 0;

  const [employees, clients, invoices] = has
    ? await Promise.all([
        can(user.role, "employees.view")
          ? db.employee.findMany({
              where: {
                organizationId: oid,
                OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }, { employeeCode: { contains: q } }],
              },
              include: { jobTitle: true },
              take: 10,
            })
          : [],
        can(user.role, "clients.view")
          ? db.client.findMany({
              where: { organizationId: oid, OR: [{ name: { contains: q } }, { clientCode: { contains: q } }, { billingEmail: { contains: q } }] },
              take: 10,
            })
          : [],
        can(user.role, "invoices.manage")
          ? db.invoice.findMany({
              where: { organizationId: oid, OR: [{ invoiceNumber: { contains: q } }, { client: { name: { contains: q } } }] },
              include: { client: true },
              orderBy: { issueDate: "desc" },
              take: 10,
            })
          : [],
      ])
    : [[], [], []];
  const total = employees.length + clients.length + invoices.length;

  return (
    <>
      <PageHeader title="Search" subtitle={has ? `${total} result(s) for “${q}”` : "Type in the search box above."} />
      {has && total === 0 && (
        <Card><EmptyState title="No matches" description="Try a name, email, employee ID, client code or invoice number." /></Card>
      )}
      <div className="grid gap-6 xl:grid-cols-3">
        {employees.length > 0 && (
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Users size={16} className="text-slate-400" /> Employees</span>} />
            <ul className="divide-y divide-slate-100">
              {employees.map((e) => (
                <li key={e.id}>
                  <Link href={`/employees/${e.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <Avatar name={fullName(e)} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{fullName(e)}</span>
                      <span className="block truncate text-xs text-slate-500">{e.employeeCode} · {e.jobTitle?.name ?? e.email}</span>
                    </span>
                    <Badge status={e.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {clients.length > 0 && (
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Building2 size={16} className="text-slate-400" /> Clients</span>} />
            <ul className="divide-y divide-slate-100">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                      <span className="block truncate text-xs text-slate-500">{c.clientCode} · {c.billingEmail}</span>
                    </span>
                    <Badge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {invoices.length > 0 && (
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><FileText size={16} className="text-slate-400" /> Invoices</span>} />
            <ul className="divide-y divide-slate-100">
              {invoices.map((i) => (
                <li key={i.id}>
                  <Link href={`/invoices/${i.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{i.invoiceNumber} · {i.client.name}</span>
                      <span className="block truncate text-xs text-slate-500">Due {formatDate(i.dueDate)} · balance {formatMoney(balanceOf(i))}</span>
                    </span>
                    <Badge status={displayStatus(i)} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
