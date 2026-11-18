import { redirect } from "next/navigation";
import { AppShell, type NavGroup } from "@/components/shell";
import { requireClientUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientUser();
  if (user.mustChangePassword) redirect("/change-password");

  const [unread, pending] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.timesheet.count({ where: { organizationId: user.organizationId, status: "SUBMITTED", placement: { clientId: user.client.id } } }),
  ]);

  const nav: NavGroup[] = [
    { items: [{ href: "/client", label: "Dashboard", icon: "dashboard" }] },
    {
      title: "Workforce",
      items: [
        { href: "/client/employees", label: "Our Consultants", icon: "employees" },
        { href: "/client/timesheets", label: "Timesheets", icon: "timesheets", badge: user.client.portalApproval ? pending : undefined },
      ],
    },
    {
      title: "Billing",
      items: [
        { href: "/client/invoices", label: "Invoices", icon: "invoices" },
        { href: "/client/payments", label: "Payments & Balance", icon: "receivables" },
      ],
    },
    { title: "Account", items: [{ href: "/client/notifications", label: "Notifications", icon: "notifications", badge: unread }] },
  ];

  return (
    <AppShell
      orgName={user.client.name}
      portalLabel={`Client portal · ${user.organization.name}`}
      userName={user.name}
      userEmail={user.email}
      roleLabel={user.jobTitle ?? "Client"}
      nav={nav}
      quickLinks={[]}
      unread={unread}
      profileHref="/client/profile"
      notificationsHref="/client/notifications"
    >
      {children}
    </AppShell>
  );
}
