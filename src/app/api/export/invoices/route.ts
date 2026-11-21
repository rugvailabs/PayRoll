import { db } from "@/lib/db";
import { routeStaff } from "@/lib/route-auth";
import { invoiceWhere } from "@/lib/invoice-query";
import { balanceOf, candidateNames, daysOverdue, displayStatus } from "@/lib/finance";
import { csvResponse, money, toCsv } from "@/lib/csv";
import { dateToInput, todayUtc } from "@/lib/format";

/** Invoices list as Excel CSV, using the same filters as the Invoices page. */
export async function GET(req: Request) {
  const user = await routeStaff("invoices.manage");
  if (!user) return new Response("Forbidden", { status: 403 });
  const p = new URL(req.url).searchParams;
  const invoices = await db.invoice.findMany({
    where: invoiceWhere(user.organizationId, {
      status: p.get("status") ?? "OPEN",
      q: p.get("q") ?? "",
      candidate: p.get("candidate") ?? "",
      client: p.get("client") ?? "",
    }),
    include: { client: true, timesheets: { select: { employee: { select: { firstName: true, middleName: true, lastName: true } } } } },
    orderBy: { issueDate: "desc" },
  });
  const today = todayUtc();
  const body = toCsv(
    ["Invoice #", "Candidate", "Client", "Issue date", "Due date", "Days overdue", "Total", "Paid", "Balance", "Status"],
    invoices.map((i) => {
      const st = displayStatus(i);
      return [
        i.invoiceNumber, candidateNames(i), i.client.name, dateToInput(i.issueDate), dateToInput(i.dueDate),
        st === "OVERDUE" ? daysOverdue(i, today) : 0, money(i.total), money(i.amountPaid),
        money(i.status === "VOID" ? 0 : balanceOf(i)), st,
      ];
    }),
  );
  return csvResponse(`invoices-${dateToInput(today)}.csv`, body);
}
