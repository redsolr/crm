import { test, expect, type Page } from "@playwright/test";
import {
  createAccountViaUi,
  createOpportunityViaUi,
  envLocal,
  loginWithPassword,
  trackDeadApiCalls,
} from "./helpers/real-auth";
import { localDate } from "./helpers/dates";
// Reports tiles render through the app's own formatter — asserting
// with the same import (not a hand mirror) means a format change can
// never silently diverge spec from UI.
import { formatTHB as thb } from "../src/lib/format-currency";
import { pickOption } from "./helpers/select";

/**
 * The DAILY sales motions against the real stack (real WorkOS session,
 * real Postgres, no mocks) — the loop a salesperson actually runs every
 * morning during the 10-firm tour, added after the 2026-08-01 dogfood
 * session:
 *
 *   1. Inbox follow-through — an overdue next action surfaces in
 *      "Needs attention" with the Overdue badge and clicks through to
 *      the deal; moving the date to today re-files it as Due today.
 *   2. Stage move via the record page — persists across reload and
 *      lands in the timeline as a `moved stage` activity carrying the
 *      real author name (attribution swap step 6).
 *   3. Reports reconcile — the Active-pipeline and Won tiles equal the
 *      sums computed independently from the wire (work_items +
 *      attribute_values), in ฿ (THB, the value_estimate unit).
 *
 * Record names carry a run stamp — the tier runs against an
 * accumulating local database.
 */

const email = envLocal("E2E_WORKOS_EMAIL");
const password = envLocal("E2E_WORKOS_PASSWORD");

const stamp = Date.now().toString(36);
const COMPANY = `E2E Motions Co ${stamp}`;
const DEAL = `E2E Motions Deal ${stamp}`;
const DEAL_VALUE = 123_000;

const CLOSED_STAGES = ["won", "lost", "not_now"];

/** Fill an attribute-editor field on the opportunity page and commit
 *  (the editor PUTs on blur). */
async function setAttr(page: Page, key: string, value: string): Promise<void> {
  const field = page.getByTestId(`sales-attr-${key}`);
  await field.fill(value);
  await field.blur();
  // The PUT is fire-on-blur; give the round-trip a beat before moving on.
  await page.waitForTimeout(600);
}

