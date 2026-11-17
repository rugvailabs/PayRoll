import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Alert } from "@/components/ui";
import { SetPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Set password" };

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const user = token
    ? await db.user.findFirst({
        where: { inviteToken: token, inviteExpires: { gt: new Date() }, isActive: true },
        include: { organization: true },
      })
    : null;
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Set your password</h1>
      {user ? (
        <>
          <p className="mb-8 mt-1 text-sm text-slate-500">
            {user.email} · {user.organization.name}
          </p>
          <SetPasswordForm token={token!} />
        </>
      ) : (
        <div className="mt-6">
          <Alert tone="error">This link is invalid or has expired. Ask your administrator to resend your invite.</Alert>
        </div>
      )}
    </>
  );
}
