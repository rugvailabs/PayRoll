"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { Paperclip, Trash2, Upload } from "lucide-react";
import { Alert, Card, CardHeader, cn, Legend } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { deleteAttachmentAction, saveTimesheetAction, uploadAttachmentAction, type TsState } from "./actions";

type Day = { key: string; label: string; dow: string; weekend: boolean; inRange: boolean; reg: string; ot: string };
type Att = { id: string; fileName: string; size: number; createdAt: string };

function toMinutes(s: string) {
  const v = s.trim();
  if (!v) return 0;
  if (/^\d{1,2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(":").map(Number);
    return h * 60 + m;
  }
  const n = parseFloat(v);
  return isNaN(n) ? 0 : Math.round(n * 60);
}
const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export function TimesheetEditor({
  id,
  days,
  editable,
  canApprove,
  note,
  attachments,
}: {
  id: string;
  days: Day[];
  editable: boolean;
  canApprove: boolean;
  note: string;
  attachments: Att[];
}) {
  const [state, action] = useActionState<TsState, FormData>(saveTimesheetAction, undefined);
  const [upState, upAction] = useActionState<TsState, FormData>(uploadAttachmentAction, undefined);
  const [values, setValues] = useState(() => Object.fromEntries(days.map((d) => [d.key, { reg: d.reg, ot: d.ot }])));
  const intentRef = useRef<HTMLInputElement>(null);
  const setIntent = (v: string) => { if (intentRef.current) intentRef.current.value = v; };

  const totals = useMemo(() => {
    let reg = 0, ot = 0;
    for (const v of Object.values(values)) {
      reg += toMinutes(v.reg);
      ot += toMinutes(v.ot);
    }
    return { reg, ot, total: reg + ot };
  }, [values]);

  const fillWeekdays = () =>
    setValues((prev) => {
      const next = { ...prev };
      for (const d of days) if (!d.weekend && d.inRange && !next[d.key].reg) next[d.key] = { ...next[d.key], reg: "8" };
      return next;
    });

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <form action={action} className="xl:col-span-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="intent" ref={intentRef} defaultValue="save" />
        <div className="mb-3">
          <Legend
            items={[
              { label: "Weekend", tone: "slate" },
              { label: "Draft", tone: "slate" },
              { label: "Submitted", tone: "blue" },
              { label: "Approved", tone: "green" },
              { label: "Rejected", tone: "red" },
            ]}
          />
        </div>
        <Card>
          <CardHeader
            title="Daily hours"
            subtitle={editable ? "Enter hours as 8, 7.5 or 7:30" : "Read only"}
            actions={editable && (
              <button type="button" onClick={fillWeekdays} className="text-sm font-medium text-brand-600 hover:underline">
                Fill weekdays with 8h
              </button>
            )}
          />
          {state?.error && <div className="px-5 pt-4"><Alert tone="error">{state.error}</Alert></div>}
          {state?.ok && <div className="px-5 pt-4"><Alert tone="success">{state.ok}</Alert></div>}
          <div className="table-wrap max-h-[560px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 z-10">
                <tr><th>Date</th><th>Day</th><th className="w-32">Regular</th><th className="w-32">Overtime</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const v = values[d.key];
                  const dayTotal = toMinutes(v.reg) + toMinutes(v.ot);
                  return (
                    <tr key={d.key} className={cn(d.weekend && "bg-slate-50/80", !d.inRange && "opacity-40")}>
                      <td className="font-medium">{d.label}</td>
                      <td className={cn(d.weekend ? "text-slate-400" : "text-slate-600")}>{d.dow}</td>
                      <td className="py-1.5">
                        <input
                          name={`reg_${d.key}`}
                          value={v.reg}
                          disabled={!editable || !d.inRange}
                          inputMode="decimal"
                          onChange={(e) => setValues((p) => ({ ...p, [d.key]: { ...p[d.key], reg: e.target.value } }))}
                          className="control h-8 w-24 py-1 text-right tabular-nums"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-1.5">
                        <input
                          name={`ot_${d.key}`}
                          value={v.ot}
                          disabled={!editable || !d.inRange}
                          inputMode="decimal"
                          onChange={(e) => setValues((p) => ({ ...p, [d.key]: { ...p[d.key], ot: e.target.value } }))}
                          className="control h-8 w-24 py-1 text-right tabular-nums"
                          placeholder="0"
                        />
                      </td>
                      <td className="text-right tabular-nums text-slate-500">{dayTotal ? fmt(dayTotal) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold text-slate-900">
                  <td className="px-4 py-3" colSpan={2}>Total</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(totals.reg)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(totals.ot)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="border-t border-slate-100 p-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="employeeNote">Comments</label>
            <textarea id="employeeNote" name="employeeNote" defaultValue={note} disabled={!editable} className="control min-h-16" />
          </div>
          {editable && (
            <div className="flex flex-wrap justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-5 py-4">
              <SubmitButton onClick={() => setIntent("save")} variant="warning">Save draft</SubmitButton>
              {canApprove ? (
                <SubmitButton onClick={() => setIntent("approve")} variant="success" pendingText="Approving…">Save &amp; approve</SubmitButton>
              ) : (
                <SubmitButton onClick={() => setIntent("submit")} variant="success" pendingText="Submitting…">Submit for approval</SubmitButton>
              )}
            </div>
          )}
        </Card>
      </form>

      <Card className="h-fit">
        <CardHeader title="Client-approved timesheet" subtitle="Required before submitting" />
        <div className="space-y-3 p-5">
          {upState?.error && <Alert tone="error">{upState.error}</Alert>}
          {upState?.ok && <Alert tone="success">{upState.ok}</Alert>}
          {attachments.length === 0 && <p className="text-sm text-slate-500">No files attached yet.</p>}
          <ul className="space-y-2">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <Paperclip size={15} className="shrink-0 text-slate-400" />
                <a href={`/api/attachments/${a.id}`} target="_blank" className="flex-1 truncate text-brand-600 hover:underline">
                  {a.fileName}
                </a>
                <span className="text-xs text-slate-400">{(a.size / 1024).toFixed(0)} KB</span>
                {editable && (
                  <form action={deleteAttachmentAction}>
                    <input type="hidden" name="attachmentId" value={a.id} />
                    <button className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove file">
                      <Trash2 size={14} />
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {editable && (
            <form action={upAction} className="space-y-2">
              <input type="hidden" name="id" value={id} />
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 hover:border-brand-300 hover:bg-brand-50/40">
                <Upload size={20} className="text-slate-400" />
                <span>Choose a PDF, image, Excel or Word file</span>
                <span className="text-xs">Max 10 MB</span>
                <input type="file" name="file" className="mt-2 text-xs" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc" required />
              </label>
              <SubmitButton variant="secondary" className="w-full" pendingText="Uploading…">Upload file</SubmitButton>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
