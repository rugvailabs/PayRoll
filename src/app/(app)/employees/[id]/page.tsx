import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Alert, Avatar, Badge, Card, CardBody, CardHeader, DescList, EmptyState, LinkButton, PageHeader, Tabs,
} from "@/components/ui";
import { can, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMinutes, formatMoney, frequencyLabel, fullName } from "@/lib/format";
import { employmentTypeLabel, workAuthLabel } from "@/lib/options";
import { LoginPanel } from "./login-panel";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; created?: string; updated?: string; invited?: string }>;
}) {
  const user = await requirePermission("employees.view");
  const { id } = await params;
  const { tab = "overview", created, updated, invited } = await searchParams;
  const e = await db.employee.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      jobTitle: true,
      department: true,
      reportingManager: true,
      user: true,
      placements: { include: { client: true }, orderBy: { startDate: "desc" } },
    },
  });
  if (!e) notFound();
  const manage = can(user.role, "employees.manage");
  const name = fullName(e);

  const [timesheets, payslips] = await Promise.all([
    tab === "timesheets"
      ? db.timesheet.findMany({
          where: { employeeId: id, organizationId: user.organizationId },
          include: { placement: { include: { client: true } } },
          orderBy: { periodStart: "desc" },
          take: 100,
        })
      : [],
    tab === "pay"
      ? db.payslip.findMany({
          where: { employeeId: id, organizationId: user.organizationId },
          include: { payrollRun: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : [],
  ]);

  const base = `/employees/${id}`;
  return (
    <>
      <PageHeader
        back={{ href: "/employees", label: "Employees" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={name} size="lg" />
            <span>
              {name}
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-normal text-slate-500">
                <span className="font-mono">{e.employeeCode}</span>·<span>{e.jobTitle?.name ?? "No job title"}</span>·
                <Badge status={e.status} />
              </span>
            </span>
          </span>
        }
        actions={
          manage && (
            <>
              {can(user.role, "placements.manage") && (
                <LinkButton href={`/placements/new?employee=${id}`} variant="secondary">+ Assign to client</LinkButton>
              )}
              <LinkButton href={`${base}/edit`}>Edit profile</LinkButton>
            </>
          )
        }
      />

      {created && (
        <div className="mb-4">
          <Alert tone="success">
            Employee created.{invited && " A set-password invite was emailed to the employee."}
          </Alert>
        </div>
      )}
      {updated && <div className="mb-4"><Alert tone="success">Changes saved.</Alert></div>}

      <Tabs
        active={tab}
        tabs={[
          { key: "overview", label: "Overview", href: base },
          { key: "placements", label: "Clients & placements", href: `${base}?tab=placements`, count: e.placements.length },
          { key: "timesheets", label: "Timesheets", href: `${base}?tab=timesheets` },
          { key: "pay", label: "Pay history", href: `${base}?tab=pay` },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Employment" />
              <CardBody>
                <DescList
                  items={[
                    { label: "Employment type", value: employmentTypeLabel(e.employmentType) },
                    { label: "Department", value: e.department?.name },
                    { label: "Reporting manager", value: e.reportingManager && (
                      <Link className="text-brand-600 hover:underline" href={`/employees/${e.reportingManager.id}`}>{fullName(e.reportingManager)}</Link>
                    ) },
                    { label: "Date of joining", value: formatDate(e.dateOfJoining) },
                    { label: "Classification", value: e.classification === "BILLABLE" ? "Billable" : "Non-billable" },
                    { label: "Profile type", value: e.profileType === "WORKER" ? "Worker" : "Back-office staff" },
                    { label: "Work authorization", value: workAuthLabel(e.workAuthorization) },
                    { label: "Payroll ID", value: e.payrollId },
                    { label: "Worker ID", value: e.workerId },
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Personal & contact" />
              <CardBody>
                <DescList
                  items={[
                    { label: "Email", value: e.email },
                    { label: "Alternate email", value: e.alternateEmail },
                    { label: "Phone", value: e.phone },
                    { label: "Date of birth", value: formatDate(e.dateOfBirth) },
                    { label: "SSN", value: e.ssnLast4 ? `•••-••-${e.ssnLast4}` : null },
                    { label: "Address", value: [e.addressLine, e.city, e.state, e.zip].filter(Boolean).join(", ") },
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Pay & bank" />
              <CardBody>
                <DescList
                  items={[
                    { label: "Pay type", value: e.payType === "HOURLY" ? "Hourly" : "Salary" },
                    { label: "Default pay rate", value: e.defaultPayRate ? `${formatMoney(e.defaultPayRate)}${e.payType === "HOURLY" ? " / hr" : " / period"}` : null },
                    { label: "Bank", value: e.bankName },
                    { label: "Account", value: e.bankAccountLast4 ? `••••${e.bankAccountLast4}` : null },
                    { label: "Routing", value: e.bankRouting },
                  ]}
                />
              </CardBody>
            </Card>
          </div>
          <div className="space-y-6">
            {manage && (
              <Card>
                <CardHeader title="Portal login" subtitle="Credentials and access" />
                <CardBody>
                  <LoginPanel
                    employeeId={e.id}
                    isSelf={e.userId === user.id}
                    user={
                      e.user && {
                        email: e.user.email,
                        role: e.user.role,
                        isActive: e.user.isActive,
                        hasPassword: !!e.user.passwordHash,
                        lastLoginAt: e.user.lastLoginAt?.toISOString() ?? null,
                        inviteExpires: e.user.inviteExpires?.toISOString() ?? null,
                      }
                    }
                  />
                </CardBody>
              </Card>
            )}
            <Card>
              <CardHeader title="Current clients" />
              <CardBody className="space-y-3">
                {e.placements.filter((p) => p.status === "ACTIVE").length === 0 && (
                  <p className="text-sm text-slate-500">Not assigned to any client.</p>
                )}
                {e.placements
                  .filter((p) => p.status === "ACTIVE")
                  .map((p) => (
                    <Link key={p.id} href={`/clients/${p.clientId}`} className="block rounded-lg border border-slate-200 p-3 hover:border-brand-200">
                      <p className="font-medium text-slate-900">{p.client.name}</p>
                      <p className="text-xs text-slate-500">
                        Since {formatDate(p.startDate)} · {frequencyLabel(p.timesheetFrequency)} timesheets
                      </p>
                    </Link>
                  ))}
              </CardBody>
            </Card>
            {e.notes && (
              <Card>
                <CardHeader title="Notes" />
                <CardBody><p className="whitespace-pre-wrap text-sm text-slate-700">{e.notes}</p></CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "placements" && (
        <Card>
          {e.placements.length === 0 ? (
            <EmptyState
              title="No placements"
              description="Assign this employee to a client to start collecting timesheets."
              action={can(user.role, "placements.manage") && <LinkButton href={`/placements/new?employee=${id}`}>+ Assign to client</LinkButton>}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Client</th><th>Project</th><th>Start</th><th>End</th><th>Frequency</th><th className="text-right">Bill rate</th><th className="text-right">Pay rate</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {e.placements.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/clients/${p.clientId}`} className="font-medium text-slate-900 hover:text-brand-600">{p.client.name}</Link></td>
                      <td>{p.projectName ?? "—"}</td>
                      <td>{formatDate(p.startDate)}</td>
                      <td>{formatDate(p.endDate)}</td>
                      <td>{frequencyLabel(p.timesheetFrequency)}</td>
                      <td className="text-right tabular-nums">{formatMoney(p.billRate)}</td>
                      <td className="text-right tabular-nums">{formatMoney(p.payRate)}</td>
                      <td><Badge status={p.status} /></td>
                      <td>{can(user.role, "placements.manage") && <Link className="text-brand-600 hover:underline" href={`/placements/${p.id}`}>Edit</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "timesheets" && (
        <Card>
          {timesheets.length === 0 ? (
            <EmptyState title="No timesheets yet" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Client</th><th>From</th><th>To</th><th>Submitted</th><th className="text-right">Total hours</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {timesheets.map((t) => (
                    <tr key={t.id}>
                      <td><Link href={`/timesheets/${t.id}`} className="font-medium hover:text-brand-600">{t.placement.client.name}</Link></td>
                      <td>{formatDate(t.periodStart)}</td>
                      <td>{formatDate(t.periodEnd)}</td>
                      <td>{formatDate(t.submittedAt)}</td>
                      <td className="text-right tabular-nums">{formatMinutes(t.totalMinutes)}</td>
                      <td><Badge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "pay" && (
        <Card>
          {payslips.length === 0 ? (
            <EmptyState title="No payroll yet" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Pay period</th><th>Pay date</th><th className="text-right">Hours</th><th className="text-right">Gross pay</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.payrollRun.periodStart)} – {formatDate(p.payrollRun.periodEnd)}</td>
                      <td>{formatDate(p.payrollRun.payDate)}</td>
                      <td className="text-right tabular-nums">{formatMinutes(p.regularMinutes + p.overtimeMinutes)}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(p.grossPay)}</td>
                      <td><Badge status={p.status} /></td>
                      <td><a className="text-brand-600 hover:underline" href={`/api/payslips/${p.id}/pdf`} target="_blank">PDF</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
