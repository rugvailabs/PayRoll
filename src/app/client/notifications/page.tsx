import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader, cn } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requireClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { clientMarkAllReadAction } from "../actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function ClientNotificationsPage() {
  const user = await requireClientUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up"}
        actions={unread > 0 && <form action={clientMarkAllReadAction}><SubmitButton variant="secondary">Mark all as read</SubmitButton></form>}
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="No notifications" description="New timesheets, invoices and payment updates will show up here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => {
              const body = (
                <div className={cn("flex gap-3 px-5 py-4", !n.readAt && "bg-brand-50/50")}>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-600")} />
                  <div>
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
