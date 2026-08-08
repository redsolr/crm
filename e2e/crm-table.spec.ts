/**
 * CRM record table E2E (Tier 1 — mocked) — the Attio-core table/views
 * slice:
 *
 *   1. Companies: inline type-aware cell editing (select + url)
 *      commits through `PUT /attribute_values/:def` and SURVIVES a
 *      reload (the mock store is stateful), and editing a cell never
 *      opens the row's peek panel.
 *   2. Companies: filter bar + saved views — create a view from the
 *      current filter state, switch default ⇄ saved, delete.
 *   3. Pipeline: kanban ⇄ table toggle (persisted in localStorage),
 *      inline stage select transitions, and the closed-stage
 *      (`lost`) interception opening TransitionToClosedModal.
 *
 * Mock layer: `setupSalesHandlers` — the stateful sales-pipeline
 * template store plus the stateful `/api/views` mock added with this
 * slice.
 */

import { test, expect } from "./fixtures/auth.fixture";
import type { Page } from "@playwright/test";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { pickOption } from "./helpers/select";
import { ensureTableMode } from "./helpers/sales-ui";

const STEP_TIMEOUT = 15_000;

async function addCompany(
  page: Page,
  name: string,
  source: string = "intro",
) {
  await page.getByTestId("sales-add-account-button").click();
  await page.getByTestId("sales-account-name-input").fill(name);
  await pickOption(page.getByTestId("sales-account-source-select"), source);
  await page.getByRole("button", { name: /Add company/i }).click();
  // Modal closes when the create round-trip lands.
  await expect(page.getByTestId("sales-account-name-input")).toHaveCount(0, {
    timeout: STEP_TIMEOUT,
  });
}

async function addOpportunity(
  page: Page,
  title: string,
  accountLabel: string,
) {
  await page.getByTestId("sales-add-opportunity-button").click();
  await page.getByTestId("sales-opportunity-title-input").fill(title);
  await pickOption(page.getByTestId("sales-opportunity-account-select"), { label: accountLabel });
  await pickOption(page.getByTestId("sales-opportunity-use-case-select"), "matter_chaos");
  await page.getByRole("button", { name: /Create opportunity/i }).click();
  await expect(
    page.getByTestId("sales-opportunity-title-input"),
  ).toHaveCount(0, { timeout: STEP_TIMEOUT });
}

