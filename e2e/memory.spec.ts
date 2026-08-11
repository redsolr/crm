/**
 * Assistant memory — Account section (ChatGPT-memory arc, 2026-08-12).
 *
 * Claims (mocked tier — hermetic route mocks, invites-section pattern):
 * - Account → Assistant memory lists saved facts.
 * - Adding a fact posts `{ content }` and the row appears.
 * - Deleting a row removes it and the empty state returns.
 *
 * The agent-side halves live elsewhere: tool registry + prompt
 * injection in jest (`ask.test.ts`, `ask-prompt.test.ts`), the real
 * model actually calling remember_fact/forget_fact in
 * `real-llm.real-auth.spec.ts` scene 6.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { API_ROOT } from "./handlers/shared";

test.describe("Account → Assistant memory", () => {
  test("adds a memory, lists it, deletes it", async ({ authedPage }) => {
    const memories: Array<Record<string, unknown>> = [];
    await authedPage.route(`${API_ROOT}/memories`, async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: memories }),
        });
        return;
      }
      if (request.method() === "POST") {
        const body = request.postDataJSON() as { content: string };
        const memory = {
          id: "memo_e2e_1",
          content: body.content,
          created_by_name: "E2E Test User",
          created_at: "2026-08-12T00:00:00.000Z",
        };
        memories.push(memory);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ memory }),
        });
        return;
      }
      await route.fallback();
    });
    await authedPage.route(
      `${API_ROOT}/memories/memo_e2e_1`,
      async (route, request) => {
        if (request.method() !== "DELETE") return route.fallback();
        memories.length = 0;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ deleted: true }),
        });
      },
    );

    await authedPage.goto("/account");
    await expect(authedPage.getByTestId("account-memory")).toBeVisible();
    await expect(authedPage.getByTestId("memory-empty")).toBeVisible();

    await authedPage
      .getByTestId("memory-content-input")
      .fill("Keep follow-up drafts short and direct");
    await authedPage.getByTestId("memory-create-button").click();

    const rowLocator = authedPage.getByTestId("memory-row");
    await expect(rowLocator).toHaveCount(1);
    await expect(rowLocator).toContainText(
      "Keep follow-up drafts short and direct",
    );

    await authedPage.getByTestId("memory-row-delete").click();
    await expect(rowLocator).toHaveCount(0);
    await expect(authedPage.getByTestId("memory-empty")).toBeVisible();
  });
});
