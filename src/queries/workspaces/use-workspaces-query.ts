"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  workspacesApiClient,
  type CreateWorkspaceRequest,
  type UpdateWorkspaceRequest,
  type Workspace,
} from "@/lib/workspacesApi";
import { queryKeys } from "../query-keys";

export function useWorkspacesQuery(enabled = true) {
  return useQuery<Workspace[]>({
    queryKey: queryKeys.workspaces.all,
    queryFn: () => workspacesApiClient.list(),
    enabled,
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWorkspaceRequest) =>
      workspacesApiClient.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.all,
      });
    },
  });
}

export function useUpdateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      body,
    }: {
      workspaceId: string;
      body: UpdateWorkspaceRequest;
    }) => workspacesApiClient.update(workspaceId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.all,
      });
    },
  });
}

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => workspacesApiClient.remove(workspaceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.all,
      });
    },
  });
}
