"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserAllowLocked } from "@/lib/auth";
import {
  billingConfig, devStartTrial, razorpayCancel, razorpayCheckout, razorpaySync, stripeCheckout, stripePortal, stripeSync,
} from "@/lib/billing";
import { audit } from "@/lib/notify";

async function requireBillingAdmin() {
  const user = await requireUserAllowLocked();
  if (user.role !== "ADMIN") redirect("/suspended");
  return user;
}

export type BillingState = { error?: string; ok?: string } | undefined;

export async function startCheckoutAction(_: BillingState, fd: FormData): Promise<BillingState> {
  const user = await requireBillingAdmin();
  const provider = String(fd.get("provider"));
  let url: string;
  try {
    if (provider === "STRIPE") {
      if (!billingConfig.stripe.enabled) return { error: "Stripe is not configured on this server." };
      url = await stripeCheckout(user.organization, user.email);
    } else if (provider === "RAZORPAY") {
      if (!billingConfig.razorpay.enabled) return { error: "Razorpay is not configured on this server." };
      url = await razorpayCheckout(user.organization);
    } else if (provider === "DEV" && billingConfig.devBypass) {
      await devStartTrial(user.organizationId);
      await audit(user.organizationId, user.id, "START_TRIAL", "Organization", user.organizationId, "development");
      redirect("/dashboard?welcome=1");
    } else {
      return { error: "Choose a payment method." };
    }
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // let redirect() through
    return { error: e instanceof Error ? e.message : "Could not start checkout." };
  }
  await audit(user.organizationId, user.id, "START_CHECKOUT", "Organization", user.organizationId, provider);
  redirect(url);
}

export async function manageBillingAction(_: BillingState, fd: FormData): Promise<BillingState> {
  const user = await requireBillingAdmin();
  const org = user.organization;
  const op = String(fd.get("op"));
  try {
    if (op === "portal" && org.stripeCustomerId) {
      const url = await stripePortal(org.stripeCustomerId);
      redirect(url);
    }
    if (op === "refresh") {
      if (org.billingProvider === "STRIPE" && org.stripeSubscriptionId) await stripeSync(org.id, org.stripeSubscriptionId);
      if (org.billingProvider === "RAZORPAY" && org.razorpaySubscriptionId) await razorpaySync(org.razorpaySubscriptionId);
      revalidatePath("/billing");
      return { ok: "Subscription status refreshed." };
    }
    if (op === "cancel-razorpay" && org.razorpaySubscriptionId) {
      await razorpayCancel(org.razorpaySubscriptionId);
      await audit(org.id, user.id, "CANCEL_SUBSCRIPTION", "Organization", org.id, "razorpay");
      revalidatePath("/billing");
      return { ok: "Subscription will cancel at the end of the current billing period." };
    }
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { error: e instanceof Error ? e.message : "Billing request failed." };
  }
  return { error: "Nothing to do." };
}
