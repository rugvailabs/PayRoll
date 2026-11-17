import "server-only";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";
import { emailLayout, esc, sendEmail } from "./email";

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must contain letters and numbers.";
  return null;
}

export function generateTempPassword() {
  // 12 chars, readable alphabet, guaranteed letter + digit.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(10);
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s + "a" + String(crypto.randomInt(2, 10));
}

const INVITE_DAYS = 7;

/** Creates a fresh invite token for the user and emails a "set your password" link. */
export async function sendInvite(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { organization: true } });
  const token = crypto.randomBytes(32).toString("hex");
  await db.user.update({
    where: { id: userId },
    data: { inviteToken: token, inviteExpires: new Date(Date.now() + INVITE_DAYS * 86400000) },
  });
  const url = `${process.env.APP_URL}/set-password?token=${token}`;
  const org = user.organization;
  const html = emailLayout(
    org.name,
    "Your account is ready",
    `<p>Hello ${esc(user.name)},</p>
     <p>An account has been created for you on the <b>${esc(org.name)}</b> workforce portal. You can submit timesheets and view your pay statements there.</p>
     <p><b>Login email:</b> ${esc(user.email)}<br/><b>Company code:</b> ${esc(org.slug)}</p>
     <p>Click the button below to set your password. This link expires in ${INVITE_DAYS} days.</p>`,
    { label: "Set your password", url },
  );
  return sendEmail({
    organizationId: org.id,
    to: user.email,
    subject: `Your ${org.name} portal login`,
    html,
    type: "INVITE",
    relatedId: user.id,
  });
}

/**
 * Sets a new temporary password (must be changed on first login).
 * Returns the plain password so the admin can share it manually; optionally emails it.
 */
export async function resetToTempPassword(userId: string, email: boolean) {
  const password = generateTempPassword();
  const user = await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true, inviteToken: null, inviteExpires: null },
    include: { organization: true },
  });
  if (email) {
    const org = user.organization;
    await sendEmail({
      organizationId: org.id,
      to: user.email,
      subject: `Your ${org.name} portal login`,
      type: "CREDENTIALS",
      relatedId: user.id,
      html: emailLayout(
        org.name,
        "Your login details",
        `<p>Hello ${esc(user.name)},</p>
         <p><b>Login email:</b> ${esc(user.email)}<br/><b>Company code:</b> ${esc(org.slug)}<br/><b>Temporary password:</b> <code>${esc(password)}</code></p>
         <p>You will be asked to change this password when you first sign in.</p>`,
        { label: "Sign in", url: `${process.env.APP_URL}/login` },
      ),
    });
  }
  return password;
}
