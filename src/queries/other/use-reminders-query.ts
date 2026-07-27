"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  remindersApi,
  Reminder,
  CreateReminderDto,
  UpdateReminderDto,
} from "@/lib/remindersApi";
import { useAuthStore } from "@/stores/auth.store";

export function useRemindersQuery() {
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();
  const queryKey = queryKeys.reminders.list();

  // BE returns the Stripe v2 cursor envelope; we keep the same shape in
  // the cache so consumers can read `data` / `has_more` / cursor URLs
  // without a second projection step. There is no `total` on cursor
  // pages — UI count is derived from `data.length`.
  type RemindersQueryData = {
    data: Reminder[];
    has_more: boolean;
    next_page_url: string | null;
    previous_page_url: string | null;
  };

  const emptyPage: RemindersQueryData = {
    data: [],
    has_more: false,
    next_page_url: null,
    previous_page_url: null,
  };

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<RemindersQueryData> => {
      const response = await remindersApi.list();
      return {
        data: response.data,
        has_more: response.has_more,
        next_page_url: response.next_page_url,
        previous_page_url: response.previous_page_url,
      };
    },
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (dto: CreateReminderDto) => {
      const response = await remindersApi.create(dto);
      return response.reminder;
    },
    onMutate: async (dto) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RemindersQueryData>(queryKey);
      const now = new Date().toISOString();
      const tempReminder: Reminder = {
        // Temp placeholder ID — not a real wire ID; widened via cast.
        id: `temp-${Date.now()}` as Reminder["id"],
        title: dto.title,
        description: dto.description || null,
        completed: false,
        position: previous?.data.length ?? 0,
        due_date: dto.due_date || null,
        userId: "",
        // Optimistic placeholder — server fills in real account_id.
        account_id: "" as Reminder["account_id"],
        created_at: now,
        updated_at: now,
        completed_at: null,
      };
      queryClient.setQueryData<RemindersQueryData>(queryKey, (old) => ({
        ...(old ?? emptyPage),
        data: [tempReminder, ...(old?.data ?? [])],
      }));
      return { previous, tempId: tempReminder.id };
    },
    onSuccess: (result, _vars, context) => {
      queryClient.setQueryData<RemindersQueryData>(queryKey, (old) => ({
        ...(old ?? emptyPage),
        data:
          old?.data.map((r) => (r.id === context?.tempId ? result : r)) ?? [],
      }));
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateReminderDto }) => {
      const response = await remindersApi.update(id, dto);
      return response.reminder;
    },
    onMutate: async ({ id, dto }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RemindersQueryData>(queryKey);
      queryClient.setQueryData<RemindersQueryData>(queryKey, (old) => ({
        ...(old ?? emptyPage),
        data:
          old?.data.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...dto,
                  updated_at: new Date().toISOString(),
                  ...(dto.completed === true && !r.completed
                    ? { completed_at: new Date().toISOString() }
                    : {}),
                  ...(dto.completed === false && r.completed
                    ? { completed_at: null }
                    : {}),
                }
              : r,
          ) ?? [],
      }));
      return { previous };
    },
    onSuccess: (result, { id }) => {
      queryClient.setQueryData<RemindersQueryData>(queryKey, (old) => ({
        ...(old ?? emptyPage),
        data: old?.data.map((r) => (r.id === id ? result : r)) ?? [],
      }));
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await remindersApi.delete(id);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RemindersQueryData>(queryKey);
      queryClient.setQueryData<RemindersQueryData>(queryKey, (old) => ({
        ...(old ?? emptyPage),
        data: old?.data.filter((r) => r.id !== id) ?? [],
      }));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async ({
      id,
      completed,
    }: {
      id: string;
      completed: boolean;
    }) => {
      const response = completed
        ? await remindersApi.complete(id)
        : await remindersApi.uncomplete(id);
      return response.reminder;
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RemindersQueryData>(queryKey);
      queryClient.setQueryData<RemindersQueryData>(queryKey, (old) => ({
        ...(old ?? emptyPage),
        data:
          old?.data.map((r) =>
            r.id === id
              ? {
                  ...r,
                  completed,
                  completed_at: completed ? new Date().toISOString() : null,
                  updated_at: new Date().toISOString(),
                }
              : r,
          ) ?? [],
      }));
      return { previous };
    },
    onSuccess: (result, { id }) => {
      queryClient.setQueryData<RemindersQueryData>(queryKey, (old) => ({
        ...(old ?? emptyPage),
        data: old?.data.map((r) => (r.id === id ? result : r)) ?? [],
      }));
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
    },
  });

  // Public API
  const reminders = query.data?.data ?? [];
  // Cursor pagination — UI count = items in the current page.
  const total = reminders.length;
  const hasMore = query.data?.has_more ?? false;
  const nextPageUrl = query.data?.next_page_url ?? null;
  const previousPageUrl = query.data?.previous_page_url ?? null;

  const createReminder = async (
    dto: CreateReminderDto,
  ): Promise<Reminder | null> => {
    try {
      return await createMutation.mutateAsync(dto);
    } catch (err) {
      console.error("[reminders] failed to create reminder", err);
      return null;
    }
  };

  const updateReminder = async (
    id: string,
    dto: UpdateReminderDto,
  ): Promise<Reminder | null> => {
    try {
      return await updateMutation.mutateAsync({ id, dto });
    } catch (err) {
      console.error("[reminders] failed to update reminder", err);
      return null;
    }
  };

  const deleteReminder = async (id: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch (err) {
      console.error("[reminders] failed to delete reminder", err);
      return false;
    }
  };

  const toggleComplete = async (id: string): Promise<Reminder | null> => {
    const existing = reminders.find((r) => r.id === id);
    if (!existing) return null;
    try {
      return await toggleCompleteMutation.mutateAsync({
        id,
        completed: !existing.completed,
      });
    } catch (err) {
      console.error("[reminders] failed to toggle reminder completion", err);
      return null;
    }
  };

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });

  return {
    reminders,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    total,
    hasMore,
    nextPageUrl,
    previousPageUrl,
    refresh,
    createReminder,
    updateReminder,
    deleteReminder,
    toggleComplete,
  };
}
