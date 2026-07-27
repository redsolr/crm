/**
 * Record-page activity timeline E2E (Tier 1 — mocked).
 *
 * Claims: logging a call renders a call-note timeline entry (with the
 * outcome badge) on the opportunity page; recording a commitment
 * renders a commitment entry with its due date; the ACCOUNT page rolls
 * the same call note up across the account's opportunities.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import {
  STEP_TIMEOUT,
  ensureBoardMode,
  openFullViewViaPeek,
  createAccountViaUi,
  createOpportunityViaUi,
} from "./helpers/sales-ui";

test.describe("Record-page activity timeline", () => {
  test("call notes and commitments land on both record timelines", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await ensureBoardMode(authedPage); // the card→peek path drives the board

    // Seed: account + opportunity.
    await createAccountViaUi(authedPage, "Timeline Firm");
    await createOpportunityViaUi(authedPage, "Timeline — pilot");

    const card = authedPage.locator("[data-testid='sales-kanban-card']", {
      hasText: "Timeline — pilot",
    });
    await expect(card).toBeVisible({ timeout: STEP_TIMEOUT });
    await openFullViewViaPeek(authedPage, card);
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // Empty timeline first — honest empty state, not a spinner.
    await expect(
      authedPage.getByTestId("sales-opportunity-timeline"),
    ).toContainText("No touches yet");

    // ── Log a call → call-note entry with outcome badge ───────────
    await authedPage.getByTestId("sales-add-call-note-button").click();
    await authedPage
      .getByTestId("sales-call-note-title-input")
      .fill("Discovery call");
    await authedPage
      .getByTestId("sales-call-note-outcome-select")
      .selectOption("positive");
    await authedPage
      .getByRole("button", { name: "Log call", exact: true })
      .click();

    const callEntry = authedPage.getByTestId("sales-timeline-call_note");
    await expect(callEntry).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(callEntry).toContainText("Discovery call");
    await expect(callEntry).toContainText("positive");

    // ── Record a commitment → commitment entry with due date ──────
    await authedPage.getByTestId("sales-add-commitment-button").click();
    await authedPage
      .getByTestId("sales-commitment-title-input")
      .fill("Send proposal");
    await authedPage
      .getByTestId("sales-commitment-due-date-input")
      .fill("2026-12-31");
    await authedPage
      .getByRole("button", { name: "Record commitment", exact: true })
      .click();

    const commitmentEntry = authedPage.getByTestId(
      "sales-timeline-commitment",
    );
    await expect(commitmentEntry).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(commitmentEntry).toContainText("Send proposal");
    await expect(commitmentEntry).toContainText("due 2026-12-31");

    // ── Account page rolls the call note up across opportunities ──
    await authedPage.getByTestId("sales-nav-companies").click();
    const row = authedPage.locator(
      "[data-testid='sales-companies-row']",
      { hasText: "Timeline Firm" },
    );
    await openFullViewViaPeek(
      authedPage,
      row.getByTestId("sales-companies-cell-company"),
    );
    await expect(
      authedPage.getByTestId("sales-account-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    const accountTimeline = authedPage.getByTestId("sales-account-timeline");
    await expect(accountTimeline).toContainText("Discovery call", {
      timeout: STEP_TIMEOUT,
    });
  });
});
