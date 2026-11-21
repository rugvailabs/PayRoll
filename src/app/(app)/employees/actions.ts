"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { resetToTempPassword, sendInvite } from "@/lib/accounts";
import { audit } from "@/lib/notify";
import { syncSeats } from "@/lib/billing";
import { parseDate, parseMoney, str } from "@/lib/format";

export type EmployeeFormState =
  | { error?: string; fieldErrors?: Record<string, string>; tempPassword?: string; ok?: string; createdId?: string }
  | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function nextEmployeeCode(organizationId: string) {
  const count = await db.employee.count({ where: { organizationId } });
  for (let n = count + 1; ; n++) {
    const code = `EMP-${String(n).padStart(4, "0")}`;
    const exists = await db.employee.findFirst({ where: { organizationId, employeeCode: code }, select: { id: true } });
    if (!exists) return code;
  }
}

function parseEmployee(fd: FormData) {
  const fe: Record<string, string> = {};
  const firstName = str(fd.get("firstName"));
  const lastName = str(fd.get("lastName"));
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!firstName) fe.firstName = "First name is required";
  if (!lastName) fe.lastName = "Last name is required";
  if (!EMAIL_RE.test(email)) fe.email = "Enter a valid email";
  const alt = str(fd.get("alternateEmail"));
  if (alt && !EMAIL_RE.test(alt)) fe.alternateEmail = "Enter a valid email";
  const ssn = str(fd.get("ssnLast4"));
  if (ssn && !/^\d{4}$/.test(ssn)) fe.ssnLast4 = "Enter the last 4 digits";
  const bankLast4 = str(fd.get("bankAccountLast4"));
  if (bankLast4 && !/^\d{4}$/.test(bankLast4)) fe.bankAccountLast4 = "Enter the last 4 digits";
  const routing = str(fd.get("bankRouting"));
  if (routing && !/^\d{9}$/.test(routing)) fe.bankRouting = "Routing number is 9 digits";
  const payRate = parseMoney(fd.get("defaultPayRate"));
  if (isNaN(payRate)) fe.defaultPayRate = "Enter an amount like 45.00";
  const dob = parseDate(fd.get("dateOfBirth"));
  const doj = parseDate(fd.get("dateOfJoining"));

  return {
    fe,
    data: {
      firstName: firstName ?? "",
      middleName: str(fd.get("middleName")),
      lastName: lastName ?? "",
      shortName: str(fd.get("shortName")),
      email,
      alternateEmail: alt,
      phone: str(fd.get("phone")),
      dateOfBirth: dob,
      ssnLast4: ssn,
      gender: str(fd.get("gender")),
      ethnicity: str(fd.get("ethnicity")),
      maritalStatus: str(fd.get("maritalStatus")),
      veteranStatus: str(fd.get("veteranStatus")),
      jobTitleId: str(fd.get("jobTitleId")),
      departmentId: str(fd.get("departmentId")),
      employmentType: str(fd.get("employmentType")) ?? "W2",
      classification: str(fd.get("classification")) ?? "BILLABLE",
      profileType: str(fd.get("profileType")) ?? "WORKER",
      workAuthorization: str(fd.get("workAuthorization")),
      category: str(fd.get("category")),
      reportingManagerId: str(fd.get("reportingManagerId")),
      dateOfJoining: doj,
      addressLine: str(fd.get("addressLine")),
      city: str(fd.get("city")),
      state: str(fd.get("state")),
      zip: str(fd.get("zip")),
      payrollId: str(fd.get("payrollId")),
      workerId: str(fd.get("workerId")),
      payType: str(fd.get("payType")) ?? "HOURLY",
      defaultPayRate: isNaN(payRate) ? 0 : payRate,
      bankName: str(fd.get("bankName")),
      bankAccountLast4: bankLast4,
      bankRouting: routing,
      status: str(fd.get("status")) ?? "ACTIVE",
      notes: str(fd.get("notes")),
    },
  };
}

/** Make sure referenced records belong to this organization. */
async function checkRefs(organizationId: string, d: { jobTitleId: string | null; departmentId: string | null; reportingManagerId: string | null }) {
  const [jt, dept, mgr] = await Promise.all([
    d.jobTitleId ? db.jobTitle.findFirst({ where: { id: d.jobTitleId, organizationId } }) : true,
    d.departmentId ? db.department.findFirst({ where: { id: d.departmentId, organizationId } }) : true,
    d.reportingManagerId ? db.employee.findFirst({ where: { id: d.reportingManagerId, organizationId } }) : true,
  ]);
  return !!(jt && dept && mgr);
}

