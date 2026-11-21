import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { routeUser } from "@/lib/route-auth";
import { buildTimesheetPdf } from "@/lib/documents";

/** Timesheet PDF: staff with timesheet/invoice/payroll access, the employee who owns it, or the client it belongs to. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await routeUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const ts = await db.timesheet.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { employee: { select: { userId: true } }, placement: { select: { clientId: true } } },
  });
  if (!ts) return new Response("Not found", { status: 404 });
  const allowed =
    can(user.role, "timesheets.approve") ||
    can(user.role, "invoices.manage") ||
    can(user.role, "payroll.manage") ||
    ts.employee.userId === user.id ||
    (user.role === "CLIENT" && user.clientId === ts.placement.clientId && ts.status !== "DRAFT");
  if (!allowed) return new Response("Forbidden", { status: 403 });
  const pdf = await buildTimesheetPdf(user.organizationId, id);
  if (!pdf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(pdf.content), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
