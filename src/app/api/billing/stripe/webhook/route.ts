import { handleStripeEvent, verifyStripeSignature } from "@/lib/billing";

/** Stripe webhook: set the endpoint to /api/billing/stripe/webhook and put its signing secret in STRIPE_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) return new Response("Invalid signature", { status: 400 });
  try {
    await handleStripeEvent(JSON.parse(payload));
  } catch (e) {
    console.error("[stripe webhook]", e);
    return new Response("Handler error", { status: 500 });
  }
  return Response.json({ received: true });
}
