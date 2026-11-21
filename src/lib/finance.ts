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

type InvoiceWithCandidates = InvoiceLike & {
  lines: { amount: number; timesheetId: string | null }[];
  timesheets: { id: string; employee: { id: string; firstName: string; middleName: string | null; lastName: string } }[];
};

/**
 * Splits an invoice's open balance across the candidates on it, in proportion to their
 * line amounts. Lines not tied to a timesheet (manual items) go to "Other items".
 * Per-candidate invoices map 100% to that candidate.
 */
export function balanceByCandidate(inv: InvoiceWithCandidates) {
  const bal = balanceOf(inv);
  const tsToEmp = new Map(inv.timesheets.map((t) => [t.id, t.employee]));
  const amounts = new Map<string, { id: string; name: string; amount: number }>();
  for (const l of inv.lines) {
    const e = l.timesheetId ? tsToEmp.get(l.timesheetId) : undefined;
    const key = e?.id ?? "_other";
    const name = e ? [e.firstName, e.middleName, e.lastName].filter(Boolean).join(" ") : "Other items";
    const cur = amounts.get(key) ?? { id: key, name, amount: 0 };
    cur.amount += l.amount;
    amounts.set(key, cur);
  }
  const total = [...amounts.values()].reduce((a, x) => a + x.amount, 0);
  const parts = [...amounts.values()].map((x) => ({ ...x, balance: total ? Math.round((bal * x.amount) / total) : 0 }));
  // Put any rounding remainder on the largest share so parts sum exactly to the balance.
  const diff = bal - parts.reduce((a, p) => a + p.balance, 0);
  if (diff && parts.length) parts.sort((a, b) => b.amount - a.amount)[0].balance += diff;
  return parts;
}

/** Comma-separated candidate names on an invoice. */
export function candidateNames(inv: { timesheets: { employee: { firstName: string; middleName: string | null; lastName: string } }[] }) {
  const names = [...new Set(inv.timesheets.map((t) => [t.employee.firstName, t.employee.middleName, t.employee.lastName].filter(Boolean).join(" ")))];
  return names.join(", ");
}

export const CANDIDATE_INCLUDE = {
  lines: { select: { amount: true, timesheetId: true } },
  timesheets: { select: { id: true, employee: { select: { id: true, firstName: true, middleName: true, lastName: true } } } },
} as const;
