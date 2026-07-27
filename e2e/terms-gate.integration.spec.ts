/**
 * Terms-acceptance gate — integration tier, real backend (crm-web).
 *
 * Dev logins normally auto-accept (`method: 'dev_bypass'`) so every
 * other integration spec stays ungated. This spec passes
 * `skip_terms_acceptance: true` to exercise the REAL gate end-to-end:
 * the platform's TermsEnforcementInterceptor 403s, the app routes to
 * /accept-terms, the acceptance POST writes real ledger rows, and the
 * app opens.
 *
 * crm-web adaptation (ADR-001 split, 2026-07-13): the web-app version
 * of this spec also walks the first-AI-action `ai_ack` modal over the
 * /research chat surface. crm-web has no chat surface and its only AI
 * action (interview follow-up suggestions) requires a provisioned
 * sales workspace with an opportunity — unreachable for the fresh
 * gated org this spec mints. The ai_ack ledger + modal are platform +
 * shared-component behavior with canonical coverage in web-app's
 * `terms-gate.integration.spec.ts`; crm-web asserts the gate half.
 *
 * Uses a unique email per run: acceptance mutates the account's terms
 * state permanently, so the shared per-worker tenant must not be used.
 */

import { test as base, expect, type Page } from "@playwright/test";

// Must stay `localhost`, matching the client bundle's API base —
// cookies the fixture's dev-login sets are host-scoped, and a
// 127.0.0.1 login would leave the app's localhost:8080 requests
// cookie-less (401s instead of the terms 403 this spec exercises).
const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";

interface GatedLogin {
  page: Page;
  email: string;
}

const test = base.extend<{ gatedLogin: GatedLogin }>({
  gatedLogin: async ({ page, context }, use, testInfo) => {
    // Forward browser console + page errors so failures surface the
    // underlying client error (same pattern as auth.fixture.ts).
    page.on("console", (msg) => {
      const t = msg.type();
      if (t === "error" || t === "warning") {
        // eslint-disable-next-line no-console
        console.log(`[browser:${t}] ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      // eslint-disable-next-line no-console
      console.log(`[browser:pageerror] ${err.message}`);
    });

    const email = `e2e-terms-gate-${testInfo.workerIndex}-${Date.now()}@jurisimus.test`;
    const response = await context.request.post(`${API_BASE}/auth/dev/login`, {
      data: {
        email,
        name: `E2E Terms Gate ${email}`,
        skip_terms_acceptance: true,
      },
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `dev-login failed (${response.status()}): ${body}. ` +
          `Is the backend up at ${API_BASE} with NODE_ENV=development?`,
      );
    }
    const data = (await response.json()) as {
      user: { id: string; email: string; full_name: string | null };
      organization_id?: string;
      organization_name?: string;
      role?: string;
    };

    await page.addInitScript(
      (userData) => {
        localStorage.setItem("e2e-auth-user", JSON.stringify(userData));
      },
      {
        user_id: data.user.id,
        email: data.user.email,
        full_name: data.user.full_name ?? email,
        account_id: data.user.id,
        account_name: data.organization_name ?? "",
        organization_id: data.organization_id,
        organization_name: data.organization_name ?? "",
        role: data.role ?? "owner",
        roles: [data.role ?? "owner"],
        permissions: [],
      },
    );

    await use({ page, email });
  },
});

test.describe("terms-acceptance gate (real backend)", () => {
  // One journey: gate redirect → real acceptance → app opens.
  // Multiple full page loads over the real backend.
  test.describe.configure({ timeout: 180_000 });

  test("unaccepted account is gated on every surface, accepts for real, then the app opens", async ({
    gatedLogin,
  }) => {
    const { page } = gatedLogin;

    // 1. Any app surface routes to the gate — the platform 403s the
    //    first /v1/* call and the interceptor navigates. Generous
    //    timeout: the App Router replace blocks on the dev server's
    //    first compile of /accept-terms when the warmup cache is cold.
    await page.goto("/sales");
    await page.waitForURL("**/accept-terms", { timeout: 45000 });

    // Owner variant (dev-login bootstraps the account as its org's owner).
    const checkbox = page.getByTestId("terms-agree-checkbox");
    const continueBtn = page.getByTestId("terms-agree-continue");
    await expect(checkbox).not.toBeChecked();
    await expect(continueBtn).toBeDisabled();

    // 2. Can't-skip: direct navigation bounces back while gated.
    await page.goto("/account");
    await page.waitForURL("**/accept-terms", { timeout: 45000 });

    // 3. Accept for real — ledger rows are written server-side.
    await page.getByTestId("terms-agree-checkbox").check();
    await page.getByTestId("terms-agree-continue").click();
    await page.waitForURL("**/sales", { timeout: 15000 });

    // 4. The app is open: the pipeline surface renders (any of its
    //    states — welcome, provisioning, loaded — all share the view
    //    container class) instead of bouncing back to the gate.
    await expect(page.locator(".sales-pipeline-view")).toBeVisible({
      timeout: 30000,
    });

    // 5. A second gated-before surface loads and stays put.
    await page.goto("/account");
    await page.waitForTimeout(2000);
    expect(new URL(page.url()).pathname).toBe("/account");
  });
});
