"use client";

/**
 * Read-side queries for the Sales tab — opportunities list, single
 * work-item fetch, child-item lists (for an opportunity's call_notes
 * + commitments + the account's opportunities), and attribute-value
 * fetch keyed by work_item_id.
 */

import { useQuery } from "@tanstack/react-query";
import { workItemsApi, type WorkItem } from "@/lib/workItemsApi";
import { attributesApi } from "@/lib/attributesApi";
import { queryKeys } from "@/queries/query-keys";
import { SALES_TYPE_KEYS } from "./constants";
import type { AttributeValue } from "@/lib/generated/api/models";

/** Fetch every opportunity in the Sales workspace (all cursor pages)
 *  so the pipeline view sees the whole set on first paint. */
export function useOpportunitiesQuery(
  workspaceId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.workItems.list({
      workspace_id: workspaceId,
      type_key: SALES_TYPE_KEYS.opportunity,
    }),
    queryFn: async () => {
      if (!workspaceId) return { data: [] as WorkItem[] };
      const data = await workItemsApi.listAllWorkItems({
        workspace_id: workspaceId,
        type_key: SALES_TYPE_KEYS.opportunity,
      });
      return { data };
    },
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000,
  });
}

/** Fetch every account in the Sales workspace. Used by the
 *  create-opportunity modal and the empty-state "first lead" CTA so
 *  the user can pick which account a new opportunity belongs to. */
export function useAccountsQuery(
  workspaceId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.workItems.list({
      workspace_id: workspaceId,
      type_key: SALES_TYPE_KEYS.account,
    }),
    queryFn: async () => {
      if (!workspaceId) return { data: [] as WorkItem[] };
      const data = await workItemsApi.listAllWorkItems({
        workspace_id: workspaceId,
        type_key: SALES_TYPE_KEYS.account,
      });
      return { data };
    },
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000,
  });
}

/** Fetch every call note in the Sales workspace (all cursor pages).
 *  Used by record timelines to roll notes up across an account's
 *  opportunities without a per-opportunity fan-out. */
export function useCallNotesQuery(
  workspaceId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.workItems.list({
      workspace_id: workspaceId,
      type_key: SALES_TYPE_KEYS.call_note,
    }),
    queryFn: async () => {
      if (!workspaceId) return { data: [] as WorkItem[] };
      const data = await workItemsApi.listAllWorkItems({
        workspace_id: workspaceId,
        type_key: SALES_TYPE_KEYS.call_note,
      });
      return { data };
    },
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000,
  });
}

/** Fetch every contact in the Sales workspace (all cursor pages). */
export function useContactsQuery(
  workspaceId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.workItems.list({
      workspace_id: workspaceId,
      type_key: SALES_TYPE_KEYS.contact,
    }),
    queryFn: async () => {
      if (!workspaceId) return { data: [] as WorkItem[] };
      const data = await workItemsApi.listAllWorkItems({
        workspace_id: workspaceId,
        type_key: SALES_TYPE_KEYS.contact,
      });
      return { data };
    },
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000,
  });
}

export function useWorkItemQuery(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: id ? queryKeys.workItems.detail(id) : queryKeys.workItems.all,
    queryFn: async () => {
      if (!id) return null;
      const { workItem } = await workItemsApi.getWorkItem(id);
      return workItem;
    },
    enabled: enabled && !!id,
    staleTime: 30 * 1000,
  });
}

/** Children of a work-item — opportunity → call_notes + commitments,
 *  account → opportunities. Backed by `GET /work_items?parent_id=…`. */
export function useChildItemsQuery(
  workspaceId: string | undefined,
  parentId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey:
      parentId !== undefined
        ? queryKeys.sales.childItems(parentId)
        : queryKeys.sales.all,
    queryFn: async () => {
      if (!workspaceId || !parentId) return { data: [] as WorkItem[] };
      const data = await workItemsApi.listAllWorkItems({
        workspace_id: workspaceId,
        parent_id: parentId,
      });
      return { data };
    },
    enabled: enabled && !!workspaceId && !!parentId,
    staleTime: 30 * 1000,
  });
}

export function useAttributeValuesQuery(
  workItemId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey:
      workItemId !== undefined
        ? queryKeys.sales.attributeValues(workItemId)
        : queryKeys.sales.all,
    queryFn: async (): Promise<{ data: AttributeValue[] }> => {
      if (!workItemId) return { data: [] };
      return attributesApi.listValues(workItemId);
    },
    enabled: enabled && !!workItemId,
    staleTime: 30 * 1000,
  });
}
