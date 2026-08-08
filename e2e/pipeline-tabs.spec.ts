/**
 * Pipeline layout tab strip E2E (Tier 1 — mocked).
 *
 * The Inbox/Table/Board tabs drag to rearrange like Jira's project
 * tab strip (founder 2026-08-04): the order persists per browser
 * (localStorage) and survives a reload; clicking a tab still switches
 * the layout (the 5px drag threshold spares clicks).
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { STEP_TIMEOUT } from "./helpers/sales-ui";

test.describe("Pipeline layout tabs", () => {
  test("dragging a tab reorders the strip and persists across reload", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(
      authedPage.getByTestId("sales-pipeline-mode-toggle"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    const tabs = authedPage.locator(
      '[data-testid="sales-pipeline-mode-toggle"] [role="tab"]',
    );
    await expect(tabs).toHaveCount(3);
    expect(await tabs.allInnerTexts()).toEqual(["Summary", "Table", "Board"]);

    // Clicking switches the layout (asserted BEFORE any drag — dnd-kit
    // suppresses the first click right after a drop, so a post-drag
    // click assertion races the suppression window on slow runners).
    const board = authedPage.getByTestId("sales-pipeline-mode-kanban");
    const inbox = authedPage.getByTestId("sales-pipeline-mode-inbox");
    await board.click();
    await expect(board).toHaveAttribute("data-active", "true");

    // Drag Board to the front.
    const boardBox = await board.boundingBox();
    const inboxBox = await inbox.boundingBox();
    if (!boardBox || !inboxBox) throw new Error("no tab boxes");
    await authedPage.mouse.move(
      boardBox.x + boardBox.width / 2,
      boardBox.y + boardBox.height / 2,
    );
    await authedPage.mouse.down();
    await authedPage.mouse.move(
      inboxBox.x + 4,
      inboxBox.y + inboxBox.height / 2,
      { steps: 10 },
    );
    await authedPage.mouse.up();
    await expect
      .poll(async () => tabs.allInnerTexts(), { timeout: STEP_TIMEOUT })
      .toEqual(["Board", "Summary", "Table"]);

    // The order (and the mode chosen by the earlier click) survive a
    // reload.
    await authedPage.reload();
    await expect(
      authedPage.getByTestId("sales-pipeline-mode-toggle"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect
      .poll(async () => tabs.allInnerTexts(), { timeout: STEP_TIMEOUT })
      .toEqual(["Board", "Summary", "Table"]);
    await expect(
      authedPage.getByTestId("sales-pipeline-mode-kanban"),
    ).toHaveAttribute("data-active", "true");
  });
});
