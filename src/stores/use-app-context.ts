"use client";

import { useEffect } from "react";
import { useAppContextStore } from "./app-context.store";
import { useAuthStore } from "./auth.store";
import { useWorkspacesQuery } from "@/queries/workspaces/use-workspaces-query";
import { useShallow } from "zustand/react/shallow";

/**
 * Drop-in replacement for the old useAppContext() context hook.
 * Combines Zustand store (selection state) with React Query (data fetching + cache).
 *
 * Single-tenant standalone shape (2026-07-31): this app serves its own
 * backend with one constant workspace (`STUB_WORKSPACE`), so there is no
 * organizations listing and no org switching — the workspaces query IS
 * the bootstrap. The platform-era chain (list orgs → pick org → only then
 * enable the workspace fetch) is gone: with the `/api/organizations`
 * endpoint removed it dead-locked the shell (organizations stayed empty
 * forever → the workspace query never enabled → every view waited on a
 * context that could not resolve).
 *
 * `currentWorkspace` is the single grouping the app threads into board /
 * backlog / views / queries (the `project` primitive was retired).
 */
export function useAppContext() {
  const currentWorkspace = useAppContextStore(
    useShallow((s) => s.currentWorkspace),
  );
  const setCurrentWorkspace = useAppContextStore((s) => s.setCurrentWorkspace);

  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const isAuthenticated = user !== null;

  const workspacesQuery = useWorkspacesQuery(!authLoading && isAuthenticated);

  // Workspace selection — single-tenant: default to the first (only)
  // workspace returned; re-sync the store when the list refreshes.
  useEffect(() => {
    const workspaces = workspacesQuery.data ?? [];
    if (workspaces.length === 0) return;

    const ws = useAppContextStore.getState();
    ws.setWorkspaces(workspaces);

    if (!ws.currentWorkspace) {
      ws.setCurrentWorkspace(workspaces[0]);
      return;
    }
    const stillExists = workspaces.some(
      (w) => w.id === ws.currentWorkspace!.id,
    );
    if (!stillExists) {
      ws.setCurrentWorkspace(workspaces[0]);
    }
  }, [workspacesQuery.data]);

  return {
    workspaces: workspacesQuery.data ?? [],
    currentWorkspace,
    isLoading: workspacesQuery.isLoading,
    error: workspacesQuery.error,
    setCurrentWorkspace,
  };
}
