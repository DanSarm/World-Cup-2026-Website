import { jwtVerify } from "jose/jwt/verify";
import type { SessionPlayer } from "./types";

export const SESSION_COOKIE_NAME = "family_cup_session";

function getSecret(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ?? "dev-secret-min-16-chars!!";
  if (secret.length < 16) {
    throw new Error("SESSION_SECRET must be at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

/** Edge-safe JWT verification for middleware. */
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
