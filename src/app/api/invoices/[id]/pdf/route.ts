import { activeUserForSession } from "@/lib/route-auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/session";
import { loadInvoiceForPdf } from "@/lib/invoicing";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const user = await activeUserForSession(session);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  // Staff with invoice access, or a client user downloading their own company's sent invoice.
  if (!can(user.role as Role, "invoices.manage")) {
    const own = user.role === "CLIENT" && user.clientId
      ? await db.invoice.findFirst({ where: { id, organizationId: session.oid, clientId: user.clientId, status: { in: ["SENT", "PARTIAL", "PAID"] } } })
      : null;
    if (!own) return new NextResponse("Forbidden", { status: 403 });
  }
  const loaded = await loadInvoiceForPdf(session.oid, id);
  if (!loaded) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(loaded.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${loaded.inv.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
