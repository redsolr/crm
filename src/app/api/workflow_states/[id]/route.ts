import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, workflowStages } from "@/db";
import { apiError, readJsonBody } from "@/server/api-error";
import { serializeStage } from "@/server/bootstrap";

/** `PATCH /api/workflow_states/:id` → `{ state }` (lane rename). */

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateStateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const existing = await db
    .select()
    .from(workflowStages)
    .where(eq(workflowStages.id, id))
    .limit(1);
  if (!existing[0]) {
    return apiError(404, "not_found", `Workflow state not found: ${id}`);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const raw = parsedBody.body;
  const parsed = updateStateSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }

  if (parsed.data.name !== undefined) {
    await db
      .update(workflowStages)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(workflowStages.id, id));
  }

  const updated = await db
    .select()
    .from(workflowStages)
    .where(eq(workflowStages.id, id))
    .limit(1);
  return NextResponse.json({ state: serializeStage(updated[0]!) });
}
