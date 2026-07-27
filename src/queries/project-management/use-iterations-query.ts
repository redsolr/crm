"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "../query-keys";
import {
  iterationsApi,
  Iteration,
  IterationStatus,
  IterationMetrics,
  CreateIterationRequest,
  UpdateIterationRequest,
  StartIterationRequest,
  CompleteIterationRequest,
} from "@/lib/iterationsApi";
import type { WorkItem } from "@/lib/workItemsApi";
import { useAuthStore } from "@/stores/auth.store";

export interface UseIterationsQueryOptions {
  workspace_id?: string;
  enabled?: boolean;
}

export function useIterationsQuery(options: UseIterationsQueryOptions = {}) {
  const { workspace_id, enabled = true } = options;
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: workspace_id
      ? queryKeys.iterations.byWorkspace(workspace_id)
      : queryKeys.iterations.all,
    queryFn: async () => {
      const response = workspace_id
        ? await iterationsApi.listIterationsByWorkspace(workspace_id)
        : await iterationsApi.listIterations();
      return response.data;
    },
    enabled: enabled && isAuthenticated && !!workspace_id,
  });

  const createMutation = useMutation({
    mutationFn: async (request: CreateIterationRequest) => {
      const { iteration } = await iterationsApi.createIteration(request);
      return iteration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.iterations.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateIterationRequest;
    }) => {
      const { iteration } = await iterationsApi.updateIteration(
        id,
        updates,
      );
      return iteration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.iterations.all });
    },
  });

  const startMutation = useMutation({
    mutationFn: async ({
      id,
      request,
    }: {
      id: string;
      request: StartIterationRequest;
    }) => {
      const { iteration } = await iterationsApi.startIteration(
        id,
        request,
      );
      return iteration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.iterations.all });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({
      id,
      request,
    }: {
      id: string;
      request: CompleteIterationRequest;
    }) => {
      const { iteration } = await iterationsApi.completeIteration(
        id,
        request,
      );
      return iteration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.iterations.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await iterationsApi.deleteIteration(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.iterations.all });
    },
  });

  const iterations = useMemo(() => query.data ?? [], [query.data]);
  const activeIteration = useMemo(
    () => iterations.find((i) => i.status === "active") ?? null,
    [iterations],
  );

  const getIteration = async (id: string): Promise<Iteration | null> => {
    try {
      const { iteration } = await iterationsApi.getIteration(id);
      return iteration;
    } catch (err) {
      console.error("[iterations] failed to fetch iteration", err);
      return null;
    }
  };

  const fetchActiveIteration = async (
    projId: string,
  ): Promise<Iteration | null> => {
    try {
      const { iteration } =
        await iterationsApi.getActiveIteration(projId);
      return iteration;
    } catch (err) {
      console.error("[iterations] failed to fetch active iteration", err);
      return null;
    }
  };

  const getIterationWorkItems = async (id: string): Promise<WorkItem[]> => {
    try {
      const { data } = await iterationsApi.getIterationWorkItems(id);
      return data;
    } catch (err) {
      console.error("[iterations] failed to fetch iteration work items", err);
      return [];
    }
  };

  const getIterationMetrics = async (
    id: string,
  ): Promise<IterationMetrics | null> => {
    try {
      const { metrics } = await iterationsApi.getIterationMetrics(id);
      return metrics;
    } catch (err) {
      console.error("[iterations] failed to fetch iteration metrics", err);
      return null;
    }
  };

  const createIteration = async (
    request: CreateIterationRequest,
  ): Promise<Iteration | null> => {
    try {
      return await createMutation.mutateAsync(request);
    } catch (err) {
      console.error("[iterations] failed to create iteration", err);
      return null;
    }
  };

  const updateIteration = async (
    id: string,
    updates: UpdateIterationRequest,
  ): Promise<Iteration | null> => {
    try {
      return await updateMutation.mutateAsync({ id, updates });
    } catch (err) {
      console.error("[iterations] failed to update iteration", err);
      return null;
    }
  };

  const startIteration = async (
    id: string,
    request: StartIterationRequest,
  ): Promise<Iteration | null> => {
    try {
      return await startMutation.mutateAsync({ id, request });
    } catch (err) {
      console.error("[iterations] failed to start iteration", err);
      return null;
    }
  };

  const completeIteration = async (
    id: string,
    request: CompleteIterationRequest,
  ): Promise<Iteration | null> => {
    try {
      return await completeMutation.mutateAsync({ id, request });
    } catch (err) {
      console.error("[iterations] failed to complete iteration", err);
      return null;
    }
  };

  const deleteIteration = async (id: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch (err) {
      console.error("[iterations] failed to delete iteration", err);
      return false;
    }
  };

  const getIterationsByStatus = useCallback(
    (status: IterationStatus): Iteration[] =>
      iterations.filter((i) => i.status === status),
    [iterations],
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.iterations.all });

  return {
    iterations,
    activeIteration,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    getIteration,
    fetchActiveIteration,
    getIterationWorkItems,
    getIterationMetrics,
    createIteration,
    updateIteration,
    startIteration,
    completeIteration,
    deleteIteration,
    getIterationsByStatus,
    refresh,
  };
}
