import "server-only";
import crypto from "crypto";
import { db } from "./db";
import { notifyRoles } from "./notify";
import { emailLayout, esc, sendEmail } from "./email";
import { formatDate } from "./format";

/* ------------------------------------------------------------------ */
/* Configuration (all from environment variables)                      */
/* ------------------------------------------------------------------ */

export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 14);
export const GRACE_DAYS = Number(process.env.GRACE_DAYS || 7);

export const billingConfig = {
  stripe: {
    enabled: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
    pricePerEmployee: process.env.PRICE_PER_EMPLOYEE_USD || "",
    currency: "USD",
  },
  razorpay: {
    enabled: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_PLAN_ID),
    pricePerEmployee: process.env.PRICE_PER_EMPLOYEE_INR || "",
    currency: "INR",
  },
  /** Local development only: lets you start a trial without a gateway when no keys are set. */
  devBypass: process.env.NODE_ENV !== "production" && process.env.BILLING_DEV_BYPASS !== "false",
};

export type Provider = "STRIPE" | "RAZORPAY";

/* ------------------------------------------------------------------ */
/* Access rules                                                        */
/* ------------------------------------------------------------------ */

type OrgBilling = {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  pastDueSince: Date | null;
};

export type Access =
  | { state: "ok"; banner?: { tone: "info" | "warning"; text: string } }
  | { state: "locked"; reason: string };

export function accessFor(org: OrgBilling, now = new Date()): Access {
  const s = org.subscriptionStatus;
  if (s === "COMPLIMENTARY") return { state: "ok" };
  if (s === "ACTIVE") return { state: "ok" };
  if (s === "TRIALING") {
    const days = org.trialEndsAt ? Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86400000) : null;
    return {
      state: "ok",
      banner: days !== null && days <= 5 ? { tone: "info", text: `Your free trial ends in ${Math.max(days, 0)} day(s). Your card will be charged automatically.` } : undefined,
    };
  }
  if (s === "PAST_DUE" || s === "UNPAID") {
    const since = org.pastDueSince ?? now;
    const lockAt = new Date(since.getTime() + GRACE_DAYS * 86400000);
    if (now < lockAt) {
      const days = Math.ceil((lockAt.getTime() - now.getTime()) / 86400000);
      return { state: "ok", banner: { tone: "warning", text: `Your subscription payment failed. Update your payment method within ${days} day(s) to avoid losing access.` } };
    }
    return { state: "locked", reason: "Your subscription payment is overdue." };
  }
  if (s === "CANCELED" && org.currentPeriodEnd && now < org.currentPeriodEnd) {
    return { state: "ok", banner: { tone: "warning", text: `Your subscription is cancelled and access ends on ${formatDate(org.currentPeriodEnd)}.` } };
  }
  if (s === "CANCELED") return { state: "locked", reason: "Your subscription has been cancelled." };
  return { state: "locked", reason: "Start your subscription to begin using the application." };
}

/** Billable seats: active employees (minimum 1). */
export async function activeSeatCount(organizationId: string) {
  return Math.max(1, await db.employee.count({ where: { organizationId, status: "ACTIVE" } }));
}

/* ------------------------------------------------------------------ */
/* Stripe (REST API)                                                   */
/* ------------------------------------------------------------------ */

async function stripe(path: string, method: "GET" | "POST" | "DELETE", params?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && params ? `?${new URLSearchParams(params)}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method !== "GET" && params ? new URLSearchParams(params) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe error ${res.status}`);
  return json;
}

export async function stripeCheckout(org: { id: string; name: string; email: string | null; stripeCustomerId: string | null }, adminEmail: string) {
  let customer = org.stripeCustomerId;
  if (!customer) {
    const c = await stripe("customers", "POST", { email: org.email ?? adminEmail, name: org.name, "metadata[organizationId]": org.id });
    customer = c.id as string;
    await db.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customer, billingProvider: "STRIPE" } });
  }
  const quantity = await activeSeatCount(org.id);
  const session = await stripe("checkout/sessions", "POST", {
    mode: "subscription",
    customer: customer!,
    client_reference_id: org.id,
    "line_items[0][price]": process.env.STRIPE_PRICE_ID!,
    "line_items[0][quantity]": String(quantity),
    "subscription_data[trial_period_days]": String(TRIAL_DAYS),
    "subscription_data[metadata][organizationId]": org.id,
    payment_method_collection: "always",
    success_url: `${process.env.APP_URL}/billing?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/billing?cancelled=1`,
  });
  return session.url as string;
}

export async function stripePortal(customerId: string) {
  const s = await stripe("billing_portal/sessions", "POST", { customer: customerId, return_url: `${process.env.APP_URL}/billing` });
  return s.url as string;
}

const STRIPE_STATUS: Record<string, string> = {
  trialing: "TRIALING", active: "ACTIVE", past_due: "PAST_DUE", unpaid: "UNPAID", canceled: "CANCELED",
  incomplete: "INCOMPLETE", incomplete_expired: "CANCELED", paused: "PAST_DUE",
};

