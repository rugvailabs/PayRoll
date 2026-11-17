"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/notify";
import { str } from "@/lib/format";

export type ClientFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseClient(fd: FormData) {
  const fe: Record<string, string> = {};
  const name = str(fd.get("name"));
  if (!name) fe.name = "Client name is required";
  const billingEmail = String(fd.get("billingEmail") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(billingEmail)) fe.billingEmail = "Enter a valid billing email";
  const cc = (str(fd.get("billingCcEmails")) ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (cc.some((e) => !EMAIL_RE.test(e))) fe.billingCcEmails = "One or more CC emails are invalid";
  const approverEmail = str(fd.get("approverEmail"))?.toLowerCase() ?? null;
  if (approverEmail && !EMAIL_RE.test(approverEmail)) fe.approverEmail = "Enter a valid email";
  const terms = Number(fd.get("paymentTermsDays") ?? 30);
  if (!Number.isInteger(terms) || terms < 0 || terms > 365) fe.paymentTermsDays = "Enter days between 0 and 365";
  const freq = str(fd.get("invoiceFrequency")) ?? "MONTHLY";
  if (!["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY"].includes(freq)) fe.invoiceFrequency = "Invalid frequency";

  return {
    fe,
    data: {
      name: name ?? "",
      website: str(fd.get("website")),
      industry: str(fd.get("industry")),
      phone: str(fd.get("phone")),
      addressLine: str(fd.get("addressLine")),
      city: str(fd.get("city")),
      state: str(fd.get("state")),
      zip: str(fd.get("zip")),
      taxId: str(fd.get("taxId")),
      billingContactName: str(fd.get("billingContactName")),
      billingEmail,
      billingCcEmails: cc.length ? cc.join(", ") : null,
      approverName: str(fd.get("approverName")),
      approverEmail,
      paymentTermsDays: Number.isInteger(terms) ? terms : 30,
      invoiceFrequency: freq,
      remindersEnabled: fd.get("remindersEnabled") === "on",
      status: str(fd.get("status")) === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      notes: str(fd.get("notes")),
    },
  };
}

async function nextClientCode(organizationId: string) {
  const count = await db.client.count({ where: { organizationId } });
  for (let n = count + 1; ; n++) {
    const code = `CL-${String(n).padStart(4, "0")}`;
    if (!(await db.client.findFirst({ where: { organizationId, clientCode: code }, select: { id: true } }))) return code;
  }
}

export async function saveClientAction(_: ClientFormState, fd: FormData): Promise<ClientFormState> {
  const user = await requirePermission("clients.manage");
  const oid = user.organizationId;
  const id = str(fd.get("id"));
  const { fe, data } = parseClient(fd);
  const code = str(fd.get("clientCode"));

  const existing = id ? await db.client.findFirst({ where: { id, organizationId: oid } }) : null;
  if (id && !existing) return { error: "Client not found." };
  if (code && code !== existing?.clientCode && (await db.client.findFirst({ where: { organizationId: oid, clientCode: code } })))
    fe.clientCode = "This client code is already used";
  const dupName = await db.client.findFirst({ where: { organizationId: oid, name: data.name, ...(id ? { NOT: { id } } : {}) } });
  if (dupName) fe.name = "A client with this name already exists";
  if (Object.keys(fe).length) return { fieldErrors: fe, error: "Please fix the highlighted fields." };

  let clientId: string;
  if (existing) {
    await db.client.update({ where: { id: existing.id }, data: { ...data, clientCode: code ?? existing.clientCode } });
    clientId = existing.id;
    await audit(oid, user.id, "UPDATE", "Client", clientId);
  } else {
    const c = await db.client.create({
      data: { ...data, organizationId: oid, clientCode: code ?? (await nextClientCode(oid)) },
    });
    clientId = c.id;
    await audit(oid, user.id, "CREATE", "Client", clientId, data.name);
  }
  revalidatePath("/clients");
  redirect(`/clients/${clientId}?${existing ? "updated" : "created"}=1`);
}
