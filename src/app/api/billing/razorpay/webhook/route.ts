import { handleRazorpayEvent, verifyRazorpaySignature } from "@/lib/billing";

/** Razorpay webhook: set the URL to /api/billing/razorpay/webhook and its secret in RAZORPAY_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const payload = await req.text();
  if (!verifyRazorpaySignature(payload, req.headers.get("x-razorpay-signature"), secret)) return new Response("Invalid signature", { status: 400 });
  try {
    await handleRazorpayEvent(JSON.parse(payload));
  } catch (e) {
    console.error("[razorpay webhook]", e);
    return new Response("Handler error", { status: 500 });
  }
  return Response.json({ received: true });
}
