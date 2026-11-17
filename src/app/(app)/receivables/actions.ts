"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { runPaymentReminders } from "@/lib/reminders";
import { audit } from "@/lib/notify";

export async function runRemindersNowAction(): Promise<{ ok?: string }> {
  const user = await requirePermission("payments.manage");
  const r = await runPaymentReminders(user.organizationId);
  await audit(user.organizationId, user.id, "RUN_REMINDERS", "Organization", user.organizationId, String(r.sent));
  revalidatePath("/receivables");
  return { ok: r.sent ? `${r.sent} reminder(s) sent.` : "No reminders were due right now." };
}
