import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** Signs the user out and returns to the login page (used when an account or client is deactivated). */
export async function GET(req: Request) {
  const reason = new URL(req.url).searchParams.get("reason");
  const res = NextResponse.redirect(new URL(`/login${reason === "inactive" ? "?inactive=1" : ""}`, req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
