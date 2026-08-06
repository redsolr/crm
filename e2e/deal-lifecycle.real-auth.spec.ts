import { test, expect, type Page } from "@playwright/test";
import {
  createAccountViaUi,
  createOpportunityViaUi,
  envLocal,
  loginWithPassword,
  trackDeadApiCalls,
} from "./helpers/real-auth";
import { localDate } from "./helpers/dates";
import { pickOption } from "./helpers/select";

/**
 * The FULL deal lifecycle against the real stack (real WorkOS session,
 * real Postgres, no mocks) — the journey a tour deal actually travels,
 * end to end, which no per-feature spec walks in one piece:
 *
 *   Deal A (the winner): identified → contacted → replied →
 *   call_booked → call_done — at call-done the salesperson logs the
 *   call and records a commitment due tomorrow (which lands in the
 *   Inbox "Upcoming" bucket and is completed from there) — → trial →
 *   won; the stage survives reload and the timeline carries the
 *   accumulated authored "moved stage" entries.
 *
 *   Deal B (the loser): lost via the reason modal; persists.
 *
 *   Deal C (the parked one): "not now" via Snooze with a revisit date
 *   already in the PAST — and RESURFACES in the Inbox Needs-attention
 *   panel as "Revisit" (the `revisit_due` tier added with this spec;
 *   before it, a parked deal silently never came back), clicking
 *   through to the record.
 *
 * Record names carry a run stamp — the tier runs against an
 * accumulating local database. Self-cleaning: A won, B lost, C won at
 * the end, and A's commitment is completed via the Inbox, so re-runs
 * don't crowd the 8-slot Needs-attention panel or the commitment
 * buckets.
 */

const email = envLocal("E2E_WORKOS_EMAIL");
const password = envLocal("E2E_WORKOS_PASSWORD");

const stamp = Date.now().toString(36);
const COMPANY = `E2E Lifecycle Co ${stamp}`;
const DEAL_WIN = `E2E Lifecycle Win ${stamp}`;
const DEAL_LOST = `E2E Lifecycle Lost ${stamp}`;
const DEAL_PARKED = `E2E Lifecycle Parked ${stamp}`;
const COMMITMENT = `E2E Lifecycle follow-up ${stamp}`;

/** Create an opportunity from the pipeline header (company exists). */
async function createDeal(page: Page, title: string): Promise<void> {
  await createOpportunityViaUi(page, { title, accountName: COMPANY });
  // The board re-renders with the new card before the modal state
  // settles; anchor on the card being present.
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible({
    timeout: 45_000,
  });
}

/** Open a deal's full record page via card → peek → expand. */
async function openDealPage(page: Page, title: string): Promise<string> {
  await page.getByTestId("sales-nav-pipeline").click();
  await page.getByText(title, { exact: true }).first().click();
  await expect(page.getByTestId("sales-peek-panel")).toBeVisible({
    timeout: 45_000,
  });
  await page.getByTestId("sales-peek-expand").click();
  await expect(page.getByTestId("sales-opportunity-detail")).toBeVisible({
    timeout: 45_000,
  });
  return page.url();
}

/** Move the open deal's stage via the detail select (non-closing keys). */
async function moveStage(page: Page, stageKey: string): Promise<void> {
  const select = page.getByTestId("sales-opportunity-detail-stage-select");
  await pickOption(select, stageKey);
  // The select is CONTROLLED by server truth (cache → refetch), so
  // waiting for it to read the target waits for the PATCH (incl. its
  // conflict retries) to actually LAND. The previous blind 800ms beat
  // raced the write on slow CI: a retrying PATCH still in flight was
  // aborted by the next action/reload and the move silently vanished
  // (the 2026-08-04 "won stayed trial" red — server logged
  // `Error: aborted` at exactly those moments).
  await expect(select).toHaveAttribute("data-value", stageKey, { timeout: 45_000 });
}

