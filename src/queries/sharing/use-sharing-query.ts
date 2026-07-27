"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { useAuthStore } from "@/stores/auth.store";
import {
  sharingApi,
  type ShareScope,
  type ShareRole,
  type PrincipalType,
  type ShareWithGrants,
} from "@/lib/sharingApi";

// ============================================================================
// Query: Fetch shares for a resource
// ============================================================================

export function useResourceShares(resourceType: string, resourceId: string) {
  const isAuthenticated = useAuthStore((s) => !!s.user);

  return useQuery({
    queryKey: queryKeys.sharing.resource(resourceType, resourceId),
    queryFn: () => sharingApi.getResourceShares(resourceType, resourceId),
    enabled: isAuthenticated && !!resourceType && !!resourceId,
  });
}

// ============================================================================
// Query: Fetch sharing summary for a resource
// ============================================================================

export function useSharingSummary(resourceType: string, resourceId: string) {
  const isAuthenticated = useAuthStore((s) => !!s.user);

  return useQuery({
    queryKey: queryKeys.sharing.summary(resourceType, resourceId),
    queryFn: () => sharingApi.getSharingSummary(resourceType, resourceId),
    enabled: isAuthenticated && !!resourceType && !!resourceId,
  });
}

// ============================================================================
// Mutation: Create a new share
// ============================================================================

export function useCreateShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scope,
      resourceId,
      grants,
      message,
      inherits,
    }: {
      scope: ShareScope;
      resourceId: string;
      grants: Array<{
        principalType: PrincipalType;
        principalId: string;
        role: ShareRole;
      }>;
      message?: string;
      inherits?: boolean;
    }) => {
      return sharingApi.createShare({
        scope,
        resourceId,
        grants,
        message,
        inherits,
      });
    },
    onSuccess: (_data, variables) => {
      // Map scope to resource type for cache invalidation
      const resourceType = variables.scope;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sharing.resource(
          resourceType,
          variables.resourceId,
        ),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sharing.summary(resourceType, variables.resourceId),
      });
    },
  });
}

// ============================================================================
// Mutation: Add a grant to an existing share
// ============================================================================

export function useAddGrant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shareId,
      principalType,
      principalId,
      role,
    }: {
      shareId: string;
      principalType: PrincipalType;
      principalId: string;
      role: ShareRole;
      // These are only used for cache invalidation
      resourceType: string;
      resourceId: string;
    }) => {
      return sharingApi.addGrant(shareId, {
        principalType,
        principalId,
        role,
      });
    },
    onMutate: async (variables) => {
      const queryKey = queryKeys.sharing.resource(
        variables.resourceType,
        variables.resourceId,
      );
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ShareWithGrants[]>(queryKey);
      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sharing.resource(
          variables.resourceType,
          variables.resourceId,
        ),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sharing.summary(
          variables.resourceType,
          variables.resourceId,
        ),
      });
    },
  });
}

// ============================================================================
// Mutation: Remove a grant from a share
// ============================================================================

export function useRemoveGrant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shareId,
      principalType,
      principalId,
    }: {
      shareId: string;
      principalType: PrincipalType;
      principalId: string;
      // For cache invalidation
      resourceType: string;
      resourceId: string;
    }) => {
      return sharingApi.removeGrant(shareId, principalType, principalId);
    },
    onMutate: async (variables) => {
      const queryKey = queryKeys.sharing.resource(
        variables.resourceType,
        variables.resourceId,
      );
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ShareWithGrants[]>(queryKey);

      // Optimistic removal
      if (previous) {
        const updated = previous.map((swg) => {
          if (swg.share.id === variables.shareId) {
            return {
              ...swg,
              grants: swg.grants.filter(
                (g) =>
                  !(
                    g.principalType === variables.principalType &&
                    g.principalId === variables.principalId
                  ),
              ),
            };
          }
          return swg;
        });
        queryClient.setQueryData(queryKey, updated);
      }

      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sharing.resource(
          variables.resourceType,
          variables.resourceId,
        ),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sharing.summary(
          variables.resourceType,
          variables.resourceId,
        ),
      });
    },
  });
}

// ============================================================================
// Mutation: Delete a share entirely
// ============================================================================

export function useDeleteShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shareId,
    }: {
      shareId: string;
      resourceType: string;
      resourceId: string;
    }) => {
      return sharingApi.deleteShare(shareId);
    },
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sharing.resource(
          variables.resourceType,
          variables.resourceId,
        ),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sharing.summary(
          variables.resourceType,
          variables.resourceId,
        ),
      });
    },
  });
}
