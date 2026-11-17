import type { Metadata } from "next";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
      <p className="mb-8 mt-1 text-sm text-slate-500">Sign in to your workforce portal.</p>
      <LoginForm next={next} />
    </>
  );
}
