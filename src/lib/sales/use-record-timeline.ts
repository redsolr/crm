"use client";

/**
 * Record activity timeline — merges three streams into one reverse-chron
 * feed for a record page (Attio "new activity timeline" class, Jun 2026):
 *
 *   1. platform activity rows for the record itself (stage changes,
 *      creates, edits — `GET /api/activities/entity/work_item/:id`),
 *   2. child call_notes (timeline position = `call_date`, fallback
 *      `created_at`),
 *   3. child commitments (position = `created_at`, due date on the entry).
 *
 * The merge is pure projection — the caller supplies the already-fetched
 * children so Pipeline ↔ detail navigation reuses hot query rows.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { activitiesApi, type Activity } from "@/lib/activitiesApi";
import { queryKeys } from "@/queries/query-keys";
import { SALES_TYPE_KEYS } from "./constants";
import { useAttributeValuesByItem } from "./use-item-attribute-values";
import { defKeyIndex, stringValuesByKey } from "./attribute-projection";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import type { WorkItem } from "@/lib/workItemsApi";

export type TimelineEntry =
  | {
      kind: "activity";
      at: string;
      id: string;
      label: string;
      detail: string | null;
      /** Who did it — stamped at write time; null on legacy/session-less rows. */
      author: string | null;
    }
  | {
      kind: "call_note";
      at: string;
      id: string;
      item: WorkItem;
      outcome: string | null;
      callType: string | null;
      summary: string | null;
      author: string | null;
    }
  | {
      kind: "commitment";
      at: string;
      id: string;
      item: WorkItem;
      dueDate: string | null;
      promisedTo: string | null;
      done: boolean;
      author: string | null;
    };

/** Per-entity activity feed (bounded server-side at ~50 rows). */
export function useEntityActivitiesQuery(
  workItemId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: [...queryKeys.sales.all, "entity-activities", workItemId],
    queryFn: () =>
      activitiesApi.listEntityActivities("work_item", workItemId ?? ""),
    enabled: enabled && !!workItemId,
    staleTime: 30 * 1000,
  });
}

/**
 * Merge activities + children into sorted timeline entries (newest
 * first). `children` may include non-call_note/commitment items — they
 * are ignored. `childDefinitions` are the attribute definitions of the
 * call_note + commitment types (for definition_id → key mapping).
 */
export function useRecordTimeline(
  activities: Activity[],
  children: WorkItem[],
  childDefinitions: AttributeDefinition[],
): TimelineEntry[] {
  const callNotes = useMemo(
    () => children.filter((w) => w.type.key === SALES_TYPE_KEYS.call_note),
    [children],
  );
  const commitments = useMemo(
    () => children.filter((w) => w.type.key === SALES_TYPE_KEYS.commitment),
    [children],
  );
  const timelineChildren = useMemo(
    () => [...callNotes, ...commitments],
    [callNotes, commitments],
  );
  const { valuesById: childAttrValues } =
    useAttributeValuesByItem(timelineChildren);

  return useMemo(
    () =>
      buildRecordTimeline(
        activities,
        callNotes,
        commitments,
        childDefinitions,
        childAttrValues,
      ),
    [activities, callNotes, commitments, childAttrValues, childDefinitions],
  );
}

/**
 * Pure merge — extracted from the hook so the ordering/projection rules
 * are unit-testable without React.
 */
export function buildRecordTimeline(
  activities: Activity[],
  callNotes: WorkItem[],
  commitments: WorkItem[],
  childDefinitions: AttributeDefinition[],
  childAttrValues: Record<
    string,
    Array<{ definition_id: string; value: unknown }>
  >,
): TimelineEntry[] {
  const index = defKeyIndex(childDefinitions);
  const attrsFor = (itemId: string): Record<string, string> =>
    stringValuesByKey(childAttrValues[itemId] ?? [], index);

  const entries: TimelineEntry[] = [];

  for (const a of activities) {
    entries.push(projectActivity(a));
  }

  for (const note of callNotes) {
    const attrs = attrsFor(note.id);
    entries.push({
      kind: "call_note",
      at: attrs.call_date ?? note.created_at,
      id: note.id,
      item: note,
      outcome: attrs.outcome ?? null,
      callType: attrs.call_type ?? null,
      summary: attrs.summary ?? null,
      author: note.created_by_name ?? null,
    });
  }

  for (const c of commitments) {
    const attrs = attrsFor(c.id);
    entries.push({
      kind: "commitment",
      at: c.created_at,
      id: c.id,
      item: c,
      dueDate: attrs.due_date ?? null,
      promisedTo: attrs.promised_to ?? null,
      done: c.state.category === "done",
      author: c.created_by_name ?? null,
    });
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

// ── projection helpers ──────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<string, string> = {
  work_item_created: "created",
  work_item_updated: "updated",
  work_item_status_changed: "moved stage",
  work_item_deleted: "deleted",
  // Legacy vocabulary: agent writes logged `task_created` until 2026-08-01.
  task_created: "created",
};

function projectActivity(a: Activity): TimelineEntry {
  const label = ACTIVITY_LABELS[a.type] ?? a.type.replace(/_/g, " ");
  let detail: string | null = null;
  const changes = a.changes as
    | { state_key?: { from?: string; to?: string } }
    | null;
  const stateChange = changes?.state_key;
  if (stateChange?.to) {
    detail = `${(stateChange.from ?? "?").replace(/_/g, " ")} → ${stateChange.to.replace(/_/g, " ")}`;
  }
  return {
    kind: "activity",
    at: a.created_at,
    id: a.id,
    label,
    detail,
    author: a.actor_name ?? null,
  };
}
