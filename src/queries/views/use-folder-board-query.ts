"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { requireCachedWorkItemVersion } from "../work-item-version-cache";
import { useAuthStore } from "@/stores/auth.store";
import {
  folderViewsApi,
  Folder,
  FolderViewWorkItem,
  UpdateFolderViewSettingsRequest,
} from "@/lib/folderViewsApi";
import {
  workItemsApi,
  WorkItem,
  CreateWorkItemRequest,
  UpdateWorkItemRequest,
} from "@/lib/workItemsApi";

// ============================================================================
// useFolderBoard — Kanban-style board view
// ============================================================================

export function useFolderBoardQuery(
  folder_id: string,
  options: { autoFetch?: boolean } = {},
) {
  const { autoFetch = true } = options;
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.folderViews.board(folder_id),
    queryFn: async () => {
      return folderViewsApi.getFolderBoardView(folder_id);
    },
    enabled: autoFetch && !!folder_id && isAuthenticated,
  });

  const folder: Folder | null = query.data?.folder ?? null;
  const columns: { [status: string]: FolderViewWorkItem[] } = useMemo(
    () => query.data?.columns ?? {},
    [query.data?.columns],
  );

  // Create task with optimistic update
  const createTaskMutation = useMutation({
    mutationFn: async (request: Omit<CreateWorkItemRequest, "folder_id">) => {
      const { workItem: task } = await workItemsApi.createWorkItem({
        ...request,
        folder_id,
      });
      return task;
    },
    onMutate: async (request) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.folderViews.board(folder_id),
      });
      const previous = queryClient.getQueryData(
        queryKeys.folderViews.board(folder_id),
      );

      const status = request.state_key || "backlog";
      const tempId = `temp-${Date.now()}`;
      const optimisticTask: FolderViewWorkItem = {
        id: tempId,
        title: request.title,
        status,
        priority: request.priority || "none",
        position: 0,
        assignee_id: request.assignee_id || null,
        due_date: request.due_date || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData(
        queryKeys.folderViews.board(folder_id),
        (old: typeof query.data) => {
          if (!old) return old;
          return {
            ...old,
            columns: {
              ...old.columns,
              [status]: [optimisticTask, ...(old.columns[status] || [])],
            },
          };
        },
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.folderViews.board(folder_id),
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folderViews.board(folder_id),
      });
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.folderViews.board(folder_id),
      });
    },
  });

  // Move task with optimistic update
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
      await queryClient.cancelQueries({
        queryKey: queryKeys.folderViews.board(folder_id),
      });
      const previous = queryClient.getQueryData(
        queryKeys.folderViews.board(folder_id),
      );

      queryClient.setQueryData(
        queryKeys.folderViews.board(folder_id),
        (old: typeof query.data) => {
          if (!old) return old;
          const newColumns = { ...old.columns };
          let movedTask: FolderViewWorkItem | undefined;

          for (const status of Object.keys(newColumns)) {
            const idx = newColumns[status].findIndex((t) => t.id === id);
            if (idx !== -1) {
              [movedTask] = newColumns[status].splice(idx, 1);
              newColumns[status] = [...newColumns[status]];
              break;
            }
          }

          if (movedTask) {
            movedTask = { ...movedTask, status: newStatus };
            if (!newColumns[newStatus]) newColumns[newStatus] = [];
            const col = [...newColumns[newStatus]];
            if (position !== undefined) {
              col.splice(position, 0, movedTask);
            } else {
              col.push(movedTask);
            }
            newColumns[newStatus] = col;
          }

          return { ...old, columns: newColumns };
        },
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.folderViews.board(folder_id),
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folderViews.board(folder_id),
      });
    },
  });

  // Delete task with optimistic update
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await workItemsApi.deleteWorkItem(
        id,
        requireCachedWorkItemVersion(queryClient, id),
      );
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.folderViews.board(folder_id),
      });
      const previous = queryClient.getQueryData(
        queryKeys.folderViews.board(folder_id),
      );

      queryClient.setQueryData(
        queryKeys.folderViews.board(folder_id),
        (old: typeof query.data) => {
          if (!old) return old;
          const newColumns: { [s: string]: FolderViewWorkItem[] } = {};
          for (const status of Object.keys(old.columns)) {
            newColumns[status] = old.columns[status].filter((t) => t.id !== id);
          }
          return { ...old, columns: newColumns };
        },
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.folderViews.board(folder_id),
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folderViews.board(folder_id),
      });
    },
  });

  // Update view settings
  const updateViewSettingsMutation = useMutation({
    mutationFn: async (settings: UpdateFolderViewSettingsRequest) => {
      const { folder: updatedFolder } =
        await folderViewsApi.updateFolderViewSettings(folder_id, settings);
      return updatedFolder;
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folderViews.board(folder_id),
      });
    },
  });

  const createTask = async (
    request: Omit<CreateWorkItemRequest, "folder_id">,
  ): Promise<WorkItem | null> => {
    try {
      return await createTaskMutation.mutateAsync(request);
    } catch (err) {
      console.error("[views/folder-board] failed to create task", err);
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
      console.error("[views/folder-board] failed to update task", err);
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
      console.error("[views/folder-board] failed to move task", err);
      return null;
    }
  };
  const deleteTask = async (id: string): Promise<boolean> => {
    try {
      await deleteTaskMutation.mutateAsync(id);
      return true;
    } catch (err) {
      console.error("[views/folder-board] failed to delete task", err);
      return false;
    }
  };
  const updateViewSettings = async (
    settings: UpdateFolderViewSettingsRequest,
  ): Promise<void> => {
    await updateViewSettingsMutation.mutateAsync(settings);
  };

  const getTask = useCallback(
    (id: string): FolderViewWorkItem | undefined => {
      for (const status of Object.keys(columns)) {
        const task = columns[status].find((t) => t.id === id);
        if (task) return task;
      }
      return undefined;
    },
    [columns],
  );

  const getTasksByStatus = useCallback(
    (status: string): FolderViewWorkItem[] => columns[status] || [],
    [columns],
  );

  const getTotalPoints = useCallback((): number => {
    // FolderViewWorkItem has no .estimate; points need a full work-items fetch.
    return 0;
  }, []);

  const getPointsByStatus = useCallback(
    (status: string): number =>
      (columns[status] || []).reduce((sum) => sum, 0),
    [columns],
  );

  const fetchBoard = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    folder,
    columns,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchBoard,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    updateViewSettings,
    getTask,
    getTasksByStatus,
    getTotalPoints,
    getPointsByStatus,
    refreshBoard: fetchBoard,
  };
}
