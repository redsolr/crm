/**
 * Helper for the FeatureBase Tier 2 specs — creates a public project
 * + a public feature request via the real backend, returns the wire
 * IDs the FE specs need to navigate.
 *
 * Each describe block calls `setupPublicProject` once in `beforeAll`
 * and `teardownPublicProject` in `afterAll` so the dev DB stays
 * clean across runs. The slug is suffixed with PID + timestamp so
 * parallel workers (if ever re-enabled) don't collide.
 */

const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";

export interface PublicProjectFixture {
  /**
   * Wire-form workspace id — `ws_<base58>`. Post workspace-rename arc the
   * `project` primitive was retired; the workspace is the sole grouping +
   * isolation boundary.
   */
  workspaceId: string;
  /** Wire-form organization id — `org_<base58>`. Used for cleanup. */
  organizationId: string;
  /** Slug used in `/r/{slug}` URLs. */
  publicSlug: string;
  /** A pre-seeded feature request — `fr_<base58>`. */
  featureRequestId: string;
  /** The dev-login access token, useful for further authed operations. */
  accessToken: string;
}

interface DevLoginResponse {
  access_token: string;
  user: { id: string };
  organization_id: string;
}
interface WorkspaceListResponse {
  workspaces: Array<{ id: string; key: string; name: string }>;
}
interface FeatureRequestEnvelope {
  feature_request: { id: string };
}

async function devLogin(
  email: string,
  name: string,
): Promise<DevLoginResponse> {
  const res = await fetch(`${API_BASE}/auth/dev/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) throw new Error(`dev/login failed: ${res.status}`);
  return (await res.json()) as DevLoginResponse;
}

async function authedFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Stand up a fresh org + flip its `Default` workspace public + seed an FR.
 *
 * The dev/login flow auto-creates the user's first organization, which
 * auto-provisions ONE `Default` workspace (key `DEF`) seeded with the
 * starter template (task type + workflow). Post workspace-rename arc the
 * `project`/`env` primitives are retired — we resolve that bootstrap
 * workspace, attach a public site + feature-request board to it, and
 * submit one FR through the public surface to give comment tests a
 * parent row.
 */
export async function setupPublicProject(
  workerSuffix: string,
): Promise<PublicProjectFixture> {
  const stamp = Date.now().toString(36);
  const email = `e2e-fb-${workerSuffix}-${stamp}@jurisimus.test`;
  const name = `FB E2E ${workerSuffix} ${stamp}`;
  const login = await devLogin(email, name);
  const accessToken = login.access_token;
  // dev/login auto-provisions a fresh organization for first-time
  // users — its id is returned directly in the response.
  const organizationId = login.organization_id;

  // Resolve the bootstrap `Default` workspace (sole isolation boundary
  // post workspace-rename arc). Org create auto-provisions it with the
  // starter template, so downstream work-item operations have the
  // default `task` type + workflow registered.
  const wsRes = await authedFetch("/v1/workspaces", accessToken);
  if (!wsRes.ok) {
    throw new Error(`list workspaces failed: ${wsRes.status}`);
  }
  const wsBody = (await wsRes.json()) as WorkspaceListResponse;
  const workspace =
    wsBody.workspaces.find((w) => w.key === "DEF") ?? wsBody.workspaces[0];
  if (!workspace) {
    throw new Error("no Default workspace on newly-created org");
  }
  const workspaceId = workspace.id;

  // Public surfaces are backed by `control.sites` (sites are a separate
  // primitive, bound to a workspace). Create a site bound to the
  // bootstrap workspace; the slug is what `/v1/public/{slug}/...`
  // controllers resolve against.
  const publicSlug = `fb-e2e-${workerSuffix}-${stamp}`;
  const siteRes = await authedFetch(
    `/v1/organizations/${organizationId}/sites`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        slug: publicSlug,
        enabled: true,
      }),
    },
  );
  if (!siteRes.ok) {
    throw new Error(
      `create site failed: ${siteRes.status}\nbody: ${await siteRes.text()}`,
    );
  }
  const siteId = ((await siteRes.json()) as { site: { id: string } }).site.id;

  // Attach a feature-request board config to the site so the
  // `/v1/public/{slug}/feature_requests` surface resolves. Without
  // this row the platform 404s with "Site has no
  // feature_request_board attached" (see
  // `FeatureRequestBoardsService.resolvePublicSurfaceOrThrow`).
  const frbcRes = await authedFetch(
    `/v1/sites/${siteId}/feature_request_board`,
    accessToken,
    {
      method: "PUT",
      body: JSON.stringify({
        feedback_workspace_id: workspaceId,
        enabled_surfaces: ["feature_requests", "changelog"],
        allow_anonymous_submissions: true,
        require_turnstile: false,
      }),
    },
  );
  if (!frbcRes.ok) {
    throw new Error(
      `upsert feature_request_board failed: ${frbcRes.status}\nbody: ${await frbcRes.text()}`,
    );
  }

  // Seed an FR via the anonymous public surface so it carries the
  // production code path's `metadata.source='public_surface'` stamp.
  const frRes = await fetch(
    `${API_BASE}/v1/public/${publicSlug}/feature_requests`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "E2E seed feature request",
        description:
          "Seeded by featurebase-setup.ts to give comment specs a row to attach to.",
      }),
    },
  );
  if (!frRes.ok) {
    throw new Error(
      `seed feature request failed: ${frRes.status}\nbody: ${await frRes.text()}`,
    );
  }
  const featureRequestId = ((await frRes.json()) as FeatureRequestEnvelope)
    .feature_request.id;

  return {
    workspaceId,
    organizationId,
    publicSlug,
    featureRequestId,
    accessToken,
  };
}

/**
 * Tear down the org from `setupPublicProject`. The org cascade
 * cleans up project + work_items + comments.
 */
export async function teardownPublicProject(
  fixture: PublicProjectFixture,
): Promise<void> {
  await authedFetch(
    `/v1/organizations/${fixture.organizationId}`,
    fixture.accessToken,
    { method: "DELETE" },
  );
}