export async function createEmployeeAction(_: EmployeeFormState, fd: FormData): Promise<EmployeeFormState> {
  const admin = await requirePermission("employees.manage");
  const oid = admin.organizationId;
  const { fe, data } = parseEmployee(fd);

  let employeeCode = str(fd.get("employeeCode"));
  if (employeeCode && (await db.employee.findFirst({ where: { organizationId: oid, employeeCode } })))
    fe.employeeCode = "This Employee ID is already used";
  if (await db.employee.findFirst({ where: { organizationId: oid, email: data.email } }))
    fe.email = "An employee with this email already exists";

  const createLogin = fd.get("createLogin") === "on";
  const role = str(fd.get("role")) ?? "EMPLOYEE";
  const credentialMode = str(fd.get("credentialMode")) ?? "INVITE"; // INVITE | TEMP_EMAIL | TEMP_MANUAL
  if (createLogin && !["EMPLOYEE", "MANAGER", "ACCOUNTANT", "ADMIN"].includes(role)) fe.role = "Invalid role";
  if (createLogin && (await db.user.findFirst({ where: { organizationId: oid, email: data.email } })))
    fe.email = "A login with this email already exists";

  // Optional initial placement
  const placeClientId = str(fd.get("placementClientId"));
  let placement: null | {
    clientId: string; startDate: Date; billRate: number; payRate: number; otBillRate: number; otPayRate: number;
    timesheetFrequency: string; projectName: string | null; poNumber: string | null;
  } = null;
  if (placeClientId) {
    const client = await db.client.findFirst({ where: { id: placeClientId, organizationId: oid } });
    const startDate = parseDate(fd.get("placementStart")) ?? data.dateOfJoining;
    const billRate = parseMoney(fd.get("placementBillRate"));
    const payRate = parseMoney(fd.get("placementPayRate"));
    const otBill = parseMoney(fd.get("placementOtBillRate"));
    const otPay = parseMoney(fd.get("placementOtPayRate"));
    if (!client) fe.placementClientId = "Choose a client";
    if (!startDate) fe.placementStart = "Start date is required";
    if (isNaN(billRate) || billRate <= 0) fe.placementBillRate = "Enter the bill rate";
    if (isNaN(payRate) || payRate <= 0) fe.placementPayRate = "Enter the pay rate";
    if (isNaN(otBill)) fe.placementOtBillRate = "Invalid amount";
    if (isNaN(otPay)) fe.placementOtPayRate = "Invalid amount";
    if (client && startDate && !isNaN(billRate) && !isNaN(payRate)) {
      placement = {
        clientId: client.id, startDate, billRate, payRate,
        otBillRate: isNaN(otBill) ? 0 : otBill, otPayRate: isNaN(otPay) ? 0 : otPay,
        timesheetFrequency: str(fd.get("placementFrequency")) ?? client.invoiceFrequency,
        projectName: str(fd.get("placementProject")), poNumber: str(fd.get("placementPo")),
      };
    }
  }

  if (!(await checkRefs(oid, data))) return { error: "Invalid selection. Please reload the page and try again." };
  if (Object.keys(fe).length) return { fieldErrors: fe, error: "Please fix the highlighted fields." };

  employeeCode = employeeCode ?? (await nextEmployeeCode(oid));
  const employee = await db.$transaction(async (tx) => {
    let userId: string | undefined;
    if (createLogin) {
      const u = await tx.user.create({
        data: {
          organizationId: oid,
          email: data.email,
          name: `${data.firstName} ${data.lastName}`,
          role,
          mustChangePassword: true,
        },
      });
      userId = u.id;
    }
    const emp = await tx.employee.create({ data: { ...data, organizationId: oid, employeeCode: employeeCode!, userId } });
    if (placement) {
      await tx.placement.create({
        data: { ...placement, organizationId: oid, employeeId: emp.id, jobTitle: null },
      });
    }
    return emp;
  });

  await audit(oid, admin.id, "CREATE", "Employee", employee.id, `${data.firstName} ${data.lastName}`);
  await syncSeats(oid);

  let tempPassword: string | undefined;
  if (createLogin && employee.userId) {
    if (credentialMode === "INVITE") await sendInvite(employee.userId);
    else tempPassword = await resetToTempPassword(employee.userId, credentialMode === "TEMP_EMAIL");
  }
  revalidatePath("/employees");
  if (tempPassword) {
    return {
      ok: credentialMode === "TEMP_EMAIL" ? `Employee created and login details emailed to ${data.email}.` : "Employee created with a portal login.",
      tempPassword,
      createdId: employee.id,
    };
  }
  redirect(`/employees/${employee.id}?created=1${createLogin ? "&invited=1" : ""}`);
}

