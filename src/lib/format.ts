// Money is stored as integer cents; hours as integer minutes; dates as UTC midnight.

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);
}

/** "12.50" -> 1250. Returns NaN for invalid input. */
export function parseMoney(input: FormDataEntryValue | null | undefined): number {
  const s = String(input ?? "").replace(/[$,\s]/g, "");
  if (s === "") return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

export function centsToInput(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toFixed(2);
}

/** 6720 -> "112:00" */
export function formatMinutes(min: number) {
  const m = Math.max(0, Math.round(min || 0));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** Accepts "8", "8.5", "8:30". Returns minutes or NaN. */
export function parseHours(input: FormDataEntryValue | null | undefined): number {
  const s = String(input ?? "").trim();
  if (s === "") return 0;
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    if (m >= 60) return NaN;
    return h * 60 + m;
  }
  if (/^\d{1,2}(\.\d{1,2})?$/.test(s)) return Math.round(parseFloat(s) * 60);
  return NaN;
}

export function minutesToInput(min: number) {
  if (!min) return "";
  const h = min / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, "");
}

/** "2025-12-01" -> Date at UTC midnight. Returns null for empty/invalid. */
export function parseDate(input: FormDataEntryValue | null | undefined): Date | null {
  const s = String(input ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function dateToInput(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { timeZone: "UTC", month: "2-digit", day: "2-digit", year: "numeric" });
}

export function formatDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function todayUtc() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}

export function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

export function fullName(e: { firstName: string; middleName?: string | null; lastName: string }) {
  return [e.firstName, e.middleName, e.lastName].filter(Boolean).join(" ");
}

export function str(v: FormDataEntryValue | null | undefined) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Bi-weekly" },
  { value: "SEMIMONTHLY", label: "Semi-monthly" },
  { value: "MONTHLY", label: "Monthly" },
];

export function frequencyLabel(v: string) {
  return FREQUENCIES.find((f) => f.value === v)?.label ?? v;
}

/** Period containing `date` for the given timesheet frequency. */
export function periodFor(frequency: string, date: Date): { start: Date; end: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  if (frequency === "MONTHLY") {
    return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 0)) };
  }
  if (frequency === "SEMIMONTHLY") {
    return d <= 15
      ? { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m, 15)) }
      : { start: new Date(Date.UTC(y, m, 16)), end: new Date(Date.UTC(y, m + 1, 0)) };
  }
  // Weeks run Monday–Sunday.
  const dow = (date.getUTCDay() + 6) % 7;
  const monday = addDays(new Date(Date.UTC(y, m, d)), -dow);
  if (frequency === "BIWEEKLY") {
    // Anchor bi-weekly periods to Monday 2024-01-01.
    const anchor = Date.UTC(2024, 0, 1);
    const weeks = Math.floor((monday.getTime() - anchor) / (7 * 86400000));
    const start = weeks % 2 === 0 ? monday : addDays(monday, -7);
    return { start, end: addDays(start, 13) };
  }
  return { start: monday, end: addDays(monday, 6) };
}

export function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) out.push(new Date(t));
  return out;
}
