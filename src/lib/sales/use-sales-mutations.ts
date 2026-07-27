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
import {
  workItemsApi,
  type CreateWorkItemRequest,
  type WorkItem,
} from "@/lib/workItemsApi";
import { attributesApi } from "@/lib/attributesApi";
import type {
  AttributeDefinition,
  AttributeValue,
} from "@/lib/generated/api/models";
import { queryKeys } from "@/queries/query-keys";
import {
  COMMITMENT_STATE_KEYS,
  MEMORY_STATE_KEYS,
  PIPELINE_STATE_KEYS,
  SALES_TYPE_KEYS,
} from "./constants";

/** Map of attribute key → value for a single create call. The hook
 *  fans them out as one PUT per key after the work_item POST settles. */
export type AttributeBag = Record<string, unknown>;

interface CreateOptions<TKey extends string> {
  title: string;
  description?: string;
  workspace_id: string;
  parent_id?: string;
  state_key?: TKey;
  attributes?: AttributeBag;
  /** Type definitions for the work_item kind we're creating —
   *  needed to map `attribute_bag[key]` → `definition.id` for the
   *  follow-up `PUT /work_items/:wi/attribute_values/:def` calls. */
  definitions: AttributeDefinition[];
}

async function createAndStampAttributes(
  type_key: string,
  options: CreateOptions<string>,
): Promise<WorkItem> {
  const request: CreateWorkItemRequest = {
    title: options.title,
    description: options.description,
    workspace_id: options.workspace_id,
    parent_id: options.parent_id,
    state_key: options.state_key,
    type_key,
  };
  const { workItem } = await workItemsApi.createWorkItem(request);

  const defs = options.definitions ?? [];
  const bag = options.attributes ?? {};
  const writes = Object.entries(bag).flatMap(([key, value]) => {
    if (value === undefined || value === null || value === "") return [];
    const def = defs.find((d) => d.key === key);
    if (!def) return [];
    return [attributesApi.upsertValue(workItem.id, def.id, value)];
  });
  if (writes.length > 0) {
    await Promise.all(writes);
  }
  return workItem;
}

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

/** PATCH `/work_items/:id` to move it along its workflow.
 *  Required `If-Match` header is set by `workItemsApi.updateWorkItem`. */
export function useTransitionWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      state_key: string;
    }) => {
      const { workItem } = await workItemsApi.updateWorkItem(
        input.id,
        { state_key: input.state_key },
        input.version,
      );
      return workItem;
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
