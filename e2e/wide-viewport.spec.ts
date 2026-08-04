/**
 * Wide-viewport interaction E2E (Tier 1 — mocked, 1920×900).
 *
 * The suite's default viewport (1280) never enters the ≥1440px
 * screen-centered branch, where BOTH the topbar center and the content
 * columns carry transforms — each a stacking context with its own
 * hit-testing traps. That blind spot shipped the full-screen-only
 * unclickable-suggestions bug (2026-08-04), so every major interactive
 * flow of the Jira-table arc re-runs here INSIDE that branch:
 *
 *   1. Grip drag-to-rearrange persists across the refetch.
 *   2. Boundary "+" inserts between rows at the midpoint rank.
 *   3. Bottom "+ Create" chip creates via the inline form.
 *   4. Layout-tab drag reorder persists.
 *   5. Row click opens the peek panel (overlay layering sanity).
 */

import { test, expect } from "./fixtures/auth.fixture";
import type { Page } from "@playwright/test";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import {
  STEP_TIMEOUT,
  createAccountViaUi,
  createOpportunityViaUi,
} from "./helpers/sales-ui";

test.use({ viewport: { width: 1920, height: 900 } });

async function seedPipeline(page: Page) {
  await setupSalesHandlers(page);
  await page.goto("/sales");
  await expect(page.getByTestId("sales-pipeline")).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
  await createAccountViaUi(page, "Probe Co");
  await expect(page.getByTestId("sales-account-name-input")).toHaveCount(0, {
    timeout: STEP_TIMEOUT,
  });
  for (const title of ["Deal A", "Deal B", "Deal C"]) {
    await createOpportunityViaUi(page, title);
    await expect(
      page.getByTestId("sales-opportunity-title-input"),
    ).toHaveCount(0, { timeout: STEP_TIMEOUT });
  }
  await expect(page.getByTestId("sales-pipeline-row")).toHaveCount(3, {
    timeout: STEP_TIMEOUT,
  });
}

async function titleOrder(page: Page): Promise<string[]> {
  return page.getByTestId("sales-pipeline-cell-title").allInnerTexts();
}

test.describe("Wide viewport (≥1440 screen-centered branch)", () => {
  test("grip drag reorders and persists", async ({ authedPage: page }) => {
    await seedPipeline(page);
    const rows = page.getByTestId("sales-pipeline-row");
    const first = rows.first();
    const firstBox = await first.boundingBox();
    if (!firstBox) throw new Error("no first row box");
    await page.mouse.move(firstBox.x + 150, firstBox.y + firstBox.height / 2);
    const grip = page.getByTestId("sales-pipeline-drag-handle");
    await expect(grip).toBeVisible();
    const gripBox = await grip.boundingBox();
    const lastBox = await rows.nth(2).boundingBox();
    if (!gripBox || !lastBox) throw new Error("no drag boxes");
    await page.mouse.move(
      gripBox.x + gripBox.width / 2,
      gripBox.y + gripBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      gripBox.x + gripBox.width / 2,
      lastBox.y + lastBox.height / 2,
      { steps: 12 },
    );
    await page.mouse.up();
    await expect
      .poll(async () => titleOrder(page), { timeout: STEP_TIMEOUT })
      .toEqual(["Deal B", "Deal C", "Deal A"]);
    await page.reload();
    await expect(page.getByTestId("sales-pipeline-row")).toHaveCount(3, {
      timeout: STEP_TIMEOUT,
    });
    expect(await titleOrder(page)).toEqual(["Deal B", "Deal C", "Deal A"]);
  });

  test("boundary + inserts between rows; bottom chip creates", async ({
    authedPage: page,
  }) => {
    await seedPipeline(page);

    // Between: hover Deal A's bottom padding band → "+" → create.
    const first = page.getByTestId("sales-pipeline-row").first();
    const box = await first.boundingBox();
    if (!box) throw new Error("no row box");
    await page.mouse.move(box.x + 150, box.y + box.height - 3);
    const insert = page.getByTestId("sales-pipeline-insert-after");
    await expect(insert).toBeVisible();
    await insert.click();
    const form = page.getByTestId("sales-pipeline-inline-create-form");
    await expect(form).toBeVisible();
    await page.getByTestId("sales-pipeline-inline-title").fill("Deal A2");
    await page
      .getByTestId("sales-pipeline-inline-account")
      .selectOption({ label: "Probe Co" });
    await page
      .getByTestId("sales-pipeline-inline-use-case")
      .selectOption("matter_chaos");
    await page.getByTestId("sales-pipeline-inline-submit").click();
    await expect(form).toHaveCount(0, { timeout: STEP_TIMEOUT });
    await expect
      .poll(async () => titleOrder(page), { timeout: STEP_TIMEOUT })
      .toEqual(["Deal A", "Deal A2", "Deal B", "Deal C"]);

    // Bottom chip.
    await page.getByTestId("sales-pipeline-create-row-button").click();
    await expect(form).toBeVisible();
    await page.getByTestId("sales-pipeline-inline-title").fill("Deal D");
    await page
      .getByTestId("sales-pipeline-inline-account")
      .selectOption({ label: "Probe Co" });
    await page
      .getByTestId("sales-pipeline-inline-use-case")
      .selectOption("matter_chaos");
    await page.getByTestId("sales-pipeline-inline-submit").click();
    await expect(page.getByTestId("sales-pipeline-row")).toHaveCount(5, {
      timeout: STEP_TIMEOUT,
    });
  });

  test("layout-tab drag reorders and persists", async ({
    authedPage: page,
  }) => {
    await setupSalesHandlers(page);
    await page.goto("/sales");
    await expect(
      page.getByTestId("sales-pipeline-mode-toggle"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    const tabs = page.locator(
      '[data-testid="sales-pipeline-mode-toggle"] [role="tab"]',
    );
    const board = page.getByTestId("sales-pipeline-mode-kanban");
    const summary = page.getByTestId("sales-pipeline-mode-summary");
    const boardBox = await board.boundingBox();
    const summaryBox = await summary.boundingBox();
    if (!boardBox || !summaryBox) throw new Error("no tab boxes");
    await page.mouse.move(
      boardBox.x + boardBox.width / 2,
      boardBox.y + boardBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      summaryBox.x + 4,
      summaryBox.y + summaryBox.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();
    await expect
      .poll(async () => tabs.allInnerTexts(), { timeout: STEP_TIMEOUT })
      .toEqual(["Board", "Summary", "Table"]);
    await page.reload();
    await expect(
      page.getByTestId("sales-pipeline-mode-toggle"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect
      .poll(async () => tabs.allInnerTexts(), { timeout: STEP_TIMEOUT })
      .toEqual(["Board", "Summary", "Table"]);
  });

  test("row click opens the peek panel over the centered column", async ({
    authedPage: page,
  }) => {
    await seedPipeline(page);
    // Click the TITLE cell — a row's center can land on an editable
    // cell, which (by design) opens the inline editor instead of the
    // peek.
    await page.getByTestId("sales-pipeline-cell-title").first().click();
    await expect(page.getByTestId("sales-peek-panel")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await page.keyboard.press("Escape");
  });
});
