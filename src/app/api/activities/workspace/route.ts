import { NextResponse } from "next/server";
import { listFeedActivities, serializeActivity } from "@/server/activities";
import { requireApiSession } from "@/server/api-auth";

/** `GET /api/activities/workspace` → `{ activities }` — single tenant,
 *  the whole feed IS the workspace feed. */

export async function GET(): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const rows = await listFeedActivities();
  return NextResponse.json({ activities: rows.map(serializeActivity) });
}
