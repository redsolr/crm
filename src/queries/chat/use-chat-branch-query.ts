"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  chatApiClient,
  BranchInfo,
  BranchTreeNode,
  CreateBranchResponse,
} from "@/lib/chatApi";

export interface UseChatBranchQueryOptions {
  onBranchCreated?: (branch: CreateBranchResponse) => void;
  onError?: (error: string) => void;
}

export function useChatBranchQuery(
  chatId: string | null,
  options?: UseChatBranchQueryOptions,
) {
  const queryClient = useQueryClient();

  // Fetch branches for this chat
  const branchesQuery = useQuery({
    queryKey: queryKeys.chats.branches(chatId || ""),
    queryFn: async () => {
      const branchList = await chatApiClient.getBranches(chatId!);

      // Group branches by message ID for indicator display
      const grouped: Record<string, BranchInfo[]> = {};
      for (const branch of branchList) {
        if (branch.branchedFromMessageId) {
          if (!grouped[branch.branchedFromMessageId]) {
            grouped[branch.branchedFromMessageId] = [];
          }
          grouped[branch.branchedFromMessageId].push(branch);
        }
      }

      return { branches: branchList, messageBranches: grouped };
    },
    enabled: !!chatId,
  });

  // Fetch branch tree
  const branchTreeQuery = useQuery({
    queryKey: queryKeys.chats.branchTree(chatId || ""),
    queryFn: async () => {
      return chatApiClient.getBranchTree(chatId!);
    },
    enabled: false, // Only fetch on demand
  });

  // Create branch mutation
  const createBranchMutation = useMutation({
    mutationFn: async ({
      messageId,
      branchName,
    }: {
      messageId: string;
      branchName?: string;
    }) => {
      if (!chatId) throw new Error("No chat ID provided");
      return chatApiClient.createBranch(chatId, { messageId, branchName });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chats.branches(chatId || ""),
      });
      options?.onBranchCreated?.(response);
    },
    onError: (err) => {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create branch";
      options?.onError?.(errorMessage);
    },
  });

  const branches = branchesQuery.data?.branches ?? [];
  const messageBranches = useMemo(
    () => branchesQuery.data?.messageBranches ?? {},
    [branchesQuery.data?.messageBranches],
  );
  const branchTree: BranchTreeNode | null = branchTreeQuery.data ?? null;

  const createBranch = useCallback(
    async (
      messageId: string,
      branchName?: string,
    ): Promise<CreateBranchResponse | null> => {
      try {
        return await createBranchMutation.mutateAsync({
          messageId,
          branchName,
        });
      } catch (err) {
        console.error("[chat/branches] failed to create branch", err);
        return null;
      }
    },
    [createBranchMutation],
  );

  const fetchBranches = useCallback(() => {
    if (chatId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chats.branches(chatId),
      });
    }
  }, [chatId, queryClient]);

  const fetchBranchTree = useCallback(() => {
    branchTreeQuery.refetch();
  }, [branchTreeQuery]);

  const fetchBranchesFromMessage = useCallback(
    async (messageId: string) => {
      try {
        const branchList =
          await chatApiClient.getBranchesFromMessage(messageId);

        // Update the cache with the new message branches
        queryClient.setQueryData(
          queryKeys.chats.branches(chatId || ""),
          (
            old:
              | {
                  branches: BranchInfo[];
                  messageBranches: Record<string, BranchInfo[]>;
                }
              | undefined,
          ) => {
            if (!old) return old;
            return {
              ...old,
              messageBranches: {
                ...old.messageBranches,
                [messageId]: branchList,
              },
            };
          },
        );

        return branchList;
      } catch (err) {
        console.error("[chat/branches] failed to fetch branches from message", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to fetch message branches";
        options?.onError?.(errorMessage);
        return [];
      }
    },
    [chatId, queryClient, options],
  );

  const getBranchesForMessage = useCallback(
    (messageId: string): BranchInfo[] => {
      return messageBranches[messageId] || [];
    },
    [messageBranches],
  );

  const messageHasBranches = useCallback(
    (messageId: string): boolean => {
      return (messageBranches[messageId]?.length || 0) > 0;
    },
    [messageBranches],
  );

  const clearError = useCallback(() => {
    // Errors are managed by TanStack Query — this is a no-op for compatibility
  }, []);

  return {
    branches,
    branchTree,
    messageBranches,
    isLoading: branchesQuery.isLoading || createBranchMutation.isPending,
    error:
      branchesQuery.error?.message ??
      createBranchMutation.error?.message ??
      null,
    createBranch,
    fetchBranches,
    fetchBranchTree,
    fetchBranchesFromMessage,
    getBranchesForMessage,
    messageHasBranches,
    clearError,
  };
}
