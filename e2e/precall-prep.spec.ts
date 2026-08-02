/**
 * Pre-call prep E2E (Tier 1 — mocked).
 *
 * The journey BEFORE a call: the morning list says a deal needs
 * attention → the salesperson clicks through → the record tells the
 * story (past call, planned next action) → they ask the AI what to ask
 * IN THE CONTEXT of that record — the drawer frames the deal on the
 * wire (`[Viewing: Deal record: …]`) while the transcript shows only
 * their own words.
 *
 * Assembled from surfaces that each have feature specs (inbox ranking,
 * record page, drawer context) — this walks them as ONE flow, which is
 * how they're actually used.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { setupAskHandlers } from "./handlers/ask.handlers";
import { STEP_TIMEOUT } from "./helpers/sales-ui";

function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

test.describe("Pre-call prep", () => {
  test("morning list → record story → record-framed Ask", async ({
    authedPage,
  }) => {
    const { agentWrites } = await setupSalesHandlers(authedPage);

    // A deal with an OVERDUE next action and a discovery call already
    // on file — the state a real tour deal is in the morning of call 2.
    const accountId = agentWrites.createRecord({
      typeKey: "account",
      stateKey: "active",
      title: "Rattanakorn & Partners",
    });
    const dealId = agentWrites.createRecord({
      typeKey: "opportunity",
      stateKey: "call_booked",
      title: "Rattanakorn — matter chaos",
      parentId: accountId,
    });
    agentWrites.setAttribute(dealId, "next_action", "Prep the demo agenda");
    agentWrites.setAttribute(dealId, "next_action_date", localDate(-1));
    agentWrites.createRecord({
      typeKey: "call_note",
      stateKey: "active",
      title: "Call — Rattanakorn (discovery)",
      parentId: dealId,
    });

    const { capturedStreamInputs, streamContent } =
      await setupAskHandlers(authedPage, {
        streamContent:
          "Ask who owns the pilot budget and confirm the demo scope from the discovery call.",
      });

    // ── The morning list flags the deal ─────────────────────────────
    await authedPage.goto("/sales/inbox");
    const row = authedPage
      .locator("[data-testid='sales-followup-row']", {
        hasText: "Rattanakorn — matter chaos",
      })
      .first();
    await expect(row).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(row).toHaveAttribute("data-reason", "overdue_next_action");
    await expect(row).toContainText("Prep the demo agenda");

    // ── Click through: the record tells the story ───────────────────
    await row.click();
    await authedPage.waitForURL(
      new RegExp(`/sales/opportunity/${dealId}$`),
      { timeout: STEP_TIMEOUT },
    );
    await expect(
      authedPage.locator("[data-testid='sales-call-notes-section-item']", {
        hasText: "discovery",
      }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // ── Ask, framed by THIS record ──────────────────────────────────
    await authedPage.getByTestId("crm-header-ask").click();
    const panel = authedPage.getByTestId("crm-ask-panel");
    await expect(panel).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(panel.getByTestId("sales-ask-context")).toContainText(
      "Rattanakorn — matter chaos",
    );

    const question = "What should I ask them in today's call?";
    await panel.getByTestId("crm-ask-input").fill(question);
    await panel.getByTestId("crm-ask-input").press("Enter");

    // Transcript shows only the user's words; the reply streams in.
    await expect(panel.getByTestId("crm-ask-message-user")).toHaveText(
      question,
    );
    await expect(panel.getByTestId("crm-ask-message-assistant")).toContainText(
      streamContent,
      { timeout: STEP_TIMEOUT },
    );

    // The WIRE carried the record framing the drawer promised.
    expect(capturedStreamInputs[0]).toContain(
      "[Viewing: Deal record: Rattanakorn — matter chaos",
    );
    expect(capturedStreamInputs[0]).toContain(question);
  });
});
