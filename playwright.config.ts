import { defineConfig, devices } from "@playwright/test";

/**
 * Two-tier E2E testing strategy:
 *
 * Tier 1 — Mocked (default): All API calls intercepted via page.route().
 *   Fast, deterministic, no backend needed. Runs on every PR.
 *   Files: e2e/*.spec.ts (excludes *.integration.spec.ts)
 *   Run: npm run test:e2e
 *
 * Tier 2 — Integration: Hits real backend (Docker Compose).
 *   Tests critical user journeys end-to-end. Runs pre-deploy/nightly.
 *   Files: e2e/*.integration.spec.ts
 *   Requires: Backend at localhost:8080 with LLM_MOCK_ENABLED=true
 *   Run: npm run test:e2e:integration
 *
 * Mock auth:
 *   `MOCK_AUTH=true` (server-only env var) bypasses WorkOS auth:
 *     1. proxy.ts — disables middlewareAuth (no redirect to login)
 *     2. layout.tsx — mounts MockAuthInit instead of AuthKitProvider
 *   Server-only var — no `.next` cache issues, no client bundle leakage.
 *
 * Server:
 *   `reuseExistingServer: false` (since 2026-06-12) — every run boots its
 *   own dev server with mock auth and owns :3000 for its duration. Reuse
 *   had TWO failure modes, both observed in the wild:
 *     1. A dev server started without MOCK_AUTH gets reused and every
 *        test shows the Sign In page.
 *     2. Back-to-back runs: Windows process-tree kill can orphan the
 *        previous run's next-server child, which keeps listening on
 *        :3000 for a while. The next run adopted that zombie, which then
 *        died mid-suite — mass `ERR_CONNECTION_REFUSED` / "Stream
 *        connection error: network error" failures that looked like
 *        backend SSE flake (2026-06-12 incident).
 *   The `pretest:e2e*` npm hooks run `e2e/scripts/ensure-port-free.mjs`,
 *   which kills whatever holds :3000 first — with reuse off, any
 *   occupant (zombie or intentional dev server) would only block the run
 *   anyway. Next.js only allows one dev instance per project directory,
 *   so stop your own dev server before running e2e.
 */

const isIntegration = process.env.E2E_MODE === "integration";

/**
 * `E2E_PAAS=true` enables the cross-repo PaaS three-tab spec
 * (`paas-customer-0.integration.spec.ts`). It (a) adds a second
 * `webServer` entry that boots feedback-board (`:3003`) with
 * `NEXT_PUBLIC_BOARD_SLUG=acme`, and (b) gates the `paas` project on
 * the runner. Default `test:e2e:integration` runs leave it off so
 * feedback-board isn't spun up for unrelated integration suites
 * (every `webServer` entry is global to all projects in this config —
 * Playwright doesn't yet support per-project `webServer`, hence the
 * env gate).
 */
const isPaas = process.env.E2E_PAAS === "true";

/** The suite owns :3190 (its OWN port — the dev server keeps :3100
 *  and survives test runs; 2026-07-19, ending the kill-your-dev-server
 *  cycle). `E2E_WEB_PORT` still overrides. The e2e server also builds
 *  into its own dist dir (.next-e2e) so it can boot while a dev server
 *  holds the .next lock. */
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3190);

const seWebServer = {
  command: `npx next dev --port ${WEB_PORT}`,
  url: `http://localhost:${WEB_PORT}`,
  // See the header comment — reuse adopted zombie/wrong-env servers.
  reuseExistingServer: false,
  timeout: 120 * 1000,
  env: {
    ...process.env,
    MOCK_AUTH: "true",
    // Own dist dir — coexists with a dev server sharing the repo.
    NEXT_DIST_DIR: ".next-e2e",
    // Hides dev-only floating widgets (TanStack devtools) that intercept
    // pointer events on corner-anchored UI (composer send buttons).
    NEXT_PUBLIC_E2E: "true",
  },
};

