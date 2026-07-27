"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { queryKeys } from "../query-keys";
import { findCachedWorkItemVersion } from "../work-item-version-cache";
import {
  workItemsApi,
  WorkItem,
  CreateWorkItemRequest,
  UpdateWorkItemRequest,
  MoveWorkItemRequest,
  ListWorkItemsOptions,
} from "@/lib/workItemsApi";
import { useAuthStore } from "@/stores/auth.store";

export interface UseWorkItemsQueryOptions extends ListWorkItemsOptions {
  enabled?: boolean;
}

interface WorkItemsQueryData {
  data: WorkItem[];
  has_more: boolean;
  next_page_url: string | null;
  previous_page_url: string | null;
}

export function useWorkItemsQuery(options: UseWorkItemsQueryOptions = {}) {
  const { enabled = true, ...queryOptions } = options;
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();
  const queryOptionsRef = useRef(queryOptions);
  useEffect(() => {
    queryOptionsRef.current = queryOptions;
  }, [queryOptions]);

  const queryKey = queryKeys.workItems.list(
    queryOptions as Record<string, unknown>,
  );

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await workItemsApi.listWorkItems(
        queryOptionsRef.current,
      );
      // Pass through the Stripe v2 cursor envelope as-is. There is no
      // `total` on cursor pages — consumers derive item count from
      // `data.length` and detect more pages via `has_more`.
      return {
        data: response.data,
        has_more: response.has_more,
        next_page_url: response.next_page_url,
        previous_page_url: response.previous_page_url,
      } satisfies WorkItemsQueryData;
    },
    enabled: enabled && isAuthenticated,
  });

  // Create work item with optimistic update
  const createMutation = useMutation({
    mutationFn: async (request: CreateWorkItemRequest) => {
      const { workItem } = await workItemsApi.createWorkItem(request);
      return workItem;
    },
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkItemsQueryData>(queryKey);

      // Place the optimistic card at the END of its lane (same state + parent),
      // matching the backend's append (`maxPosition + 1`). Prepending at
      // position 0 made a new card flash at the top of the lane and then jump to
      // the bottom once the refetch landed.
      const laneKey = request.state_key ?? "backlog";
      const laneParent = request.parent_id ?? null;
      const laneMaxPosition = (previous?.data ?? [])
        .filter(
          (w) =>
            w.state.key === laneKey && (w.parent_id ?? null) === laneParent,
        )
        .reduce((max, w) => Math.max(max, w.position), -1);

      const tempId = `temp-${Date.now()}`;
      const optimistic: WorkItem = {
        id: tempId,
        identifier: "...",
        title: request.title,
        subject: null,
        description: request.description || null,
        state: {
          id: "",
          key: laneKey,
          name: "",
          category: "not_started",
        },
        type: {
          id: "",
          key: request.type_key ?? "task",
          name: "",
        },
        priority: request.priority || "none",
        position: laneMaxPosition + 1,
        due_date: request.due_date || null,
        estimate: request.estimate || null,
        assignee_id: request.assignee_id || null,
        assignee_name: null,
        parent_id: request.parent_id || null,
        workspace_id: request.workspace_id,
        iteration_id: request.iteration_id || null,
        folder_id: request.folder_id || null,
        visibility: "private",
        version: 0,
        dri_id: null,
        dri_name: null,
        // Slice 2 of the polymorphic-actor refactor surfaced these
        // on the wire. Optimistic placeholders are blank for both;
        // the server response overwrites them on settle.
        created_by_id: "",
        created_by_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
      };

      queryClient.setQueryData<WorkItemsQueryData>(queryKey, (old) => {
        if (!old) {
          return {
            data: [optimistic],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          };
        }
        // Append — the board sorts each lane by `position`, and the optimistic
        // card already carries the lane's max+1, so it lands last (no flash).
        return {
          ...old,
          data: [...old.data, optimistic],
        };
      });

      return { previous, tempId };
    },
    onSuccess: (serverItem, _vars, context) => {
      // Swap the optimistic `temp-…` card for the server row AS SOON AS the
      // create resolves — before the async `onSettled` refetch lands. Without
      // this, anything that reads the new item's id off the cache in that
      // window (e.g. the Matters Lab creating a folder/note/task under a
      // brand-new matter) sends the transient `temp-…` id and the backend
      // rejects it. Matching by the optimistic id keeps the swap precise.
      if (context?.tempId == null) return;
      queryClient.setQueryData<WorkItemsQueryData>(queryKey, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((item) =>
                item.id === context.tempId ? serverItem : item,
              ),
            }
          : old,
      );
    },
    onError: (err, _vars, context) => {
      console.error("[useWorkItemsQuery] createWorkItem failed:", err);
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
    },
  });

  // Write the server's authoritative row (incl. the freshly-incremented
  // `version`) into the cache on mutation success. Without this, the cache keeps
  // the pre-mutation version until the async `onSettled` refetch lands — so a
  // second quick mutation on the same item sends a stale `If-Match` and 412s
  // (version_conflict), which surfaces as a drag that "snaps back" every other
  // try. Bridges the gap so consecutive moves use the up-to-date version.
  const mergeServerWorkItem = (serverItem: WorkItem) => {
    queryClient.setQueryData<WorkItemsQueryData>(queryKey, (old) =>
      old
        ? {
            ...old,
            data: old.data.map((item) =>
              item.id === serverItem.id ? { ...item, ...serverItem } : item,
            ),
          }
        : old,
    );
  };

  // Update work item with optimistic update
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
      version,
    }: {
      id: string;
      updates: UpdateWorkItemRequest;
      version: number;
    }) => {
      const { workItem } = await workItemsApi.updateWorkItem(
        id,
        updates,
        version,
      );
      return workItem;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkItemsQueryData>(queryKey);

      queryClient.setQueryData<WorkItemsQueryData>(queryKey, (old) => {
        if (!old) return old;
        const { state_key: stateKey, ...restUpdates } = updates;
        return {
          ...old,
          data: old.data.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...restUpdates,
                  // Keep derived `status` mirroring `state_key` when set.
                  ...(stateKey !== undefined
                    ? {
                        state: { ...item.state, key: stateKey },
                        status: stateKey,
                      }
                    : {}),
                  updated_at: new Date().toISOString(),
                }
              : item,
          ) as WorkItem[],
        };
      });

      return { previous };
    },
    onError: (err, _vars, context) => {
      console.error("[useWorkItemsQuery] updateWorkItem failed:", err);
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: mergeServerWorkItem,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
    },
  });

  // Move work item with optimistic update
  const moveMutation = useMutation({
    mutationFn: async ({
      id,
      request,
      version,
    }: {
      id: string;
      request: MoveWorkItemRequest;
      version: number;
    }) => {
      const { workItem } = await workItemsApi.moveWorkItem(
        id,
        request,
        version,
      );
      return workItem;
    },
    onMutate: async ({ id, request }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkItemsQueryData>(queryKey);

      queryClient.setQueryData<WorkItemsQueryData>(queryKey, (old) => {
        if (!old) return old;
        const targetStatus = request.state_key;
        const source = old.data.find((item) => item.id === id);
        if (!source) return old;
        const remaining = old.data.filter((item) => item.id !== id);
        const target = {
          ...source,
          status: targetStatus,
          state: { ...source.state, key: targetStatus },
          ...(request.position !== undefined
            ? { position: request.position }
            : {}),
          updated_at: new Date().toISOString(),
        };
        const targetItems = remaining
          .filter(
            (item) =>
              item.state.key === targetStatus &&
              item.parent_id === source.parent_id,
          )
          .sort((a, b) => a.position - b.position);
        const insertAt =
          request.position !== undefined
            ? Math.max(0, Math.min(request.position, targetItems.length))
            : targetItems.length;
        targetItems.splice(insertAt, 0, target);
        const positionedTargetItems = targetItems.map((item, index) => ({
          ...item,
          position: index,
        }));
        const byId = new Map(
          positionedTargetItems.map((item) => [item.id, item]),
        );
        return {
          ...old,
          data: [...remaining, target]
            .map((item) => byId.get(item.id) ?? item)
            .sort((a, b) => {
              if (
                a.state.key === b.state.key &&
                a.parent_id === b.parent_id
              ) {
                return a.position - b.position;
              }
              return 0;
            }),
        };
      });

      return { previous };
    },
    onError: (err, _vars, context) => {
      console.error("[useWorkItemsQuery] moveWorkItem failed:", err);
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: mergeServerWorkItem,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
    },
  });

  // Delete work item with optimistic update
  const deleteMutation = useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      await workItemsApi.deleteWorkItem(id, version);
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkItemsQueryData>(queryKey);

      queryClient.setQueryData<WorkItemsQueryData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.filter((item) => item.id !== id),
        };
      });

      return { previous };
    },
    onError: (err, _vars, context) => {
      console.error("[useWorkItemsQuery] deleteWorkItem failed:", err);
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
    },
  });

  const workItems = useMemo(
    () => query.data?.data ?? [],
    [query.data?.data],
  );
  // Cursor pagination — BE doesn't return a `total` for `?page_size=`
  // pages. UI count = items in the current page. Use `hasMore` to
  // gate "Load more" affordances.
  const total = workItems.length;
  const hasMore = query.data?.has_more ?? false;
  const nextPageUrl = query.data?.next_page_url ?? null;
  const previousPageUrl = query.data?.previous_page_url ?? null;

  const createWorkItem = async (
    request: CreateWorkItemRequest,
  ): Promise<WorkItem | null> => {
    try {
      return await createMutation.mutateAsync(request);
    } catch (err) {
      console.error("[useWorkItemsQuery] createWorkItem mutation error:", err);
      return null;
    }
  };

  const updateWorkItem = async (
    id: string,
    updates: UpdateWorkItemRequest,
  ): Promise<WorkItem | null> => {
    const version = findCachedWorkItemVersion(queryClient, id);
    if (version === null) {
      console.error(
        `[useWorkItemsQuery] updateWorkItem: no cached version for ${id} — refetch the work item before mutating`,
      );
      return null;
    }
    try {
      return await updateMutation.mutateAsync({ id, updates, version });
    } catch (err) {
      console.error("[useWorkItemsQuery] updateWorkItem mutation error:", err);
      return null;
    }
  };

  const moveWorkItem = async (
    id: string,
    request: MoveWorkItemRequest,
  ): Promise<WorkItem | null> => {
    const version = findCachedWorkItemVersion(queryClient, id);
    if (version === null) {
      console.error(
        `[useWorkItemsQuery] moveWorkItem: no cached version for ${id} — refetch the work item before mutating`,
      );
      return null;
    }
    try {
      return await moveMutation.mutateAsync({ id, request, version });
    } catch (err) {
      console.error("[useWorkItemsQuery] moveWorkItem mutation error:", err);
      return null;
    }
  };

  const deleteWorkItem = async (id: string): Promise<boolean> => {
    const version = findCachedWorkItemVersion(queryClient, id);
    if (version === null) {
      console.error(
        `[useWorkItemsQuery] deleteWorkItem: no cached version for ${id} — refetch the work item before mutating`,
      );
      return false;
    }
    try {
      await deleteMutation.mutateAsync({ id, version });
      return true;
    } catch (err) {
      console.error("[useWorkItemsQuery] deleteWorkItem mutation error:", err);
      return false;
    }
  };

  const getWorkItem = useCallback(
    (id: string): WorkItem | undefined =>
      workItems.find((t) => t.id === id),
    [workItems],
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });

  return {
    workItems,
    total,
    hasMore,
    nextPageUrl,
    previousPageUrl,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    createWorkItem,
    updateWorkItem,
    moveWorkItem,
    deleteWorkItem,
    getWorkItem,
    refresh,
  };
}
