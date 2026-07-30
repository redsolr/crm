/**
 * Route handler factories for usage validation endpoints.
 *
 * Wire contract: `POST /api/organizations/:organizationId/usage/validate`
 * (per `chatApiClient.validateChatPermission` in `src/lib/chat/client.ts`).
 * Returns the `ChatPermission` shape (snake_case). The response body is
 * built by `createUsageValidationResponse` in `shared.ts`, which validates
 * against `ChatPermissionSchema`.
 *
 * History: an earlier version of this file routed against
 * `/api/accounts/:accountId/usage/validate`. That path never existed on the
 * platform — the multi-tenant rename moved the endpoint under
 * `organizations/*`. The mock silently never matched, so every chat spec
 * saw "Failed to validate usage permissions" instead of the configured
 * ChatPermission.
 */

import { Page } from "@playwright/test";
import { API_ROOT, TEST_USER, createUsageValidationResponse } from "./shared";

/**
 * Set up usage validation handler with configurable responses.
 */
export async function setupUsageHandlers(
  page: Page,
  overrides?: {
    allowed?: boolean;
    selected_model?: string;
    usage_percentage?: number;
    warning_message?: string | undefined;
  },
) {
  // POST /api/organizations/:organizationId/usage/validate
  await page.route(
    `${API_ROOT}/organizations/${TEST_USER.organization_id}/usage/validate`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createUsageValidationResponse(overrides)),
      });
    },
  );
}

/**
 * Set up usage handler that denies access (limit exceeded).
 */
export async function setupUsageLimitExceeded(page: Page) {
  await page.route(
    `${API_ROOT}/organizations/${TEST_USER.organization_id}/usage/validate`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          createUsageValidationResponse({
            allowed: false,
            reason: "Monthly usage limit reached. Upgrade your plan.",
            usage_percentage: 100,
            warning_message: "Monthly usage limit reached. Upgrade your plan.",
          }),
        ),
      });
    },
  );
}
