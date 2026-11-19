import { CheckCircle2, ShieldCheck } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

/** Decorative product preview for the brand panel (static, not real data). */
function Preview() {
  const bars = [46, 62, 54, 78, 70, 88];
  return (
    <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Outstanding receivables</p>
          <p className="mt-1 text-2xl font-semibold text-white">$78,960</p>
        </div>
        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-300">+12% collected</span>
      </div>
      <div className="flex h-28 items-end gap-3">
        {bars.map((h, i) => (
          <div key={i} className="flex h-full flex-1 items-end gap-1">
            <div className="flex-1 rounded-t bg-[#2a78d6]" style={{ height: `${h}%` }} />
            <div className="flex-1 rounded-t bg-[#eb6834]/90" style={{ height: `${h * 0.78}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {[
          ["Axiom Global Technologies", "Approved", "bg-emerald-400/15 text-emerald-300"],
          ["Northwind Health", "Overdue 29d", "bg-red-400/15 text-red-300"],
        ].map(([n, s, c]) => (
          <div key={n} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs">
            <span className="text-slate-200">{n}</span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${c}`}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-12 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }}
          aria-hidden
        />
        <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-sky-500/15 blur-3xl" aria-hidden />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            {APP_NAME.charAt(0)}
          </span>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="relative space-y-10">
          <div className="max-w-md">
            <h2 className="text-[32px] font-semibold leading-[1.15] tracking-tight">{APP_TAGLINE}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
              The back office for staffing teams: onboard consultants, approve client timesheets, bill clients and run payroll.
            </p>
          </div>
          <Preview />
          <ul className="grid max-w-md grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] text-slate-300">
            {["Client-approved timesheets", "Invoices & payment aging", "Payroll & pay statements", "Automatic payment alerts"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-brand-300" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck size={14} /> Each organization&apos;s data is isolated and encrypted in transit. © {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2.5 px-6 pt-6 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">{APP_NAME.charAt(0)}</span>
          <span className="font-semibold">{APP_NAME}</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
