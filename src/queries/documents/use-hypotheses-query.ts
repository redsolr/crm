"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "../query-keys";
import { pagesApi, HypothesisData, HypothesisStatus } from "@/lib/pagesApi";

export interface UseHypothesesQueryOptions {
  enabled?: boolean;
}

export function useHypothesesQuery(
  pageId: string | null | undefined,
  options: UseHypothesesQueryOptions = {},
) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: pageId
      ? queryKeys.hypotheses.byPage(pageId)
      : queryKeys.hypotheses.all,
    queryFn: async () => {
      if (!pageId) return [];
      const response = await pagesApi.getHypotheses(pageId);
      return response.data;
    },
    enabled: enabled && !!pageId,
  });

  const hypotheses = useMemo(() => query.data ?? [], [query.data]);

  const getHypothesisById = useCallback(
    (id: string): HypothesisData | undefined =>
      hypotheses.find((h) => h.id === id),
    [hypotheses],
  );

  const getHypothesesByStatus = useCallback(
    (status: HypothesisStatus): HypothesisData[] =>
      hypotheses.filter((h) => h.status === status),
    [hypotheses],
  );

  const refresh = () => {
    if (pageId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.hypotheses.byPage(pageId),
      });
    }
  };

  return {
    hypotheses,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchHypotheses: refresh,
    getHypothesisById,
    getHypothesesByStatus,
  };
}
