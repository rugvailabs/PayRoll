import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { accessFor } from "./billing";
import { homeFor, SESSION_COOKIE, verifySession, type Role } from "./session";

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
  CLIENT: [],
};

export function can(role: Role, perm: Permission) {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export const getSession = cache(async () => {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
});

/** Signed-in, active user (with org) WITHOUT the subscription check. Only for billing pages. */
export const requireUserAllowLocked = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await db.user.findFirst({
    where: { id: session.uid, organizationId: session.oid, isActive: true },
    include: { organization: true, employee: true, client: true },
  });
  if (!user) redirect("/login");
  return { ...user, role: user.role as Role };
});

/**
 * Signed-in, active user whose organization has an active subscription.
 * Locked organizations: admins go to /billing, everyone else to /suspended.
 */
export const requireUser = cache(async () => {
  const user = await requireUserAllowLocked();
  if (accessFor(user.organization).state === "locked") redirect(user.role === "ADMIN" ? "/billing" : "/suspended");
  return user;
});

export async function requirePermission(perm: Permission) {
  const user = await requireUser();
  if (user.role === "CLIENT") redirect("/client");
  if (!can(user.role, perm)) redirect("/dashboard?denied=1");
  return user;
}

/** Signed-in client-portal user with their client company. */
export async function requireClientUser() {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.client || user.client.status !== "ACTIVE") redirect(user.role === "CLIENT" ? "/api/logout?reason=inactive" : homeFor(user.role));
  return { ...user, client: user.client };
}

export { homeFor } from "./session";
