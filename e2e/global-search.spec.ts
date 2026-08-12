/**
 * Global search E2E (Tier 1 — mocked).
 *
 * Claims (Slack-shape inline search, no pop-out modal):
 * - `/` focuses the topbar search input anywhere in the CRM shell
 *   (but never while another overlay owns the keyboard); results
 *   render in a dropdown ANCHORED under the input, grouped with
 *   identifiers, and full keyboard nav (↓ + Enter) opens the selected
 *   record and closes the dropdown.
 * - Before typing, the dropdown SUGGESTS (Slack shape, 2026-08-04):
 *   recent searches + actionable "Suggested" nav rows + a keycap
 *   footer. The sidebar carries NO find box anymore — nav-jump lives
 *   here and in the ⌘K palette.
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
  test("topbar `/` dropdown: suggestions, grouped results, keyboard nav", async ({
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

    // ── Clicking ANYWHERE on the field opens the suggestions — the
    //    icon/padding zones must not be dead clicks (2026-08-04). ────
    const fieldBox = await authedPage
      .locator(".crm-topbar-search-field")
      .boundingBox();
    if (!fieldBox) throw new Error("no search field box");
    await authedPage.mouse.click(
      fieldBox.x + 10,
      fieldBox.y + fieldBox.height / 2,
    );
    await expect(authedPage.getByTestId("crm-search-input")).toBeFocused();
    await expect(authedPage.getByTestId("crm-search-dropdown")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage.keyboard.press("Escape");
    await expect(authedPage.getByTestId("crm-search-dropdown")).toHaveCount(0);

    // ── `/` focuses the topbar input, dropdown anchors under it ───
    await authedPage.keyboard.press("/");
    await expect(authedPage.getByTestId("crm-search-input")).toBeFocused();
    await expect(authedPage.getByTestId("crm-search-dropdown")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    // No modal backdrop — the page underneath stays visible.
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible();
    // Pre-typing the dropdown SUGGESTS (Slack shape, 2026-08-04):
    // actionable nav rows + the keycap footer; no recents yet
    // (nothing searched).
    await expect(authedPage.getByTestId("crm-search-nav")).toBeVisible();
    await expect(
      authedPage.getByTestId("crm-search-nav-companies")
    ).toContainText("Companies");
    await expect(
      authedPage.getByTestId("crm-search-suggest-footer")
    ).toContainText("Select");
    await expect(authedPage.getByTestId("crm-search-recent")).toHaveCount(0);
    // A Suggested nav row ROUTES (this carries the nav-jump job of the
    // removed sidebar find box).
    await authedPage.getByTestId("crm-search-nav-contacts").click();
    await expect(authedPage).toHaveURL(/\/sales\/contacts$/, {
      timeout: STEP_TIMEOUT,
    });
    await expect(authedPage.getByTestId("crm-search-dropdown")).toHaveCount(0);
    await authedPage.getByTestId("sales-nav-pipeline").click();
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage.keyboard.press("/");
    await expect(authedPage.getByTestId("crm-search-dropdown")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

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

    // ── The successful query is offered back as a recent search ───
    await authedPage.keyboard.press("/");
    await expect(authedPage.getByTestId("crm-search-dropdown")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    const recentItem = authedPage.getByTestId("crm-search-recent-item");
    await expect(recentItem).toHaveCount(1);
    await expect(recentItem).toContainText("acme");
    // Applying a recent re-runs the search in place.
    await recentItem.click();
    await expect(authedPage.getByTestId("crm-search-input")).toHaveValue(
      "acme"
    );
    await expect(
      authedPage.getByTestId("crm-search-group-account")
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await authedPage.keyboard.press("Escape");
    await expect(authedPage.getByTestId("crm-search-dropdown")).toHaveCount(0);

    // ── The sidebar carries NO find box (removed 2026-08-04) — the
    //    topbar suggestions + ⌘K own search and nav-jump. ───────────
    await expect(
      authedPage.getByTestId("crm-sidebar-search-input")
    ).toHaveCount(0);
    await expect(authedPage.getByTestId("sales-nav-pipeline")).toBeVisible();
  });

  test("suggestions are fully keyboard-driven: ↓ selects, Enter routes", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    await authedPage.keyboard.press("/");
    await expect(authedPage.getByTestId("crm-search-nav")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    // No recents → index 0 = Pipeline; ↓ moves to Summary; Enter routes.
    // The suggestion targets /sales/inbox, which REDIRECTS to the
    // pipeline with the Summary tab selected (Inbox-first rework) — so
    // the outcome to assert is the settled URL + active tab, never the
    // transient pre-redirect URL (a race this spec used to lose).
    await authedPage.keyboard.press("ArrowDown");
    await authedPage.keyboard.press("Enter");
    await expect(authedPage).toHaveURL(/\/sales$/, {
      timeout: STEP_TIMEOUT,
    });
    await expect(
      authedPage.getByTestId("sales-pipeline-mode-inbox"),
    ).toHaveAttribute("data-active", "true", { timeout: STEP_TIMEOUT });
    await expect(authedPage.getByTestId("crm-search-dropdown")).toHaveCount(0);
  });

  test("suggestions stay clickable + truly screen-centered at full screen", async ({
    authedPage,
  }) => {
    // Full screen is where the 2026-08-04 traps lived: the content
    // columns' centering transform won hit-testing over the dropdown,
    // and the search's own centering was a CSS transform branch (now
    // JS-measured — use-screen-centered.ts).
    await authedPage.setViewportSize({ width: 1920, height: 900 });
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("crm-search-input")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    const fieldBox = await authedPage
      .locator(".crm-topbar-search-field")
      .boundingBox();
    if (!fieldBox) throw new Error("no search field box");
    // The FEATURE claim: the box centers on the SCREEN (not on the
    // area right of the sidebar, whose midpoint sits half-a-rail off).
    const fieldCenter = fieldBox.x + fieldBox.width / 2;
    expect(Math.abs(fieldCenter - 1920 / 2)).toBeLessThanOrEqual(8);
    await authedPage.mouse.click(
      fieldBox.x + 10,
      fieldBox.y + fieldBox.height / 2,
    );
    await expect(authedPage.getByTestId("crm-search-dropdown")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage.getByTestId("crm-search-nav-contacts").click();
    await expect(authedPage).toHaveURL(/\/sales\/contacts$/, {
      timeout: STEP_TIMEOUT,
    });
  });
});
