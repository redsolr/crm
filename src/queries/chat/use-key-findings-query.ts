"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "../query-keys";
import {
  findingsApiClient,
  Finding as ApiFinding,
  CreateFindingRequest,
} from "@/lib/chatApi";
import { useAuthStore } from "@/stores/auth.store";

// ============================================================================
// Types
// ============================================================================

export interface KeyFinding {
  id: string;
  content: string;
  title: string;
  source: {
    type: "chat-message" | "text-selection";
    messageId?: string;
    messageIndex?: number;
    elementId?: string;
    conversationId?: string;
    timestamp: Date;
    selectionStart?: number;
    selectionEnd?: number;
  };
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Helpers
// ============================================================================

const STORAGE_KEY = "jurisimus-key-findings";
const USE_API = process.env.NEXT_PUBLIC_USE_FINDINGS_API !== "false";

function generateTitle(content: string): string {
  const firstSentence = content.split(/[.!?]/)[0]?.trim() || content;
  const maxLength = 60;
  if (firstSentence.length <= maxLength) return firstSentence;
  return firstSentence.substring(0, maxLength - 3) + "...";
}

function groupByDate(findings: KeyFinding[]): Map<string, KeyFinding[]> {
  const groups = new Map<string, KeyFinding[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  findings.forEach((finding) => {
    const findingDate = new Date(finding.created_at);
    findingDate.setHours(0, 0, 0, 0);

    let key: string;
    if (findingDate.getTime() === today.getTime()) {
      key = "Today";
    } else if (findingDate.getTime() === yesterday.getTime()) {
      key = "Yesterday";
    } else {
      key = findingDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year:
          findingDate.getFullYear() !== today.getFullYear()
            ? "numeric"
            : undefined,
      });
    }

    const existing = groups.get(key) || [];
    groups.set(key, [...existing, finding]);
  });

  return groups;
}

function groupByConversation(
  findings: KeyFinding[],
): Map<string, KeyFinding[]> {
  const groups = new Map<string, KeyFinding[]>();
  findings.forEach((finding) => {
    const conversationId = finding.source.conversationId || "Unknown Session";
    const existing = groups.get(conversationId) || [];
    groups.set(conversationId, [...existing, finding]);
  });
  return groups;
}

function apiToKeyFinding(apiFinding: ApiFinding): KeyFinding {
  return {
    id: apiFinding.id,
    content: apiFinding.content,
    title: apiFinding.title,
    source: {
      type: apiFinding.sourceType,
      messageId: apiFinding.sourceMessageId || undefined,
      conversationId: apiFinding.chatId || undefined,
      timestamp: apiFinding.sourceTimestamp
        ? new Date(apiFinding.sourceTimestamp)
        : new Date(apiFinding.created_at),
      selectionStart: apiFinding.selectionStart || undefined,
      selectionEnd: apiFinding.selectionEnd || undefined,
    },
    tags: apiFinding.tags || undefined,
    created_at: new Date(apiFinding.created_at),
    updated_at: new Date(apiFinding.updated_at),
  };
}

function keyFindingToApiRequest(
  content: string,
  source: KeyFinding["source"],
  title?: string,
): CreateFindingRequest {
  return {
    content,
    title,
    source: {
      type: source.type,
      messageId: source.messageId,
      chatId: source.conversationId,
      timestamp: source.timestamp.toISOString(),
      selectionStart: source.selectionStart,
      selectionEnd: source.selectionEnd,
    },
  };
}

