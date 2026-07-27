/**
 * Tier 2: Integration fixture — hits real backend via Docker Compose.
 *
 * Prerequisites:
 *   - Backend running at localhost:8080 (cd platform && bun run docker:up && bun run start:dev)
 *   - Backend in development mode (NODE_ENV=development) for /auth/dev/login
 *   - LLM_MOCK_ENABLED=true in backend .env.local for deterministic AI responses
 *
 * Auth strategy (post-cookie-migration, 2026-05-09):
 *   - Calls POST /auth/dev/login via the Playwright BrowserContext's
 *     APIRequestContext (`context.request.post(...)`). Playwright shares
 *     a cookie jar between the API request context and the browser
 *     context (per the official docs), so the BE's `Set-Cookie` lines
 *     for `access_token` (HttpOnly), `refresh_token` (HttpOnly), and
 *     `jurisimus_csrf` (JS-readable) land directly on the browser.
 *     The first `page.goto(...)` then carries those cookies — no
 *     manual injection step needed.
 *   - The dev-login response body still carries the snake_case
 *     `{ access_token, refresh_token, ... }` triple for non-browser
 *     callers; we keep `accessToken` on the `testUser` fixture so
 *     existing specs that hit the BE with a raw `Authorization: Bearer`
 *     header (full-stack.integration.spec.ts) keep working unchanged.
 *     Bearer-auth requests are exempt from CSRF — they're not browser-
 *     form-postable, so the middleware skips them entirely.
 *   - User-PROFILE data (display name, role, permissions) is hydrated
 *     into the Zustand auth store via the `e2e-auth-user` localStorage
 *     key, which `E2EAuthInit` reads on mount. This is profile data,
 *     not auth credentials — separate concern from cookies.
 *   - The old `friendly_fortnight_token` localStorage key is gone;
 *     the FE no longer reads it after the cookie migration.
 *   - No route mocking — all API calls hit the real backend.
 */

import { test as base, type Page, expect } from "@playwright/test";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";

interface DevLoginResponse {
  success: true;
  user: { id: string; email: string; full_name: string | null };
  organization_id?: string;
  organization_name?: string;
  role?: string;
  needs_onboarding: boolean;
  needs_profile_setup: boolean;
  // The body still carries tokens for non-browser callers (smoke,
  // mobile, raw-Bearer specs). Browser callers ignore these; cookies
  // are the transport.
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface TestUser {
  /** Raw access JWT — for specs that hit the BE with `Authorization: Bearer`. */
  accessToken: string;
  /** Raw refresh JWT — same use-case as accessToken. */
  refreshToken: string;
  userId: string;
  email: string;
  fullName: string;
  /**
   * Same as `userId`. Kept as a separate field for backward compat
   * with specs that pre-date the rename (`account_id` → `user_id`).
   */
  accountId: string;
  /**
   * Resolved active org id (`org_*`). Required by the FE's auth store
   * (`AuthUser.organization_id`) — without it, hooks like
   * `useChatPermissions` short-circuit on a missing tenant context
   * and surface "user not fully authenticated yet."
   */
  organizationId: string | undefined;
  organizationName: string;
  /**
   * Free-form display name for the active org. Mirrors
   * `organizationName` for backward compat with specs that read
   * `testUser.accountName`.
   */
  accountName: string;
  role: string;
  needsOnboarding: boolean;
}

export const test = base.extend<{
  /** Authenticated page connected to real backend (cookies + Zustand hydrated). */
  integrationPage: Page;
  /** The test user's auth info — raw tokens kept for `Authorization: Bearer` specs. */
  testUser: TestUser;
  /**
   * Dev-login email for the test user. Defaults to a stable per-worker
   * address (shared across runs — find-or-create by email). Specs that
   * MUTATE their tenant in a way that would pollute sibling specs (e.g.
   * the Matters Lab journey applies a workspace template that adds/repoints
   * work-item-types) override this with a unique address via
   * `test.use({ testUserEmail: ... })` so they get a fresh, isolated tenant.
   */
  testUserEmail: string;
}>({
  testUserEmail: [
    async ({}, use, testInfo) => {
      await use(`e2e-worker-${testInfo.workerIndex}@jurisimus.test`);
    },
    { option: true },
  ],
  testUser: async ({ context, testUserEmail }, use) => {
    // Per-worker email avoids rate-limiting on the dev-login surface
    // when the Playwright config bumps workers > 1.
    const email = testUserEmail;
    const name = `E2E ${email}`;

    // `context.request.post(...)` shares the cookie jar with the
    // browser context — the BE's `Set-Cookie` headers on this
    // response land directly on the page's cookies.
    const response = await context.request.post(`${API_BASE}/auth/dev/login`, {
      data: { email, name },
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `dev-login failed (${response.status()}): ${body}. ` +
          `Is the backend up at ${API_BASE} with NODE_ENV=development?`,
      );
    }

    const data = (await response.json()) as DevLoginResponse;

    const orgName = data.organization_name ?? "";
    const user: TestUser = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userId: data.user.id,
      email: data.user.email,
      fullName: data.user.full_name ?? name,
      accountId: data.user.id,
      organizationId: data.organization_id,
      organizationName: orgName,
      accountName: orgName,
      role: data.role ?? "owner",
      needsOnboarding: data.needs_onboarding,
    };

    await use(user);
  },

  integrationPage: async ({ page, testUser }, use) => {
    // Cookies are already on `page.context()` from `testUser`'s
    // `context.request.post('/auth/dev/login')` — Playwright shares
    // the jar. We only need to seed the user-PROFILE data the Zustand
    // store renders, which `E2EAuthInit` reads from this localStorage
    // key on first mount.
    await page.addInitScript((userData) => {
      localStorage.setItem("e2e-auth-user", JSON.stringify(userData));
    }, {
      user_id: testUser.userId,
      email: testUser.email,
      full_name: testUser.fullName,
      account_id: testUser.accountId,
      account_name: testUser.accountName,
      // `organization_id` is the active-tenant claim every tenant-
      // scoped FE hook reads (`useChatPermissions`,
      // `validatePermission`, the env switcher, etc.). Without it
      // the hooks short-circuit on "user not fully authenticated
      // yet" — the localStorage seed must include it.
      organization_id: testUser.organizationId,
      organization_name: testUser.organizationName,
      role: testUser.role,
      roles: [testUser.role],
      permissions: [],
    });

    await use(page);
  },
});

export { expect };
