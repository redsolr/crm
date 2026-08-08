/**
 * Ask surface E2E (Tier 1 — mocked).
 *
 * The Attio-"Ask"-class AI chat, two surfaces on one conversation:
 *
 * Drawer → page journey:
 *   sidebar no longer carries an Ask nav button → open the drawer via
 *   the view header's rightmost sparkle icon → empty-state suggestions
 *   → Escape dismisses → reopen → send a question → user bubble renders
 *   immediately → mocked SSE reply streams in → expand → lands on
 *   /sales/ask with the SAME transcript → a follow-up sent from the
 *   full page streams too → "new conversation" clears the transcript.
 *
 * Page context: opened over a record page, the drawer shows a context
 * chip for that record, and the WIRE payload carries a delimited
 * `[Viewing: …]` preamble while the visible bubble shows only the
 * user's own words (asserted via the handler's captured request bodies).
 *
 * Mock layer: `setupSalesHandlers` mounts the sales workspace bundle so
 * the shell renders; `setupAskHandlers` mounts the two chat endpoints the
 * surface touches (POST /api/chats + POST /api/chats/:id/responses SSE)
 * and captures every stream request's `input` for wire assertions.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { setupAskHandlers } from "./handlers/ask.handlers";
import {
  createAccountViaUi,
  openFullViewViaPeek,
  STEP_TIMEOUT,
} from "./helpers/sales-ui";

test.describe("Ask surface", () => {
  test("opens from the header icon, streams in the drawer, expands to /sales/ask with the same transcript", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    const { streamContent, capturedStreamInputs } =
      await setupAskHandlers(authedPage);

    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("crm-shell")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    // ── The sidebar entry point is gone ─────────────────────────────
    await expect(authedPage.getByTestId("crm-nav-ask")).toHaveCount(0);

    // ── Open via the view header's rightmost icon ───────────────────
    const headerAsk = authedPage.getByTestId("crm-header-ask");
    await expect(headerAsk).toBeVisible({ timeout: STEP_TIMEOUT });
    await headerAsk.click();
    const panel = authedPage.getByTestId("crm-ask-panel");
    await expect(panel).toBeVisible({ timeout: STEP_TIMEOUT });

    // Empty state shows the founder-CRM suggestions, and the header
    // frames the current view as the conversation's context — the
    // landing surface is the Inbox tab (2026-08-08), and the context
    // is mode-aware.
    await expect(panel.getByTestId("crm-ask-suggestion-0")).toContainText(
      "Which deals need attention this week?",
    );
    await expect(panel.getByTestId("sales-ask-context")).toContainText(
      "Summary",
    );

    // ── Escape dismisses; the header icon re-summons ────────────────
    await authedPage.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await headerAsk.click();
    await expect(panel).toBeVisible({ timeout: STEP_TIMEOUT });

    // ── Send a message from the drawer ──────────────────────────────
    const question = "Which deals need attention this week?";
    await panel.getByTestId("crm-ask-input").fill(question);
    await panel.getByTestId("crm-ask-input").press("Enter");

    // User bubble renders immediately — the user's own words only, no
    // [Viewing: …] preamble (that rides the wire, not the transcript).
    await expect(panel.getByTestId("crm-ask-message-user")).toHaveText(
      question,
      { timeout: STEP_TIMEOUT },
    );

    // Streamed assistant reply arrives (mocked SSE chunks).
    await expect(
      panel.getByTestId("crm-ask-message-assistant"),
    ).toContainText(streamContent, { timeout: STEP_TIMEOUT });

    // Stream finished — composer is re-enabled for a follow-up.
    await expect(panel.getByTestId("crm-ask-input")).toBeEnabled({
      timeout: STEP_TIMEOUT,
    });

    // The wire payload carried the Inbox context preamble (the
    // landing tab frames the conversation).
    expect(capturedStreamInputs).toHaveLength(1);
    expect(capturedStreamInputs[0]).toBe(
      `[Viewing: Inbox (follow-ups + commitments)]\n\n${question}`,
    );

    // ── Expand → full-page /sales/ask, same conversation ────────────
    await panel.getByTestId("sales-ask-expand").click();
    await expect(authedPage).toHaveURL(/\/sales\/ask$/, {
      timeout: STEP_TIMEOUT,
    });
    const view = authedPage.getByTestId("sales-ask-view");
    await expect(view).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(authedPage.getByTestId("crm-ask-panel")).toHaveCount(0);

    // The transcript carried over.
    await expect(view.getByTestId("crm-ask-message-user")).toHaveText(
      question,
    );
    await expect(view.getByTestId("crm-ask-message-assistant")).toContainText(
      streamContent,
    );

    // ── A follow-up sent from the full page streams too ─────────────
    const followUp = "And what about Bluebird specifically?";
    await view.getByTestId("crm-ask-input").fill(followUp);
    await view.getByTestId("crm-ask-input").press("Enter");

    await expect(view.getByTestId("crm-ask-message-user")).toHaveCount(2, {
      timeout: STEP_TIMEOUT,
    });
    await expect(
      view.getByTestId("crm-ask-message-assistant").nth(1),
    ).toContainText(streamContent, { timeout: STEP_TIMEOUT });

    // The full page sends WITHOUT any page-context preamble.
    expect(capturedStreamInputs).toHaveLength(2);
    expect(capturedStreamInputs[1]).toBe(followUp);

    // ── New conversation resets the transcript ──────────────────────
    await view.getByTestId("sales-ask-new").click();
    await expect(view.getByTestId("crm-ask-message-user")).toHaveCount(0);
    await expect(view.getByTestId("crm-ask-suggestion-0")).toBeVisible();
  });

  test("opened over a record page, the drawer frames the record as context on the wire but not in the transcript", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    const { streamContent, capturedStreamInputs } =
      await setupAskHandlers(authedPage);

    // Create a company and land on its detail page (peek → expand).
    await authedPage.goto("/sales");
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await createAccountViaUi(authedPage, "Baker & Partners");
    await authedPage.goto("/sales/companies");
    await openFullViewViaPeek(
      authedPage,
      authedPage.getByTestId("sales-companies-cell-company").first(),
    );
    await expect(
      authedPage.getByTestId("sales-account-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // Open the drawer from the record header — the chip names the record.
    await authedPage.getByTestId("crm-header-ask").click();
    const panel = authedPage.getByTestId("crm-ask-panel");
    await expect(panel).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(panel.getByTestId("sales-ask-context")).toContainText(
      "Baker & Partners",
    );

    // Send — the bubble shows ONLY the user's words…
    const question = "What do we know about them?";
    await panel.getByTestId("crm-ask-input").fill(question);
    await panel.getByTestId("crm-ask-input").press("Enter");
    await expect(panel.getByTestId("crm-ask-message-user")).toHaveText(
      question,
      { timeout: STEP_TIMEOUT },
    );
    await expect(
      panel.getByTestId("crm-ask-message-assistant"),
    ).toContainText(streamContent, { timeout: STEP_TIMEOUT });

    // …while the wire payload carried the record-context preamble
    // (mock identifiers are SALES-<n>; the first created item is SALES-1).
    expect(capturedStreamInputs).toHaveLength(1);
    expect(capturedStreamInputs[0]).toBe(
      `[Viewing: Company record: Baker & Partners (SALES-1)]\n\n${question}`,
    );
  });

  test("renders agent tool steps and refreshes the pipeline after the agent acts", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await setupAskHandlers(authedPage, {
      streamContent: "Done — logged the deal for Bangkok Legal.",
      toolSteps: [
        {
          tool_name: "create_account",
          summary: 'Created account "Bangkok Legal" (id wi_e2e1).',
        },
        {
          tool_name: "create_opportunity",
          summary:
            'Created opportunity "Bangkok Legal — matter_chaos" (id wi_e2e2) in stage identified under account "Bangkok Legal".',
        },
      ],
    });

    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("crm-shell")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage.getByTestId("crm-header-ask").click();
    const panel = authedPage.getByTestId("crm-ask-panel");
    await expect(panel).toBeVisible({ timeout: STEP_TIMEOUT });

    // Registered BEFORE the send: the only work-items GET after this
    // point is the post-write invalidation refetch (page-load fetches
    // already happened).
    const pipelineRefetch = authedPage.waitForRequest(
      (req) =>
        req.method() === "GET" && req.url().includes("/api/work_items"),
      { timeout: 15_000 },
    );

    await panel
      .getByTestId("crm-ask-input")
      .fill("Log a deal for Bangkok Legal, referral, matter chaos");
    await panel.getByTestId("crm-ask-input").press("Enter");

    // Both tool steps render as "✓ <summary>" lines, in execution order,
    // above the final answer.
    const steps = panel.getByTestId("crm-ask-tool-step");
    await expect(steps).toHaveCount(2, { timeout: STEP_TIMEOUT });
    await expect(steps.first()).toContainText(
      'Created account "Bangkok Legal"',
    );
    await expect(steps.nth(1)).toContainText("in stage identified");
    await expect(
      panel.getByTestId("crm-ask-message-assistant"),
    ).toContainText("Done — logged the deal", { timeout: STEP_TIMEOUT });

    // The write steps invalidated the record queries — the pipeline view
    // behind the drawer refetched without a manual refresh.
    await pipelineRefetch;
  });

  test("the drawer is drag-resizable and the width survives reopen", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await setupAskHandlers(authedPage);

    await authedPage.goto("/sales");
    await authedPage.getByTestId("crm-header-ask").click();
    const panel = authedPage.getByTestId("crm-ask-panel");
    await expect(panel).toBeVisible({ timeout: STEP_TIMEOUT });

    const before = await panel.boundingBox();
    if (!before) throw new Error("panel has no bounding box");

    // Drag the leading-edge handle 120px further left → panel widens.
    const handle = authedPage.getByTestId("crm-ask-resize-handle");
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error("resize handle has no bounding box");
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    await authedPage.mouse.move(startX, startY);
    await authedPage.mouse.down();
    await authedPage.mouse.move(startX - 120, startY, { steps: 8 });
    await authedPage.mouse.up();

    const after = await panel.boundingBox();
    if (!after) throw new Error("panel has no bounding box after drag");
    expect(after.width).toBeGreaterThan(before.width + 80);

    // The chosen width persists across close → reopen (localStorage).
    await authedPage.getByTestId("crm-ask-close").click();
    await expect(panel).toHaveCount(0);
    await authedPage.getByTestId("crm-header-ask").click();
    await expect(panel).toBeVisible({ timeout: STEP_TIMEOUT });
    const reopened = await panel.boundingBox();
    if (!reopened) throw new Error("panel has no bounding box on reopen");
    expect(Math.abs(reopened.width - after.width)).toBeLessThanOrEqual(2);
  });
});
