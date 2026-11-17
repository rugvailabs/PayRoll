import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMinutes, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "My Pay Statements" };

export default async function MyPayslipsPage() {
  const user = await requireUser();
  if (!user.employee) redirect("/dashboard");
  const slips = await db.payslip.findMany({
    where: { employeeId: user.employee.id, organizationId: user.organizationId, status: "PAID" },
    include: { payrollRun: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHeader title="My pay statements" subtitle="Gross earnings for each pay period." />
      <Card>
        {slips.length === 0 ? (
          <EmptyState title="No pay statements yet" description="They appear here once your payroll is processed." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Pay period</th><th>Pay date</th><th className="text-right">Hours</th><th className="text-right">Gross pay</th><th /></tr></thead>
              <tbody>
                {slips.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{formatDate(s.payrollRun.periodStart)} – {formatDate(s.payrollRun.periodEnd)}</td>
                    <td>{formatDate(s.payrollRun.payDate)}</td>
                    <td className="text-right tabular-nums">{formatMinutes(s.regularMinutes + s.overtimeMinutes)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatMoney(s.grossPay)}</td>
                    <td><a href={`/api/payslips/${s.id}/pdf`} target="_blank" className="text-brand-600 hover:underline">Download PDF</a></td>
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
