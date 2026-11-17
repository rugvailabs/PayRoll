"use client";

import { useState } from "react";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { startTimesheetAction } from "./actions";

export type PickerPlacement = {
  id: string;
  label: string;
  periods: { start: string; label: string; status?: string }[];
};

export function PeriodPicker({ placements }: { placements: PickerPlacement[] }) {
  const [pid, setPid] = useState(placements[0]?.id ?? "");
  const current = placements.find((p) => p.id === pid);
  return (
    <form action={startTimesheetAction} className="space-y-4">
      <Field label="Assignment (client)" htmlFor="placementId" required>
        <select id="placementId" name="placementId" className="control" value={pid} onChange={(e) => setPid(e.target.value)} required>
          {placements.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Timesheet period" htmlFor="periodStart" required>
        <select id="periodStart" name="periodStart" className="control" key={pid} required>
          {current?.periods.map((p) => (
            <option key={p.start} value={p.start}>
              {p.label}{p.status ? ` — ${p.status.toLowerCase()}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <SubmitButton className="w-full" pendingText="Opening…">Continue</SubmitButton>
    </form>
  );
}
