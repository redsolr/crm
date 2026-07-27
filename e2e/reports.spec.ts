/**
 * Reports E2E (Tier 1 — mocked).
 *
 * Claims under test:
 *  1. /sales/reports renders the KPI row + report cards on an empty
 *     workspace with honest empty/zero states (no crash, no fake data).
 *  2. Creating a company + opportunity through the product UI is
 *     reflected in the reports: active-pipeline value, open-opportunity
 *     count, company count, stage bars, and source bars all update.
 *
 * Mock layer: `setupSalesHandlers` — the same stateful in-memory store
 * the sales-journey spec drives, so the reports read exactly what the
 * pipeline wrote.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";

const STEP_TIMEOUT = 15_000;

test.describe("Reports", () => {
  test("renders empty states, then reflects pipeline activity", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);

    // ── Empty workspace: zeros + honest empties ────────────────────
    await authedPage.goto("/sales/reports");
    await expect(
      authedPage.getByTestId("sales-reports-view"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    await expect(
      authedPage.getByTestId("report-stat-active-value"),
    ).toContainText("$0");
    await expect(
      authedPage.getByTestId("report-stat-companies"),
    ).toContainText("0");
    await expect(
      authedPage.getByTestId("report-card-sources").getByText("No data yet."),
    ).toBeVisible();
    await expect(
      authedPage.getByTestId("report-roster-empty"),
    ).toBeVisible();

    // Reports is a first-class nav destination now, not "Soon".
    await expect(
      authedPage.getByTestId("sales-nav-reports"),
    ).toBeEnabled();
    await expect(
      authedPage.getByTestId("sales-nav-reports").locator(".crm-nav-item-soon"),
    ).toHaveCount(0);

    // ── Log a company + opportunity through the product UI ─────────
    await authedPage.goto("/sales");
    await authedPage.getByTestId("sales-add-account-button").click();
    await authedPage
      .getByTestId("sales-account-name-input")
      .fill("Acme, Inc.");
    await authedPage
      .getByTestId("sales-account-source-select")
      .selectOption("intro");
    await authedPage.getByRole("button", { name: /Add company/i }).click();
    await expect(authedPage.getByText(/1 account/)).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    await authedPage.getByTestId("sales-add-opportunity-button").click();
    await authedPage
      .getByTestId("sales-opportunity-title-input")
      .fill("Acme — Workflow pilot");
    await authedPage
      .getByTestId("sales-opportunity-account-select")
      .selectOption({ label: "Acme, Inc." });
    await authedPage
      .getByTestId("sales-opportunity-use-case-select")
      .selectOption("matter_chaos");
    await authedPage.locator('input[type="number"]').first().fill("120000");
    await authedPage
      .getByRole("button", { name: /Create opportunity/i })
      .click();
    await expect(
      authedPage.getByTestId("sales-pipeline-value"),
    ).toContainText("$120,000 active", { timeout: STEP_TIMEOUT });

    // ── Reports reflect the pipeline ───────────────────────────────
    await authedPage.getByTestId("sales-nav-reports").click();
    await expect(
      authedPage.getByTestId("sales-reports-view"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    await expect(
      authedPage.getByTestId("report-stat-active-value"),
    ).toContainText("$120,000", { timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("report-stat-active-value"),
    ).toContainText("1 open opportunity");
    await expect(
      authedPage.getByTestId("report-stat-companies"),
    ).toContainText("1");

    // Stage bar: the new opportunity sits in Identified.
    const stageCard = authedPage.getByTestId("report-card-stage-count");
    const identifiedRow = stageCard
      .locator(".crm-bar-row")
      .filter({ hasText: "Identified" });
    await expect(identifiedRow.locator(".crm-bar-value")).toHaveText("1", {
      timeout: STEP_TIMEOUT,
    });

    // Source donut: the Intro slice carries the company, with a legend
    // row (identity is never color-alone — dataviz rule).
    const sourceChart = authedPage.getByTestId("report-chart-sources");
    await expect(sourceChart).toBeVisible({ timeout: STEP_TIMEOUT });
    const introLegend = sourceChart
      .locator(".crm-chart-legend li")
      .filter({ hasText: "Intro" });
    await expect(introLegend).toContainText("1");

    // Monthly chart: the deal registers as created this month.
    await expect(
      authedPage.getByTestId("report-chart-monthly"),
    ).toBeVisible();

    // Calls line renders (zero calls — flat but present).
    await expect(
      authedPage.getByTestId("report-chart-calls"),
    ).toBeVisible();

    // Stage roster: Acme sits at Identified, value + next-action state
    // visible — the founder's "who's where right now" table.
    const rosterRow = authedPage
      .getByTestId("report-roster-stage-identified")
      .filter({ hasText: "Acme, Inc." });
    await expect(rosterRow).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(rosterRow).toContainText("Acme — Workflow pilot");
    await expect(rosterRow).toContainText("$120,000");
    await expect(rosterRow.locator(".crm-badge-warn")).toHaveText("none");

    // Roster rows click through to the deal.
    await rosterRow.click();
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
  });
});
