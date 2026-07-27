"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { organizationsApi, Organization } from "@/lib/organizationsApi";
import { useAuthStore } from "@/stores/auth.store";

export interface UseOrganizationsQueryOptions {
  enabled?: boolean;
}

export function useOrganizationsQuery(
  options: UseOrganizationsQueryOptions = {},
) {
  const { enabled = true } = options;
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.organizations.list(),
    queryFn: async () => {
      // BE returns a bare JSON array (`OrganizationList`), not a
      // `{data, meta}` wrapper. See `organizationsApi.ts:OrganizationsListResponse`.
      return await organizationsApi.listOrganizations();
    },
    enabled: enabled && isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 min — orgs rarely change
  });

  const getOrganization = async (id: string): Promise<Organization | null> => {
    try {
      const { organization } = await organizationsApi.getOrganization(id);
      return organization;
    } catch (err) {
      console.error("[workspace/organizations] failed to fetch organization", err);
      return null;
    }
  };

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all });

  return {
    organizations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    getOrganization,
    refresh,
    fetchOrganizations: refresh,
    refreshOrganizations: refresh,
  };
}
