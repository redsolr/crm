/**
 * Unauthorized page E2E tests (Tier 1 — mocked).
 * Tests the access denied page for both authenticated and unauthenticated users.
 */

import {
  test as authedTest,
  expect as authedExpect,
} from "./fixtures/auth.fixture";
import { test as unauthTest, expect as unauthExpect } from "@playwright/test";
import { setupWorkspaceHandlers } from "./handlers/workspace.handlers";

authedTest.describe("Unauthorized Page (authenticated)", () => {
  authedTest.beforeEach(async ({ authedPage }) => {
    await setupWorkspaceHandlers(authedPage);
  });

  authedTest("displays access denied heading", async ({ authedPage }) => {
    await authedPage.goto("/unauthorized");

    await authedExpect(authedPage.getByText("Access Denied")).toBeVisible({
      timeout: 10000,
    });
    await authedExpect(
      authedPage.getByText("You don't have permission to access this page."),
    ).toBeVisible();
  });

  authedTest("shows signed-in user info", async ({ authedPage }) => {
    await authedPage.goto("/unauthorized");

    await authedExpect(authedPage.getByText("Signed in as:")).toBeVisible({
      timeout: 10000,
    });
    await authedExpect(authedPage.getByText("E2E Test User")).toBeVisible();
    await authedExpect(authedPage.getByText("Role: owner")).toBeVisible();
  });

  authedTest(
    "Go Back button navigates to home when authenticated",
    async ({ authedPage }) => {
      await authedPage.goto("/unauthorized");

      await authedExpect(
        authedPage.getByRole("button", { name: "Go Back" }),
      ).toBeVisible({ timeout: 10000 });
      await authedPage.getByRole("button", { name: "Go Back" }).click();

      // Terminal state, not the transient hop: "/" is
      // `redirect("/sales")` (internal tool), so asserting "/" races
      // the server redirect — it flaked exactly that way 2026-07-19.
      await authedExpect(authedPage).toHaveURL("/sales");
    },
  );

  authedTest("shows Sign Out button", async ({ authedPage }) => {
    await authedPage.goto("/unauthorized");

    await authedExpect(
      authedPage.getByRole("button", { name: "Sign Out" }),
    ).toBeVisible({ timeout: 10000 });
  });
});

unauthTest.describe("Unauthorized Page (unauthenticated)", () => {
  // In dev:mock (MOCK_AUTH=true) `E2EAuthInit` auto-logs-in a canned user
  // whenever no user is seeded AND the tab isn't flagged signed-out — a
  // manual-dev convenience that otherwise async-races these assertions (the
  // "Signed in as:" block appears mid-test). A genuinely-unauthenticated
  // visitor IS the app's "explicitly signed out" state, so stamp that flag
  // (the same `dev-mock-explicit-signed-out` key `authTokenManager.logout()`
  // sets) before each test to make logged-out deterministic.
  unauthTest.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("dev-mock-explicit-signed-out", "true");
      localStorage.removeItem("e2e-auth-user");
    });
  });

  unauthTest("displays access denied heading", async ({ page }) => {
    await page.goto("/unauthorized");

    await unauthExpect(page.getByText("Access Denied")).toBeVisible({
      timeout: 10000,
    });
  });

  unauthTest("does not show user info when not logged in", async ({ page }) => {
    await page.goto("/unauthorized");

    await unauthExpect(page.getByText("Access Denied")).toBeVisible({
      timeout: 10000,
    });
    await unauthExpect(page.getByText("Signed in as:")).not.toBeVisible();
  });

  unauthTest("shows Go Back and Sign Out buttons", async ({ page }) => {
    await page.goto("/unauthorized");

    await unauthExpect(
      page.getByRole("button", { name: "Go Back" }),
    ).toBeVisible({ timeout: 10000 });
    await unauthExpect(
      page.getByRole("button", { name: "Sign Out" }),
    ).toBeVisible();
  });
});
