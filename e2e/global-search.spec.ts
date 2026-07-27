/**
 * Global search E2E (Tier 1 — mocked).
 *
 * Claims (Slack-shape inline search, no pop-out modal):
 * - `/` focuses the topbar search input anywhere in the CRM shell
 *   (but never while another overlay owns the keyboard); results
 *   render in a dropdown ANCHORED under the input, grouped with
 *   identifiers, and full keyboard nav (↓ + Enter) opens the selected
 *   record and closes the dropdown.
 * - The sidebar ("explorer") carries ONE find box that narrows IN
 *   PLACE: matching nav views + records replace the nav while typing;
 *   Esc/clear restores the nav; opening a match routes and resets.
 *   A leading `/` engages command mode: the box clears and the ⌘K
 *   quick-actions palette opens.
 *
 * The account result is seeded through the real UI first so the
 * search mock can return an id the sales.handlers store actually
 * serves — the detail page then renders instead of 404ing.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { setupGlobalSearchHandlers } from "./handlers/search.handlers";
import { STEP_TIMEOUT, createAccountViaUi } from "./helpers/sales-ui";

test.describe("Global search", () => {
  test("topbar `/` dropdown + sidebar inline filter route to records in place", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-empty-primary-cta")).toBeVisible(
      { timeout: STEP_TIMEOUT }
    );

    // ── Seed a real company through the UI, learn its id ──────────
    await createAccountViaUi(authedPage, "Acme Legal");
    await authedPage.getByTestId("sales-nav-companies").click();
    const acmeRow = authedPage.locator("[data-testid='sales-companies-row']", {
      hasText: "Acme Legal",
    });
    await expect(acmeRow).toBeVisible({ timeout: STEP_TIMEOUT });
    await acmeRow.getByTestId("sales-companies-cell-company").click();
    await expect(authedPage.getByTestId("sales-peek-panel")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage.getByTestId("sales-peek-expand").click();
    await expect(authedPage.getByTestId("sales-account-detail")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await expect(authedPage).toHaveURL(/\/sales\/account\/[^/]+$/);
    const accountId = new URL(authedPage.url()).pathname
      .split("/")
      .pop() as string;

    // Search mock returns THIS id so opening it lands on a renderable page.
    await setupGlobalSearchHandlers(authedPage, {
      accountId,
      accountTitle: "Acme Legal",
    });

    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    // ── `/` is inert while the ⌘K palette owns the keyboard ───────
    await authedPage.keyboard.press("Control+k");
    await expect(authedPage.getByTestId("crm-command-palette")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage.keyboard.press("/");
    await expect(authedPage.getByTestId("crm-search-dropdown")).toHaveCount(0);
    // The keystroke went where it should: into the palette's input.
    await expect(
      authedPage.getByTestId("crm-command-palette-input")
    ).toHaveValue("/");
    await authedPage.keyboard.press("Escape");
    await expect(authedPage.getByTestId("crm-command-palette")).toHaveCount(0);

    // ── `/` focuses the topbar input, dropdown anchors under it ───
    await authedPage.keyboard.press("/");
    await expect(authedPage.getByTestId("crm-search-input")).toBeFocused();
    await expect(authedPage.getByTestId("crm-search-dropdown")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    // No modal backdrop — the page underneath stays visible.
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible();

    // ── Debounced FTS call → grouped results with identifiers ─────
    await authedPage.getByTestId("crm-search-input").fill("acme");
    await expect(
      authedPage.getByTestId("crm-search-group-account")
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("crm-search-group-account")
    ).toContainText("Companies");
    await expect(
      authedPage.getByTestId("crm-search-group-opportunity")
    ).toContainText("Deals");
    await expect(
      authedPage.getByTestId("crm-search-group-call_note")
    ).toContainText("Call notes");
    const rows = authedPage.getByTestId("crm-search-result");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText("SALES-90");
    await expect(rows.nth(1)).toContainText("SALES-1");
    await expect(rows.nth(1)).toHaveAttribute("data-result-id", accountId);

    // ── ↓ + Enter opens the seeded company, dropdown closes ───────
    await authedPage.keyboard.press("ArrowDown");
    await authedPage.keyboard.press("Enter");
    await expect(authedPage).toHaveURL(
      new RegExp(`/sales/account/${accountId}$`),
      { timeout: STEP_TIMEOUT }
    );
    await expect(authedPage.getByTestId("crm-search-dropdown")).toHaveCount(0);
    await expect(authedPage.getByTestId("crm-search-input")).toHaveValue("");
    await expect(authedPage.getByTestId("sales-account-detail")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await expect(authedPage.getByTestId("sales-account-title")).toContainText(
      "Acme Legal"
    );

    // ── Sidebar filter: view matches replace the nav in place ─────
    const sidebarInput = authedPage.getByTestId("crm-sidebar-search-input");
    await sidebarInput.fill("conta");
    await expect(authedPage.getByTestId("sales-nav-pipeline")).toHaveCount(0);
    await authedPage.getByTestId("crm-sidebar-search-view-contacts").click();
    await expect(authedPage).toHaveURL(/\/sales\/contacts$/, {
      timeout: STEP_TIMEOUT,
    });
    // Opening a match resets the filter and restores the nav.
    await expect(sidebarInput).toHaveValue("");
    await expect(authedPage.getByTestId("sales-nav-pipeline")).toBeVisible();

    // ── Sidebar filter: record hits render grouped, Esc restores ──
    await sidebarInput.fill("acme");
    await expect(
      authedPage.getByTestId("crm-sidebar-search-group-account")
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("crm-sidebar-search-result")
    ).toHaveCount(4);
    await expect(authedPage.getByTestId("sales-nav-pipeline")).toHaveCount(0);
    await sidebarInput.press("Escape");
    await expect(sidebarInput).toHaveValue("");
    await expect(authedPage.getByTestId("sales-nav-pipeline")).toBeVisible();

    // ── Sidebar filter: opening a record routes to its page ───────
    await sidebarInput.fill("acme");
    await authedPage
      .locator(
        `[data-testid='crm-sidebar-search-result'][data-result-id='${accountId}']`
      )
      .click();
    await expect(authedPage).toHaveURL(
      new RegExp(`/sales/account/${accountId}$`),
      { timeout: STEP_TIMEOUT }
    );
    await expect(authedPage.getByTestId("sales-account-title")).toContainText(
      "Acme Legal"
    );
    await expect(sidebarInput).toHaveValue("");
    await expect(authedPage.getByTestId("sales-nav-pipeline")).toBeVisible();

    // ── Sidebar box: leading `/` engages the ⌘K command palette ───
    await sidebarInput.fill("/");
    await expect(authedPage.getByTestId("crm-command-palette")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await expect(sidebarInput).toHaveValue("");
    await authedPage.keyboard.press("Escape");
    await expect(authedPage.getByTestId("crm-command-palette")).toHaveCount(0);
    await expect(authedPage.getByTestId("sales-nav-pipeline")).toBeVisible();
  });
});
