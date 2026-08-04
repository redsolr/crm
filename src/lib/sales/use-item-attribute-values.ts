"use client";

/**
 * Shared attribute-values fan-out.
 *
 * One `useQueries` fan-out fetching `GET /work_items/:id/attribute_values`
 * per item, keyed on the canonical per-item query key so every consumer
 * (pipeline snapshots, the Companies table, Reports) shares the same
 * cached rows — navigating between views never refetches hot items.
 *
 * Extracted 2026-07-13: the pattern had grown three inline copies
 * (use-opportunity-attributes, SalesCompaniesView, SalesReportsView).
 */

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { attributesApi } from "@/lib/attributesApi";
import type { AttributeValue } from "@/lib/generated/api/models";
import { queryKeys } from "@/queries/query-keys";
import type { WorkItem } from "@/lib/workItemsApi";

export interface AttributeValuesByItem {
  /** `{ [workItemId]: AttributeValue[] }` for every item passed in. */
  valuesById: Record<string, AttributeValue[]>;
  /**
   * True while ANY per-item fetch is on its uncached first load
   * (`isLoading`, never plain `isFetching`). The table views fold this
   * into their skeleton gate so rows land fully hydrated instead of
   * cells popping in one by one; background refreshes never re-trip
   * it because cached queries skip the isLoading phase.
   */
  isLoading: boolean;
}

export function useAttributeValuesByItem(
  items: WorkItem[],
  enabled = true,
): AttributeValuesByItem {
  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: queryKeys.sales.attributeValues(item.id),
      queryFn: () => attributesApi.listValues(item.id),
      enabled: enabled && !!item.id,
      staleTime: 30 * 1000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);

  return useMemo(() => {
    const map: Record<string, AttributeValue[]> = {};
    items.forEach((item, i) => {
      map[item.id] = queries[i]?.data?.data ?? [];
    });
    return { valuesById: map, isLoading };
  }, [items, queries, isLoading]);
}
