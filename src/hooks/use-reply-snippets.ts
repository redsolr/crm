"use client";

/**
 * Reply snippets — workspace-shared saved replies for the client
 * composer. Thin react-query wrapper over `replySnippetsApi`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppContextStore } from "@/stores/app-context.store";
import {
  replySnippetsApi,
  type ReplySnippet,
} from "@/lib/reply-snippets/reply-snippets-api";

export function useReplySnippets(): {
  snippets: ReplySnippet[];
  isLoading: boolean;
  createSnippet: (input: { title: string; body: string }) => Promise<void>;
  removeSnippet: (id: string) => Promise<void>;
} {
  const workspaceId = useAppContextStore((s) => s.currentWorkspace?.id) ?? null;
  const queryClient = useQueryClient();
  const queryKey = ["reply-snippets", workspaceId];

  const query = useQuery({
    queryKey,
    queryFn: () => replySnippetsApi.list(),
    enabled: workspaceId != null,
    staleTime: 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (input: { title: string; body: string }) =>
      replySnippetsApi.create(input),
    onSuccess: invalidate,
    onError: (err) => {
      console.error("[use-reply-snippets] create failed:", err);
    },
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => replySnippetsApi.remove(id),
    onSuccess: invalidate,
    onError: (err) => {
      console.error("[use-reply-snippets] remove failed:", err);
    },
  });

  return {
    snippets: query.data ?? [],
    isLoading: query.isLoading,
    createSnippet: async (input) => {
      await createMutation.mutateAsync(input);
    },
    removeSnippet: async (id) => {
      await removeMutation.mutateAsync(id);
    },
  };
}
