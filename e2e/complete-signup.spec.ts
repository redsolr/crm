/**
 * Complete Signup page E2E tests (Tier 1 — mocked).
 * Tests the post-OAuth signup form: validation, password strength, submission.
 */

import { test as base, expect } from "@playwright/test";
import { API_BASE } from "./handlers/shared";

const test = base;

test.describe("Complete Signup Page", () => {
  test.beforeEach(async ({ page }) => {
    // Block /auth/dev/login so MOCK_AUTH's E2EAuthInit can't auto-seed
    // a session against the real platform on :8080 and redirect away.
    await page.route(`${API_BASE}/auth/dev/login`, async (route) => {
      await route.abort();
    });
  });

  test("renders the form with email and name from URL params", async ({
    page,
  }) => {
    await page.goto("/complete-signup?email=test@example.com&name=John+Doe");

    await expect(page.getByText("Finish creating your account")).toBeVisible({
      timeout: 10000,
    });
    // Email should be displayed as read-only
    await expect(
      page.locator('input[value="test@example.com"][readOnly]'),
    ).toBeVisible();
    // Name field should be pre-filled
    await expect(page.locator('input[name="fullName"]')).toHaveValue(
      "John Doe",
    );
  });

  test("shows password field with strength indicator", async ({ page }) => {
    await page.goto("/complete-signup?email=test@example.com&name=John+Doe");

    await expect(page.getByText("Create backup password")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("complete-password-input")).toBeVisible();
  });

  test("shows submit button", async ({ page }) => {
    await page.goto("/complete-signup?email=test@example.com&name=John+Doe");

    await expect(page.getByTestId("complete-submit")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("complete-submit")).toHaveText(
      "Create account",
    );
  });

  test("shows error when submitting without password", async ({ page }) => {
    await page.goto("/complete-signup?email=test@example.com&name=John+Doe");
    await expect(page.getByTestId("complete-submit")).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId("complete-submit").click();

    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("shows error when password is too short", async ({ page }) => {
    await page.goto("/complete-signup?email=test@example.com&name=John+Doe");
    await expect(page.getByTestId("complete-password-input")).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId("complete-password-input").fill("short");
    await page.getByTestId("complete-submit").click();

    await expect(
      page.getByText("Password must be at least 8 characters"),
    ).toBeVisible();
  });

  test("clears validation error when typing new password", async ({ page }) => {
    await page.goto("/complete-signup?email=test@example.com&name=John+Doe");
    await expect(page.getByTestId("complete-password-input")).toBeVisible({
      timeout: 10000,
    });

    // Trigger error
    await page.getByTestId("complete-submit").click();
    await expect(page.getByText("Password is required")).toBeVisible();

    // Start typing — error should clear
    await page.getByTestId("complete-password-input").fill("a");
    await expect(page.getByText("Password is required")).not.toBeVisible();
  });

  test("handles empty URL params gracefully", async ({ page }) => {
    await page.goto("/complete-signup");

    await expect(page.getByText("Finish creating your account")).toBeVisible({
      timeout: 10000,
    });
    // Email should be empty
    await expect(page.locator('input[value=""][readOnly]')).toBeVisible();
  });
});
