"use client";

/**
 * Shared debounced keyword-search state for the CRM's two inline
 * search surfaces — the topbar dropdown (`GlobalSearchBar`) and the
 * sidebar filter (`SidebarSearch`).
 *
 * Attio/Linear-class record finding over the platform's keyword (FTS)
 * search lane: 200ms-debounced `GET /v1/search` on every keystroke,
 * hits grouped by record kind (Companies / Deals / Contacts / Call
 * notes / Other). Keyword-only by design — the semantic lanes cost
 * model spend per keystroke and the navbar-keyword-only decision is
 * locked; see `src/lib/searchApi.ts`.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchApi, type SearchHit } from "@/lib/searchApi";
import { groupHits, type SearchResultGroup } from "@/lib/sales/search-results";

/** Minimum query length before we hit the backend. */
export const MIN_QUERY_LENGTH = 2;
/** Debounce window between keystroke and FTS call. */
const DEBOUNCE_MS = 200;
/** Result budget per search. */
const RESULT_LIMIT = 20;

export interface CrmSearchState {
  /** Trimmed, debounced query the results correspond to. */
  effectiveQuery: string;
  /** Query long enough to search — below this the lane never fires. */
  enabled: boolean;
  isLoading: boolean;
  /** Search ran and came back with zero hits. */
  showEmpty: boolean;
  /** Groups in fixed kind order (empty groups dropped). */
  groups: SearchResultGroup[];
  /** One flat row list for keyboard nav, in group render order. */
  flatHits: SearchHit[];
  /** Each hit's position in `flatHits`. */
  flatIndexByHit: Map<SearchHit, number>;
}

export function useCrmSearch(query: string): CrmSearchState {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const effectiveQuery = debouncedQuery.trim();
  const enabled = effectiveQuery.length >= MIN_QUERY_LENGTH;

  const search = useQuery({
    queryKey: ["crm-global-search", effectiveQuery],
    queryFn: () =>
      searchApi.keywordSearch(effectiveQuery, { limit: RESULT_LIMIT }),
    enabled,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (search.error) {
      console.error(
        "[useCrmSearch] keyword search failed for query:",
        effectiveQuery,
        search.error
      );
    }
  }, [search.error, effectiveQuery]);

  const hits = useMemo(
    () => (enabled ? search.data?.results ?? [] : []),
    [enabled, search.data?.results]
  );

  const { groups, flatHits, flatIndexByHit } = useMemo(() => {
    const grouped = groupHits(hits);
    const flat = grouped.flatMap((g) => g.hits);
    return {
      groups: grouped,
      flatHits: flat,
      flatIndexByHit: new Map(flat.map((h, i) => [h, i])),
    };
  }, [hits]);

  return {
    effectiveQuery,
    enabled,
    isLoading: enabled && search.isFetching,
    showEmpty:
      enabled &&
      !search.isFetching &&
      search.isSuccess &&
      flatHits.length === 0,
    groups,
    flatHits,
    flatIndexByHit,
  };
}

/** True when a keystroke belongs to some other text-entry surface. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
