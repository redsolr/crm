/**
 * Owned invite flow E2E (Tier 1 — mocked). Rebuilt 2026-08-03 with the
 * own-the-invite-flow arc (the previous spec drove the fork-era page
 * against platform endpoints this backend never served).
 *
 * Claims:
 * - `/invite/<code>` renders OUR branded card (never a WorkOS screen):
 *   invited email, inviter name, Continue with Google, password form.
 * - Password accept posts method:password and lands in the app.
 * - OAuth accept posts method:oauth and follows the returned
 *   `/login/google?login_hint=…` URL.
 * - Invalid/expired codes explain themselves with a path to /login.
 * - Account → Team creates invites, surfaces the link, revokes.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { API_ROOT } from "./handlers/shared";

const CODE = "e2e-invite-code-123";

const PENDING_INVITE = {
  invite: {
    email: "newbie@example.com",
    status: "pending",
    invited_by_name: "Kreethup",
    expires_at: "2026-12-31T00:00:00.000Z",
  },
};

test.describe("Invite accept page", () => {
  test.beforeEach(async ({ authedPage }) => {
    // The invitee is signed OUT by definition.
    await authedPage.addInitScript(() => {
      sessionStorage.setItem("dev-mock-explicit-signed-out", "true");
    });
  });

  test("renders the branded card for a valid code", async ({ authedPage }) => {
    await authedPage.route(`${API_ROOT}/invite/${CODE}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PENDING_INVITE),
      });
    });
    await authedPage.goto(`/invite/${CODE}`);

    await expect(authedPage.getByTestId("invite-title")).toHaveText(
      "Join Jurisimus CRM",
    );
    await expect(authedPage.getByTestId("invite-email")).toHaveText(
      "newbie@example.com",
    );
    await expect(authedPage.getByTestId("invite-card")).toContainText(
      "Kreethup invited you",
    );
    await expect(authedPage.getByTestId("invite-btn-google")).toBeVisible();
    await expect(authedPage.getByTestId("invite-password-form")).toBeVisible();
  });

  test("password accept posts the fields and lands in the app", async ({
    authedPage,
  }) => {
    await authedPage.route(`${API_ROOT}/invite/${CODE}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PENDING_INVITE),
      });
    });
    let acceptBody: unknown = null;
    await authedPage.route(
      `${API_ROOT}/invite/${CODE}/accept`,
      async (route, request) => {
        acceptBody = request.postDataJSON();
        // Accepting signs the invitee in — lift the signed-out flag so
        // the app shell renders after the redirect.
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ next: "/sales" }),
        });
      },
    );
    await authedPage.goto(`/invite/${CODE}`);
    await authedPage.evaluate(() =>
      sessionStorage.removeItem("dev-mock-explicit-signed-out"),
    );

    await authedPage.getByTestId("invite-first-name").fill("New");
    await authedPage.getByTestId("invite-last-name").fill("Teammate");
    await authedPage
      .getByTestId("invite-password-input")
      .fill("a-long-enough-password");
    await authedPage.getByTestId("invite-submit").click();

    await authedPage.waitForURL("**/sales", { timeout: 10000 });
    expect(acceptBody).toEqual({
      method: "password",
      first_name: "New",
      last_name: "Teammate",
      password: "a-long-enough-password",
    });
  });

  test("short passwords are rejected client-side", async ({ authedPage }) => {
    await authedPage.route(`${API_ROOT}/invite/${CODE}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PENDING_INVITE),
      });
    });
    await authedPage.goto(`/invite/${CODE}`);
    await authedPage.getByTestId("invite-password-input").fill("short");
    await authedPage.getByTestId("invite-submit").click();
    await expect(
      authedPage.getByText("Password must be at least 10 characters."),
    ).toBeVisible();
  });

  test("OAuth accept follows the login_hint URL", async ({ authedPage }) => {
    await authedPage.route(`${API_ROOT}/invite/${CODE}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PENDING_INVITE),
      });
    });
    await authedPage.route(
      `${API_ROOT}/invite/${CODE}/accept`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            next: "/login/google?login_hint=newbie%40example.com",
          }),
        });
      },
    );
    // Stub the provider redirect route — the real one 307s to Google.
    await authedPage.route("**/login/google**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body data-testid='oauth-stub'>oauth</body></html>",
      });
    });

    await authedPage.goto(`/invite/${CODE}`);
    await authedPage.getByTestId("invite-btn-google").click();
    await authedPage.waitForURL("**/login/google**", { timeout: 10000 });
    expect(authedPage.url()).toContain("login_hint=newbie%40example.com");
  });

  test("invalid codes explain themselves", async ({ authedPage }) => {
    await authedPage.route(`${API_ROOT}/invite/${CODE}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 404,
          error: "Not Found",
          code: "invite_expired",
          message: "This invite has expired — ask for a new one.",
        }),
      });
    });
    await authedPage.goto(`/invite/${CODE}`);
    await expect(authedPage.getByTestId("invite-invalid")).toBeVisible();
    await expect(authedPage.getByTestId("invite-invalid")).toContainText(
      "This invite has expired",
    );
    await expect(
      authedPage.getByRole("link", { name: "Go to sign in" }),
    ).toBeVisible();
  });
});

test.describe("Account → Team invites", () => {
  test("creates an invite, shows the link, revokes it", async ({
    authedPage,
  }) => {
    const invites: Array<Record<string, unknown>> = [];
    await authedPage.route(`${API_ROOT}/invites`, async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: invites }),
        });
        return;
      }
      if (request.method() === "POST") {
        const body = request.postDataJSON() as { email: string };
        const invite = {
          id: "inv_e2e_1",
          email: body.email,
          status: "pending",
          invite_path: "/invite/e2e-minted-code",
          invited_by_name: "E2E Test User",
          expires_at: "2026-12-31T00:00:00.000Z",
          accepted_at: null,
          revoked_at: null,
          created_at: "2026-08-03T00:00:00.000Z",
        };
        invites.push(invite);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ invite }),
        });
        return;
      }
      await route.fallback();
    });
    await authedPage.route(
      `${API_ROOT}/invites/inv_e2e_1`,
      async (route, request) => {
        if (request.method() !== "DELETE") return route.fallback();
        const invite = invites[0] as { status: string; revoked_at: unknown };
        invite.status = "revoked";
        invite.revoked_at = "2026-08-03T01:00:00.000Z";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ invite: invites[0] }),
        });
      },
    );

    await authedPage.goto("/account");
    await expect(authedPage.getByTestId("account-invites")).toBeVisible();
    await expect(authedPage.getByTestId("invites-empty")).toBeVisible();

    await authedPage
      .getByTestId("invites-email-input")
      .fill("newbie@example.com");
    await authedPage.getByTestId("invites-create-button").click();

    const rowLocator = authedPage.getByTestId("invites-row");
    await expect(rowLocator).toHaveCount(1);
    await expect(rowLocator).toContainText("newbie@example.com");
    await expect(authedPage.getByTestId("invites-row-status")).toHaveText(
      "pending",
    );
    await expect(authedPage.getByTestId("invites-row-copy")).toBeVisible();

    await authedPage.getByTestId("invites-row-revoke").click();
    await expect(authedPage.getByTestId("invites-row-status")).toHaveText(
      "revoked",
    );
    // Revoked rows lose their action buttons.
    await expect(authedPage.getByTestId("invites-row-copy")).toHaveCount(0);
  });
});
