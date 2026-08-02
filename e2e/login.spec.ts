/**
 * Login page E2E tests (Tier 1 — mocked, no backend).
 *
 * Tests the custom login UI: email/password form, social OAuth buttons,
 * footer links, and authenticated redirect.
 *
 * Requires: MOCK_AUTH=true (set in playwright.config.ts).
 */

import { test, expect, Page } from "@playwright/test";

test.describe("Login Page", () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    // Keep the login page unauthenticated: E2EAuthInit (MOCK_AUTH)
    // hydrates the canned dev user synchronously on mount and would
    // redirect every test to /sales before the form assertions run.
    // The designed opt-out is the explicit signed-out flag
    // (dev-mock-session.ts) — the same one "Log out" sets.
    await page.addInitScript(() => {
      sessionStorage.setItem("dev-mock-explicit-signed-out", "true");
    });
    await page.goto("/login");
  });

  test("renders login page with title", async () => {
    await expect(page.getByTestId("login-page")).toBeVisible();
    await expect(page.getByTestId("login-title")).toHaveText(
      "Sign in to your account",
    );
  });

  test("shows Jurisimus logo linking to homepage", async () => {
    const logo = page.locator(".brand-logo").first();
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("href", "/");
  });

  test("renders email and password inputs", async () => {
    const emailInput = page.getByTestId("login-email-input");
    const passwordInput = page.getByTestId("login-password-input");

    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("renders Sign in submit button", async () => {
    await expect(page.getByTestId("login-submit")).toBeVisible();
    await expect(page.getByTestId("login-submit")).toHaveText("Sign in");
  });

  test("shows Forgot your password link", async () => {
    const forgotLink = page.getByText("Forgot your password?");
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute("href", "/forgot-password");
  });

  test("renders Google and Apple sign-in buttons", async () => {
    await expect(page.getByTestId("login-btn-google")).toBeVisible();
    await expect(page.getByTestId("login-btn-apple")).toBeVisible();
  });

  test("Google button links to /login/google", async () => {
    await expect(page.getByTestId("login-btn-google")).toHaveAttribute(
      "href",
      "/login/google",
    );
  });

  test("Apple button links to /login/apple", async () => {
    await expect(page.getByTestId("login-btn-apple")).toHaveAttribute(
      "href",
      "/login/apple",
    );
  });

  test("shows OR divider between form and social buttons", async () => {
    await expect(page.locator(".auth-divider").getByText("or")).toBeVisible();
  });

  test("shows Privacy and Terms links in footer", async () => {
    const privacyLink = page
      .locator(".auth-footer")
      .getByRole("link", { name: "Privacy" });
    const termsLink = page
      .locator(".auth-footer")
      .getByRole("link", { name: "Terms" });

    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();
    // Legal copy lives on the customer-facing site — the internal CRM
    // links out instead of shipping its own /legal routes.
    await expect(privacyLink).toHaveAttribute(
      "href",
      "https://jurisimus.com/legal/privacy",
    );
    await expect(termsLink).toHaveAttribute(
      "href",
      "https://jurisimus.com/legal/terms",
    );
  });

  test("shows error for empty email on submit", async () => {
    await page.getByTestId("login-password-input").fill("password123");
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("login-email-error")).toBeVisible();
    await expect(page.getByTestId("login-email-error")).toContainText(
      "Email is required",
    );
  });

  test("shows error for invalid email format", async () => {
    await page.getByTestId("login-email-input").fill("notanemail");
    await page.getByTestId("login-password-input").fill("password123");
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("login-email-error")).toBeVisible();
    await expect(page.getByTestId("login-email-error")).toContainText(
      "Invalid email address: notanemail",
    );
  });

  test("shows error for empty password on submit", async () => {
    await page.getByTestId("login-email-input").fill("test@example.com");
    await page.getByTestId("login-submit").click();

    // Password error is rendered by FieldError inside PasswordInput
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("clears email error when user types", async () => {
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-email-error")).toBeVisible();

    await page.getByTestId("login-email-input").fill("t");
    await expect(page.getByTestId("login-email-error")).not.toBeVisible();
  });

  test("input border turns red on validation error", async () => {
    await page.getByTestId("login-submit").click();

    const emailInput = page.getByTestId("login-email-input");
    // The input gets ctx-input-error class which sets a red border
    await expect(emailInput).toHaveClass(/ctx-input-error/);
  });

  test("does not show app navbar on login page", async () => {
    await expect(page.getByText("New chat")).not.toBeVisible();
  });

  test("shows no last-account card without the cookie", async () => {
    await expect(page.getByTestId("login-last-account")).toHaveCount(0);
  });

  test("redirects authenticated users to /sales", async () => {
    await page.addInitScript(() => {
      // This test wants the AUTHENTICATED path — lift the suite-wide
      // signed-out flag (beforeEach) and seed a user.
      sessionStorage.removeItem("dev-mock-explicit-signed-out");
      localStorage.setItem(
        "friendly_fortnight_token",
        "e2e-test-jwt-token-for-playwright",
      );
      localStorage.setItem(
        "e2e-auth-user",
        JSON.stringify({
          user_id: "test-user-e2e-001",
          email: "e2e-test@jurisimus.com",
          full_name: "E2E Test User",
          account_id: "test-account-e2e-001",
          role: "owner",
        }),
      );
    });

    await page.goto("/login");
    await page.waitForURL("**/sales", { timeout: 10000 });
    expect(page.url()).toContain("/sales");
  });
});

