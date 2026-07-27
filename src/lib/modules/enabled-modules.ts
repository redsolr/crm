"use client";

/**
 * Org-level module gating.
 *
 * The platform stamps each workspace-template's `moduleKey` into
 * `workspace.module_keys` (platform-owned, read-only over the wire).
 * The org's enabled module surfaces are the UNION of `module_keys`
 * across the workspaces the caller can see — a law-firm org
 * (provisioned with the `legal-matter` template) gets the legal rail
 * and never sees Sales; our own org (sales-pipeline template) gets the
 * Sales rail and no matter surfaces. Views not listed in
 * `VIEW_MODULE_REQUIREMENTS` are core — always on for every org.
 *
 * This is a SURFACE decision, not a billing one: every paying tenant
 * still gets every module (bundled model) — module_keys only decides
 * which product surface an org's app renders.
 *
 * Per-user hide/show (Settings → Customization) still applies ON TOP
 * of this gate: a user can hide an enabled view, but no preference can
 * reveal a view whose module the org doesn't have.
 */

import { useMemo } from "react";
import { useAppContextStore } from "@/stores/app-context.store";

export type ModuleKey = "sales" | "legal";

/**
 * View id → module that must be present in the org for the view to
 * exist at all. Views absent from this map are core.
 */
export const VIEW_MODULE_REQUIREMENTS: Record<string, ModuleKey> = {
  // Sales module — founder-led-sales CRM surfaces.
  sales: "sales",
  brief: "sales",
  // Legal module — the law-firm workbench surfaces.
  explorer: "legal",
  communications: "legal",
  "matter-templates": "legal",
  "legal-library": "legal",
  "firm-standards": "legal",
  "legal-workflows": "legal",
};

/** Union of module keys across the given workspaces. */
export function enabledModulesFromWorkspaces(
  workspaces: ReadonlyArray<{ module_keys?: string[] }>,
): Set<string> {
  const modules = new Set<string>();
  for (const ws of workspaces) {
    for (const key of ws.module_keys ?? []) modules.add(key);
  }
  return modules;
}

/**
 * Whether a view is enabled given the org's module set. Core views
 * (not in `VIEW_MODULE_REQUIREMENTS`) are always enabled.
 *
 * An EMPTY module set means the org is ungated — every view shows.
 * Gating only activates once the org carries at least one module key.
 * Real orgs are always templated at provisioning (firms get `legal`,
 * ours gets `sales`), so the demo promise holds where it matters;
 * bare orgs (fresh dev logins, integration-test orgs, pre-backfill
 * rows from before the `module_keys` column existed) keep the full
 * surface instead of collapsing to core-only on deploy.
 */
export function isViewEnabled(
  viewId: string,
  modules: ReadonlySet<string>,
): boolean {
  if (modules.size === 0) return true;
  const required = VIEW_MODULE_REQUIREMENTS[viewId];
  return required === undefined || modules.has(required);
}

/**
 * The org's enabled modules, derived from the already-fetched
 * workspace list in the app-context store. `ready` is false until the
 * boot-time workspace fetch has populated the store — callers should
 * render core-only (never flash a gated surface) until then.
 */
export function useEnabledModules(): {
  modules: Set<string>;
  ready: boolean;
} {
  const workspaces = useAppContextStore((s) => s.workspaces);
  return useMemo(
    () => ({
      modules: enabledModulesFromWorkspaces(workspaces),
      ready: workspaces.length > 0,
    }),
    [workspaces],
  );
}
