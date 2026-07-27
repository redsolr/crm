import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { knowledgeGraphApi } from "@/lib/knowledge-graph/client";
import type {
  GraphViewQuery,
  GraphViewResponse,
} from "@/lib/knowledge-graph/schemas";
import { useKnowledgeGraphStore } from "@/stores/knowledge-graph.store";
import { useAppContextStore } from "@/stores/app-context.store";
import { queryKeys } from "../query-keys";

/**
 * Fetch the account's knowledge-graph view with the given filters.
 *
 * Cache strategy: 60s stale window. The backend view is rebuilt on
 * every graph-build job (see `GraphBuildWorker`), but the display
 * layer tolerates minute-scale staleness — it's an exploration UI,
 * not a live feed. Users who just triggered a build can `.refetch()`
 * manually via the "refresh" button.
 *
 * `placeholderData: keepPreviousData` keeps the prior result visible
 * while the next one is fetching — flipping filters shouldn't blank
 * the stats block and community list. `isPlaceholderData` is set to
 * true on the returned result so the UI can render a faint pending
 * cue if it wants to; otherwise the transition feels instantaneous.
 */
export function useGraphView(query: GraphViewQuery = {}) {
  return useQuery<GraphViewResponse>({
    queryKey: queryKeys.knowledgeGraph.view(query as Record<string, unknown>),
    queryFn: () => knowledgeGraphApi.getView(query),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Convenience wrapper that reads filter state from the store and
 * fetches the matching view. Both the main-area canvas and the
 * sidebar explorer need identical filter→query wiring; React Query
 * dedupes the underlying fetch so the two mounts share one request.
 *
 * `organization_id` is sourced from `useAppContextStore` (the same
 * store the org-switcher writes to) rather than the graph store —
 * org scope is a global app context, not a graph-local filter, so
 * switching orgs anywhere in the app re-keys this query and the
 * graph repaints with the active org's entities.
 */
export function useGraphViewFromStore() {
  const sinceDays = useKnowledgeGraphStore((s) => s.sinceDays);
  const organization_id = useAppContextStore(
    (s) => s.currentOrganization?.id,
  );
  // `communityId` from the store is a client-side *focus* indicator,
  // not a server filter — we always fetch the full graph so focusing
  // a community dims the rest in-place instead of requiring a refetch.
  return useGraphView({
    organization_id,
    since_days: sinceDays,
  });
}
