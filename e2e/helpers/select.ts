/**
 * Driving the app's custom searchable selects (components/ui/select.tsx)
 * — the replacement for Playwright's native-only `selectOption`.
 *
 * The trigger is a button carrying the current value as `data-value`;
 * opening it portals ONE menu (`data-testid="crm-select-menu"`) to
 * <body>, whose rows are `role="option"` with their own `data-value`.
 *
 * `pickOption(trigger, pick)`:
 *   - `"won"`                → by option VALUE (old `selectOption("won")`)
 *   - `{ label: "Acme" }`    → by visible label (old `{ label: ... }`)
 *   - `{ index: 0 }`         → by position among REAL options (the old
 *                              native `{ index: 1 }` counted the
 *                              placeholder `<option>`; here index 0 is
 *                              the first real choice)
 *
 * `expectSelectValue(trigger, "won")` replaces `toHaveValue("won")`.
 */

import { expect, type Locator } from "@playwright/test";

export type OptionPick =
  | string
  | { label: string | RegExp }
  | { value: string }
  | { index: number };

export async function pickOption(
  trigger: Locator,
  pick: OptionPick,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout;
  const menu = trigger.page().getByTestId("crm-select-menu");
  // Cell editors open their menu on mount — only click the trigger
  // when no menu is up yet.
  if (!(await menu.isVisible().catch(() => false))) {
    await trigger.click({ timeout });
  }
  await expect(menu).toBeVisible({ timeout });

  let target: Locator;
  if (typeof pick === "string") {
    target = menu.locator(`[role="option"][data-value="${pick}"]`);
  } else if ("value" in pick) {
    target = menu.locator(`[role="option"][data-value="${pick.value}"]`);
  } else if ("label" in pick) {
    target = menu.getByRole("option", { name: pick.label, exact: true });
  } else {
    target = menu.getByRole("option").nth(pick.index);
  }
  await target.click({ timeout });
  await expect(menu).toBeHidden({ timeout });
}

/** Assert the select's committed value (replaces `toHaveValue`). */
export async function expectSelectValue(
  trigger: Locator,
  value: string,
  options?: { timeout?: number },
): Promise<void> {
  await expect(trigger).toHaveAttribute("data-value", value, options);
}
