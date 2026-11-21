import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard, Lock, ShieldCheck } from "lucide-react";
import { Alert, Badge, Card, CardBody, CardHeader, DescList } from "@/components/ui";
import { requireUserAllowLocked } from "@/lib/auth";
import { accessFor, activeSeatCount, billingConfig, razorpaySync, stripeSync, stripeSyncFromSession, TRIAL_DAYS, GRACE_DAYS } from "@/lib/billing";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { CheckoutButton, ManageButton } from "./forms";

export const metadata: Metadata = { title: "Billing" };

const STATUS_LABEL: Record<string, string> = {
  NONE: "Not started", INCOMPLETE: "Awaiting payment", TRIALING: "Free trial", ACTIVE: "Active",
  PAST_DUE: "Payment failed", UNPAID: "Payment failed", CANCELED: "Cancelled", COMPLIMENTARY: "Complimentary",
};
const STATUS_BADGE: Record<string, string> = {
  NONE: "DRAFT", INCOMPLETE: "PARTIAL", TRIALING: "SENT", ACTIVE: "ACTIVE", PAST_DUE: "OVERDUE", UNPAID: "OVERDUE", CANCELED: "VOID", COMPLIMENTARY: "ACTIVE",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; provider?: string; cancelled?: string; welcome?: string }>;
}) {
  const user = await requireUserAllowLocked();
  const sp = await searchParams;
  if (user.role !== "ADMIN") redirect(accessFor(user.organization).state === "locked" ? "/suspended" : "/dashboard");

  // Pull the latest status from the gateway after returning from checkout (works without webhooks locally).
  try {
    if (sp.session_id && billingConfig.stripe.enabled) await stripeSyncFromSession(user.organizationId, sp.session_id);
    else if (user.organization.billingProvider === "STRIPE" && user.organization.stripeSubscriptionId && billingConfig.stripe.enabled && user.organization.subscriptionStatus !== "ACTIVE")
      await stripeSync(user.organizationId, user.organization.stripeSubscriptionId);
    else if (user.organization.billingProvider === "RAZORPAY" && user.organization.razorpaySubscriptionId && billingConfig.razorpay.enabled && user.organization.subscriptionStatus !== "ACTIVE")
      await razorpaySync(user.organization.razorpaySubscriptionId);
  } catch (e) {
    console.error("[billing] sync on load failed", e);
  }
  const org = await db.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  const access = accessFor(org);
  const seats = await activeSeatCount(org.id);
  const started = ["TRIALING", "ACTIVE", "PAST_DUE", "UNPAID", "COMPLIMENTARY"].includes(org.subscriptionStatus) ||
    (org.subscriptionStatus === "CANCELED" && access.state === "ok");
  const indian = /india/i.test(org.country);
  const anyGateway = billingConfig.stripe.enabled || billingConfig.razorpay.enabled;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">
          {started ? "Subscription & billing" : "Start your subscription"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {started
            ? "Manage your plan, payment method and billing."
            : `Activate ${org.name} to start using the app. Your first ${TRIAL_DAYS} days are free; your card is charged only after the trial.`}
        </p>
      </div>

      {sp.welcome && !started && <div className="mb-6"><Alert tone="success">Your organization was created. One last step: start your free trial.</Alert></div>}
      {sp.cancelled && <div className="mb-6"><Alert tone="warning">Checkout was cancelled. You can try again anytime.</Alert></div>}
      {access.state === "locked" && started === false && org.subscriptionStatus === "INCOMPLETE" && (
        <div className="mb-6"><Alert tone="info">We&apos;re waiting for the payment authorization to complete. If you already finished checkout, click <b>Refresh status</b>.</Alert></div>
      )}
      {access.state === "locked" && (org.subscriptionStatus === "PAST_DUE" || org.subscriptionStatus === "UNPAID" || org.subscriptionStatus === "CANCELED") && (
        <div className="mb-6"><Alert tone="error"><b>Access is locked.</b> {access.reason} Update your payment or restart the subscription below to restore access for your team.</Alert></div>
      )}
      {access.state === "ok" && access.banner && <div className="mb-6"><Alert tone={access.banner.tone}>{access.banner.text}</Alert></div>}

      {started ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Your plan" actions={<Badge status={STATUS_BADGE[org.subscriptionStatus] ?? "DRAFT"}>{STATUS_LABEL[org.subscriptionStatus] ?? org.subscriptionStatus}</Badge>} />
            <CardBody>
              <DescList items={[
                { label: "Plan", value: "Per active employee, billed monthly" },
                { label: "Payment gateway", value: org.billingProvider === "STRIPE" ? "Stripe (USD)" : org.billingProvider === "RAZORPAY" ? "Razorpay (INR)" : org.subscriptionStatus === "COMPLIMENTARY" ? "Not required" : "Development trial" },
                { label: "Active employees billed", value: `${org.billedQuantity || seats}` },
                { label: "Trial ends", value: org.trialEndsAt ? formatDate(org.trialEndsAt) : null },
                { label: "Current period ends", value: org.currentPeriodEnd ? formatDate(org.currentPeriodEnd) : null },
                { label: "Grace period on failed payment", value: `${GRACE_DAYS} days` },
              ]} />
              <p className="mt-5 text-xs text-slate-500">
                Billed seats follow your active employee count automatically. Adding or deactivating employees updates the next invoice.
              </p>
            </CardBody>
          </Card>
          <Card className="h-fit">
            <CardHeader title="Manage" />
            <CardBody className="space-y-3">
              {org.billingProvider === "STRIPE" && org.stripeCustomerId && <ManageButton op="portal" label="Update card, invoices & cancel" />}
              {org.billingProvider === "RAZORPAY" && org.razorpaySubscriptionId && (
                <ManageButton op="cancel-razorpay" label="Cancel at period end" variant="danger" confirm="Cancel subscription?" />
              )}
              {(org.stripeSubscriptionId || org.razorpaySubscriptionId) && <ManageButton op="refresh" label="Refresh status" />}
              {org.subscriptionStatus === "COMPLIMENTARY" && <p className="text-sm text-slate-500">This organization has complimentary access. No payment is needed.</p>}
              {!org.billingProvider && org.subscriptionStatus === "TRIALING" && (
                <p className="text-sm text-slate-500">Development trial: no payment gateway is connected. On a live server, companies subscribe through Stripe or Razorpay.</p>
              )}
              {(org.subscriptionStatus === "CANCELED" || org.subscriptionStatus === "UNPAID") && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  {billingConfig.stripe.enabled && <CheckoutButton provider="STRIPE" label="Restart with Stripe (USD)" />}
                  {billingConfig.razorpay.enabled && <CheckoutButton provider="RAZORPAY" label="Restart with Razorpay (INR)" variant="secondary" />}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-5 md:grid-cols-2">
            {[
              { provider: "RAZORPAY", title: "Pay in INR", sub: "Razorpay · UPI, cards, net banking", price: billingConfig.razorpay.pricePerEmployee ? `₹${billingConfig.razorpay.pricePerEmployee}` : null, enabled: billingConfig.razorpay.enabled, recommended: indian },
              { provider: "STRIPE", title: "Pay in USD", sub: "Stripe · cards & ACH", price: billingConfig.stripe.pricePerEmployee ? `$${billingConfig.stripe.pricePerEmployee}` : null, enabled: billingConfig.stripe.enabled, recommended: !indian },
            ]
              .sort((a, b) => Number(b.recommended) - Number(a.recommended))
              .map((g) => (
                <Card key={g.provider} className={g.recommended ? "ring-2 ring-brand-500/40" : ""}>
                  <CardBody className="flex h-full flex-col">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{g.title}</p>
                        <p className="text-xs text-slate-500">{g.sub}</p>
                      </div>
                      {g.recommended && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Recommended</span>}
                    </div>
                    <p className="mb-1">
                      <span className="text-3xl font-semibold tracking-tight text-slate-900">{g.price ?? "—"}</span>
                      <span className="text-sm text-slate-500"> / active employee / month</span>
                    </p>
                    <p className="mb-5 text-xs text-slate-500">You have {seats} active employee(s) today · {TRIAL_DAYS}-day free trial</p>
                    <ul className="mb-6 space-y-2 text-sm text-slate-600">
                      {["Unlimited clients, timesheets & invoices", "Payroll, payment aging & alerts", "Employee and client portals"].map((t) => (
                        <li key={t} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-500" /> {t}</li>
                      ))}
                    </ul>
                    <div className="mt-auto">
                      {g.enabled ? (
                        <CheckoutButton provider={g.provider} label={`Start ${TRIAL_DAYS}-day free trial`} variant={g.recommended ? "primary" : "secondary"} />
                      ) : (
                        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-500">Not configured on this server yet</p>
                      )}
                    </div>
                  </CardBody>
                </Card>
              ))}
          </div>

          {!anyGateway && billingConfig.devBypass && (
            <Card className="mb-6 border-dashed">
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">Development mode</p>
                  <p className="text-sm text-slate-500">No payment gateway keys are set in <code>.env</code>. Start a trial without payment to test locally.</p>
                </div>
                <div className="w-56"><CheckoutButton provider="DEV" label="Start trial (dev only)" variant="secondary" /></div>
              </CardBody>
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Lock size={13} /> Payments are processed securely by the gateway</span>
            <span className="inline-flex items-center gap-1.5"><CreditCard size={13} /> We never see or store your card number</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Cancel anytime</span>
          </div>
        </>
      )}
    </>
  );
}