type StripeSub = {
  id: string; status: string; customer: string; trial_end: number | null; current_period_end?: number;
  cancel_at_period_end?: boolean; metadata?: { organizationId?: string };
  items?: { data: { id: string; quantity: number; current_period_end?: number }[] };
};

async function applyStripeSubscription(sub: StripeSub, orgId?: string) {
  const organizationId = orgId ?? sub.metadata?.organizationId;
  const org = organizationId
    ? await db.organization.findUnique({ where: { id: organizationId } })
    : await db.organization.findFirst({ where: { stripeCustomerId: sub.customer } });
  if (!org) return;
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  await applyStatus(org.id, {
    provider: "STRIPE",
    status: STRIPE_STATUS[sub.status] ?? "INCOMPLETE",
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    quantity: sub.items?.data?.[0]?.quantity,
    extra: { stripeSubscriptionId: sub.id, stripeCustomerId: sub.customer },
  });
}

/** After Checkout redirect: fetch the session/subscription and update the org right away (no webhook needed). */
export async function stripeSyncFromSession(organizationId: string, sessionId: string) {
  const session = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`, "GET");
  if (session.client_reference_id !== organizationId || !session.subscription) return;
  const sub = await stripe(`subscriptions/${session.subscription}`, "GET");
  await applyStripeSubscription(sub, organizationId);
}

export async function stripeSync(organizationId: string, subscriptionId: string) {
  await applyStripeSubscription(await stripe(`subscriptions/${subscriptionId}`, "GET"), organizationId);
}

export function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

export async function handleStripeEvent(event: { type: string; data: { object: Record<string, unknown> } }) {
  const obj = event.data.object;
  if (event.type.startsWith("customer.subscription.")) await applyStripeSubscription(obj as unknown as StripeSub);
  else if (event.type === "checkout.session.completed" && obj.subscription && obj.client_reference_id) {
    await stripeSync(String(obj.client_reference_id), String(obj.subscription));
  } else if ((event.type === "invoice.payment_failed" || event.type === "invoice.paid") && obj.subscription) {
    const org = await db.organization.findFirst({ where: { stripeSubscriptionId: String(obj.subscription) } });
    if (org) await stripeSync(org.id, String(obj.subscription));
  }
}

/* ------------------------------------------------------------------ */
/* Razorpay (REST API)                                                 */
/* ------------------------------------------------------------------ */

async function razorpay(path: string, method: "GET" | "POST" | "PATCH", body?: unknown) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.description ?? `Razorpay error ${res.status}`);
  return json;
}

/** Creates a Razorpay subscription whose first charge is after the trial; returns the hosted payment link. */
export async function razorpayCheckout(org: { id: string; name: string }) {
  const quantity = await activeSeatCount(org.id);
  const startAt = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 86400;
  const sub = await razorpay("subscriptions", "POST", {
    plan_id: process.env.RAZORPAY_PLAN_ID,
    total_count: 120, // up to 10 years of monthly billing; renewable
    quantity,
    customer_notify: 1,
    start_at: startAt,
    notes: { organizationId: org.id, organizationName: org.name.slice(0, 200) },
  });
  await db.organization.update({
    where: { id: org.id },
    data: { razorpaySubscriptionId: sub.id, billingProvider: "RAZORPAY", subscriptionStatus: "INCOMPLETE", billingUpdatedAt: new Date() },
  });
  return sub.short_url as string;
}

const RAZORPAY_STATUS: Record<string, string> = {
  created: "INCOMPLETE", authenticated: "TRIALING", active: "ACTIVE", pending: "PAST_DUE", halted: "UNPAID",
  cancelled: "CANCELED", completed: "CANCELED", expired: "CANCELED", paused: "PAST_DUE",
};

type RazorpaySub = { id: string; status: string; start_at?: number | null; current_end?: number | null; quantity?: number; notes?: { organizationId?: string } };

async function applyRazorpaySubscription(sub: RazorpaySub) {
  const org =
    (sub.notes?.organizationId && (await db.organization.findUnique({ where: { id: sub.notes.organizationId } }))) ||
    (await db.organization.findFirst({ where: { razorpaySubscriptionId: sub.id } }));
  if (!org) return;
  const status = RAZORPAY_STATUS[sub.status] ?? "INCOMPLETE";
  await applyStatus(org.id, {
    provider: "RAZORPAY",
    status,
    trialEndsAt: status === "TRIALING" && sub.start_at ? new Date(sub.start_at * 1000) : org.trialEndsAt,
    currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
    quantity: sub.quantity,
    extra: { razorpaySubscriptionId: sub.id },
  });
}

export async function razorpaySync(subscriptionId: string) {
  await applyRazorpaySubscription(await razorpay(`subscriptions/${subscriptionId}`, "GET"));
}

export async function razorpayCancel(subscriptionId: string) {
  await applyRazorpaySubscription(await razorpay(`subscriptions/${subscriptionId}/cancel`, "POST", { cancel_at_cycle_end: 1 }));
}

export function verifyRazorpaySignature(payload: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function handleRazorpayEvent(event: { event: string; payload?: { subscription?: { entity?: RazorpaySub } } }) {
  const sub = event.payload?.subscription?.entity;
  if (event.event.startsWith("subscription.") && sub) await applyRazorpaySubscription(sub);
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

async function applyStatus(
  organizationId: string,
  u: { provider: Provider | "DEV"; status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null; quantity?: number; extra?: Record<string, string> },
) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  if (org.subscriptionStatus === "COMPLIMENTARY") return;
  const failing = u.status === "PAST_DUE" || u.status === "UNPAID";
  await db.organization.update({
    where: { id: organizationId },
    data: {
      ...(u.provider !== "DEV" ? { billingProvider: u.provider } : {}),
      subscriptionStatus: u.status,
      trialEndsAt: u.trialEndsAt,
      currentPeriodEnd: u.currentPeriodEnd,
      pastDueSince: failing ? org.pastDueSince ?? new Date() : null,
      ...(u.quantity ? { billedQuantity: u.quantity } : {}),
      billingUpdatedAt: new Date(),
      ...(u.extra ?? {}),
    },
  });
  if (u.status !== org.subscriptionStatus) await announce(organizationId, org.name, org.subscriptionStatus, u.status);
}

async function announce(organizationId: string, orgName: string, from: string, to: string) {
  const messages: Record<string, [string, string] | undefined> = {
    TRIALING: ["Your free trial has started", `You have ${TRIAL_DAYS} days of full access. Your card is charged automatically when the trial ends.`],
    ACTIVE: from === "TRIALING" || from === "PAST_DUE" || from === "UNPAID" ? ["Subscription active", "Thank you! Your payment was successful."] : undefined,
    PAST_DUE: ["Subscription payment failed", `Please update your payment method within ${GRACE_DAYS} days to keep access.`],
    UNPAID: ["Subscription payment failed", `Please update your payment method within ${GRACE_DAYS} days to keep access.`],
    CANCELED: ["Subscription cancelled", "Your subscription was cancelled. Restart it anytime from the Billing page."],
  };
  const m = messages[to];
  if (!m) return;
  await notifyRoles(organizationId, ["ADMIN"], { type: "BILLING", title: m[0], body: m[1], link: "/billing" });
  const admins = await db.user.findMany({ where: { organizationId, role: "ADMIN", isActive: true } });
  for (const a of admins) {
    await sendEmail({
      organizationId,
      to: a.email,
      subject: m[0],
      type: "BILLING",
      html: emailLayout(orgName, m[0], `<p>Hello ${esc(a.name)},</p><p>${esc(m[1])}</p>`, { label: "Open billing", url: `${process.env.APP_URL}/billing` }),
    });
  }
}

/** Local development: start a trial without any gateway. */
export async function devStartTrial(organizationId: string) {
  await applyStatus(organizationId, {
    provider: "DEV",
    status: "TRIALING",
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000),
    currentPeriodEnd: null,
    quantity: await activeSeatCount(organizationId),
  });
}

/** Keep the billed seat count equal to active employees (called after employee changes and hourly). */
export async function syncSeats(organizationId: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org || !["TRIALING", "ACTIVE", "PAST_DUE"].includes(org.subscriptionStatus)) return;
  const quantity = await activeSeatCount(organizationId);
  if (quantity === org.billedQuantity) return;
  try {
    if (org.billingProvider === "STRIPE" && org.stripeSubscriptionId && billingConfig.stripe.enabled) {
      const sub = await stripe(`subscriptions/${org.stripeSubscriptionId}`, "GET");
      const item = sub.items?.data?.[0]?.id;
      if (item) {
        await stripe(`subscriptions/${org.stripeSubscriptionId}`, "POST", {
          "items[0][id]": item,
          "items[0][quantity]": String(quantity),
          proration_behavior: "create_prorations",
        });
      }
    } else if (org.billingProvider === "RAZORPAY" && org.razorpaySubscriptionId && billingConfig.razorpay.enabled) {
      // Razorpay applies quantity changes from the next billing cycle.
      await razorpay(`subscriptions/${org.razorpaySubscriptionId}`, "PATCH", { quantity, schedule_change_at: "cycle_end" });
    }
    await db.organization.update({ where: { id: organizationId }, data: { billedQuantity: quantity } });
  } catch (e) {
    console.error("[billing] seat sync failed", organizationId, e);
  }
}

export async function syncAllSeats() {
  const orgs = await db.organization.findMany({ where: { subscriptionStatus: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } }, select: { id: true } });
  for (const o of orgs) await syncSeats(o.id);
}
