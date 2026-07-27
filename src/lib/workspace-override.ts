/**
 * Current-workspace override for the API layer.
 *
 * The platform binds a workspace on the JWT at login; every other
 * workspace is reached by stamping `Jurisimus-Workspace-Id` on the
 * request (api-discipline.md § Workspace switcher). The CRM's sidebar
 * switcher selects among per-product workspaces (ADR-001), so the
 * BaseApiClient stamps this on every `/v1/*` call.
 *
 * A mutable module (not the Zustand store) so `api-client.ts` can read
 * it without importing the app-context store — the store's type
 * imports reach back into API modules and would cycle.
 */

let currentWorkspaceId: string | null = null;

export function setWorkspaceOverride(id: string | null): void {
  currentWorkspaceId = id;
}

export function getWorkspaceOverride(): string | null {
  return currentWorkspaceId;
}
