/**
 * Searchable dropdowns E2E (Tier 1 — mocked) — the app-wide custom
 * select (components/ui/select.tsx) that replaced every native
 * <select>/<datalist> on 2026-08-07.
 *
 * Claims under test:
 *   1. Long lists are TYPEABLE — the account picker filters as you
 *      type and picking commits the account id, not the label.
 *   2. The expanded menu is anchored to its trigger (the old native
 *      <datalist> rendered a browser popup floating off-position) and
 *      stays inside the viewport.
 *   3. Keyboard-only flow works: open → arrows → Enter.
 *   4. The interview modal's company typeahead suggests existing
 *      accounts under the input, fills on pick, and keeps unknown
 *      names as free text (new-company path).
 *
 * Mock layer: `setupSalesHandlers` (stateful sales workspace store).
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { expectSelectValue, pickOption } from "./helpers/select";
import {
  STEP_TIMEOUT,
  createAccountViaUi,
  createOpportunityViaUi,
} from "./helpers/sales-ui";

const FIRMS = [
  "Titan Law",
  "Lanna Law Office",
  "Siam Apex Law",
  "Thonglor Legal Group",
  "Erawan Corporate Legal",
  "Krung Thep Family Law",
];

test.describe("Searchable selects", () => {
  test("account picker filters by typed query, commits the id, and anchors to its trigger", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    for (const firm of FIRMS) {
      await createAccountViaUi(authedPage, firm);
      await expect(
        authedPage.getByTestId("sales-account-name-input"),
      ).toHaveCount(0, { timeout: STEP_TIMEOUT });
    }

    // ── Open the New-opportunity modal's account picker ────────────
    await authedPage.getByTestId("sales-add-opportunity-button").click();
    const trigger = authedPage.getByTestId("sales-opportunity-account-select");
    await trigger.click();
    const menu = authedPage.getByTestId("crm-select-menu");
    await expect(menu).toBeVisible();

    // Geometry: the menu is anchored to the trigger (left-aligned
    // within a pixel of rounding) and fully inside the viewport —
    // exactly what the native datalist popup failed at. Poll: the
    // 130ms pop-in animation offsets the box while it plays.
    await expect
      .poll(async () => {
        const t = await trigger.boundingBox();
        const m = await menu.boundingBox();
        return t && m ? Math.abs(m.x - t.x) : Number.MAX_SAFE_INTEGER;
      })
      .toBeLessThanOrEqual(2);
    const menuBox = await menu.boundingBox();
    if (!menuBox) throw new Error("missing menu bounding box");
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    const viewport = authedPage.viewportSize();
    if (viewport) {
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
    }

    // ── Six accounts → the search box is live; typing filters ──────
    const search = authedPage.getByTestId("crm-select-search-input");
    await expect(search).toBeFocused();
    await search.fill("apex");
    await expect(menu.getByRole("option")).toHaveCount(1);
    await menu.getByRole("option", { name: "Siam Apex Law" }).click();
    await expect(menu).toBeHidden();
    // The committed value is the account ID (wire shape), not a label.
    const committed = await trigger.getAttribute("data-value");
    expect(committed).toBeTruthy();
    expect(committed).not.toBe("Siam Apex Law");
    await expect(trigger).toContainText("Siam Apex Law");

    // ── Keyboard-only on the use-case select ───────────────────────
    const useCase = authedPage.getByTestId("sales-opportunity-use-case-select");
    await useCase.click();
    await authedPage.keyboard.press("ArrowDown");
    await authedPage.keyboard.press("Enter");
    await expect(useCase).not.toHaveAttribute("data-value", "");
    await authedPage.getByRole("button", { name: "Cancel" }).click();
  });

  test("interview company typeahead suggests existing firms under the input and keeps new names as free text", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await createAccountViaUi(authedPage, "Rattanakorn & Partners");
    await expect(
      authedPage.getByTestId("sales-account-name-input"),
    ).toHaveCount(0, { timeout: STEP_TIMEOUT });

    await authedPage.getByTestId("sales-nav-interviews").click();
    await authedPage.getByTestId("interviews-new-button").click();

    const input = authedPage.getByTestId("new-interview-company-input");
    await input.pressSequentially("ratta");
    const menu = authedPage.getByTestId("crm-select-menu");
    await expect(menu).toBeVisible();

    // Anchored under the input — the datalist misalignment regression.
    // Poll past the 130ms pop-in animation.
    await expect
      .poll(async () => {
        const i = await input.boundingBox();
        const m = await menu.boundingBox();
        if (!i || !m) return Number.MAX_SAFE_INTEGER;
        const alignedX = Math.abs(m.x - i.x) <= 2;
        const below =
          m.y >= i.y + i.height && m.y <= i.y + i.height + 12;
        return alignedX && below ? 0 : 1;
      })
      .toBe(0);

    await menu.getByRole("option", { name: "Rattanakorn & Partners" }).click();
    await expect(input).toHaveValue("Rattanakorn & Partners");
    // Exact match → the modal reports the attach-to-existing path.
    await expect(
      authedPage.getByText(/Existing account — the interview attaches/),
    ).toBeVisible();

    // Free text stays valid — unknown firm keeps the typed name.
    await input.fill("Brand New Firm 99");
    await expect(menu).toHaveCount(0);
    await expect(input).toHaveValue("Brand New Firm 99");
    await expect(
      authedPage.getByText(/New company — the account is created/),
    ).toBeVisible();
    await authedPage.getByRole("button", { name: "Cancel" }).click();
  });

  test("peek panel stage select: picking from the portaled menu commits WITHOUT dismissing the peek", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await createAccountViaUi(authedPage, "Peek Firm");
    await expect(
      authedPage.getByTestId("sales-account-name-input"),
    ).toHaveCount(0, { timeout: STEP_TIMEOUT });
    await createOpportunityViaUi(authedPage, "Peek stage deal");
    const row = authedPage.locator("[data-testid='sales-pipeline-row']", {
      hasText: "Peek stage deal",
    });
    await expect(row).toBeVisible({ timeout: STEP_TIMEOUT });

    // Row click opens the right-snap peek — a surface that DISMISSES
    // on outside clicks. The stage menu portals outside the panel, so
    // picking an option is the regression case: the pick must commit
    // and the peek must stay open.
    await row.getByTestId("sales-pipeline-cell-title").click();
    const peek = authedPage.getByTestId("sales-peek-panel");
    await expect(peek).toBeVisible({ timeout: STEP_TIMEOUT });

    const stage = authedPage.getByTestId("sales-peek-stage-select");
    await pickOption(stage, "contacted");
    await expect(peek).toBeVisible();
    await expectSelectValue(stage, "contacted", { timeout: STEP_TIMEOUT });
    // The table behind the peek reflects the transition too.
    await expectSelectValue(
      row.getByTestId("sales-pipeline-stage-select"),
      "contacted",
      { timeout: STEP_TIMEOUT },
    );
  });

  test("select-type cell editor: Escape cancels without committing; a pick commits", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await createAccountViaUi(authedPage, "Cell Edit Co");
    await expect(
      authedPage.getByTestId("sales-account-name-input"),
    ).toHaveCount(0, { timeout: STEP_TIMEOUT });
    await authedPage.getByTestId("sales-nav-companies").click();
    const row = authedPage.locator("[data-testid='sales-companies-row']", {
      hasText: "Cell Edit Co",
    });
    await expect(row).toBeVisible({ timeout: STEP_TIMEOUT });

    // Clicking a select cell opens the editor's menu IMMEDIATELY
    // (defaultOpen). Escape = dismissed without a pick = the edit
    // session cancels — the cell must stay untouched.
    await row.getByTestId("sales-companies-cell-segment").click();
    await expect(authedPage.getByTestId("crm-select-menu")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage.keyboard.press("Escape");
    await expect(authedPage.getByTestId("crm-select-menu")).toBeHidden();
    await expect(
      row.getByTestId("sales-companies-cell-segment"),
    ).toContainText("—");

    // Same cell, real pick — commits.
    await row.getByTestId("sales-companies-cell-segment").click();
    await pickOption(
      authedPage.getByTestId("sales-companies-edit-segment"),
      "solo",
    );
    await expect(
      row.getByTestId("sales-companies-cell-segment"),
    ).toContainText("solo", { timeout: STEP_TIMEOUT });
  });

  test("pipeline inline-create company dropdown works inside the table row (pickOption helper)", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await createAccountViaUi(authedPage, "Titan Law");
    await expect(
      authedPage.getByTestId("sales-account-name-input"),
    ).toHaveCount(0, { timeout: STEP_TIMEOUT });
    // The end-of-list "+ Create" chip only renders on a non-empty
    // table — seed one deal through the modal first.
    await createOpportunityViaUi(authedPage, "Seed deal");
    await expect(
      authedPage.getByTestId("sales-opportunity-title-input"),
    ).toHaveCount(0, { timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-pipeline-row"),
    ).toHaveCount(1, { timeout: STEP_TIMEOUT });

    // Table mode is the default; the end-of-list "+ Create" chip opens
    // the inline row.
    await authedPage.getByTestId("sales-pipeline-create-row-button").click();
    await authedPage
      .getByTestId("sales-pipeline-inline-title")
      .fill("Inline dropdown deal");
    await pickOption(
      authedPage.getByTestId("sales-pipeline-inline-account"),
      { label: "Titan Law" },
    );
    await pickOption(
      authedPage.getByTestId("sales-pipeline-inline-use-case"),
      "matter_chaos",
    );
    // Picking from the PORTALED menu must not dismiss the inline row
    // (outside-click regression guard).
    await expect(
      authedPage.getByTestId("sales-pipeline-inline-create-form"),
    ).toBeVisible();
    await authedPage.getByTestId("sales-pipeline-inline-submit").click();
    await expect(
      authedPage.locator("[data-testid='sales-pipeline-row']", {
        hasText: "Inline dropdown deal",
      }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
  });
});
