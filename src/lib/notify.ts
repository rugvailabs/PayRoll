import "server-only";
import { db } from "./db";

/** In-app notification for specific users. */
export async function notifyUsers(
  organizationId: string,
  userIds: string[],
  n: { type: string; title: string; body: string; link?: string },
) {
  if (userIds.length === 0) return;
  await db.notification.createMany({
    data: userIds.map((userId) => ({ organizationId, userId, ...n })),
  });
}

/** In-app notification for all active users with the given roles. */
export async function notifyRoles(
  organizationId: string,
  roles: string[],
  n: { type: string; title: string; body: string; link?: string },
) {
  const users = await db.user.findMany({
    where: { organizationId, role: { in: roles }, isActive: true },
    select: { id: true },
  });
  await notifyUsers(organizationId, users.map((u) => u.id), n);
}

export async function audit(
  organizationId: string,
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  details?: string,
) {
  await db.auditLog.create({ data: { organizationId, userId, action, entity, entityId, details } });
}
