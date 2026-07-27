/**
 * Shared test constants and data factories for E2E tests.
 *
 * **Critical:** Every factory in this file MUST validate its output through
 * the Zod schemas in `src/lib/chat/schemas.ts`. The schemas mirror the
 * backend DTO classes in
 * `platform/src/modules/chat-completion/chat.response.dto.ts`, which are
 * the single source of truth for the HTTP contract. If a factory produces
 * something that doesn't match, `Schema.parse()` throws at fixture-
 * construction time with a precise field-path error.
 *
 * **Why this matters:** The previous generation of these factories was
 * hand-typed against vague "what the test author thought the backend
 * returned" assumptions — and got it wrong multiple times. Both the
 * `bodyRedacted` vs `content` drift and the `remaining_tokens` vs
 * `remaining_cents` drift were invisible to CI because the mock and the
 * production code were both wrong in the same direction, so the test
 * round-tripped successfully. Schema-validated fixtures make that failure
 * mode impossible: both production and mock go through the same
 * `Schema.parse()`, so drift between them is structurally prevented.
 *
 * **Pattern when adding a new factory:**
 *   1. Find or add the matching Zod schema in `src/lib/chat/schemas.ts`.
 *   2. Build the response object inline.
 *   3. Pass it through `Schema.parse(input)` and return the result.
 *   4. If the schema rejects, the fix is in either the schema (if the
 *      backend actually changed) or the factory (if it lied) — never in
 *      `parse()` itself.
 *
 * Type: TEST_USER matches AuthUser from src/stores/auth.store.ts
 */

import {
  ChatMessageResponseSchema,
  ChatPermissionSchema,
  ChatResponseSchema,
  ChatWithMessagesResponseSchema,
} from "../../src/lib/chat/schemas";
import type { AuthUser } from "../../src/stores/auth.store";

/**
 * Wire shape for a single chat (mirrors backend `ChatResponseDto` exactly).
 * This is what the platform actually serialises onto the wire — snake_case
 * keys, no transformation. The FE's `ChatResponseSchema` then `parse()`s
 * this into a camelCase consumer shape.
 *
 * Factories below build values of these wire types and validate them with
 * `Schema.parse(...)` (validation only — the parsed/transformed result is
 * thrown away). Mocks serialize the wire value back onto the network so
 * the FE's response parse runs against an authentic shape.
 */
