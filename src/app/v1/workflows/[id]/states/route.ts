import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, workflows } from "@/db";
import { apiError } from "@/server/api-error";
import { listStagesForWorkflow, serializeStage } from "@/server/bootstrap";

/** `GET /v1/workflows/:id/states` → `{ data }` (position order). */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const workflow = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id))
    .limit(1);
  if (!workflow[0]) {
    return apiError(404, "not_found", `Workflow not found: ${id}`);
  }
  const stages = await listStagesForWorkflow(id);
  return NextResponse.json({ data: stages.map(serializeStage) });
}
