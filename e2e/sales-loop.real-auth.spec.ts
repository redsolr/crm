import { test, expect } from "@playwright/test";
import {
  createAccountViaUi,
  createOpportunityViaUi,
  envLocal,
  loginWithPassword,
  trackDeadApiCalls,
} from "./helpers/real-auth";
import { pickOption } from "./helpers/select";

/**
 * The core sales loop against the REAL stack (real WorkOS session, real
 * Postgres, no mocks): create a company → create a deal → see both in
 * the Companies table → save a view → the view survives a reload
 * (round-trips the `/api/views` backend ported 2026-07-31).
 *
 * The mocked `sales-journey.spec.ts` drives the same UI in depth; this
 * spec exists because mocked tests structurally cannot catch a missing
 * or wrongly-shaped real route — the class of bug that shipped three
 * times in the backend swap (org bootstrap, usage summary, views).
 *
 * Record names carry a run stamp so the spec is re-runnable against an
 * accumulating local database (create_account dedupes by exact title).
 */

const email = envLocal("E2E_WORKOS_EMAIL");
const password = envLocal("E2E_WORKOS_PASSWORD");

const stamp = Date.now().toString(36);
const COMPANY = `E2E Loop Co ${stamp}`;
const DEAL = `E2E Loop Deal ${stamp}`;
const VIEW = `E2E view ${stamp}`;

test("company → deal → table → saved view survives reload", async ({
  page,
}) => {
  test.setTimeout(180_000);
  test.skip(
    !email || !password,
    "E2E_WORKOS_EMAIL / E2E_WORKOS_PASSWORD missing (env or .env.local)",
  );

  const notFound = trackDeadApiCalls(page);
  await loginWithPassword(page, email!, password!);

  // ── Create the company, then the deal under it ─────────────────────
  await createAccountViaUi(page, COMPANY, "intro");
  await createOpportunityViaUi(page, {
    title: DEAL,
    accountName: COMPANY,
    useCase: "matter_chaos",
  });

  // Both persisted: the Companies table (a fresh real fetch) shows the
  // company row with its live last-activity cell.
  await page.getByTestId("sales-nav-companies").click();
  await expect(page.getByTestId("sales-companies-view")).toBeVisible({
    timeout: 45_000,
  });
  const row = page.locator("[data-testid='sales-companies-row']", {
    hasText: COMPANY,
  });
  await expect(row).toBeVisible({ timeout: 45_000 });

  // ── Save a view and prove it round-trips the backend ───────────────
  await page.getByTestId("sales-companies-view-save").click();
  await page.getByTestId("sales-companies-view-name-input").fill(VIEW);
  await page.getByTestId("sales-companies-view-save-confirm").click();

  // The switcher now carries the saved view…
  await expect(
    page.getByTestId("sales-companies-view-select"),
  ).toContainText(VIEW, { timeout: 45_000 });

  // …and still EXISTS after a full reload (server-persisted, not local
  // state) — this is the /api/views round-trip. Which view is SELECTED
  // is session-local by design, so prove persistence by re-picking the
  // saved view from the switcher's list and seeing it applied. (The
  // old native <select> asserted toContainText on the closed control,
  // which passed via the hidden option list's text; the custom trigger
  // renders only the selected label.)
  await page.reload();
  await pickOption(
    page.getByTestId("sales-companies-view-select"),
    { label: VIEW },
    { timeout: 45_000 },
  );
  await expect(
    page.getByTestId("sales-companies-view-select"),
  ).toContainText(VIEW, { timeout: 45_000 });

  await page.waitForTimeout(3_000);
  expect(notFound).toEqual([]);
});

test("the transcribe route EXISTS on the real stack and validates (no LLM spent)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  test.skip(
    !email || !password,
    "E2E_WORKOS_EMAIL / E2E_WORKOS_PASSWORD missing (env or .env.local)",
  );

  // This tier's reason for existing: mocked tests structurally cannot
  // catch a missing real route. A form without an `audio` file must
  // hit the route's OWN validation (422) — a missing route would 404 —
  // and validation rejects before any OpenAI call, so the probe costs
  // nothing.
  await loginWithPassword(page, email!, password!);
  const response = await page.request.post("/api/transcribe", {
    multipart: { context: "route probe" },
  });
  expect(response.status()).toBe(422);
  const body = (await response.json()) as { code?: string };
  expect(body.code).toBe("validation_failed");
});
