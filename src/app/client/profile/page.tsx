import type { Metadata } from "next";
import { Avatar, Card, CardBody, CardHeader, DescList, LinkButton, PageHeader } from "@/components/ui";
import { requireClientUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "My Profile" };

export default async function ClientProfilePage() {
  const user = await requireClientUser();
  const c = user.client;
  const org = user.organization;
  return (
    <>
      <PageHeader title="My profile" actions={<LinkButton href="/change-password" variant="secondary">Change password</LinkButton>} />
      <Card className="mb-6">
        <CardBody className="flex items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}{user.jobTitle ? ` · ${user.jobTitle}` : ""}</p>
            <p className="text-xs text-slate-400">Last sign-in {formatDateTime(user.lastLoginAt)}</p>
          </div>
        </CardBody>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your company" />
          <CardBody>
            <DescList items={[
              { label: "Company", value: c.name },
              { label: "Billing email", value: c.billingEmail },
              { label: "Payment terms", value: `Net ${c.paymentTermsDays}` },
              { label: "Online timesheet approval", value: c.portalApproval ? "Enabled" : "Handled by your vendor" },
            ]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Your vendor" subtitle="Contact them to change any details" />
          <CardBody>
            <DescList items={[
              { label: "Company", value: org.name },
              { label: "Email", value: org.email },
              { label: "Phone", value: org.phone },
              { label: "Address", value: [org.address, org.city, org.state, org.zip].filter(Boolean).join(", ") },
            ]} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
