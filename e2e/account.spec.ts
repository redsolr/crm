/**
 * Account page E2E tests (Tier 1 — mocked).
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupWorkspaceHandlers } from "./handlers/workspace.handlers";

test.describe("Account Page", () => {
  test.beforeEach(async ({ authedPage }) => {
    await setupWorkspaceHandlers(authedPage);
  });

  test("renders account page", async ({ authedPage }) => {
    await authedPage.goto("/account");

    await expect(authedPage).toHaveURL(/\/account/);
  });

  test("displays user info", async ({ authedPage }) => {
    await authedPage.goto("/account");

    // Should show user email from TEST_USER. Scoped to the account
    // view: /account renders inside CrmShell, whose sidebar footer
    // ALSO shows the email — an unscoped getByText is ambiguous.
    await expect(
      authedPage
        .locator(".crm-account-view")
        .getByText("e2e-test@jurisimus.com"),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("displays user name", async ({ authedPage }) => {
    await authedPage.goto("/account");

    await expect(authedPage.getByText("E2E Test User")).toBeVisible({
      timeout: 10000,
    });
  });
});
