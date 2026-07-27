/**
 * Terms-acceptance gate — mocked-tier specs (spec § 6, § 8).
 *
 * Claims under test (test the claim, not the implementation):
 *  1. A `terms_acceptance_required` 403 on any API call routes to the
 *     full-screen `/accept-terms` gate — and the gate cannot be skipped
 *     by navigating away while still gated.
 *  2. The gate renders the capacity-specific checkbox (owner vs member
 *     wording — the platform's TERMS_PRESENTATIONS verbatim), unticked,
 *     with "Agree and continue" disabled until checked.
 *  3. Accepting POSTs the echoed rendered versions and unblocks.
 *  4. A stale echo (409 terms_version_stale) re-fetches and re-renders.
 *  5. `blocked_on_owner` shows the hold screen, not the checkbox.
 *
 * The ai_ack / AI-disclaimer claims from web-app are NOT tested here:
 * crm-web has no AI surface (no chat input) — the AiAckModalHost stays
 * mounted at the root for any future AI feature, but there is nothing
 * to drive it through yet.
 */

import { test, expect } from "./fixtures/chat.fixture";
import type { Page } from "@playwright/test";
import {
  createAcceptedTermsStatus,
  createAcceptanceResponse,
  createMemberGateStatus,
  createOwnerGateStatus,
  createTermsGate403Body,
  createTermsStale409Body,
  createTermsStatus,
} from "./handlers/terms.handlers";
import { GATE_CHECKBOX, GATE_HEADLINE } from "../src/lib/terms/presentations";

/**
 * Install a stateful platform-faithful gate: while `gated`, EVERY
 * /v1/* call except /v1/terms/* 403s with the gate envelope (exactly
 * what the platform's TermsEnforcementInterceptor does); the status
 * endpoint reports the gated state; a successful tos_acceptances POST
 * flips the whole thing open.
 */
async function installGate(
  page: Page,
  gateStatus = createOwnerGateStatus(),
): Promise<{
  state: { gated: boolean; staleOnce: boolean; acceptBodies: unknown[] };
}> {
  const state = { gated: true, staleOnce: false, acceptBodies: [] as unknown[] };

  // Blanket 403 while gated — registered first so the later (LIFO-
  // earlier) terms routes win for /v1/terms/*.
  await page.route(
    (url) =>
      url.pathname.startsWith("/v1/") && !url.pathname.startsWith("/v1/terms/"),
    async (route) => {
      if (!state.gated) return route.fallback();
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify(createTermsGate403Body(gateStatus)),
      });
    },
  );

  await page.route(
    (url) => url.pathname === "/v1/terms/status",
    async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          state.gated ? gateStatus : createAcceptedTermsStatus(),
        ),
      });
    },
  );

  await page.route(
    (url) => url.pathname === "/v1/terms/tos_acceptances",
    async (route, request) => {
      if (request.method() !== "POST") return route.fallback();
      state.acceptBodies.push(request.postDataJSON());
      if (state.staleOnce) {
        state.staleOnce = false;
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify(createTermsStale409Body()),
        });
        return;
      }
      state.gated = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createAcceptanceResponse()),
      });
    },
  );

  return { state };
}

