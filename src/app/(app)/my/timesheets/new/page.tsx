import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PeriodPicker } from "../../../timesheets/period-picker";
import { pickerPlacements } from "../../../timesheets/picker-data";

export const metadata: Metadata = { title: "Submit Timesheet" };

export default async function NewMyTimesheetPage() {
  const user = await requireUser();
  if (!user.employee) redirect("/dashboard");
  const placements = await pickerPlacements(user.organizationId, user.employee.id);
  return (
    <>
      <PageHeader title="Submit timesheet" subtitle="Choose the client and period." back={{ href: "/my/timesheets", label: "My timesheets" }} />
      <Card className="max-w-lg">
        {placements.length === 0 ? (
          <EmptyState title="You are not assigned to any client" description="Contact your administrator to be assigned to a client." />
        ) : (
          <CardBody><PeriodPicker placements={placements} /></CardBody>
        )}
      </Card>
    </>
  );
}
