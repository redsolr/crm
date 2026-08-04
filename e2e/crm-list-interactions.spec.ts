/**
 * Pipeline list interactions E2E (Tier 1 — mocked) — the Jira-style
 * list slice (2026-08-04):
 *
 *   1. Bottom "+ Create" chip → inline form → record lands; the form
 *      stays open and clears for rapid entry (Jira behavior).
 *   2. Boundary "+" (hover a row's bottom padding band) → inline form
 *      between rows → the record lands AT that slot (midpoint rank —
 *      the mock store persists `position` and lists in server order).
 *   3. Drag-to-rearrange by the overlay grip → PATCHed rank survives
 *      the refetch (not just the optimistic order).
 *   4. A column sort hides both affordances (manual rank is only
 *      truthful in rank order); clearing the sort restores them.
 *
 * Mock layer: `setupSalesHandlers` — stateful store honoring
 * `position` on create/PATCH and server list order.
 */

import { test, expect } from "./fixtures/auth.fixture";
import type { Page } from "@playwright/test";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import {
  STEP_TIMEOUT,
  createAccountViaUi,
  createOpportunityViaUi,
} from "./helpers/sales-ui";

/** Seed a company + three opportunities and land on the table. */
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

test.describe("Pipeline list interactions", () => {
  test("bottom + Create chip creates and stays open for rapid entry", async ({
    authedPage: page,
  }) => {
    await seedPipeline(page);

    await page.getByTestId("sales-pipeline-create-row-button").click();
    const form = page.getByTestId("sales-pipeline-inline-create-form");
    await expect(form).toBeVisible();

    await page.getByTestId("sales-pipeline-inline-title").fill("Deal D");
    await page
      .getByTestId("sales-pipeline-inline-account")
      .selectOption({ label: "Probe Co" });
    await page
      .getByTestId("sales-pipeline-inline-use-case")
      .selectOption("matter_chaos");
    await page.getByTestId("sales-pipeline-inline-submit").click();

    await expect(page.getByTestId("sales-pipeline-row")).toHaveCount(4, {
      timeout: STEP_TIMEOUT,
    });
    // Rapid entry: the form is still open, title cleared, company kept.
    await expect(form).toBeVisible();
    await expect(page.getByTestId("sales-pipeline-inline-title")).toHaveValue(
      "",
    );
    await expect(
      page.getByTestId("sales-pipeline-inline-account"),
    ).not.toHaveValue("");

    await page.getByTestId("sales-pipeline-inline-cancel").click();
    await expect(form).toHaveCount(0);
    expect(await titleOrder(page)).toEqual([
      "Deal A",
      "Deal B",
      "Deal C",
      "Deal D",
    ]);
  });

  test("boundary + inserts a record between rows at the midpoint rank", async ({
    authedPage: page,
  }) => {
    await seedPipeline(page);

    // Hover the bottom padding band of Deal A → the boundary "+".
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

    // Between-slot form closes after the create lands…
    await expect(form).toHaveCount(0, { timeout: STEP_TIMEOUT });
    await expect(page.getByTestId("sales-pipeline-row")).toHaveCount(4, {
      timeout: STEP_TIMEOUT,
    });
    // …and the record sits BETWEEN A and B (persisted midpoint rank,
    // not an append).
    await expect
      .poll(async () => titleOrder(page), { timeout: STEP_TIMEOUT })
      .toEqual(["Deal A", "Deal A2", "Deal B", "Deal C"]);
  });

  test("grip drag persists the new rank across the refetch", async ({
    authedPage: page,
  }) => {
    await seedPipeline(page);
    const rows = page.getByTestId("sales-pipeline-row");

    // Hover Deal A's inner band → overlay grip appears.
    const first = rows.first();
    const firstBox = await first.boundingBox();
    if (!firstBox) throw new Error("no first row box");
    await page.mouse.move(
      firstBox.x + 150,
      firstBox.y + firstBox.height / 2,
    );
    const grip = page.getByTestId("sales-pipeline-drag-handle");
    await expect(grip).toBeVisible();

    // Drag Deal A below Deal C.
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

    // The rank PATCH round-trips the mock store — the order must hold
    // after the invalidation refetch, not just optimistically.
    await expect
      .poll(async () => titleOrder(page), { timeout: STEP_TIMEOUT })
      .toEqual(["Deal B", "Deal C", "Deal A"]);
    await page.reload();
    await expect(page.getByTestId("sales-pipeline-row")).toHaveCount(3, {
      timeout: STEP_TIMEOUT,
    });
    expect(await titleOrder(page)).toEqual(["Deal B", "Deal C", "Deal A"]);
  });

  test("clicking outside dismisses the inline draft row", async ({
    authedPage: page,
  }) => {
    await seedPipeline(page);

    const first = page.getByTestId("sales-pipeline-row").first();
    const box = await first.boundingBox();
    if (!box) throw new Error("no row box");
    await page.mouse.move(box.x + 150, box.y + box.height - 3);
    await page.getByTestId("sales-pipeline-insert-after").click();
    const form = page.getByTestId("sales-pipeline-inline-create-form");
    await expect(form).toBeVisible();

    // Click anywhere outside the draft row (the view title) — the
    // draft dismisses without needing Escape/Cancel.
    await page.locator(".crm-view-title").click();
    await expect(form).toHaveCount(0);
    await expect(page.getByTestId("sales-pipeline-row")).toHaveCount(3);
  });

  test("a column sort hides the reorder + insert affordances", async ({
    authedPage: page,
  }) => {
    await seedPipeline(page);
    await page.getByTestId("sales-pipeline-sort-title").click();

    const first = page.getByTestId("sales-pipeline-row").first();
    const box = await first.boundingBox();
    if (!box) throw new Error("no row box");
    // Inner band: no grip. Padding band: no "+".
    await page.mouse.move(box.x + 150, box.y + box.height / 2);
    await expect(page.getByTestId("sales-pipeline-drag-handle")).toHaveCount(
      0,
    );
    await page.mouse.move(box.x + 150, box.y + box.height - 3);
    await expect(page.getByTestId("sales-pipeline-insert-after")).toHaveCount(
      0,
    );

    // Clearing the sort (asc → desc → none) restores the affordances.
    await page.getByTestId("sales-pipeline-sort-title").click();
    await page.getByTestId("sales-pipeline-sort-title").click();
    await page.mouse.move(box.x + 150, box.y + box.height / 2);
    await expect(
      page.getByTestId("sales-pipeline-drag-handle"),
    ).toBeVisible();
  });
});
