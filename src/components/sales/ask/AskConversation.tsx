"use client";

/**
 * `AskConversation` — the shared chat internals of the CRM "Ask"
 * surface: message list + streaming display + empty-state suggestions +
 * composer + the send/stream/abort wiring against `useAskPanel`.
 *
 * Two mounts share this component (and the store, so the transcript
 * carries between them):
 *   - the right-hand drawer (`AskPanel` is the shell around it), and
 *   - the full-page `/sales/ask` view (`SalesAskView`).
 *
 * Wire contract (unchanged from the original drawer implementation):
 *   - POST /api/chats                 — lazy conversation create on first send
 *   - POST /api/chats/{id}/responses  — Anthropic-style SSE streaming
 * Both ride `chatApiClient`, so every call carries the CRM workspace via
 * the `Jurisimus-Workspace-Id` override.
 *
 * Page context: when mounted in the drawer, `pageContext` is the
 * descriptor of the view under the drawer ("Deal record: …"). It is
 * captured at SEND time and prepended to the wire text via
 * `buildAskWireText` — the transcript bubble shows only the user's own
 * words. The full-page view passes null (no framing).
 *
 * The active stream's AbortController lives in the STORE, not a local
 * ref — a reply started in the drawer must remain stoppable from the
 * page after the drawer unmounts (and vice versa). Unmounting never
 * aborts; only Stop and "new conversation" do.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/stores/use-auth";
import { useAskPanel } from "@/stores/use-ask-panel";
import { chatApiClient } from "@/lib/chat/client";
import { buildAskWireText } from "@/lib/sales/ask-messages";
import { AskMarkdown } from "./AskMarkdown";
import { queryKeys } from "@/queries/query-keys";

/**
 * Server tools that MUTATE CRM records (vs read-only lookups). When any
 * of these ran during a turn, the pipeline/record queries are stale —
 * invalidated once when the stream settles so the board/table/timeline
 * behind the drawer shows the AI's writes without a manual refresh.
 */
const WRITE_TOOL_NAMES = new Set([
  "create_account",
  "create_opportunity",
  "update_opportunity",
  "log_call_note",
  "create_commitment",
  "complete_commitment",
]);

/**
 * Fixed model for Ask sends. Matches the platform's default chat model
 * (`gpt-5.4-nano` — see `models.store.ts` DEFAULT_MODEL_ID); the Ask
 * surface deliberately has no model picker in this slice.
 */
const ASK_MODEL = "gpt-5.4-nano";

/** Empty-state prompts tuned to a founder-led CRM. */
const ASK_SUGGESTIONS = [
  "Which deals need attention this week?",
  "Summarize everything we know about <company>",
  "Draft a follow-up for my last call",
] as const;

/** Plus glyph — shared by the drawer header and the /sales/ask header. */
export const NewConversationIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SendIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </svg>
);

interface AskConversationProps {
  /**
   * Full page-context descriptor prepended to the wire text at send
   * time (`[Viewing: …]`), or null for no framing (the /sales/ask page,
   * unmapped routes). Display text in the transcript is never affected.
   */
  pageContext: string | null;
}

