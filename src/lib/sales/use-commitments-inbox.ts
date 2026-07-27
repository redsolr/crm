"use client";

/**
 * Org-wide commitment inbox: every `commitment` work-item in the
 * Sales project, joined with the parent (opportunity / account)
 * for display, plus the `due_date` attribute hydrated in for
 * sorting / grouping.
 *
 * Founder-led-sales discipline says "no promise gets dropped";
 * this is the surface that enforces it.
 */

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { workItemsApi, type WorkItem } from "@/lib/workItemsApi";
import { attributesApi } from "@/lib/attributesApi";
import type {
  AttributeDefinition,
  AttributeValue,
} from "@/lib/generated/api/models";
import { queryKeys } from "@/queries/query-keys";
import {
  COMMITMENT_STATE_KEYS,
  SALES_TYPE_KEYS,
} from "./constants";
import { todayDateString } from "./use-opportunity-attributes";

export interface InboxCommitmentRow {
  commitment: WorkItem;
  parent: WorkItem | undefined;
  dueDate: string | null;
  promisedTo: string | null;
  bucket: "overdue" | "due_today" | "upcoming" | "done_dropped";
}

export interface InboxBuckets {
  overdue: InboxCommitmentRow[];
  due_today: InboxCommitmentRow[];
  upcoming: InboxCommitmentRow[];
  done_dropped: InboxCommitmentRow[];
}

/**
 * Combines:
 *   GET /v1/work_items?workspace_id=…&type_key=commitment
 *   GET /v1/work_items/:id/attribute_values  (for each commitment — due_date, promised_to)
 *   GET /v1/work_items/:parentId  (for each unique parent opportunity)
 *
 * Returns a per-bucket grouping ready for direct render.
 */
export function useCommitmentsInbox(
  workspaceId: string | undefined,
  commitmentDefinitions: AttributeDefinition[],
  enabled = true,
): {
  buckets: InboxBuckets;
  isLoading: boolean;
} {
  const listQuery = useQuery({
    queryKey: queryKeys.workItems.list({
      workspace_id: workspaceId,
      type_key: SALES_TYPE_KEYS.commitment,
    }),
    queryFn: async () => {
      if (!workspaceId) return { data: [] as WorkItem[] };
      const data = await workItemsApi.listAllWorkItems({
        workspace_id: workspaceId,
        type_key: SALES_TYPE_KEYS.commitment,
      });
      return { data };
    },
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000,
  });

  const commitments = useMemo(
    () => listQuery.data?.data ?? [],
    [listQuery.data?.data],
  );

  // Fan-out attribute_values fetches (one per commitment).
  const valueQueries = useQueries({
    queries: commitments.map((c) => ({
      queryKey: queryKeys.sales.attributeValues(c.id),
      queryFn: () => attributesApi.listValues(c.id),
      staleTime: 30 * 1000,
    })),
  });

  // Fan-out parent fetches for each unique parent_id.
  const parentIds = Array.from(
    new Set(commitments.map((c) => c.parent_id).filter((p): p is string => !!p)),
  );
  const parentQueries = useQueries({
    queries: parentIds.map((id) => ({
      queryKey: queryKeys.workItems.detail(id),
      queryFn: async () => {
        const { workItem } = await workItemsApi.getWorkItem(id);
        return workItem;
      },
      staleTime: 30 * 1000,
    })),
  });
  const parentsById = useMemo(() => {
    const map: Record<string, WorkItem> = {};
    parentIds.forEach((id, i) => {
      const w = parentQueries[i]?.data;
      if (w) map[id] = w;
    });
    return map;
  }, [parentIds, parentQueries]);

  const buckets = useMemo<InboxBuckets>(() => {
    const out: InboxBuckets = {
      overdue: [],
      due_today: [],
      upcoming: [],
      done_dropped: [],
    };
    const defByKey: Record<string, AttributeDefinition> = {};
    for (const d of commitmentDefinitions) defByKey[d.key] = d;
    const today = todayDateString();

    commitments.forEach((c, i) => {
      const values = valueQueries[i]?.data?.data ?? [];
      const dueDate = readValue(values, defByKey["due_date"]) as string | null;
      const promisedTo = readValue(values, defByKey["promised_to"]) as
        | string
        | null;
      const parent = c.parent_id ? parentsById[c.parent_id] : undefined;

      const isClosed =
        c.state.key === COMMITMENT_STATE_KEYS.done ||
        c.state.key === COMMITMENT_STATE_KEYS.dropped;

      const row: InboxCommitmentRow = {
        commitment: c,
        parent,
        dueDate: typeof dueDate === "string" ? dueDate : null,
        promisedTo: typeof promisedTo === "string" ? promisedTo : null,
        bucket: "upcoming",
      };

      if (isClosed) {
        row.bucket = "done_dropped";
        out.done_dropped.push(row);
        return;
      }
      if (row.dueDate !== null && row.dueDate < today) {
        row.bucket = "overdue";
        out.overdue.push(row);
        return;
      }
      if (row.dueDate !== null && row.dueDate === today) {
        row.bucket = "due_today";
        out.due_today.push(row);
        return;
      }
      out.upcoming.push(row);
    });

    // Sort each bucket by due_date ascending; rows without a due_date
    // float to the bottom of each bucket.
    const sortByDue = (a: InboxCommitmentRow, b: InboxCommitmentRow) => {
      if (a.dueDate === null && b.dueDate === null) return 0;
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    };
    out.overdue.sort(sortByDue);
    out.due_today.sort(sortByDue);
    out.upcoming.sort(sortByDue);
    out.done_dropped.sort(sortByDue);
    return out;
  }, [commitments, valueQueries, parentsById, commitmentDefinitions]);

  return {
    buckets,
    isLoading:
      listQuery.isLoading ||
      valueQueries.some((q) => q.isLoading) ||
      parentQueries.some((q) => q.isLoading),
  };
}

function readValue(
  values: AttributeValue[],
  def: AttributeDefinition | undefined,
): unknown {
  if (!def) return null;
  return values.find((v) => v.definition_id === def.id)?.value ?? null;
}
