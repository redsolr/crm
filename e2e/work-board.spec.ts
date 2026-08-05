/**
 * Work board E2E (Tier 1 — mocked) — the internal org-management
 * surface (2026-08-06): sidebar entry, task board columns, composer
 * create, the task edit modal, Jira-style project-space filtering, and
 * the canceled-lane toggle.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { STEP_TIMEOUT } from "./helpers/sales-ui";

const COLUMN = (page: import("@playwright/test").Page, title: string) =>
  page.locator(".project-board-column", { hasText: title });

test.describe("Work board", () => {
  test("sidebar entry, composer create, edit modal, space filter, canceled lane", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");

    // Sidebar Work section navigates to /work.
    const tasksNav = authedPage.getByTestId("sales-nav-tasks");
    await expect(tasksNav).toBeVisible({ timeout: STEP_TIMEOUT });
    await tasksNav.click();
    await expect(authedPage).toHaveURL(/\/work$/);
    await expect(authedPage.getByTestId("work-view")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    // Default board: four lanes, canceled hidden.
    for (const title of ["To Do", "In Progress", "In Review", "Done"]) {
      await expect(COLUMN(authedPage, title)).toBeVisible();
    }
    await expect(COLUMN(authedPage, "Canceled")).toHaveCount(0);

    // Composer create in To Do (All view stamps project=other).
    await COLUMN(authedPage, "To Do").getByRole("button", { name: "Create" }).click();
    await authedPage
      .getByPlaceholder("What needs to be done?")
      .fill("Ship the work module");
    await authedPage.keyboard.press("Enter");
    const card = authedPage.getByTestId("work-task-card").filter({
      hasText: "Ship the work module",
    });
    await expect(card).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(card.locator(".work-task-chip")).toHaveText("Other");

    // Sidebar badge counts the open task.
    await expect(
      authedPage.getByTestId("sales-nav-tasks-count"),
    ).toHaveText("1");

    // Edit modal: move the task into the crm space.
    await card.click();
    const projectSelect = authedPage.getByTestId("work-task-project-select");
    await expect(projectSelect).toBeVisible({ timeout: STEP_TIMEOUT });
    await projectSelect.selectOption("crm");
    await authedPage.getByRole("button", { name: "Save" }).click();
    await expect(projectSelect).toHaveCount(0);
    await expect(card.locator(".work-task-chip")).toHaveText("Crm", {
      timeout: STEP_TIMEOUT,
    });

    // Space pills: crm shows the card, hq shows an empty board.
    await authedPage.getByTestId("work-space-crm").click();
    await expect(card).toBeVisible();
    await authedPage.getByTestId("work-space-hq").click();
    await expect(authedPage.getByTestId("work-task-card")).toHaveCount(0);
    await authedPage.getByTestId("work-space-all").click();
    await expect(card).toBeVisible();

    // Cancel the task: it leaves the default board, reappears with the
    // canceled lane toggled on.
    await card.click();
    await authedPage
      .getByTestId("work-task-stage-select")
      .selectOption("canceled");
    await authedPage.getByRole("button", { name: "Save" }).click();
    await expect(authedPage.getByTestId("work-task-card")).toHaveCount(0, {
      timeout: STEP_TIMEOUT,
    });
    await authedPage.getByTestId("work-show-canceled").click();
    await expect(COLUMN(authedPage, "Canceled")).toBeVisible();
    await expect(card).toBeVisible();
  });
});
