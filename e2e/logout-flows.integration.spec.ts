/**
 * Logout redirect-chain E2E — crm-web shape.
 *
 * Inherited from web-app during the ADR-001 split (2026-07-13) and
 * adapted 2026-07-13: crm-web is an internal tool with NO marketing
 * landing — `/` is a server `redirect("/sales")` and `/login` is the
 * only public surface. Post-logout the correct terminal state is
 * `/login`, not `/` (web-app's spec asserted the marketing landing).
 *
 * What this file still locks in from the 2026-05-30 logout-flash
 * incident:
 *   - `isLoggingOut` guard: logout terminates cleanly without the
 *     background-401 → `auth:session-expired` → Zustand-reset cascade.
 *   - `dev-mock-session.ts`: after an explicit logout, `E2EAuthInit`
 *     must NOT silently re-auth in the same tab; a fresh tab (new
 *     sessionStorage) auto-logs-in again.
 *
 * What was REMOVED relative to web-app: the delete-account and
 * delete-workspace danger-zone flows. That UI was deliberately
 * stripped from crm-web (account management stays in web-app); the
 * canonical specs live in web-app's `logout-flows.integration.spec.ts`.
 *
 * Runs against the MOCK_AUTH-mode dev server (Playwright webServer
 * sets `MOCK_AUTH=true`).
 */
import { test, expect } from "@playwright/test";

// Same port derivation as playwright.config.ts — crm-web's suite owns
// :3190 since 2026-07-19 (dev server keeps :3100; web-app legacy was
// :3000 — a hardcoded port here silently tested whatever server
// happened to be on it).
const APP_BASE = `http://localhost:${process.env.E2E_WEB_PORT ?? 3190}`;

/**
 * Pure in-browser bootstrap: visits / and lets `E2EAuthInit` run its
 * auto-`/auth/dev/login` flow. `/` server-redirects to `/sales`;
 * ProtectedRoute holds it once the store hydrates. Returns the page
 * positioned on `/sales` with a fully hydrated dev:mock session.
 */
async function autoLoginToApp(page: import("@playwright/test").Page) {
  // Use a fresh storage context so each test starts clean.
  await page.context().clearCookies();
  await page.goto(APP_BASE);
  await page.waitForURL(/\/sales\b/, { timeout: 20_000 });
}

/**
 * Sign out through the real UI: crm-web has no account dropdown —
 * logout is the "Sign Out" button on /account (the shell's Settings
 * destination). Terminal state: /logout → BRAND.url ("/") →
 * redirect("/sales") → ProtectedRoute bounce → /login.
 */
async function logoutFromApp(page: import("@playwright/test").Page) {
  await page.goto(`${APP_BASE}/account`);
  await page.getByRole("button", { name: "Sign Out" }).click();
  await page.waitForURL((url) => url.pathname === "/login", {
    timeout: 15_000,
  });
}

/**
 * Capture every main-frame navigation so a spec can assert what the
 * post-click chain looked like. Returns a getter for the recorded
 * URLs in order.
 */
function recordNavigations(page: import("@playwright/test").Page) {
  const urls: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) urls.push(frame.url());
  });
  return () => [...urls];
}

test.describe("logout redirect chain (dev:mock)", () => {
  test("auto-login + visiting / redirects to /sales (sanity)", async ({
    page,
  }) => {
    await autoLoginToApp(page);
    expect(page.url()).toContain("/sales");
  });

  test("signing out settles on /login and stays there (no auto-re-login)", async ({
    page,
  }) => {
    await autoLoginToApp(page);
    const getNavs = recordNavigations(page);

    // Internal tool: /login IS the terminal public surface.
    await logoutFromApp(page);

    // The regression this guards: a post-logout bounce BACK into the
    // app (silent re-auth). Give E2EAuthInit time to (incorrectly)
    // fire, then assert we're still signed out on /login.
    await page.waitForTimeout(2_000);
    expect(new URL(page.url()).pathname).toBe("/login");
    const navs = getNavs();
    const loginIndex = navs.findIndex(
      (u) => new URL(u).pathname === "/login",
    );
    expect(loginIndex).toBeGreaterThanOrEqual(0);
    // Nothing after /login re-enters an app surface.
    expect(
      navs
        .slice(loginIndex + 1)
        .some((u) => new URL(u).pathname.startsWith("/sales")),
    ).toBe(false);
  });

  test("after explicit logout, visiting /sales does NOT auto-re-login", async ({
    page,
  }) => {
    await autoLoginToApp(page);
    await logoutFromApp(page);

    // Same tab — `dev-mock-explicit-signed-out` sessionStorage flag
    // is still set, so E2EAuthInit must skip the auto-login.
    await page.goto(`${APP_BASE}/sales`);
    // Give E2EAuthInit + ProtectedRoute time to settle.
    await page.waitForTimeout(2_000);

    // We're either on /login (ProtectedRoute bounce — fine) or on
    // /sales showing a loading/null state. We must NOT be silently
    // logged in with the pipeline rendered.
    const finalPath = new URL(page.url()).pathname;
    expect(finalPath).not.toBe("/sales");
  });

  test("explicit logout, then fresh tab — auto-login fires again", async ({
    browser,
  }) => {
    // Same browser, different context = different tab. sessionStorage
    // is tab-scoped, so the signed-out flag does NOT carry over.
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await pageA.goto(APP_BASE);
    await pageA.waitForURL(/\/sales\b/, { timeout: 20_000 });
    await logoutFromApp(pageA);
    await ctxA.close();

    // Fresh context (= fresh tab semantics): auto-login should
    // succeed again.
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto(APP_BASE);
    await pageB.waitForURL(/\/sales\b/, { timeout: 20_000 });
    expect(pageB.url()).toContain("/sales");
    await ctxB.close();
  });
});
