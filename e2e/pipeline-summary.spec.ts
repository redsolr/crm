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
});
