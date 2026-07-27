/**
 * Link Account page E2E tests (Tier 1 — mocked).
 * Tests the OAuth account linking form: confirmation prompt, password input, cancel/submit.
 */

import { test as base, expect } from "@playwright/test";
import { API_BASE } from "./handlers/shared";

const test = base;

test.describe("Link Account Page", () => {
  test.beforeEach(async ({ page }) => {
    // Block /auth/dev/login so MOCK_AUTH's E2EAuthInit can't auto-seed
    // a session against the real platform on :8080 and redirect away.
    await page.route(`${API_BASE}/auth/dev/login`, async (route) => {
      await route.abort();
    });
  });

  test("renders confirmation message with provider and email", async ({
    page,
  }) => {
    await page.goto("/link-account?email=user@example.com&provider=GitHub");

    await expect(
      page.getByText("Confirm your credentials to link your GitHub account"),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("user@example.com")).toBeVisible();
  });

  test("defaults provider to Google when not specified", async ({ page }) => {
    await page.goto("/link-account?email=user@example.com");

    await expect(
      page.getByText("Confirm your credentials to link your Google account"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows password input field", async ({ page }) => {
    await page.goto("/link-account?email=user@example.com&provider=Google");

    await expect(page.getByTestId("link-password-input")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Confirm password")).toBeVisible();
  });

  test("shows cancel link and submit button", async ({ page }) => {
    await page.goto("/link-account?email=user@example.com&provider=Google");

    await expect(page.getByText("Cancel")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("link-submit")).toBeVisible();
    await expect(page.getByTestId("link-submit")).toHaveText("Continue");
  });

  test("cancel link navigates to login", async ({ page }) => {
    await page.goto("/link-account?email=user@example.com&provider=Google");

    await expect(page.getByText("Cancel")).toBeVisible({ timeout: 10000 });

    const cancelLink = page.getByRole("link", { name: "Cancel" });
    await expect(cancelLink).toHaveAttribute("href", "/login");
  });

  test("password field is auto-focused", async ({ page }) => {
    await page.goto("/link-account?email=user@example.com&provider=Google");

    const passwordInput = page.getByTestId("link-password-input");
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeFocused();
  });
});
