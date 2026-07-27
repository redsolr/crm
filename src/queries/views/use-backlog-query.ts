"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  captureDeleteVersion,
  consumeDeleteVersion,
  discardDeleteVersion,
  requireCachedWorkItemVersion,
} from "../work-item-version-cache";
import { useAuthStore } from "@/stores/auth.store";
import {
  workItemsApi,
  WorkItem,
  CreateWorkItemRequest,
  UpdateWorkItemRequest,
} from "@/lib/workItemsApi";
import { applyMoveLocally, type LocalMove } from "@/lib/task-tree";

/**
 * Arguments for a reorder/reparent move. `position` is LANE-relative — an
 * index among siblings that share (parent_id, workflow state) — matching the
 * platform's renumber contract, NOT a flat visual index.
 */
export interface MoveTaskArgs extends LocalMove {
  /** If-Match version override — pass when the row isn't in the list cache
   *  yet (e.g. moving a just-created item into place). */
  version?: number;
  /** Full row to seed into the cache before applying the optimistic move
   *  (e.g. a just-created item that hasn't been refetched yet). */
  task?: WorkItem;
}

// ============================================================================
// useBacklog — Workspace-level backlog (tasks with no sprint)
// ============================================================================

export function useBacklogQuery(
  workspace_id: string,
  options: { autoFetch?: boolean; scope?: "personal" | "team" } = {},
) {
  const { autoFetch = true, scope } = options;
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();

  // Single source of truth for this view's list cache key — the optimistic
  // mutations below read/write/rollback against exactly this key.
  const listKey = useMemo(
    () =>
      queryKeys.workItems.list({
        workspace_id,
        backlog: true,
        scope,
        view: "backlog",
      } as Record<string, unknown>),
    [workspace_id, scope],
  );

  const query = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      // `backlog` and `scope` are frontend-only concepts. The BE
      // `listWorkItemsQuerySchema` has no equivalent — backlog filter
      // is computed downstream.
      const response = await workItemsApi.listWorkItems({
        workspace_id,
        page_size: 100,
      });
      return response.data.sort((a, b) => a.position - b.position);
    },
    enabled: autoFetch && !!workspace_id && isAuthenticated,
  });

  const tasks = useMemo(() => query.data ?? [], [query.data]);

  const createTaskMutation = useMutation({
    mutationFn: async (request: Omit<CreateWorkItemRequest, "workspace_id">) => {
      const { workItem: task } = await workItemsApi.createWorkItem({
        ...request,
        workspace_id,
        iteration_id: undefined,
      });
      return task;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateWorkItemRequest;
    }) => {
      const { workItem: task } = await workItemsApi.updateWorkItem(
        id,
        updates,
        requireCachedWorkItemVersion(queryClient, id),
      );
      return task;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: async ({ id, move }: { id: string; move: MoveTaskArgs }) => {
      const { workItem: task } = await workItemsApi.updateWorkItem(
        id,
        {
          position: move.position,
          ...(move.parent_id !== undefined && { parent_id: move.parent_id }),
        },
        move.version ?? requireCachedWorkItemVersion(queryClient, id),
      );
      return task;
    },
    onMutate: async ({ id, move }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);

      // Optimistic order mirrors the server's lane renumber exactly, so the
      // post-refetch order matches and the row never snaps back.
      queryClient.setQueryData(listKey, (old: WorkItem[] | undefined) => {
        let list = old ?? [];
        if (move.task && !list.some((t) => t.id === move.task!.id)) {
          list = [...list, move.task];
        }
        return applyMoveLocally(list, id, move);
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(listKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
    },
  });

  const deleteTaskMutation = useMutation({
    // `onMutate` runs BEFORE `mutationFn` and the cache filter inside
    // `onMutate` removes the row before mutationFn can read its
    // version. Use the shared capture/consume buffer to pass the
    // version across the lifecycle. See work-item-version-cache.ts
    // for the full rationale.
    mutationFn: async (id: string) => {
      const captured = consumeDeleteVersion(id);
      const version =
        captured ?? requireCachedWorkItemVersion(queryClient, id);
      await workItemsApi.deleteWorkItem(id, version);
    },
    onMutate: async (id) => {
      // Capture the version first — the row is still in cache here.
      captureDeleteVersion(queryClient, id);
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old: WorkItem[] | undefined) =>
        old?.filter((t) => t.id !== id),
      );
      return { previous };
    },
    onError: (_err, id, context) => {
      // Clear any capture mutationFn didn't get to consume (e.g.
      // network error before deleteWorkItem fired).
      discardDeleteVersion(id);
      if (context?.previous)
        queryClient.setQueryData(listKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
    },
  });

  const createTask = async (
    request: Omit<CreateWorkItemRequest, "workspace_id">,
  ): Promise<WorkItem | null> => {
    try {
      return await createTaskMutation.mutateAsync(request);
    } catch (err) {
      console.error("[views/project-backlog] failed to create task", err);
      return null;
    }
  };
  const updateTask = async (
    id: string,
    updates: UpdateWorkItemRequest,
  ): Promise<WorkItem | null> => {
    try {
      return await updateTaskMutation.mutateAsync({ id, updates });
    } catch (err) {
      console.error("[views/project-backlog] failed to update task", err);
      return null;
    }
  };
  const moveTask = async (
    id: string,
    move: MoveTaskArgs,
  ): Promise<WorkItem | null> => {
    try {
      return await moveTaskMutation.mutateAsync({ id, move });
    } catch (err) {
      console.error("[views/project-backlog] failed to move task", err);
      return null;
    }
  };
  const deleteTask = async (id: string): Promise<boolean> => {
    try {
      await deleteTaskMutation.mutateAsync(id);
      return true;
    } catch (err) {
      console.error("[views/project-backlog] failed to delete task", err);
      return false;
    }
  };

  const getTask = useCallback(
    (id: string): WorkItem | undefined => tasks.find((t) => t.id === id),
    [tasks],
  );
  const getTotalPoints = useCallback(
    (): number => tasks.reduce((sum, t) => sum + (t.estimate || 0), 0),
    [tasks],
  );

  const fetchBacklog = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    tasks,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchBacklog,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    getTask,
    getTotalPoints,
    refreshBacklog: fetchBacklog,
  };
}

export const useBacklog = useBacklogQuery;
