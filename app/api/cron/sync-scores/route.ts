import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/apiAuth";
import { syncLiveScores } from "@/lib/scores/sync";
import { revalidatePath } from "next/cache";

async function runSync() {
  const result = await syncLiveScores(true);
  revalidatePath("/");
  revalidatePath("/leaderboard");
  revalidatePath("/picks");
  return result;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runSync());
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runSync());
}
