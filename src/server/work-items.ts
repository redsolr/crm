import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, records, recordTypes, workflowStages } from "@/db";
import { mintId } from "@/db/ids";
import { CRM_WORKSPACE_ID, LOCAL_ACTOR_ID } from "./constants";
import type { WorkItem } from "@/lib/generated/api/models";

/**
 * workItems family over the CRM's own Postgres (backend-swap step 2).
 *
 * Serves the exact wire shape the untouched frontend consumes from the
 * platform's `/api/work_items` — snake_case fields, inline `state` /
 * `type` payloads, Stripe-v2 cursor envelope, `If-Match` optimistic
 * concurrency. Single-tenant: `workspace_id` filters are ignored (the
 * stub workspace is the only universe) and iterations / folders /
 * labels don't exist here — those fields serialize as null.
 */

type RecordRow = typeof records.$inferSelect;
type StageRow = typeof workflowStages.$inferSelect;
type TypeRow = typeof recordTypes.$inferSelect;

export interface JoinedWorkItem {
  record: RecordRow;
  state: StageRow;
  type: TypeRow;
}

// ---------------------------------------------------------------------------
// Request schemas (zod v4) — mirror the platform's body validation.
// ---------------------------------------------------------------------------

export const prioritySchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "urgent",
]);

export const createWorkItemSchema = z.object({
  title: z.string().min(1).max(500),
  subject: z.string().max(2000).optional(),
  description: z.string().max(100_000).optional(),
  // Accepted for wire compatibility; single-tenant ignores it.
  workspace_id: z.string().optional(),
  state_key: z.string().optional(),
  type_key: z.string().optional(),
  priority: prioritySchema.optional(),
  due_date: z.string().optional(),
  estimate: z.number().optional(),
  iteration_id: z.string().optional(),
  epic_id: z.string().optional(),
  folder_id: z.string().optional(),
  assignee_id: z.string().optional(),
  parent_id: z.string().optional(),
  label_ids: z.array(z.string()).optional(),
});

export const updateWorkItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  subject: z.string().max(2000).nullish(),
  description: z.string().max(100_000).nullish(),
  state_key: z.string().optional(),
  priority: prioritySchema.optional(),
  position: z.number().optional(),
  due_date: z.string().nullish(),
  estimate: z.number().nullish(),
  iteration_id: z.string().nullish(),
  epic_id: z.string().nullish(),
  assignee_id: z.string().nullish(),
  parent_id: z.string().nullish(),
  label_ids: z.array(z.string()).optional(),
});

