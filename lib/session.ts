import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionPlayer } from "./types";

const COOKIE_NAME = "family_cup_session";

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

export async function verifySession(
  token: string
): Promise<SessionPlayer | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: payload.id as string,
      display_name: payload.display_name as string,
      avatar_emoji: (payload.avatar_emoji as string) ?? "⚽",
      is_admin: Boolean(payload.is_admin),
      paid: Boolean(payload.paid),
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPlayer | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
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
