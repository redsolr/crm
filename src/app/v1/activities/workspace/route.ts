import { NextResponse } from "next/server";
import { listFeedActivities, serializeActivity } from "@/server/activities";

/** `GET /v1/activities/workspace` → `{ activities }` — single tenant,
 *  the whole feed IS the workspace feed. */

export async function GET(): Promise<NextResponse> {
  const rows = await listFeedActivities();
  return NextResponse.json({ activities: rows.map(serializeActivity) });
}