export const bulkUpdateSchema = z.object({
  work_item_ids: z.array(z.string()).min(1).max(200),
  state_key: z.string().optional(),
  priority: prioritySchema.optional(),
  assignee_id: z.string().nullish(),
  iteration_id: z.string().nullish(),
  epic_id: z.string().nullish(),
  add_label_ids: z.array(z.string()).optional(),
  remove_label_ids: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Cursor pagination — wire-compatible with the platform's opaque token.
// ---------------------------------------------------------------------------

export const MAX_PAGE_SIZE = 100;

export function encodePageToken(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

export function decodePageToken(token: string): number | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(token, "base64url").toString("utf8"),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "o" in parsed &&
      typeof (parsed as { o: unknown }).o === "number" &&
      Number.isInteger((parsed as { o: number }).o) &&
      (parsed as { o: number }).o >= 0
    ) {
      return (parsed as { o: number }).o;
    }
    return null;
  } catch (err) {
    // Expected/recoverable: a malformed token becomes a 422 upstream.
    console.warn("[work-items] failed to decode page_token:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function serializeWorkItem(row: JoinedWorkItem): WorkItem {
  const { record, state, type } = row;
  return {
    id: record.id,
    identifier: record.identifier,
    title: record.title,
    subject: record.subject,
    description: record.description,
    workspace_id: record.workspaceId,
    folder_id: null,
    state: {
      id: state.id,
      key: state.key,
      name: state.name,
      category: state.category as WorkItem["state"]["category"],
    },
    type: { id: type.id, key: type.key, name: type.name },
    priority: record.priority as WorkItem["priority"],
    position: record.position,
    iteration_id: null,
    parent_id: record.parentId,
    assignee_id: record.assigneeId,
    assignee_name: record.assigneeName,
    dri_id: record.driId,
    dri_name: record.driName,
    created_by_id: record.createdById,
    created_by_name: record.createdByName,
    due_date: record.dueDate === null ? null : record.dueDate.toISOString(),
    estimate: record.estimate,
    visibility: record.visibility as WorkItem["visibility"],
    version: record.version,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    completed_at:
      record.completedAt === null ? null : record.completedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const joinedSelection = {
  record: records,
  state: workflowStages,
  type: recordTypes,
};

function joinedQuery() {
  return db
    .select(joinedSelection)
    .from(records)
    .innerJoin(workflowStages, eq(records.stateId, workflowStages.id))
    .innerJoin(recordTypes, eq(records.typeId, recordTypes.id));
}

export async function loadWorkItem(id: string): Promise<JoinedWorkItem | null> {
  const rows = await joinedQuery().where(eq(records.id, id)).limit(1);
  return rows[0] ?? null;
}

export interface ListFilters {
  typeKey?: string;
  stateKey?: string;
  stateCategory?: string;
  parentId?: string;
  assigneeId?: string;
}

export async function listWorkItems(
  filters: ListFilters,
  limit: number,
  offset: number,
): Promise<{ rows: JoinedWorkItem[]; hasMore: boolean }> {
  const conditions: SQL[] = [];
  if (filters.typeKey !== undefined)
    conditions.push(eq(recordTypes.key, filters.typeKey));
  if (filters.stateKey !== undefined)
    conditions.push(eq(workflowStages.key, filters.stateKey));
  if (filters.stateCategory !== undefined)
    conditions.push(eq(workflowStages.category, filters.stateCategory));
  if (filters.parentId !== undefined)
    conditions.push(eq(records.parentId, filters.parentId));
  if (filters.assigneeId !== undefined)
    conditions.push(eq(records.assigneeId, filters.assigneeId));

  const base = joinedQuery();
  const filtered =
    conditions.length > 0 ? base.where(and(...conditions)) : base;

  // limit+1 answers `has_more` without a second COUNT round-trip.
  const rows = await filtered
    .orderBy(asc(records.position), asc(records.createdAt), asc(records.id))
    .limit(limit + 1)
    .offset(offset);

  return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function listChildren(parentId: string): Promise<JoinedWorkItem[]> {
  return joinedQuery()
    .where(eq(records.parentId, parentId))
    .orderBy(asc(records.position), asc(records.createdAt), asc(records.id));
}

/**
 * Resolve the workflow stage a work item of `typeId` lands in: the
 * requested `stateKey` within the type's workflow, or the workflow's
 * first stage (lowest position) when omitted. Null = unknown state key.
 */
export async function resolveStage(
  typeRow: TypeRow,
  stateKey: string | undefined,
): Promise<StageRow | null> {
  if (stateKey !== undefined) {
    const rows = await db
      .select()
      .from(workflowStages)
      .where(
        and(
          eq(workflowStages.workflowId, typeRow.workflowId),
          eq(workflowStages.key, stateKey),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
  const rows = await db
    .select()
    .from(workflowStages)
    .where(eq(workflowStages.workflowId, typeRow.workflowId))
    .orderBy(asc(workflowStages.position))
    .limit(1);
  return rows[0] ?? null;
}

export async function findTypeByKey(key: string): Promise<TypeRow | null> {
  const rows = await db
    .select()
    .from(recordTypes)
    .where(eq(recordTypes.key, key))
    .limit(1);
  return rows[0] ?? null;
}

/** `completed_at` follows the state category the way the platform's
 *  work-items service does: entering `done` stamps it, leaving clears. */
export function completedAtFor(
  category: string,
  previous: Date | null,
): Date | null {
  if (category === "done") return previous ?? new Date();
  return null;
}

export async function nextIdentifier(): Promise<string> {
  const result = await db.execute<{ n: string | number }>(
    sql`select nextval('record_identifier_seq') as n`,
  );
  const row = (result as Array<{ n: string | number }>)[0];
  if (!row) throw new Error("record_identifier_seq returned no row");
  return `CRM-${row.n}`;
}

export async function nextPosition(
  typeId: string,
  stateId: string,
): Promise<number> {
  const rows = await db
    .select({ max: sql<number | null>`max(${records.position})` })
    .from(records)
    .where(and(eq(records.typeId, typeId), eq(records.stateId, stateId)));
  return (rows[0]?.max ?? 0) + 1024;
}

export interface CreateInput {
  body: z.infer<typeof createWorkItemSchema>;
  type: TypeRow;
  stage: StageRow;
  /** Record author. Defaults to the local human actor; agent surfaces
   *  (Ask tools, /mcp) pass their machine identity so `created_by`
   *  is honest about who made the record. */
  createdBy?: { id: string; name: string | null };
}

export async function insertWorkItem(
  input: CreateInput,
): Promise<JoinedWorkItem> {
  const { body, type, stage } = input;
  const id = mintId("wi");
  const identifier = await nextIdentifier();
  const position = await nextPosition(type.id, stage.id);
  const now = new Date();

  await db.insert(records).values({
    id,
    identifier,
    title: body.title,
    subject: body.subject ?? null,
    description: body.description ?? null,
    workspaceId: CRM_WORKSPACE_ID,
    typeId: type.id,
    stateId: stage.id,
    priority: body.priority ?? "none",
    position,
    parentId: body.parent_id ?? null,
    assigneeId: body.assignee_id ?? null,
    createdById: input.createdBy?.id ?? LOCAL_ACTOR_ID,
    createdByName: input.createdBy?.name ?? null,
    dueDate: body.due_date === undefined ? null : new Date(body.due_date),
    estimate: body.estimate ?? null,
    completedAt: completedAtFor(stage.category, null),
    createdAt: now,
    updatedAt: now,
  });

  const created = await loadWorkItem(id);
  if (!created) throw new Error(`Work item ${id} vanished after insert`);
  return created;
}
