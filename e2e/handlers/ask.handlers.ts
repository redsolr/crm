/**
 * Route handlers for the CRM "Ask" chat surfaces (`e2e/ask-panel.spec.ts`,
 * `e2e/ask-chat-tab.spec.ts`).
 *
 * Deliberately a separate file from `chat.handlers.ts` / `sales.handlers.ts`
 * — a STATEFUL in-memory chat store covering exactly the endpoints the Ask
 * drawer + /sales/ask page exercise:
 *
 *   - `POST /api/chats`                — lazy conversation create on first send
 *   - `POST /api/chats/:id/responses`  — Anthropic-style SSE stream (records
 *                                        the user turn + canned assistant turn)
 *   - `GET  /api/chats/history`        — the history rail's list
 *   - `GET  /api/chats/:id/messages`   — the history rail's open path
 *   - `DELETE /api/chats/:id`          — the history rail's delete
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
  /**
   * Invoked before each stream response is fulfilled (0-based send
   * index). Journey specs use it to APPLY the scripted turn's writes to
   * the sales mock store (`setupSalesHandlers(...).agentWrites`) so the
   * views behind the chat actually change.
   */
  onSend?: (sendIndex: number) => void;
}

interface StoredChat {
  id: string;
  title: string | null;
  updatedAt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function setupAskHandlers(
  page: Page,
  options?: AskHandlerOptions,
) {
  const firstChatId = options?.chatId ?? "chat-ask-e2e-001";
  const streamContent =
    options?.streamContent ??
    "Acme and Bluebird both have follow-ups due this week — start with Acme, their pilot decision is pending.";
  const streamModel = options?.streamModel ?? "gpt-5.4-nano";

  // Every validated stream request's `input` field, in send order — the
  // spec asserts the wire payload (page-context preamble) against this
  // while the transcript shows only the user's own text.
  const capturedStreamInputs: string[] = [];

  // In-memory store behind history/messages/delete — what the standalone
  // backend persists in Postgres. First create keeps the caller-known id.
  const chatStore: StoredChat[] = [];
  let createdCount = 0;

  function serializeStoredChat(chat: StoredChat) {
    return {
      ...createChatResponse({ id: chat.id, title: chat.title }),
      updated_at: chat.updatedAt,
    };
  }

  // POST /api/chats — the panel creates the conversation lazily on first
  // send. GETs on subpaths are handled by the routes registered below.
  await page.route(`${API_ROOT}/chats`, async (route, request) => {
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    const rawBody = request.postData() ?? "{}";
    const body = JSON.parse(rawBody) as { title?: unknown };
    createdCount += 1;
    const chat: StoredChat = {
      id: createdCount === 1 ? firstChatId : `chat-ask-e2e-${createdCount}`,
      title: typeof body.title === "string" ? body.title : null,
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    chatStore.unshift(chat);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(serializeStoredChat(chat)),
    });
  });

  const escapedV1 = API_ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // GET /api/chats/history — the /sales/ask history rail. Registered
  // after the fixture's empty-history catch-all, so this one wins.
  await page.route(`${API_ROOT}/chats/history**`, async (route, request) => {
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }
    const sorted = [...chatStore].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        chats: sorted.map(serializeStoredChat),
        total: sorted.length,
        grouped: {},
      }),
    });
  });

  // GET /api/chats/:id/messages — the history rail's open path.
  await page.route(
    new RegExp(`${escapedV1}/chats/[^/]+/messages$`),
    async (route, request) => {
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      const id = new URL(request.url()).pathname.split("/").at(-2) as string;
      const chat = chatStore.find((c) => c.id === id);
      if (!chat) {
        await route.fulfill({ status: 404, body: "" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          chat: serializeStoredChat(chat),
          messages: chat.messages.map((message, index) => ({
            id: `msg-${chat.id}-${index}`,
            chat_id: chat.id,
            role: message.role,
            content: message.content,
            created_at: chat.updatedAt,
          })),
        }),
      });
    },
  );

  // DELETE /api/chats/:id — the history rail's delete.
  await page.route(
    new RegExp(`${escapedV1}/chats/[^/]+$`),
    async (route, request) => {
      if (request.method() !== "DELETE") {
        await route.fallback();
        return;
      }
      const id = new URL(request.url()).pathname.split("/").at(-1) as string;
      const index = chatStore.findIndex((c) => c.id === id);
      if (index === -1) {
        await route.fulfill({ status: 404, body: "" });
        return;
      }
      chatStore.splice(index, 1);
      await route.fulfill({ status: 204, body: "" });
    },
  );

  // POST /api/chats/:id/responses — SSE stream (Anthropic-style events,
  // matching what src/lib/chat/stream.ts parses). Records the turn in
  // the store so a later history-rail reload returns it.
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
      options?.onSend?.(capturedStreamInputs.length);
      capturedStreamInputs.push(body.input);

      const id = new URL(request.url()).pathname.split("/").at(-2) as string;
      const chat = chatStore.find((c) => c.id === id);
      if (chat) {
        chat.messages.push(
          { role: "user", content: body.input },
          { role: "assistant", content: streamContent },
        );
        chat.updatedAt = new Date().toISOString();
      }

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

  return { chatId: firstChatId, streamContent, capturedStreamInputs };
}
