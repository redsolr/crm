/**
 * Chat tab E2E (Tier 1 — mocked).
 *
 * The dedicated sidebar "Chat" tab (founder ask 2026-08-02): a
 * ChatGPT-shape full-page surface at /sales/ask — history rail on the
 * left (new chat, persisted conversations, delete), transcript +
 * composer on the right. The AI reply is a mocked SSE stream (the
 * budget never notices this spec).
 *
 * Journey: sidebar tab routes to the page → empty history → send a
 * question → user bubble + streamed reply → the conversation appears
 * in the rail (titled, active) → "New chat" clears the transcript →
 * reopening the conversation REHYDRATES it from the persisted turns →
 * a follow-up streams into the reopened chat → delete forgets it and
 * resets the open conversation.
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import { setupAskHandlers } from "./handlers/ask.handlers";
import { STEP_TIMEOUT } from "./helpers/sales-ui";

/** 1×1 transparent PNG — enough for the paste → wire → thumbnail loop. */
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test.describe("Chat tab", () => {
  test("Ctrl+V screenshot: preview strip → rides the send → thumbnail in the bubble", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    await setupAskHandlers(authedPage, {
      streamContent: "That screenshot shows the pipeline table.",
    });
    await authedPage.goto("/sales/ask");
    await expect(authedPage.getByTestId("crm-ask-input")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    // Paste an image into the composer (ClipboardEvent with a File —
    // the same shape a screenshot paste produces).
    await authedPage.evaluate((pngBase64) => {
      const textarea = document.querySelector(
        '[data-testid="crm-ask-input"]',
      );
      if (textarea === null) throw new Error("composer not found");
      const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "shot.png", { type: "image/png" }));
      textarea.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, TINY_PNG);

    // Preview strip with a removable thumbnail.
    await expect(authedPage.getByTestId("crm-ask-attachment")).toHaveCount(1, {
      timeout: STEP_TIMEOUT,
    });

    // A text-only paste is ignored (no extra attachment)…
    await authedPage.evaluate(() => {
      const textarea = document.querySelector(
        '[data-testid="crm-ask-input"]',
      );
      if (textarea === null) throw new Error("composer not found");
      const dt = new DataTransfer();
      dt.setData("text/plain", "just words");
      textarea.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(authedPage.getByTestId("crm-ask-attachment")).toHaveCount(1);

    // …the ✕ removes a staged screenshot…
    await authedPage.getByTestId("crm-ask-attachment-remove").click();
    await expect(authedPage.getByTestId("crm-ask-attachment")).toHaveCount(0);

    // …and re-pasting stages it again for the send below.
    await authedPage.evaluate((pngBase64) => {
      const textarea = document.querySelector(
        '[data-testid="crm-ask-input"]',
      );
      if (textarea === null) throw new Error("composer not found");
      const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "shot.png", { type: "image/png" }));
      textarea.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, TINY_PNG);
    await expect(authedPage.getByTestId("crm-ask-attachment")).toHaveCount(1, {
      timeout: STEP_TIMEOUT,
    });

    // Send — the request body carries the image as a data URL.
    const requestPromise = authedPage.waitForRequest(
      (r) =>
        r.method() === "POST" && /\/api\/chats\/[^/]+\/responses$/.test(r.url()),
    );
    await authedPage
      .getByTestId("crm-ask-input")
      .fill("What's in this screenshot?");
    await authedPage.keyboard.press("Enter");
    const request = await requestPromise;
    const body = request.postDataJSON() as { images?: string[] };
    expect(Array.isArray(body.images)).toBe(true);
    expect(body.images?.[0]?.startsWith("data:image/png;base64,")).toBe(true);

    // The user bubble shows the thumbnail; the staged strip cleared.
    await expect(
      authedPage.getByTestId("crm-ask-message-image"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(authedPage.getByTestId("crm-ask-attachments")).toHaveCount(0);
    await expect(
      authedPage.getByTestId("crm-ask-message-assistant"),
    ).toContainText("That screenshot", { timeout: STEP_TIMEOUT });
  });

  test("sidebar tab → send → history rail → reopen rehydrates → delete", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);
    const { streamContent } = await setupAskHandlers(authedPage, {
      streamContent:
        "Ask Khun Rattana who owns the pilot budget and when they decide.",
    });

    await authedPage.goto("/sales");
    await expect(authedPage.getByTestId("crm-shell")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    // ── The sidebar carries a first-class Chat tab ──────────────────
    const navChat = authedPage.getByTestId("sales-nav-chat");
    await expect(navChat).toBeVisible();
    await navChat.click();
    await expect(authedPage).toHaveURL(/\/sales\/ask$/, {
      timeout: STEP_TIMEOUT,
    });
    await expect(authedPage.getByTestId("sales-ask-view")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });

    // ChatGPT shape: history rail (empty state) + composer.
    await expect(authedPage.getByTestId("ask-history-rail")).toBeVisible();
    await expect(authedPage.getByTestId("ask-history-empty")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await expect(authedPage.getByTestId("crm-ask-input")).toBeVisible();

    // ── Send: user bubble renders, mocked reply streams in ──────────
    const question = "Today I meet Thonglor Legal — what should I ask them?";
    await authedPage.getByTestId("crm-ask-input").fill(question);
    await authedPage.keyboard.press("Enter");
    await expect(authedPage.getByTestId("crm-ask-message-user")).toContainText(
      "what should I ask",
      { timeout: STEP_TIMEOUT },
    );
    await expect(
      authedPage.getByTestId("crm-ask-message-assistant"),
    ).toContainText(streamContent, { timeout: STEP_TIMEOUT });

    // ── The conversation lands in the rail, titled and active ───────
    const item = authedPage.getByTestId("ask-history-item");
    await expect(item).toHaveCount(1, { timeout: STEP_TIMEOUT });
    await expect(item).toContainText("Today I meet Thonglor");
    await expect(item).toHaveAttribute("data-active", "true");

    // ── New chat clears the transcript and deactivates the rail row ─
    await authedPage.getByTestId("ask-history-new").click();
    await expect(authedPage.getByTestId("crm-ask-message-user")).toHaveCount(
      0,
    );
    await expect(item).not.toHaveAttribute("data-active", "true");

    // ── Reopen: the transcript REHYDRATES from the persisted turns ──
    await item.click();
    await expect(authedPage.getByTestId("crm-ask-message-user")).toContainText(
      "what should I ask",
      { timeout: STEP_TIMEOUT },
    );
    await expect(
      authedPage.getByTestId("crm-ask-message-assistant"),
    ).toContainText(streamContent);
    await expect(item).toHaveAttribute("data-active", "true");

    // ── A follow-up streams into the reopened conversation ──────────
    await authedPage
      .getByTestId("crm-ask-input")
      .fill("I just finished the call — update the status for me.");
    await authedPage.keyboard.press("Enter");
    await expect(
      authedPage.getByTestId("crm-ask-message-user").nth(1),
    ).toContainText("update the status", { timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("crm-ask-message-assistant").nth(1),
    ).toContainText(streamContent, { timeout: STEP_TIMEOUT });

    // ── Delete forgets the chat and resets the open conversation ────
    await item.hover();
    await authedPage.getByTestId("ask-history-delete").click();
    await expect(authedPage.getByTestId("ask-history-item")).toHaveCount(0, {
      timeout: STEP_TIMEOUT,
    });
    await expect(authedPage.getByTestId("ask-history-empty")).toBeVisible();
    await expect(authedPage.getByTestId("crm-ask-message-user")).toHaveCount(
      0,
    );
  });
});