test("inbox follow-through → stage move with author → reports reconcile", async ({
  page,
}) => {
  test.setTimeout(240_000);
  test.skip(
    !email || !password,
    "E2E_WORKOS_EMAIL / E2E_WORKOS_PASSWORD missing (env or .env.local)",
  );

  const notFound = trackDeadApiCalls(page);
  await loginWithPassword(page, email!, password!);

  // ── Seed today's deal through the UI ───────────────────────────────
  await createAccountViaUi(page, COMPANY);
  await createOpportunityViaUi(page, { title: DEAL, accountName: COMPANY });

  // Open the deal's record page: card click opens the peek, expand
  // promotes to the full detail route.
  await page.getByTestId("sales-nav-pipeline").click();
  await page.getByText(DEAL, { exact: true }).first().click();
  await expect(page.getByTestId("sales-peek-panel")).toBeVisible({
    timeout: 45_000,
  });
  await page.getByTestId("sales-peek-expand").click();
  await expect(page.getByTestId("sales-attribute-editor")).toBeVisible({
    timeout: 45_000,
  });
  const recordUrl = page.url();

  // Value + an OVERDUE next action.
  await setAttr(page, "value_estimate", String(DEAL_VALUE));
  await setAttr(page, "next_action", "E2E: send the follow-up email");
  await setAttr(page, "next_action_date", localDate(-2));

  // ── 1. Inbox follow-through: overdue surfaces and clicks through ───
  await page.getByTestId("sales-nav-inbox").click();
  const overdueRow = page
    .locator("[data-testid='sales-followup-row']", { hasText: DEAL })
    .first();
  await expect(overdueRow).toBeVisible({ timeout: 45_000 });
  await expect(overdueRow).toHaveAttribute("data-reason", "overdue_next_action");
  await expect(overdueRow).toContainText("Overdue");
  await overdueRow.click();
  await page.waitForURL(/\/sales\/opportunity\//, { timeout: 45_000 });
  expect(page.url()).toBe(recordUrl);

  // Move the action to today → the deal re-files under Due today.
  await setAttr(page, "next_action_date", localDate(0));
  await page.getByTestId("sales-nav-inbox").click();
  const dueTodayRow = page
    .locator("[data-testid='sales-followup-row']", { hasText: DEAL })
    .first();
  await expect(dueTodayRow).toBeVisible({ timeout: 45_000 });
  await expect(dueTodayRow).toHaveAttribute("data-reason", "due_today");
  await expect(dueTodayRow).toContainText("Due today");

  // ── 2. Stage move via the record page, with real attribution ───────
  await page.goto(recordUrl);
  const stageSelect = page.getByTestId("sales-opportunity-detail-stage-select");
  await pickOption(stageSelect, "contacted");
  await page.waitForTimeout(1_000);
  await page.reload();
  await expect(
    page.getByTestId("sales-opportunity-detail-stage-select"),
  ).toHaveAttribute("data-value", "contacted", { timeout: 45_000 });

  // The move is in the timeline with the real (non-empty) author name —
  // the session user, never the usr_local placeholder blend.
  const moveEntry = page
    .locator("[data-testid='sales-timeline-activity']", {
      hasText: "moved stage",
    })
    .first();
  await expect(moveEntry).toBeVisible({ timeout: 45_000 });
  const author = moveEntry.getByTestId("sales-timeline-author");
  await expect(author).toBeVisible();
  await expect(author).not.toHaveText("");

  // ── 3. Reports reconcile against the wire ──────────────────────────
  // Independent recomputation: every opportunity + its value_estimate,
  // summed by the same active/won split the tiles claim to show.
  const wsRes = await page.request.get("/api/workspaces");
  expect(wsRes.ok()).toBeTruthy();
  const wsBody = (await wsRes.json()) as { workspaces: Array<{ id: string }> };
  const wsId = wsBody.workspaces[0]!.id;

  const typesRes = await page.request.get(
    `/api/workspaces/${wsId}/work_item_types`,
  );
  expect(typesRes.ok()).toBeTruthy();
  const typesBody = (await typesRes.json()) as {
    data: Array<{ id: string; key: string }>;
  };
  const oppType = typesBody.data.find((t) => t.key === "opportunity");
  expect(oppType).toBeDefined();

  const defsRes = await page.request.get(
    `/api/work_item_types/${oppType!.id}/attribute_definitions`,
  );
  const defs = ((await defsRes.json()) as {
    data: Array<{ id: string; key: string }>;
  }).data;
  const valueDefId = defs.find((d) => d.key === "value_estimate")?.id;
  expect(valueDefId).toBeDefined();

  interface WireOpp {
    id: string;
    state: { key: string };
  }
  const opps: WireOpp[] = [];
  let pageToken: string | null = null;
  do {
    const params = new URLSearchParams({
      workspace_id: wsId,
      type_key: "opportunity",
      page_size: "100",
    });
    if (pageToken) params.set("page_token", pageToken);
    const res = await page.request.get(`/api/work_items?${params}`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      data: WireOpp[];
      has_more: boolean;
      next_page_url: string | null;
    };
    opps.push(...body.data);
    pageToken = body.has_more
      ? new URL(body.next_page_url!, "http://x").searchParams.get("page_token")
      : null;
  } while (pageToken);

  let activeSum = 0;
  let wonSum = 0;
  for (const opp of opps) {
    const valuesRes = await page.request.get(
      `/api/work_items/${opp.id}/attribute_values`,
    );
    expect(valuesRes.ok()).toBeTruthy();
    const values = ((await valuesRes.json()) as {
      data: Array<{ definition_id: string; value: unknown }>;
    }).data;
    let raw = values.find((v) => v.definition_id === valueDefId)?.value;
    // Values ride the platform storage envelope `{ value: X }` on the
    // wire; unwrap like the FE's attribute-value boundary does.
    if (raw !== null && typeof raw === "object" && "value" in raw) {
      raw = (raw as { value: unknown }).value;
    }
    const num =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw !== ""
          ? Number(raw)
          : 0;
    if (!Number.isFinite(num)) continue;
    if (opp.state.key === "won") wonSum += num;
    else if (!CLOSED_STAGES.includes(opp.state.key)) activeSum += num;
  }
  // The freshly created deal is part of the reconciliation.
  expect(activeSum).toBeGreaterThanOrEqual(DEAL_VALUE);

  await page.getByTestId("sales-nav-reports").click();
  const activeTile = page.getByTestId("report-stat-active-value");
  const wonTile = page.getByTestId("report-stat-won");
  await expect(activeTile).toContainText(thb(activeSum), { timeout: 45_000 });
  await expect(wonTile).toContainText(thb(wonSum), { timeout: 45_000 });

  // ── Cleanup: close the deal so re-runs don't accumulate overdue
  // rows that crowd the 8-slot Needs-attention panel (won transitions
  // directly — only lost/not_now intercept with the reason modal).
  await page.goto(recordUrl);
  await pickOption(page.getByTestId("sales-opportunity-detail-stage-select"), "won");
  await page.waitForTimeout(1_000);

  await page.waitForTimeout(2_000);
  expect(notFound).toEqual([]);
});
