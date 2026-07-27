"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  responsesApiClient,
  type FounderBriefResponse,
} from "@/lib/responsesApi";
import { ApiError } from "@/lib/api-client";

/**
 * On-demand Founder Brief generator.
 *
 * Modeled as a mutation, NOT a query, because every call spends LLM
 * tokens on the platform side (~2k input + ~1.5k output per brief in
 * smoke). Auto-fetching on mount or refetching-on-focus would burn
 * budget for no user benefit — the brief surface explicitly requires
 * a "Generate" click.
 *
 * Successful runs are stored in the React Query cache under
 * `queryKeys.responses.founderBrief("this_week")` so a navigation
 * away and back doesn't trigger another spend; the cached brief
 * stays visible until the user clicks Regenerate. There is no
 * `staleTime` here because the cache value is only ever written by
 * a mutation and only ever read by `getLastFounderBrief`.
 */
export function useFounderBriefMutation() {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.responses.founderBrief("this_week");

  return useMutation<FounderBriefResponse, ApiError | Error>({
    mutationKey: cacheKey,
    mutationFn: () =>
      responsesApiClient.generateFounderBrief({ horizon: "this_week" }),
    onSuccess: (brief) => {
      queryClient.setQueryData<FounderBriefResponse>(cacheKey, brief);
    },
  });
}

/**
 * Read the most recently generated brief from the React Query cache
 * without triggering a new spend. Returns null on first render
 * (before any Generate click) and after `queryClient.clear()`.
 */
export function useLastFounderBrief(): FounderBriefResponse | null {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.responses.founderBrief("this_week");
  return queryClient.getQueryData<FounderBriefResponse>(cacheKey) ?? null;
}
