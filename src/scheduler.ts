// Hourly reminder job for single-server deployments (idempotent: each reminder
// is sent once). Set REMINDERS_AUTORUN="false" when an external scheduler calls
// /api/cron/reminders instead.
import { runAllReminders } from "./lib/reminders";
import { syncAllSeats } from "./lib/billing";

const g = globalThis as unknown as { __remindersScheduled?: boolean };

if (process.env.REMINDERS_AUTORUN !== "false" && !g.__remindersScheduled) {
  g.__remindersScheduled = true;
  const run = () => {
    runAllReminders().catch((e) => console.error("[reminders]", e));
    syncAllSeats().catch((e) => console.error("[billing seats]", e));
  };
  setTimeout(run, 30_000);
  setInterval(run, 60 * 60 * 1000);
}
