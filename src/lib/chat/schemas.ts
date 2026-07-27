/**
 * Runtime contract schemas for chat API responses.
 *
 * **Mirrors:** `platform/src/modules/chat-completion/chat.response.dto.ts`.
 * Every schema here has a one-to-one correspondence with a backend DTO
 * class in that file — if the backend adds a field, add it here and to
 * the `chat.dto.ts` factory; if the backend removes a field, remove it
 * from both. **Keep in sync by hand.**
 *
 * **Wire convention:** the backend ships JSON with snake_case keys (per
 * `docs/platform/api-discipline.md` § A3). The frontend keeps camelCase
 * for consumers (React/JS ecosystem convention), so each schema below
 * validates the snake_case wire shape and `.transform()`s into a
 * camelCase output. `z.infer<typeof FooSchema>` therefore yields the
 * camelCase shape — call sites stay unchanged.
 *
 * **Why this file exists:** TypeScript interfaces describe what we *expect*
 * the backend to return. They give zero protection at runtime — if the
 * backend renames `content` → `body` tomorrow, the frontend's TS type
 * keeps compiling and the field-access sites silently see `undefined`.
 * This is exactly the bug class that caused:
 *
 *   1. The `bodyRedacted` → `content` drift (one-session migration left
 *      the frontend transform pointing at a field name that didn't exist,
 *      so every historical message rendered as an empty bubble).
 *   2. The `remaining_cents` ↔ `remaining_tokens` drift (frontend type
 *      declared a field that was never in any real response).
 *
 * The fix is **runtime parsing**: every API response goes through a Zod
 * schema, which throws on shape mismatch. The first request with a
 * renamed or missing field surfaces a clear `ZodError` with the exact
 * path and the received payload dumped inline.
 *
 * **Pattern:**
 *   1. Define a Zod schema whose input shape exactly mirrors the backend
 *      DTO's wire JSON (snake_case keys).
 *   2. Chain `.transform(o => ({ camelKey: o.snake_key, ... }))` to map
 *      to the camelCase consumer shape.
 *   3. `export type Foo = z.infer<typeof FooSchema>` so consumers get the
 *      derived TS type — single source of truth for both runtime and types.
 *   4. In the API client, call `parseApiResponse(schema, endpoint, raw)`
 *      instead of casting `as Foo`. Drift fails loudly at parse time.
 *
 * **What this is NOT:** a substitute for OpenAPI codegen. That would be
 * the proper structural fix where the backend's NestJS DTOs are the
 * single source of truth. Zod schemas are the pragmatic incremental
 * alternative: cheap to add per-endpoint, catches the same class of
 * drift bug, replaceable by codegen-derived types when that work happens.
 */

import { z } from "zod";

// ============================================================================
// ChatPermission — POST /organizations/:id/usage/validate
// Backend: src/modules/organizations/organizations.controller.ts validateUsage()
//
// This response is built inline in the controller (not via a *.response.dto.ts
// class) and ships snake_case keys directly. Consumers also read snake_case
// (`permission.selected_model`, `permission.fallback_used`, etc.), so this
// schema is a straight pass-through with no `.transform()`.
// ============================================================================

export const ChatPermissionSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  selected_model: z.string(),
  estimated_cost: z.string(),
  /**
   * Remaining budget in cents — NOT tokens. The previous version of this
   * type had it mistyped as `remaining_tokens` (a field that never existed
   * in any actual backend response).
   */
  remaining_cents: z.number(),
  usage_percentage: z.number(),
  fallback_used: z.boolean(),
  warning_message: z.string().optional(),
  cooldown_info: z
    .object({
      model_on_cooldown: z.string(),
      cooldown_until: z.string(),
      hours_remaining: z.number(),
      window_resets_at: z.string(),
    })
    .optional(),
});

export type ChatPermission = z.infer<typeof ChatPermissionSchema>;

// ============================================================================
// ChatResponseSchema — single chat
//
// Mirrors backend `ChatResponseDto` (chat.response.dto.ts). The backend
// deliberately excludes these internal fields from every chat response:
//   - tenantId, account_id, userId (internal; frontend knows its own ids)
//   - deletedAt (soft-delete plumbing; if the row is returned, it's alive)
//   - extractionStatus (internal analytics pipeline)
//
// If you're tempted to add any of those fields here because "the backend
// sends it", check the backend DTO first — if it's not in the DTO, the
// backend is leaking and needs to be fixed at the source.
//
// Timestamps are ISO strings on the wire (the backend DTO factory calls
// `.toISOString()` explicitly).
// ============================================================================

