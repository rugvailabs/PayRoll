import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate, formatMinutes, formatMoney } from "./format";

const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const BRAND = rgb(0.06, 0.16, 0.29);
const LINE = rgb(0.88, 0.9, 0.93);

type Ctx = { page: PDFPage; font: PDFFont; bold: PDFFont };

// pdf-lib standard fonts only support WinAnsi; strip anything else.
const safe = (s: string | null | undefined) => (s ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

function text(c: Ctx, s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; right?: boolean } = {}) {
  const size = o.size ?? 10;
  const f = o.bold ? c.bold : c.font;
  const str = safe(s);
  const w = f.widthOfTextAtSize(str, size);
  c.page.drawText(str, { x: o.right ? x - w : x, y, size, font: f, color: o.color ?? INK });
}

function header(c: Ctx, orgName: string, orgLines: string[], title: string) {
  const { width, height } = c.page.getSize();
  c.page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: BRAND });
  text(c, orgName, 40, height - 45, { size: 18, bold: true, color: rgb(1, 1, 1) });
  orgLines.forEach((l, i) => text(c, l, 40, height - 62 - i * 11, { size: 8.5, color: rgb(0.8, 0.85, 0.92) }));
  text(c, title, width - 40, height - 50, { size: 20, bold: true, color: rgb(1, 1, 1), right: true });
}

type Org = { name: string; address?: string | null; city?: string | null; state?: string | null; zip?: string | null; email?: string | null; phone?: string | null };
const orgLines = (o: Org) =>
  [o.address, [o.city, o.state, o.zip].filter(Boolean).join(", "), [o.email, o.phone].filter(Boolean).join("  |  ")].filter((l): l is string => !!l);

export async function invoicePdf(inv: {
  org: Org;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
  client: { name: string; billingContactName: string | null; addressLine: string | null; city: string | null; state: string | null; zip: string | null; billingEmail: string };
  lines: { description: string; minutes: number; rate: number; amount: number }[];
  total: number;
  amountPaid: number;
  notes: string | null;
  termsDays: number;
}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([612, 792]);
  let c: Ctx = { page, font, bold };
  header(c, inv.org.name, orgLines(inv.org), "INVOICE");

  let y = 670;
  text(c, "BILL TO", 40, y, { size: 8, bold: true, color: MUTED });
  const billLines = [inv.client.name, inv.client.billingContactName, inv.client.addressLine,
    [inv.client.city, inv.client.state, inv.client.zip].filter(Boolean).join(", "), inv.client.billingEmail].filter(Boolean) as string[];
  billLines.forEach((l, i) => text(c, l, 40, y - 15 - i * 13, { size: 10, bold: i === 0 }));

  const meta: [string, string][] = [
    ["Invoice #", inv.invoiceNumber],
    ["Issue date", formatDate(inv.issueDate)],
    ["Due date", formatDate(inv.dueDate)],
    ["Terms", `Net ${inv.termsDays}`],
  ];
  if (inv.periodStart && inv.periodEnd) meta.push(["Service period", `${formatDate(inv.periodStart)} - ${formatDate(inv.periodEnd)}`]);
  meta.forEach(([k, v], i) => {
    text(c, k, 400, y - i * 15, { size: 9, color: MUTED });
    text(c, v, 572, y - i * 15, { size: 9, bold: true, right: true });
  });

  y = 560;
  const drawTableHeader = () => {
    c.page.drawRectangle({ x: 40, y: y - 6, width: 532, height: 22, color: rgb(0.96, 0.97, 0.98) });
    text(c, "DESCRIPTION", 48, y, { size: 8, bold: true, color: MUTED });
    text(c, "HOURS", 400, y, { size: 8, bold: true, color: MUTED, right: true });
    text(c, "RATE", 480, y, { size: 8, bold: true, color: MUTED, right: true });
    text(c, "AMOUNT", 564, y, { size: 8, bold: true, color: MUTED, right: true });
    y -= 26;
  };
  drawTableHeader();
  for (const l of inv.lines) {
    if (y < 140) {
      page = doc.addPage([612, 792]);
      c = { page, font, bold };
      y = 740;
      drawTableHeader();
    }
    const desc = l.description.length > 62 ? l.description.slice(0, 60) + "..." : l.description;
    text(c, desc, 48, y, { size: 9.5 });
    text(c, l.minutes ? formatMinutes(l.minutes) : "", 400, y, { size: 9.5, right: true });
    text(c, l.rate ? formatMoney(l.rate) : "", 480, y, { size: 9.5, right: true });
    text(c, formatMoney(l.amount), 564, y, { size: 9.5, right: true });
    c.page.drawLine({ start: { x: 40, y: y - 8 }, end: { x: 572, y: y - 8 }, thickness: 0.5, color: LINE });
    y -= 22;
  }

  y -= 10;
  const totals: [string, string, boolean][] = [
    ["Total", formatMoney(inv.total), true],
    ["Paid", formatMoney(inv.amountPaid), false],
    ["Balance due", formatMoney(inv.total - inv.amountPaid), true],
  ];
  totals.forEach(([k, v, b], i) => {
    text(c, k, 470, y - i * 17, { size: 10, bold: b, color: b ? INK : MUTED, right: true });
    text(c, v, 564, y - i * 17, { size: 10, bold: b, right: true });
  });

  if (inv.notes) {
    text(c, "NOTES", 40, 110, { size: 8, bold: true, color: MUTED });
    safe(inv.notes).split(/\r?\n/).slice(0, 4).forEach((l, i) => text(c, l.slice(0, 110), 40, 96 - i * 12, { size: 9 }));
  }
  text(c, `Thank you for your business. Please reference ${inv.invoiceNumber} with your payment.`, 40, 40, { size: 8.5, color: MUTED });
  return doc.save();
}

