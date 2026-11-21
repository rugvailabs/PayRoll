import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui";
import { requireUserAllowLocked } from "@/lib/auth";
import { accessFor } from "@/lib/billing";

export const metadata: Metadata = { title: "Access paused" };

export default async function SuspendedPage() {
  const user = await requireUserAllowLocked();
  if (accessFor(user.organization).state === "ok") redirect(user.role === "CLIENT" ? "/client" : user.role === "EMPLOYEE" ? "/my" : "/dashboard");
  if (user.role === "ADMIN") redirect("/billing");
  return (
    <Card className="mx-auto max-w-lg p-10 text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
        <Lock size={22} />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Access is temporarily paused</h1>
      <p className="mt-2 text-sm text-slate-500">
        {user.role === "CLIENT"
          ? `The ${user.organization.name} portal is currently unavailable. Please contact your account manager.`
          : `${user.organization.name}'s subscription is not active. Please ask your administrator to update the billing details.`}
      </p>
    </Card>
  );
}
