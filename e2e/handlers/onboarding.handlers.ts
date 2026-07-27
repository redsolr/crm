/**
 * Route handler factories for onboarding endpoints.
 *
 * Wire contract: all endpoints live under `/v1/` (snake_case paths +
 * snake_case field names per Stripe v2 discipline).
 */

import { Page } from "@playwright/test";
import { API_V1, TEST_USER } from "./shared";

export async function setupOnboardingHandlers(page: Page) {
  // POST /v1/organizations — create org
  await page.route(`${API_V1}/organizations`, async (route, request) => {
    if (request.method() === "POST") {
      const body = JSON.parse((await request.postData()) || "{}");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          organization: {
            id: "org-e2e-001",
            name: body.name || "Test Org",
            created_at: new Date().toISOString(),
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

  // PUT /v1/accounts/{id} — save display name (profile step)
  await page.route(`${API_V1}/accounts/*`, async (route, request) => {
    if (request.method() === "PUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: TEST_USER.account_id, updated: true }),
      });
    } else {
      await route.fallback();
    }
  });

  // POST /v1/organizations/{id}/invite_links — invite step "Copy link"
  await page.route(`${API_V1}/organizations/*/invite_links`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        inviteLink: { id: "inv-e2e-001", code: "e2e-invite-code", role: "member" },
      }),
    });
  });

  // POST /v1/user_preferences/onboarding — save preferences
  await page.route(
    `${API_V1}/user_preferences/onboarding`,
    async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "pref-e2e-001",
          user_id: TEST_USER.user_id,
          roles: ["Software Engineer"],
          interests: ["code_technical"],
          response_length: "balanced",
          tone: "professional",
          onboarding_completed_at: new Date().toISOString(),
        }),
      });
    },
  );
}
