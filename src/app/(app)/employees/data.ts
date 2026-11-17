import "server-only";
import { db } from "@/lib/db";
import { fullName } from "@/lib/format";

export async function employeeFormOptions(organizationId: string, excludeId?: string) {
  const [jobTitles, departments, managers, clients] = await Promise.all([
    db.jobTitle.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    db.employee.findMany({
      where: { organizationId, status: "ACTIVE", ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, middleName: true, lastName: true, employeeCode: true },
    }),
    db.client.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  return {
    jobTitles: jobTitles.map((j) => ({ value: j.id, label: j.name })),
    departments: departments.map((d) => ({ value: d.id, label: d.name })),
    managers: managers.map((m) => ({ value: m.id, label: `${fullName(m)} (${m.employeeCode})` })),
    clients: clients.map((c) => ({ value: c.id, label: c.name, frequency: c.invoiceFrequency })),
  };
}
