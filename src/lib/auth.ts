import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { SESSION_COOKIE, verifySession, type Role } from "./session";

export type Permission =
  | "employees.manage"
  | "employees.view"
  | "clients.manage"
  | "clients.view"
  | "placements.manage"
  | "timesheets.approve"
  | "invoices.manage"
  | "payments.manage"
  | "payroll.manage"
  | "reports.view"
  | "settings.manage";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "employees.manage", "employees.view", "clients.manage", "clients.view",
    "placements.manage", "timesheets.approve", "invoices.manage", "payments.manage",
    "payroll.manage", "reports.view", "settings.manage",
  ],
  MANAGER: [
    "employees.manage", "employees.view", "clients.manage", "clients.view",
    "placements.manage", "timesheets.approve", "reports.view",
  ],
  ACCOUNTANT: [
    "employees.view", "clients.view", "invoices.manage", "payments.manage",
    "payroll.manage", "reports.view",
  ],
  EMPLOYEE: [],
};

export function can(role: Role, perm: Permission) {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export const getSession = cache(async () => {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
});

/** Returns the signed-in, active user (with org). Redirects to /login otherwise. */
export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await db.user.findFirst({
    where: { id: session.uid, organizationId: session.oid, isActive: true },
    include: { organization: true, employee: true },
  });
  if (!user) redirect("/login");
  return { ...user, role: user.role as Role };
});

export async function requirePermission(perm: Permission) {
  const user = await requireUser();
  if (!can(user.role, perm)) redirect("/dashboard?denied=1");
  return user;
}
