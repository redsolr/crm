import { test, expect } from "@playwright/test";
import {
  createAccountViaUi,
  envLocal,
  loginWithPassword,
} from "./helpers/real-auth";

/**
 * Two real seats, one tenant — cross-user attribution against the real
 * stack (two WorkOS password users in separate browser contexts, real
 * Postgres, no mocks).
 *
 * Claims under test (team attribution, swap step 6 — 2026-07-31):
 *   1. Both seats share the tenant: a record user A creates is visible
 *      in user B's session.
 *   2. Writes carry their REAL author: A's record stamps A's WorkOS id
 *      as `created_by_id` (never the `usr_local` placeholder), and B's
 *      comment stamps B's identity — two distinct humans, distinct on
 *      the wire.
 *
 * Attribution is asserted at the wire level through each user's real
 * session cookies (page.request); surfacing author names in the
 * timeline UI is queued FE polish.
 */

const emailA = envLocal("E2E_WORKOS_EMAIL");
const passwordA = envLocal("E2E_WORKOS_PASSWORD");
const emailB = envLocal("E2E_WORKOS_TEAMMATE_EMAIL");
const passwordB = envLocal("E2E_WORKOS_TEAMMATE_PASSWORD");

const stamp = Date.now().toString(36);
const COMPANY = `E2E Team Co ${stamp}`;

test("two seats: shared tenant, per-user attribution on the wire", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  test.skip(
    !emailA || !passwordA || !emailB || !passwordB,
    "E2E_WORKOS_* / E2E_WORKOS_TEAMMATE_* creds missing (env or .env.local)",
  );

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await loginWithPassword(pageA, emailA!, passwordA!);
    await loginWithPassword(pageB, emailB!, passwordB!);

    // Each seat is itself — the sidebars disagree.
    await expect(pageA.getByTestId("crm-sidebar-user")).toContainText(
      emailA!,
      { timeout: 45_000 },
    );
    await expect(pageB.getByTestId("crm-sidebar-user")).toContainText(
      emailB!,
      { timeout: 45_000 },
    );

    // ── A creates a company through the UI ─────────────────────────
    await createAccountViaUi(pageA, COMPANY, "intro");

    // ── B sees it (shared tenant) and finds its id ─────────────────
    // Full navigation, not the sidebar click: B's session prefetched
    // the accounts list BEFORE A created, and nothing invalidates
    // another user's cache (no realtime/polling yet — teammates see
    // new records on refresh; live cross-user updates are queued
    // team-readiness work). A goto starts a fresh page + cache.
    await pageB.goto("/sales/companies");
    const row = pageB.locator("[data-testid='sales-companies-row']", {
      hasText: COMPANY,
    });
    await expect(row).toBeVisible({ timeout: 45_000 });

    const searchRes = await pageB.request.get(
      `/api/search?q=${encodeURIComponent(COMPANY)}`,
    );
    expect(searchRes.status()).toBe(200);
    const searchText = await searchRes.text();
    const idMatch = searchText.match(/wi_[A-Za-z0-9]+/);
    expect(idMatch).not.toBeNull();
    const recordId = idMatch![0];

    // ── Wire attribution: A's record carries A's real identity ─────
    const recordRes = await pageB.request.get(`/api/work_items/${recordId}`);
    expect(recordRes.status()).toBe(200);
    const record = (await recordRes.json()) as {
      work_item: { created_by_id: string; created_by_name: string | null };
    };
    expect(record.work_item.created_by_id).toMatch(/^user_/);
    expect(record.work_item.created_by_id).not.toBe("usr_local");

    // ── B comments through B's real session ────────────────────────
    const commentRes = await pageB.request.post("/api/comments", {
      headers: { "Content-Type": "application/json" },
      data: {
        content: `Reviewed by the second seat (${stamp}).`,
        work_item_id: recordId,
      },
    });
    expect(commentRes.status()).toBe(201);

    const commentsRes = await pageB.request.get(
      `/api/work_items/${recordId}/comments`,
    );
    const comments = (await commentsRes.json()) as {
      data: { author: { id: string; email: string } }[];
    };
    expect(comments.data.length).toBeGreaterThan(0);
    const author = comments.data[comments.data.length - 1].author;
    expect(author.email).toBe(emailB!);
    // Two distinct humans on the wire: the commenter is not the creator.
    expect(author.id).not.toBe(record.work_item.created_by_id);
    expect(author.id).toMatch(/^user_/);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
