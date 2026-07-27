"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { useAuthStore } from "@/stores/auth.store";
import { teamApi, type MemberRole } from "@/lib/teamApi";

// Members live on the organization (the multi-tenant boundary), not
// the account (identity). The hook reads `organization_id` from the
// auth store; the cache key still includes `account_id` because the
// member SET is per-account-active-org from the dashboard's POV.

export function useAccountMembersQuery() {
  const account_id = useAuthStore((s) => s.user?.account_id);
  const organization_id = useAuthStore((s) => s.user?.organization_id);

  return useQuery({
    queryKey: queryKeys.accountMembers.list(account_id ?? ""),
    queryFn: () => teamApi.getAccountMembers(organization_id!),
    enabled: !!account_id && !!organization_id,
  });
}

export function useUpdateMemberRoleMutation() {
  const queryClient = useQueryClient();
  const account_id = useAuthStore((s) => s.user?.account_id);
  const organization_id = useAuthStore((s) => s.user?.organization_id);

  return useMutation({
    mutationFn: async ({
      target_account_id,
      role,
    }: {
      target_account_id: string;
      role: MemberRole;
    }) => {
      return teamApi.updateMemberRole(
        organization_id!,
        target_account_id,
        role,
      );
    },
    onSuccess: () => {
      if (account_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.accountMembers.list(account_id),
        });
      }
    },
  });
}

export function useRemoveAccountMemberMutation() {
  const queryClient = useQueryClient();
  const account_id = useAuthStore((s) => s.user?.account_id);
  const organization_id = useAuthStore((s) => s.user?.organization_id);

  return useMutation({
    mutationFn: async (userId: string) => {
      return teamApi.removeMember(organization_id!, userId);
    },
    onSuccess: () => {
      if (account_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.accountMembers.list(account_id),
        });
      }
    },
  });
}
