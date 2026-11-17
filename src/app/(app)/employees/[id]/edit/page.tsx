import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsToInput, dateToInput, fullName } from "@/lib/format";
import { EmployeeForm } from "../../employee-form";
import { employeeFormOptions } from "../../data";

export const metadata: Metadata = { title: "Edit Employee" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("employees.manage");
  const { id } = await params;
  const e = await db.employee.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!e) notFound();
  const opts = await employeeFormOptions(user.organizationId, id);

  const defaults: Record<string, string> = {};
  for (const [k, v] of Object.entries(e)) {
    if (v === null || v === undefined) continue;
    if (v instanceof Date) defaults[k] = dateToInput(v);
    else defaults[k] = String(v);
  }
  defaults.defaultPayRate = e.defaultPayRate ? centsToInput(e.defaultPayRate) : "";

  return (
    <>
      <PageHeader title={`Edit ${fullName(e)}`} back={{ href: `/employees/${id}`, label: fullName(e) }} />
      <EmployeeForm mode="edit" defaults={defaults} {...opts} />
    </>
  );
}
