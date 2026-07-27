import { test, expect } from "@playwright/test";
import {
  test as authedTest,
  expect as authedExpect,
} from "./fixtures/auth.fixture";
import { API_BASE } from "./handlers/shared";

test.describe("Authentication Flow (Unauthenticated)", () => {
  // For unauthenticated tests, block /auth/dev/login so E2EAuthInit
  // cannot auto-seed a session when no user has been pre-injected.
  // The component's catch path is the only branch that doesn't set the
  // user — abort the request so fetch() rejects.
  test.beforeEach(async ({ page }) => {
    await page.route(`${API_BASE}/auth/dev/login`, async (route) => {
      await route.abort();
    });
  });

  test("root bounces unauthenticated visitors to /login", async ({
    page,
  }) => {
    // No landing page in the internal CRM: "/" redirects to /sales and
    // ProtectedRoute bounces the anonymous visitor to /login.
    await page.goto("/");

    await page.waitForURL("**/login", { timeout: 15000 });
    await expect(page.getByTestId("login-title")).toBeVisible();
  });

  test("should show login page with sign in form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByTestId("login-title")).toHaveText(
      "Sign in to your account",
    );
    await expect(page.getByTestId("login-submit")).toBeVisible();
    await expect(page.getByTestId("login-submit")).toHaveText("Sign in");
  });

  test("should show available auth methods on login page", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByTestId("login-btn-google")).toBeVisible();
    await expect(page.getByTestId("login-btn-apple")).toBeVisible();
    await expect(page.getByTestId("login-email-input")).toBeVisible();
  });

});

authedTest.describe("Authentication Flow (Authenticated)", () => {
  authedTest(
    "should redirect from login to the pipeline when authenticated",
    async ({ authedPage }) => {
      await authedPage.goto("/login");

      // Should redirect to /sales since already authenticated. 15s so the
      // /login + auth-redirect + /sales cold-compile chain survives
      // parallel-load latency on the shared dev server — 5s was too tight
      // and surfaced as a flake, not a logic failure.
      await authedPage.waitForURL("**/sales", { timeout: 15000 });
      await authedExpect(authedPage).toHaveURL(/\/sales/);
    },
  );

  authedTest(
    "should redirect from root to the pipeline when authenticated",
    async ({ authedPage }) => {
      await authedPage.goto("/");

      // "/" redirects straight into the CRM
      await authedPage.waitForURL("**/sales", { timeout: 15000 });
      await authedExpect(authedPage).toHaveURL(/\/sales/);
    },
  );
});