test.describe("Login Page — Continue as last account", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("dev-mock-explicit-signed-out", "true");
    });
  });

  /**
   * Seed the non-httpOnly cookie the server writes on every login.
   * Set on the CONTEXT (not addInitScript, which re-runs on every
   * navigation and would resurrect the cookie after the clear test's
   * reload).
   */
  function seedLastAccount(
    page: Page,
    baseURL: string | undefined,
    account: { email: string; name?: string; method?: string },
  ) {
    if (!baseURL) throw new Error("baseURL missing from Playwright config");
    return page.context().addCookies([
      {
        name: "crm-last-account",
        value: encodeURIComponent(JSON.stringify(account)),
        url: baseURL,
      },
    ]);
  }

  test("offers the last Google account back with a login_hint link", async ({
    page,
    baseURL,
  }) => {
    await seedLastAccount(page, baseURL, {
      email: "admin@jurisimus.com",
      name: "Kreethup Hiranphan",
      method: "GoogleOAuth",
    });
    await page.goto("/login");

    const card = page.getByTestId("login-last-account");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Kreethup Hiranphan");
    await expect(card).toContainText("admin@jurisimus.com");
    await expect(card).toContainText("Continue with Google");
    await expect(
      page.getByTestId("login-last-account-continue"),
    ).toHaveAttribute(
      "href",
      "/login/google?login_hint=admin%40jurisimus.com",
    );
    // The regular form stays available underneath.
    await expect(page.getByTestId("login-email-form")).toBeVisible();
  });

  test("password-method continue prefills email and focuses password", async ({
    page,
    baseURL,
  }) => {
    await seedLastAccount(page, baseURL, {
      email: "crm-e2e@jurisimus.com",
      method: "Password",
    });
    await page.goto("/login");

    const card = page.getByTestId("login-last-account");
    await expect(card).toContainText("Continue with password");
    await page.getByTestId("login-last-account-continue").click();
    await expect(page.getByTestId("login-email-input")).toHaveValue(
      "crm-e2e@jurisimus.com",
    );
    await expect(page.getByTestId("login-password-input")).toBeFocused();
  });

  test("Use another account dismisses the card and forgets the cookie", async ({
    page,
    baseURL,
  }) => {
    await seedLastAccount(page, baseURL, {
      email: "admin@jurisimus.com",
      method: "GoogleOAuth",
    });
    await page.goto("/login");

    await expect(page.getByTestId("login-last-account")).toBeVisible();
    await page.getByTestId("login-last-account-clear").click();
    await expect(page.getByTestId("login-last-account")).toHaveCount(0);
    // The cookie is gone — a reload doesn't resurrect the card.
    await page.reload();
    await expect(page.getByTestId("login-page")).toBeVisible();
    await expect(page.getByTestId("login-last-account")).toHaveCount(0);
  });
});
