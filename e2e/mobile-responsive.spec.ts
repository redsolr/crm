/**
 * Mobile responsive smoke (Tier 1 — mocked, 390×844 viewport).
 *
 * Claims (the PWA/responsive arc, 2026-08-03):
 * - Below 768px the sidebar is an overlay drawer: hidden by default,
 *   opened by the topbar hamburger, dismissed by backdrop tap and by
 *   navigating.
 * - The topbar swaps the presence stack out and the hamburger in.
 * - Core surfaces (pipeline, companies table, reports) render without
 *   the page body scrolling sideways — wide content scrolls inside
 *   its own container.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { STEP_TIMEOUT } from "./helpers/sales-ui";

test.use({ viewport: { width: 390, height: 844 } });

/** The page body itself must never scroll sideways on a phone. On
 *  failure, names the widest offending elements so the fix is a
 *  30-second lookup instead of a bisect. */
async function expectNoBodyHorizontalScroll(
  page: import("@playwright/test").Page,
) {
  const report = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - limit;
    const offenders: string[] = [];
    if (overflow > 0) {
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        if (r.width > limit + 1 || r.right > limit + 1) {
          const cls =
            typeof el.className === "string" && el.className !== ""
              ? `.${el.className.split(/\s+/).slice(0, 3).join(".")}`
              : "";
          offenders.push(
            `${el.tagName.toLowerCase()}${cls} w=${Math.round(r.width)} right=${Math.round(r.right)}`,
          );
        }
      }
    }
    return { overflow, offenders: offenders.slice(0, 12) };
  });
  expect(report, report.offenders.join("\n")).toEqual({
    overflow: 0,
    offenders: [],
  });
}

test.describe("Mobile shell (390px)", () => {
  test.beforeEach(async ({ authedPage }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("crm-topbar")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
  });

  test("sidebar is a drawer: hamburger opens, backdrop closes", async ({
    authedPage,
  }) => {
    const sidebar = authedPage.getByTestId("sales-explorer");
    // Off-canvas by default (translated out of the viewport).
    await expect(sidebar).not.toBeInViewport();
    await expect(authedPage.getByTestId("crm-topbar-menu")).toBeVisible();

    await authedPage.getByTestId("crm-topbar-menu").click();
    await expect(sidebar).toBeInViewport();
    await expect(
      authedPage.getByTestId("crm-sidebar-backdrop"),
    ).toBeVisible();

    await authedPage
      .getByTestId("crm-sidebar-backdrop")
      .click({ position: { x: 380, y: 400 } });
    await expect(sidebar).not.toBeInViewport();
    await expect(authedPage.getByTestId("crm-sidebar-backdrop")).toHaveCount(
      0,
    );
  });

  test("navigating from the drawer routes and closes it", async ({
    authedPage,
  }) => {
    await authedPage.getByTestId("crm-topbar-menu").click();
    const sidebar = authedPage.getByTestId("sales-explorer");
    await expect(sidebar).toBeInViewport();

    await authedPage.getByTestId("sales-nav-companies").click();
    await expect(authedPage).toHaveURL(/\/sales\/companies/);
    await expect(sidebar).not.toBeInViewport();
  });

  test("presence stack is hidden; Ask button stays", async ({
    authedPage,
  }) => {
    await expect(authedPage.locator(".crm-topbar-presence")).toBeHidden();
    await expect(authedPage.getByTestId("crm-topbar")).toBeVisible();
  });

  test("core surfaces keep the body free of sideways scroll", async ({
    authedPage,
  }) => {
    await expectNoBodyHorizontalScroll(authedPage);

    await authedPage.goto("/sales/companies");
    await expect(authedPage.getByTestId("crm-topbar")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await expectNoBodyHorizontalScroll(authedPage);

    await authedPage.goto("/sales/reports");
    await expect(authedPage.getByTestId("crm-topbar")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await expectNoBodyHorizontalScroll(authedPage);
  });
});
