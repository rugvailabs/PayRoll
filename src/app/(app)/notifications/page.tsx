import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Card, EmptyState, PageHeader, cn } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

async function markAllRead() {
  "use server";
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up"}
        actions={unread > 0 && (
          <form action={markAllRead}><SubmitButton variant="secondary">Mark all as read</SubmitButton></form>
        )}
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="No notifications" description="Approvals, payments and alerts will show up here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => {
              const body = (
                <div className={cn("flex gap-3 px-5 py-4", !n.readAt && "bg-brand-50/50")}>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-600")} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <p className="text-sm text-slate-600">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
                  </div>
                </div>
              );
              return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-slate-50">{body}</Link> : body}</li>;
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
