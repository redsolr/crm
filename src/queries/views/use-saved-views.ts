"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { useAuthStore } from "@/stores/auth.store";
import {
  viewsApi,
  type SavedView,
  type ViewVisibility,
} from "@/lib/viewsApi";

/**
 * useSavedViews — list + create + delete the caller's saved views for a
 * given `kind` (defaults to `work_items`). The `query` blob is opaque to
 * the platform; the board/backlog toolbar owns its shape
 * (`WorkItemsViewQuery` in BoardFilterBar). Errors are logged and the
 * mutators resolve to a safe value so the toolbar UI never throws.
 */
export function useSavedViews(kind: string = "work_items") {
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.savedViews.list({ kind }),
    queryFn: () => viewsApi.listViews({ kind }),
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      name: string;
      query: Record<string, unknown>;
      visibility?: ViewVisibility;
    }) =>
      viewsApi.createView({
        name: input.name,
        kind,
        visibility: input.visibility,
        query: input.query,
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.savedViews.all }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => viewsApi.deleteView(id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.savedViews.all }),
  });

  const saveView = async (
    name: string,
    blob: Record<string, unknown>,
    visibility?: ViewVisibility,
  ): Promise<SavedView | null> => {
    try {
      return await createMutation.mutateAsync({ name, query: blob, visibility });
    } catch (err) {
      console.error("[saved-views] failed to save view", err);
      return null;
    }
  };

  const removeView = async (id: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch (err) {
      console.error("[saved-views] failed to delete view", err);
      return false;
    }
  };

  return {
    views: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    isSaving: createMutation.isPending,
    saveView,
    removeView,
  };
}
