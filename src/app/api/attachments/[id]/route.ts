import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/session";
import { can } from "@/lib/auth";
import { readUpload } from "@/lib/files";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const att = await db.attachment.findFirst({
    where: { id, organizationId: session.oid },
    include: { timesheet: { include: { employee: { select: { userId: true } }, placement: { select: { clientId: true } } } } },
  });
  if (!att) return new NextResponse("Not found", { status: 404 });
  const user = await db.user.findFirst({ where: { id: session.uid, organizationId: session.oid, isActive: true } });
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const isOwner = att.timesheet.employee.userId === user.id;
  const r = user.role as Role;
  const isClientViewer = r === "CLIENT" && !!user.clientId && att.timesheet.placement.clientId === user.clientId && att.timesheet.status !== "DRAFT";
  if (!isOwner && !isClientViewer && !can(r, "timesheets.approve") && !can(r, "invoices.manage") && !can(r, "payroll.manage"))
    return new NextResponse("Forbidden", { status: 403 });

  const data = await readUpload(att.organizationId, att.storedName);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `inline; filename="${att.fileName.replace(/["\\\r\n]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
