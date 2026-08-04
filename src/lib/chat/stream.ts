/**
 * Anthropic-style SSE streaming for `POST /api/chats/{id}/responses`.
 *
 * This module is the **entire** chat-stream state machine. It owns:
 *
 *   - The request body builder for the native `responses` endpoint
 *     (`toResponsesRequest`).
 *   - The non-2xx response handler (401 / 429 / 402) with
 *     telemetry breadcrumbs (`handleStreamErrorResponse`).
 *   - The SSE event state machine (`dispatchStreamEvent` + `ChatStreamState`
 *     + `EventDispatchResult`) — Anthropic-typed events
 *     (`message_start`, `content_block_*`, `message_delta`,
 *     `message_stop`) plus the platform-specific `chat_response` lead
 *     event carrying the response_id.
 *   - The top-level `startChatStream` function that glues fetch → reader
 *     loop → dispatcher together, with Sentry breadcrumbs at every
 *     decision point and connection cleanup in a `finally` block.
 *
 * **Tool-call continuation.** When the model emits `tool_use` blocks
 * and the FE has executed the tools, it calls back in with
 * `tool_results` set on the request. The new endpoint splits durable
 * appends from model invocation per
 * `docs/platform/chat-surface-design.md` § 2: we POST each tool
 * result to `/api/chats/{id}/messages` (durable, no model call), then
 * POST `/api/chats/{id}/responses` with no `input` to continue the
 * conversation against the now-extended history.
 */

import { authService } from "../authTokenManager";
import { freshIdempotencyKey } from "../idempotency";
import { chatBreadcrumb } from "./breadcrumbs";
import type {
  ByokCredentialMissingInfo,
  ChatRequest,
  StartChatStreamOptions,
  ToolCall,
  UsageLimitInfo,
} from "./types";

// ============================================================================
// Internal types — not exported outside this module
// ============================================================================

/**
 * Anthropic-style SSE event payload sent by the backend's
 * `POST /api/chats/{id}/responses` endpoint. Only the fields actually
 * consumed by `dispatchStreamEvent` are typed — the backend may send
 * additional fields that are intentionally ignored.
 */
interface ChatStreamEvent {
  type?: string;
  error?: { message?: string };
  message?: { usage?: { inputTokens?: number }; model?: string };
  contentBlock?: { type?: string; id: string; name: string };
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partialJson?: string;
    stopReason?: string;
  };
  usage?: { outputTokens?: number };
  // `tool_step` events (matter-scoped server-side tool loop).
  tool_name?: string;
  summary?: string;
  citations?: string[];
}

/**
 * Mutable per-stream state extracted into its own struct so the event
 * handler can take a single `state` parameter instead of several loose
 * closure variables.
 */
interface ChatStreamState {
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
  /** Tool calls in progress, keyed by content-block index. Accumulates partial JSON. */
  toolCallsInProgress: Map<
    number,
    { id: string; name: string; inputJson: string }
  >;
}

function createChatStreamState(): ChatStreamState {
  return {
    inputTokens: 0,
    outputTokens: 0,
    modelUsed: "",
    toolCallsInProgress: new Map(),
  };
}

/**
 * Result of dispatching a single SSE event. The handler returns one of these
 * to tell the read loop what to do next — explicit and testable, instead of
 * relying on a `return` statement buried inside a switch case.
 *
 * Note the deliberate distinction between `stop-tool-use` and `stop-end-turn`:
 *   - `stop-end-turn` (final response) → call `onComplete` and stop reading.
 *   - `stop-tool-use` (waiting for tool results) → stop reading WITHOUT calling
 *     `onComplete`. The caller will issue a continuation request once it has
 *     executed the tools.
 */
type EventDispatchResult =
  | { kind: "continue" }
  | { kind: "stop-end-turn" }
  | { kind: "stop-tool-use" }
  | { kind: "stop-error"; message: string };

// ============================================================================
// Pure helpers
// ============================================================================

/** Detect a fetch/reader abort. Works for both `DOMException` and plain `Error` shapes. */
function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

/**
 * Build the snake_case body for `POST /api/chats/{id}/responses`.
 *
 * `input` is the new user content for first-turn calls; tool-result
 * continuation calls leave `input` unset (the durable tool_result
 * messages are pre-flighted via `POST /api/chats/{id}/messages`
 * before this function runs).
 */
