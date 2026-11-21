import type { Prisma } from "@prisma/client";
import { todayUtc } from "./format";

/** Shared invoice list filters (used by the page and the Excel export so both match). */
export function invoiceWhere(
  organizationId: string,
  f: { status?: string; q?: string; candidate?: string; client?: string },
): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { organizationId };
  const status = f.status ?? "OPEN";
  if (status === "OPEN") where.status = { in: ["SENT", "PARTIAL"] };
  else if (status === "OVERDUE") Object.assign(where, { status: { in: ["SENT", "PARTIAL"] }, dueDate: { lt: todayUtc() } });
  else if (status !== "ALL") where.status = status;
  const q = f.q?.trim();
  if (q) where.OR = [{ invoiceNumber: { contains: q } }, { client: { name: { contains: q } } }];
  if (f.candidate) where.timesheets = { some: { employeeId: f.candidate } };
  if (f.client) where.clientId = f.client;
  return where;
}
