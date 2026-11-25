import { Badge, Card, CardBody, DescList, StatPill } from "@/components/ui";
import { dateToInput, eachDay, formatDate, formatDateTime, formatMinutes, frequencyLabel, fullName, minutesToInput } from "@/lib/format";
import { inPlacement } from "@/lib/timesheets";
import type { Attachment, Client, Employee, Placement, Timesheet, TimesheetEntry } from "@prisma/client";

export type FullTimesheet = Timesheet & {
  employee: Employee;
  placement: Placement & { client: Client };
  entries: TimesheetEntry[];
  attachments: Attachment[];
};

export const TIMESHEET_INCLUDE = {
  employee: true,
  placement: { include: { client: true } },
  entries: true,
  attachments: { orderBy: { createdAt: "asc" as const } },
};

export function editorDays(ts: FullTimesheet) {
  const byDay = new Map(ts.entries.map((e) => [dateToInput(e.workDate), e]));
  return eachDay(ts.periodStart, ts.periodEnd).map((d) => {
    const key = dateToInput(d);
    const e = byDay.get(key);
    const dowIdx = d.getUTCDay();
    return {
      key,
      label: d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
      dow: d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" }),
      weekend: dowIdx === 0 || dowIdx === 6,
      inRange: inPlacement(ts.placement, d),
      reg: e ? minutesToInput(e.regularMinutes) : "",
      ot: e ? minutesToInput(e.overtimeMinutes) : "",
    };
  });
}

export function editorAttachments(ts: FullTimesheet) {
  return ts.attachments.map((a) => ({ id: a.id, fileName: a.fileName, size: a.size, createdAt: a.createdAt.toISOString() }));
}

export function TimesheetSummary({ ts }: { ts: FullTimesheet }) {
  return (
    <Card className="mb-6">
      <CardBody>
        <DescList
          items={[
            { label: "Employee", value: `${fullName(ts.employee)} (${ts.employee.employeeCode})` },
            { label: "Client", value: ts.placement.client.name },
            { label: "Period", value: `${formatDate(ts.periodStart)} – ${formatDate(ts.periodEnd)}` },
            { label: "Frequency", value: frequencyLabel(ts.placement.timesheetFrequency) },
            { label: "Status", value: <Badge status={ts.status} /> },
            { label: "Submitted", value: formatDateTime(ts.submittedAt) },
            { label: "Reviewed", value: ts.reviewedAt ? `${formatDateTime(ts.reviewedAt)}${ts.reviewedByName ? ` by ${ts.reviewedByName}` : ""}` : null },
            { label: "Project", value: ts.placement.projectName },
          ]}
        />
        <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          <StatPill label="Total" value={formatMinutes(ts.totalMinutes)} tone="purple" />
          <StatPill label="Billable" value={formatMinutes(ts.billableMinutes)} tone="green" />
          <StatPill label="Regular" value={formatMinutes(ts.regularMinutes)} tone="amber" />
          <StatPill label="Overtime" value={formatMinutes(ts.overtimeMinutes)} tone="blue" />
        </div>
      </CardBody>
    </Card>
  );
}
