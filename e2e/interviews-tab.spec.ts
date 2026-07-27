/**
 * Interviews tab E2E (Tier 1 — mocked).
 *
 * Claims under test:
 *   1. The sidebar's "Interviews" entry lands on the tab; with no
 *      history the empty state renders.
 *   2. Quick-create: typing a NEW company name and hitting Start
 *      find-or-creates the account + opportunity and drops straight
 *      into the interview overlay — no pipeline detour.
 *   3. Exiting mid-interview surfaces the draft as an "In progress"
 *      row on the tab; Resume reopens the same session ("Resumed
 *      draft").
 *   4. A saved interview call note (title-prefixed) lists under
 *      "Done" and links back to its opportunity.
 *   5. `?new=1` (the ⌘K "Start interview" deep-link) opens the
 *      quick-create on arrival.
 *
 * The interview mechanics themselves (branching, AI rail, call-note
 * save) are covered by interview-mode.spec.ts — this spec owns the
 * tab's speed path around them.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";

const STEP_TIMEOUT = 15_000;

test.describe("Interviews tab", () => {
  test("quick-create → interview → exit → resume, history list, deep-link", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);

    // ── 1) Navigate via the sidebar; empty state ──────────────────
    await authedPage.goto("/sales");
    await authedPage.getByTestId("sales-nav-interviews").click();
    await expect(
      authedPage.getByTestId("sales-interviews-view"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("interviews-empty-state"),
    ).toBeVisible();

    // The CTA must actually RENDER the brand gradient — the --ctx-*
    // vars are scoped to auth context classes, and an out-of-scope
    // var() background silently renders nothing while toBeVisible()
    // still passes (2026-07-19 invisible-button regression).
    const ctaBackground = await authedPage
      .getByTestId("interviews-new-button")
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(ctaBackground).toContain("linear-gradient");

    // ── 2) Quick-create with a brand-new company ──────────────────
    await authedPage.getByTestId("interviews-new-button").click();
    await authedPage
      .getByTestId("new-interview-company-input")
      .fill("Chiang Mai Legal Group");
    await authedPage
      .getByTestId("new-interview-about-input")
      .fill("walk-in demo");
    // Single script today → shown as fixed text, not a picker.
    await expect(
      authedPage.getByTestId("new-interview-script-fixed"),
    ).toBeVisible();
    await authedPage.getByRole("button", { name: /Start interview/i }).click();

    // Straight into the overlay — account + opportunity were created
    // behind the scenes.
    await expect(authedPage.getByTestId("interview-mode")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await expect(
      authedPage.getByTestId("interview-mode"),
    ).toContainText("Chiang Mai Legal Group — walk-in demo");

    // The pipeline records really exist (mock store, same routes the
    // pipeline reads).
    const created = await authedPage.evaluate(async () => {
      const opps = await fetch(
        "http://localhost:8080/v1/work_items?type_key=opportunity&workspace_id=ws-e2e-default",
      ).then((r) => r.json() as Promise<{ data: { id: string; title: string; parent_id?: string }[] }>);
      const accounts = await fetch(
        "http://localhost:8080/v1/work_items?type_key=account&workspace_id=ws-e2e-default",
      ).then((r) => r.json() as Promise<{ data: { id: string; title: string }[] }>);
      return {
        opportunity: opps.data[0],
        account: accounts.data.find((a) => a.title === "Chiang Mai Legal Group"),
      };
    });
    expect(created.account).toBeTruthy();
    expect(created.opportunity?.title).toBe(
      "Chiang Mai Legal Group — walk-in demo",
    );

    // ── 3) Answer one tap, exit, resume from the tab ──────────────
    const firstChoice = authedPage
      .locator("[data-testid^='interview-choice-']")
      .first();
    await firstChoice.click();
    await authedPage.getByTestId("interview-exit-button").click();
    await expect(authedPage.getByTestId("interview-mode")).toBeHidden();

    await expect(authedPage.getByTestId("interview-drafts")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage
      .getByTestId(`interview-resume-${created.opportunity.id}`)
      .click();
    await expect(authedPage.getByTestId("interview-mode")).toBeVisible();
    await expect(authedPage.getByText("Resumed draft")).toBeVisible();
    await authedPage.getByTestId("interview-exit-button").click();

    // ── 4) A saved interview note lists under Done ────────────────
    // Seed one through the same mocked create route InterviewMode
    // uses (the full finish→save walk is interview-mode.spec's claim).
    await authedPage.evaluate(async (parentId) => {
      await fetch("http://localhost:8080/v1/work_items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Interview — Chiang Mai Legal Group — walk-in demo",
          type_key: "call_note",
          state_key: "active",
          workspace_id: "ws-e2e-default",
          parent_id: parentId,
        }),
      });
    }, created.opportunity.id);
    await authedPage.reload();
    await expect(
      authedPage.getByTestId("sales-interviews-view"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    const historyRow = authedPage
      .locator("[data-testid^='interview-note-']")
      .first();
    await expect(historyRow).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(historyRow).toContainText("Interview — Chiang Mai Legal Group");
    await historyRow.click();
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // ── 5) ⌘K deep-link opens the quick-create ────────────────────
    await authedPage.goto("/sales/interviews?new=1");
    await expect(
      authedPage.getByTestId("new-interview-company-input"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
  });
});
