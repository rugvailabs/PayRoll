import "server-only";
import { addDays, periodFor, todayUtc } from "./format";

/** Recent timesheet periods for a placement (newest first), clipped to its start/end dates. */
export function recentPeriods(
  placement: { timesheetFrequency: string; startDate: Date; endDate: Date | null },
  count = 8,
) {
  const out: { start: Date; end: Date }[] = [];
  let cursor = todayUtc();
  if (placement.endDate && placement.endDate < cursor) cursor = placement.endDate;
  for (let i = 0; i < count; i++) {
    const p = periodFor(placement.timesheetFrequency, cursor);
    if (p.end < placement.startDate) break;
    out.push(p);
    cursor = addDays(p.start, -1);
  }
  return out;
}

/** Is a given date inside the placement's active range? */
export function inPlacement(placement: { startDate: Date; endDate: Date | null }, d: Date) {
  return d >= placement.startDate && (!placement.endDate || d <= placement.endDate);
}

export const EDITABLE_STATUSES = ["DRAFT", "REJECTED"];
