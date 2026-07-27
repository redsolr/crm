/**
 * Onboarding-specific fixture.
 * Provides an authenticated page that needs onboarding (needsOnboarding = true).
 */

import { test as base, Page } from "@playwright/test";
import { TEST_TOKEN, API_BASE } from "../handlers/shared";
import { setupAuthHandlers } from "../handlers/auth.handlers";
import { setupOnboardingHandlers } from "../handlers/onboarding.handlers";

const ONBOARDING_USER = {
  user_id: "test-user-e2e-onboarding",
  email: "onboarding@jurisimus.com",
  full_name: "New User",
  account_id: "test-account-e2e-onboarding",
  account_name: "New Account",
  role: "owner",
  needsOnboarding: true,
};

export const test = base.extend<{
  onboardingPage: Page;
}>({
  onboardingPage: async ({ page }, use) => {
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem("friendly_fortnight_token", token);
        localStorage.setItem("e2e-auth-user", JSON.stringify(user));
      },
      { token: TEST_TOKEN, user: ONBOARDING_USER },
    );

    // Auth handlers — override exchange to return needsOnboarding: true
    await page.route(`${API_BASE}/auth/workos/exchange`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          accessToken: TEST_TOKEN,
          refreshToken: "e2e-refresh-token",
          expiresIn: 900,
          needsOnboarding: true,
          user: {
            id: ONBOARDING_USER.user_id,
            email: ONBOARDING_USER.email,
            fullName: ONBOARDING_USER.full_name,
          },
          accountId: ONBOARDING_USER.account_id,
          accountName: ONBOARDING_USER.account_name,
          role: ONBOARDING_USER.role,
        }),
      });
    });

    await page.route(`${API_BASE}/auth/me`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: ONBOARDING_USER.user_id,
          email: ONBOARDING_USER.email,
          accountId: ONBOARDING_USER.account_id,
          role: ONBOARDING_USER.role,
        }),
      });
    });

    await page.route(`${API_BASE}/auth/logout`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await setupOnboardingHandlers(page);

    // Intercept background calls with empty data
    for (const path of [
      "chat/history*",
      "chat/my*",
      "findings*",
      "workspaces*",
    ]) {
      await page.route(`${API_BASE}/${path}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });
    }

    await page.route(`${API_BASE}/accounts/*/folders*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route(`${API_BASE}/organizations*`, async (route, request) => {
      if (request.method() === "POST") {
        const body = JSON.parse((await request.postData()) || "{}");
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            organization: {
              id: "org-e2e-001",
              name: body.name || "Test Org",
              createdAt: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ organizations: [] }),
        });
      }
    });

    await use(page);
  },
});

export { expect } from "@playwright/test";
