"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "../query-keys";
import { fileSystemApi, FileNode } from "@/lib/fileSystemApi";
import { useAuthStore } from "@/stores/auth.store";

export interface UseFoldersQueryOptions {
  includeArchived?: boolean;
  enabled?: boolean;
}

export function useFoldersQuery(options: UseFoldersQueryOptions = {}) {
  const { includeArchived = false, enabled = true } = options;
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const queryClient = useQueryClient();

  const nodesQuery = useQuery({
    queryKey: queryKeys.fileSystem.nodes(
      includeArchived ? "archived" : "active",
    ),
    queryFn: async () => {
      const response = await fileSystemApi.getNodes(includeArchived);
      return response.data.filter((node) => node.type === "folder");
    },
    enabled: enabled && isAuthenticated,
  });

  const treeQuery = useQuery({
    queryKey: queryKeys.fileSystem.tree(
      includeArchived ? "archived" : "active",
    ),
    queryFn: async () => {
      const response = await fileSystemApi.getTree(includeArchived);
      return response.tree;
    },
    enabled: false, // Only fetched on demand via fetchTree
  });

  const createMutation = useMutation({
    mutationFn: async ({
      name,
      parent_id,
    }: {
      name: string;
      parent_id?: string;
    }) => {
      const { folder } = await fileSystemApi.createFolder({ name, parent_id });
      return folder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fileSystem.all });
    },
  });

  const folders = useMemo(() => nodesQuery.data ?? [], [nodesQuery.data]);
  const tree = treeQuery.data ?? [];

  const fetchTree = () => treeQuery.refetch();

  const createFolder = async (
    name: string,
    parent_id?: string,
  ): Promise<FileNode | null> => {
    try {
      return await createMutation.mutateAsync({ name, parent_id });
    } catch (err) {
      console.error("[files/folders] failed to create folder", err);
      return null;
    }
  };

  const getFolderById = useCallback(
    (id: string): FileNode | undefined => folders.find((f) => f.id === id),
    [folders],
  );

  const getRootFolders = useCallback(
    (): FileNode[] => folders.filter((f) => !f.parent_id),
    [folders],
  );

  const getChildFolders = useCallback(
    (parent_id: string): FileNode[] =>
      folders.filter((f) => f.parent_id === parent_id),
    [folders],
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.fileSystem.all });

  return {
    folders,
    tree,
    isLoading: nodesQuery.isLoading,
    error: nodesQuery.error?.message ?? null,
    fetchFolders: refresh,
    fetchTree,
    createFolder,
    getFolderById,
    getRootFolders,
    getChildFolders,
    refresh,
  };
}
