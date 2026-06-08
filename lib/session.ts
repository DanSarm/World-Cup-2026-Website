import { SignJWT } from "jose/jwt/sign";
import { cookies } from "next/headers";
import type { SessionPlayer } from "./types";
import {
  SESSION_COOKIE_NAME,
  verifySession,
} from "./sessionToken";

export { verifySession, SESSION_COOKIE_NAME } from "./sessionToken";

function getSecret(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ?? "dev-secret-min-16-chars!!";
  if (secret.length < 16) {
    throw new Error("SESSION_SECRET must be at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(player: SessionPlayer): Promise<string> {
  return new SignJWT({
    id: player.id,
    display_name: player.display_name,
    avatar_emoji: player.avatar_emoji,
    is_admin: player.is_admin,
    paid: player.paid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function getSession(): Promise<SessionPlayer | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireSession(): Promise<SessionPlayer> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireAdmin(): Promise<SessionPlayer> {
  const session = await requireSession();
  if (!session.is_admin) throw new Error("Forbidden");
  return session;
}