test.describe("terms-acceptance gate", () => {
  // Every test here drives multiple full page loads through the
  // gate-redirect cycle; under the full parallel suite the dev server's
  // on-demand route compiles routinely eat most of the default 30s.
  test.describe.configure({ timeout: 90_000 });

  test("gated 403 routes to /accept-terms; owner accepts and the app opens", async ({
    authedPage,
  }) => {
    const { state } = await installGate(authedPage);

    await authedPage.goto("/sales");
    await authedPage.waitForURL("**/accept-terms");

    // Owner variant, verbatim platform copy.
    await expect(
      authedPage.getByText(GATE_HEADLINE.en, { exact: true }),
    ).toBeVisible();
    await expect(
      authedPage.getByText(GATE_CHECKBOX.gate_signatory.en, { exact: true }),
    ).toBeVisible();

    // Unticked checkbox gates the button.
    const checkbox = authedPage.getByTestId("terms-agree-checkbox");
    const continueBtn = authedPage.getByTestId("terms-agree-continue");
    await expect(checkbox).not.toBeChecked();
    await expect(continueBtn).toBeDisabled();

    await checkbox.check();
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // Acceptance recorded with the echoed rendered versions, then the
    // app opens at the post-login home.
    await authedPage.waitForURL("**/sales");
    expect(state.acceptBodies).toHaveLength(1);
    expect(state.acceptBodies[0]).toEqual({
      locale_displayed: "en",
      echoed: [
        { document_key: "tos", version: "1.0.0-draft" },
        { document_key: "privacy_notice", version: "1.0.0-draft" },
      ],
    });
  });

  test("the gate cannot be skipped — navigating away bounces back while gated", async ({
    authedPage,
  }) => {
    await installGate(authedPage);

    await authedPage.goto("/sales");
    await authedPage.waitForURL("**/accept-terms");

    // Direct navigation attempts land back on the gate: the first
    // API call from any app surface 403s and the interceptor routes
    // straight back.
    await authedPage.goto("/research");
    await authedPage.waitForURL("**/accept-terms");
    await expect(
      authedPage.getByTestId("terms-agree-checkbox"),
    ).toBeVisible();
  });

  test("member variant renders the member checkbox wording", async ({
    authedPage,
  }) => {
    await installGate(authedPage, createMemberGateStatus());

    await authedPage.goto("/accept-terms");
    await expect(
      authedPage.getByText(GATE_CHECKBOX.gate_member.en, { exact: true }),
    ).toBeVisible();
    // Members never see the firm-binding claim.
    await expect(
      authedPage.getByText(GATE_CHECKBOX.gate_signatory.en, { exact: true }),
    ).toHaveCount(0);
  });

  test("member before owner sees the hold screen", async ({ authedPage }) => {
    await installGate(
      authedPage,
      createTermsStatus({ blockedOnOwner: true }),
    );

    await authedPage.goto("/accept-terms");
    await expect(authedPage.getByTestId("terms-hold-screen")).toBeVisible();
    await expect(
      authedPage.getByText(
        "Your firm’s owner needs to accept the terms before the workspace opens.",
      ),
    ).toBeVisible();
    // No checkbox on the hold screen.
    await expect(
      authedPage.getByTestId("terms-agree-checkbox"),
    ).toHaveCount(0);
    await expect(authedPage.getByTestId("terms-sign-out")).toBeVisible();
  });

  test("stale echo (409) re-fetches and re-renders with a notice", async ({
    authedPage,
  }) => {
    const { state } = await installGate(authedPage);
    state.staleOnce = true;

    await authedPage.goto("/accept-terms");
    await authedPage.getByTestId("terms-agree-checkbox").check();
    await authedPage.getByTestId("terms-agree-continue").click();

    // First POST 409s → the screen re-fetches status, shows the notice,
    // and requires a fresh tick.
    await expect(authedPage.getByTestId("terms-stale-notice")).toBeVisible();
    const checkbox = authedPage.getByTestId("terms-agree-checkbox");
    await expect(checkbox).not.toBeChecked();

    await checkbox.check();
    await authedPage.getByTestId("terms-agree-continue").click();
    await authedPage.waitForURL("**/sales");
    expect(state.acceptBodies).toHaveLength(2);
  });

  test("visiting /accept-terms while already accepted goes straight to the app", async ({
    authedPage,
  }) => {
    // Fixture default: fully-accepted terms status.
    await authedPage.goto("/accept-terms");
    await authedPage.waitForURL("**/sales");
  });

  test("?preview renders the gate for an accepted account without redirecting (view-only re-read)", async ({
    authedPage,
  }) => {
    // Fixture default: fully-accepted status — normally this redirects.
    await authedPage.goto("/accept-terms?preview=1");
    await expect(authedPage.getByTestId("terms-preview-note")).toBeVisible();
    await expect(
      authedPage.getByText(GATE_CHECKBOX.gate_signatory.en, { exact: true }),
    ).toBeVisible();
    await expect(authedPage).toHaveURL(/accept-terms\?preview=1/);

    // Member wording + hold screen variants.
    await authedPage.goto("/accept-terms?preview=1&variant=member");
    await expect(
      authedPage.getByText(GATE_CHECKBOX.gate_member.en, { exact: true }),
    ).toBeVisible();
    await authedPage.goto("/accept-terms?preview=hold");
    await expect(authedPage.getByTestId("terms-hold-screen")).toBeVisible();
  });
});

