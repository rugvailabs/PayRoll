import "server-only";
import { db } from "@/lib/db";
import { dateToInput, formatDate, fullName } from "@/lib/format";
import { recentPeriods } from "@/lib/timesheets";
import type { PickerPlacement } from "./period-picker";

/** Active placements with their recent periods, for the "start timesheet" picker. */
export async function pickerPlacements(organizationId: string, employeeId?: string): Promise<PickerPlacement[]> {
  const placements = await db.placement.findMany({
    where: { organizationId, status: "ACTIVE", ...(employeeId ? { employeeId } : {}), employee: { status: "ACTIVE" } },
    include: { client: true, employee: true, timesheets: { select: { periodStart: true, status: true } } },
    orderBy: [{ employee: { firstName: "asc" } }],
  });
  return placements.map((p) => {
    const existing = new Map(p.timesheets.map((t) => [dateToInput(t.periodStart), t.status]));
    return {
      id: p.id,
      label: employeeId ? `${p.client.name}${p.projectName ? ` · ${p.projectName}` : ""}` : `${fullName(p.employee)} — ${p.client.name}`,
      periods: recentPeriods(p).map((r) => ({
        start: dateToInput(r.start),
        label: `${formatDate(r.start)} – ${formatDate(r.end)}`,
        status: existing.get(dateToInput(r.start)),
      })),
    };
  });
}
