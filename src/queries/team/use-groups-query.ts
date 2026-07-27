"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { useAuthStore } from "@/stores/auth.store";
import { teamApi } from "@/lib/teamApi";

export function useGroupsQuery() {
  const isAuthenticated = useAuthStore((s) => !!s.user);

  return useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: async () => {
      const response = await teamApi.getGroups();
      return response.data;
    },
    enabled: isAuthenticated,
  });
}

export function useGroupDetailQuery(groupId: string | null) {
  return useQuery({
    queryKey: queryKeys.groups.detail(groupId ?? ""),
    queryFn: () => teamApi.getGroup(groupId!),
    enabled: !!groupId,
  });
}

export function useCreateGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return teamApi.createGroup(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
  });
}

export function useDeleteGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      return teamApi.deleteGroup(groupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
  });
}

export function useAddGroupMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      accountId,
    }: {
      groupId: string;
      accountId: string;
    }) => {
      return teamApi.addGroupMember(groupId, accountId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.detail(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.members(variables.groupId),
      });
      // Member counts on the list view include this group.
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
    },
  });
}

export function useRemoveGroupMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      accountId,
    }: {
      groupId: string;
      accountId: string;
    }) => {
      return teamApi.removeGroupMember(groupId, accountId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.detail(variables.groupId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
    },
  });
}
