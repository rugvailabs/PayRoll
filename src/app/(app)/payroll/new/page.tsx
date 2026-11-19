import type { Metadata } from "next";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { addDays, dateToInput, parseDate, todayUtc } from "@/lib/format";
import { payrollPreview } from "@/lib/payroll";
import { CreateRunForm } from "../run-forms";

export const metadata: Metadata = { title: "Run Payroll" };

export default async function NewPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; payDate?: string; salaried?: string }>;
}) {
  const user = await requirePermission("payroll.manage");
  const sp = await searchParams;
  const today = todayUtc();
  const defStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const defEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  const start = parseDate(sp.start ?? "") ?? defStart;
  const end = parseDate(sp.end ?? "") ?? defEnd;
  const payDate = parseDate(sp.payDate ?? "") ?? addDays(end, 7);
  const salaried = sp.salaried === "on";
  const loaded = !!sp.start;
  const rows = loaded ? await payrollPreview(user.organizationId, start, end, salaried) : [];

  return (
    <>
      <PageHeader title="Run payroll" subtitle="Pay employees for approved timesheets in a period." back={{ href: "/payroll", label: "Payroll" }} />
      <Card className="mb-6">
        <CardBody>
          <form className="flex flex-wrap items-end gap-4">
            {[
              ["start", "Period start", dateToInput(start)],
              ["end", "Period end", dateToInput(end)],
              ["payDate", "Pay date", dateToInput(payDate)],
            ].map(([n, l, v]) => (
              <div key={n}>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={n}>{l}</label>
                <input id={n} name={n} type="date" defaultValue={v} className="control" required />
              </div>
            ))}
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" name="salaried" defaultChecked={salaried} className="h-4 w-4 accent-brand-600" />
              Include salaried employees
            </label>
            <button className="inline-flex h-9 items-center rounded-lg bg-white px-3.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:bg-slate-50 hover:text-slate-900">Load employees</button>
          </form>
        </CardBody>
      </Card>
      {loaded && (
        <CreateRunForm
          start={dateToInput(start)}
          end={dateToInput(end)}
          payDate={dateToInput(payDate)}
          includeSalaried={salaried}
          rows={rows.map((r) => ({ ...r, timesheets: r.timesheetIds.length }))}
        />
      )}
    </>
  );
}
