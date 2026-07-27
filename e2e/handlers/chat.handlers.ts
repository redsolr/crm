/**
 * Route handler factories for chat endpoints.
 * Covers: chat CRUD, streaming, history, branches.
 *
 * Wire contract (matches `platform/src/modules/chat-completion/chat.response.dto.ts`):
 *   - URL prefix: `/v1/` (Stripe v2 discipline). Chat resource lives at
 *     `/v1/chats/...` (plural). Streaming is `POST /v1/chats/{id}/responses`
 *     (the legacy `/v1/chat/stream` action endpoint was removed when the
 *     platform adopted the Anthropic-style nested-resource shape — see
 *     `src/lib/chat/stream.ts` § "Stream a chat response from
 *     POST /v1/chats/{id}/responses").
 *   - List envelopes use the standard cursor shape:
 *     `{ data, has_more, next_page_url, previous_page_url? }`
 *   - The chat-history envelope is the legacy `{ chats, total, grouped }`
 *     shape (see ChatHistoryResponseSchema). Field names within rows are
 *     snake_case per the wire contract — the Zod schemas transform to
 *     camelCase on the FE side.
 */

import { Page } from "@playwright/test";
import {
  API_BASE,
  API_V1,
  createChatResponse,
  createChatMessagesResponse,
} from "./shared";
import { buildSSEStream, buildSSEErrorStream } from "../helpers/sse-builder";

export interface ChatHandlerOptions {
  streamContent?: string;
  streamModel?: string;
  chatId?: string;
  existingMessages?: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
}

/**
 * Required fields on the backend `CreateResponseDto` (POST
 * /v1/chats/:id/responses). Mirrors the wire shape that
 * `src/lib/chat/stream.ts#toResponsesRequest` builds — snake_case keys,
 * a sparse body (only `stream` + `model` are unconditional; `input` is
 * present on every first-turn call, absent on tool-result continuations).
 *
 * If the backend DTO ever adds a required field, the assertion below
 * will fail and point at exactly which field is missing.
 */
const REQUIRED_RESPONSES_FIELDS = ["stream", "model"] as const;
const ALLOWED_RESPONSES_FIELDS = new Set<string>([
  "stream",
  "model",
  "input",
  "system",
  "tools",
  "tool_choice",
  // Matter-scoped agentic chat: the matter the server runs agent tools over.
  "matter_id",
  // Thread-grounded copilot chat (the Communications rail): the client
  // conversation the server grounds the system segment in.
  "thread_id",
]);

/**
 * Validate the body of a POST /v1/chats/:id/responses request against the
 * backend `CreateResponseDto` shape. Throws with a precise message on drift
 * — caught by Playwright as a test failure rather than silently fulfilling
 * with mock data.
 *
 * This is the assertion that would have caught the `folderId` phantom-field
 * regression: the frontend was sending `folderId` even though the backend
 * DTO never accepted it, and the previous mock handler unconditionally
 * returned 200 regardless of payload.
 */
function assertResponsesRequestShape(
  rawBody: string,
  requestUrl: string,
): void {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `[chat.handlers] POST ${requestUrl} body is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }\nRaw body: ${rawBody}`,
    );
  }

  for (const required of REQUIRED_RESPONSES_FIELDS) {
    if (body[required] == null) {
      throw new Error(
        `[chat.handlers] POST ${requestUrl} missing required field "${required}". ` +
          `Got body: ${JSON.stringify(body)}`,
      );
    }
  }

  const phantom = Object.keys(body).filter(
    (key) => !ALLOWED_RESPONSES_FIELDS.has(key),
  );
  if (phantom.length > 0) {
    throw new Error(
      `[chat.handlers] POST ${requestUrl} contains phantom fields not on the ` +
        `backend CreateResponseDto: ${phantom.join(", ")}. ` +
        `Either add the field to ALLOWED_RESPONSES_FIELDS in this file (and to the ` +
        `backend DTO!) or remove it from the frontend request builder. ` +
        `This kind of drift is exactly what this assertion exists to catch — ` +
        `the global ValidationPipe({ whitelist: true }) on the backend silently ` +
        `strips unknown fields, making the bug invisible in production.`,
    );
  }
}

/**
 * Set up all standard chat route handlers.
 * Returns the chatId used for mocking.
 */
