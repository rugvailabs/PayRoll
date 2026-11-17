import type { Metadata } from "next";
import { Avatar, Card, CardBody, CardHeader, DescList, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, fullName } from "@/lib/format";
import { employmentTypeLabel } from "@/lib/options";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const e = user.employee;
  return (
    <>
      <PageHeader title="My profile" actions={<LinkButton href="/change-password" variant="secondary">Change password</LinkButton>} />
      <Card className="mb-6">
        <CardBody className="flex items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email} · {user.role.charAt(0) + user.role.slice(1).toLowerCase()}</p>
            <p className="text-xs text-slate-400">Company code: {user.organization.slug} · Last sign-in {formatDateTime(user.lastLoginAt)}</p>
          </div>
        </CardBody>
      </Card>
      {e && (
        <Card>
          <CardHeader title="Employee details" subtitle="Contact your administrator to change these details." />
          <CardBody>
            <DescList items={[
              { label: "Name", value: fullName(e) },
              { label: "Employee ID", value: e.employeeCode },
              { label: "Employment type", value: employmentTypeLabel(e.employmentType) },
              { label: "Date of joining", value: formatDate(e.dateOfJoining) },
              { label: "Phone", value: e.phone },
              { label: "Address", value: [e.addressLine, e.city, e.state, e.zip].filter(Boolean).join(", ") },
              { label: "Bank account", value: e.bankAccountLast4 ? `${e.bankName ?? ""} ••••${e.bankAccountLast4}` : null },
            ]} />
          </CardBody>
        </Card>
      )}
    </>
  );
}
