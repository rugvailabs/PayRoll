import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { EmployeeForm } from "../employee-form";
import { employeeFormOptions } from "../data";

export const metadata: Metadata = { title: "Add Employee" };

export default async function NewEmployeePage() {
  const user = await requirePermission("employees.manage");
  const opts = await employeeFormOptions(user.organizationId);
  return (
    <>
      <PageHeader
        title="Add employee"
        subtitle="Create the employee profile, optionally assign them to a client, and send their portal login."
        back={{ href: "/employees", label: "Employees" }}
      />
      <EmployeeForm mode="create" {...opts} />
    </>
  );
}
