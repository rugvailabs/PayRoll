import "server-only";
import { db } from "./db";
import { eachDay, dateToInput, fullName } from "./format";
import { timesheetPdf } from "./pdf";
import { loadInvoiceForPdf } from "./invoicing";
import { readUpload } from "./files";

export type DocFile = { filename: string; content: Uint8Array; contentType: string };

const safeName = (s: string) => s.replace(/[^A-Za-z0-9._ -]+/g, "_").replace(/\s+/g, "-").slice(0, 80);

/** Generated PDF of one timesheet (daily hours + approval). */
export async function buildTimesheetPdf(organizationId: string, timesheetId: string): Promise<DocFile | null> {
  const ts = await db.timesheet.findFirst({
    where: { id: timesheetId, organizationId },
    include: { employee: true, placement: { include: { client: true } }, entries: true, attachments: true, organization: true },
  });
  if (!ts) return null;
  const byDay = new Map(ts.entries.map((e) => [dateToInput(e.workDate), e]));
  const bytes = await timesheetPdf({
    org: ts.organization,
    employee: { name: fullName(ts.employee), code: ts.employee.employeeCode },
    clientName: ts.placement.client.name,
    projectName: ts.placement.projectName,
    periodStart: ts.periodStart,
    periodEnd: ts.periodEnd,
    status: ts.status,
    days: eachDay(ts.periodStart, ts.periodEnd).map((d) => {
      const e = byDay.get(dateToInput(d));
      return { date: d, regularMinutes: e?.regularMinutes ?? 0, overtimeMinutes: e?.overtimeMinutes ?? 0 };
    }),
    regularMinutes: ts.regularMinutes,
    overtimeMinutes: ts.overtimeMinutes,
    submittedAt: ts.submittedAt,
    reviewedAt: ts.reviewedAt,
    reviewedBy: ts.reviewedByName,
    attachments: ts.attachments.map((a) => a.fileName),
  });
  return {
    filename: `Timesheet-${safeName(fullName(ts.employee))}-${dateToInput(ts.periodStart)}.pdf`,
    content: bytes,
    contentType: "application/pdf",
  };
}

/**
 * Everything that goes to the client with an invoice: the invoice PDF, a generated
 * PDF for each timesheet on it, and the original client-approved files uploaded by the employee.
 */
export async function invoiceBundle(organizationId: string, invoiceId: string) {
  const loaded = await loadInvoiceForPdf(organizationId, invoiceId);
  if (!loaded) return null;
  const files: DocFile[] = [{ filename: `${loaded.inv.invoiceNumber}.pdf`, content: loaded.bytes, contentType: "application/pdf" }];
  const timesheets = await db.timesheet.findMany({
    where: { organizationId, invoiceId },
    include: { attachments: true, employee: true },
    orderBy: { periodStart: "asc" },
  });
  for (const t of timesheets) {
    const pdf = await buildTimesheetPdf(organizationId, t.id);
    if (pdf) files.push(pdf);
    for (const a of t.attachments) {
      try {
        const content = await readUpload(organizationId, a.storedName);
        files.push({
          filename: `Approved-${safeName(fullName(t.employee))}-${safeName(a.fileName)}`,
          content: new Uint8Array(content),
          contentType: a.mimeType,
        });
      } catch {
        // A missing upload must not block sending the invoice.
      }
    }
  }
  return { inv: loaded.inv, files };
}
