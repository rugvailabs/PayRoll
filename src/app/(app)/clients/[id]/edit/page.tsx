import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "Edit Client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.manage");
  const { id } = await params;
  const c = await db.client.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!c) notFound();
  const defaults: Record<string, string> = {};
  for (const [k, v] of Object.entries(c)) if (v !== null && !(v instanceof Date)) defaults[k] = String(v);
  return (
    <>
      <PageHeader title={`Edit ${c.name}`} back={{ href: `/clients/${id}`, label: c.name }} />
      <ClientForm defaults={defaults} />
    </>
  );
}
