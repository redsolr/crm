"use client";

/**
 * Sales-specific mutations for the four create flows (account /
 * opportunity / call_note / commitment), state transitions, and
 * attribute-value upserts. Wraps the generic `workItemsApi` +
 * `attributesApi` clients with the create-shape required by the
 * sales-pipeline template (correct `type_key`, default `state_key`,
 * parent_id wiring).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { workItemsApi, type WorkItem } from "@/lib/workItemsApi";
import { attributesApi } from "@/lib/attributesApi";
import type { AttributeValue } from "@/lib/generated/api/models";
import { queryKeys } from "@/queries/query-keys";
import {
  createAndStampAttributes,
  type AttributeBag,
  type CreateOptions,
} from "@/lib/records/create-work-item";
import {
  COMMITMENT_STATE_KEYS,
  MEMORY_STATE_KEYS,
  PIPELINE_STATE_KEYS,
  SALES_TYPE_KEYS,
} from "./constants";

export type { AttributeBag };

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: CreateOptions<string>) =>
      createAndStampAttributes(SALES_TYPE_KEYS.account, {
        ...options,
        state_key: options.state_key ?? MEMORY_STATE_KEYS.active,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workItems.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sales.all,
      });
    },
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: CreateOptions<string>) =>
      createAndStampAttributes(SALES_TYPE_KEYS.opportunity, {
        ...options,
        state_key: options.state_key ?? PIPELINE_STATE_KEYS.identified,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workItems.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sales.all,
      });
    },
  });
}

export function useCreateCallNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: CreateOptions<string>) =>
      createAndStampAttributes(SALES_TYPE_KEYS.call_note, {
        ...options,
        state_key: options.state_key ?? MEMORY_STATE_KEYS.active,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workItems.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sales.all,
      });
    },
  });
}

export function useCreateCommitment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: CreateOptions<string>) =>
      createAndStampAttributes(SALES_TYPE_KEYS.commitment, {
        ...options,
        state_key: options.state_key ?? COMMITMENT_STATE_KEYS.open,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workItems.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sales.all,
      });
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: CreateOptions<string>) =>
      createAndStampAttributes(SALES_TYPE_KEYS.contact, {
        ...options,
        state_key: options.state_key ?? MEMORY_STATE_KEYS.active,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workItems.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sales.all,
      });
    },
  });
}

/** Sync LLM compute for an AI-computed column (definition with an
 *  `enrichment` config). Refreshes the row's attribute-values cache so
 *  the computed value + provenance render immediately. */
export function useComputeAttributeValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workItemId: string; definitionId: string }) =>
      attributesApi.computeValue(input.workItemId, input.definitionId),
    onSuccess: (_result, vars) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sales.attributeValues(vars.workItemId),
      });
    },
  });
}

/** Total PATCH attempts before a 412 propagates (1 + 2 re-reads). */
export const MAX_CONFLICT_ATTEMPTS = 3;

/**
 * PATCH a work item, recovering from optimistic-concurrency conflicts
 * by re-reading the fresh version and retrying (bounded). A 412 means
 * the cached version lagged a concurrent write (peer edit, a realtime
 * refetch racing the click, or the PREVIOUS action's own late retry —
 * the 2026-08-04 CI red proved one re-read cannot survive two rapid
 * actions whose retries interleave: the re-read landed between the
 * earlier write's read and commit, "expected v4, got v3"). The user
 * committed a concrete target (stage or rank), so re-reading and
 * retrying honors their action exactly as redoing it would; after
 * MAX_CONFLICT_ATTEMPTS the conflict propagates.
 */
async function patchWithConflictRetry(
  api: Pick<typeof workItemsApi, "updateWorkItem" | "getWorkItem">,
  id: string,
  body: { state_key: string } | { position: number },
  initialVersion: number,
  label: string,
): Promise<WorkItem> {
  let version = initialVersion;
  for (let attempt = 1; ; attempt++) {
    try {
      const { workItem } = await api.updateWorkItem(id, body, version);
      return workItem;
    } catch (err) {
      if (
        !(err instanceof ApiError) ||
        err.status !== 412 ||
        attempt >= MAX_CONFLICT_ATTEMPTS
      ) {
        throw err;
      }
      console.warn(
        `[${label}] version conflict on ${id} (attempt ${attempt}/${MAX_CONFLICT_ATTEMPTS}) — re-reading and retrying`,
      );
      const { workItem: fresh } = await api.getWorkItem(id);
      version = fresh.version;
    }
  }
}

/** Stage transition with bounded conflict recovery. Exported for unit
 *  tests. */
