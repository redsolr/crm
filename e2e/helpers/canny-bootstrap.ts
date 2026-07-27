/**
 * Acme Corp bootstrap helper for the PaaS three-tab Playwright spec.
 *
 * Lifted from `platform/scripts/canny-customer-0.ts` (the original
 * canny walkthrough automation). The shape mirrors that script step-
 * for-step so debugging against the canny stdout transcript stays a
 * straight read across.
 *
 * MIRRORING — when the canny script grows a new step (or changes the
 * shape of an existing one), this helper must change in lockstep. The
 * two are intentionally siblings, not a CLI fork; the shared shape is
 * the contract every CI run + every dev runbook depends on.
 *
 * IDEMPOTENCE — the helper is safe to call from `beforeAll` of every
 * spec run, on a fresh DB or a previously-bootstrapped one:
 *   - dev-login reuses the account if it exists
 *   - org-create only fires when dev-login returns no primary membership
 *     (org-create auto-provisions the `Default` workspace server-side)
 *   - api-key: ROTATES when one exists (to recover a raw `ak_*` token,
 *     since raw tokens only surface on POST + :rotate); otherwise mints a
 *     fresh one bound to the `Default` workspace
 *   - site / FRBC: list-then-create / list-then-PUT
 *   - feature-request seeding: tops up to 3 if any of the seed titles
 *     are missing
 *
 * The api-key rotation behavior is the one place this diverges from the
 * canny script (which leaves an existing key alone and tells the
 * operator to rotate manually). For an automated spec we MUST end with
 * a usable raw token, so rotation-on-reuse is the right tradeoff —
 * previous tokens are invalidated, which is a non-issue for a CI/E2E
 * run that holds no long-lived state.
 *
 * The helper uses raw `fetch` rather than a Playwright
 * `APIRequestContext` on purpose: a Playwright context has a sticky
 * cookie jar, which means after `/auth/dev/login` the `access_token`
 * cookie sticks around. CsrfMiddleware then treats every subsequent
 * mutation as a cookie-auth request and demands an `X-CSRF-Token`
 * header — even when the request also carries `Authorization: Bearer`.
 * Raw `fetch` has no jar, so the bootstrap stays purely Bearer-auth
 * (the documented S2S-exempt path).
 */

const DEFAULT_BASE_URL = "http://localhost:8080";
const OWNER_EMAIL = "owner@acme.test";
const OWNER_NAME = "Ace Owner";
const ORG_NAME = "Acme Corp";
const SITE_SLUG = "acme";
// Distinct from the canny CLI script's `acme-ci-bot` (manual runbook
// key) so the spec rotating-on-reuse doesn't invalidate a raw token a
// developer just copied off `bun run canny:customer-0`.
const API_KEY_NAME = "acme-e2e-bot";
const SEED_TITLES = ["Dark mode", "Slack integration", "Mobile app"];

export interface AcmeSeed {
  organizationId: string;
  /**
   * Bootstrap `Default` workspace (post workspace-rename arc). The
   * retired `project`/`env` primitives are gone — the workspace is the
   * sole grouping + isolation boundary, bound on the owner's JWT.
   */
  workspaceId: string;
  siteId: string;
  siteSlug: string;
  ownerEmail: string;
  ownerAccessToken: string;
  /** Raw `ak_*` token, freshly minted or rotated on this call. */
  apiKeyToken: string;
  apiKeyId: string;
  seededFeatureRequestTitles: ReadonlyArray<string>;
}

interface DevLoginResponse {
  user: { id: string; email: string; full_name: string | null };
  organization_id?: string;
  organization_name?: string;
  access_token: string;
}

interface OrganizationSignupResponse {
  organization: { id: string; name: string };
}

interface WorkspaceListResponse {
  workspaces: Array<{ id: string; key: string; name: string }>;
}

interface ApiKeyEnvelope {
  id: string;
  workspace_id: string;
  name: string;
  token_prefix: string;
  token_last4: string;
  /** Raw key — populated only on POST /v1/api_keys + :rotate. */
  token?: string;
}

interface SiteListResponse {
  data: Array<{ id: string; slug: string; workspace_id: string }>;
  has_more: boolean;
}

interface SiteEnvelope {
  site: { id: string; slug: string; workspace_id: string };
}

interface PublicFeatureRequestListResponse {
  data: Array<{ id: string; title: string }>;
}

async function expectOk(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  init?: { token?: string; body?: unknown; expectStatus?: number[] }
): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  if (init?.token) {
    headers.Authorization = `Bearer ${init.token}`;
  }
  const reqInit: RequestInit = { method, headers };
  if (init?.body !== undefined) reqInit.body = JSON.stringify(init.body);

  const res = await fetch(url, reqInit);
  const status = res.status;
  const ok = (init?.expectStatus ?? [200, 201, 202, 204]).includes(status);
  const text = await res.text();
  let parsed: unknown = null;
  if (text !== "") {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!ok) {
    throw new Error(
      `[canny-bootstrap] ${method} ${url} → HTTP ${status}\n` +
        `body: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`
    );
  }
  return parsed;
}

