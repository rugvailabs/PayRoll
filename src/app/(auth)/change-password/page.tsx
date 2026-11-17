import type { Metadata } from "next";
import { ChangePasswordForm } from "../forms";

export const metadata: Metadata = { title: "Change password" };

export default function ChangePasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Change your password</h1>
      <p className="mb-8 mt-1 text-sm text-slate-500">Please choose a new password to continue.</p>
      <ChangePasswordForm />
    </>
  );
}
