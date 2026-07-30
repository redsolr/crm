/**
 * Pure type definitions for the chat API — request-side and frontend-only
 * state types. No logic, no imports of anything that has side effects.
 *
 * **What lives here:**
 *   - Request-body shapes the frontend SENDS to the backend
 *     (`ChatRequest`, `CreateChatInFolderRequest`, `UpdateChatRequest`,
 *     `MoveChatToFolderRequest`, `CreateBranchRequest`).
 *   - Frontend-only UI state types (`ChatMessage` — the local React-state
 *     representation of a message, which intentionally differs from the
 *     backend `ChatMessageResponse` because it can hold in-progress
 *     streaming text with `content: ""`).
 *   - Tool-use types that are part of the chat-stream request contract.
 *   - The `StartChatStreamOptions` shape that callers pass to the stream.
 *
 * **What does NOT live here:** response types. Every shape the frontend
 * RECEIVES is derived from a Zod schema in `./schemas.ts`, which mirrors
 * the backend DTO in `chat.response.dto.ts`. If you need a response type,
 * import it from `./schemas` (it's `z.infer`-derived).
 *
 * This module imports nothing with a runtime dependency.
 */

// ============================================================================
// Frontend-only UI state
// ============================================================================

/**
 * A message as it lives in the React component state. Intentionally a
 * **different** shape from the backend `ChatMessageResponse` because the
 * UI state holds in-progress streaming text:
 *   - `content` is a (non-nullable) string — the UI concatenates streaming
 *     deltas into it; we coerce `null` → `""` at the boundary.
 *   - `id` and `created_at` are optional — they're absent for placeholder
 *     messages the UI creates before the backend has responded.
 *   - Snake_case (`chat_id`, `created_at`) mirrors the historical frontend
 *     convention that predates the DTO-vs-entity split.
 *
 * If you're working with a freshly-fetched server message, prefer the
 * `ChatMessageResponse` type from `./schemas.ts` instead.
 */
export interface ChatMessage {
  id?: string;
  chat_id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
  /**
   * Server-side tool executions that ran during this assistant turn
   * (matter-scoped agentic chat). Rendered above the message text as
   * "✓ <summary>" — Harvey-style "Thinking States". Live-only: these
   * are streamed during the turn and not persisted, so a reloaded chat
   * shows the final answer without the steps.
   */
  toolSteps?: ChatToolStep[];
}

/**
 * One completed server-side tool execution, surfaced live to the chat UI
 * via the `tool_step` SSE event from `POST /api/chats/{id}/responses` when
 * the chat is matter-scoped (the agentic loop ran a matter tool).
 */
export interface ChatToolStep {
  toolName: string;
  summary: string;
  /**
   * Structured citations the tool grounded on (e.g. `["ป.พ.พ. มาตรา 420"]`),
   * when it returned any (the `search_legal_corpus` step does). Used to anchor
   * a finding captured from a grounded answer to its cited authority rather
   * than storing the raw selection as an ungrounded claim.
   */
  citations?: string[];
}

// ============================================================================
// Request bodies (frontend → backend)
// ============================================================================

export interface ChatRequest {
  role: string;
  content: string;
  id?: string;
  chat_id?: string;
  folder_id?: string;
  account_id: string;
  user_id: string;
  created_at?: string;
  system_prompt?: string;
  model?: string;
  use_rag?: boolean;
  // Tool use support
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | { type: "tool"; name: string };
  tool_results?: ToolResult[];
  ephemeral?: boolean;
  pluginIds?: string[];
  /**
   * Prefixed work_item id (`wi_…`) of the matter this chat is scoped to.
   * When set, the backend runs matter-scoped agent tools (create_task, …)
   * in a server-side loop over this matter and streams `tool_step` events.
   */
  matter_id?: string;
  /**
   * Prefixed communication-thread id (`cth_…`) the chat is grounded in —
   * the Copilot rail. The backend composes a server-owned grounding
   * segment (conversation transcript + linked-matter intake context)
   * ahead of the system prompt and engages the legal tool loop even when
   * no matter is linked yet.
   */
  thread_id?: string;
}