export async function bootstrapAcme(
  baseUrl: string = DEFAULT_BASE_URL
): Promise<AcmeSeed> {
  const base = baseUrl.replace(/\/$/, "");

  await expectOk("GET", `${base}/health`);

  let login = (await expectOk("POST", `${base}/auth/dev/login`, {
    body: { email: OWNER_EMAIL, name: OWNER_NAME },
  })) as DevLoginResponse;
  let accessToken = login.access_token;
  let organizationId = login.organization_id;

  if (organizationId === undefined) {
    (await expectOk("POST", `${base}/v1/organizations`, {
      body: {
        name: ORG_NAME,
        owner_email: OWNER_EMAIL,
        owner_full_name: OWNER_NAME,
        billing_email: "billing@acme.test",
      },
    })) as OrganizationSignupResponse;
    login = (await expectOk("POST", `${base}/auth/dev/login`, {
      body: { email: OWNER_EMAIL, name: OWNER_NAME },
    })) as DevLoginResponse;
    accessToken = login.access_token;
    organizationId = login.organization_id;
    if (organizationId === undefined) {
      throw new Error(
        "[canny-bootstrap] dev-login after org-register still has no organization_id"
      );
    }
  }

  // Post workspace-rename arc: bootstrap auto-creates ONE workspace
  // named `Default` (key `DEF`) per signup. There is no `/v1/projects`
  // and no per-project env — the workspace is the sole grouping +
  // isolation boundary, bound on the owner's JWT.
  const workspacesList = (await expectOk("GET", `${base}/v1/workspaces`, {
    token: accessToken,
  })) as WorkspaceListResponse;
  if (workspacesList.workspaces.length === 0) {
    throw new Error(
      "[canny-bootstrap] GET /v1/workspaces returned no rows — bootstrapTenantRows regression"
    );
  }
  const workspace =
    workspacesList.workspaces.find((w) => w.key === "DEF") ??
    workspacesList.workspaces[0];

  const existingKeys = (await expectOk("GET", `${base}/v1/api_keys`, {
    token: accessToken,
  })) as ApiKeyEnvelope[];
  const existingKey = existingKeys.find(
    (k) => k.name === API_KEY_NAME && k.workspace_id === workspace.id
  );

  let apiKey: ApiKeyEnvelope;
  if (existingKey === undefined) {
    apiKey = (await expectOk("POST", `${base}/v1/api_keys`, {
      token: accessToken,
      body: { workspace_id: workspace.id, name: API_KEY_NAME },
      expectStatus: [200, 201],
    })) as ApiKeyEnvelope;
  } else {
    apiKey = (await expectOk(
      "POST",
      `${base}/v1/api_keys/${existingKey.id}:rotate`,
      { token: accessToken, body: {}, expectStatus: [200, 201] }
    )) as ApiKeyEnvelope;
  }
  if (!apiKey.token) {
    throw new Error(
      "[canny-bootstrap] api-key response carried no raw token — rotation/mint regression"
    );
  }

  const sites = (await expectOk(
    "GET",
    `${base}/v1/organizations/${organizationId}/sites`,
    { token: accessToken }
  )) as SiteListResponse;
  let site = sites.data.find((s) => s.slug === SITE_SLUG);
  if (site === undefined) {
    const created = (await expectOk(
      "POST",
      `${base}/v1/organizations/${organizationId}/sites`,
      {
        token: accessToken,
        body: { workspace_id: workspace.id, slug: SITE_SLUG, enabled: true },
        expectStatus: [200, 201],
      }
    )) as SiteEnvelope;
    site = {
      id: created.site.id,
      slug: created.site.slug,
      workspace_id: created.site.workspace_id,
    };
  }

  await expectOk("PUT", `${base}/v1/sites/${site.id}/feature_request_board`, {
    token: accessToken,
    body: {
      feedback_workspace_id: workspace.id,
      enabled_surfaces: ["feature_requests", "changelog"],
      allow_anonymous_submissions: true,
      require_turnstile: false,
      visible_state_categories: ["not_started", "active", "done"],
    },
    expectStatus: [200, 201],
  });

  const existingFrs = (await expectOk(
    "GET",
    `${base}/v1/public/${SITE_SLUG}/feature_requests?page_size=10`
  )) as PublicFeatureRequestListResponse;
  const existingTitles = new Set(existingFrs.data.map((f) => f.title));
  const toSeed = SEED_TITLES.filter((t) => !existingTitles.has(t));
  await Promise.all(
    toSeed.map((title) =>
      expectOk("POST", `${base}/v1/public/${SITE_SLUG}/feature_requests`, {
        body: { title },
        expectStatus: [200, 201],
      })
    )
  );

  return {
    organizationId,
    workspaceId: workspace.id,
    siteId: site.id,
    siteSlug: SITE_SLUG,
    ownerEmail: OWNER_EMAIL,
    ownerAccessToken: accessToken,
    apiKeyToken: apiKey.token,
    apiKeyId: apiKey.id,
    seededFeatureRequestTitles: SEED_TITLES,
  };
}
