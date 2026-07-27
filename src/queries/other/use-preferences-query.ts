"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  preferencesApiClient,
  type UpdatePreferencesRequest,
  type UserPreferences,
} from "@/lib/preferencesApi";
import { useAuthStore } from "@/stores/auth.store";

const PREFS_KEY = ["userPreferences"] as const;
const SESSIONS_KEY = ["sessionCount"] as const;

export function usePreferencesQuery() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: PREFS_KEY,
    queryFn: () => preferencesApiClient.getPreferences(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: UpdatePreferencesRequest) =>
      preferencesApiClient.updatePreferences(updates),
    onSuccess: (data) => {
      queryClient.setQueryData(PREFS_KEY, data);
    },
  });

  const updatePreferences = async (
    updates: UpdatePreferencesRequest,
  ): Promise<UserPreferences | null> => {
    return await updateMutation.mutateAsync(updates);
  };

  return {
    preferences: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    updatePreferences,
    isUpdating: updateMutation.isPending,
  };
}

export function useProfileMutation() {
  const user = useAuthStore((s) => s.user);

  const mutation = useMutation({
    mutationFn: (updates: { fullName?: string }) => {
      if (!user?.user_id) throw new Error("No user ID");
      return preferencesApiClient.updateProfile(user.user_id, updates);
    },
  });

  return {
    updateProfile: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}

export function useSessionCountQuery() {
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => preferencesApiClient.getSessionCount(),
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const revokeMutation = useMutation({
    mutationFn: () => preferencesApiClient.revokeAllSessions(),
  });

  return {
    sessionCount: query.data ?? 0,
    isLoading: query.isLoading,
    revokeAllSessions: revokeMutation.mutateAsync,
    isRevoking: revokeMutation.isPending,
  };
}
