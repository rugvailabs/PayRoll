"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/notify";
import { resetToTempPassword, sendInvite } from "@/lib/accounts";
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
      portalApproval: fd.get("portalApproval") === "on",
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

export type PortalUserState = { error?: string; ok?: string; tempPassword?: string } | undefined;

/** Create and manage client-portal logins for a client company's contacts. */
export async function manageClientUserAction(_: PortalUserState, fd: FormData): Promise<PortalUserState> {
  const admin = await requirePermission("clients.manage");
  const oid = admin.organizationId;
  const op = String(fd.get("op"));
  const clientId = String(fd.get("clientId"));
  const client = await db.client.findFirst({ where: { id: clientId, organizationId: oid } });
  if (!client) return { error: "Client not found." };

  if (op === "create") {
    const name = str(fd.get("name"));
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    if (!name) return { error: "Enter the contact's name." };
    if (!EMAIL_RE.test(email)) return { error: "Enter a valid email." };
    if (await db.user.findFirst({ where: { organizationId: oid, email } }))
      return { error: "A login with this email already exists in your organization." };
    const u = await db.user.create({
      data: { organizationId: oid, clientId, email, name, role: "CLIENT", jobTitle: str(fd.get("jobTitle")), mustChangePassword: true },
    });
    await audit(oid, admin.id, "CREATE_CLIENT_LOGIN", "Client", clientId, email);
    revalidatePath(`/clients/${clientId}`);
    const mode = str(fd.get("credentialMode")) ?? "INVITE";
    if (mode === "INVITE") {
      await sendInvite(u.id);
      return { ok: `Portal login created and an invite was emailed to ${email}.` };
    }
    const pw = await resetToTempPassword(u.id, mode === "TEMP_EMAIL");
    return { ok: mode === "TEMP_EMAIL" ? `Login created and details emailed to ${email}.` : "Login created.", tempPassword: pw };
  }

  const u = await db.user.findFirst({ where: { id: String(fd.get("userId")), organizationId: oid, clientId, role: "CLIENT" } });
  if (!u) return { error: "Portal user not found." };
  switch (op) {
    case "invite":
      await sendInvite(u.id);
      await audit(oid, admin.id, "RESEND_INVITE", "Client", clientId, u.email);
      return { ok: `Invite email sent to ${u.email}.` };
    case "temp-manual": {
      const pw = await resetToTempPassword(u.id, false);
      await audit(oid, admin.id, "RESET_PASSWORD", "Client", clientId, u.email);
      return { ok: `New temporary password for ${u.email}. Share it securely.`, tempPassword: pw };
    }
    case "temp-email": {
      const pw = await resetToTempPassword(u.id, true);
      await audit(oid, admin.id, "RESET_PASSWORD", "Client", clientId, u.email);
      return { ok: `New temporary password emailed to ${u.email}.`, tempPassword: pw };
    }
    case "disable":
    case "enable":
      await db.user.update({ where: { id: u.id }, data: { isActive: op === "enable" } });
      await audit(oid, admin.id, op === "enable" ? "ENABLE_LOGIN" : "DISABLE_LOGIN", "Client", clientId, u.email);
      revalidatePath(`/clients/${clientId}`);
      return { ok: op === "enable" ? "Login enabled." : "Login disabled." };
  }
  return { error: "Unknown action." };
}
