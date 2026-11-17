import type { Metadata } from "next";
import { Card, CardBody, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { PeriodPicker } from "../period-picker";
import { pickerPlacements } from "../picker-data";

export const metadata: Metadata = { title: "Enter Timesheet" };

export default async function AdminNewTimesheetPage() {
  const user = await requirePermission("timesheets.approve");
  const placements = await pickerPlacements(user.organizationId);
  return (
    <>
      <PageHeader title="Enter timesheet for an employee"
        subtitle="Use this when you receive a client-approved timesheet by email or paper."
        back={{ href: "/timesheets", label: "Timesheets" }} />
      <Card className="max-w-lg">
        {placements.length === 0 ? (
          <EmptyState title="No active placements" description="Assign an employee to a client first."
            action={<LinkButton href="/placements/new">+ Create placement</LinkButton>} />
        ) : (
          <CardBody><PeriodPicker placements={placements} /></CardBody>
        )}
      </Card>
    </>
  );
}
