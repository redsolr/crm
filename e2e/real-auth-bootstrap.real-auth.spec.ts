import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Real-auth bootstrap spec — the ONLY spec that runs without MOCK_AUTH
 * (project `real-auth`, `npm run test:e2e:real-auth`).
 *
 * Claim under test (2026-07-31 production incident): a REAL WorkOS
 * session must boot the CRM shell end-to-end —
 *   login → auth store hydrates straight from the WorkOS identity (no
 *   backend exchange) → workspace bootstrap resolves from
 *   `/api/workspaces` (no organizations chain) → the sales surface
 *   renders.
 * Every other tier runs MOCK_AUTH=true, which is exactly how the
 * deadlock shipped unseen: real login → `/api/organizations` 404 → the
 * workspace query never enabled → infinite spinner. Mocked tests can
 * never catch a real-auth-only regression; this one does.
 *
 * Auth method: email+password against the crm WorkOS project's Staging
 * env — the only WorkOS flow drivable headlessly (Google OAuth blocks
 * automation). The test user (`E2E_WORKOS_EMAIL` / `_PASSWORD` in
 * `.env.local`, not committed) exists only in that Staging env.
 */

/** Minimal .env.local reader — the Playwright process doesn't load env
 *  files (only the `next dev` webServer does), and the credentials must
 *  not be committed, so parse the gitignored file directly. */
function envLocal(key: string): string | undefined {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    const line = raw
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${key}=`) && !l.startsWith("#"));
    return line?.slice(key.length + 1).trim();
  } catch {
    return undefined;
  }
}

const email = process.env.E2E_WORKOS_EMAIL ?? envLocal("E2E_WORKOS_EMAIL");
const password =
  process.env.E2E_WORKOS_PASSWORD ?? envLocal("E2E_WORKOS_PASSWORD");

/** The three platform-era endpoints removed by the 2026-07-31 dead-weight
 *  strip. A request to ANY of them is a regression — they have no route
 *  handlers, and the org one deadlocked the shell. */
const DEAD_ENDPOINTS = [
  "/auth/workos/exchange",
  "/api/organizations",
  "/api/presence/heartbeat",
];

test("real WorkOS login boots the sales shell with no dead platform calls", async ({
  page,
}) => {
  // Real network round-trips to WorkOS + a cold dev-server compile of
  // /sales — the default 30s project timeout races them.
  test.setTimeout(120_000);
  test.skip(
    !email || !password,
    "E2E_WORKOS_EMAIL / E2E_WORKOS_PASSWORD missing (env or .env.local)",
  );

  const deadCalls: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (DEAD_ENDPOINTS.some((path) => url.includes(path))) {
      deadCalls.push(url);
    }
  });

  await page.goto("/login");
  await page.getByTestId("login-email-input").fill(email!);
  await page.getByTestId("login-password-input").fill(password!);

  const workspacesResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/workspaces") &&
      res.request().method() === "GET",
    { timeout: 45_000 },
  );

  await page.getByTestId("login-submit").click();

  // The password action sets the wos-session cookie, then LoginCard
  // hard-navigates to /sales.
  await page.waitForURL(/\/sales/, { timeout: 45_000 });

  // Workspace bootstrap resolved — the exact chain that deadlocked in
  // production must complete against the real session.
  expect((await workspacesResponse).status()).toBe(200);

  // Shell out of its loading gate: the sidebar shows the signed-in user.
  await expect(page.getByTestId("crm-sidebar-user")).toContainText(email!, {
    timeout: 45_000,
  });

  expect(deadCalls).toEqual([]);
});
