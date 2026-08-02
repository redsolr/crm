/**
 * Pure conversation-state machine for the CRM "Ask" panel.
 *
 * The AskPanel drives `startChatStream` (src/lib/chat/stream.ts) and
 * translates its callbacks into `AskEvent`s; this module owns how those
 * events fold into the visible message list. Kept free of React, Zustand,
 * and network imports so the whole state machine is unit-testable with
 * plain function calls (see `__tests__/ask-messages.test.ts`).
 *
 * Shape decisions:
 *   - `send` appends BOTH the user message and an empty assistant
 *     placeholder — the streaming bubble exists from the first token's
 *     point of view, so `chunk` events only ever append text.
 *   - `chunk` is ignored unless the state is `streaming` AND the last
 *     message is an assistant bubble — a late chunk arriving after
 *     reset/error can never corrupt the list.
 *   - `complete` / `error` drop a still-empty assistant placeholder
 *     (abort before the first token, or a pre-stream failure) instead of
 *     leaving a hollow bubble behind.
 */

export interface AskMessage {
  role: "user" | "assistant";
  content: string;
  /**
   * Completed server-side tool executions for THIS assistant turn
   * (`tool_step` SSE events from the workspace agentic loop — e.g.
   * "Created opportunity …"). Rendered as "✓ <summary>" lines above the
   * answer text. Live-only: steps are not persisted server-side, so a
   * reloaded conversation shows the final answer without them.
   */
  steps?: string[];
}

export interface AskConversationState {
  messages: AskMessage[];
  status: "idle" | "streaming";
  error: string | null;
}

export type AskEvent =
  | { type: "send"; text: string }
  | { type: "chunk"; text: string }
  | { type: "tool_step"; summary: string }
  | { type: "complete" }
  | { type: "error"; message: string }
  | { type: "reset" };

export const initialAskState: AskConversationState = {
  messages: [],
  status: "idle",
  error: null,
};

/**
 * Map persisted wire messages (`GET /api/chats/:id/messages`) into
 * transcript bubbles — the history-rail reload path. Drops system rows
 * and empty/null content; tool steps are live-only and never persisted,
 * so reloaded assistant turns carry text alone.
 */
export function toAskTranscript(
  messages: ReadonlyArray<{
    role: "user" | "assistant" | "system";
    content: string | null;
  }>,
): AskMessage[] {
  const transcript: AskMessage[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.content === null || message.content === "") continue;
    transcript.push({ role: message.role, content: message.content });
  }
  return transcript;
}

/**
 * Drop a trailing assistant bubble that never received any text — unless
 * it carries tool steps (a run aborted after acting should still show
 * WHAT it did; the steps are real mutations, not partial prose).
 */
function withoutEmptyAssistantTail(messages: AskMessage[]): AskMessage[] {
  const last = messages[messages.length - 1];
  if (
    last &&
    last.role === "assistant" &&
    last.content === "" &&
    (last.steps === undefined || last.steps.length === 0)
  ) {
    return messages.slice(0, -1);
  }
  return messages;
}

export function askReducer(
  state: AskConversationState,
  event: AskEvent,
): AskConversationState {
  switch (event.type) {
    case "send":
      return {
        messages: [
          ...state.messages,
          { role: "user", content: event.text },
          { role: "assistant", content: "" },
        ],
        status: "streaming",
        error: null,
      };

    case "chunk": {
      if (state.status !== "streaming") return state;
      const last = state.messages[state.messages.length - 1];
      if (!last || last.role !== "assistant") return state;
      const messages = state.messages.slice(0, -1);
      messages.push({ ...last, content: last.content + event.text });
      return { ...state, messages };
    }

    case "tool_step": {
      // Same guard discipline as `chunk`: a late step after reset/error
      // can never corrupt the list.
      if (state.status !== "streaming") return state;
      const last = state.messages[state.messages.length - 1];
      if (!last || last.role !== "assistant") return state;
      const messages = state.messages.slice(0, -1);
      messages.push({ ...last, steps: [...(last.steps ?? []), event.summary] });
      return { ...state, messages };
    }

    case "complete":
      if (state.status !== "streaming") return state;
      return {
        ...state,
        messages: withoutEmptyAssistantTail(state.messages),
        status: "idle",
      };

    case "error":
      return {
        messages: withoutEmptyAssistantTail(state.messages),
        status: "idle",
        error: event.message,
      };

    case "reset":
      return initialAskState;
  }
}

/**
 * Compose the text actually sent on the wire for an Ask message.
 *
 * When the drawer is opened over a CRM view, the current page is the
 * conversation's main context — a clearly delimited `[Viewing: …]`
 * preamble is prepended so the model knows what the user is looking at.
 * The backend create-response contract has no first-class per-message
 * context field (`ChatRequest` carries `system_prompt`/`matter_id`/
 * `thread_id`, none of which fit a transient page descriptor), so the
 * preamble rides inside `content`.
 *
 * The transcript NEVER shows the preamble — the reducer stores only the
 * user's own text (`send` event); this function shapes the wire payload
 * at send time. Context is captured when the user hits Enter, not when
 * the drawer opened. `null` context (the full-page /sales/ask view, or
 * an un-mapped route) sends the text untouched.
 */
export function buildAskWireText(
  pageContext: string | null,
  text: string,
): string {
  if (pageContext === null || pageContext === "") return text;
  return `[Viewing: ${pageContext}]\n\n${text}`;
}
