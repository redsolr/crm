/**
 * Pipeline Inbox tab (Tier 1 — mocked) — the landing surface.
 *
 * Claims (founder 2026-08-08, superseding the Summary tab):
 * - A fresh session lands on the Inbox tab (Inbox | Table | Board);
 *   an explicitly chosen tab persists across reload (localStorage).
 * - The Inbox renders the follow-up queue ("Needs attention") and the
 *   commitment inbox — the same engines the retired Summary re-drew.
 * - The morning-digest card tops the Inbox: drafts render + copy,
 *   the card contributes NO chrome before the first cron run, and a
 *   drafting failure is surfaced, never silent.
 * - /sales/inbox (the retired standalone route) redirects to the
 *   pipeline with the Inbox tab selected — bookmarks keep working.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import {
  createAccountViaUi,
  createOpportunityViaUi,
  ensureTableMode,
  STEP_TIMEOUT,
} from "./helpers/sales-ui";
import { localDate } from "./helpers/dates";

test.describe("Pipeline Inbox tab", () => {
  test("inbox is the landing tab: queue renders, rows click through, tab choice persists", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    // Empty pipeline → the welcome state, under the tab strip.
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // Fresh session (no stored choice) lands on the Inbox tab.
    await expect(
      authedPage.getByTestId("sales-pipeline-mode-inbox"),
    ).toHaveAttribute("data-active", "true");

    await createAccountViaUi(authedPage, "Inbox Firm");
    await createOpportunityViaUi(authedPage, "Inbox overdue deal", {
      nextAction: "Chase the proposal",
      nextActionDate: localDate(-2),
    });

    // The follow-up queue surfaces the overdue deal on the Inbox tab.
    await expect(
      authedPage.getByTestId("sales-inbox-tab"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    const row = authedPage.getByTestId("sales-followup-row");
    await expect(row).toHaveCount(1, { timeout: STEP_TIMEOUT });
    await expect(row).toContainText("Inbox overdue deal");
    await expect(row).toHaveAttribute("data-reason", "overdue_next_action");

    // The commitment inbox section renders (empty state — no promises).
    await expect(
      authedPage.getByTestId("sales-inbox-empty"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // A queue row jumps straight to the opportunity record.
    await row.click();
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await authedPage.goBack();

    // An explicitly chosen tab persists across reload.
    await ensureTableMode(authedPage);
    await authedPage.reload();
    await expect(
      authedPage.getByTestId("sales-pipeline-mode-table"),
    ).toHaveAttribute("data-active", "true", { timeout: STEP_TIMEOUT });
  });

  test("/sales/inbox redirects to the pipeline with the Inbox tab selected", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    // Park the persisted mode on Table first — the redirect must win.
    await authedPage.goto("/sales");
    await ensureTableMode(authedPage);

    await authedPage.goto("/sales/inbox");
    await expect(authedPage).toHaveURL(/\/sales$/, {
      timeout: STEP_TIMEOUT,
    });
    await expect(
      authedPage.getByTestId("sales-pipeline-mode-inbox"),
    ).toHaveAttribute("data-active", "true", { timeout: STEP_TIMEOUT });
  });

  test("morning-digest card: drafts render and copy to the clipboard", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    // Later registrations win: override the default `digest: null`.
    await authedPage.route("**/api/digest/latest", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          digest: {
            run_date: localDate(0),
            generated_at: new Date().toISOString(),
            attention: [],
            due_commitments: [],
            drafts: [
              {
                opportunity_id: "wi-digest-1",
                identifier: "CRM-90",
                title: "Digest deal",
                account_name: "Digest Firm",
                draft:
                  "Hi Khun A — following up on the pilot scope we discussed; happy to walk the partners through it this week.",
              },
            ],
            drafts_model: "gpt-5.4-mini",
            drafts_error: null,
          },
        }),
      });
    });

    // Seed one deal so the Inbox tab renders its queue (not the empty
    // welcome state).
    await authedPage.goto("/sales");
    await createAccountViaUi(authedPage, "Digest Firm");
    await createOpportunityViaUi(authedPage, "Digest deal");

    const card = authedPage.getByTestId("inbox-digest-card");
    await expect(card).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(authedPage.getByTestId("digest-run-date")).toHaveText(
      localDate(0),
    );

    const draftRow = authedPage.getByTestId("digest-draft-row");
    await expect(draftRow).toHaveCount(1);
    await expect(draftRow).toContainText("Digest deal · Digest Firm");
    await expect(draftRow).toContainText("following up on the pilot scope");

    // Copy puts the draft on the clipboard and confirms inline.
    await authedPage
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await authedPage.getByTestId("digest-draft-copy").click();
    await expect(authedPage.getByTestId("digest-draft-copy")).toHaveText(
      "Copied",
    );
    const clipboard = await authedPage.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboard).toContain("following up on the pilot scope");

    // In dev there is no service worker, so no push toggle renders.
    await expect(
      authedPage.getByTestId("digest-push-toggle"),
    ).toHaveCount(0);
  });

  test("morning-digest card: hidden entirely before the first run", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await createAccountViaUi(authedPage, "Quiet Firm");
    await createOpportunityViaUi(authedPage, "Quiet deal");
    await expect(
      authedPage.getByTestId("sales-inbox-tab"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    // digest: null + no SW registration → the card contributes no chrome.
    await expect(
      authedPage.getByTestId("inbox-digest-card"),
    ).toHaveCount(0);
  });

  test("morning-digest card: a drafting failure is surfaced, never silent", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.route("**/api/digest/latest", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          digest: {
            run_date: localDate(0),
            generated_at: new Date().toISOString(),
            attention: [],
            due_commitments: [],
            drafts: [],
            drafts_model: null,
            drafts_error: "OPENAI_API_KEY is not configured",
          },
        }),
      });
    });

    await authedPage.goto("/sales");
    await createAccountViaUi(authedPage, "Errored Firm");
    await createOpportunityViaUi(authedPage, "Errored deal");
    await expect(
      authedPage.getByTestId("inbox-digest-card"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("digest-drafts-error"),
    ).toContainText("OPENAI_API_KEY");
  });
});
