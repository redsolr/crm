import type { Workspace } from "@/lib/workspacesApi";

/** CRM workspaces = the per-product GTM containers (ADR-001). The org's
 *  other workspaces (the Jurisimus app's `Legal`, `Default`, …) hold
 *  product data, not pipeline data — they never appear in this app. */
export function isCrmWorkspace(w: Workspace): boolean {
  return (w.module_keys ?? []).includes("sales");
}
