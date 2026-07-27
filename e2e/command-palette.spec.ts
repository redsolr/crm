/**
 * Command palette E2E (Tier 1 — mocked).
 *
 * The ⌘K/Ctrl+K palette claims: opens anywhere in the shell, navigates,
 * launches create modals, jumps to records, and drives the
 * per-opportunity drilldown (move stage) — with the closed-stage
 * reason modal still intercepting from the palette path.
 */

import { test, expect } from "./fixtures/auth.fixture";
import type { Page } from "@playwright/test";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import {
  STEP_TIMEOUT,
  ensureBoardMode,
  createAccountViaUi,
  createOpportunityViaUi,
} from "./helpers/sales-ui";

async function openPalette(page: Page) {
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("crm-command-palette")).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
}

test.describe("Command palette", () => {
  test("navigates, creates, jumps to records, and moves stages", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    // The seeded-card assertions below drive the board — opt in (the
    // stored choice survives the later hard navigations).
    await ensureBoardMode(authedPage);

    // ── Navigation ────────────────────────────────────────────────
    await openPalette(authedPage);
    await authedPage
      .getByTestId("crm-command-palette-item-nav-companies")
      .click();
    await expect(
      authedPage.getByTestId("sales-companies-view"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // ── Create verb opens the modal ───────────────────────────────
    await openPalette(authedPage);
    await authedPage
      .getByTestId("crm-command-palette-item-new-company")
      .click();
    await expect(
      authedPage.getByTestId("sales-account-name-input"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await authedPage.getByRole("button", { name: "Cancel" }).click();

    // ── Seed one account + opportunity through the normal UI ─────
    await authedPage.goto("/sales");
    await createAccountViaUi(authedPage, "Palette Firm");
    await createOpportunityViaUi(authedPage, "Palette — pilot");
    await expect(
      authedPage.locator("[data-testid='sales-kanban-card']", {
        hasText: "Palette — pilot",
      }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // ── Record jump → opportunity drilldown → move stage ──────────
    await openPalette(authedPage);
    await authedPage
      .getByTestId("crm-command-palette-input")
      .fill("Palette — pilot");
    await authedPage
      .locator('[data-testid^="crm-command-palette-item-opp-"]')
      .first()
      .click();
    await authedPage
      .getByTestId("crm-command-palette-item-opp-move")
      .click();
    await authedPage
      .getByTestId("crm-command-palette-item-stage-contacted")
      .click();
    await expect(
      authedPage.getByTestId("crm-command-palette"),
    ).toHaveCount(0);

    // Verify via the palette's own "Open opportunity" action.
    await openPalette(authedPage);
    await authedPage
      .getByTestId("crm-command-palette-input")
      .fill("Palette — pilot");
    await authedPage
      .locator('[data-testid^="crm-command-palette-item-opp-"]')
      .first()
      .click();
    await authedPage
      .getByTestId("crm-command-palette-item-opp-open")
      .click();
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-opportunity-detail-stage-select"),
    ).toHaveValue("contacted", { timeout: STEP_TIMEOUT });

    // ── Closed stage from the palette still demands a reason ──────
    await openPalette(authedPage);
    await authedPage
      .getByTestId("crm-command-palette-input")
      .fill("Palette — pilot");
    await authedPage
      .locator('[data-testid^="crm-command-palette-item-opp-"]')
      .first()
      .click();
    await authedPage
      .getByTestId("crm-command-palette-item-opp-move")
      .click();
    await authedPage
      .getByTestId("crm-command-palette-item-stage-lost")
      .click();
    // The reason-capture modal opens instead of a silent transition.
    await expect(
      authedPage.getByTestId("sales-transition-lost-reason-select"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
  });
});
