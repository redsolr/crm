/**
 * Dark-theme text-contrast tripwire (Tier 1 — mocked).
 *
 * The founder raised the dark text ladder toward white on 2026-08-07
 * (primary #ffffff · secondary #c3cad4 · muted #8b93a0 — gray body
 * text read as disabled next to the GPT reference). Tokens are just
 * CSS variables, and this repo already learned that styling can
 * silently regress while `toBeVisible()` stays green (the 2026-07-19
 * out-of-scope-var incident) — so the claim is pinned with COMPUTED
 * values: the token declarations on `.crm-app` AND a real element
 * resolving to pure white.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { STEP_TIMEOUT } from "./helpers/sales-ui";

test("the dark text ladder stays white-forward (founder 2026-08-07)", async ({
  authedPage,
}) => {
  await setupSalesHandlers(authedPage);
  await authedPage.goto("/sales");
  await expect(authedPage.getByTestId("crm-shell")).toBeVisible({
    timeout: STEP_TIMEOUT,
  });

  // Token declarations, as the browser resolves them on the app shell
  // (Tailwind's minifier shortens #ffffff → #fff — expand before
  // comparing).
  const tokens = await authedPage.locator(".crm-app").first().evaluate((el) => {
    const styles = getComputedStyle(el);
    const expand = (hex: string) =>
      /^#[0-9a-f]{3}$/i.test(hex)
        ? `#${[...hex.slice(1)].map((c) => c + c).join("")}`
        : hex;
    const read = (name: string) =>
      expand(styles.getPropertyValue(name).trim().toLowerCase());
    return {
      primary: read("--theme-text-primary"),
      secondary: read("--theme-text-secondary"),
      muted: read("--theme-text-muted"),
    };
  });
  expect(tokens).toEqual({
    primary: "#ffffff",
    secondary: "#c3cad4",
    muted: "#8b939f",
  });

  // A real reading surface resolves to pure white — the view title is
  // primary-tier text on every screen.
  const titleColor = await authedPage
    .locator(".crm-view-title")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  expect(titleColor).toBe("rgb(255, 255, 255)");
});
