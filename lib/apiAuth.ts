import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function requireAdminApi() {
  const session = await getSession();
  if (!session?.is_admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  return session;
}

export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}
