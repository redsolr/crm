import { and, desc, eq, type SQL } from "drizzle-orm";
import { db, activities } from "@/db";
import { mintId } from "@/db/ids";
import { CRM_WORKSPACE_ID, LOCAL_ACTOR_ID } from "./constants";

/**
 * Activities family (backend-swap: timelines). Write-side: the
 * work-items + comments handlers log platform-vocabulary events
 * (`work_item_created` / `work_item_updated` / `work_item_status_changed`
 * / `work_item_deleted` / `comment_added`) so record timelines have the
 * same feed the platform produced. Read-side serves the `{ activities }`
 * feed envelopes, bounded like the platform (~50 rows, newest first).
 */

type ActivityRow = typeof activities.$inferSelect;

export const ACTIVITY_FEED_LIMIT = 50;

export interface WireActivity {
  id: string;
  type: string;
  entity_type: string;
  entity_id: string;
  entity_identifier: string | null;
  workspace_id: string;
  /** Legacy field name some inherited FE types still declare. */
  project_id: string;
  actor_id: string | null;
  actor_type: string;
  actor_name: string | null;
  changes: unknown;
  metadata: unknown;
  created_at: string;
}

export function serializeActivity(row: ActivityRow): WireActivity {
  return {
    id: row.id,
    type: row.type,
    entity_type: row.entityType,
    entity_id: row.entityId,
    entity_identifier: row.entityIdentifier,
    workspace_id: CRM_WORKSPACE_ID,
    project_id: CRM_WORKSPACE_ID,
    actor_id: row.actorId,
    actor_type: row.actorType,
    actor_name: row.actorName,
    changes: row.changes,
    metadata: row.metadata,
    created_at: row.createdAt.toISOString(),
  };
}

export interface LogActivityInput {
  type: string;
  entityId: string;
  entityIdentifier: string | null;
  changes?: unknown;
  metadata?: unknown;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  await db.insert(activities).values({
    id: mintId("act"),
    type: input.type,
    entityType: "work_item",
    entityId: input.entityId,
    entityIdentifier: input.entityIdentifier,
    actorId: LOCAL_ACTOR_ID,
    actorType: "user",
    actorName: null,
    changes: input.changes ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function listEntityActivities(
  entityType: string,
  entityId: string,
): Promise<ActivityRow[]> {
  return db
    .select()
    .from(activities)
    .where(
      and(eq(activities.entityType, entityType), eq(activities.entityId, entityId)),
    )
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(ACTIVITY_FEED_LIMIT);
}

export async function listFeedActivities(): Promise<ActivityRow[]> {
  return db
    .select()
    .from(activities)
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(ACTIVITY_FEED_LIMIT);
}

export interface ActivityListFilters {
  entityType?: string;
  entityId?: string;
  page: number;
  limit: number;
}

export async function listActivitiesPaged(
  filters: ActivityListFilters,
): Promise<{ rows: ActivityRow[]; total: number }> {
  const conditions: SQL[] = [];
  if (filters.entityType !== undefined)
    conditions.push(eq(activities.entityType, filters.entityType));
  if (filters.entityId !== undefined)
    conditions.push(eq(activities.entityId, filters.entityId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalRows = await (where
    ? db.$count(activities, where)
    : db.$count(activities));

  const base = db.select().from(activities);
  const filtered = where ? base.where(where) : base;
  const rows = await filtered
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit);

  return { rows, total: totalRows };
}