test("full funnel: win with call+commitment, lose with reason, park and RESURFACE on revisit", async ({
  page,
}) => {
  test.setTimeout(300_000);
  test.skip(
    !email || !password,
    "E2E_WORKOS_EMAIL / E2E_WORKOS_PASSWORD missing (env or .env.local)",
  );

  const notFound = trackDeadApiCalls(page);
  await loginWithPassword(page, email!, password!);

  // ── Seed: one company, three deals ─────────────────────────────────
  await createAccountViaUi(page, COMPANY);

  await createDeal(page, DEAL_WIN);
  await createDeal(page, DEAL_LOST);
  await createDeal(page, DEAL_PARKED);

  // ── Deal A: walk the open funnel stage by stage ────────────────────
  const winUrl = await openDealPage(page, DEAL_WIN);
  for (const stage of ["contacted", "replied", "call_booked", "call_done"]) {
    await moveStage(page, stage);
  }

  // Call done → the salesperson logs the call…
  await page.getByTestId("sales-add-call-note-button").click();
  await page
    .getByTestId("sales-call-note-title-input")
    .fill(`Call — ${DEAL_WIN}`);
  await pickOption(page.getByTestId("sales-call-note-outcome-select"), "positive");
  await page.getByRole("button", { name: "Log call", exact: true }).click();
  await expect(
    page.locator("[data-testid='sales-call-notes-section-item']", {
      hasText: `Call — ${DEAL_WIN}`,
    }),
  ).toBeVisible({ timeout: 45_000 });

  // …and records the commitment that call produced, due tomorrow.
  await page.getByTestId("sales-add-commitment-button").click();
  await page.getByTestId("sales-commitment-title-input").fill(COMMITMENT);
  await page
    .getByTestId("sales-commitment-due-date-input")
    .fill(localDate(1));
  await page
    .getByRole("button", { name: "Record commitment", exact: true })
    .click();
  await expect(
    page.locator("[data-testid='sales-commitments-section-item']", {
      hasText: COMMITMENT,
    }),
  ).toBeVisible({ timeout: 45_000 });

  // The commitment surfaces in the Inbox "Upcoming" bucket — tomorrow's
  // work is visible today — and completing it there closes the loop.
  await page.getByTestId("sales-nav-inbox").click();
  const upcomingRow = page
    .locator("[data-testid='sales-inbox-upcoming-item']", {
      hasText: COMMITMENT,
    })
    .first();
  await expect(upcomingRow).toBeVisible({ timeout: 45_000 });
  await upcomingRow.getByTestId("sales-inbox-toggle-done").click();
  await expect(
    page.locator("[data-testid='sales-inbox-upcoming-item']", {
      hasText: COMMITMENT,
    }),
  ).toHaveCount(0, { timeout: 45_000 });

  // Trial → won; the closed stage survives a full reload.
  await page.goto(winUrl);
  await expect(page.getByTestId("sales-opportunity-detail")).toBeVisible({
    timeout: 45_000,
  });
  await moveStage(page, "trial");
  await moveStage(page, "won");
  await page.reload();
  await expect(
    page.getByTestId("sales-opportunity-detail-stage-select"),
  ).toHaveAttribute("data-value", "won", { timeout: 45_000 });

  // The journey left its trail: several authored "moved stage" entries.
  const moveEntries = page.locator(
    "[data-testid='sales-timeline-activity']",
    { hasText: "moved stage" },
  );
  await expect
    .poll(async () => moveEntries.count(), { timeout: 45_000 })
    .toBeGreaterThanOrEqual(3);
  const author = moveEntries.first().getByTestId("sales-timeline-author");
  await expect(author).toBeVisible();
  await expect(author).not.toHaveText("");

  // ── Deal B: lost via the reason modal ──────────────────────────────
  await openDealPage(page, DEAL_LOST);
  await pickOption(page.getByTestId("sales-opportunity-detail-stage-select"), "lost");
  const lostReasonSelect = page.getByTestId(
    "sales-transition-lost-reason-select",
  );
  await expect(lostReasonSelect).toBeVisible({ timeout: 45_000 });
  await pickOption(lostReasonSelect, "competitor");
  await page.getByRole("button", { name: "Mark lost", exact: true }).click();
  await expect(lostReasonSelect).not.toBeVisible({ timeout: 45_000 });
  await page.reload();
  await expect(
    page.getByTestId("sales-opportunity-detail-stage-select"),
  ).toHaveAttribute("data-value", "lost", { timeout: 45_000 });

  // ── Deal C: parked with a PAST revisit date → must RESURFACE ───────
  const parkedUrl = await openDealPage(page, DEAL_PARKED);
  await pickOption(page.getByTestId("sales-opportunity-detail-stage-select"), "not_now");
  const notNowInput = page.getByTestId("sales-transition-not-now-until-input");
  await expect(notNowInput).toBeVisible({ timeout: 45_000 });
  await notNowInput.fill(localDate(-1));
  await page.getByRole("button", { name: "Snooze", exact: true }).click();
  await expect(notNowInput).not.toBeVisible({ timeout: 45_000 });

  // The revisit date has passed — the parked deal is back in the
  // morning list, badged "Revisit", and clicks through to the record.
  await page.getByTestId("sales-nav-inbox").click();
  const revisitRow = page
    .locator("[data-testid='sales-followup-row']", { hasText: DEAL_PARKED })
    .first();
  await expect(revisitRow).toBeVisible({ timeout: 45_000 });
  await expect(revisitRow).toHaveAttribute("data-reason", "revisit_due");
  await expect(revisitRow).toContainText("Revisit");
  await revisitRow.click();
  await page.waitForURL(/\/sales\/opportunity\//, { timeout: 45_000 });
  expect(page.url()).toBe(parkedUrl);

  // ── Cleanup: close C so re-runs don't accumulate revisit rows ──────
  await moveStage(page, "won");
  await page.waitForTimeout(1_500);

  expect(notFound).toEqual([]);
});