function toResponsesRequest(
  request: ChatRequest,
  options: { isToolContinuation: boolean },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    stream: true,
    model: request.model,
  };

  if (!options.isToolContinuation) {
    body.input = request.content;
    if (request.images !== undefined && request.images.length > 0) {
      // Pasted screenshots ride THIS turn only (data URLs — the
      // backend forwards them to the model as image content parts).
      body.images = request.images;
    }
  }
  if (request.matter_id !== undefined && request.matter_id !== "") {
    // Matter-scoped chat → server runs the agentic tool loop over this matter.
    body.matter_id = request.matter_id;
  }
  if (request.thread_id !== undefined && request.thread_id !== "") {
    // Thread-grounded copilot chat → server composes the conversation
    // transcript + matter context ahead of the system prompt.
    body.thread_id = request.thread_id;
  }
  if (request.system_prompt !== undefined && request.system_prompt !== "") {
    body.system = request.system_prompt;
  }
  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools;
    body.tool_choice = request.tool_choice || "auto";
  }

  return body;
}

/**
 * Pre-flight POST `/api/chats/{id}/messages` for each tool result so the
 * new turn's history is durably extended before we POST `/responses`.
 * Each tool_result is serialized as a JSON-array-of-blocks string —
 * matches how the backend persists tool_result content blocks today
 * (see `chat-completion.service.prepareChat`'s tool_results branch).
 */
async function appendToolResultMessages(
  baseUrl: string,
  chatId: string,
  toolResults: NonNullable<ChatRequest["tool_results"]>,
): Promise<void> {
  // Each tool_result append is independent and standalone; fire all
  // POSTs in parallel so we don't pay N round-trips before /responses.
  await Promise.all(
    toolResults.map(async (tr) => {
      const blockJson = JSON.stringify([
        {
          type: "tool_result",
          tool_use_id: tr.tool_use_id,
          content: tr.content,
          is_error: tr.is_error,
        },
      ]);
      const csrf = authService.getCsrfToken();
      const res = await fetch(`${baseUrl}/chats/${chatId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": freshIdempotencyKey(),
          ...(csrf !== null ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ role: "user", content: blockJson }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Failed to durably append tool_result before /responses (${res.status}): ${body.slice(0, 200)}`,
        );
      }
    }),
  );
}

/**
 * Handles a non-2xx response from `POST /api/chats/{id}/responses` by
 * invoking the appropriate callback (`onError` or
 * `onUsageLimitExceeded`) and returning. Centralises the 401 / 402 /
 * 429 / generic-error branches so the streaming function can stay
 * focused on the SSE state machine.
 */