export function transitionWithConflictRetry(
  api: Pick<typeof workItemsApi, "updateWorkItem" | "getWorkItem">,
  input: { id: string; version: number; state_key: string },
): Promise<WorkItem> {
  return patchWithConflictRetry(
    api,
    input.id,
    { state_key: input.state_key },
    input.version,
    "transition",
  );
}

/** PATCH `/work_items/:id` to move it along its workflow.
 *  Required `If-Match` header is set by `workItemsApi.updateWorkItem`. */
export function useTransitionWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; version: number; state_key: string }) =>
      transitionWithConflictRetry(workItemsApi, input),
    onError: (err, input) => {
      console.error(
        `[useTransitionWorkItem] transition of ${input.id} to ${input.state_key} failed:`,
        err,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workItems.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sales.all,
      });
    },
  });
}

/** One position PATCH of a manual reorder (drag or insert-heal). */
export interface PositionWrite {
  id: string;
  version: number;
  position: number;
}

/** Rank write with bounded conflict recovery (same discipline as
 *  `transitionWithConflictRetry`). Exported for unit tests. */
export function reorderWithConflictRetry(
  api: Pick<typeof workItemsApi, "updateWorkItem" | "getWorkItem">,
  write: PositionWrite,
): Promise<WorkItem> {
  return patchWithConflictRetry(
    api,
    write.id,
    { position: write.position },
    write.version,
    "reorder",
  );
}

/** The server's list order — position asc, created_at asc, id asc. */
function byServerListOrder(a: WorkItem, b: WorkItem): number {
  if (a.position !== b.position) return a.position - b.position;
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Persist a manual reorder of the pipeline table (drag-to-rearrange /
 * insert-between heal): one PATCH per write, usually a single midpoint
 * write from `planReorder`. Optimistic — the cached opportunity list
 * re-sorts immediately so the dropped row doesn't snap back while the
 * PATCH + refetch are in flight; a failed batch rolls the cache back.
 */
export function useReorderOpportunities(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.workItems.list({
    workspace_id: workspaceId,
    type_key: SALES_TYPE_KEYS.opportunity,
  });
  return useMutation({
    mutationFn: (writes: PositionWrite[]) =>
      Promise.all(
        writes.map((write) => reorderWithConflictRetry(workItemsApi, write)),
      ),
    onMutate: async (writes) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<{ data: WorkItem[] }>(listKey);
      if (previous) {
        const positionById = new Map(writes.map((w) => [w.id, w.position]));
        const next = previous.data
          .map((item) => {
            const position = positionById.get(item.id);
            return position === undefined ? item : { ...item, position };
          })
          .sort(byServerListOrder);
        queryClient.setQueryData(listKey, { ...previous, data: next });
      }
      return { previous };
    },
    onError: (err, writes, context) => {
      console.error(
        `[useReorderOpportunities] persisting ${writes.length} position write(s) failed:`,
        err,
      );
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
    },
  });
}

/** Upsert one attribute value on an existing work item.
 *
 *  Optimistic: the cached `attributeValues(workItemId)` rows are
 *  patched in `onMutate` so inline table cells (and the detail
 *  editor) show the committed value immediately with no flicker back
 *  to the stale row while the refetch is in flight; a failed PUT
 *  rolls the cache back and logs. */
export function useUpsertAttributeValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workItemId: string;
      definitionId: string;
      value: unknown;
    }) => {
      return attributesApi.upsertValue(
        input.workItemId,
        input.definitionId,
        input.value,
      );
    },
    onMutate: async (vars) => {
      const queryKey = queryKeys.sales.attributeValues(vars.workItemId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ data: AttributeValue[] }>(
        queryKey,
      );
      if (previous) {
        const now = new Date().toISOString();
        const idx = previous.data.findIndex(
          (v) => v.definition_id === vars.definitionId,
        );
        const nextRows =
          idx >= 0
            ? previous.data.map((v, i) =>
                i === idx ? { ...v, value: vars.value, updated_at: now } : v,
              )
            : [
                ...previous.data,
                {
                  id: `optimistic-${vars.workItemId}-${vars.definitionId}`,
                  work_item_id: vars.workItemId,
                  definition_id: vars.definitionId,
                  value: vars.value,
                  created_at: now,
                  updated_at: now,
                } as AttributeValue,
              ];
        queryClient.setQueryData(queryKey, { ...previous, data: nextRows });
      }
      return { previous };
    },
    onError: (err, vars, context) => {
      console.error(
        `[useUpsertAttributeValue] upsert failed for work item ${vars.workItemId}, definition ${vars.definitionId}:`,
        err,
      );
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.sales.attributeValues(vars.workItemId),
          context.previous,
        );
      }
    },
    onSettled: (_data, _error, vars) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sales.attributeValues(vars.workItemId),
      });
    },
  });
}
