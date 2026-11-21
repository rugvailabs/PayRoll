import { activeUserForSession } from "@/lib/route-auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/session";
import { formatDate, fullName } from "@/lib/format";
import { payslipPdf } from "@/lib/pdf";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const user = await activeUserForSession(session);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const s = await db.payslip.findFirst({
    where: { id, organizationId: session.oid },
    include: {
      employee: true,
      payrollRun: true,
      organization: true,
      timesheets: { include: { placement: { include: { client: true } } } },
    },
  });
  if (!s) return new NextResponse("Not found", { status: 404 });
  const isOwner = s.employee.userId === user.id;
  if (!isOwner && !can(user.role as Role, "payroll.manage")) return new NextResponse("Forbidden", { status: 403 });
  // Employees only see statements once payroll is paid.
  if (isOwner && !can(user.role as Role, "payroll.manage") && s.status !== "PAID") return new NextResponse("Not found", { status: 404 });

  const bytes = await payslipPdf({
    org: s.organization,
    employee: { name: fullName(s.employee), code: s.employee.employeeCode, email: s.employee.email },
    periodStart: s.payrollRun.periodStart,
    periodEnd: s.payrollRun.periodEnd,
    payDate: s.payrollRun.payDate,
    regularMinutes: s.regularMinutes,
    overtimeMinutes: s.overtimeMinutes,
    regularPay: s.regularPay,
    overtimePay: s.overtimePay,
    adjustments: s.adjustments,
    grossPay: s.grossPay,
    status: s.status,
    lines: s.timesheets.map((t) => ({
      client: t.placement.client.name,
      period: `${formatDate(t.periodStart)} - ${formatDate(t.periodEnd)}`,
      minutes: t.totalMinutes,
    })),
  });
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="pay-statement.pdf"`, "Cache-Control": "private, no-store" },
  });
}
