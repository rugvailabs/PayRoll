"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClientUser } from "@/lib/auth";
import { audit, notifyRoles, notifyUsers } from "@/lib/notify";
import { emailLayout, esc, sendEmail } from "@/lib/email";
import { formatDate, formatMinutes, fullName, str } from "@/lib/format";

export type ClientState = { error?: string; ok?: string } | undefined;

/** Client approver approves or rejects a submitted timesheet for their own consultants. */
export async function clientReviewAction(_: ClientState, fd: FormData): Promise<ClientState> {
  const user = await requireClientUser();
  if (!user.client.portalApproval) return { error: "Online approval is not enabled for your company." };
  const id = String(fd.get("id"));
  const decision = String(fd.get("decision"));
  const note = str(fd.get("reviewNote"));
  const ts = await db.timesheet.findFirst({
    where: { id, organizationId: user.organizationId, placement: { clientId: user.client.id } },
    include: { employee: true, placement: { include: { client: true } } },
  });
  if (!ts) return { error: "Timesheet not found." };
  if (ts.status !== "SUBMITTED") return { error: "This timesheet has already been reviewed." };
  if (decision !== "approve" && decision !== "reject") return { error: "Unknown action." };
  if (decision === "reject" && !note) return { error: "Please add a reason so the consultant knows what to correct." };

  const approved = decision === "approve";
  await db.timesheet.update({
    where: { id },
    data: {
      status: approved ? "APPROVED" : "REJECTED",
      reviewNote: note,
      reviewedAt: new Date(),
      reviewedById: user.id,
      reviewedByName: `${user.name} (${user.client.name})`,
    },
  });
  await audit(user.organizationId, user.id, approved ? "CLIENT_APPROVE" : "CLIENT_REJECT", "Timesheet", id, note ?? undefined);

  const period = `${formatDate(ts.periodStart)} – ${formatDate(ts.periodEnd)}`;
  const who = fullName(ts.employee);
  const title = approved ? "Timesheet approved by client" : "Timesheet rejected by client";
  // Tell the staffing company's admins/managers and the consultant.
  await notifyRoles(user.organizationId, ["ADMIN", "MANAGER"], {
    type: approved ? "TIMESHEET_APPROVED" : "TIMESHEET_REJECTED",
    title: `${title}: ${who}`,
    body: `${user.client.name} · ${period} · ${formatMinutes(ts.totalMinutes)} hrs${note ? ` · ${note}` : ""}`,
    link: `/timesheets/${id}`,
  });
  if (ts.employee.userId) {
    await notifyUsers(user.organizationId, [ts.employee.userId], {
      type: approved ? "TIMESHEET_APPROVED" : "TIMESHEET_REJECTED",
      title,
      body: `${user.client.name} · ${period}${note ? ` · ${note}` : ""}`,
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
       <p>Your timesheet for <b>${esc(user.client.name)}</b> (${esc(period)}) was <b>${approved ? "approved" : "rejected"}</b> by ${esc(user.name)}.</p>
       ${note ? `<p><b>Note:</b> ${esc(note)}</p>` : ""}${approved ? "" : "<p>Please correct it and submit again.</p>"}`,
      { label: "Open timesheet", url: `${process.env.APP_URL}/my/timesheets/${id}` },
    ),
  });
  revalidatePath("/client/timesheets");
  return { ok: approved ? "Timesheet approved. Thank you." : "Timesheet rejected. The consultant has been notified." };
}

export async function clientMarkAllReadAction() {
  const user = await requireClientUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/client/notifications");
}
