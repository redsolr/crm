import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, activities } from "@/db";
import { requireApiSession } from "@/server/api-auth";
import { serializeActivity } from "@/server/activities";
import { MCP_BRIDGE_ACTOR } from "@/server/constants";

/**
 * `GET /api/bridge` — the Account → Integrations card's data: whether
 * the Jurisimus bridge token is configured on this deployment, and the
 * most recent timeline events the bridge wrote (everything the platform
 * pushed through the /mcp door as "Jurisimus Platform"). Session-gated
 * like every admin surface; read-only — the bridge itself writes only
 * through the MCP tools.
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const rows = await db
    .select()
    .from(activities)
    .where(eq(activities.actorId, MCP_BRIDGE_ACTOR.id))
    .orderBy(desc(activities.createdAt))
    .limit(20);
  return NextResponse.json({
    configured: Boolean(process.env.CRM_MCP_BRIDGE_TOKEN),
    events: rows.map(serializeActivity),
  });
}
