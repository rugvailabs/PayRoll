import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Add Client" };

export default async function NewClientPage() {
  await requirePermission("clients.manage");
  return (
    <>
      <PageHeader title="Add client" subtitle="Set up billing details, payment terms and the timesheet approver."
        back={{ href: "/clients", label: "Clients" }} />
      <ClientForm />
    </>
  );
}
