"use client";

import { useEffect } from "react";
import { useAppContextStore } from "./app-context.store";
import { useAuthStore } from "./auth.store";
import { useOrganizationsQuery } from "@/queries/workspace/use-organizations-query";
import { useWorkspacesQuery } from "@/queries/workspaces/use-workspaces-query";
import { accountApiClient } from "@/lib/accountApi";
import { authService } from "@/lib/authTokenManager";
import { useShallow } from "zustand/react/shallow";

/**
 * Drop-in replacement for the old useAppContext() context hook.
 * Combines Zustand store (selection state) with React Query (data fetching + cache).
 *
 * Organizations and workspaces are fetched via React Query — cached,
 * deduplicated, and never re-fetched on tab switches unless stale.
 * `currentWorkspace` is the single grouping the app threads into board /
 * backlog / views / queries (the `project` primitive was retired).
 */
export function useAppContext() {
  const store = useAppContextStore(
    useShallow((s) => ({
      currentOrganization: s.currentOrganization,
      currentWorkspace: s.currentWorkspace,
    })),
  );

  const setCurrentOrganizationStore = useAppContextStore(
    (s) => s.setCurrentOrganization,
  );
  const setCurrentWorkspace = useAppContextStore((s) => s.setCurrentWorkspace);

  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const isAuthenticated = user !== null;

  // Fetch organizations via React Query (cached, deduplicated)
  const orgsQuery = useOrganizationsQuery({
    enabled: !authLoading && isAuthenticated,
  });

  const workspacesQuery = useWorkspacesQuery(
    !authLoading && isAuthenticated && !!store.currentOrganization,
  );

  // Sync React Query data → Zustand store (for components that read from store)
  // CRITICAL invariant: the auto-selected `currentOrganization` MUST match
  // the JWT-bound `organization_id`. Otherwise tenant-scoped reads
  // (workspaces, work items, etc.) 404 with `ORGANIZATION_NOT_FOUND` because
  // the BE defense-in-depth-checks `targetOrganizationId === requireOrganizationId(user)`.
  // If the user owns multiple orgs, picking `[0]` from the listing may
  // disagree with the JWT — that mismatch surfaced as a 404 spam on every
  // /chat reload. JWT is the source of truth; the store mirrors it. Switching
  // org is an explicit action that re-mints the JWT (`setCurrentOrganization`
  // → POST /accounts/me:switch_organization).
  useEffect(() => {
    if (orgsQuery.organizations.length === 0) return;
    useAppContextStore.getState().setOrganizations(orgsQuery.organizations);

    const jwtOrgId = user?.organization_id;
    const jwtBound = jwtOrgId
      ? orgsQuery.organizations.find((o) => o.id === jwtOrgId)
      : undefined;

    if (!store.currentOrganization) {
      useAppContextStore.setState({
        currentOrganization: jwtBound ?? orgsQuery.organizations[0],
      });
      return;
    }

    // Defensive re-sync: if the store drifted from the JWT (stale state on
    // a fresh tab, a switch that only updated one side, etc.), correct
    // back to the JWT-bound row. Skip when the JWT carries no org id —
    // the user is mid-onboarding and the store's selection is fine.
    if (jwtBound && store.currentOrganization.id !== jwtBound.id) {
      useAppContextStore.setState({ currentOrganization: jwtBound });
    }
  }, [orgsQuery.organizations, store.currentOrganization, user?.organization_id]);

  // Workspace selection — the JWT's bound workspace_id is server-side; the
  // FE just needs SOME workspace to display. Default to the first one
  // returned (post-rename bootstrap creates one `Default` workspace per org).
  useEffect(() => {
    if (!store.currentOrganization) return;

    const workspaces = workspacesQuery.data ?? [];
    const ws = useAppContextStore.getState();
    ws.setWorkspaces(workspaces);

    if (workspaces.length > 0 && !ws.currentWorkspace) {
      ws.setCurrentWorkspace(workspaces[0]);
    } else if (ws.currentWorkspace) {
      const stillExists = workspaces.find(
        (w) => w.id === ws.currentWorkspace!.id,
      );
      if (!stillExists && workspaces.length > 0) {
        ws.setCurrentWorkspace(workspaces[0]);
      } else if (!stillExists) {
        ws.setCurrentWorkspace(null);
      }
    }
  }, [workspacesQuery.data, store.currentOrganization]);

  const setCurrentOrganization = async (
    org: NonNullable<typeof store.currentOrganization>,
  ) => {
    if (org.id === store.currentOrganization?.id) return;

    try {
      const switched = await accountApiClient.switchOrganization(org.id);
      // BE rotates access + refresh + csrf cookies on the response.
      // We still record `backendToken` in the auth store so code paths
      // that check `useAuthStore.getState().backendToken` after the
      // exchange see a value, but no localStorage mirror.
      authService.invalidateAuthState();
      useAuthStore.getState().setBackendToken(switched.access_token);
      const currentUser = useAuthStore.getState().user;
      useAuthStore.getState().setUser({
        ...(currentUser ?? {
          user_id: switched.user.id,
          email: switched.user.email,
        }),
        user_id: switched.user.id,
        email: switched.user.email,
        full_name: switched.user.full_name ?? currentUser?.full_name,
        avatar_url: switched.user.avatar_url ?? currentUser?.avatar_url,
        account_id: switched.user.id,
        organization_id: switched.organization_id,
        organization_name: switched.organization_name,
        role: switched.role,
        roles: switched.role ? [switched.role] : currentUser?.roles,
      });
    } catch (error) {
      console.error("[useAppContext] organization switch failed:", error);
      throw error;
    }

    setCurrentOrganizationStore(org);
  };

  const isLoading = orgsQuery.isLoading || workspacesQuery.isLoading;
  const error = orgsQuery.error;

  return {
    organizations: orgsQuery.organizations,
    currentOrganization: store.currentOrganization,
    workspaces: workspacesQuery.data ?? [],
    currentWorkspace: store.currentWorkspace,
    isLoading,
    error,
    setCurrentOrganization,
    setCurrentWorkspace,
    refreshOrganizations: orgsQuery.refresh,
  };
}
