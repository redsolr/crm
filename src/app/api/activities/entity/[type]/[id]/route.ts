import { NextResponse, type NextRequest } from "next/server";
import { listEntityActivities, serializeActivity } from "@/server/activities";
import { requireApiSession } from "@/server/api-auth";

/** `GET /api/activities/entity/:type/:id` → `{ activities }` (bounded ~50,
 *  newest first — record-timeline feed). */

interface RouteContext {
  params: Promise<{ type: string; id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const { type, id } = await context.params;
  const rows = await listEntityActivities(type, id);
  return NextResponse.json({ activities: rows.map(serializeActivity) });
}
