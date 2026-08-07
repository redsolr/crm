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

  await authedPage.goto("/sales");
  await ensureBoardMode(authedPage);
  await createAccountViaUi(authedPage, "Recorder Firm");
  await expect(
    authedPage.getByTestId("sales-account-name-input"),
  ).toHaveCount(0, { timeout: STEP_TIMEOUT });
  await createOpportunityViaUi(authedPage, "Recorder deal", {
    awaitCard: true,
  });
  await openFullViewViaPeek(
    authedPage,
    authedPage.locator("[data-testid='sales-kanban-card']", {
      hasText: "Recorder deal",
    }),
  );
  await expect(
    authedPage.getByTestId("sales-opportunity-detail"),
  ).toBeVisible({ timeout: STEP_TIMEOUT });

  // ── Record a short take against the fake mic, then stop ───────────
  await authedPage.getByTestId("record-call-button").click();
  await expect(authedPage.getByTestId("record-call-stop")).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
  await authedPage.waitForTimeout(1_200);
  await authedPage.getByTestId("record-call-stop").click();

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
