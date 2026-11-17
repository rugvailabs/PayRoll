import type { Metadata } from "next";
import { SignupForm } from "../forms";

export const metadata: Metadata = { title: "Create organization" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Create your organization</h1>
      <p className="mb-8 mt-1 text-sm text-slate-500">You will be the administrator of this workspace.</p>
      <SignupForm />
    </>
  );
}
