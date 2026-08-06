/**
 * Sales journey E2E (Tier 1 — mocked).
 *
 * Walks the full founder-led-sales flow:
 *   add account (with source) → assert sales_first_lead_added
 *   add opportunity under it (with use_case) → assert sales_first_opportunity_created
 *   log call_note under opportunity (with outcome) → assert sales_first_call_logged
 *   add commitment under opportunity (with due_date) → assert sales_first_commitment_created
 *   mark commitment done → assert sales_first_commitment_completed
 *   transition opportunity through pipeline stages
 *   transition opportunity to won → assert state.category === 'done'
 *   assert account stays on Memory workflow (state.category === 'active')
 *
 * Mock layer: `setupSalesHandlers` mounts the entire `sales-pipeline`
 * template — workflows + states + types + attribute defs — and a
 * stateful in-memory work-item store. PostHog events are captured via
 * `window.posthog.capture` shim installed at page init.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { pickOption } from "./helpers/select";
import {
  STEP_TIMEOUT,
  ensureBoardMode,
  openFullViewViaPeek,
} from "./helpers/sales-ui";

test.describe("Sales journey", () => {
  test("add account → opportunity → call → commitment → won", async ({
    authedPage,
  }) => {
    // The activation helper records each fired rung in
    // localStorage under `sales-activation-ladder` after calling
    // posthog.capture. Reading that key is the structural way to
    // verify the ladder — no posthog-js mock needed.
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");

    const view = authedPage.locator(".sales-pipeline-view");
    await expect(view).toBeVisible({ timeout: 15000 });

    // ── Empty-state primary CTA visible (no leads yet) ─────────────
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toBeVisible();

    // This journey drives the BOARD (cards, columns, stage drags) —
    // opt into it explicitly since table became the default.
    await ensureBoardMode(authedPage);

    // ── 1) Add account ────────────────────────────────────────────
    await authedPage.getByTestId("sales-add-account-button").click();
    await authedPage
      .getByTestId("sales-account-name-input")
      .fill("Acme, Inc.");
    await pickOption(authedPage.getByTestId("sales-account-source-select"), "intro");
    await authedPage.getByRole("button", { name: /Add company/i }).click();

    // Modal closes; account is created — header tile updates
    await expect(authedPage.getByText(/1 account/)).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    // Activation rung 1 fired
    await waitForActivation(authedPage, "sales_first_lead_added");

    // ── 2) Add opportunity ────────────────────────────────────────
    await authedPage.getByTestId("sales-add-opportunity-button").click();
    await authedPage
      .getByTestId("sales-opportunity-title-input")
      .fill("Acme — Workflow pilot");
    await pickOption(authedPage.getByTestId("sales-opportunity-account-select"), { label: "Acme, Inc." });
    await pickOption(authedPage.getByTestId("sales-opportunity-use-case-select"), "matter_chaos");
    await authedPage.locator('input[type="number"]').first().fill("120000");
    await authedPage
      .getByRole("button", { name: /Create opportunity/i })
      .click();

    // Opportunity card now visible in the kanban board.
    const card = authedPage.locator("[data-testid='sales-kanban-card']", {
      hasText: "Acme — Workflow pilot",
    });
    await expect(card).toBeVisible({ timeout: STEP_TIMEOUT });

    // Attio-lite: the header now carries the live active-pipeline value
    // (sum of value estimates across active opportunities).
    await expect(
      authedPage.getByTestId("sales-pipeline-value"),
    ).toContainText("฿120,000 active", { timeout: STEP_TIMEOUT });

    await waitForActivation(authedPage, "sales_first_opportunity_created");

    // ── Account detail (via Companies sidebar nav → table row) ────
    // The kanban card has no in-card account link (would interfere
    // with drag); accounts are reached via the dedicated Companies
    // table at /sales/companies.
    await authedPage.getByTestId("sales-nav-companies").click();
    await expect(
      authedPage.getByTestId("sales-companies-view"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    // Attio-lite claims: the list declares its last-activity sort, each
    // row carries a live last-activity cell, and the footer is a real
    // calculation row (companies + opportunities), not a bare count.
    await expect(
      authedPage.getByTestId("sales-companies-sort-chip"),
    ).toBeVisible();
    await expect(
      authedPage.getByTestId("sales-companies-last-activity").first(),
    ).not.toHaveText("—");
    await expect(
      authedPage.getByTestId("sales-companies-footer"),
    ).toContainText("1 company · 1 opportunity");
    const acmeRow = authedPage.locator(
      "[data-testid='sales-companies-row']",
      { hasText: "Acme, Inc." },
    );
    await expect(acmeRow).toBeVisible();
    // Row click opens the PEEK panel with the record's details inline —
    // no navigation. It shows the company plus its opportunities.
    // Target the Company cell explicitly: since the Attio table slice,
    // attribute cells are inline-EDITABLE and swallow the click (they
    // open the cell editor instead of the peek), so a row-center click
    // is ambiguous.
    await acmeRow.getByTestId("sales-companies-cell-company").click();
    await expect(authedPage.getByTestId("sales-peek-panel")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await expect(authedPage.getByTestId("sales-peek-title")).toContainText(
      "Acme, Inc.",
    );
    await expect(authedPage.getByTestId("sales-peek-panel")).toContainText(
      "Acme — Workflow pilot",
    );
    // Expand promotes to the full account detail view.
    await authedPage.getByTestId("sales-peek-expand").click();
    await expect(
      authedPage.getByTestId("sales-account-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(authedPage.getByTestId("sales-account-title")).toContainText(
      "Acme, Inc.",
    );
    await expect(
      authedPage.locator("[data-testid='sales-account-opportunity-item']"),
    ).toContainText("Acme — Workflow pilot");
    await authedPage.getByTestId("sales-account-back").click();
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    // ── Open opportunity detail (card → peek → expand) ───────────
    await openFullViewViaPeek(authedPage, card);
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    const opportunityId = await getOpportunityIdFromUrl(authedPage);

    // ── 3) Log a call_note ────────────────────────────────────────
    await authedPage.getByTestId("sales-add-call-note-button").click();
    await authedPage
      .getByTestId("sales-call-note-title-input")
      .fill("Discovery call");
    await pickOption(authedPage.getByTestId("sales-call-note-outcome-select"), "positive");
    await authedPage
      .getByRole("button", { name: "Log call", exact: true })
      .click();

    await expect(
      authedPage.locator("[data-testid='sales-call-notes-section-item']"),
    ).toContainText("Discovery call", { timeout: STEP_TIMEOUT });

    await waitForActivation(authedPage, "sales_first_call_logged");

    // ── 4) Record a commitment ────────────────────────────────────
    await authedPage.getByTestId("sales-add-commitment-button").click();
    await authedPage
      .getByTestId("sales-commitment-title-input")
      .fill("Send proposal");
    await authedPage
      .getByTestId("sales-commitment-due-date-input")
      .fill("2026-12-31");
    await authedPage
      .getByRole("button", { name: "Record commitment", exact: true })
      .click();

    const commitmentItem = authedPage.locator(
      "[data-testid='sales-commitments-section-item']",
    );
    await expect(commitmentItem).toContainText("Send proposal", {
      timeout: STEP_TIMEOUT,
    });

    await waitForActivation(authedPage, "sales_first_commitment_created");

    // ── 5a) Inbox surfaces the commitment before completion ───────
    // Navigate via the sidebar nav (replaces the old top-tab toggle).
    await authedPage.getByTestId("sales-opportunity-back").click();
    await expect(authedPage.getByTestId("sales-pipeline")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage.getByTestId("sales-nav-inbox").click();
    const inbox = authedPage.getByTestId("sales-inbox");
    await expect(inbox).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      inbox.locator("[data-testid$='-item']", { hasText: "Send proposal" }),
    ).toBeVisible();
    await inbox
      .locator("[data-testid$='-item']", { hasText: "Send proposal" })
      .getByTestId("sales-inbox-toggle-done")
      .click();
    await waitForActivation(authedPage, "sales_first_commitment_completed");
    await expect(
      authedPage
        .getByTestId("sales-inbox-done")
        .locator("[data-testid='sales-inbox-done-item']", {
          hasText: "Send proposal",
        }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // Back to the pipeline kanban + into the opportunity card for the
    // rest of the journey (stage transitions live on the detail view).
    await authedPage.getByTestId("sales-nav-pipeline").click();
    await openFullViewViaPeek(
      authedPage,
      authedPage.locator("[data-testid='sales-kanban-card']", {
        hasText: "Acme — Workflow pilot",
      }),
    );
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // ── 6) Transition opportunity through pipeline ────────────────
    const stageSelect = authedPage.getByTestId(
      "sales-opportunity-detail-stage-select",
    );
    await pickOption(stageSelect, "contacted");
    await expect(stageSelect).toHaveAttribute("data-value", "contacted", { timeout: STEP_TIMEOUT });
    await pickOption(stageSelect, "call_done");
    await expect(stageSelect).toHaveAttribute("data-value", "call_done", { timeout: STEP_TIMEOUT });
    await pickOption(stageSelect, "trial");
    await expect(stageSelect).toHaveAttribute("data-value", "trial", { timeout: STEP_TIMEOUT });

    // ── 7) Transition to won — assert state.category === 'done' ────
    await pickOption(stageSelect, "won");
    await expect(stageSelect).toHaveAttribute("data-value", "won", { timeout: STEP_TIMEOUT });

    // Fetch the persisted state via the mock — the API call from the
    // page's perspective is the source of truth for category.
    const opportunityState = await authedPage.evaluate(async (id) => {
      const res = await fetch(
        `http://localhost:3100/api/work_items/${id}`,
        { credentials: "include" },
      );
      const body = (await res.json()) as {
        workItem: { state: { key: string; category: string } };
      };
      return body.workItem.state;
    }, opportunityId);
    expect(opportunityState.key).toBe("won");
    expect(opportunityState.category).toBe("done");

    // ── 8) Account stays on Memory workflow (category === 'active') ─
    const accountState = await authedPage.evaluate(async () => {
      const res = await fetch(
        `http://localhost:3100/api/work_items?type_key=account&workspace_id=ws-e2e-default`,
        { credentials: "include" },
      );
      const body = (await res.json()) as {
        data: Array<{ state: { key: string; category: string } }>;
      };
      return body.data[0]?.state;
    });
    expect(accountState?.key).toBe("active");
    expect(accountState?.category).toBe("active");
  });

  // Architecture coverage: the BE auto-provisions a Sales container
  // for every tenant at signup time. A user landing on /sales must
  // see the Welcome state immediately — never the defensive
  // "Setting up Sales…" placeholder, never a "Set up Sales" CTA.
  // The defensive state stays in the code as a transient race
  // guard but is structurally not part of the user journey.
  test("freshly authed user lands on Welcome state, never on no-project defensive", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");

    // Welcome empty-state CTA visible — primary action is Add first
    // lead, not Set up Sales.
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toContainText(/Add first lead|Add first opportunity/);

    // Defensive "setting up" placeholder must NOT show — the BE
    // auto-provision contract guarantees the Sales container exists
    // by the time the user arrives. Regression here means
    // `provisionModuleContainers` stopped firing OR the FE filter
    // (`isModuleContainer`) is wrongly hiding the Sales container
    // from the resolver too.
    await expect(authedPage.getByTestId("sales-no-project")).not.toBeVisible();
  });

  // Phase 2B coverage: lost-reason flow + real filter-pill date math.
  test("lost-reason modal + overdue filter pill", async ({ authedPage }) => {
    await setupSalesHandlers(authedPage);
    await authedPage.goto("/sales");
    await ensureBoardMode(authedPage);

    // Add company + opportunity quickly.
    await authedPage.getByTestId("sales-add-account-button").click();
    await authedPage
      .getByTestId("sales-account-name-input")
      .fill("LostCo");
    await pickOption(authedPage.getByTestId("sales-account-source-select"), "intro");
    await authedPage.getByRole("button", { name: /Add company/i }).click();
    await expect(authedPage.getByText(/1 account/)).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    await authedPage.getByTestId("sales-add-opportunity-button").click();
    await authedPage
      .getByTestId("sales-opportunity-title-input")
      .fill("LostCo — Workflow eval");
    await pickOption(authedPage.getByTestId("sales-opportunity-account-select"), { label: "LostCo" });
    await pickOption(authedPage.getByTestId("sales-opportunity-use-case-select"), "matter_chaos");

    // Set next_action_date to yesterday so the overdue filter has a hit.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await authedPage
      .locator('input[type="date"]')
      .first()
      .fill(yesterday);
    await authedPage
      .getByRole("button", { name: /Create opportunity/i })
      .click();

    // Overdue badge surfaces on the kanban card.
    await expect(
      authedPage.getByTestId("sales-kanban-card-overdue-badge"),
    ).toBeVisible({ timeout: 10000 });

    // Overdue filter narrows to one card in the kanban.
    await authedPage.getByTestId("sales-filter-overdue").click();
    await expect(
      authedPage.locator("[data-testid='sales-kanban-card']"),
    ).toHaveCount(1);

    // Due-today filter empties (the only opp is overdue, not due today).
    await authedPage.getByTestId("sales-filter-due_today").click();
    await expect(
      authedPage.locator("[data-testid='sales-kanban-card']"),
    ).toHaveCount(0);

    // No-next-action filter also empties (we set a date).
    await authedPage.getByTestId("sales-filter-no_next_action").click();
    await expect(
      authedPage.locator("[data-testid='sales-kanban-card']"),
    ).toHaveCount(0);

    // Back to All so the card is reachable.
    await authedPage.getByTestId("sales-filter-all").click();

    // Open the opportunity detail to drive the lost transition via the
    // detail-page stage select (in-card stage select was removed when
    // we promoted the pipeline to a kanban — drag is the new mechanism;
    // detail page is the click-path for closures).
    await openFullViewViaPeek(
      authedPage,
      authedPage.locator("[data-testid='sales-kanban-card']", {
        hasText: "LostCo — Workflow eval",
      }),
    );
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await pickOption(authedPage.getByTestId("sales-opportunity-detail-stage-select"), "lost");
    const lostReasonSelect = authedPage.getByTestId(
      "sales-transition-lost-reason-select",
    );
    await expect(lostReasonSelect).toBeVisible();
    const lostCta = authedPage.getByRole("button", {
      name: "Mark lost",
      exact: true,
    });
    await expect(lostCta).toBeDisabled();
    await pickOption(lostReasonSelect, "competitor");
    await expect(lostCta).toBeEnabled();
    await lostCta.click();

    // Wait for the modal to close — that's the signal the mutate
    // chain (upsert + transition) finished.
    await expect(lostReasonSelect).not.toBeVisible({ timeout: STEP_TIMEOUT });

    // The detail page's stage select reflects the new state.
    await expect(
      authedPage.getByTestId("sales-opportunity-detail-stage-select"),
    ).toHaveAttribute("data-value", "lost", { timeout: STEP_TIMEOUT });

    // Opportunity transitioned to lost (state.category === 'dead') and
    // the lost_reason attribute persisted server-side.
    const result = await authedPage.evaluate(async () => {
      const res = await fetch(
        `http://localhost:3100/api/work_items?type_key=opportunity&workspace_id=ws-e2e-default`,
        { credentials: "include" },
      );
      const body = (await res.json()) as {
        data: Array<{
          id: string;
          state: { key: string; category: string };
        }>;
      };
      const opp = body.data[0]!;
      const av = await fetch(
        `http://localhost:3100/api/work_items/${opp.id}/attribute_values`,
        { credentials: "include" },
      );
      const avBody = (await av.json()) as {
        data: Array<{ definition_id: string; value: unknown }>;
      };
      const lostReasonRow = avBody.data.find(
        (v) => v.definition_id === "ad-wit-opportunity-lost_reason",
      );
      return {
        state: opp.state,
        lostReason: lostReasonRow?.value ?? null,
      };
    });
    expect(result.state.key).toBe("lost");
    expect(result.state.category).toBe("dead");
    // Raw fetch, no client unwrap — asserts the canonical WIRE shape
    // (the platform serves the storage envelope `{ value: <typed> }`).
    expect(result.lostReason).toEqual({ value: "competitor" });
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function waitForActivation(
  page: import("@playwright/test").Page,
  event: string,
) {
  await page.waitForFunction(
    (eventName) => {
      try {
        const raw = window.localStorage.getItem(
          "sales-activation-ladder",
        );
        if (!raw) return false;
        const receipts = JSON.parse(raw) as Record<string, string>;
        return eventName in receipts;
      } catch {
        return false;
      }
    },
    event,
    { timeout: STEP_TIMEOUT },
  );
}

async function getOpportunityIdFromUrl(
  page: import("@playwright/test").Page,
): Promise<string> {
  // After clicking the opportunity card the SalesPipelineView pushes
  // `/sales/opportunity/<id>` via Next router. The id segment is the
  // canonical handle the BE issued during create.
  const url = page.url();
  const match = url.match(/\/sales\/opportunity\/([^/?#]+)/);
  if (!match) throw new Error(`Could not extract opportunity id from ${url}`);
  return match[1]!;
}
