/**
 * Invite Page E2E tests (Tier 1 — mocked).
 * Tests the /invite/[code] page: validation, error states, accepting invites,
 * and post-accept redirect.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { API_V1 } from "./handlers/shared";

const INVITE_CODE = "TEST-CODE-123";
const INVITE_URL = `/invite/${INVITE_CODE}`;

const VALID_INVITE_RESPONSE = {
  invite: {
    account_id: "acc-123",
    role: "member",
    expiresAt: "2026-12-31T00:00:00Z",
  },
};

test.describe("Invite Page", () => {
  test("shows invite details for valid code", async ({ authedPage }) => {
    await authedPage.route(
      `${API_V1}/invite/${INVITE_CODE}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(VALID_INVITE_RESPONSE),
        });
      },
    );

    await authedPage.goto(INVITE_URL);

    await expect(
      authedPage.getByRole("heading", { name: "You've been invited" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(authedPage.getByText("member")).toBeVisible();
    await expect(
      authedPage.getByRole("button", { name: "Accept Invite" }),
    ).toBeVisible();
  });

  test("shows error for invalid code", async ({ authedPage }) => {
    await authedPage.route(
      `${API_V1}/invite/${INVITE_CODE}`,
      async (route) => {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "Invalid invite code" }),
        });
      },
    );

    await authedPage.goto(INVITE_URL);

    await expect(
      authedPage.getByRole("heading", { name: "Invite Invalid" }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("accepts invite and shows success", async ({ authedPage }) => {
    await authedPage.route(
      `${API_V1}/invite/${INVITE_CODE}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(VALID_INVITE_RESPONSE),
        });
      },
    );

    const acceptRequestPromise = authedPage.waitForRequest(
      (req) =>
        req.url().includes(`/invite/${INVITE_CODE}/accept`) &&
        req.method() === "POST",
    );

    await authedPage.route(
      `${API_V1}/invite/${INVITE_CODE}/accept`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      },
    );

    await authedPage.goto(INVITE_URL);

    await expect(
      authedPage.getByRole("button", { name: "Accept Invite" }),
    ).toBeVisible({ timeout: 10000 });
    await authedPage.getByRole("button", { name: "Accept Invite" }).click();

    // Verify the accept POST was made
    await acceptRequestPromise;

    // The page shows "You're in!" briefly then redirects to "/", which routes
    // on to the app landing (/sales). Verify by waiting for that end state.
    await authedPage.waitForURL(/\/sales/, { timeout: 10000 });
  });

  test("redirects to workspace after accepting", async ({ authedPage }) => {
    await authedPage.route(
      `${API_V1}/invite/${INVITE_CODE}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(VALID_INVITE_RESPONSE),
        });
      },
    );

    await authedPage.route(
      `${API_V1}/invite/${INVITE_CODE}/accept`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      },
    );

    await authedPage.goto(INVITE_URL);

    await expect(
      authedPage.getByRole("button", { name: "Accept Invite" }),
    ).toBeVisible({ timeout: 10000 });
    await authedPage.getByRole("button", { name: "Accept Invite" }).click();

    // Page auto-redirects to "/" after 1.5s, which routes on to /sales.
    await authedPage.waitForURL(/\/sales/, { timeout: 10000 });
    const pathname = new URL(authedPage.url()).pathname;
    expect(pathname.startsWith("/sales")).toBe(true);
  });
});
