import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { centsToInput, dateToInput, todayUtc } from "@/lib/format";
import { db } from "@/lib/db";
import { PlacementForm } from "../placement-form";
import { placementOptions } from "../data";

export const metadata: Metadata = { title: "Create Placement" };

export default async function NewPlacementPage({ searchParams }: { searchParams: Promise<{ employee?: string; client?: string }> }) {
  const user = await requirePermission("placements.manage");
  const { employee, client } = await searchParams;
  const opts = await placementOptions(user.organizationId);
  const emp = employee ? await db.employee.findFirst({ where: { id: employee, organizationId: user.organizationId } }) : null;
  const returnTo = employee ? `/employees/${employee}?tab=placements` : client ? `/clients/${client}` : undefined;

  return (
    <>
      <PageHeader title="Assign employee to client" subtitle="Create a placement with bill and pay rates."
        back={{ href: returnTo ?? "/placements", label: "Back" }} />
      {(opts.employees.length === 0 || opts.clients.length === 0) && (
        <div className="mb-4">
          <Alert tone="warning">You need at least one active employee and one active client before creating a placement.</Alert>
        </div>
      )}
      <PlacementForm
        {...opts}
        returnTo={returnTo}
        defaults={{
          employeeId: employee ?? "",
          clientId: client ?? "",
          startDate: dateToInput(todayUtc()),
          payRate: emp?.defaultPayRate ? centsToInput(emp.defaultPayRate) : "",
        }}
      />
    </>
  );
}
