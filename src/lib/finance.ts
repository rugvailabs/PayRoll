import { daysBetween, todayUtc } from "./format";

type InvoiceLike = { status: string; total: number; amountPaid: number; dueDate: Date; onHold?: boolean };

export const balanceOf = (i: InvoiceLike) => Math.max(0, i.total - i.amountPaid);

/** Status as shown to users: SENT/PARTIAL invoices past due become OVERDUE. */
export function displayStatus(i: InvoiceLike): string {
  if (i.status === "SENT" || i.status === "PARTIAL") {
    if (i.onHold) return "ON_HOLD";
    if (balanceOf(i) > 0 && daysBetween(i.dueDate, todayUtc()) > 0) return "OVERDUE";
  }
  return i.status;
}

export const daysOverdue = (i: InvoiceLike, today = todayUtc()) => Math.max(0, daysBetween(i.dueDate, today));

export const AGING_BUCKETS = [
  { key: "current", label: "Current (not due)" },
  { key: "1-30", label: "1–30 days" },
  { key: "31-60", label: "31–60 days" },
  { key: "61-90", label: "61–90 days" },
  { key: "90+", label: "90+ days" },
] as const;
export type BucketKey = (typeof AGING_BUCKETS)[number]["key"];

export function agingBucket(i: InvoiceLike, today = todayUtc()): BucketKey {
  const d = daysBetween(i.dueDate, today);
  if (d <= 0) return "current";
  if (d <= 30) return "1-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "90+";
}

/** Invoices that still have money owed (sent, not void). */
export const OPEN_INVOICE_WHERE = { status: { in: ["SENT", "PARTIAL"] } };
