import { test, expect, type Page } from "@playwright/test";
import { envLocal, loginWithPassword } from "./helpers/real-auth";

/**
 * Realtime collaboration against the REAL stack + the realtime worker
 * (2026-08-01 arc): presence, live cross-user invalidation, and
 * co-edited live notes — the three tiers that make the CRM multiplayer.
 *
 * ENV-GATED twice over: skips without the real-auth WorkOS creds
 * (like every spec in this tier) AND without a configured realtime
 * worker (`REALTIME_URL`/`REALTIME_SECRET` in the process env — the
 * webServer inherits them). A normal `npm run test:e2e:real-auth`
 * run skips this file; to exercise it, start the worker
 * (`cd realtime && npm run dev`) and run:
 *
 *   npx cross-env E2E_MODE=real-auth REALTIME_URL=http://localhost:8788
 *     REALTIME_SECRET=<.dev.vars value> playwright test --project=real-auth realtime
 *
 * Two REAL seats (the teamwork pair) share one record; nothing here
 * depends on prior data (stamped record, closed at the end).
 */

const email = envLocal("E2E_WORKOS_EMAIL");
const password = envLocal("E2E_WORKOS_PASSWORD");
const teammateEmail = envLocal("E2E_WORKOS_TEAMMATE_EMAIL");
const teammatePassword = envLocal("E2E_WORKOS_TEAMMATE_PASSWORD");

const realtimeConfigured =
  (process.env.REALTIME_URL ?? "") !== "" &&
  (process.env.REALTIME_SECRET ?? "") !== "";

const stamp = Date.now().toString(36);
const COMPANY = `E2E Realtime Co ${stamp}`;
const DEAL = `E2E Realtime Deal ${stamp}`;

/** Editor text minus the caret name-label widgets TipTap renders
 *  inline for remote peers. */
function docText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="live-note-editor"]');
    if (el === null) return "";
    const clone = el.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('[class*="collaboration-caret"]')
      .forEach((n) => n.remove());
    return clone.textContent ?? "";
  });
}

test("two seats: presence pill, live stage propagation, co-edited note", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  test.skip(
    !email || !password || !teammateEmail || !teammatePassword,
    "E2E_WORKOS_* / E2E_WORKOS_TEAMMATE_* missing (env or .env.local)",
  );
  test.skip(
    !realtimeConfigured,
    "REALTIME_URL / REALTIME_SECRET not set — start the worker and pass them to exercise this spec",
  );

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const seatA = await contextA.newPage();
  const seatB = await contextB.newPage();
  await loginWithPassword(seatA, email!, password!);
  await loginWithPassword(seatB, teammateEmail!, teammatePassword!);

  // ── Seat A creates the shared record and opens its page ────────────
  await seatA.getByTestId("sales-add-account-button").click();
  await seatA.getByTestId("sales-account-name-input").fill(COMPANY);
  await seatA.getByTestId("sales-account-source-select").selectOption("intro");
  await seatA.getByRole("button", { name: /Add company/i }).click();
  await seatA.getByTestId("sales-add-opportunity-button").click();
  await seatA.getByTestId("sales-opportunity-title-input").fill(DEAL);
  await seatA
    .getByTestId("sales-opportunity-account-select")
    .selectOption({ label: COMPANY });
  await seatA
    .getByTestId("sales-opportunity-use-case-select")
    .selectOption("client_comms");
  await seatA.getByRole("button", { name: /Create opportunity/i }).click();

  await seatA.getByText(DEAL, { exact: true }).first().click();
  await expect(seatA.getByTestId("sales-peek-panel")).toBeVisible({
    timeout: 45_000,
  });
  await seatA.getByTestId("sales-peek-expand").click();
  await expect(seatA.getByTestId("sales-attribute-editor")).toBeVisible({
    timeout: 45_000,
  });
  const recordUrl = seatA.url();

  // ── Presence: seat B arrives; seat A sees them ─────────────────────
  await seatB.goto(recordUrl);
  await expect(seatB.getByTestId("sales-attribute-editor")).toBeVisible({
    timeout: 45_000,
  });
  const pill = seatA.getByTestId("record-viewing-pill");
  await expect(pill).toBeVisible({ timeout: 30_000 });
  await expect(pill).toContainText("is here");
  await expect(seatA.getByTestId("presence-avatar-stack")).toBeVisible();

  // ── Field claim: B focuses a field, A sees the ring + chip ─────────
  await seatB.getByTestId("sales-attr-next_action").click();
  await expect(
    seatA.getByTestId("sales-attr-next_action-claim"),
  ).toContainText("is editing", { timeout: 30_000 });
  await seatB.getByTestId("sales-attr-next_action").blur();

  // ── Cursor relay: B moves the pointer, A renders the named cursor ──
  await seatB.mouse.move(600, 400);
  await seatB.mouse.move(640, 440, { steps: 5 });
  await expect(seatA.getByTestId("peer-cursor").first()).toBeVisible({
    timeout: 30_000,
  });

  // ── Live invalidation: B moves the stage, A updates with NO reload ─
  const stageA = seatA.getByTestId("sales-opportunity-detail-stage-select");
  const stageB = seatB.getByTestId("sales-opportunity-detail-stage-select");
  await expect(stageB).toHaveValue("identified", { timeout: 30_000 });
  await stageB.selectOption("contacted");
  await expect(stageA).toHaveValue("contacted", { timeout: 30_000 });

  // ── Co-edited note: A types, B converges; B appends, A converges ───
  await seatA.getByTestId("live-note-toggle").click();
  await seatB.getByTestId("live-note-toggle").click();
  const editorA = seatA.getByTestId("live-note-editor");
  const editorB = seatB.getByTestId("live-note-editor");
  await expect(editorA).toBeVisible({ timeout: 30_000 });
  await expect(editorB).toBeVisible({ timeout: 30_000 });

  await editorA.click();
  await seatA.keyboard.type("Alpha: demo went well.");
  await expect
    .poll(() => docText(seatB), { timeout: 30_000 })
    .toContain("Alpha: demo went well.");

  await editorB.click();
  await seatB.keyboard.press("Control+End");
  await seatB.keyboard.type(" Beta: send recap.");
  await expect
    .poll(() => docText(seatA), { timeout: 30_000 })
    .toContain("Beta: send recap.");

  // Both seats see the identical merged document.
  await expect
    .poll(async () => (await docText(seatA)) === (await docText(seatB)), {
      timeout: 30_000,
    })
    .toBe(true);

  // ── Freeze into call note: durable record created, pad clears for
  //    EVERYONE (the shared doc resets) ────────────────────────────────
  await seatA.getByTestId("live-note-freeze").click();
  await expect(
    seatA.getByPlaceholder("What they said in their words; commitments made."),
  ).not.toHaveValue("", { timeout: 15_000 });
  await seatA.getByRole("button", { name: "Log call", exact: true }).click();
  const noteRow = seatA
    .locator("[data-testid='sales-call-notes-section']")
    .getByText(/Call — /)
    .first();
  await expect(noteRow).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => docText(seatB), { timeout: 30_000 })
    .toBe("");

  // ── Cleanup: close the deal so reruns don't accumulate open rows ───
  await stageA.selectOption("won");
  await expect(stageB).toHaveValue("won", { timeout: 30_000 });

  await contextA.close();
  await contextB.close();
});
