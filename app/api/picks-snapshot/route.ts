import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPicksSnapshot } from "@/lib/data";
import {
  findPickReminderForPlayer,
  findUpcomingPickSchedules,
  firePickReminders,
} from "@/lib/pickReminders";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    firePickReminders();

    const snapshot = await getPicksSnapshot(session.id);
    const pickReminder = findPickReminderForPlayer(
      snapshot.matches,
      snapshot.predictions
    );
    const pickSchedules = findUpcomingPickSchedules(
      snapshot.matches,
      snapshot.predictions
    );

    return NextResponse.json({ ...snapshot, pickReminder, pickSchedules });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Picks snapshot failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