export async function setupChatHandlers(
  page: Page,
  options?: ChatHandlerOptions,
) {
  const chatId = options?.chatId ?? "chat-e2e-static-001";
  const streamContent =
    options?.streamContent ?? "This is a test response from the AI assistant.";
  const streamModel = options?.streamModel ?? "gpt-5-nano";

  // Stateful per-chat message log. Pre-seeded with `existingMessages`; the
  // stream handler appends the user-input + assistant-content pair on every
  // POST /responses so GET /messages reflects what the stream "persisted".
  //
  // Why this matters: the FE's `useChatQuery` invalidates
  // `chats.messages(id)` after a stream completes, triggering a refetch.
  // The sync effect at use-chat-query.ts § "Sync query data to local
  // messages state" sees `serverMsgs.length < prev.length` and bails out —
  // but only if `messagesChatIdRef.current === initialChatId`. On the very
  // first sync for a newly-created chat that ref is null, so isSameChat is
  // false and the empty server-msgs would WIPE the optimistic
  // [user, assistant] pair. Returning the same messages from the mock keeps
  // the visible state stable.
  const messageLog: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [...(options?.existingMessages ?? [])];

  // POST /v1/chats/:id/responses — SSE streaming.
  // Catches every chat id (the FE may create a chat first, then stream on
  // its real id). Registered BEFORE the more general /v1/chats/:id route
  // below so the suffix-match wins.
  const escapedV1 = API_V1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.route(
    new RegExp(`${escapedV1}/chats/[^/]+/responses$`),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      // Validate request body shape — fails the test on contract drift
      // instead of silently returning a 200 regardless of what the
      // frontend sent.
      const rawBody = request.postData() ?? "";
      assertResponsesRequestShape(rawBody, request.url());

      // Mirror the platform behaviour: persist the user input + assistant
      // text to the chat history so a subsequent GET /messages returns
      // both messages.
      try {
        const body = JSON.parse(rawBody) as { input?: string };
        if (typeof body.input === "string" && body.input.length > 0) {
          messageLog.push({ role: "user", content: body.input });
        }
        messageLog.push({ role: "assistant", content: streamContent });
      } catch {
        // Body parse failures are caught above by
        // assertResponsesRequestShape; nothing else to do here.
      }

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: {
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: buildSSEStream({ content: streamContent, model: streamModel }),
      });
    },
  );

  // POST /v1/chats — create chat
  await page.route(`${API_V1}/chats`, async (route, request) => {
    if (request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(createChatResponse({ id: chatId })),
      });
    } else {
      await route.fallback();
    }
  });

  // Note: chats/history* and chats/my* are handled by auth.fixture.ts as
  // background sidebar routes. Domain-specific overrides can be layered on top.

  // GET /v1/chats/:id/messages — get chat messages.
  // Returns the accumulated `messageLog`. POST (tool-result pre-flight
  // append) → just echo a success with no body since the stream FE only
  // checks .ok.
  await page.route(`${API_V1}/chats/*/messages`, async (route, request) => {
    const url = route.request().url();
    const urlChatId = url.match(/\/chats\/([^/]+)\/messages/)?.[1] ?? chatId;
    if (request.method() === "POST") {
      // tool-result append — just return 201 with a stub message envelope.
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: `msg-${urlChatId}-tool-${Date.now()}`,
          chat_id: urlChatId,
          role: "user",
          content: "",
          created_at: new Date().toISOString(),
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createChatMessagesResponse(urlChatId, messageLog)),
    });
  });

  // GET /v1/chats/:id/branches
  await page.route(`${API_V1}/chats/*/branches`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  // PUT /v1/chats/:id/title — update chat title
  await page.route(`${API_V1}/chats/*/title`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ title: "Updated Title" }),
    });
  });

  // PATCH/DELETE /v1/chats/:id — update or delete chat (exclude known
  // sub-paths like /responses, /messages, /branches, /title, etc.).
  await page.route(
    new RegExp(`${escapedV1}/chats/(?!history|my)[^/]+$`),
    async (route, request) => {
      const method = request.method();
      if (method === "PATCH" || method === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createChatResponse({ id: chatId })),
        });
      } else if (method === "DELETE") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ deleted: true }),
        });
      } else {
        await route.fallback();
      }
    },
  );

  // Reference API_BASE so it's clear we're intentionally NOT using it here;
  // every chat route lives under /v1/.
  void API_BASE;

  return { chatId };
}

/**
 * Override the stream handler to return an error.
 */
