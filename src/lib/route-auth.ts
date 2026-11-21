import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { can, type Permission } from "./auth";
import { accessFor } from "./billing";
import { SESSION_COOKIE, verifySession, type Role, type SessionPayload } from "./session";

/** Active user for a session, or null if the user is gone/disabled or the org's subscription is locked. */
export async function activeUserForSession(session: SessionPayload) {
  const user = await db.user.findFirst({
    where: { id: session.uid, organizationId: session.oid, isActive: true },
    include: { organization: true },
  });
  if (!user || accessFor(user.organization).state === "locked") return null;
  return { ...user, role: user.role as Role };
}

/** For API route handlers: the active signed-in user, or null. */
export async function routeUser() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? activeUserForSession(session) : null;
}

export async function routeStaff(perm: Permission) {
  const u = await routeUser();
  return u && can(u.role, perm) ? u : null;
}
