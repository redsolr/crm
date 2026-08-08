/**
 * Inbox follow-up intelligence E2E (Tier 1 — mocked).
 *
 * The "Needs attention" panel claims: an active deal with an overdue
 * next action surfaces with the Overdue badge; an active deal with no
 * planned step surfaces as "No next step"; rows click through to the
 * opportunity; overdue outranks no-next-step; a healthy deal (future
 * next action) does not appear.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import {
  STEP_TIMEOUT,
  ensureBoardMode,
  ensureInboxMode,
  createAccountViaUi,
  createOpportunityViaUi,
} from "./helpers/sales-ui";

function isoDaysFromToday(delta: number): string {
  const d = new Date(Date.now() + delta * 86_400_000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

test.describe("Inbox follow-up intelligence", () => {
  test("ranks overdue and no-next-step deals, hides healthy ones, clicks through", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await ensureBoardMode(authedPage); // awaitCard drives kanban cards

    await createAccountViaUi(authedPage, "Followup Firm");
    await createOpportunityViaUi(authedPage, "Overdue deal", {
      nextAction: "Follow up",
      nextActionDate: isoDaysFromToday(-3),
      awaitCard: true,
    });
    await createOpportunityViaUi(authedPage, "Planless deal", {
      awaitCard: true,
    });
    await createOpportunityViaUi(authedPage, "Healthy deal", {
      nextAction: "Follow up",
      nextActionDate: isoDaysFromToday(+7),
      awaitCard: true,
    });

    await ensureInboxMode(authedPage); // the Inbox is the first Pipeline tab
    const panel = authedPage.getByTestId("sales-followup-panel");
    await expect(panel).toBeVisible({ timeout: STEP_TIMEOUT });

    const rows = authedPage.getByTestId("sales-followup-row");
    await expect(rows).toHaveCount(2, { timeout: STEP_TIMEOUT });

    // Severity order: overdue first, then no-next-step.
    await expect(rows.nth(0)).toContainText("Overdue deal");
    await expect(rows.nth(0)).toHaveAttribute(
      "data-reason",
      "overdue_next_action",
    );
    await expect(rows.nth(0)).toContainText("days overdue");
    await expect(rows.nth(1)).toContainText("Planless deal");
    await expect(rows.nth(1)).toHaveAttribute(
      "data-reason",
      "no_next_action",
    );

    // A healthy deal never nags.
    await expect(panel).not.toContainText("Healthy deal");

    // Row click lands on the opportunity detail.
    await rows.nth(0).click();
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-opportunity-title"),
    ).toContainText("Overdue deal");
  });
});
