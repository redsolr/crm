import { test, expect } from "@playwright/test";
import {
  envLocal,
  loginWithPassword,
  trackDeadApiCalls,
} from "./helpers/real-auth";

/**
 * Real-auth bootstrap spec — runs WITHOUT MOCK_AUTH (project
 * `real-auth`, `npm run test:e2e:real-auth`).
 *
 * Claim under test (2026-07-31 production incident): a REAL WorkOS
 * session must boot the CRM shell end-to-end —
 *   login → auth store hydrates straight from the WorkOS identity (no
 *   backend exchange) → workspace bootstrap resolves from
 *   `/api/workspaces` (no organizations chain) → the sales surface
 *   renders — and NO surface fires a request at a route that doesn't
 *   exist. Every other tier runs MOCK_AUTH=true, which is exactly how
 *   the deadlock shipped unseen: real login → `/api/organizations` 404
 *   → the workspace query never enabled → infinite spinner.
 *
 * Auth method: email+password against the crm WorkOS project's Staging
 * env — the only WorkOS flow drivable headlessly (Google OAuth blocks
 * automation).
 */

const email = envLocal("E2E_WORKOS_EMAIL");
const password = envLocal("E2E_WORKOS_PASSWORD");

test("real WorkOS login boots the sales shell with no dead platform calls", async ({
  page,
}) => {
  // Real network round-trips to WorkOS + cold dev-server compiles of
  // several routes — the default 30s project timeout races them.
  test.setTimeout(180_000);
  test.skip(
    !email || !password,
    "E2E_WORKOS_EMAIL / E2E_WORKOS_PASSWORD missing (env or .env.local)",
  );

  const notFound = trackDeadApiCalls(page);

  const workspacesResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/workspaces") &&
      res.request().method() === "GET",
    { timeout: 45_000 },
  );

  await loginWithPassword(page, email!, password!);

  // Workspace bootstrap resolved — the exact chain that deadlocked in
  // production must complete against the real session.
  expect((await workspacesResponse).status()).toBe(200);

  // Shell out of its loading gate: the sidebar shows the signed-in user.
  await expect(page.getByTestId("crm-sidebar-user")).toContainText(email!, {
    timeout: 45_000,
  });

  // Sweep the main surfaces — dead callers hide on pages the pipeline
  // view never mounts (the views 404 only fired on Companies).
  for (const path of [
    "/sales/companies",
    "/sales/contacts",
    "/sales/reports",
    "/sales/inbox",
    "/sales/interviews",
    "/sales",
  ]) {
    await page.goto(path);
    await expect(page.getByTestId("crm-sidebar-user")).toBeVisible({
      timeout: 45_000,
    });
  }

  // Let post-boot background queries (list prefetches, syncs) fire
  // before judging — stragglers arrive after render.
  await page.waitForTimeout(3_000);

  expect(notFound).toEqual([]);
});
