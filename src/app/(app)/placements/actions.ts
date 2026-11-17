"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/notify";
import { parseDate, parseMoney, str } from "@/lib/format";

export type PlacementFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function savePlacementAction(_: PlacementFormState, fd: FormData): Promise<PlacementFormState> {
  const user = await requirePermission("placements.manage");
  const oid = user.organizationId;
  const id = str(fd.get("id"));
  const fe: Record<string, string> = {};

  const existing = id ? await db.placement.findFirst({ where: { id, organizationId: oid } }) : null;
  if (id && !existing) return { error: "Placement not found." };

  const employeeId = existing?.employeeId ?? str(fd.get("employeeId"));
  const clientId = existing?.clientId ?? str(fd.get("clientId"));
  const [employee, client] = await Promise.all([
    employeeId ? db.employee.findFirst({ where: { id: employeeId, organizationId: oid } }) : null,
    clientId ? db.client.findFirst({ where: { id: clientId, organizationId: oid } }) : null,
  ]);
  if (!employee) fe.employeeId = "Choose an employee";
  if (!client) fe.clientId = "Choose a client";

  const startDate = parseDate(fd.get("startDate"));
  const endDate = parseDate(fd.get("endDate"));
  if (!startDate) fe.startDate = "Start date is required";
  if (startDate && endDate && endDate < startDate) fe.endDate = "End date must be after start date";

  const billRate = parseMoney(fd.get("billRate"));
  const payRate = parseMoney(fd.get("payRate"));
  const otBillRate = parseMoney(fd.get("otBillRate"));
  const otPayRate = parseMoney(fd.get("otPayRate"));
  if (isNaN(billRate) || billRate <= 0) fe.billRate = "Enter the hourly bill rate";
  if (isNaN(payRate) || payRate <= 0) fe.payRate = "Enter the hourly pay rate";
  if (isNaN(otBillRate)) fe.otBillRate = "Invalid amount";
  if (isNaN(otPayRate)) fe.otPayRate = "Invalid amount";
  const freq = str(fd.get("timesheetFrequency")) ?? "MONTHLY";
  if (!["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY"].includes(freq)) fe.timesheetFrequency = "Invalid";

  if (Object.keys(fe).length) return { fieldErrors: fe, error: "Please fix the highlighted fields." };

  const data = {
    jobTitle: str(fd.get("jobTitle")),
    projectName: str(fd.get("projectName")),
    poNumber: str(fd.get("poNumber")),
    startDate: startDate!,
    endDate,
    timesheetFrequency: freq,
    billRate,
    payRate,
    otBillRate,
    otPayRate,
    status: str(fd.get("status")) === "ENDED" ? "ENDED" : "ACTIVE",
  };

  let pid: string;
  if (existing) {
    await db.placement.update({ where: { id: existing.id }, data });
    pid = existing.id;
    await audit(oid, user.id, "UPDATE", "Placement", pid);
  } else {
    const p = await db.placement.create({ data: { ...data, organizationId: oid, employeeId: employee!.id, clientId: client!.id } });
    pid = p.id;
    await audit(oid, user.id, "CREATE", "Placement", pid, `${employee!.firstName} ${employee!.lastName} @ ${client!.name}`);
  }
  revalidatePath("/placements");
  const back = str(fd.get("returnTo"));
  redirect(back && back.startsWith("/") && !back.startsWith("//") ? back : `/placements?saved=1`);
}
