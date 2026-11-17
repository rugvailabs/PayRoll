import type { Metadata } from "next";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Email Outbox" };

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requirePermission("settings.manage");
  const { id } = await searchParams;
  const emails = await db.emailLog.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, to: true, cc: true, subject: true, type: true, status: true, error: true, createdAt: true },
  });
  const open = id ? await db.emailLog.findFirst({ where: { id, organizationId: user.organizationId } }) : null;
  const smtp = !!process.env.SMTP_HOST;

  return (
    <>
      <PageHeader title="Email outbox" subtitle="Every email the system sends: invites, invoices, reminders, receipts and pay statements." />
      {!smtp && (
        <div className="mb-4">
          <Alert tone="warning">
            SMTP is not configured, so emails are <b>logged here instead of being delivered</b>. Set SMTP_HOST, SMTP_USER and SMTP_PASS in the .env file to send real emails.
          </Alert>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className={open ? "xl:col-span-2" : "xl:col-span-5"}>
          {emails.length === 0 ? (
            <EmptyState title="No emails yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {emails.map((e) => (
                <li key={e.id}>
                  <a href={`/emails?id=${e.id}`} className={`block px-5 py-3 hover:bg-slate-50 ${e.id === id ? "bg-brand-50" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-slate-900">{e.subject}</p>
                      <Badge status={e.status === "SENT" ? "APPROVED" : e.status === "FAILED" ? "REJECTED" : "DRAFT"}>
                        {e.status === "LOGGED" ? "Logged" : e.status === "SENT" ? "Sent" : "Failed"}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {e.type.replace(/_/g, " ").toLowerCase()} · to {e.to} · {formatDateTime(e.createdAt)}
                    </p>
                    {e.error && <p className="text-xs text-red-600">{e.error}</p>}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {open && (
          <Card className="xl:col-span-3">
            <div className="border-b border-slate-100 px-5 py-4 text-sm">
              <p className="font-semibold text-slate-900">{open.subject}</p>
              <p className="text-slate-500">To: {open.to}{open.cc ? ` · Cc: ${open.cc}` : ""}</p>
            </div>
            {/* Rendered in a sandboxed iframe so email HTML cannot run scripts or affect the app. */}
            <iframe title="Email preview" sandbox="" srcDoc={open.html} className="h-[640px] w-full rounded-b-xl" />
          </Card>
        )}
      </div>
    </>
  );
}
