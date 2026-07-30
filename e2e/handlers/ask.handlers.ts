/**
 * Route handlers for the CRM "Ask" panel spec (`e2e/ask-panel.spec.ts`).
 *
 * Deliberately a separate file from `chat.handlers.ts` / `sales.handlers.ts`
 * — the Ask panel exercises exactly two chat endpoints and nothing else:
 *
 *   - `POST /api/chats`                — lazy conversation create on first send
 *   - `POST /api/chats/:id/responses`  — Anthropic-style SSE stream
 *
 * URL discipline: every pattern includes the `/api/` prefix (via `API_ROOT`);
 * an unprefixed pattern silently never matches because
 * `BaseApiClient.baseUrl` is `${API_BASE}/api`.
 *
 * The stream handler validates the request body against the backend
 * `CreateResponseDto` essentials (`stream`, `model`, `input`) so contract
 * drift in the panel's request builder fails the spec loudly instead of
 * being papered over by an unconditional 200.
 */

import { Page } from "@playwright/test";
import { API_ROOT, createChatResponse } from "./shared";
import { buildSSEStream } from "../helpers/sse-builder";

export interface AskHandlerOptions {
  chatId?: string;
  streamContent?: string;
  streamModel?: string;
  /**
   * `tool_step` SSE events emitted before the answer — the workspace
   * agentic loop acting on CRM records (create_opportunity etc.).
   */
  toolSteps?: Array<{ tool_name: string; summary: string }>;
}

export async function setupAskHandlers(
  page: Page,
  options?: AskHandlerOptions,
) {
  const chatId = options?.chatId ?? "chat-ask-e2e-001";
  const streamContent =
    options?.streamContent ??
    "Acme and Bluebird both have follow-ups due this week — start with Acme, their pilot decision is pending.";
  const streamModel = options?.streamModel ?? "gpt-5.4-nano";

  // Every validated stream request's `input` field, in send order — the
  // spec asserts the wire payload (page-context preamble) against this
  // while the transcript shows only the user's own text.
  const capturedStreamInputs: string[] = [];

  // POST /api/chats — the panel creates the conversation lazily on first
  // send. GETs (history sidebar etc.) fall through to the fixture mocks.
  await page.route(`${API_ROOT}/chats`, async (route, request) => {
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(createChatResponse({ id: chatId })),
    });
  });

  // POST /api/chats/:id/responses — SSE stream (Anthropic-style events,
  // matching what src/lib/chat/stream.ts parses).
  const escapedV1 = API_ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.route(
    new RegExp(`${escapedV1}/chats/[^/]+/responses$`),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }

      const rawBody = request.postData() ?? "";
      let body: { stream?: unknown; model?: unknown; input?: unknown };
      try {
        body = JSON.parse(rawBody) as typeof body;
      } catch (err) {
        throw new Error(
          `[ask.handlers] POST ${request.url()} body is not valid JSON: ` +
            `${err instanceof Error ? err.message : String(err)}\nRaw: ${rawBody}`,
        );
      }
      if (
        body.stream !== true ||
        typeof body.model !== "string" ||
        typeof body.input !== "string" ||
        body.input.length === 0
      ) {
        throw new Error(
          `[ask.handlers] POST ${request.url()} does not match the backend ` +
            `CreateResponseDto essentials (stream: true, model: string, ` +
            `input: non-empty string). Got: ${JSON.stringify(body)}`,
        );
      }
      capturedStreamInputs.push(body.input);

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: {
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: buildSSEStream({
          content: streamContent,
          model: streamModel,
          toolSteps: options?.toolSteps,
        }),
      });
    },
  );

  return { chatId, streamContent, capturedStreamInputs };
}
