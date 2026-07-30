/**
 * Shared integration-tier setup for the legal Matters Lab journeys.
 *
 * A fresh workspace has no `matter` work_item_type — the supported way to add
 * it over the wire is `POST /api/workspaces/:id/apply_template { legal-matter }`.
 * Both real-backend specs (the full lawyer journey + the grounded-research spec)
 * provision the same way, so the GET-default-workspace + apply-template dance
 * lives here once. See `docs/handoff/2026-06-10-legal-workbench.md`.
 */

import { type APIRequestContext, expect } from "@playwright/test";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";

export interface WorkspaceRow {
  id: string;
  key: string;
  name?: string;
}

/**
 * Resolve the active (Default) workspace and apply the `legal-matter` template
 * so the `matter` work_item_type + lifecycle exist. Idempotent server-side.
 * Returns the provisioned workspace (its `id` is the prefixed `ws_…`).
 */
export async function provisionLegalWorkspace(
  request: APIRequestContext,
  authHeaders: Record<string, string>,
): Promise<WorkspaceRow> {
  const wsRes = await request.get(`${API_BASE}/api/workspaces`, {
    headers: authHeaders,
  });
  expect(wsRes.ok()).toBeTruthy();
  const { workspaces } = (await wsRes.json()) as { workspaces: WorkspaceRow[] };
  const workspace = workspaces.find((w) => w.key === "DEF") ?? workspaces[0];
  expect(workspace).toBeTruthy();

  const applyRes = await request.post(
    `${API_BASE}/api/workspaces/${workspace.id}/apply_template`,
    { headers: authHeaders, data: { template_key: "legal-matter" } },
  );
  expect(
    applyRes.ok(),
    `apply_template failed: ${applyRes.status()} ${await applyRes.text()}`,
  ).toBeTruthy();
  const applied = (await applyRes.json()) as { work_item_type_keys: string[] };
  expect(applied.work_item_type_keys).toContain("matter");

  return workspace;
}