async function handleStreamErrorResponse(
  response: Response,
  options: Pick<
    StartChatStreamOptions,
    "onError" | "onUsageLimitExceeded" | "onByokCredentialMissing"
  >,
): Promise<void> {
  if (response.status === 401) {
    chatBreadcrumb("stream: 401 unauthorized", "warning");
    options.onError("Unauthorized");
    return;
  }

  if (response.status === 429) {
    chatBreadcrumb("stream: 429 usage limit exceeded", "warning");
    try {
      // ApiErrorEnvelope from UsageGuard: `error.code =
      // 'usage_limit_exceeded'`, `error.meta.limitType` names the cap
      // that bound — org-level ('session' | 'weekly' rolling window,
      // 'hard' period budget) or per-member ('session_member' |
      // 'weekly_member' | 'monthly_member': only the caller's personal
      // share is exhausted; colleagues unaffected). `error.meta.resetAt`
      // is when it frees up.
      const envelope = (await response.json()) as {
        error?: {
          code?: string;
          message?: string;
          meta?: { limitType?: string; resetAt?: string | null };
        };
      };
      const meta = envelope.error?.meta;
      const knownLimitTypes: ReadonlyArray<UsageLimitInfo["limitType"]> = [
        "session",
        "weekly",
        "hard",
        "session_member",
        "weekly_member",
        "monthly_member",
      ];
      const limitType: UsageLimitInfo["limitType"] =
        knownLimitTypes.find((t) => t === meta?.limitType) ?? "hard";
      const info: UsageLimitInfo = {
        limitType,
        resetAt: typeof meta?.resetAt === "string" ? meta.resetAt : null,
        message: envelope.error?.message ?? "Usage limit exceeded",
      };
      if (options.onUsageLimitExceeded) {
        options.onUsageLimitExceeded(info);
      } else {
        options.onError(info.message);
      }
    } catch (err) {
      console.error(
        "[chatApi] Failed to parse 429 usage-limit response:",
        err,
      );
      options.onError("Usage limit exceeded");
    }
    return;
  }

  if (response.status === 403) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch (err) {
      console.error("[chatApi] Failed to parse 403 response body:", err);
    }
    const b = (body ?? {}) as { error?: { message?: string } };
    chatBreadcrumb("stream: 403 forbidden", "warning");
    options.onError(b.error?.message ?? "Forbidden");
    return;
  }

  if (response.status === 402) {
    chatBreadcrumb("stream: 402 payment required", "warning");
    try {
      const errorData = (await response.json()) as {
        code?: string;
        message?: string;
        recoveryHint?: string;
        provider?: string | null;
        settingsPath?: string;
      };
      if (errorData.code === "NO_BYOK_CREDENTIAL") {
        const info: ByokCredentialMissingInfo = {
          code: "NO_BYOK_CREDENTIAL",
          message: errorData.message ?? "No BYOK credential configured.",
          recoveryHint: errorData.recoveryHint,
          provider: errorData.provider ?? null,
          settingsPath: errorData.settingsPath ?? "/settings/api-keys",
        };
        if (options.onByokCredentialMissing) {
          options.onByokCredentialMissing(info);
        } else {
          options.onError(info.message);
        }
        return;
      }
      options.onError(errorData.message ?? "Payment required");
    } catch (err) {
      console.error("[chatApi] Failed to parse 402 response:", err);
      options.onError("Payment required");
    }
    return;
  }

  let body = "";
  try {
    body = await response.text();
  } catch (err) {
    console.error("[chatApi] Failed to read error response body:", err);
  }
  chatBreadcrumb(
    `stream: HTTP ${response.status} ${response.statusText}`,
    "error",
    { status: response.status, body: body.slice(0, 500) },
  );
  console.error(
    `[chatApi] POST /api/chats/{id}/responses failed: HTTP ${response.status} ${response.statusText}`,
    body,
  );
  options.onError(
    `HTTP ${response.status} ${response.statusText}${body ? ` — ${body}` : ""}`,
  );
}

// ============================================================================
// Event dispatcher — the heart of the state machine
// ============================================================================

/**
 * Pure (well — pure modulo `state` mutation and the supplied callbacks)
 * handler for a single parsed SSE event. Encapsulates the entire
 * Anthropic-style event state machine so the streaming function reads as:
 * read → parse → dispatch.
 */
