import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, records } from "@/db";
import { apiError, readJsonBody } from "@/server/api-error";
import { logActivity } from "@/server/activities";
import { asActivityActor, currentActor } from "@/server/actor";
import {
  bulkUpdateSchema,
  completedAtFor,
  loadWorkItem,
  resolveStage,
  serializeWorkItem,
  type JoinedWorkItem,
} from "@/server/work-items";

/**
 * `POST /api/work_items/bulk` — bulk field update. Exempt from
 * `If-Match` like the platform (per-item versions are unknowable in a
 * single envelope); each touched row still bumps its own version.
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const raw = parsedBody.body;
  const parsed = bulkUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }
  const body = parsed.data;

  if (typeof body.iteration_id === "string" || typeof body.epic_id === "string") {
    return apiError(
      422,
      "validation_failed",
      "iteration_id / epic_id cannot be set: the CRM has no iterations or epics",
    );
  }

  const loaded: JoinedWorkItem[] = [];
  const missing: string[] = [];
  for (const id of body.work_item_ids) {
    const row = await loadWorkItem(id);
    if (row) loaded.push(row);
    else missing.push(id);
  }
  if (missing.length > 0) {
    return apiError(
      422,
      "validation_failed",
      `Unknown work item ids: ${missing.join(", ")}`,
    );
  }

  const actor = await currentActor();
  const updatedIds: string[] = [];
  for (const row of loaded) {
    const changes: Partial<typeof records.$inferInsert> = {};

    let stateChange: { from: string; to: string } | null = null;
    if (body.state_key !== undefined) {
      const stage = await resolveStage(row.type, body.state_key);
      if (!stage) {
        return apiError(
          422,
          "validation_failed",
          `Unknown workflow state key for type ${row.type.key}: ${body.state_key}`,
        );
      }
      if (stage.id !== row.record.stateId) {
        stateChange = { from: row.state.key, to: stage.key };
      }
      changes.stateId = stage.id;
      changes.completedAt = completedAtFor(
        stage.category,
        row.record.completedAt,
      );
    }
    if (body.priority !== undefined) changes.priority = body.priority;
    if (body.assignee_id !== undefined) {
      changes.assigneeId = body.assignee_id;
      changes.assigneeName = null;
    }
    // add_label_ids / remove_label_ids: labels don't exist locally; the
    // sales surfaces never send them (accepted for wire compatibility).

    changes.version = row.record.version + 1;
    changes.updatedAt = new Date();
    await db.update(records).set(changes).where(eq(records.id, row.record.id));
    await logActivity({
      type: stateChange ? "work_item_status_changed" : "work_item_updated",
      entityId: row.record.id,
      entityIdentifier: row.record.identifier,
      changes: stateChange ? { state_key: stateChange } : null,
      actor: asActivityActor(actor),
    });
    updatedIds.push(row.record.id);
  }

  const workItems = [];
  for (const id of updatedIds) {
    const row = await loadWorkItem(id);
    if (row) workItems.push(serializeWorkItem(row));
  }
  return NextResponse.json({ work_items: workItems });
}