export interface ChatWireResponse {
  id: string;
  title: string | null;
  page_id: string | null;
  findings_count: number;
  parent_chat_id: string | null;
  branched_from_message_id: string | null;
  branch_name: string | null;
  starred: boolean;
  ephemeral: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageWireResponse {
  id: string;
  chat_id: string | null;
  role: "user" | "assistant" | "system";
  content: string | null;
  created_at: string;
}

export interface ChatWithMessagesWireResponse {
  chat: ChatWireResponse;
  messages: ChatMessageWireResponse[];
}

export interface ChatPermissionWireResponse {
  allowed: boolean;
  reason?: string | undefined;
  selected_model: string;
  estimated_cost: string;
  remaining_cents: number;
  usage_percentage: number;
  fallback_used: boolean;
  warning_message?: string | undefined;
  cooldown_info?:
    | {
        model_on_cooldown: string;
        cooldown_until: string;
        hours_remaining: number;
        window_resets_at: string;
      }
    | undefined;
}

export const TEST_USER: AuthUser = {
  user_id: "test-user-e2e-001",
  email: "e2e-test@jurisimus.com",
  full_name: "E2E Test User",
  avatar_url: undefined,
  account_id: "test-account-e2e-001",
  organization_id: "test-org-e2e-001",
  organization_name: "E2E Test Account",
  role: "owner",
  roles: ["owner"],
  permissions: [
    "chat:create",
    "chat:read",
    "chat:update",
    "chat:delete",
    "llm:complete",
    "llm:stream",
  ],
  subscription: {
    plan_type: "team",
    status: "active",
    current_period_end: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    usage: {
      chats_used: 15,
      chats_limit: 1000,
      tokens_used: 50000,
      tokens_limit: 1000000,
    },
  },
};

export const TEST_TOKEN = "e2e-test-jwt-token-for-playwright";

/**
 * Backend host — matches `src/lib/api-base.ts` `API_BASE`. Use this
 * directly for routes the platform excludes from the `/v1/` prefix
 * (per `platform/src/main.ts`: `/auth/*`, `/oauth/*`, `/.well-known/*`,
 * `/mcp/*`, `/payments/webhooks/*`, `/subscriptions/webhook/*`,
 * `/collaboration`, `/health`, `/health/*`). Every other endpoint
 * lives under `/v1/` — use `API_V1` for those.
 */
export const API_BASE = "http://localhost:8080";

/**
 * Versioned API root. Mirrors `src/lib/api-base.ts` `API_V1`. Every
 * mock that intercepts a platform API call MUST use this (or include
 * `/v1/` in the literal path); the FE's `BaseApiClient.baseUrl` is
 * `${API_BASE}/v1` and Playwright's `page.route` is glob-matched, so
 * a pattern missing the `/v1` segment silently never intercepts.
 */
export const API_V1 = `${API_BASE}/v1`;

// ============================================================================
// Schema-validated factory functions
// ============================================================================

/**
 * Build a `POST /chat` (or any other `ChatResponseDto`-returning endpoint)
 * response. Matches the tight public DTO — NO tenantId, accountId, userId,
 * workspaceId, deletedAt, or extractionStatus.
 */
export function createChatResponse(
  overrides: Partial<{
    id: string;
    title: string | null;
    pageId: string | null;
    parentChatId: string | null;
    branchedFromMessageId: string | null;
    branchName: string | null;
    starred: boolean;
    ephemeral: boolean;
    findingsCount: number;
  }> = {},
): ChatWireResponse {
  const now = new Date().toISOString();
  // Build the snake_case wire shape. The Schema is run to validate the
  // shape is parseable — but we discard the parsed (camelCase) result and
  // return the wire object, because mocks need to emit what the platform
  // emits (the FE then re-parses the wire shape via the same Schema).
  const wire: ChatWireResponse = {
    id: overrides.id ?? `chat-${Date.now()}`,
    title: overrides.title ?? null,
    page_id: overrides.pageId ?? null,
    findings_count: overrides.findingsCount ?? 0,
    parent_chat_id: overrides.parentChatId ?? null,
    branched_from_message_id: overrides.branchedFromMessageId ?? null,
    branch_name: overrides.branchName ?? null,
    starred: overrides.starred ?? false,
    ephemeral: overrides.ephemeral ?? false,
    created_at: now,
    updated_at: now,
  };
  ChatResponseSchema.parse(wire);
  return wire;
}

/**
 * Build a `POST /accounts/:id/usage/validate` response.
 *
 * Note: the real field is `remaining_cents` (the backend tracks credit
 * budget in cents, not raw tokens). The previous version of this factory
 * had `remaining_tokens: 9000` — a field that never existed on the
 * backend, hidden by the absence of a schema parse.
 */
export function createUsageValidationResponse(
  overrides: Partial<{
    allowed: boolean;
    reason: string | undefined;
    selected_model: string;
    usage_percentage: number;
    warning_message: string | undefined;
  }> = {},
): ChatPermissionWireResponse {
  // `ChatPermissionSchema` is a pure pass-through (no transform), so parse
  // output and wire input are identical. We still parse() to validate.
  const wire: ChatPermissionWireResponse = {
    allowed: overrides.allowed ?? true,
    reason: overrides.reason,
    selected_model: overrides.selected_model ?? "gpt-5-nano",
    estimated_cost: "0.001",
    remaining_cents: 90_000,
    usage_percentage: overrides.usage_percentage ?? 15,
    fallback_used: false,
    warning_message: overrides.warning_message,
    cooldown_info: undefined,
  };
  ChatPermissionSchema.parse(wire);
  return wire;
}

/**
 * Build a single `ChatMessageResponse`. Uses the real backend column name
 * `content` — NOT `bodyRedacted`, which stopped existing in a previous
 * migration and is exactly the bug this schema-bound builder exists to
 * prevent recurring.
 */
export function createChatMessage(
  chatId: string,
  overrides: Partial<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string | null;
    createdAt: string;
  }> = {},
): ChatMessageWireResponse {
  const wire: ChatMessageWireResponse = {
    id: overrides.id ?? `msg-${chatId}-${Date.now()}`,
    chat_id: chatId,
    role: overrides.role ?? "user",
    content: overrides.content ?? "",
    created_at: overrides.createdAt ?? new Date().toISOString(),
  };
  ChatMessageResponseSchema.parse(wire);
  return wire;
}

/**
 * Build a `GET /chat/:id/messages` response — `{ chat, messages }`.
 */
export function createChatMessagesResponse(
  chatId: string,
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [],
): ChatWithMessagesWireResponse {
  // Compose two wire shapes; `ChatWithMessagesResponseSchema` validates that
  // both inner snake_case shapes are parseable. The returned value remains
  // the wire shape — the FE re-parses it on receipt to get its camelCase
  // consumer object.
  const wire: ChatWithMessagesWireResponse = {
    chat: {
      id: chatId,
      title: "Test Chat",
      page_id: null,
      findings_count: 0,
      parent_chat_id: null,
      branched_from_message_id: null,
      branch_name: null,
      starred: false,
      ephemeral: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    messages: messages.map((msg, i) => ({
      id: `msg-${chatId}-${i}`,
      chat_id: chatId,
      role: msg.role,
      content: msg.content,
      created_at: new Date(
        Date.now() - (messages.length - i) * 60000,
      ).toISOString(),
    })),
  };
  ChatWithMessagesResponseSchema.parse(wire);
  return wire;
}
