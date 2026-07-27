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

// ============================================================================
// useBoard — Workspace-level board view
// ============================================================================

export function useBoardQuery(
  workspace_id: string,
  options: {
    autoFetch?: boolean;
    scope?: "personal" | "team";
    iteration_id?: string | null;
    waitForSprintId?: boolean;
  } = {},
) {
  const {
    autoFetch = true,
    scope,
    iteration_id,
    waitForSprintId = false,
  } = options;
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.workItems.list({
      workspace_id,
      scope,
      iteration_id,
      view: "board",
    } as Record<string, unknown>),
    queryFn: async () => {
      // `scope` ('personal' | 'team') is a frontend-only concept and is
      // not part of the BE `listWorkItemsQuerySchema`. We send only
      // BE-supported filters; `scope` is preserved in the queryKey for
      // cache scoping but isn't used as a wire param.
      const response = await workItemsApi.listWorkItems({
        workspace_id,
        iteration_id: iteration_id || undefined,
        page_size: 100,
      });
      const taskList = response.data;

      // Group tasks by `state.key` (the wire field on a full WorkItem).
      const grouped: { [status: string]: WorkItem[] } = {};
      for (const task of taskList) {
        const key = task.state.key;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(task);
      }
      // Sort each column by position
      for (const status of Object.keys(grouped)) {
        grouped[status].sort((a, b) => a.position - b.position);
      }
      return grouped;
    },
    enabled:
      autoFetch &&
      !!workspace_id &&
      isAuthenticated &&
      !(waitForSprintId && !iteration_id),
  });

  const columns = useMemo(() => query.data ?? {}, [query.data]);

  // Create task
  const createTaskMutation = useMutation({
    mutationFn: async (request: Omit<CreateWorkItemRequest, "workspace_id">) => {
      const { workItem: task } = await workItemsApi.createWorkItem({
        ...request,
        workspace_id,
      });
      return task;
    },
    onMutate: async (request) => {
      const qk = queryKeys.workItems.list({
        workspace_id,
        scope,
        iteration_id,
        view: "board",
      } as Record<string, unknown>);
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData(qk);

      const status = request.state_key || "backlog";
      // Append the optimistic card at the END of its column (matching the
      // backend's append). Prepending at position 0 flashed the new card at the
      // top of the lane before the refetch moved it to the bottom.
      const laneCount =
        (previous as typeof columns | undefined)?.[status]?.length ?? 0;
      const tempId = `temp-${Date.now()}`;
      const optimisticTask: WorkItem = {
        id: tempId,
        identifier: "...",
        title: request.title,
        subject: null,
        description: request.description || null,
        state: {
          id: "",
          key: status,
          name: "",
          category: "not_started",
        },
        type: { id: "", key: request.type_key ?? "task", name: "" },
        priority: request.priority || "none",
        position: laneCount,
        due_date: request.due_date || null,
        estimate: request.estimate || null,
        assignee_id: request.assignee_id || null,
        assignee_name: null,
        parent_id: request.parent_id || null,
        workspace_id,
        iteration_id: request.iteration_id || null,
        folder_id: null,
        visibility: "private",
        version: 0,
        dri_id: null,
        dri_name: null,
        // Slice 2 surfaced created_by_id + created_by_name on the
        // wire; optimistic placeholders, server response settles.
        created_by_id: "",
        created_by_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
      };

      queryClient.setQueryData(qk, (old: typeof columns | undefined) => {
        if (!old) return { [status]: [optimisticTask] };
        return { ...old, [status]: [...(old[status] || []), optimisticTask] };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      const qk = queryKeys.workItems.list({
        workspace_id,
        scope,
        iteration_id,
        view: "board",
      } as Record<string, unknown>);
      if (context?.previous) queryClient.setQueryData(qk, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
    },
  });

  // Update task
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

  // Move task
  const moveTaskMutation = useMutation({
    mutationFn: async ({
      id,
      newStatus,
      position,
    }: {
      id: string;
      newStatus: string;
      position?: number;
    }) => {
      const { workItem: task } = await workItemsApi.moveWorkItem(
        id,
        { state_key: newStatus, position },
        requireCachedWorkItemVersion(queryClient, id),
      );
      return task;
    },
    onMutate: async ({ id, newStatus, position }) => {
      const qk = queryKeys.workItems.list({
        workspace_id,
        scope,
        iteration_id,
        view: "board",
      } as Record<string, unknown>);
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData(qk);

      queryClient.setQueryData(qk, (old: typeof columns | undefined) => {
        if (!old) return old;
        const newColumns = { ...old };
        let movedTask: WorkItem | undefined;
        for (const s of Object.keys(newColumns)) {
          const idx = newColumns[s].findIndex((t) => t.id === id);
          if (idx !== -1) {
            [movedTask] = newColumns[s].splice(idx, 1);
            newColumns[s] = [...newColumns[s]];
            break;
          }
        }
        if (movedTask) {
          movedTask = {
            ...movedTask,
            state: { ...movedTask.state, key: newStatus },
          };
          if (!newColumns[newStatus]) newColumns[newStatus] = [];
          const col = [...newColumns[newStatus]];
          if (position !== undefined) col.splice(position, 0, movedTask);
          else col.push(movedTask);
          newColumns[newStatus] = col;
        }
        return newColumns;
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      const qk = queryKeys.workItems.list({
        workspace_id,
        scope,
        iteration_id,
        view: "board",
      } as Record<string, unknown>);
      if (context?.previous) queryClient.setQueryData(qk, context.previous);
    },
    onSuccess: (serverItem) => {
      // Write the server's authoritative row (incl. the freshly-incremented
      // `version`) into the board cache immediately. Without this the cache
      // keeps the pre-move version until the async `onSettled` refetch lands —
      // so a second quick move on the same card sends a stale `If-Match` and
      // 412s (version_conflict), which surfaces as a drag that "snaps back"
      // every other try. Mirrors the fix in use-work-items-query.ts.
      const qk = queryKeys.workItems.list({
        workspace_id,
        scope,
        iteration_id,
        view: "board",
      } as Record<string, unknown>);
      queryClient.setQueryData(qk, (old: typeof columns | undefined) => {
        if (!old) return old;
        const next: typeof old = {};
        for (const s of Object.keys(old)) {
          next[s] = old[s].map((t) =>
            t.id === serverItem.id ? { ...t, ...serverItem } : t,
          );
        }
        return next;
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
    },
  });

  // Delete task — uses the shared capture/consume buffer to thread
  // the WorkItem's `version` across react-query's mutation lifecycle.
  // See work-item-version-cache.ts for the rationale.
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const captured = consumeDeleteVersion(id);
      const version =
        captured ?? requireCachedWorkItemVersion(queryClient, id);
      await workItemsApi.deleteWorkItem(id, version);
    },
    onMutate: async (id) => {
      const qk = queryKeys.workItems.list({
        workspace_id,
        scope,
        iteration_id,
        view: "board",
      } as Record<string, unknown>);
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData(qk);

      // Capture version BEFORE the optimistic filter removes the row.
      captureDeleteVersion(queryClient, id);

      queryClient.setQueryData(qk, (old: typeof columns | undefined) => {
        if (!old) return old;
        const newColumns: { [s: string]: WorkItem[] } = {};
        for (const s of Object.keys(old)) {
          newColumns[s] = old[s].filter((t) => t.id !== id);
        }
        return newColumns;
      });

      return { previous };
    },
    onError: (_err, id, context) => {
      // Clear any uncon­sumed capture (mutationFn threw before reading).
      discardDeleteVersion(id);
      const qk = queryKeys.workItems.list({
        workspace_id,
        scope,
        iteration_id,
        view: "board",
      } as Record<string, unknown>);
      if (context?.previous) queryClient.setQueryData(qk, context.previous);
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
      console.error("[views/project-board] failed to create task", err);
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
      console.error("[views/project-board] failed to update task", err);
      return null;
    }
  };
  const moveTask = async (
    id: string,
    newStatus: string,
    position?: number,
  ): Promise<WorkItem | null> => {
    try {
      return await moveTaskMutation.mutateAsync({ id, newStatus, position });
    } catch (err) {
      console.error("[views/project-board] failed to move task", err);
      return null;
    }
  };
  const deleteTask = async (id: string): Promise<boolean> => {
    try {
      await deleteTaskMutation.mutateAsync(id);
      return true;
    } catch (err) {
      console.error("[views/project-board] failed to delete task", err);
      return false;
    }
  };

  const getTask = useCallback(
    (id: string): WorkItem | undefined => {
      for (const s of Object.keys(columns)) {
        const task = columns[s].find((t) => t.id === id);
        if (task) return task;
      }
      return undefined;
    },
    [columns],
  );

  const getTasksByStatus = useCallback(
    (status: string): WorkItem[] => columns[status] || [],
    [columns],
  );

  const getTotalPoints = useCallback((): number => {
    let total = 0;
    for (const s of Object.keys(columns)) {
      for (const t of columns[s]) total += t.estimate || 0;
    }
    return total;
  }, [columns]);

  const getPointsByStatus = useCallback(
    (status: string): number =>
      (columns[status] || []).reduce((sum, t) => sum + (t.estimate || 0), 0),
    [columns],
  );

  const fetchBoard = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    columns,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchBoard,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    getTask,
    getTasksByStatus,
    getTotalPoints,
    getPointsByStatus,
    refreshBoard: fetchBoard,
  };
}

export const useBoard = useBoardQuery;
