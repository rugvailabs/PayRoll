import { redirect } from "next/navigation";
import { AppShell, type NavGroup, type QuickLink } from "@/components/shell";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessFor } from "@/lib/billing";
import { Alert } from "@/components/ui";

const ROLE_LABEL = { ADMIN: "Administrator", MANAGER: "Manager", ACCOUNTANT: "Accountant", EMPLOYEE: "Employee", CLIENT: "Client" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role === "CLIENT") redirect("/client");
  const oid = user.organizationId;

  const [unread, pendingTimesheets] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    can(user.role, "timesheets.approve")
      ? db.timesheet.count({ where: { organizationId: oid, status: "SUBMITTED" } })
      : Promise.resolve(0),
  ]);

  const nav: NavGroup[] =
    user.role === "EMPLOYEE" ? [] : [{ items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }] }];
  const quick: QuickLink[][] = [];

  if (user.employee) {
    nav.push({
      title: "My work",
      items: [
        ...(user.role === "EMPLOYEE" ? [{ href: "/my", label: "My Dashboard", icon: "dashboard" as const }] : []),
        { href: "/my/timesheets", label: "My Timesheets", icon: "timesheets" },
        { href: "/my/payslips", label: "My Pay Statements", icon: "payslips" },
      ],
    });
    quick.push([{ href: "/my/timesheets/new", label: "Submit Timesheet" }]);
  }

  const people: NavGroup = { title: "Workforce", items: [] };
  if (can(user.role, "employees.view")) people.items.push({ href: "/employees", label: "Employees", icon: "employees" });
  if (can(user.role, "clients.view")) people.items.push({ href: "/clients", label: "Clients", icon: "clients" });
  if (can(user.role, "placements.manage")) people.items.push({ href: "/placements", label: "Placements", icon: "placements" });
  if (can(user.role, "timesheets.approve"))
    people.items.push({ href: "/timesheets", label: "Timesheets", icon: "timesheets", badge: pendingTimesheets });
  if (people.items.length) nav.push(people);

  const finance: NavGroup = { title: "Finance", items: [] };
  if (can(user.role, "invoices.manage")) finance.items.push({ href: "/invoices", label: "Invoices", icon: "invoices" });
  if (can(user.role, "payments.manage")) finance.items.push({ href: "/receivables", label: "Payments & Aging", icon: "receivables" });
  if (can(user.role, "payroll.manage")) finance.items.push({ href: "/payroll", label: "Payroll", icon: "payroll" });
  if (finance.items.length) nav.push(finance);

  const system: NavGroup = { title: "System", items: [{ href: "/notifications", label: "Notifications", icon: "notifications", badge: unread }] };
  if (can(user.role, "settings.manage")) {
    system.items.push({ href: "/emails", label: "Email Outbox", icon: "emails" });
    system.items.push({ href: "/settings", label: "Settings", icon: "settings" });
    if (user.role === "ADMIN") system.items.push({ href: "/billing", label: "Billing", icon: "payroll" });
  }
  nav.push(system);

  const adminQuick: QuickLink[] = [];
  if (can(user.role, "employees.manage")) adminQuick.push({ href: "/employees/new", label: "Add Employee" });
  if (can(user.role, "clients.manage")) adminQuick.push({ href: "/clients/new", label: "Add Client" });
  if (can(user.role, "placements.manage")) adminQuick.push({ href: "/placements/new", label: "Create Placement" });
  if (adminQuick.length) quick.push(adminQuick);
  const finQuick: QuickLink[] = [];
  if (can(user.role, "invoices.manage")) finQuick.push({ href: "/invoices/new", label: "Create Invoice" });
  if (can(user.role, "payments.manage")) finQuick.push({ href: "/receivables", label: "Record Payment" });
  if (can(user.role, "payroll.manage")) finQuick.push({ href: "/payroll/new", label: "Run Payroll" });
  if (finQuick.length) quick.push(finQuick);

  return (
    <AppShell
      orgName={user.organization.name}
      userName={user.name}
      userEmail={user.email}
      roleLabel={ROLE_LABEL[user.role]}
      nav={nav}
      quickLinks={quick}
      unread={unread}
      searchHref={user.role === "EMPLOYEE" ? undefined : "/search"}
    >
      {(() => {
        const a = accessFor(user.organization);
        return a.state === "ok" && a.banner && user.role === "ADMIN" ? (
          <div className="mb-6">
            <Alert tone={a.banner.tone}>
              {a.banner.text} <a href="/billing" className="font-semibold underline">Go to billing</a>
            </Alert>
          </div>
        ) : null;
      })()}
      {children}
    </AppShell>
  );
}
