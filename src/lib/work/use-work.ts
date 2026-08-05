"use client";

/**
 * Work-module hooks — task list query + task create. Stage moves and
 * attribute edits reuse the type-generic sales hooks
 * (`useTransitionWorkItem`, `useUpsertAttributeValue`) — they operate
 * on work-item ids and invalidate the shared roots, so tasks get the
 * same conflict-retry and realtime-invalidation behavior for free.
 */

import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workItemsApi, type WorkItem } from "@/lib/workItemsApi";
import { queryKeys } from "@/queries/query-keys";
import {
  createAndStampAttributes,
  type CreateOptions,
} from "@/lib/records/create-work-item";
import { TASK_STATE_KEYS, WORK_TYPE_KEYS } from "./constants";

/** Fetch every task (all cursor pages) — the Work board sees the
 *  whole set on first paint, same discipline as the pipeline. */
export function useTasksQuery(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workItems.list({
      workspace_id: workspaceId,
      type_key: WORK_TYPE_KEYS.task,
    }),
    queryFn: async () => {
      if (!workspaceId) return { data: [] as WorkItem[] };
      const data = await workItemsApi.listAllWorkItems({
        workspace_id: workspaceId,
        type_key: WORK_TYPE_KEYS.task,
      });
      return { data };
    },
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: CreateOptions<string>) =>
      createAndStampAttributes(WORK_TYPE_KEYS.task, {
        ...options,
        state_key: options.state_key ?? TASK_STATE_KEYS.todo,
      }),
    onError: (err) => {
      console.error("[useCreateTask] create failed:", err);
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
