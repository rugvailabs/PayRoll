import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsToInput, dateToInput, fullName } from "@/lib/format";
import { PlacementForm } from "../placement-form";

export const metadata: Metadata = { title: "Edit Placement" };

export default async function EditPlacementPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("placements.manage");
  const { id } = await params;
  const p = await db.placement.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { employee: true, client: true },
  });
  if (!p) notFound();
  return (
    <>
      <PageHeader title={`${fullName(p.employee)} @ ${p.client.name}`} subtitle="Edit placement" back={{ href: "/placements", label: "Placements" }} />
      <PlacementForm
        locked
        employees={[{ value: p.employeeId, label: fullName(p.employee) }]}
        clients={[{ value: p.clientId, label: p.client.name, frequency: p.timesheetFrequency }]}
        defaults={{
          id: p.id,
          employeeId: p.employeeId,
          clientId: p.clientId,
          jobTitle: p.jobTitle ?? "",
          projectName: p.projectName ?? "",
          poNumber: p.poNumber ?? "",
          timesheetFrequency: p.timesheetFrequency,
          startDate: dateToInput(p.startDate),
          endDate: dateToInput(p.endDate),
          status: p.status,
          billRate: centsToInput(p.billRate),
          payRate: centsToInput(p.payRate),
          otBillRate: centsToInput(p.otBillRate),
          otPayRate: centsToInput(p.otPayRate),
        }}
      />
    </>
  );
}