export async function setupChatStreamError(
  page: Page,
  errorMessage = "Internal server error",
) {
  const escapedV1 = API_V1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.route(
    new RegExp(`${escapedV1}/chats/[^/]+/responses$`),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: buildSSEErrorStream(errorMessage),
      });
    },
  );
}

/**
 * Override the stream handler to simulate a slow response.
 * The entire response is delayed by delayMs before being sent.
 * Wrapped in try-catch for abort safety — if the client stops the request
 * before the delay completes, route.fulfill throws (expected behavior).
 */
export async function setupSlowChatStream(
  page: Page,
  content: string,
  delayMs = 3000,
) {
  const escapedV1 = API_V1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.route(
    new RegExp(`${escapedV1}/chats/[^/]+/responses$`),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: buildSSEStream({ content }),
        });
      } catch {
        // Route was aborted by the client (e.g., stop button clicked) — expected
      }
    },
  );
}

/**
 * Override the stream handler to return an HTTP error status.
 */
export async function setupChatStreamHttpError(page: Page, status: number) {
  const escapedV1 = API_V1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.route(
    new RegExp(`${escapedV1}/chats/[^/]+/responses$`),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({ status, contentType: "text/plain", body: "Error" });
    },
  );
}

/**
 * Mock the chats/my endpoint to return a list of chats in the sidebar history.
 */
export interface MockChat {
  id: string;
  title: string;
  parentChatId?: string | null;
  findingsCount?: number;
  starred?: boolean;
}

export async function setupChatHistory(page: Page, chats: MockChat[]) {
  // Each chat row in the history envelope must match `ChatResponseSchema`
  // (snake_case wire shape). The FE re-parses every item; a missing
  // required field (page_id, branched_from_message_id, branch_name,
  // ephemeral) fails the parse and the sidebar renders empty.
  const chatItems = chats.map((c) => ({
    id: c.id,
    title: c.title,
    page_id: null,
    findings_count: c.findingsCount ?? 0,
    parent_chat_id: c.parentChatId ?? null,
    branched_from_message_id: null,
    branch_name: null,
    starred: c.starred ?? false,
    ephemeral: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // Mock /v1/chats/history* (used by useResearchChatsQuery in sidebar)
  await page.route(`${API_V1}/chats/history*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        chats: chatItems,
        total: chatItems.length,
        grouped: {},
      }),
    });
  });

  // Mock /v1/chats/my* (used by other chat history queries)
  await page.route(`${API_V1}/chats/my*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(chatItems),
    });
  });
}

/**
 * Mutable chat history — DELETE /v1/chats/:id removes from the list,
 * subsequent GET /v1/chats/my* reflects the change.
 */
export async function setupMutableChatHistory(
  page: Page,
  initialChats: MockChat[],
) {
  const chats = [...initialChats];

  const buildResponse = () => {
    // Same wire shape contract as setupChatHistory above. Required fields
    // for `ChatResponseSchema`: id, title, page_id, findings_count,
    // parent_chat_id, branched_from_message_id, branch_name, starred,
    // ephemeral, created_at, updated_at.
    const items = chats.map((c) => ({
      id: c.id,
      title: c.title,
      page_id: null,
      findings_count: c.findingsCount ?? 0,
      parent_chat_id: c.parentChatId ?? null,
      branched_from_message_id: null,
      branch_name: null,
      starred: c.starred ?? false,
      ephemeral: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    return { chats: items, total: items.length, grouped: {} };
  };

  // Mock /v1/chats/history* (used by useResearchChatsQuery)
  await page.route(`${API_V1}/chats/history*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildResponse()),
    });
  });

  // Mock /v1/chats/my* (fallback for other chat queries)
  await page.route(`${API_V1}/chats/my*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildResponse().chats),
    });
  });

  const escapedV1 = API_V1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const chatCrudPattern = new RegExp(
    `${escapedV1}/chats/(?!stream|history|my)[^/]+$`,
  );
  await page.route(chatCrudPattern, async (route, request) => {
    const method = request.method();
    if (method === "DELETE") {
      const chatId = request.url().split("/chats/")[1]?.split("?")[0];
      const idx = chats.findIndex((c) => c.id === chatId);
      if (idx !== -1) chats.splice(idx, 1);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ deleted: true }),
      });
    } else if (method === "PATCH" || method === "PUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createChatResponse()),
      });
    } else {
      await route.fallback();
    }
  });

  return { chats };
}
