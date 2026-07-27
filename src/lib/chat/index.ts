/**
 * Public barrel for the chat API.
 *
 * External code should import from `@/lib/chatApi` (which is a one-line
 * shim that re-exports this barrel). Internal modules inside this folder
 * should import from their sibling files directly, NOT from this index,
 * to avoid circular imports.
 *
 * Layout:
 *   - `breadcrumbs.ts` — Sentry breadcrumb helper (internal)
 *   - `schemas.ts`     — Zod runtime contracts + derived RESPONSE types
 *   - `types.ts`       — pure REQUEST types + frontend UI state types
 *   - `stream.ts`      — SSE state machine (internal to the class)
 *   - `client.ts`      — `ChatApiClient` class + `chatApiClient` singleton
 *                        + `getChatHistory` standalone
 *   - `permissions.ts` — `useChatPermissions` hook + pure helpers
 */

// --- Runtime values ---
export { chatApiClient, ChatApiClient, getChatHistory } from "./client";
export {
  useChatPermissions,
  getModelFallback,
  formatUsageWarning,
} from "./permissions";

// --- Response types (Zod-derived, runtime-validated) ---
//
// Every type here has a matching backend DTO class in
// `platform/src/modules/chat-completion/chat.response.dto.ts`. Keep in sync.
export type {
  ChatPermission,
  ChatResponse,
  ChatMessageResponse,
  ChatWithMessagesResponse,
  ChatHistoryResponse,
  CreateBranchResponse,
  BranchInfo,
  BranchTreeNode,
} from "./schemas";

// --- Request types + frontend UI state ---
export type {
  ChatMessage,
  ChatRequest,
  ChatStreamChunk,
  CreateChatInFolderRequest,
  MoveChatToFolderRequest,
  UpdateChatRequest,
  CreateBranchRequest,
  ToolDefinition,
  ToolCall,
  ToolResult,
  ChatToolStep,
  StartChatStreamOptions,
  ByokCredentialMissingInfo,
  UsageLimitInfo,
} from "./types";

// --- Backwards-compat re-exports from other domain clients ---
// These used to live in the old `chatApi.ts` for historical reasons — they
// belong elsewhere long-term but keeping them here avoids touching every
// importer.
export {
  findingsApiClient,
  type FindingSource,
  type CreateFindingRequest,
  type Finding,
  type FindingsListResponse,
  type FindingsTrashResponse,
  type UpdateFindingRequest,
  type FindingsApiError,
} from "../findingsApi";

export {
  findingSetsApiClient,
  type FindingSet,
  type CreateFindingSetRequest,
  type UpdateFindingSetRequest,
  type FindingSetsListResponse,
  type FindingSetWithFindings,
} from "../findingSetsApi";
