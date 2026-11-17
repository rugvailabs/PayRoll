import { NextResponse } from "next/server";
import { runAllReminders } from "@/lib/reminders";

// Call daily from a scheduler (cron, Azure/AWS scheduler, Vercel cron):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/reminders
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const results = await runAllReminders();
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}
