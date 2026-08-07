/**
 * Record-a-call E2E (Tier 1 — mocked) — the tour capture loop
 * (2026-08-07): on an opportunity page, Record captures mic audio
 * (Chromium's fake audio device — no permission prompt), Stop streams
 * it through `/api/transcribe` (mocked here), and the transcribed
 * draft opens CreateCallNoteModal PREFILLED (summary + transcript +
 * outcome). Saving is still the founder's click, and the saved note
 * lands in the record's call-notes section.
 */

import { test, expect } from "./fixtures/auth.fixture";
import type { Page } from "@playwright/test";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { expectSelectValue } from "./helpers/select";
import {
  STEP_TIMEOUT,
  createAccountViaUi,
  createOpportunityViaUi,
  openFullViewViaPeek,
  ensureBoardMode,
} from "./helpers/sales-ui";

// Chromium's fake media device answers getUserMedia with a test tone —
// the recorder runs for real; only the transcription API is mocked.
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

/** Seed a company + deal via the UI and land on the deal's detail
 *  page (the recorder's host view). */
async function openSeededDeal(page: Page, firm: string, deal: string) {
  await page.goto("/sales");
  await ensureBoardMode(page);
  await createAccountViaUi(page, firm);
  await expect(page.getByTestId("sales-account-name-input")).toHaveCount(0, {
    timeout: STEP_TIMEOUT,
  });
  await createOpportunityViaUi(page, deal, { awaitCard: true });
  await openFullViewViaPeek(
    page,
    page.locator("[data-testid='sales-kanban-card']", { hasText: deal }),
  );
  await expect(page.getByTestId("sales-opportunity-detail")).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
}

/** One recording gesture: record ~a beat of fake-mic audio, stop. */
async function recordTake(page: Page) {
  await page.getByTestId("record-call-button").click();
  await expect(page.getByTestId("record-call-stop")).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
  await page.waitForTimeout(800);
  await page.getByTestId("record-call-stop").click();
}

const DRAFT = {
  transcript: "Founder: how do you track matters today? Firm: spreadsheets.",
  summary:
    "**What they said** — matters live in spreadsheets and email.\n\n**Next step** — send trial invite Friday.",
  outcome: "positive",
};

test("record → transcribe → prefilled call-note draft → saved note", async ({
  authedPage,
}) => {
  await setupSalesHandlers(authedPage);
  await authedPage.route("**/api/transcribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DRAFT),
    });
  });

  await openSeededDeal(authedPage, "Recorder Firm", "Recorder deal");

  // ── Record a short take against the fake mic, then stop ───────────
  await recordTake(authedPage);

  // ── The draft modal opens prefilled ───────────────────────────────
  const summaryBox = authedPage.getByPlaceholder(
    "What they said in their words; commitments made.",
  );
  await expect(summaryBox).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(summaryBox).toHaveValue(/matters live in spreadsheets/);
  await expect(summaryBox).toHaveValue(/--- Transcript ---/);
  await expect(summaryBox).toHaveValue(/Firm: spreadsheets/);
  await expectSelectValue(
    authedPage.getByTestId("sales-call-note-outcome-select"),
    "positive",
  );

  // ── Founder saves; the note lands on the record ───────────────────
  await authedPage
    .getByRole("button", { name: "Log call", exact: true })
    .click();
  await expect(
    authedPage
      .getByTestId("sales-call-notes-section")
      .getByText(/Call — Recorder deal/),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
});

test("transcription failure surfaces inline, opens NO draft, and the next take succeeds", async ({
  authedPage,
}) => {
  await setupSalesHandlers(authedPage);
  // First attempt 502s (LLM down); the retry succeeds.
  let attempts = 0;
  await authedPage.route("**/api/transcribe", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 502,
          error: "Bad Gateway",
          code: "transcription_failed",
          message: "OpenAI unavailable",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DRAFT),
    });
  });

  await openSeededDeal(authedPage, "Retry Firm", "Retry deal");

  // ── Failing take: inline error, NO modal, recorder back to idle ───
  await recordTake(authedPage);
  await expect(authedPage.getByTestId("record-call-error")).toContainText(
    /Transcription failed/,
    { timeout: STEP_TIMEOUT },
  );
  await expect(
    authedPage.getByRole("button", { name: "Log call", exact: true }),
  ).toHaveCount(0);

  // ── Second take works — the failure was recoverable ───────────────
  await recordTake(authedPage);
  await expect(
    authedPage.getByPlaceholder(
      "What they said in their words; commitments made.",
    ),
  ).toHaveValue(/matters live in spreadsheets/, { timeout: STEP_TIMEOUT });
});
