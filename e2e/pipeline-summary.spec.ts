/**
 * Pipeline Summary tab (Tier 1 — mocked) — the day-start feed.
 *
 * Claims (2026-08-04, after the modern-CRM scan):
 * - The tab strip is Summary | Table | Board; the pulse strip carries
 *   the due count (overdue/today next actions + commitments).
 * - Due & overdue lists the overdue next action; Overlooked lists
 *   active deals with no next action.
 * - Rows open the URL-routed peek (?peek=).
 * - The chosen tab persists across reload (localStorage).
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import {
  createAccountViaUi,
  createOpportunityViaUi,
  STEP_TIMEOUT,
} from "./helpers/sales-ui";
import { localDate } from "./helpers/dates";

test.describe("Pipeline Summary tab", () => {
  test("day feed: due actions, overlooked deals, badge, persistence", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    await createAccountViaUi(authedPage, "Summary Firm");
    await createOpportunityViaUi(authedPage, "Summary overdue deal", {
      nextAction: "Chase the proposal",
      nextActionDate: localDate(-2),
    });
    await createOpportunityViaUi(authedPage, "Summary overlooked deal");

    await authedPage.getByTestId("sales-pipeline-mode-summary").click();
    await expect(
      authedPage.getByTestId("sales-pipeline-summary"),
    ).toBeVisible();

    // The pulse strip carries the due count.
    await expect(authedPage.getByTestId("summary-pulse")).toContainText(
      "1 due",
      { timeout: STEP_TIMEOUT },
    );

    // Due & overdue carries the overdue next action.
    const dueRow = authedPage.getByTestId("summary-action-row");
    await expect(dueRow).toHaveCount(1);
    await expect(dueRow).toContainText("Chase the proposal");
    await expect(dueRow).toContainText("Summary overdue deal");

    // Overlooked carries the deal with no next action.
    const overlooked = authedPage.getByTestId("summary-overlooked-row");
    await expect(overlooked).toHaveCount(1);
    await expect(overlooked).toContainText("Summary overlooked deal");

    // Rows open the URL-routed peek.
    await overlooked.click();
    await expect(authedPage.getByTestId("sales-peek-panel")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await expect(authedPage).toHaveURL(/\?peek=/);
    await authedPage.getByTestId("sales-peek-close").click();
    await expect(authedPage.getByTestId("sales-peek-panel")).toHaveCount(0);

    // The chosen tab persists across reload.
    await authedPage.reload();
    await expect(
      authedPage.getByTestId("sales-pipeline-summary"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
  });

  test("morning-digest card: drafts render and copy to the clipboard", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    // Later registrations win: override the default `digest: null`.
    await authedPage.route("**/api/digest/latest", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          digest: {
            run_date: localDate(0),
            generated_at: new Date().toISOString(),
            attention: [],
            due_commitments: [],
            drafts: [
              {
                opportunity_id: "wi-digest-1",
                identifier: "CRM-90",
                title: "Digest deal",
                account_name: "Digest Firm",
                draft:
                  "Hi Khun A — following up on the pilot scope we discussed; happy to walk the partners through it this week.",
              },
            ],
            drafts_model: "gpt-5.4-mini",
            drafts_error: null,
          },
        }),
      });
    });

    await authedPage.goto("/sales");
    await authedPage.getByTestId("sales-pipeline-mode-summary").click();

    const card = authedPage.getByTestId("summary-digest-card");
    await expect(card).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(authedPage.getByTestId("digest-run-date")).toHaveText(
      localDate(0),
    );

    const draftRow = authedPage.getByTestId("digest-draft-row");
    await expect(draftRow).toHaveCount(1);
    await expect(draftRow).toContainText("Digest deal · Digest Firm");
    await expect(draftRow).toContainText("following up on the pilot scope");

    // Copy puts the draft on the clipboard and confirms inline.
    await authedPage
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await authedPage.getByTestId("digest-draft-copy").click();
    await expect(authedPage.getByTestId("digest-draft-copy")).toHaveText(
      "Copied",
    );
    const clipboard = await authedPage.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboard).toContain("following up on the pilot scope");

    // In dev there is no service worker, so no push toggle renders.
    await expect(
      authedPage.getByTestId("digest-push-toggle"),
    ).toHaveCount(0);
  });

  test("morning-digest card: hidden entirely before the first run", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await authedPage.getByTestId("sales-pipeline-mode-summary").click();
    await expect(
      authedPage.getByTestId("sales-pipeline-summary"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    // digest: null + no SW registration → the card contributes no chrome.
    await expect(
      authedPage.getByTestId("summary-digest-card"),
    ).toHaveCount(0);
  });

  test("morning-digest card: a drafting failure is surfaced, never silent", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.route("**/api/digest/latest", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          digest: {
            run_date: localDate(0),
            generated_at: new Date().toISOString(),
            attention: [],
            due_commitments: [],
            drafts: [],
            drafts_model: null,
            drafts_error: "OPENAI_API_KEY is not configured",
          },
        }),
      });
    });

    await authedPage.goto("/sales");
    await authedPage.getByTestId("sales-pipeline-mode-summary").click();
    await expect(
      authedPage.getByTestId("summary-digest-card"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("digest-drafts-error"),
    ).toContainText("OPENAI_API_KEY");
  });
});
