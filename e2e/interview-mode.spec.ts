/**
 * Live interview mode E2E (Tier 1 — mocked).
 *
 * Claims under test, in one continuous flow (mirrors a real tour
 * meeting):
 *   1. Interview launches from the opportunity detail header.
 *   2. Tap-only answering: choice chips select without typing.
 *   3. Draft resilience: exiting mid-interview and reopening resumes
 *      with answers intact ("Resumed draft").
 *   4. Scripted branching: picking "LINE chat" pulls in the retrieval
 *      follow-up question.
 *   5. AI rail: "Suggest follow-ups" hits `/api/responses` (mocked
 *      here) and "Ask this" inserts the suggestion as the next
 *      question.
 *   6. Finish → review → save creates a call note under the
 *      opportunity with the transcript as its description.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { API_ROOT } from "./handlers/shared";
import { ensureBoardMode } from "./helpers/sales-ui";
import { pickOption } from "./helpers/select";

const STEP_TIMEOUT = 15_000;

const SUGGESTION_TEXT = [
  "1. What happens when the assistant is on leave?",
  "2. How long does finding an old file usually take?",
  "3. Who pays when a document can't be found?",
].join("\n");

test.describe("Interview mode", () => {
  test("tap-through interview with branching, AI follow-up, and call-note save", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);

    // Mock the platform's reasoning endpoint for AI suggestions.
    let responsesCalls = 0;
    await authedPage.route(`${API_ROOT}/responses`, async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      responsesCalls += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "resp_e2e_1",
          object: "response",
          ask: "text",
          model: "mock-model",
          output: { text: SUGGESTION_TEXT },
          sources: [],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      });
    });

    await authedPage.goto("/sales");
    await ensureBoardMode(authedPage);
    await expect(authedPage.locator(".sales-pipeline-view")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    // ── Seed an account + opportunity via the UI ──────────────────
    await authedPage.getByTestId("sales-add-account-button").click();
    await authedPage
      .getByTestId("sales-account-name-input")
      .fill("Siam Law Partners");
    await pickOption(authedPage.getByTestId("sales-account-source-select"), "event");
    await authedPage.getByRole("button", { name: /Add company/i }).click();
    await expect(authedPage.getByText(/1 account/)).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    await authedPage.getByTestId("sales-add-opportunity-button").click();
    await authedPage
      .getByTestId("sales-opportunity-title-input")
      .fill("Siam Law — tour visit");
    await pickOption(authedPage.getByTestId("sales-opportunity-account-select"), { label: "Siam Law Partners" });
    await pickOption(authedPage.getByTestId("sales-opportunity-use-case-select"), "matter_chaos");
    await authedPage
      .getByRole("button", { name: /Create opportunity/i })
      .click();
    const card = authedPage.locator("[data-testid='sales-kanban-card']", {
      hasText: "Siam Law — tour visit",
    });
    await expect(card).toBeVisible({ timeout: STEP_TIMEOUT });
    // Card click opens the peek panel; expand promotes to the full view.
    await card.click();
    await expect(authedPage.getByTestId("sales-peek-panel")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await authedPage.getByTestId("sales-peek-expand").click();
    await expect(
      authedPage.getByTestId("sales-opportunity-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // ── 1) Launch interview ───────────────────────────────────────
    await authedPage.getByTestId("interview-start-button").click();
    await expect(authedPage.getByTestId("interview-mode")).toBeVisible();
    await expect(authedPage.getByTestId("interview-prompt")).toContainText(
      "How many lawyers",
    );

    // ── 2) Tap-only answer ────────────────────────────────────────
    // Skip/Next contract: both buttons render on every question in
    // fixed spots; Next is disabled until the question is answered
    // (advancing empty is the conscious Skip tap).
    await expect(
      authedPage.getByTestId("interview-next-button"),
    ).toBeDisabled();
    await expect(
      authedPage.getByTestId("interview-skip-button"),
    ).toBeVisible();
    const firmSizeChip = authedPage.getByTestId("interview-choice-firm_2_5");
    await firmSizeChip.click();
    await expect(firmSizeChip).toHaveAttribute("aria-pressed", "true");
    await expect(
      authedPage.getByTestId("interview-next-button"),
    ).toBeEnabled();
    await expect(
      authedPage.getByTestId("interview-skip-button"),
    ).toBeVisible();

    // ── 3) Exit and resume — draft survives ───────────────────────
    await authedPage.getByTestId("interview-exit-button").click();
    await expect(authedPage.getByTestId("interview-mode")).toHaveCount(0);
    await authedPage.getByTestId("interview-start-button").click();
    await expect(authedPage.getByTestId("interview-mode")).toBeVisible();
    await expect(authedPage.getByText("Resumed draft")).toBeVisible();
    await expect(
      authedPage.getByTestId("interview-choice-firm_2_5"),
    ).toHaveAttribute("aria-pressed", "true");

    // ── Advance to the intake question ────────────────────────────
    await authedPage.getByTestId("interview-next-button").click();
    await expect(authedPage.getByTestId("interview-prompt")).toContainText(
      "caseload",
    );
    await authedPage.getByTestId("interview-choice-litigation").click();
    await authedPage.getByTestId("interview-next-button").click();
    await expect(authedPage.getByTestId("interview-prompt")).toContainText(
      "client sent you documents",
    );

    // ── 4) Branching: LINE chat pulls in the retrieval follow-up ──
    await authedPage.getByTestId("interview-choice-line_chat").click();
    await authedPage
      .getByTestId("interview-note-input")
      .fill("everything lives in LINE");
    await authedPage.getByTestId("interview-next-button").click();
    await expect(authedPage.getByTestId("interview-prompt")).toContainText(
      "Three weeks later",
    );
    await authedPage.getByTestId("interview-choice-scroll_chat").click();

    // ── 5) AI suggestions: request, then ask one ──────────────────
    await authedPage.getByTestId("interview-suggest-button").click();
    const suggestions = authedPage.getByTestId("interview-suggestion-item");
    await expect(suggestions).toHaveCount(3, { timeout: STEP_TIMEOUT });
    expect(responsesCalls).toBe(1);
    await authedPage.getByTestId("interview-suggestion-ask").first().click();
    await expect(authedPage.getByTestId("interview-prompt")).toContainText(
      "assistant is on leave",
    );
    await authedPage
      .getByTestId("interview-note-input")
      .fill("the whole firm stops, apparently");

    // ── 6) Skip to the end, review, save ──────────────────────────
    // Skip renders on every question, so it walks the whole queue
    // regardless of answered state.
    for (let i = 0; i < 40; i += 1) {
      if (
        await authedPage
          .getByTestId("interview-review")
          .isVisible()
          .catch(() => false)
      ) {
        break;
      }
      await authedPage.getByTestId("interview-skip-button").click();
    }
    await expect(authedPage.getByTestId("interview-review")).toBeVisible();

    const preview = authedPage.locator(".interview-transcript-preview");
    await expect(preview).toContainText("LINE chat");
    await expect(preview).toContainText("everything lives in LINE");
    await expect(preview).toContainText("(ad-hoc)");
    await expect(preview).toContainText("Scroll the chat");

    await pickOption(authedPage.getByTestId("interview-outcome-select"), "positive");
    await authedPage.getByTestId("interview-save-button").click();

    // Overlay closes; the interview call note is on the opportunity.
    await expect(authedPage.getByTestId("interview-mode")).toHaveCount(0, {
      timeout: STEP_TIMEOUT,
    });
    await expect(
      authedPage.locator("[data-testid='sales-call-notes-section-item']"),
    ).toContainText("Interview — Siam Law — tour visit", {
      timeout: STEP_TIMEOUT,
    });
  });
});
