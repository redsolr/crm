import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, records } from "@/db";
import { apiError, parseIfMatchVersion, readJsonBody } from "@/server/api-error";
import { logActivity } from "@/server/activities";
import { currentActor } from "@/server/actor";
import {
  completedAtFor,
  loadWorkItem,
  resolveStage,
  serializeWorkItem,
  updateWorkItemSchema,
} from "@/server/work-items";

/**
 * `GET` / `PATCH` / `DELETE` `/api/work_items/:id`. Mutations enforce
 * the platform's `If-Match: W/"v<n>"` optimistic-concurrency contract
 * (428 `precondition_required` when absent, 412 `version_conflict` on
 * stale version) so the untouched frontend's error paths keep working.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const row = await loadWorkItem(id);
  if (!row) return apiError(404, "not_found", `Work item not found: ${id}`);
  return NextResponse.json({ work_item: serializeWorkItem(row) });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  const version = parseIfMatchVersion(request);
  if (version === null) {
    return apiError(
      428,
      "precondition_required",
      'PATCH /work_items/:id requires an If-Match: W/"v<n>" header',
    );
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const raw = parsedBody.body;
  const parsed = updateWorkItemSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }
  const body = parsed.data;

  const existing = await loadWorkItem(id);
  if (!existing) return apiError(404, "not_found", `Work item not found: ${id}`);
  if (existing.record.version !== version) {
    return apiError(
      412,
      "version_conflict",
      `Version mismatch: expected v${existing.record.version}, got v${version}`,
    );
  }

  // No iterations / epics exist in the standalone CRM — only clearing
  // (null) is accepted for wire compatibility.
  if (typeof body.iteration_id === "string") {
    return apiError(
      422,
      "validation_failed",
      "iteration_id cannot be set: the CRM has no iterations",
    );
  }
  if (typeof body.epic_id === "string") {
    return apiError(
      422,
      "validation_failed",
      "epic_id cannot be set: the CRM has no epics",
    );
  }

  const changes: Partial<typeof records.$inferInsert> = {};

  if (body.title !== undefined) changes.title = body.title;
  if (body.subject !== undefined) changes.subject = body.subject;
  if (body.description !== undefined) changes.description = body.description;
  if (body.priority !== undefined) changes.priority = body.priority;
  if (body.position !== undefined) changes.position = body.position;
  if (body.due_date !== undefined) {
    changes.dueDate = body.due_date === null ? null : new Date(body.due_date);
  }
  if (body.estimate !== undefined) changes.estimate = body.estimate;
  if (body.assignee_id !== undefined) {
    changes.assigneeId = body.assignee_id;
    // No local user directory yet (auth is swap step 6) — the denormalized
    // name can't be resolved, so it clears with every reassignment.
    changes.assigneeName = null;
  }
  if (body.parent_id !== undefined) {
    if (body.parent_id !== null) {
      const parent = await loadWorkItem(body.parent_id);
      if (!parent) {
        return apiError(
          422,
          "validation_failed",
          `parent_id does not reference an existing work item: ${body.parent_id}`,
        );
      }
      if (body.parent_id === id) {
        return apiError(
          422,
          "validation_failed",
          "A work item cannot be its own parent",
        );
      }
    }
    changes.parentId = body.parent_id;
  }

  let stateChange: { from: string; to: string } | null = null;
  if (body.state_key !== undefined) {
    const stage = await resolveStage(existing.type, body.state_key);
    if (!stage) {
      return apiError(
        422,
        "validation_failed",
        `Unknown workflow state key for type ${existing.type.key}: ${body.state_key}`,
      );
    }
    if (stage.id !== existing.record.stateId) {
      stateChange = { from: existing.state.key, to: stage.key };
    }
    changes.stateId = stage.id;
    changes.completedAt = completedAtFor(
      stage.category,
      existing.record.completedAt,
    );
  }

  changes.version = existing.record.version + 1;
  changes.updatedAt = new Date();

  await db.update(records).set(changes).where(eq(records.id, id));

  const actor = await currentActor();
  await logActivity({
    type: stateChange ? "work_item_status_changed" : "work_item_updated",
    entityId: existing.record.id,
    entityIdentifier: existing.record.identifier,
    changes: stateChange ? { state_key: stateChange } : null,
    actor: { id: actor.id, type: "user", name: actor.name },
  });

  const updated = await loadWorkItem(id);
  if (!updated) return apiError(404, "not_found", `Work item not found: ${id}`);
  return NextResponse.json({ work_item: serializeWorkItem(updated) });
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse | Response> {
  const { id } = await context.params;

  const version = parseIfMatchVersion(request);
  if (version === null) {
    return apiError(
      428,
      "precondition_required",
      'DELETE /work_items/:id requires an If-Match: W/"v<n>" header',
    );
  }

  const existing = await loadWorkItem(id);
  if (!existing) return apiError(404, "not_found", `Work item not found: ${id}`);
  if (existing.record.version !== version) {
    return apiError(
      412,
      "version_conflict",
      `Version mismatch: expected v${existing.record.version}, got v${version}`,
    );
  }

  await db.delete(records).where(eq(records.id, id));
  const actor = await currentActor();
  await logActivity({
    type: "work_item_deleted",
    entityId: existing.record.id,
    entityIdentifier: existing.record.identifier,
    actor: { id: actor.id, type: "user", name: actor.name },
  });
  return new Response(null, { status: 204 });
}
