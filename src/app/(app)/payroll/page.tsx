import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Payroll" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await requirePermission("payroll.manage");
  const { deleted } = await searchParams;
  const [runs, readyCount] = await Promise.all([
    db.payrollRun.findMany({
      where: { organizationId: user.organizationId },
      include: { _count: { select: { payslips: true } } },
      orderBy: { periodEnd: "desc" },
    }),
    db.timesheet.count({ where: { organizationId: user.organizationId, status: "APPROVED", payslipId: null } }),
  ]);
  return (
    <>
      <PageHeader title="Payroll" subtitle="Pay runs based on approved timesheets (gross pay)."
        actions={<LinkButton href="/payroll/new">+ Run payroll</LinkButton>} />
      {deleted && <div className="mb-4"><Alert tone="success">Payroll run deleted. Its timesheets are available again.</Alert></div>}
      {readyCount > 0 && (
        <div className="mb-4"><Alert tone="info">{readyCount} approved timesheet(s) are waiting to be paid. <Link href="/payroll/new" className="font-medium underline">Run payroll</Link></Alert></div>
      )}
      <Card>
        {runs.length === 0 ? (
          <EmptyState title="No payroll runs yet" action={<LinkButton href="/payroll/new">+ Run payroll</LinkButton>} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Pay period</th><th>Pay date</th><th className="text-right">Employees</th><th className="text-right">Total gross</th><th>Status</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/payroll/${r.id}`} className="font-medium text-slate-900 hover:text-brand-600">{formatDate(r.periodStart)} – {formatDate(r.periodEnd)}</Link></td>
                    <td>{formatDate(r.payDate)}</td>
                    <td className="text-right tabular-nums">{r._count.payslips}</td>
                    <td className="text-right font-medium tabular-nums">{formatMoney(r.totalGross)}</td>
                    <td><Badge status={r.status} /></td>
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