function dispatchStreamEvent(
  parsed: ChatStreamEvent,
  currentEventType: string,
  state: ChatStreamState,
  options: Pick<StartChatStreamOptions, "onChunk" | "onToolUse" | "onToolStep">,
): EventDispatchResult {
  if (parsed.type === "error" || currentEventType === "error") {
    console.error(
      "[chatApi] Server emitted error event:",
      parsed.error ?? parsed,
    );
    return {
      kind: "stop-error",
      message: parsed.error?.message || "Stream error",
    };
  }

  switch (parsed.type) {
    case "message_start":
      state.inputTokens = parsed.message?.usage?.inputTokens || 0;
      state.modelUsed = parsed.message?.model || "";
      return { kind: "continue" };

    case "content_block_start":
      if (parsed.contentBlock?.type === "tool_use") {
        state.toolCallsInProgress.set(parsed.index ?? 0, {
          id: parsed.contentBlock.id,
          name: parsed.contentBlock.name,
          inputJson: "",
        });
      }
      return { kind: "continue" };

    case "content_block_delta":
      if (parsed.delta?.type === "text_delta" && parsed.delta?.text) {
        options.onChunk({
          content: parsed.delta.text,
          done: false,
          model_used: state.modelUsed,
        });
      }
      if (
        parsed.delta?.type === "input_json_delta" &&
        parsed.delta?.partialJson
      ) {
        const tc = state.toolCallsInProgress.get(parsed.index ?? 0);
        if (tc) {
          tc.inputJson += parsed.delta.partialJson;
        }
      }
      return { kind: "continue" };

    case "content_block_stop": {
      const index = parsed.index ?? 0;
      const tc = state.toolCallsInProgress.get(index);
      if (!tc) return { kind: "continue" };

      let parsedInput: Record<string, unknown> = {};
      try {
        if (tc.inputJson) {
          parsedInput = JSON.parse(tc.inputJson) as Record<string, unknown>;
        }
      } catch (err) {
        console.error(
          `[chatApi] Failed to parse tool input JSON for tool ${tc.name} (${tc.id}):`,
          err,
          "raw:",
          tc.inputJson,
        );
      }

      const toolCall: ToolCall = {
        id: tc.id,
        name: tc.name,
        input: parsedInput,
      };

      options.onToolUse?.(toolCall);
      options.onChunk({
        content: "",
        done: false,
        model_used: state.modelUsed,
        tool_use: toolCall,
      });

      state.toolCallsInProgress.delete(index);
      return { kind: "continue" };
    }

    case "message_delta":
      state.outputTokens = parsed.usage?.outputTokens || 0;
      if (parsed.delta?.stopReason === "tool_use") {
        options.onChunk({
          content: "",
          done: true,
          stop_reason: "tool_use",
          usage: {
            input_tokens: state.inputTokens,
            output_tokens: state.outputTokens,
            total_cost: "0.00",
          },
          model_used: state.modelUsed,
        });
        return { kind: "stop-tool-use" };
      }
      return { kind: "continue" };

    case "message_stop":
      options.onChunk({
        content: "",
        done: true,
        finish_reason: "stop",
        stop_reason: "end_turn",
        usage: {
          input_tokens: state.inputTokens,
          output_tokens: state.outputTokens,
          total_cost: "0.00",
        },
        model_used: state.modelUsed,
      });
      return { kind: "stop-end-turn" };

    case "tool_step":
      // A matter-scoped server tool just ran. Surface it so the UI can
      // render "✓ <summary>" and refresh the views the tool mutated.
      options.onToolStep?.({
        toolName: parsed.tool_name ?? "",
        summary: parsed.summary ?? "",
        citations: parsed.citations,
      });
      return { kind: "continue" };

    case "chat_context":
    default:
      return { kind: "continue" };
  }
}

// ============================================================================
// Public: startChatStream
// ============================================================================

/**
 * Stream a chat response from `POST /api/chats/{id}/responses` using
 * Anthropic-style SSE events. The chat row must exist before this
 * call — callers create it via `POST /api/chats` if needed.
 *
 * High-level flow:
 *   1. (Tool continuation only) Pre-flight `POST /api/chats/{id}/messages`
 *      for each `tool_results` entry so the durable history is
 *      extended before model invocation.
 *   2. POST the snake_case responses body, honouring `signal` for
 *      abort.
 *   3. If non-2xx, delegate to `handleStreamErrorResponse`.
 *   4. Otherwise, read SSE frames line-by-line, parse `data: `
 *      payloads, and dispatch each one through `dispatchStreamEvent`.
 *   5. Release the reader in `finally` regardless of exit path.
 *
 * Exposed as a standalone function (not a method) so the stream state
 * machine can be unit-tested without instantiating `ChatApiClient`.
 * `ChatApiClient.startChatStream` is a thin wrapper that just forwards here.
 */