export async function payslipPdf(p: {
  org: Org;
  employee: { name: string; code: string; email: string };
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  regularMinutes: number;
  overtimeMinutes: number;
  regularPay: number;
  overtimePay: number;
  adjustments: number;
  grossPay: number;
  status: string;
  lines: { client: string; period: string; minutes: number }[];
}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  const c: Ctx = { page, font, bold };
  header(c, p.org.name, orgLines(p.org), "PAY STATEMENT");

  let y = 670;
  text(c, "EMPLOYEE", 40, y, { size: 8, bold: true, color: MUTED });
  text(c, p.employee.name, 40, y - 15, { size: 11, bold: true });
  text(c, `ID: ${p.employee.code}`, 40, y - 29, { size: 9 });
  text(c, p.employee.email, 40, y - 42, { size: 9 });
  ([
    ["Pay period", `${formatDate(p.periodStart)} - ${formatDate(p.periodEnd)}`],
    ["Pay date", formatDate(p.payDate)],
    ["Status", p.status === "PAID" ? "Paid" : "Pending"],
  ] as const).forEach(([k, v], i) => {
    text(c, k, 400, y - i * 15, { size: 9, color: MUTED });
    text(c, v, 572, y - i * 15, { size: 9, bold: true, right: true });
  });

  y = 580;
  c.page.drawRectangle({ x: 40, y: y - 6, width: 532, height: 22, color: rgb(0.96, 0.97, 0.98) });
  text(c, "EARNINGS", 48, y, { size: 8, bold: true, color: MUTED });
  text(c, "HOURS", 460, y, { size: 8, bold: true, color: MUTED, right: true });
  text(c, "AMOUNT", 564, y, { size: 8, bold: true, color: MUTED, right: true });
  y -= 26;
  const rows: [string, string, number][] = [
    ["Regular", formatMinutes(p.regularMinutes), p.regularPay],
    ["Overtime", formatMinutes(p.overtimeMinutes), p.overtimePay],
  ];
  if (p.adjustments) rows.push(["Adjustments", "", p.adjustments]);
  for (const [k, h, a] of rows) {
    text(c, k, 48, y, { size: 10 });
    text(c, h, 460, y, { size: 10, right: true });
    text(c, formatMoney(a), 564, y, { size: 10, right: true });
    c.page.drawLine({ start: { x: 40, y: y - 8 }, end: { x: 572, y: y - 8 }, thickness: 0.5, color: LINE });
    y -= 22;
  }
  y -= 6;
  text(c, "Gross pay", 470, y, { size: 12, bold: true, right: true });
  text(c, formatMoney(p.grossPay), 564, y, { size: 12, bold: true, right: true });

  y -= 40;
  text(c, "HOURS BY ASSIGNMENT", 40, y, { size: 8, bold: true, color: MUTED });
  y -= 16;
  for (const l of p.lines.slice(0, 20)) {
    text(c, `${l.client}  (${l.period})`, 48, y, { size: 9 });
    text(c, formatMinutes(l.minutes), 564, y, { size: 9, right: true });
    y -= 14;
  }
  text(c, "Gross earnings only. Tax withholdings and deductions are processed by your payroll provider.", 40, 40, { size: 8, color: MUTED });
  return doc.save();
}
