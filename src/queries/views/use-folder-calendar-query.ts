"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { useAuthStore } from "@/stores/auth.store";
import {
  folderViewsApi,
  Folder,
  FolderViewWorkItem,
  UpdateFolderViewSettingsRequest,
} from "@/lib/folderViewsApi";

// ============================================================================
// useFolderCalendar — Calendar view
// ============================================================================

export function useFolderCalendarQuery(
  folder_id: string,
  options: { autoFetch?: boolean; start_date: string; end_date: string },
) {
  const { autoFetch = true, start_date, end_date } = options;
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.folderViews.calendar(folder_id, start_date, end_date),
    queryFn: async () => {
      return folderViewsApi.getFolderCalendarView(
        folder_id,
        start_date,
        end_date,
      );
    },
    enabled:
      autoFetch && !!folder_id && !!start_date && !!end_date && isAuthenticated,
  });

  const folder: Folder | null = query.data?.folder ?? null;
  const tasks_by_date: { [date: string]: FolderViewWorkItem[] } = useMemo(
    () => query.data?.tasks_by_date ?? {},
    [query.data?.tasks_by_date],
  );

  const updateViewSettingsMutation = useMutation({
    mutationFn: async (settings: UpdateFolderViewSettingsRequest) => {
      const { folder: updatedFolder } =
        await folderViewsApi.updateFolderViewSettings(folder_id, settings);
      return updatedFolder;
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folderViews.calendar(folder_id, start_date, end_date),
      });
    },
  });

  const getTasksForDate = useCallback(
    (date: string): FolderViewWorkItem[] => tasks_by_date[date] || [],
    [tasks_by_date],
  );
  const updateViewSettings = async (
    settings: UpdateFolderViewSettingsRequest,
  ): Promise<void> => {
    await updateViewSettingsMutation.mutateAsync(settings);
  };
  const fetchCalendar = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    folder,
    tasks_by_date,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    fetchCalendar,
    updateViewSettings,
    getTasksForDate,
    refreshCalendar: fetchCalendar,
  };
}

export const useFolderCalendar = useFolderCalendarQuery;
