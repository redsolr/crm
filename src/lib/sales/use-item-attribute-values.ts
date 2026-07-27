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

/** `{ [workItemId]: AttributeValue[] }` for every item passed in. */
export function useAttributeValuesByItem(
  items: WorkItem[],
  enabled = true,
): Record<string, AttributeValue[]> {
  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: queryKeys.sales.attributeValues(item.id),
      queryFn: () => attributesApi.listValues(item.id),
      enabled: enabled && !!item.id,
      staleTime: 30 * 1000,
    })),
  });

  return useMemo(() => {
    const map: Record<string, AttributeValue[]> = {};
    items.forEach((item, i) => {
      map[item.id] = queries[i]?.data?.data ?? [];
    });
    return map;
  }, [items, queries]);
}
