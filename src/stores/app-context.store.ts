"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Organization } from "@/lib/organizationsApi";
import { Workspace } from "@/lib/workspacesApi";
import { setWorkspaceOverride } from "@/lib/workspace-override";

interface AppContextState {
  organizations: Organization[];
  currentOrganization: Organization | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
}

interface AppContextActions {
  setOrganizations: (orgs: Organization[]) => void;
  setCurrentOrganization: (org: Organization | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppContextStore = create<AppContextState & AppContextActions>()(
  devtools(
    (set) => ({
      organizations: [],
      currentOrganization: null,
      workspaces: [],
      currentWorkspace: null,
      isLoading: true,
      error: null,

      setOrganizations: (organizations) =>
        set({ organizations }, false, "setOrganizations"),
      setCurrentOrganization: (org) => {
        // Workspace selection resets with the org — clear the API-layer
        // override too or requests keep hitting the previous org's
        // workspace and 404 on the tenant check.
        setWorkspaceOverride(null);
        set(
          {
            currentOrganization: org,
            currentWorkspace: null,
            workspaces: [],
          },
          false,
          "setCurrentOrganization",
        );
      },
      setWorkspaces: (workspaces) =>
        set({ workspaces }, false, "setWorkspaces"),
      setCurrentWorkspace: (workspace) => {
        // Every `/api/*` call from now on carries this workspace via the
        // `Jurisimus-Workspace-Id` header (api-discipline § Workspace
        // switcher) — selection without the header only re-points
        // workspace-scoped PATHS, while RLS keeps serving the
        // JWT-bound workspace's rows.
        setWorkspaceOverride(workspace?.id ?? null);
        set({ currentWorkspace: workspace }, false, "setCurrentWorkspace");
      },
      setIsLoading: (isLoading) => set({ isLoading }, false, "setIsLoading"),
      setError: (error) => set({ error }, false, "setError"),
    }),
    { name: "AppContextStore" },
  ),
);
