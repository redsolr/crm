/**
 * Playwright globalSetup: warm the dev server's heavy routes before any
 * test runs.
 *
 * Why (2026-06-12): `next dev` compiles routes lazily. On a cold cache
 * (config/package.json change, fresh clone, CI) the first hit on a heavy
 * route stalls the server long enough that a serial integration suite
 * sees transient `ERR_CONNECTION_REFUSED` / empty-render assertion
 * failures that look like backend flake. Paying the compile cost here —
 * sequentially, before the suite — makes cold and warm runs behave the
 * same. On a warm cache this whole file costs a few seconds.
 *
 * Playwright boots `webServer` BEFORE globalSetup, so the server is
 * already accepting connections when this runs.
 */

const BASE = `http://localhost:${process.env.E2E_WEB_PORT ?? 3190}`;

/** Routes the suites actually visit, heaviest first. */
const WARM_ROUTES = [
  "/",
  // CRM shell — /sales compiles its own layout tree; sub-routes get
  // their own page chunks.
  "/sales",
  "/sales/companies",
  "/sales/inbox",
  "/login",
  // Terms-acceptance gate (2026-07-12): the gate redirect races a
  // 15-45s first compile of /accept-terms if it isn't pre-warmed.
  "/accept-terms",
];

const PER_ROUTE_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 1_500;

async function warmRoute(path: string): Promise<void> {
  const deadline = Date.now() + PER_ROUTE_TIMEOUT_MS;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(60_000),
      });
      // Any HTTP response means the route compiled and the server is
      // healthy — redirects (auth) and 404s are fine for warmup purposes.
      if (res.status < 500) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  // Warmup is best-effort: a route that never came up will fail loudly in
  // the suite itself with a better error than we could produce here.
  console.warn(`[e2e warmup] ${path} did not warm within ${PER_ROUTE_TIMEOUT_MS}ms (${lastError})`);
}

export default async function globalWarmup(): Promise<void> {
  const started = Date.now();
  for (const route of WARM_ROUTES) {
    await warmRoute(route);
  }
  console.log(
    `[e2e warmup] ${WARM_ROUTES.length} routes warmed in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}
