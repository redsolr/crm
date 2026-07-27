"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { useAuthStore } from "@/stores/auth.store";
import { teamApi } from "@/lib/teamApi";

export function useOrganizationsQuery() {
  const isAuthenticated = useAuthStore((s) => !!s.user);

  return useQuery({
    queryKey: queryKeys.organizations.list(),
    // Wire shape is a bare array — return it directly (an `.data`
    // unwrap here returns undefined and crashes React Query).
    queryFn: () => teamApi.getOrganizations(),
    enabled: isAuthenticated,
  });
}

export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; billing_email?: string }) => {
      return teamApi.createOrganization(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.all,
      });
    },
  });
}
