import "server-only";
import { db } from "@/lib/db";
import { fullName } from "@/lib/format";

export async function placementOptions(organizationId: string) {
  const [employees, clients] = await Promise.all([
    db.employee.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { firstName: "asc" } }),
    db.client.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  return {
    employees: employees.map((e) => ({ value: e.id, label: `${fullName(e)} (${e.employeeCode})` })),
    clients: clients.map((c) => ({ value: c.id, label: c.name, frequency: c.invoiceFrequency })),
  };
}