test.describe("CRM record table", () => {
  test("companies inline cell edit commits and survives reload", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await addCompany(authedPage, "Acme, Inc.");

    await authedPage.getByTestId("sales-nav-companies").click();
    await expect(
      authedPage.getByTestId("sales-companies-view"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    const row = authedPage.locator("[data-testid='sales-companies-row']", {
      hasText: "Acme, Inc.",
    });
    await expect(row).toBeVisible({ timeout: STEP_TIMEOUT });

    // ── Inline select edit: segment ────────────────────────────────
    await row.getByTestId("sales-companies-cell-segment").click();
    // Editing a cell must NOT open the row peek panel.
    await expect(authedPage.getByTestId("sales-peek-panel")).toHaveCount(0);
    await pickOption(authedPage.getByTestId("sales-companies-edit-segment"), "solo");
    // Select commits on change — the committed value renders
    // immediately (optimistic cache patch).
    await expect(
      row.getByTestId("sales-companies-cell-segment"),
    ).toContainText("solo", { timeout: STEP_TIMEOUT });

    // ── Inline url edit: company URL (Enter commits) ───────────────
    await row.getByTestId("sales-companies-cell-company_url").click();
    const urlInput = authedPage.getByTestId(
      "sales-companies-edit-company_url",
    );
    await expect(urlInput).toBeVisible();
    await urlInput.fill("https://acme.dev");
    await urlInput.press("Enter");
    await expect(
      row.getByTestId("sales-companies-cell-company_url"),
    ).toContainText("https://acme.dev", { timeout: STEP_TIMEOUT });

    // ── Escape cancels without committing ──────────────────────────
    await row.getByTestId("sales-companies-cell-pain").click();
    const painInput = authedPage.getByTestId("sales-companies-edit-pain");
    await painInput.fill("scratch text that must not persist");
    await painInput.press("Escape");
    await expect(
      row.getByTestId("sales-companies-cell-pain"),
    ).toContainText("—");

    // ── Survives reload — the mock store is stateful ───────────────
    await authedPage.reload();
    await expect(
      authedPage.getByTestId("sales-companies-view"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    const rowAfter = authedPage.locator(
      "[data-testid='sales-companies-row']",
      { hasText: "Acme, Inc." },
    );
    await expect(
      rowAfter.getByTestId("sales-companies-cell-segment"),
    ).toContainText("solo", { timeout: STEP_TIMEOUT });
    await expect(
      rowAfter.getByTestId("sales-companies-cell-company_url"),
    ).toContainText("https://acme.dev");
  });

  test("companies saved views: create from filter state, switch, delete", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await addCompany(authedPage, "Solo Law");
    await addCompany(authedPage, "Big Firm LLP");

    await authedPage.getByTestId("sales-nav-companies").click();
    await expect(
      authedPage.getByTestId("sales-companies-view"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    const rows = authedPage.locator("[data-testid='sales-companies-row']");
    await expect(rows).toHaveCount(2, { timeout: STEP_TIMEOUT });

    // Stamp segments inline so the filter has something to bite on.
    const soloRow = authedPage.locator(
      "[data-testid='sales-companies-row']",
      { hasText: "Solo Law" },
    );
    await soloRow.getByTestId("sales-companies-cell-segment").click();
    await pickOption(authedPage.getByTestId("sales-companies-edit-segment"), "solo");
    await expect(
      soloRow.getByTestId("sales-companies-cell-segment"),
    ).toContainText("solo", { timeout: STEP_TIMEOUT });
    const firmRow = authedPage.locator(
      "[data-testid='sales-companies-row']",
      { hasText: "Big Firm LLP" },
    );
    await firmRow.getByTestId("sales-companies-cell-segment").click();
    await pickOption(authedPage.getByTestId("sales-companies-edit-segment"), "firm_6_10");
    await expect(
      firmRow.getByTestId("sales-companies-cell-segment"),
    ).toContainText("firm 6 10", { timeout: STEP_TIMEOUT });

    // ── Filter → 1 row; footer is a live calculation row ───────────
    await pickOption(authedPage.getByTestId("sales-companies-filter-segment"), "solo");
    await expect(rows).toHaveCount(1, { timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-companies-footer"),
    ).toContainText("1 company");

    // ── Save the current state as a view ───────────────────────────
    await authedPage.getByTestId("sales-companies-view-save").click();
    await authedPage
      .getByTestId("sales-companies-view-name-input")
      .fill("Solo firms");
    await authedPage
      .getByTestId("sales-companies-view-save-confirm")
      .click();
    // The freshly saved view becomes the active pick.
    await expect(
      authedPage.getByTestId("sales-companies-view-select"),
    ).toContainText("Solo firms", { timeout: STEP_TIMEOUT });

    // ── Switch back to the default view — filters reset ────────────
    await pickOption(authedPage.getByTestId("sales-companies-view-select"), { label: "Default view" });
    await expect(rows).toHaveCount(2, { timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-companies-filter-segment"),
    ).toHaveAttribute("data-value", "");

    // ── Re-apply the saved view — filter state restored ────────────
    await pickOption(authedPage.getByTestId("sales-companies-view-select"), { label: "Solo firms" });
    await expect(rows).toHaveCount(1, { timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-companies-filter-segment"),
    ).toHaveAttribute("data-value", "solo");

    // ── Delete the view — back to default state ────────────────────
    await authedPage.getByTestId("sales-companies-view-delete").click();
    await expect(rows).toHaveCount(2, { timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-companies-view-select"),
    ).not.toContainText("Solo firms");
  });

  test("pipeline kanban ⇄ table toggle + inline stage change + closed interception", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await addCompany(authedPage, "Acme, Inc.");
    await addOpportunity(authedPage, "Acme — Workflow pilot", "Acme, Inc.");

    // ── INBOX is the default mode (founder 2026-08-08) ─────────────
    // A fresh session (no stored choice) lands on the Inbox cockpit;
    // the Table is an explicit opt-in that then persists per user.
    await expect(
      authedPage.getByTestId("sales-pipeline-mode-inbox"),
    ).toHaveAttribute("data-active", "true");
    await ensureTableMode(authedPage);
    await expect(
      authedPage.getByTestId("sales-pipeline-table"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-kanban-board"),
    ).toHaveCount(0);
    const tableRow = authedPage.locator(
      "[data-testid='sales-pipeline-row']",
      { hasText: "Acme — Workflow pilot" },
    );
    await expect(tableRow).toBeVisible();
    // The account cell carries the company reference.
    await expect(
      tableRow.getByTestId("sales-pipeline-cell-account"),
    ).toContainText("Acme, Inc.");

    // ── Inline stage change through the select ─────────────────────
    const stageSelect = tableRow.getByTestId("sales-pipeline-stage-select");
    await pickOption(stageSelect, "contacted");
    await expect(stageSelect).toHaveAttribute("data-value", "contacted", {
      timeout: STEP_TIMEOUT,
    });

    // Persisted server-side (the mock PATCH mutated the store).
    const persistedState = await authedPage.evaluate(async () => {
      const res = await fetch(
        "http://localhost:3100/api/work_items?type_key=opportunity&workspace_id=ws-e2e-default",
        { credentials: "include" },
      );
      const body = (await res.json()) as {
        data: Array<{ state: { key: string } }>;
      };
      return body.data[0]?.state.key;
    });
    expect(persistedState).toBe("contacted");

    // ── Transition to `lost` opens the reason modal, cancel reverts ─
    await pickOption(stageSelect, "lost");
    await expect(
      authedPage.getByTestId("sales-transition-lost-reason-select"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await authedPage.getByRole("button", { name: "Cancel" }).click();
    await expect(
      authedPage.getByTestId("sales-transition-lost-reason-select"),
    ).toHaveCount(0);
    await expect(stageSelect).toHaveAttribute("data-value", "contacted");

    // ── Inline attribute edit in table mode (value estimate) ───────
    await tableRow.getByTestId("sales-pipeline-cell-value_estimate").click();
    const valueInput = authedPage.getByTestId(
      "sales-pipeline-edit-value_estimate",
    );
    await valueInput.fill("120000");
    await valueInput.press("Enter");
    await expect(
      tableRow.getByTestId("sales-pipeline-cell-value_estimate"),
    ).toContainText("฿120,000", { timeout: STEP_TIMEOUT });

    // ── Toggle to BOARD (the opt-in) ───────────────────────────────
    await authedPage.getByTestId("sales-pipeline-mode-kanban").click();
    await expect(
      authedPage.getByTestId("sales-kanban-board"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.locator("[data-testid='sales-kanban-card']", {
        hasText: "Acme — Workflow pilot",
      }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-pipeline-table"),
    ).toHaveCount(0);

    // ── Explicit board choice persists across reload (localStorage) ─
    await authedPage.reload();
    await expect(
      authedPage.getByTestId("sales-kanban-board"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // ── And back to the table ──────────────────────────────────────
    await authedPage.getByTestId("sales-pipeline-mode-table").click();
    await expect(
      authedPage.getByTestId("sales-pipeline-table"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-kanban-board"),
    ).toHaveCount(0);
  });
});
