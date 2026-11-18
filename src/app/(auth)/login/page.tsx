import type { Metadata } from "next";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; portal?: string; inactive?: string }>;
}) {
  const { next, portal, inactive } = await searchParams;
  const initial = portal ?? (next?.startsWith("/client") ? "client" : next?.startsWith("/my") ? "employee" : undefined);
  return <LoginForm next={next} initialPortal={initial} inactive={!!inactive} />;
}