const portalWebServer = {
  command: "npm --prefix ../feedback-board run dev",
  url: "http://localhost:3003",
  // `reuseExistingServer: false` — unlike the web-app
  // server (which honors hot-reload from npm run dev:mock), the
  // portal's slug + API base must come from this config's env block.
  // A stale dev server on :3003 with a different NEXT_PUBLIC_BOARD_SLUG
  // (or older code without `data-testid="suggest-success"`) silently
  // fails the spec with confusing "title not visible" / "testid not
  // found" assertions. Boot fresh every run; the ~10s cold-start cost
  // is worth not chasing phantom failures.
  reuseExistingServer: false,
  timeout: 120 * 1000,
  env: {
    ...process.env,
    NEXT_PUBLIC_BOARD_SLUG: "acme",
    // Honor API_BASE_URL override so e.g. host.docker.internal works the
    // same in the portal as in the spec; falling through to localhost
    // matches the rest of the e2e config's default.
    NEXT_PUBLIC_API_BASE_URL:
      process.env.API_BASE_URL ?? "http://localhost:8080",
  },
};

export default defineConfig({
  testDir: "./e2e",
  // Warm heavy routes after the webServer boots, before any test — cold
  // lazy compiles otherwise stall the dev server mid-suite (transient
  // ERR_CONNECTION_REFUSED). See e2e/scripts/global-warmup.ts.
  globalSetup: "./e2e/scripts/global-warmup.ts",
  fullyParallel: false, // Tests within a file run sequentially (order matters for integration)
  forbidOnly: !!process.env.CI,
  // CI retries twice as a pure infra safety net (cloud-runner blips); locally
  // we run STRICT at 0. The mocked tests were made deterministic by giving
  // their navigation/render assertions adequate web-first timeouts (a contended
  // Next dev-mode webServer compiles routes lazily, so a 5s ceiling raced cold
  // compiles under parallel load). Local-0 keeps us honest: a real flake fails
  // immediately instead of hiding behind a retry.
  retries: process.env.CI ? 2 : 0,
  workers: isIntegration ? 1 : undefined, // Integration tests share state — run sequentially to avoid rate limits
  reporter: "html",
  timeout: isIntegration ? 60000 : 30000,

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Tier 1: Mocked — fast UI behavior tests
    {
      name: "mocked",
      testIgnore: [/\.integration\.spec\.ts$/, /\.mobile\.spec\.ts$/],
      use: { ...devices["Desktop Chrome"] },
    },
    // Tier 1b: Mocked Mobile — responsive UI tests at mobile viewport
    {
      name: "mobile",
      testMatch: /\.mobile\.spec\.ts$/,
      use: { ...devices["iPhone 14"] },
    },
    // Tier 2: Integration — real backend, critical journeys
    {
      name: "integration",
      testMatch: /\.integration\.spec\.ts$/,
      // `paas-*` AND featurebase-board / featurebase-comments specs
      // both need the cross-repo `:3003` web server (feedback-board
      // serves the `/r/{slug}` board UI), only booted when
      // `E2E_PAAS=true`. The dedicated `paas` project runs them; keep
      // the default integration run free of them so
      // `test:e2e:integration` doesn't fail on a missing
      // feedback-board.
      testIgnore: /(?:paas-|featurebase-).*\.integration\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Tier 2b: PaaS — three-tab cross-repo spec proving same `/v1/*`
    // endpoints serve admin-cookie + anon + api-key callers. Requires
    // feedback-board on `:3003` with `NEXT_PUBLIC_BOARD_SLUG=acme`.
    // Also runs featurebase-* board/comments specs which hit the
    // feedback-board's `/r/{slug}` UI.
    {
      name: "paas",
      testMatch: /(?:paas-|featurebase-).*\.integration\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: isPaas ? [seWebServer, portalWebServer] : seWebServer,
});