export interface CreateChatInFolderRequest {
  account_id: string;
  folder_id?: string;
  title?: string;
}

export interface MoveChatToFolderRequest {
  folder_id?: string;
}

export interface UpdateChatRequest {
  title?: string;
  folder_id?: string | null;
  starred?: boolean;
  ephemeral?: boolean;
}

export interface CreateBranchRequest {
  messageId: string;
  branchName?: string;
}

// ============================================================================
// Streaming chunk type (the UI receives these from the SSE state machine)
// ============================================================================

export interface ChatStreamChunk {
  content: string;
  finish_reason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_cost: string;
  };
  model_used?: string;
  warning_message?: string;
  done: boolean;
  // Tool use support
  tool_use?: ToolCall;
  stop_reason?: "end_turn" | "tool_use" | "max_tokens";
}

// ============================================================================
// Tool use (document editing)
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// ============================================================================
// Streaming — public options type
// (Internal state types live next to `dispatchStreamEvent` in stream.ts.)
// ============================================================================

/**
 * Options for `startChatStream` / `ChatApiClient.startChatStream`.
 *
 * Named-options form instead of positional args — adding a new callback
 * won't shift positional indices and call sites stay self-documenting.
 */
export interface StartChatStreamOptions {
  request: ChatRequest;
  onChunk: (chunk: ChatStreamChunk) => void;
  onError: (error: string) => void;
  onComplete: () => void;
  onUsageLimitExceeded?: (info: UsageLimitInfo) => void;
  onByokCredentialMissing?: (info: ByokCredentialMissingInfo) => void;
  onToolUse?: (toolCall: ToolCall) => void;
  /**
   * A server-side tool just finished (matter-scoped agentic chat). Fired
   * per `tool_step` SSE event so the UI can render the step and refresh
   * any views the tool mutated.
   */
  onToolStep?: (step: ChatToolStep) => void;
  signal?: AbortSignal;
}

/**
 * Structured view of the backend's 429 `usage_limit_exceeded` error
 * envelope (`UsageGuard` in
 * `platform/src/modules/usage/usage.guard.ts`). `meta.limitType` names
 * which cap bound:
 *
 * - Org-level (firm-wide): a rolling window (`session` 5hr / `weekly`
 *   7d) or the billing-period budget (`hard`). Everyone in the firm is
 *   blocked until it frees up.
 * - Per-member (`*_member`): only the CALLER's personal share of the
 *   corresponding org window/pool is exhausted — colleagues are
 *   unaffected. The backend `message` states the personal-share
 *   framing; the UI surfaces it verbatim and must NOT show firm-wide
 *   alarm copy for these.
 *
 * `meta.resetAt` is when the window frees up (oldest in-window spend
 * ages out) or the period resets — the UI derives "frees up in ~Nh" /
 * "resets in Nd" from it.
 */
export interface UsageLimitInfo {
  limitType:
    | "session"
    | "weekly"
    | "hard"
    | "session_member"
    | "weekly_member"
    | "monthly_member";
  resetAt: string | null;
  message: string;
}

/**
 * True when the 429 bound on the caller's PERSONAL share of an org
 * window/pool (colleagues unaffected) rather than a firm-wide cap.
 */
export function isMemberUsageLimit(info: UsageLimitInfo): boolean {
  return info.limitType.endsWith("_member");
}

/**
 * The 402 NO_BYOK_CREDENTIAL envelope the backend emits when a
 * `usage_mode='byok'` account tries to chat without a key for the
 * effective provider. Fields mirror the backend HttpException body
 * (see `llm-token-reservation.service.ts` and `llm.service.ts`).
 */
export interface ByokCredentialMissingInfo {
  code: "NO_BYOK_CREDENTIAL";
  message: string;
  recoveryHint?: string;
  provider?: "anthropic" | "openai" | string | null;
  settingsPath?: string;
}
