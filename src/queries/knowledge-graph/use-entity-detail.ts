import { useQuery } from "@tanstack/react-query";
import { knowledgeGraphApi } from "@/lib/knowledge-graph/client";
import type { EntityDetailResponse } from "@/lib/knowledge-graph/schemas";
import { queryKeys } from "../query-keys";

/**
 * Fetch the detail bundle for a clicked entity — entity row, where
 * it's mentioned, and first-degree neighbors. Powers the right-panel
 * details view.
 *
 * Cache strategy: 5min stale window. The underlying graph is rebuilt
 * by the worker job, not by user interaction, so a five-minute cache
 * matches what users perceive — repeatedly clicking the same node
 * doesn't refetch. `enabled` lets the panel mount before a node is
 * selected without firing a request for `undefined`.
 */
export function useEntityDetail(entity_id: string | null | undefined) {
  return useQuery<EntityDetailResponse>({
    queryKey: queryKeys.knowledgeGraph.entity(entity_id ?? ""),
    queryFn: () => {
      if (entity_id == null || entity_id === "") {
        throw new Error("entity_id is required");
      }
      return knowledgeGraphApi.getEntityDetail(entity_id);
    },
    enabled: entity_id != null && entity_id !== "",
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
