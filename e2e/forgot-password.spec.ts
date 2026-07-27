/**
 * Forgot Password page E2E tests (Tier 1 — mocked).
 */

import { test, expect, Page } from "@playwright/test";
import { API_BASE } from "./handlers/shared";

test.describe("Forgot Password Page", () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    // Block /auth/dev/login so MOCK_AUTH's E2EAuthInit can't auto-seed
    // a session against the real platform on :8080 and redirect away.
    await page.route(`${API_BASE}/auth/dev/login`, async (route) => {
      await route.abort();
    });
    await page.goto("/forgot-password");
  });

  test("renders forgot password page with title", async () => {
    await expect(
      page.getByRole("heading", { name: "Reset your password" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Enter the email address")).toBeVisible();
  });

  test("renders email input", async () => {
    await expect(page.getByTestId("forgot-email-input")).toBeVisible();
  });

  test("renders continue button", async () => {
    const button = page.locator("button[type='submit']");
    await expect(button).toBeVisible();
    await expect(button).toContainText("Continue");
  });

  test("shows return to login link", async () => {
    const link = page.getByText("Return to login");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/login");
  });

  test("shows error for empty email", async () => {
    await page.locator("button[type='submit']").click();

    await expect(page.getByText("Email is required")).toBeVisible();
  });

  test("shows Privacy and Terms in footer", async () => {
    await expect(
      page.locator(".auth-footer").getByRole("link", { name: "Privacy" }),
    ).toBeVisible();
    await expect(
      page.locator(".auth-footer").getByRole("link", { name: "Terms" }),
    ).toBeVisible();
  });
});
