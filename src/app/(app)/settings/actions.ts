"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/notify";
import { str } from "@/lib/format";

export type SetState = { error?: string; ok?: string } | undefined;

export async function saveOrgAction(_: SetState, fd: FormData): Promise<SetState> {
  const user = await requirePermission("settings.manage");
  const name = str(fd.get("name"));
  if (!name) return { error: "Organization name is required." };
  const terms = Number(fd.get("defaultTermsDays"));
  if (!Number.isInteger(terms) || terms < 0 || terms > 365) return { error: "Default terms must be 0–365 days." };
  const nextNo = Number(fd.get("nextInvoiceNo"));
  if (!Number.isInteger(nextNo) || nextNo < 1) return { error: "Next invoice number must be a positive number." };
  const offsetsRaw = String(fd.get("reminderOffsets") ?? "");
  const offsets = offsetsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (offsets.some((o) => !/^-?\d{1,3}$/.test(o))) return { error: "Reminder schedule must be numbers separated by commas, e.g. -3,0,7,15,30." };

  await db.organization.update({
    where: { id: user.organizationId },
    data: {
      name,
      email: str(fd.get("email")),
      phone: str(fd.get("phone")),
      address: str(fd.get("address")),
      city: str(fd.get("city")),
      state: str(fd.get("state")),
      zip: str(fd.get("zip")),
      taxId: str(fd.get("taxId")),
      invoicePrefix: str(fd.get("invoicePrefix")) ?? "INV-",
      nextInvoiceNo: nextNo,
      defaultTermsDays: terms,
      remindersEnabled: fd.get("remindersEnabled") === "on",
      reminderOffsets: [...new Set(offsets.map(Number))].sort((a, b) => a - b).join(","),
    },
  });
  await audit(user.organizationId, user.id, "UPDATE", "Organization", user.organizationId);
  revalidatePath("/settings");
  return { ok: "Settings saved." };
}

export async function addLookupAction(fd: FormData) {
  const user = await requirePermission("settings.manage");
  const kind = String(fd.get("kind"));
  const name = str(fd.get("name"));
  if (!name) return;
  const data = { organizationId: user.organizationId, name };
  if (kind === "department") await db.department.upsert({ where: { organizationId_name: data }, create: data, update: {} });
  if (kind === "jobTitle") await db.jobTitle.upsert({ where: { organizationId_name: data }, create: data, update: {} });
  revalidatePath("/settings");
}

export async function removeLookupAction(fd: FormData) {
  const user = await requirePermission("settings.manage");
  const kind = String(fd.get("kind"));
  const id = String(fd.get("id"));
  if (kind === "department") await db.department.deleteMany({ where: { id, organizationId: user.organizationId } });
  if (kind === "jobTitle") await db.jobTitle.deleteMany({ where: { id, organizationId: user.organizationId } });
  revalidatePath("/settings");
}
