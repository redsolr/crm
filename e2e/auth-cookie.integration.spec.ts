/**
 * Tier 2: Integration E2E — Cookie-auth + CSRF browser smoke.
 *
 * The cookie migration (auth-cookie unification, 2026-05-09) flipped
 * the FE from `localStorage`-stored JWTs to HttpOnly cookies. The BE
 * integration spec covers the wire-level contract; this spec covers
 * the browser-level contract — what the supertest layer can't see:
 *
 *   - Are the three cookies (access_token, refresh_token,
 *     jurisimus_csrf) actually set with the right HttpOnly attribute?
 *   - Does a `credentials: 'include'` fetch from page-context land
 *     authenticated against the BE without ever sending an
 *     `Authorization` header?
 *   - Does the FE attach `X-CSRF-Token` on cookie-auth mutations?
 *   - Does the BE's CSRF middleware reject a mutation that omits
 *     the header (the contract on which the whole double-submit
 *     defense rests)?
 *   - Does logout clear the cookies + does a follow-up authed
 *     request 401?
 *   - Is `localStorage["friendly_fortnight_*"]` truly gone? (Failing
 *     this would mean a stray code path is still writing a token
 *     somewhere.)
 *
 * Run: npm run test:e2e:integration
 * Prerequisites: Backend at localhost:8080 with NODE_ENV=development.
 */

import { test, expect } from "./fixtures/integration.fixture";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";

