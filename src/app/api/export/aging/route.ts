import { db } from "@/lib/db";
import { routeStaff } from "@/lib/route-auth";
import { AGING_BUCKETS, agingBucket, balanceByCandidate, balanceOf, CANDIDATE_INCLUDE, type BucketKey } from "@/lib/finance";
import { csvResponse, money, toCsv } from "@/lib/csv";
import { dateToInput, todayUtc } from "@/lib/format";

/** Aging report as Excel CSV, grouped by client (default) or by candidate (?by=candidate). */
export async function GET(req: Request) {
  const user = await routeStaff("payments.manage");
  if (!user) return new Response("Forbidden", { status: 403 });
  const by = new URL(req.url).searchParams.get("by") === "candidate" ? "candidate" : "client";
  const today = todayUtc();
  const invoices = await db.invoice.findMany({
    where: { organizationId: user.organizationId, status: { in: ["SENT", "PARTIAL"] } },
    include: { client: true, ...CANDIDATE_INCLUDE },
  });
  const empty = (): Record<BucketKey, number> => ({ current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 });
  const rows = new Map<string, { name: string; client: string; b: Record<BucketKey, number> }>();
  for (const i of invoices) {
    if (balanceOf(i) <= 0) continue;
    const bucket = agingBucket(i, today);
    const parts =
      by === "candidate"
        ? balanceByCandidate(i).map((p) => ({ key: `${p.id}:${i.clientId}`, name: p.name, amt: p.balance }))
        : [{ key: i.clientId, name: i.client.name, amt: balanceOf(i) }];
    for (const p of parts) {
      const r = rows.get(p.key) ?? { name: p.name, client: i.client.name, b: empty() };
      r.b[bucket] += p.amt;
      rows.set(p.key, r);
    }
  }
  const header = [...(by === "candidate" ? ["Candidate", "Client"] : ["Client"]), ...AGING_BUCKETS.map((b) => b.label), "Total"];
  const body = toCsv(
    header,
    [...rows.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => {
        const total = Object.values(r.b).reduce((a, x) => a + x, 0);
        return [...(by === "candidate" ? [r.name, r.client] : [r.name]), ...AGING_BUCKETS.map((b) => money(r.b[b.key])), money(total)];
      }),
  );
  return csvResponse(`aging-by-${by}-${dateToInput(today)}.csv`, body);
}
