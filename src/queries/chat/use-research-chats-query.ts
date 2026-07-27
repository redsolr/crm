"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { useAuthStore } from "@/stores/auth.store";
import { useChatNavigationStore } from "@/stores/chat-navigation.store";
import { getChatHistory, chatApiClient, ChatResponse } from "@/lib/chatApi";

export interface ResearchChat {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  findingsCount: number;
  parentChatId?: string | null;
  branchName?: string | null;
  starred?: boolean;
}

function transformChatResponse(chat: ChatResponse): ResearchChat {
  return {
    id: chat.id,
    title:
      chat.title || `Chat ${new Date(chat.created_at).toLocaleDateString()}`,
    created_at: new Date(chat.created_at),
    updated_at: new Date(chat.updated_at),
    findingsCount: chat.findingsCount,
    parentChatId: chat.parentChatId,
    branchName: chat.branchName,
    starred: chat.starred,
  };
}

export function useResearchChatsQuery() {
  const account_id = useAuthStore((s) => s.user?.account_id);
  const queryClient = useQueryClient();
  const activeChatId = useChatNavigationStore((s) => s.activeChatId);
  const navigateToChat = useChatNavigationStore((s) => s.navigateToChat);
  const navigateToNewChat = useChatNavigationStore((s) => s.navigateToNewChat);

  const query = useQuery({
    queryKey: queryKeys.researchChats.list(),
    queryFn: async () => {
      const response = await getChatHistory({ limit: 50 });
      return response.chats.map(transformChatResponse);
    },
    enabled: !!account_id,
  });

  const chats = useMemo(() => query.data ?? [], [query.data]);

  // Rename chat mutation
  const renameMutation = useMutation({
    mutationFn: async ({
      chatId,
      newTitle,
    }: {
      chatId: string;
      newTitle: string;
    }) => {
      await chatApiClient.updateChatTitle(chatId, newTitle);
      return { chatId, newTitle };
    },
    onMutate: async ({ chatId, newTitle }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.researchChats.all,
      });
      const previous = queryClient.getQueryData<ResearchChat[]>(
        queryKeys.researchChats.list(),
      );

      queryClient.setQueryData<ResearchChat[]>(
        queryKeys.researchChats.list(),
        (old) =>
          old?.map((chat) =>
            chat.id === chatId
              ? { ...chat, title: newTitle, updated_at: new Date() }
              : chat,
          ),
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.researchChats.list(),
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.researchChats.all });
    },
  });

  // Delete chat mutation
  const deleteMutation = useMutation({
    mutationFn: async (chatId: string) => {
      await chatApiClient.deleteChat(chatId);
      return chatId;
    },
    onMutate: async (chatId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.researchChats.all,
      });
      const previous = queryClient.getQueryData<ResearchChat[]>(
        queryKeys.researchChats.list(),
      );

      queryClient.setQueryData<ResearchChat[]>(
        queryKeys.researchChats.list(),
        (old) => old?.filter((chat) => chat.id !== chatId),
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.researchChats.list(),
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.researchChats.all });
    },
  });

  const renameChat = useCallback(
    async (chatId: string, newTitle: string) => {
      try {
        await renameMutation.mutateAsync({ chatId, newTitle });
      } catch (err) {
        console.error("[useResearchChatsQuery] Error renaming chat:", err);
      }
    },
    [renameMutation],
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      try {
        await deleteMutation.mutateAsync(chatId);
      } catch (err) {
        console.error("[useResearchChatsQuery] Error deleting chat:", err);
      }
    },
    [deleteMutation],
  );

  // Add a new chat to the cache (called when backend creates a chat)
  const addChat = useCallback(
    (chatId: string, title?: string, parentChatId?: string | null) => {
      const now = new Date();
      const newChat: ResearchChat = {
        id: chatId,
        title: title || `Chat ${now.toLocaleDateString()}`,
        created_at: now,
        updated_at: now,
        findingsCount: 0,
        parentChatId: parentChatId || null,
      };

      queryClient.setQueryData<ResearchChat[]>(
        queryKeys.researchChats.list(),
        (old) => {
          if (old?.some((c) => c.id === chatId)) return old;
          return [newChat, ...(old ?? [])];
        },
      );

      return newChat;
    },
    [queryClient],
  );

  // The active chat is derived from the URL-backed nav store — there is only
  // ever one source of truth, regardless of how many places call this hook.
  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId],
  );

  const fetchChats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.researchChats.all });
  }, [queryClient]);

  // Chats grouped by date
  const chatsByDate = useMemo(() => {
    return chats.reduce<Record<string, ResearchChat[]>>((acc, chat) => {
      const dateKey = chat.updated_at.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(chat);
      return acc;
    }, {});
  }, [chats]);

  return {
    chats,
    chatsByDate,
    activeChat,
    isLoading: query.isLoading,
    isLoaded: !query.isLoading && query.isFetched,
    error: query.error?.message ?? null,
    fetchChats,
    renameChat,
    deleteChat,
    selectChat: navigateToChat,
    clearActiveChat: navigateToNewChat,
    addChat,
  };
}