export async function updateEmployeeAction(_: EmployeeFormState, fd: FormData): Promise<EmployeeFormState> {
  const admin = await requirePermission("employees.manage");
  const oid = admin.organizationId;
  const id = String(fd.get("id"));
  const existing = await db.employee.findFirst({ where: { id, organizationId: oid } });
  if (!existing) return { error: "Employee not found." };

  const { fe, data } = parseEmployee(fd);
  const employeeCode = str(fd.get("employeeCode")) ?? existing.employeeCode;
  if (employeeCode !== existing.employeeCode && (await db.employee.findFirst({ where: { organizationId: oid, employeeCode } })))
    fe.employeeCode = "This Employee ID is already used";
  if (data.email !== existing.email && (await db.employee.findFirst({ where: { organizationId: oid, email: data.email } })))
    fe.email = "An employee with this email already exists";
  if (data.reportingManagerId === id) fe.reportingManagerId = "An employee cannot report to themselves";
  if (existing.userId && data.email !== existing.email &&
      (await db.user.findFirst({ where: { organizationId: oid, email: data.email, NOT: { id: existing.userId } } })))
    fe.email = "A login with this email already exists";
  if (!(await checkRefs(oid, data))) return { error: "Invalid selection. Please reload the page and try again." };
  if (Object.keys(fe).length) return { fieldErrors: fe, error: "Please fix the highlighted fields." };

  await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: {
        ...data,
        employeeCode,
        terminationDate: data.status === "TERMINATED" ? existing.terminationDate ?? new Date() : null,
      },
    });
    if (existing.userId) {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          email: data.email,
          name: `${data.firstName} ${data.lastName}`,
          // Terminated/inactive employees lose portal access.
          ...(data.status !== "ACTIVE" ? { isActive: false } : {}),
        },
      });
    }
  });
  await audit(oid, admin.id, "UPDATE", "Employee", id);
  if (existing.status !== data.status) await syncSeats(oid);
  revalidatePath(`/employees/${id}`);
  redirect(`/employees/${id}?updated=1`);
}

/** Login management from the employee profile page. */
export async function manageLoginAction(_: EmployeeFormState, fd: FormData): Promise<EmployeeFormState> {
  const admin = await requirePermission("employees.manage");
  const oid = admin.organizationId;
  const id = String(fd.get("id"));
  const op = String(fd.get("op"));
  const emp = await db.employee.findFirst({ where: { id, organizationId: oid }, include: { user: true } });
  if (!emp) return { error: "Employee not found." };

  if (op === "create") {
    if (emp.user) return { error: "This employee already has a login." };
    const role = str(fd.get("role")) ?? "EMPLOYEE";
    if (!["EMPLOYEE", "MANAGER", "ACCOUNTANT", "ADMIN"].includes(role)) return { error: "Invalid role." };
    if (await db.user.findFirst({ where: { organizationId: oid, email: emp.email } }))
      return { error: "A login with this email already exists." };
    const u = await db.user.create({
      data: { organizationId: oid, email: emp.email, name: `${emp.firstName} ${emp.lastName}`, role },
    });
    await db.employee.update({ where: { id }, data: { userId: u.id } });
    const mode = str(fd.get("credentialMode")) ?? "INVITE";
    await audit(oid, admin.id, "CREATE_LOGIN", "Employee", id);
    revalidatePath(`/employees/${id}`);
    if (mode === "INVITE") {
      await sendInvite(u.id);
      return { ok: `Invite email sent to ${emp.email}.` };
    }
    const pw = await resetToTempPassword(u.id, mode === "TEMP_EMAIL");
    return { ok: mode === "TEMP_EMAIL" ? `Login created and credentials emailed to ${emp.email}.` : "Login created.", tempPassword: pw };
  }

  if (!emp.user) return { error: "This employee has no login yet." };

  switch (op) {
    case "invite":
      await sendInvite(emp.user.id);
      await audit(oid, admin.id, "RESEND_INVITE", "Employee", id);
      return { ok: `Invite email sent to ${emp.user.email}.` };
    case "temp-email": {
      const pw = await resetToTempPassword(emp.user.id, true);
      await audit(oid, admin.id, "RESET_PASSWORD", "Employee", id, "emailed");
      return { ok: `New temporary password emailed to ${emp.user.email}.`, tempPassword: pw };
    }
    case "temp-manual": {
      const pw = await resetToTempPassword(emp.user.id, false);
      await audit(oid, admin.id, "RESET_PASSWORD", "Employee", id, "manual");
      return { ok: "Temporary password generated. Share it with the employee securely.", tempPassword: pw };
    }
    case "disable":
      if (emp.user.id === admin.id) return { error: "You cannot disable your own login." };
      await db.user.update({ where: { id: emp.user.id }, data: { isActive: false } });
      await audit(oid, admin.id, "DISABLE_LOGIN", "Employee", id);
      revalidatePath(`/employees/${id}`);
      return { ok: "Login disabled." };
    case "enable":
      await db.user.update({ where: { id: emp.user.id }, data: { isActive: true } });
      await audit(oid, admin.id, "ENABLE_LOGIN", "Employee", id);
      revalidatePath(`/employees/${id}`);
      return { ok: "Login enabled." };
    case "role": {
      const role = str(fd.get("role")) ?? "EMPLOYEE";
      if (!["EMPLOYEE", "MANAGER", "ACCOUNTANT", "ADMIN"].includes(role)) return { error: "Invalid role." };
      if (emp.user.id === admin.id && role !== "ADMIN") return { error: "You cannot remove your own admin role." };
      await db.user.update({ where: { id: emp.user.id }, data: { role } });
      await audit(oid, admin.id, "CHANGE_ROLE", "Employee", id, role);
      revalidatePath(`/employees/${id}`);
      return { ok: "Role updated." };
    }
  }
  return { error: "Unknown action." };
}
