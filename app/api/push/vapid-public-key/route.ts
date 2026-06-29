import { NextResponse } from "next/server";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push/vapid";

export async function GET() {
  const publicKey = getVapidPublicKey();
  return NextResponse.json(
    {
      configured: isPushConfigured(),
      publicKey,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
