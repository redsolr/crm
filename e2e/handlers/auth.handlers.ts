/**
 * Route handler factories for auth endpoints.
 * Intercepts WorkOS exchange + /auth/me to bypass real auth in E2E tests.
 */

import { Page } from "@playwright/test";
import { TEST_USER, TEST_TOKEN, API_BASE } from "./shared";

/**
 * Set up auth route interception.
 * Handles:
 * - POST /auth/workos/exchange → returns test JWT + user data
 * - GET /auth/me → returns test user
 * - POST /auth/logout → success
 */
export async function setupAuthHandlers(page: Page) {
  // WorkOS token exchange (called by useAuthSync on page load)
  await page.route(`${API_BASE}/auth/workos/exchange`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        accessToken: TEST_TOKEN,
        refreshToken: "e2e-refresh-token",
        expiresIn: 900,
        needsOnboarding: false,
        user: {
          id: TEST_USER.user_id,
          email: TEST_USER.email,
          fullName: TEST_USER.full_name,
          avatarUrl: TEST_USER.avatar_url,
        },
        accountId: TEST_USER.account_id,
        accountName: TEST_USER.organization_name,
        role: TEST_USER.role,
      }),
    });
  });

  // GET /auth/me — verify token
  await page.route(`${API_BASE}/auth/me`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: TEST_USER.user_id,
        email: TEST_USER.email,
        accountId: TEST_USER.account_id,
        role: TEST_USER.role,
      }),
    });
  });

  // POST /auth/logout
  await page.route(`${API_BASE}/auth/logout`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
}
