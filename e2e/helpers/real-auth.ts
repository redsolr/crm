import { type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared plumbing for the real-auth tier (`*.real-auth.spec.ts` — the
 * only specs that run WITHOUT MOCK_AUTH; see playwright.config.ts).
 *
 * Prerequisites the tier assumes (all local):
 *   - docker Postgres on :5440, migrated + `npm run db:seed` run once
 *   - `.env.local` carrying the crm WorkOS Staging credentials and the
 *     `E2E_WORKOS_EMAIL` / `E2E_WORKOS_PASSWORD` test user
 */

/** Read a key from the process env, falling back to .env.local (the
 *  Playwright process doesn't load env files — only the webServer's
 *  `next dev` does). */
export function envLocal(key: string): string | undefined {
  const fromProcess = process.env[key];
  if (fromProcess !== undefined && fromProcess !== "") return fromProcess;
  try {
    const raw = readFileSync(join(__dirname, "..", "..", ".env.local"), "utf8");
    const line = raw
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${key}=`) && !l.startsWith("#"));
    return line?.slice(key.length + 1).trim();
  } catch {
    return undefined;
  }
}

/**
 * Track every 404 the page receives from the app's own /api or /auth
 * surface. ANY entry is a caller to a route that doesn't exist — the
 * dead-weight class that deadlocked production on 2026-07-31 (org
 * bootstrap) and again surfaced as usage/summary + views 404s. Attach
 * BEFORE the first navigation; assert `toEqual([])` at the end of the
 * spec after the UI has settled.
 */
export function trackDeadApiCalls(page: Page): string[] {
  const notFound: string[] = [];
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (
      res.status() === 404 &&
      (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/"))
    ) {
      notFound.push(`${res.request().method()} ${url.pathname}`);
    }
  });
  return notFound;
}

/** Drive the real WorkOS email+password login and land authenticated
 *  on /sales. */
export async function loginWithPassword(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-email-input").fill(email);
  await page.getByTestId("login-password-input").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/sales/, { timeout: 45_000 });
}

/**
 * Create a company through the real UI (add-modal → submit). Every
 * real-auth spec seeds this way — through the interface, never an API
 * shortcut. Callers add their own post-create assertions.
 */
export async function createAccountViaUi(
  page: Page,
  name: string,
  source = "referral",
): Promise<void> {
  await page.getByTestId("sales-add-account-button").click();
  await page.getByTestId("sales-account-name-input").fill(name);
  await page.getByTestId("sales-account-source-select").selectOption(source);
  await page.getByRole("button", { name: /Add company/i }).click();
}

/** Create an opportunity under an existing company through the real UI. */
export async function createOpportunityViaUi(
  page: Page,
  input: { title: string; accountName: string; useCase?: string },
): Promise<void> {
  await page.getByTestId("sales-add-opportunity-button").click();
  await page.getByTestId("sales-opportunity-title-input").fill(input.title);
  await page
    .getByTestId("sales-opportunity-account-select")
    .selectOption({ label: input.accountName });
  await page
    .getByTestId("sales-opportunity-use-case-select")
    .selectOption(input.useCase ?? "client_comms");
  await page.getByRole("button", { name: /Create opportunity/i }).click();
}
