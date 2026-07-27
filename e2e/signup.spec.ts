/**
 * Signup page E2E tests (Tier 1 — mocked).
 *
 * crm-web is the internal CRM (ADR-001): there is no signup at all —
 * /signup stays alive only so direct hits land on an honest
 * invite-only explanation instead of a 404. These tests assert the FE
 * surface matches that reality: no email/password inputs to lure a
 * visitor into a dead-end submit.
 */

import { test, expect, Page } from "@playwright/test";
import { API_BASE } from "./handlers/shared";

test.describe("Signup Page (invitation-only)", () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    // Block /auth/dev/login so MOCK_AUTH's E2EAuthInit can't auto-seed
    // a session against the real platform on :8080 and redirect to /chat.
    await page.route(`${API_BASE}/auth/dev/login`, async (route) => {
      await route.abort();
    });
    await page.goto("/signup");
  });

  test("explains the invite-only model", async () => {
    await expect(page.getByText("Internal tool — invite only")).toBeVisible();
    await expect(
      page.getByText(/ask for an invite link/i),
    ).toBeVisible();
  });

  test("renders NO account-creation form", async () => {
    // The old form's fields must be gone — a visible email/password
    // form on a closed door would dead-end every visitor who fills it.
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator("form")).toHaveCount(0);
  });

  test("still links existing users to sign in", async () => {
    const signIn = page.getByText("Sign in");
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute("href", "/login");
  });
});
