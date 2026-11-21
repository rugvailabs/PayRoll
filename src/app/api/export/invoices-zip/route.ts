import JSZip from "jszip";
import { db } from "@/lib/db";
import { routeStaff } from "@/lib/route-auth";
import { invoiceBundle } from "@/lib/documents";
import { dateToInput, todayUtc } from "@/lib/format";

/** ZIP of the selected invoices: one folder each with the invoice PDF, timesheet PDFs and approved sheets. */
export async function GET(req: Request) {
  const user = await routeStaff("invoices.manage");
  if (!user) return new Response("Forbidden", { status: 403 });
  const ids = new URL(req.url).searchParams.getAll("ids").slice(0, 200);
  if (!ids.length) return new Response("Select at least one invoice.", { status: 400 });
  const invoices = await db.invoice.findMany({
    where: { id: { in: ids }, organizationId: user.organizationId },
    select: { id: true, invoiceNumber: true },
  });
  if (!invoices.length) return new Response("Not found", { status: 404 });
  const zip = new JSZip();
  for (const inv of invoices) {
    const bundle = await invoiceBundle(user.organizationId, inv.id);
    if (!bundle) continue;
    const folder = zip.folder(inv.invoiceNumber)!;
    for (const f of bundle.files) folder.file(f.filename, f.content);
  }
  const data = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="invoices-${dateToInput(todayUtc())}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