export const ChatResponseSchema = z
  .object({
    id: z.string(),
    title: z.string().nullable(),
    page_id: z.string().nullable(),
    findings_count: z.number(),
    parent_chat_id: z.string().nullable(),
    branched_from_message_id: z.string().nullable(),
    branch_name: z.string().nullable(),
    starred: z.boolean(),
    ephemeral: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform((o) => ({
    id: o.id,
    title: o.title,
    pageId: o.page_id,
    findingsCount: o.findings_count,
    parentChatId: o.parent_chat_id,
    branchedFromMessageId: o.branched_from_message_id,
    branchName: o.branch_name,
    starred: o.starred,
    ephemeral: o.ephemeral,
    created_at: o.created_at,
    updated_at: o.updated_at,
  }));

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ============================================================================
// ChatMessageResponseSchema — single message
//
// Mirrors backend `ChatMessageResponseDto`. Deliberately excludes:
//   - userId (internal; frontend knows its own user)
//   - tokensPrompt, tokensCompletion (internal billing; end-of-turn usage
//     is surfaced via the /chat/stream SSE `message_delta` event)
//   - deletedAt (soft-delete plumbing)
//
// `content` is nullable because tool-call-only turns have no text body.
// `chatId` is nullable because the DB column is nullable (ghost messages
// from a deleted chat).
// ============================================================================

export const ChatMessageResponseSchema = z
  .object({
    id: z.string(),
    chat_id: z.string().nullable(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().nullable(),
    created_at: z.string(),
  })
  .transform((o) => ({
    id: o.id,
    chatId: o.chat_id,
    role: o.role,
    content: o.content,
    created_at: o.created_at,
  }));

export type ChatMessageResponse = z.infer<typeof ChatMessageResponseSchema>;

// ============================================================================
// ChatWithMessagesResponseSchema — GET /chats/:id/messages
//
// Mirrors backend `ChatWithMessagesResponseDto`. Both inner schemas are
// already transformed to camelCase, so the composed shape is camelCase
// without any extra mapping at this level.
// ============================================================================

export const ChatWithMessagesResponseSchema = z.object({
  chat: ChatResponseSchema,
  messages: z.array(ChatMessageResponseSchema),
});

export type ChatWithMessagesResponse = z.infer<
  typeof ChatWithMessagesResponseSchema
>;

// ============================================================================
// ChatHistoryResponseSchema — GET /chats/history
//
// Mirrors backend `ChatHistoryResponseDto`. The sidebar consumer reads
// only `id`, `title`, `created_at`, `updated_at`, `findingsCount`,
// `parentChatId`, `branchName`, `starred` — but the full `ChatResponseDto`
// shape is the contract, and the extra fields are harmless (they just go
// unused in the sidebar).
// ============================================================================

export const ChatHistoryResponseSchema = z.object({
  chats: z.array(ChatResponseSchema),
  total: z.number(),
  grouped: z.record(z.string(), z.array(ChatResponseSchema)),
});

export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>;

// ============================================================================
// CreateBranchResponseSchema — POST /chats/:chatId/branch
//
// Mirrors backend `CreateBranchResponseDto`. Note that `parentChatId` and
// `branchedFromMessageId` are non-nullable (a branch chat always has
// both); the backend factory narrows at the boundary and throws if the
// service ever returns a branch row without them.
// ============================================================================

export const CreateBranchResponseSchema = z
  .object({
    id: z.string(),
    parent_chat_id: z.string(),
    branched_from_message_id: z.string(),
    branch_name: z.string().nullable(),
    title: z.string().nullable(),
    messages: z.array(ChatMessageResponseSchema),
  })
  .transform((o) => ({
    id: o.id,
    parentChatId: o.parent_chat_id,
    branchedFromMessageId: o.branched_from_message_id,
    branchName: o.branch_name,
    title: o.title,
    messages: o.messages,
  }));

export type CreateBranchResponse = z.infer<typeof CreateBranchResponseSchema>;

// ============================================================================
// BranchInfoSchema — GET /chats/:id/branches and GET /chats/message/:id/branches
//
// Mirrors backend `BranchInfoResponseDto`. The backend already narrows
// this at the SQL layer with a JOIN+GROUP BY projection.
// ============================================================================

export const BranchInfoSchema = z
  .object({
    id: z.string(),
    branch_name: z.string().nullable(),
    branched_from_message_id: z.string().nullable(),
    created_at: z.string(),
    message_count: z.number(),
  })
  .transform((o) => ({
    id: o.id,
    branchName: o.branch_name,
    branchedFromMessageId: o.branched_from_message_id,
    created_at: o.created_at,
    messageCount: o.message_count,
  }));

export const BranchInfoArraySchema = z.array(BranchInfoSchema);

export type BranchInfo = z.infer<typeof BranchInfoSchema>;

// ============================================================================
// BranchTreeNodeSchema — GET /chats/:id/tree
//
// Recursive (self-referential) via `z.lazy()`. Mirrors backend
// `BranchTreeNodeResponseDto`. Wire keys are snake_case; the transform
// emits camelCase, and `z.array(BranchTreeNodeSchema)` recurses through
// the same transform so `branches` is already camelCase by the time the
// outer transform sees it.
// ============================================================================

export interface BranchTreeNode {
  id: string;
  title: string | null;
  branchName: string | null;
  branchedAtMessageIndex: number | null;
  branches: BranchTreeNode[];
}

export const BranchTreeNodeSchema: z.ZodType<BranchTreeNode> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      title: z.string().nullable(),
      branch_name: z.string().nullable(),
      branched_at_message_index: z.number().nullable(),
      branches: z.array(BranchTreeNodeSchema),
    })
    .transform(
      (o): BranchTreeNode => ({
        id: o.id,
        title: o.title,
        branchName: o.branch_name,
        branchedAtMessageIndex: o.branched_at_message_index,
        branches: o.branches,
      }),
    ),
);

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse a value through a Zod schema, throwing a clear "API contract drift"
 * error on failure. The error message names the endpoint and the exact
 * field path that failed validation.
 */
export function parseApiResponse<T>(
  schema: z.ZodType<T>,
  endpoint: string,
  response: unknown,
): T {
  const result = schema.safeParse(response);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `API contract drift on ${endpoint}:\n${issues}\n` +
        `\nThis means the backend response shape no longer matches what the ` +
        `frontend expects. Either the backend DTO (chat.response.dto.ts) ` +
        `changed without updating this schema, or this schema is stale. ` +
        `Check the backend DTO and update accordingly.\n` +
        `\nReceived: ${JSON.stringify(response).slice(0, 500)}`,
    );
  }
  return result.data;
}