export function AskConversation({ pageContext }: AskConversationProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // `chatId` and `streamAbort` are deliberately NOT destructured here —
  // sendMessage reads them via `useAskPanel.getState()` at call time so
  // back-to-back sends never see a stale closure value.
  const { conversation, setChatId, dispatchConversation, setStreamAbort } =
    useAskPanel();
  const stopStream = useAskPanel((s) => s.stopStream);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const streaming = conversation.status === "streaming";

  // Focus the composer on mount (drawer open / page load) and again
  // whenever the transcript resets to empty ("new conversation" from
  // either shell's header button).
  const prevCountRef = useRef(conversation.messages.length);
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);
  useEffect(() => {
    if (prevCountRef.current > 0 && conversation.messages.length === 0) {
      textareaRef.current?.focus();
    }
    prevCountRef.current = conversation.messages.length;
  }, [conversation.messages.length]);

  // Keep the newest message in view as tokens stream in.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [conversation.messages]);

  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (
        text === "" ||
        useAskPanel.getState().conversation.status === "streaming"
      ) {
        return;
      }
      const accountId = user?.account_id ?? "";
      const userId = user?.user_id ?? "";
      if (accountId === "") {
        console.error(
          "[AskConversation] cannot send — auth store has no account_id yet",
        );
        dispatchConversation({
          type: "error",
          message: "Still loading your account — try again in a moment.",
        });
        return;
      }

      setDraft("");
      // The transcript stores the user's own words; the wire text below
      // may additionally carry the page-context preamble.
      dispatchConversation({ type: "send", text });
      const wireText = buildAskWireText(pageContext, text);

      // Lazy conversation create on first send; the id lives in the store
      // for the rest of the session ("new conversation" clears it).
      let activeChatId = useAskPanel.getState().chatId;
      if (activeChatId === null) {
        try {
          const chat = await chatApiClient.createChatInFolder({
            account_id: accountId,
            title: text.slice(0, 80),
          });
          activeChatId = chat.id;
          setChatId(chat.id);
          // The /sales/ask history rail lists persisted conversations —
          // a fresh one exists now.
          void queryClient.invalidateQueries({
            queryKey: queryKeys.chats.all,
          });
        } catch (err) {
          console.error(
            "[AskConversation] failed to create Ask conversation:",
            err,
          );
          const message =
            err instanceof Error
              ? err.message
              : "Failed to start the conversation.";
          dispatchConversation({ type: "error", message });
          return;
        }
      }

      const controller = new AbortController();
      setStreamAbort(controller);
      // The workspace agentic loop can mutate CRM records mid-stream;
      // remember whether it did so the views refresh exactly once when
      // the stream settles (complete OR error — a failed final answer
      // doesn't un-create the opportunity).
      let sawWriteTool = false;
      const refreshAfterWrites = () => {
        if (!sawWriteTool) return;
        sawWriteTool = false;
        void queryClient.invalidateQueries({
          queryKey: queryKeys.workItems.all,
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
      };
      try {
        await chatApiClient.startChatStream({
          request: {
            role: "user",
            content: wireText,
            chat_id: activeChatId,
            account_id: accountId,
            user_id: userId,
            model: ASK_MODEL,
          },
          onChunk: (chunk) => {
            if (chunk.content !== "") {
              dispatchConversation({ type: "chunk", text: chunk.content });
            }
          },
          onToolStep: (step) => {
            dispatchConversation({ type: "tool_step", summary: step.summary });
            if (WRITE_TOOL_NAMES.has(step.toolName)) sawWriteTool = true;
          },
          onError: (message) => {
            console.error("[AskConversation] stream error:", message);
            dispatchConversation({ type: "error", message });
          },
          onComplete: () => {
            dispatchConversation({ type: "complete" });
          },
          signal: controller.signal,
        });
      } catch (err) {
        // The stream helper handles SSE-phase errors via callbacks; a
        // throw here means the initial fetch itself failed (network) or
        // was aborted before headers arrived.
        if (err instanceof DOMException && err.name === "AbortError") {
          console.warn(
            "[AskConversation] send aborted before the stream started",
          );
          dispatchConversation({ type: "complete" });
        } else {
          console.error("[AskConversation] stream request failed:", err);
          dispatchConversation({
            type: "error",
            message:
              err instanceof Error ? err.message : "Chat request failed.",
          });
        }
      } finally {
        // Runs on every exit path — completion, stream error, Stop, and
        // pre-stream throws — so writes are never left stale on screen.
        refreshAfterWrites();
        if (useAskPanel.getState().streamAbort === controller) {
          setStreamAbort(null);
        }
      }
    },
    [
      user,
      pageContext,
      dispatchConversation,
      setChatId,
      setStreamAbort,
      queryClient,
    ],
  );

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(draft);
    }
  };

  const showEmptyState =
    conversation.messages.length === 0 && conversation.error === null;

  return (
    <div className="crm-ask-conversation flex-1 min-h-0 flex flex-col">
      {/* ── Messages ── */}
      <div
        className="crm-ask-messages flex-1 overflow-y-auto px-4 py-4"
        data-testid="crm-ask-messages"
      >
        {showEmptyState ? (
          // Centered in the empty viewport (ChatGPT pattern) — a real
          // heading plus tappable suggestion cards; the composer stays
          // anchored at the bottom so nothing jumps on first send.
          <div className="crm-ask-empty h-full flex flex-col justify-center gap-2 pb-10">
            <h2 className="crm-ask-empty-title text-[16px] font-semibold text-[var(--theme-text-primary)]">
              Ask about this workspace
            </h2>
            <p className="text-[13px] text-[var(--theme-text-secondary)] mb-2">
              Ask about your pipeline, companies, and calls — answers ground
              in this workspace&apos;s records.
            </p>
            {ASK_SUGGESTIONS.map((suggestion, i) => (
              <button
                key={suggestion}
                type="button"
                data-testid={`crm-ask-suggestion-${i}`}
                onClick={() => {
                  setDraft(suggestion);
                  textareaRef.current?.focus();
                }}
                className="crm-ask-suggestion w-full text-left px-3.5 py-2.5 text-[13.5px] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] bg-[var(--theme-bg-tertiary)] hover:bg-[var(--theme-bg-hover)] border border-[var(--theme-border-secondary)] hover:border-[var(--theme-border-hover)] rounded-lg transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : (
          <div className="crm-ask-message-list flex flex-col gap-3">
            {conversation.messages.map((message, i) =>
              message.role === "user" ? (
                <div
                  key={i}
                  data-testid="crm-ask-message-user"
                  className="crm-ask-message-user self-end max-w-[85%] px-3.5 py-2 rounded-xl rounded-br-sm bg-[var(--theme-bg-hover)] text-[14px] text-[var(--theme-text-primary)] whitespace-pre-wrap"
                >
                  {message.content}
                </div>
              ) : (
                <div
                  key={i}
                  data-testid="crm-ask-message-assistant"
                  className="crm-ask-message-assistant self-start max-w-full text-[var(--theme-text-primary)]"
                >
                  {message.steps !== undefined && message.steps.length > 0 && (
                    <div className="crm-ask-tool-steps flex flex-col gap-1 mb-1.5">
                      {message.steps.map((step, stepIndex) => (
                        <div
                          key={stepIndex}
                          data-testid="crm-ask-tool-step"
                          className="crm-ask-tool-step flex items-start gap-1.5 text-[12px] text-[var(--theme-text-muted)]"
                        >
                          <span aria-hidden="true">✓</span>
                          <span className="min-w-0">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {message.content === "" && streaming ? (
                    <span className="crm-ask-thinking text-[14px] text-[var(--theme-text-muted)]">
                      {message.steps !== undefined && message.steps.length > 0
                        ? "Working…"
                        : "Thinking…"}
                    </span>
                  ) : (
                    <AskMarkdown content={message.content} />
                  )}
                </div>
              ),
            )}
          </div>
        )}

        {conversation.error !== null && (
          <div
            role="alert"
            data-testid="crm-ask-error"
            className="crm-ask-error mt-3 px-3 py-2 rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] text-[12.5px] text-[var(--theme-text-secondary)]"
          >
            {conversation.error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Composer ── */}
      {/* No separator line above — the elevated box IS the boundary
          (ChatGPT pattern). Surface + outline sit two ladder tiers
          above the page so the input reads as THE object on the page
          (border-ladder rule: hairline steps vanish in a dim room);
          focus-within lifts the outline to the hover tier — a real
          focus ring. */}
      <div className="crm-ask-composer flex-shrink-0 px-3 pb-3 pt-1">
        <div className="crm-ask-composer-box flex items-end gap-2 rounded-xl border border-[var(--theme-border-secondary)] focus-within:border-[var(--theme-border-hover)] bg-[var(--theme-bg-hover)] px-4 py-3 transition-colors">
          <textarea
            ref={textareaRef}
            rows={2}
            value={draft}
            disabled={streaming}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={
              streaming ? "Answering…" : "Ask about your pipeline…"
            }
            data-testid="crm-ask-input"
            aria-label="Ask a question"
            className="crm-ask-textarea flex-1 resize-none bg-transparent text-[14px] text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)] focus:outline-none disabled:opacity-60"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stopStream}
              title="Stop generating"
              data-testid="crm-ask-stop"
              className="crm-ask-stop-button flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-active)] border border-[var(--theme-border-secondary)] transition-colors"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void sendMessage(draft)}
              disabled={draft.trim() === ""}
              title="Send"
              data-testid="crm-ask-send"
              className="crm-ask-send-button flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-active)] border border-[var(--theme-border-secondary)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              <SendIcon />
            </button>
          )}
        </div>
        <p className="crm-ask-hint mt-1.5 px-1 text-[11px] text-[var(--theme-text-muted)]">
          Enter to send · Shift+Enter for a new line · Ctrl/Cmd+J toggles
        </p>
      </div>
    </div>
  );
}
