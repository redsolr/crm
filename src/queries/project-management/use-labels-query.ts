"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "../query-keys";
import {
  labelsApi,
  Label,
  CreateLabelRequest,
  UpdateLabelRequest,
} from "@/lib/labelsApi";
import { useAuthStore } from "@/stores/auth.store";
import { useAppContextStore } from "@/stores/app-context.store";

export interface UseLabelsQueryOptions {
  /**
   * Customer-facing project grouping — drives the cache key. The wire
   * call is workspace-scoped post-rename (2026-05-27); the hook reads
   * the active workspace id from the global app-context store.
   */
  projectId?: string;
  enabled?: boolean;
}

export function useLabelsQuery(options: UseLabelsQueryOptions = {}) {
  const { enabled = true, projectId } = options;
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const workspaceId = useAppContextStore((s) => s.currentWorkspace?.id);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: projectId ? queryKeys.labels.byProject(projectId) : queryKeys.labels.all,
    queryFn: async () => {
      if (!workspaceId) {
        // Should be unreachable thanks to `enabled` below — guards
        // against a misconfigured caller.
        return { data: [] as Label[] };
      }
      const response = await labelsApi.listLabels({ workspaceId });
      return { data: response.data };
    },
    enabled: enabled && isAuthenticated && !!projectId && !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: async (request: CreateLabelRequest) => {
      if (!workspaceId) {
        throw new Error("workspaceId is required to create a label");
      }
      const { label } = await labelsApi.createLabel(workspaceId, request);
      return label;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateLabelRequest;
    }) => {
      const { label } = await labelsApi.updateLabel(id, updates);
      return label;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await labelsApi.deleteLabel(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
    },
  });

  const labels = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  // Labels endpoint returns a bounded `{ data }` array — no pagination
  // markers. Total is the array length.
  const total = labels.length;

  const createLabel = async (
    request: CreateLabelRequest,
  ): Promise<Label | null> => {
    try {
      return await createMutation.mutateAsync(request);
    } catch (err) {
      console.error("[labels] failed to create label", err);
      return null;
    }
  };

  const updateLabel = async (
    id: string,
    updates: UpdateLabelRequest,
  ): Promise<Label | null> => {
    try {
      return await updateMutation.mutateAsync({ id, updates });
    } catch (err) {
      console.error("[labels] failed to update label", err);
      return null;
    }
  };

  const deleteLabel = async (id: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch (err) {
      console.error("[labels] failed to delete label", err);
      return false;
    }
  };

  const getLabel = useCallback(
    (id: string): Label | undefined => labels.find((l) => l.id === id),
    [labels],
  );

  const getLabelByName = useCallback(
    (name: string): Label | undefined =>
      labels.find((l) => l.name.toLowerCase() === name.toLowerCase()),
    [labels],
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });

  return {
    labels,
    total,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    createLabel,
    updateLabel,
    deleteLabel,
    getLabel,
    getLabelByName,
    refresh,
  };
}
