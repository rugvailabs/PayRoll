"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/accounts";
import { homeFor, SESSION_COOKIE, sessionCookieOptions, signSession, type Role } from "@/lib/session";
import { getSession } from "@/lib/auth";
import { audit } from "@/lib/notify";
import { str } from "@/lib/format";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: string } | undefined;

async function startSession(user: { id: string; organizationId: string; role: string; name: string; email: string }) {
  const token = await signSession({
    uid: user.id,
    oid: user.organizationId,
    role: user.role as Role,
    name: user.name,
    email: user.email,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
}

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const company = str(formData.get("company"))?.toLowerCase();
  if (!email || !password) return { error: "Enter your email and password." };

  const portal = String(formData.get("portal") ?? "admin"); // admin | employee | client
  const candidates = await db.user.findMany({
    where: { email, isActive: true, ...(company ? { organization: { slug: company } } : {}) },
    include: { organization: true, employee: { select: { id: true } }, client: { select: { status: true } } },
  });
  const matches = [];
  for (const u of candidates) {
    if (u.passwordHash && (await verifyPassword(password, u.passwordHash))) matches.push(u);
  }
  if (matches.length === 0) return { error: "Invalid email or password." };
  if (matches.length > 1) {
    return { error: "This email belongs to more than one company. Enter your company code.", fieldErrors: { company: "Required" } };
  }
  const user = matches[0];
  // Each tab only signs in its own kind of account.
  const isClient = user.role === "CLIENT";
  if (portal === "client" && !isClient) return { error: "This is not a client account. Use the Admin or Employee tab." };
  if (portal !== "client" && isClient) return { error: "This is a client account. Use the Client tab." };
  if (portal === "employee" && !user.employee) return { error: "No employee profile is linked to this account. Use the Admin tab." };
  if (portal === "admin" && user.role === "EMPLOYEE") return { error: "This is an employee account. Use the Employee tab." };
  if (isClient && user.client?.status !== "ACTIVE") return { error: "Portal access for your company is currently disabled." };
  await startSession(user);
  await audit(user.organizationId, user.id, "LOGIN", "User", user.id, portal);
  if (user.mustChangePassword) redirect("/change-password");
  const next = str(formData.get("next"));
  redirect(next && safeNext(next) !== "/dashboard" ? safeNext(next) : portal === "employee" ? "/my" : homeFor(user.role as Role));
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "org";
}

export async function signupAction(_: FormState, formData: FormData): Promise<FormState> {
  const orgName = str(formData.get("orgName"));
  const name = str(formData.get("name"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: Record<string, string> = {};
  if (!orgName) fieldErrors.orgName = "Company name is required";
  if (!name) fieldErrors.name = "Your name is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter a valid email";
  const pwErr = validatePassword(password);
  if (pwErr) fieldErrors.password = pwErr;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  let slug = slugify(orgName!);
  for (let i = 2; await db.organization.findUnique({ where: { slug } }); i++) slug = `${slugify(orgName!)}-${i}`;

  const user = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: orgName!,
        slug,
        email,
        departments: { create: [{ name: "General" }, { name: "Engineering" }, { name: "Finance" }, { name: "HR" }] },
        jobTitles: {
          create: [{ name: "Software Engineer" }, { name: "Senior Software Engineer" }, { name: "Business Analyst" }, { name: "Project Manager" }, { name: "QA Engineer" }],
        },
      },
    });
    return tx.user.create({
      data: {
        organizationId: org.id,
        email,
        name: name!,
        role: "ADMIN",
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
      },
    });
  });
  await startSession(user);
  await audit(user.organizationId, user.id, "SIGNUP", "Organization", user.organizationId);
  redirect("/dashboard?welcome=1");
}

export async function setPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const user = token
    ? await db.user.findFirst({ where: { inviteToken: token, inviteExpires: { gt: new Date() }, isActive: true } })
    : null;
  if (!user) return { error: "This link is invalid or has expired. Ask your administrator to resend the invite." };
  const pwErr = validatePassword(password);
  if (pwErr) return { fieldErrors: { password: pwErr } };
  if (password !== confirm) return { fieldErrors: { confirm: "Passwords do not match" } };
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), inviteToken: null, inviteExpires: null, mustChangePassword: false },
  });
  await startSession(user);
  redirect(homeFor(user.role as Role));
}

export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.uid } });
  if (!user?.passwordHash) redirect("/login");
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return { fieldErrors: { current: "Current password is incorrect" } };
  const pwErr = validatePassword(password);
  if (pwErr) return { fieldErrors: { password: pwErr } };
  if (password !== confirm) return { fieldErrors: { confirm: "Passwords do not match" } };
  if (password === current) return { fieldErrors: { password: "Choose a password different from the current one" } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } });
  redirect(homeFor(user.role as Role));
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
