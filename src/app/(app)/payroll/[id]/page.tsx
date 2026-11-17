import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsToInput, formatDate, formatMinutes, formatMoney, fullName } from "@/lib/format";
import { AdjustForm, RunActions } from "../run-forms";

export const metadata: Metadata = { title: "Payroll Run" };

export default async function PayrollRunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requirePermission("payroll.manage");
  const { id } = await params;
  const { created } = await searchParams;
  const run = await db.payrollRun.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { payslips: { include: { employee: true, _count: { select: { timesheets: true } } }, orderBy: { employee: { firstName: "asc" } } } },
  });
  if (!run) notFound();
  const hours = run.payslips.reduce((a, s) => a + s.regularMinutes + s.overtimeMinutes, 0);

  return (
    <>
      <PageHeader
        back={{ href: "/payroll", label: "Payroll" }}
        title={<span className="flex items-center gap-3">Payroll {formatDate(run.periodStart)} – {formatDate(run.periodEnd)} <Badge status={run.status} /></span>}
        subtitle={`Pay date ${formatDate(run.payDate)}`}
      />
      {created && <div className="mb-4"><Alert tone="success">Payroll run created as a draft. Review, adjust if needed, then approve.</Alert></div>}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Employees" value={run.payslips.length} tone="blue" />
        <StatCard label="Hours" value={formatMinutes(hours)} tone="slate" />
        <StatCard label="Total gross" value={formatMoney(run.totalGross)} tone="green" />
      </div>
      <Card className="mb-6"><CardBody><RunActions id={run.id} status={run.status} /></CardBody></Card>
      <Card>
        <CardHeader title="Pay statements" subtitle={run.status === "DRAFT" ? "Use adjustments for bonuses or corrections (negative to deduct)." : undefined} />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Employee</th><th>Employee ID</th><th className="text-right">Timesheets</th><th className="text-right">Regular</th><th className="text-right">OT</th>
                <th className="text-right">Regular pay</th><th className="text-right">OT pay</th><th className="text-right">Adjustments</th><th className="text-right">Gross pay</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {run.payslips.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/employees/${s.employeeId}?tab=pay`} className="font-medium text-slate-900 hover:text-brand-600">{fullName(s.employee)}</Link></td>
                  <td className="font-mono text-xs">{s.employee.employeeCode}</td>
                  <td className="text-right tabular-nums">{s._count.timesheets}</td>
                  <td className="text-right tabular-nums">{formatMinutes(s.regularMinutes)}</td>
                  <td className="text-right tabular-nums">{formatMinutes(s.overtimeMinutes)}</td>
                  <td className="text-right tabular-nums">{formatMoney(s.regularPay)}</td>
                  <td className="text-right tabular-nums">{formatMoney(s.overtimePay)}</td>
                  <td className="text-right tabular-nums">
                    {run.status === "DRAFT" ? <AdjustForm payslipId={s.id} value={centsToInput(s.adjustments)} /> : formatMoney(s.adjustments)}
                  </td>
                  <td className="text-right font-semibold tabular-nums">{formatMoney(s.grossPay)}</td>
                  <td><Badge status={s.status} /></td>
                  <td><a href={`/api/payslips/${s.id}/pdf`} target="_blank" className="text-brand-600 hover:underline">PDF</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
