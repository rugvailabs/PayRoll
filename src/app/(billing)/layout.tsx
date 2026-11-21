import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireUserAllowLocked } from "@/lib/auth";
import { accessFor } from "@/lib/billing";
import { APP_NAME } from "@/lib/brand";
import { logoutAction } from "@/app/(auth)/actions";

/** Minimal shell for billing/suspended pages so they work while the app is locked. */
export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserAllowLocked();
  const unlocked = accessFor(user.organization).state === "ok";
  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-8">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
          {APP_NAME.charAt(0)}
        </span>
        <span className="font-semibold tracking-tight">{APP_NAME}</span>
        <span className="hidden text-sm text-slate-400 sm:inline">/ {user.organization.name}</span>
        <div className="flex-1" />
        {unlocked && (
          <Link href={user.role === "CLIENT" ? "/client" : user.role === "EMPLOYEE" ? "/my" : "/dashboard"} className="text-sm font-medium text-brand-600 hover:underline">
            Back to app
          </Link>
        )}
        <form action={logoutAction}>
          <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            <LogOut size={15} /> Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
