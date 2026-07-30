import { NextResponse } from "next/server";
import { listFeedActivities, serializeActivity } from "@/server/activities";

/** `GET /api/activities/me` → `{ activities }` — every local activity is
 *  the single local actor's until auth (swap step 6) adds identities. */

export async function GET(): Promise<NextResponse> {
  const rows = await listFeedActivities();
  return NextResponse.json({ activities: rows.map(serializeActivity) });
}
