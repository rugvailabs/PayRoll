import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink-900 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">P</span>
          {APP_NAME}
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">{APP_TAGLINE}</h2>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            {[
              "Onboard employees and send portal logins automatically",
              "Collect timesheets with client-approved attachments",
              "Invoice clients and track pending payment aging",
              "Run payroll and get alerts for overdue payments",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600/40 text-xs">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} {APP_NAME}</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