export async function startChatStream(
  baseUrl: string,
  options: StartChatStreamOptions,
): Promise<void> {
  const { request, onChunk, onError, onComplete, onToolUse, onToolStep, signal } =
    options;

  const chatId = request.chat_id;
  if (!chatId) {
    onError(
      "startChatStream: chat_id is required (callers must create the chat first via POST /api/chats)",
    );
    return;
  }

  const isToolContinuation =
    !!request.tool_results && request.tool_results.length > 0;

  chatBreadcrumb("stream: POST /chats/{id}/responses start", "info", {
    chatId,
    model: request.model,
    hasTools: !!request.tools?.length,
    isToolContinuation,
  });

  if (isToolContinuation) {
    try {
      await appendToolResultMessages(baseUrl, chatId, request.tool_results!);
    } catch (err) {
      console.error(
        "[chatApi] tool_result pre-flight to /messages failed:",
        err,
      );
      onError(
        err instanceof Error
          ? err.message
          : "Failed to append tool result before continuation",
      );
      return;
    }
  }

  const csrf = authService.getCsrfToken();
  const response = await fetch(`${baseUrl}/chats/${chatId}/responses`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf !== null ? { "X-CSRF-Token": csrf } : {}),
      // No `Idempotency-Key` — `POST /api/chats/{id}/responses` runs the
      // model and streams the result; replays would either re-stream
      // cached bytes (unsafe — the assistant turn may already be
      // partially persisted) or hit service-level idempotency dedupe
      // (which requires a deliberate caller-supplied key, not a
      // transparent retry). The caller bubbles aborts to the user.
    },
    body: JSON.stringify(toResponsesRequest(request, { isToolContinuation })),
    signal,
  });

  chatBreadcrumb("stream: response headers received", "info", {
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    await handleStreamErrorResponse(response, options);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    chatBreadcrumb("stream: response body had no reader", "error");
    onError("No reader available");
    return;
  }

  const decoder = new TextDecoder();
  const state = createChatStreamState();
  let buffer = "";
  let currentEventType = "";
  let firstEventLogged = false;

  // Best-effort connection cleanup. We may exit the read loop on any of:
  // normal `done`, end-turn, tool-use stop, server error, handler exception,
  // or fetch abort. In every case we want to release the underlying HTTP
  // connection — the alternative is leaking the socket until GC.
  //
  // `reader.cancel()` is idempotent and safe after `done`. We catch-and-warn
  // on its rejection because the only way it can throw is if the stream is
  // already closed, which is exactly what we want — but we still log rather
  // than silently swallow.
  const releaseReader = () => {
    reader.cancel().catch((err) => {
      console.warn(
        "[chatApi] reader.cancel() rejected (already closed?):",
        err,
      );
    });
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        onComplete();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("event: ")) {
          currentEventType = trimmed.slice(7);
          continue;
        }

        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        let parsed: ChatStreamEvent;
        try {
          parsed = JSON.parse(data) as ChatStreamEvent;
        } catch (err) {
          console.error(
            "[chatApi] Failed to parse SSE data line, skipping:",
            err,
            "raw:",
            data,
          );
          continue;
        }

        if (!firstEventLogged) {
          firstEventLogged = true;
          chatBreadcrumb("stream: first SSE event received", "info", {
            type: parsed.type,
          });
        }

        let result: EventDispatchResult;
        try {
          result = dispatchStreamEvent(parsed, currentEventType, state, {
            onChunk,
            onToolUse,
            onToolStep,
          });
        } catch (err) {
          console.error(
            "[chatApi] Error while handling parsed SSE event:",
            err,
            "event:",
            parsed,
          );
          onError(
            err instanceof Error
              ? `Stream handler error: ${err.message}`
              : "Stream handler error",
          );
          return;
        }

        // Exhaustive switch — TypeScript will fail compilation if a new
        // EventDispatchResult kind is added without handling it here.
        switch (result.kind) {
          case "continue":
            break;
          case "stop-error":
            chatBreadcrumb("stream: stop-error", "error", {
              message: result.message,
            });
            onError(result.message);
            return;
          case "stop-end-turn":
            chatBreadcrumb("stream: stop-end-turn (success)", "info", {
              inputTokens: state.inputTokens,
              outputTokens: state.outputTokens,
            });
            onComplete();
            return;
          case "stop-tool-use":
            // Caller is responsible for executing tools and continuing the
            // conversation; we deliberately do NOT call onComplete here.
            chatBreadcrumb(
              "stream: stop-tool-use (waiting for tool results)",
              "info",
              {
                pendingToolCalls: state.toolCallsInProgress.size,
              },
            );
            return;
          default: {
            const exhaustiveCheck: never = result;
            throw new Error(
              `Unhandled EventDispatchResult: ${JSON.stringify(exhaustiveCheck)}`,
            );
          }
        }
      }
    }
  } catch (err) {
    if (isAbortError(err)) {
      chatBreadcrumb("stream: aborted by client", "info");
      console.warn("[chatApi] Stream aborted by client");
      onComplete();
      return;
    }
    chatBreadcrumb("stream: read loop crashed", "error", {
      error: err instanceof Error ? err.message : String(err),
    });
    console.error("[chatApi] Stream read failed:", err);
    onError(
      err instanceof Error
        ? `Stream connection error: ${err.message}`
        : "Stream connection error",
    );
  } finally {
    releaseReader();
  }
}
