/**
 * Shared sales-surface UI helpers for the mocked e2e tier.
 *
 * These encode the common create/navigate flows the sales specs drive
 * through the real UI (no API shortcuts) so each spec asserts its own
 * claims without re-deriving the plumbing.
 */

import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

// Per-step ceiling for post-action UI updates (modal close → mock refetch →
// re-render, activation-ladder localStorage write). 15s rather than 5s so a
// step survives parallel-load latency on the shared dev server — the prior 5s
// surfaced contention as a flake, not a logic failure. Web-first assertions
// still resolve as soon as the state appears; this is only the ceiling.
export const STEP_TIMEOUT = 15_000;

/**
 * Rows and cards open the right-snap PEEK panel since 2026-07-14 (the
 * web-app mini-panel pattern); the full detail view is reached through
 * the panel's expand button. This helper walks that two-step path.
 */
export async function openFullViewViaPeek(page: Page, trigger: Locator) {
  await trigger.click();
  await expect(page.getByTestId("sales-peek-panel")).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
  await page.getByTestId("sales-peek-expand").click();
  await expect(page.getByTestId("sales-peek-panel")).toHaveCount(0, {
    timeout: STEP_TIMEOUT,
  });
}

/**
 * Switches the Pipeline to BOARD mode (kanban). TABLE is the product
 * default since 2026-07-18 — specs that drive kanban cards opt into the
 * board explicitly via the tab strip. No-op when already on board.
 */
export async function ensureBoardMode(page: Page) {
  const boardTab = page.getByTestId("sales-pipeline-mode-kanban");
  await expect(boardTab).toBeVisible({ timeout: STEP_TIMEOUT });
  if ((await boardTab.getAttribute("data-active")) !== "true") {
    await boardTab.click();
  }
  // Assert the MODE, not the board container — an empty pipeline
  // renders the welcome state instead of the board in either mode.
  await expect(boardTab).toHaveAttribute("data-active", "true", {
    timeout: STEP_TIMEOUT,
  });
}

/** Phone-flow twins of the create helpers below — on <768px the
 *  header CTA pair is CSS-hidden behind the "+ New" menu, so mobile
 *  specs seed through it (which also exercises the menu itself). */
export async function createAccountViaMobileMenu(page: Page, name: string) {
  await page.getByTestId("sales-header-add-button").click();
  await page.getByTestId("sales-header-add-company").click();
  await page.getByTestId("sales-account-name-input").fill(name);
  await page
    .getByTestId("sales-account-source-select")
    .selectOption("referral");
  await page.getByRole("button", { name: "Add company" }).click();
  await expect(page.getByTestId("sales-account-name-input")).toHaveCount(0, {
    timeout: STEP_TIMEOUT,
  });
}

export async function createOpportunityViaMobileMenu(
  page: Page,
  title: string,
) {
  await page.getByTestId("sales-header-add-button").click();
  await page.getByTestId("sales-header-add-opportunity").click();
  await page.getByTestId("sales-opportunity-title-input").fill(title);
  await page
    .getByTestId("sales-opportunity-account-select")
    .selectOption({ index: 1 });
  await page
    .getByTestId("sales-opportunity-use-case-select")
    .selectOption("matter_chaos");
  await page.getByRole("button", { name: "Create opportunity" }).click();
  await expect(
    page.getByTestId("sales-opportunity-title-input"),
  ).toHaveCount(0, { timeout: STEP_TIMEOUT });
}

/** Creates an account through the Add-company modal (source: referral). */
export async function createAccountViaUi(page: Page, name: string) {
  await page.getByTestId("sales-add-account-button").click();
  await page.getByTestId("sales-account-name-input").fill(name);
  await page
    .getByTestId("sales-account-source-select")
    .selectOption("referral");
  await page.getByRole("button", { name: "Add company" }).click();
}

/**
 * Creates an opportunity through the New-opportunity modal against the
 * first available account (use case: matter_chaos).
 *
 * - `nextAction` / `nextActionDate` fill the follow-up fields via their
 *   labels (exact match).
 * - `awaitCard: true` waits for the kanban card carrying the title to
 *   appear before returning.
 */
export async function createOpportunityViaUi(
  page: Page,
  title: string,
  opts?: { nextAction?: string; nextActionDate?: string; awaitCard?: boolean },
) {
  await page.getByTestId("sales-add-opportunity-button").click();
  await page.getByTestId("sales-opportunity-title-input").fill(title);
  await page
    .getByTestId("sales-opportunity-account-select")
    .selectOption({ index: 1 });
  await page
    .getByTestId("sales-opportunity-use-case-select")
    .selectOption("matter_chaos");
  if (opts?.nextAction) {
    await page
      .getByLabel("Next action", { exact: true })
      .fill(opts.nextAction);
  }
  if (opts?.nextActionDate) {
    await page
      .getByLabel("Next action date", { exact: true })
      .fill(opts.nextActionDate);
  }
  await page.getByRole("button", { name: "Create opportunity" }).click();
  if (opts?.awaitCard) {
    await expect(
      page.locator("[data-testid='sales-kanban-card']", { hasText: title }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
  }
}
