/**
 * Conversational CRM ops E2E (Tier 1 — mocked).
 *
 * THE journey the Chat tab exists for: the salesperson finishes a call
 * and TELLS the AI what happened — "just finished the call with X,
 * went well, book the follow-up" — and the agent does the logging:
 * call note + stage move + commitment. The spec asserts the RECORDS
 * actually changed behind the chat (deal page + Inbox), not merely
 * that tool-step lines rendered or a refetch fired.
 *
 * Mock shape: `setupAskHandlers`' scripted turn streams three tool
 * steps and, via `onSend`, APPLIES the equivalent writes to the sales
 * mock store (`setupSalesHandlers(...).agentWrites`) — the same
 * separation the real stack has (SSE narration vs. DB writes), at
 * zero LLM spend.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { setupAskHandlers } from "./handlers/ask.handlers";
import { STEP_TIMEOUT } from "./helpers/sales-ui";
import { localDate } from "./helpers/dates";

test.describe("Conversational CRM ops", () => {
  test("'just finished the call' narrative → agent logs call, moves stage, books follow-up → views change", async ({
    authedPage,
  }) => {
    const { agentWrites } = await setupSalesHandlers(authedPage);

    // The pipeline the salesperson already has: one company, one deal
    // sitting at call_booked (today's call).
    const accountId = agentWrites.createRecord({
      typeKey: "account",
      stateKey: "active",
      title: "Thonglor Legal Group",
    });
    const dealId = agentWrites.createRecord({
      typeKey: "opportunity",
      stateKey: "call_booked",
      title: "Thonglor Legal — drafting",
      parentId: accountId,
    });

    await setupAskHandlers(authedPage, {
      streamContent:
        "Logged the call, moved the deal to Call done, and booked the pricing follow-up for tomorrow.",
      toolSteps: [
        {
          tool_name: "log_call_note",
          summary: 'Logged call "Call — Thonglor Legal Group" (positive).',
        },
        {
          tool_name: "update_opportunity",
          summary: 'Moved "Thonglor Legal — drafting" to stage Call done.',
        },
        {
          tool_name: "create_commitment",
          summary:
            'Recorded commitment "Send pilot pricing to Khun Somchai" due tomorrow.',
        },
      ],
      // The writes those steps claim — applied to the store so every
      // view the spec visits afterwards reflects them.
      onSend: () => {
        agentWrites.createRecord({
          typeKey: "call_note",
          stateKey: "active",
          title: "Call — Thonglor Legal Group",
          parentId: dealId,
        });
        agentWrites.transition(dealId, "call_done");
        const commitmentId = agentWrites.createRecord({
          typeKey: "commitment",
          stateKey: "open",
          title: "Send pilot pricing to Khun Somchai",
          parentId: dealId,
        });
        agentWrites.setAttribute(commitmentId, "due_date", localDate(1));
      },
    });

    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("crm-shell")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    // ── Tell the AI what happened, in the Chat tab ──────────────────
    await authedPage.getByTestId("sales-nav-chat").click();
    await expect(authedPage.getByTestId("sales-ask-view")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage
      .getByTestId("crm-ask-input")
      .fill(
        "Just finished the call with Thonglor Legal — went well, they want pilot pricing. Log it, move the deal forward, and book the follow-up for tomorrow.",
      );
    await authedPage.keyboard.press("Enter");

    // The agent narrates its three writes, then confirms.
    const steps = authedPage.getByTestId("crm-ask-tool-step");
    await expect(steps).toHaveCount(3, { timeout: STEP_TIMEOUT });
    await expect(steps.nth(0)).toContainText("Logged call");
    await expect(steps.nth(1)).toContainText("stage Call done");
    await expect(steps.nth(2)).toContainText("due tomorrow");
    await expect(
      authedPage.getByTestId("crm-ask-message-assistant"),
    ).toContainText("Logged the call", { timeout: STEP_TIMEOUT });

    // ── The deal record REALLY changed ──────────────────────────────
    await authedPage.goto(`/sales/opportunity/${dealId}`);
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-opportunity-detail-stage-select"),
    ).toHaveValue("call_done", { timeout: STEP_TIMEOUT });
    await expect(
      authedPage.locator("[data-testid='sales-call-notes-section-item']", {
        hasText: "Call — Thonglor Legal Group",
      }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(
      authedPage.locator("[data-testid='sales-commitments-section-item']", {
        hasText: "Send pilot pricing",
      }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // ── …and tomorrow's follow-up is already on the morning list ────
    await authedPage.getByTestId("sales-nav-inbox").click();
    await expect(
      authedPage.locator("[data-testid='sales-inbox-upcoming-item']", {
        hasText: "Send pilot pricing",
      }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
  });
});
