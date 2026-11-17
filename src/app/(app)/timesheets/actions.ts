"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { audit, notifyRoles, notifyUsers } from "@/lib/notify";
import { emailLayout, esc, sendEmail } from "@/lib/email";
import { deleteUpload, saveUpload, validateUpload } from "@/lib/files";
import { dateToInput, eachDay, formatDate, formatMinutes, fullName, parseDate, parseHours, periodFor, str } from "@/lib/format";
import { EDITABLE_STATUSES, inPlacement } from "@/lib/timesheets";

export type TsState = { error?: string; ok?: string } | undefined;

async function loadForUser(id: string) {
  const user = await requireUser();
  const ts = await db.timesheet.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { placement: { include: { client: true } }, employee: true, attachments: true },
  });
  if (!ts) return { user, ts: null, isOwner: false, isApprover: false };
  const isOwner = !!user.employee && user.employee.id === ts.employeeId;
  const isApprover = can(user.role, "timesheets.approve");
  return { user, ts, isOwner, isApprover };
}

const editorPath = (id: string, isOwner: boolean, isApprover: boolean) =>
  isOwner && !isApprover ? `/my/timesheets/${id}` : `/timesheets/${id}`;

/** Find or create the draft timesheet for a placement + period, then open the editor. */
export async function startTimesheetAction(fd: FormData) {
  const user = await requireUser();
  const placementId = String(fd.get("placementId") ?? "");
  const startInput = parseDate(fd.get("periodStart"));
  const placement = await db.placement.findFirst({
    where: { id: placementId, organizationId: user.organizationId },
  });
  if (!placement || !startInput) redirect("/my/timesheets?error=invalid");
  const isOwner = user.employee?.id === placement.employeeId;
  const isApprover = can(user.role, "timesheets.approve");
  if (!isOwner && !isApprover) redirect("/dashboard?denied=1");

  const period = periodFor(placement.timesheetFrequency, startInput);
  let ts = await db.timesheet.findUnique({
    where: { placementId_periodStart_periodEnd: { placementId, periodStart: period.start, periodEnd: period.end } },
  });
  if (!ts) {
    ts = await db.timesheet.create({
      data: {
        organizationId: user.organizationId,
        employeeId: placement.employeeId,
        placementId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    });
  }
  redirect(editorPath(ts.id, isOwner, isApprover));
}

export async function saveTimesheetAction(_: TsState, fd: FormData): Promise<TsState> {
  const id = String(fd.get("id"));
  const intent = String(fd.get("intent") ?? "save"); // save | submit | approve
  const { user, ts, isOwner, isApprover } = await loadForUser(id);
  if (!ts) return { error: "Timesheet not found." };
  if (!isOwner && !isApprover) return { error: "You do not have access to this timesheet." };
  if (!EDITABLE_STATUSES.includes(ts.status)) return { error: "This timesheet can no longer be edited." };
  if (intent === "approve" && !isApprover) return { error: "You cannot approve timesheets." };

  const entries: { workDate: Date; regularMinutes: number; overtimeMinutes: number }[] = [];
  for (const day of eachDay(ts.periodStart, ts.periodEnd)) {
    const key = dateToInput(day);
    const reg = parseHours(fd.get(`reg_${key}`));
    const ot = parseHours(fd.get(`ot_${key}`));
    if (isNaN(reg) || isNaN(ot)) return { error: `Invalid hours on ${formatDate(day)}. Use numbers like 8, 7.5 or 7:30.` };
    if (reg + ot > 24 * 60) return { error: `More than 24 hours entered on ${formatDate(day)}.` };
    if ((reg || ot) && !inPlacement(ts.placement, day))
      return { error: `${formatDate(day)} is outside the placement dates.` };
    if (reg || ot) entries.push({ workDate: day, regularMinutes: reg, overtimeMinutes: ot });
  }
  const regularMinutes = entries.reduce((a, e) => a + e.regularMinutes, 0);
  const overtimeMinutes = entries.reduce((a, e) => a + e.overtimeMinutes, 0);
  const totalMinutes = regularMinutes + overtimeMinutes;
  const note = str(fd.get("employeeNote"));

  if (intent !== "save") {
    if (totalMinutes === 0) return { error: "Enter hours before submitting." };
    if (ts.attachments.length === 0) return { error: "Attach the client-approved timesheet before submitting." };
  }

  const now = new Date();
  const newStatus = intent === "approve" ? "APPROVED" : intent === "submit" ? "SUBMITTED" : ts.status;
  await db.$transaction([
    db.timesheetEntry.deleteMany({ where: { timesheetId: id } }),
    db.timesheetEntry.createMany({ data: entries.map((e) => ({ ...e, timesheetId: id })) }),
    db.timesheet.update({
      where: { id },
      data: {
        regularMinutes,
        overtimeMinutes,
        totalMinutes,
        billableMinutes: totalMinutes,
        employeeNote: note,
        status: newStatus,
        ...(intent !== "save" ? { submittedAt: now } : {}),
        ...(intent === "approve" ? { reviewedAt: now, reviewedById: user.id, reviewNote: null } : {}),
      },
    }),
  ]);

  const who = fullName(ts.employee);
  const period = `${formatDate(ts.periodStart)} – ${formatDate(ts.periodEnd)}`;
  if (intent === "submit") {
    await notifyRoles(user.organizationId, ["ADMIN", "MANAGER"], {
      type: "TIMESHEET_SUBMITTED",
      title: `Timesheet submitted: ${who}`,
      body: `${ts.placement.client.name} · ${period} · ${formatMinutes(totalMinutes)} hrs`,
      link: `/timesheets/${id}`,
    });
  }
  await audit(user.organizationId, user.id, intent.toUpperCase(), "Timesheet", id);
  revalidatePath("/timesheets");
  revalidatePath("/my/timesheets");
  if (intent === "save") return { ok: "Draft saved." };
  redirect(isOwner && !isApprover ? `/my/timesheets?submitted=1` : `/timesheets/${id}?done=${intent}`);
}

export async function uploadAttachmentAction(_: TsState, fd: FormData): Promise<TsState> {
  const id = String(fd.get("id"));
  const { user, ts, isOwner, isApprover } = await loadForUser(id);
  if (!ts) return { error: "Timesheet not found." };
  if (!isOwner && !isApprover) return { error: "You do not have access to this timesheet." };
  if (!EDITABLE_STATUSES.includes(ts.status)) return { error: "This timesheet can no longer be edited." };
  const file = fd.get("file");
  if (!(file instanceof File)) return { error: "Choose a file to upload." };
  const err = validateUpload(file);
  if (err) return { error: err };
  if (ts.attachments.length >= 10) return { error: "Maximum 10 attachments per timesheet." };
  const storedName = await saveUpload(user.organizationId, file);
  await db.attachment.create({
    data: {
      organizationId: user.organizationId,
      timesheetId: id,
      fileName: file.name.slice(0, 200),
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: user.id,
    },
  });
  revalidatePath(editorPath(id, isOwner, isApprover));
  return { ok: "File attached." };
}

export async function deleteAttachmentAction(fd: FormData) {
  const attId = String(fd.get("attachmentId"));
  const user = await requireUser();
  const att = await db.attachment.findFirst({
    where: { id: attId, organizationId: user.organizationId },
    include: { timesheet: true },
  });
  if (!att) return;
  const isOwner = user.employee?.id === att.timesheet.employeeId;
  const isApprover = can(user.role, "timesheets.approve");
  if ((!isOwner && !isApprover) || !EDITABLE_STATUSES.includes(att.timesheet.status)) return;
  await db.attachment.delete({ where: { id: att.id } });
  await deleteUpload(user.organizationId, att.storedName);
  revalidatePath(editorPath(att.timesheetId, isOwner, isApprover));
}

export async function reviewTimesheetAction(_: TsState, fd: FormData): Promise<TsState> {
  const id = String(fd.get("id"));
  const decision = String(fd.get("decision")); // approve | reject | reopen
  const note = str(fd.get("reviewNote"));
  const { user, ts, isApprover } = await loadForUser(id);
  if (!ts) return { error: "Timesheet not found." };
  if (!isApprover) return { error: "You cannot review timesheets." };

  if (decision === "reopen") {
    if (ts.status !== "APPROVED" && ts.status !== "SUBMITTED") return { error: "Only submitted or approved timesheets can be reopened." };
    if (ts.invoiceId || ts.payslipId) return { error: "This timesheet is already on an invoice or payroll. Remove it there first." };
    await db.timesheet.update({ where: { id }, data: { status: "DRAFT", reviewedAt: null, reviewedById: null } });
    await audit(user.organizationId, user.id, "REOPEN", "Timesheet", id);
    revalidatePath(`/timesheets/${id}`);
    return { ok: "Timesheet moved back to draft." };
  }

  if (ts.status !== "SUBMITTED") return { error: "Only submitted timesheets can be approved or rejected." };
  if (decision === "reject" && !note) return { error: "Add a reason so the employee knows what to fix." };
  const approved = decision === "approve";
  await db.timesheet.update({
    where: { id },
    data: { status: approved ? "APPROVED" : "REJECTED", reviewNote: note, reviewedAt: new Date(), reviewedById: user.id },
  });
  await audit(user.organizationId, user.id, approved ? "APPROVE" : "REJECT", "Timesheet", id, note ?? undefined);

  // Tell the employee.
  const period = `${formatDate(ts.periodStart)} – ${formatDate(ts.periodEnd)}`;
  const title = approved ? "Timesheet approved" : "Timesheet rejected";
  const empUser = ts.employee.userId;
  if (empUser) {
    await notifyUsers(user.organizationId, [empUser], {
      type: approved ? "TIMESHEET_APPROVED" : "TIMESHEET_REJECTED",
      title,
      body: `${ts.placement.client.name} · ${period}${note ? ` · ${note}` : ""}`,
      link: `/my/timesheets/${id}`,
    });
  }
  await sendEmail({
    organizationId: user.organizationId,
    to: ts.employee.email,
    subject: `${title}: ${period}`,
    type: approved ? "TIMESHEET_APPROVED" : "TIMESHEET_REJECTED",
    relatedId: id,
    html: emailLayout(
      user.organization.name,
      title,
      `<p>Hello ${esc(ts.employee.firstName)},</p>
       <p>Your timesheet for <b>${esc(ts.placement.client.name)}</b> (${esc(period)}, ${formatMinutes(ts.totalMinutes)} hours) was <b>${approved ? "approved" : "rejected"}</b>.</p>
       ${note ? `<p><b>Note:</b> ${esc(note)}</p>` : ""}
       ${approved ? "" : "<p>Please correct it and submit again.</p>"}`,
      { label: "Open timesheet", url: `${process.env.APP_URL}/my/timesheets/${id}` },
    ),
  });
  revalidatePath("/timesheets");
  return { ok: approved ? "Timesheet approved." : "Timesheet rejected and the employee was notified." };
}

/** Approve several submitted timesheets at once from the list page. */
export async function bulkApproveAction(fd: FormData) {
  const user = await requireUser();
  if (!can(user.role, "timesheets.approve")) return;
  const ids = fd.getAll("ids").map(String);
  if (!ids.length) return;
  const sheets = await db.timesheet.findMany({
    where: { id: { in: ids }, organizationId: user.organizationId, status: "SUBMITTED" },
    include: { employee: true, placement: { include: { client: true } } },
  });
  const now = new Date();
  await db.timesheet.updateMany({
    where: { id: { in: sheets.map((s) => s.id) } },
    data: { status: "APPROVED", reviewedAt: now, reviewedById: user.id },
  });
  for (const s of sheets) {
    if (s.employee.userId)
      await notifyUsers(user.organizationId, [s.employee.userId], {
        type: "TIMESHEET_APPROVED",
        title: "Timesheet approved",
        body: `${s.placement.client.name} · ${formatDate(s.periodStart)} – ${formatDate(s.periodEnd)}`,
        link: `/my/timesheets/${s.id}`,
      });
    await audit(user.organizationId, user.id, "APPROVE", "Timesheet", s.id, "bulk");
  }
  revalidatePath("/timesheets");
  redirect(`/timesheets?status=SUBMITTED&approved=${sheets.length}`);
}