function loadFromLocalStorage(chatId?: string): KeyFinding[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const hydrated = parsed.map((f: KeyFinding) => ({
      ...f,
      created_at: new Date(f.created_at),
      updated_at: new Date(f.updated_at),
      source: { ...f.source, timestamp: new Date(f.source.timestamp) },
    }));
    return chatId
      ? hydrated.filter((f: KeyFinding) => f.source.conversationId === chatId)
      : hydrated;
  } catch (err) {
    console.warn(
      "[chat/key-findings] non-critical: failed to parse stored key findings, returning empty list",
      err,
    );
    return [];
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useKeyFindingsQuery(chatId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: chatId
      ? queryKeys.findings.byChatId(chatId)
      : queryKeys.findings.all,
    queryFn: async () => {
      const isAuthenticated = useAuthStore.getState().user !== null;
      if (USE_API && isAuthenticated) {
        const response = await findingsApiClient.listFindings({ chatId });
        return response.findings.map(apiToKeyFinding);
      }
      return loadFromLocalStorage(chatId);
    },
  });

  const findings = useMemo(() => query.data ?? [], [query.data]);

  const addMutation = useMutation({
    mutationFn: async ({
      content,
      source,
      title,
    }: {
      content: string;
      source: KeyFinding["source"];
      title?: string;
    }) => {
      const generatedTitle = title || generateTitle(content);
      const isAuthenticated = useAuthStore.getState().user !== null;

      if (USE_API && isAuthenticated) {
        const request = keyFindingToApiRequest(content, source, generatedTitle);
        const apiFinding = await findingsApiClient.createFinding(request);
        return apiToKeyFinding(apiFinding);
      }

      // localStorage fallback
      const newFinding: KeyFinding = {
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        title: generatedTitle,
        source,
        created_at: new Date(),
        updated_at: new Date(),
      };

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const existing = stored ? JSON.parse(stored) : [];
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify([newFinding, ...existing]),
        );
      } catch {
        // Ignore localStorage errors
      }

      return newFinding;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.findings.all });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const isAuthenticated = useAuthStore.getState().user !== null;
      if (USE_API && isAuthenticated) {
        await findingsApiClient.deleteFinding(id);
      } else {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const existing = JSON.parse(stored);
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(existing.filter((f: KeyFinding) => f.id !== id)),
            );
          }
        } catch {
          // Ignore localStorage errors
        }
      }
    },
    onMutate: async (id: string) => {
      // Optimistic remove
      await queryClient.cancelQueries({ queryKey: queryKeys.findings.all });
      const previousFindings = queryClient.getQueryData<KeyFinding[]>(
        chatId ? queryKeys.findings.byChatId(chatId) : queryKeys.findings.all,
      );
      queryClient.setQueryData<KeyFinding[]>(
        chatId ? queryKeys.findings.byChatId(chatId) : queryKeys.findings.all,
        (old) => old?.filter((f) => f.id !== id) ?? [],
      );
      return { previousFindings };
    },
    onError: (_err, _id, context) => {
      if (context?.previousFindings) {
        queryClient.setQueryData(
          chatId ? queryKeys.findings.byChatId(chatId) : queryKeys.findings.all,
          context.previousFindings,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.findings.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<KeyFinding>;
    }) => {
      const isAuthenticated = useAuthStore.getState().user !== null;
      if (USE_API && isAuthenticated) {
        await findingsApiClient.updateFinding(id, {
          title: updates.title,
          content: updates.content,
          tags: updates.tags,
        });
      }
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.findings.all });
      const queryKey = chatId
        ? queryKeys.findings.byChatId(chatId)
        : queryKeys.findings.all;
      const previousFindings = queryClient.getQueryData<KeyFinding[]>(queryKey);
      queryClient.setQueryData<KeyFinding[]>(
        queryKey,
        (old) =>
          old?.map((f) =>
            f.id === id ? { ...f, ...updates, updated_at: new Date() } : f,
          ) ?? [],
      );
      return { previousFindings };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousFindings) {
        queryClient.setQueryData(
          chatId ? queryKeys.findings.byChatId(chatId) : queryKeys.findings.all,
          context.previousFindings,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.findings.all });
    },
  });

  const addFinding = useCallback(
    (
      content: string,
      source: KeyFinding["source"],
      title?: string,
    ): KeyFinding => {
      const now = new Date();
      const generatedTitle = title || generateTitle(content);

      // Create optimistic finding for synchronous return
      const optimisticFinding: KeyFinding = {
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        title: generatedTitle,
        source,
        created_at: now,
        updated_at: now,
      };

      // Fire mutation (async)
      addMutation.mutate({ content, source, title });

      return optimisticFinding;
    },
    [addMutation],
  );

  const removeFinding = useCallback(
    (id: string) => removeMutation.mutate(id),
    [removeMutation],
  );

  const updateFinding = useCallback(
    (id: string, updates: Partial<KeyFinding>) =>
      updateMutation.mutate({ id, updates }),
    [updateMutation],
  );

  const renameFinding = useCallback(
    (id: string, newTitle: string) =>
      updateMutation.mutate({ id, updates: { title: newTitle } }),
    [updateMutation],
  );

  const clearFindings = useCallback(() => {
    const currentFindings = [...findings];
    const isAuthenticated = useAuthStore.getState().user !== null;

    if (USE_API && isAuthenticated && currentFindings.length > 0) {
      const ids = currentFindings.map((f) => f.id);
      findingsApiClient.bulkDeleteFindings(ids).catch(() => {});
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }

    // Clear cache
    queryClient.setQueryData(
      chatId ? queryKeys.findings.byChatId(chatId) : queryKeys.findings.all,
      [],
    );
  }, [findings, chatId, queryClient]);

  const isFindingSaved = useCallback(
    (content: string) => findings.some((f) => f.content === content),
    [findings],
  );

  const findingsByDate = useMemo(() => groupByDate(findings), [findings]);
  const findingsByConversation = useMemo(
    () => groupByConversation(findings),
    [findings],
  );

  return {
    findings,
    addFinding,
    removeFinding,
    updateFinding,
    renameFinding,
    findingsCount: findings.length,
    findingsByDate,
    findingsByConversation,
    clearFindings,
    isFindingSaved,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.findings.all }),
  };
}
