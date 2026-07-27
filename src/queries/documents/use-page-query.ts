"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { useAuthStore } from "@/stores/auth.store";
import {
  pagesApi,
  Page,
  CreatePageRequest,
  UpdatePageRequest,
} from "@/lib/pagesApi";

export interface UsePageQueryOptions {
  autoFetch?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export function usePageQuery(
  pageId: string | null,
  options: UsePageQueryOptions = {},
) {
  const { autoFetch = true, autoSave = true, autoSaveDelay = 1000 } = options;
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();

  const [localTitle, setLocalTitle] = useState<string>("");
  const [localContent, setLocalContent] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>("");
  const lastSavedTitleRef = useRef<string>("");

  // Fetch page via TanStack Query
  const pageQuery = useQuery({
    queryKey: queryKeys.pages.detail(pageId || ""),
    queryFn: async () => {
      const response = await pagesApi.getPage(pageId!);
      return response.page;
    },
    enabled: autoFetch && !!pageId && isAuthenticated,
  });

  const page = pageQuery.data ?? null;

  // Sync fetched data to local state
  useEffect(() => {
    if (pageQuery.data) {
      setLocalTitle(pageQuery.data.title);
      setLocalContent(pageQuery.data.content);
      lastSavedTitleRef.current = pageQuery.data.title;
      lastSavedContentRef.current = pageQuery.data.content;
      setIsDirty(false);
    }
  }, [pageQuery.data]);

  // Save page mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdatePageRequest;
    }) => {
      const response = await pagesApi.updatePage(id, updates);
      return response.page;
    },
    onSuccess: (savedPage) => {
      lastSavedTitleRef.current = savedPage.title;
      lastSavedContentRef.current = savedPage.content;
      setIsDirty(false);
      queryClient.setQueryData(queryKeys.pages.detail(savedPage.id), savedPage);
    },
  });

  // Save page
  const savePage = useCallback(async () => {
    if (!pageId || !page) return;

    const titleChanged = localTitle !== lastSavedTitleRef.current;
    const contentChanged = localContent !== lastSavedContentRef.current;

    if (!titleChanged && !contentChanged) {
      setIsDirty(false);
      return;
    }

    setIsSaving(true);
    try {
      const updates: UpdatePageRequest = {};
      if (titleChanged) updates.title = localTitle;
      if (contentChanged) updates.content = localContent;

      await saveMutation.mutateAsync({ id: pageId, updates });
    } catch (err) {
      console.error("[usePageQuery] Error saving page:", err);
    } finally {
      setIsSaving(false);
    }
  }, [pageId, page, localTitle, localContent, saveMutation]);

  // Update title (local)
  const updateTitle = useCallback((title: string) => {
    setLocalTitle(title);
    setIsDirty(true);
  }, []);

  // Update content (local)
  const updateContent = useCallback((content: string) => {
    setLocalContent(content);
    setIsDirty(true);
  }, []);

  // Create page
  const createMutation = useMutation({
    mutationFn: async (request: CreatePageRequest) => {
      const response = await pagesApi.createPage(request);
      return response.page;
    },
    onSuccess: (newPage) => {
      queryClient.setQueryData(queryKeys.pages.detail(newPage.id), newPage);
      queryClient.invalidateQueries({ queryKey: queryKeys.pages.all });
    },
  });

  const createPage = useCallback(
    async (request?: CreatePageRequest): Promise<Page | null> => {
      try {
        const page = await createMutation.mutateAsync(request || {});
        setLocalTitle(page.title);
        setLocalContent(page.content);
        lastSavedTitleRef.current = page.title;
        lastSavedContentRef.current = page.content;
        setIsDirty(false);
        return page;
      } catch (err) {
        console.error("[usePageQuery] Error creating page:", err);
        return null;
      }
    },
    [createMutation],
  );

  // Delete page
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await pagesApi.deletePage(id);
    },
    onSuccess: () => {
      if (pageId) {
        queryClient.removeQueries({ queryKey: queryKeys.pages.detail(pageId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.pages.all });
    },
  });

  const deletePage = useCallback(async (): Promise<boolean> => {
    if (!pageId) return false;
    try {
      await deleteMutation.mutateAsync(pageId);
      setLocalTitle("");
      setLocalContent("");
      setIsDirty(false);
      return true;
    } catch (err) {
      console.error("[usePageQuery] Error deleting page:", err);
      return false;
    }
  }, [pageId, deleteMutation]);

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !isDirty || !pageId) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      savePage();
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSave, isDirty, pageId, autoSaveDelay, savePage]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (isDirty && pageId) {
        savePage();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPage = useCallback(async () => {
    await pageQuery.refetch();
  }, [pageQuery]);

  const setContent = useCallback((content: string) => {
    setLocalContent(content);
  }, []);

  const setTitle = useCallback((title: string) => {
    setLocalTitle(title);
  }, []);

  return {
    page,
    isLoading: pageQuery.isLoading,
    isSaving,
    error: pageQuery.error?.message ?? saveMutation.error?.message ?? null,
    isDirty,
    fetchPage,
    savePage,
    updateTitle,
    updateContent,
    createPage,
    deletePage,
    setContent,
    setTitle,
  };
}

export const usePage = usePageQuery;
export default usePageQuery;