test.describe("Auth Cookie + CSRF (Real Backend)", () => {
  test("dev-login lands the three-cookie family with the right HttpOnly attributes", async ({
    integrationPage,
  }) => {
    await integrationPage.goto("/");

    const cookies = await integrationPage.context().cookies();
    const access = cookies.find((c) => c.name === "access_token");
    const refresh = cookies.find((c) => c.name === "refresh_token");
    const csrf = cookies.find((c) => c.name === "jurisimus_csrf");

    expect(access, "access_token cookie should be set").toBeDefined();
    expect(refresh, "refresh_token cookie should be set").toBeDefined();
    expect(csrf, "jurisimus_csrf cookie should be set").toBeDefined();

    // Auth cookies MUST be HttpOnly — that's the whole point of the
    // migration. JS-readable auth cookies would be the same XSS
    // surface as the localStorage path we just retired.
    expect(access?.httpOnly, "access_token must be HttpOnly").toBe(true);
    expect(refresh?.httpOnly, "refresh_token must be HttpOnly").toBe(true);

    // CSRF cookie MUST be JS-readable — the FE reads it via
    // `document.cookie` and reflects it as `X-CSRF-Token`. A HttpOnly
    // CSRF cookie defeats the double-submit pattern entirely.
    expect(csrf?.httpOnly, "jurisimus_csrf must NOT be HttpOnly").toBe(false);
  });

  test("a /api/* request from page-context succeeds with no Authorization header", async ({
    integrationPage,
  }) => {
    await integrationPage.goto("/");

    // Probe `/auth/me` from the page context using `credentials:
    // 'include'` — same shape the FE's BaseApiClient takes. The
    // request MUST NOT carry an Authorization header (the cookie
    // is the credential).
    const probe = await integrationPage.evaluate(async (apiBase) => {
      const res = await fetch(`${apiBase}/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return {
        status: res.status,
        body: res.ok ? await res.json() : null,
      };
    }, API_BASE);

    expect(probe.status, "/auth/me should resolve via cookie").toBe(200);
    expect((probe.body as { email: string } | null)?.email).toContain(
      "@jurisimus.test",
    );
  });

  test("page reload preserves the cookie session", async ({
    integrationPage,
  }) => {
    await integrationPage.goto("/");

    // Cookies survive the reload — this is a sanity check that the
    // browser persists them across navigations the way we expect.
    await integrationPage.reload();

    const reloaded = await integrationPage.evaluate(async (apiBase) => {
      const res = await fetch(`${apiBase}/auth/me`, {
        credentials: "include",
      });
      return res.status;
    }, API_BASE);

    expect(reloaded).toBe(200);
  });

  test("cookie-auth mutation WITH X-CSRF-Token succeeds (positive path)", async ({
    integrationPage,
  }) => {
    await integrationPage.goto("/");

    // Trigger a real cookie-auth mutation from page context. We hit
    // PUT /api/organizations/:id with the org id resolved from
    // /auth/me — proves the full transport (cookie + CSRF +
    // mutation) works end-to-end through a real Set-Cookie /
    // document.cookie / X-CSRF-Token round-trip.
    const result = await integrationPage.evaluate(async (apiBase) => {
      const me = await fetch(`${apiBase}/auth/me`, {
        credentials: "include",
      }).then((r) => r.json());

      const csrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("jurisimus_csrf="))
        ?.substring("jurisimus_csrf=".length);

      const res = await fetch(`${apiBase}/api/organizations/${me.organization_id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf !== undefined ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ name: "Cookie-auth E2E rename" }),
      });
      return { status: res.status, hadCsrf: csrf !== undefined };
    }, API_BASE);

    expect(result.hadCsrf, "FE must be able to read jurisimus_csrf").toBe(
      true,
    );
    expect(result.status).toBe(200);
  });

  test("cookie-auth mutation WITHOUT X-CSRF-Token is rejected (CSRF contract)", async ({
    integrationPage,
  }) => {
    await integrationPage.goto("/");

    // Same mutation, but strip the CSRF header. BE must reject with
    // 403 `csrf_token_missing`. This is the contract that makes the
    // whole double-submit defense load-bearing — break it and the
    // entire CSRF surface goes silent.
    const result = await integrationPage.evaluate(async (apiBase) => {
      const me = await fetch(`${apiBase}/auth/me`, {
        credentials: "include",
      }).then((r) => r.json());

      const res = await fetch(`${apiBase}/api/organizations/${me.organization_id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Should be rejected" }),
      });
      return {
        status: res.status,
        body: res.ok ? null : await res.json(),
      };
    }, API_BASE);

    expect(result.status).toBe(403);
    const errBody = result.body as
      | { error?: { code?: string } }
      | null;
    expect(errBody?.error?.code).toBe("csrf_token_missing");
  });

  test("logout clears the cookies and follow-up authed requests 401", async ({
    integrationPage,
  }) => {
    await integrationPage.goto("/");

    // Sanity: the session is live before we log out.
    const before = await integrationPage.evaluate(async (apiBase) => {
      const res = await fetch(`${apiBase}/auth/me`, {
        credentials: "include",
      });
      return res.status;
    }, API_BASE);
    expect(before).toBe(200);

    // Park the app before logging out. The mounted app runs its own
    // 401→refresh→retry machinery on background query refetches; left
    // running, an in-flight refresh can re-issue cookies in the window
    // between our logout and the probe (the parallel-load flake seen
    // 3× on 2026-07-18). The claim under test is the BE logout
    // contract, not the app's concurrent-refresh behavior — take the
    // app off the field so the probe is deterministic.
    await integrationPage.goto("about:blank");

    // Log out via the BE directly (request context shares the cookie
    // jar). Reflecting the CSRF cookie as the header is required
    // because /auth/logout is a state-changing route under the CSRF
    // middleware.
    const csrf = (await integrationPage.context().cookies()).find(
      (c) => c.name === "jurisimus_csrf",
    )?.value;
    const logoutRes = await integrationPage.request.post(
      `${API_BASE}/auth/logout`,
      { headers: csrf !== undefined ? { "X-CSRF-Token": csrf } : {} },
    );
    expect(logoutRes.ok()).toBe(true);

    // Cookies must be cleared on the browser side.
    const cookies = await integrationPage.context().cookies();
    const access = cookies.find((c) => c.name === "access_token");
    expect(
      access === undefined || access.value === "",
      "access_token cookie should be cleared after logout",
    ).toBe(true);

    // And the follow-up authed probe must 401.
    const after = await integrationPage.request.get(`${API_BASE}/auth/me`);
    expect(after.status()).toBe(401);
  });

  test("localStorage carries no friendly_fortnight_* token keys", async ({
    integrationPage,
  }) => {
    await integrationPage.goto("/");

    // Wait until any FE auth-sync hooks have had a chance to run —
    // a stray write would land async. Walking localStorage after
    // a real navigation is the strongest signal "no code path
    // writes the token."
    await integrationPage.waitForLoadState("networkidle");

    const tokenKeys = await integrationPage.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key !== null && key.startsWith("friendly_fortnight_")) {
          keys.push(key);
        }
      }
      return keys;
    });

    expect(
      tokenKeys,
      "no friendly_fortnight_* keys should remain after the cookie migration",
    ).toEqual([]);
  });
});
