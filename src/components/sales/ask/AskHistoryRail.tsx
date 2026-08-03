"use client";

/**
 * Conversation-history rail for the /sales/ask page — the ChatGPT
 * shape: "New chat" on top, then every persisted conversation newest-
 * activity-first. Opening one loads its transcript into the shared
 * `useAskPanel` store (so the drawer and the page keep showing the
 * same conversation); the hover ✕ deletes it.
 *
 * Wire: `GET /api/chats/history` (list) · `GET /api/chats/:id/messages`
 * (open) · `DELETE /api/chats/:id` — all platform-era client contracts
 * the standalone backend now serves.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chatApiClient, getChatHistory } from "@/lib/chat/client";
import type { ChatResponse } from "@/lib/chat/schemas";
import { toAskTranscript } from "@/lib/sales/ask-messages";
import { timeAgo } from "@/lib/sales/relative-time";
import { useAskPanel } from "@/stores/use-ask-panel";
import { queryKeys } from "@/queries/query-keys";
import { NewConversationIcon } from "./AskConversation";

export function AskHistoryRail() {
  const queryClient = useQueryClient();
  const activeChatId = useAskPanel((s) => s.chatId);
  const hydrateConversation = useAskPanel((s) => s.hydrateConversation);
  const startNewConversation = useAskPanel((s) => s.startNewConversation);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const history = useQuery({
    queryKey: queryKeys.chats.history({}),
    queryFn: () => getChatHistory(),
  });
  const chats = history.data?.chats ?? [];

  async function openChat(chat: ChatResponse) {
    if (chat.id === activeChatId || openingId !== null) return;
    setOpeningId(chat.id);
    try {
      const loaded = await chatApiClient.getChatMessages(chat.id);
      hydrateConversation(chat.id, toAskTranscript(loaded.messages));
    } catch (err) {
      console.error("[AskHistoryRail] failed to load chat", chat.id, err);
    } finally {
      setOpeningId(null);
    }
  }

  async function removeChat(chat: ChatResponse) {
    try {
      await chatApiClient.deleteChat(chat.id);
    } catch (err) {
      console.error("[AskHistoryRail] failed to delete chat", chat.id, err);
      return;
    }
    if (chat.id === useAskPanel.getState().chatId) {
      startNewConversation();
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
  }

  return (
    <aside
      // Desktop-only for now: on phones the transcript takes the full
      // width; history returns via the drawer/palette when the mobile
      // arc grows a history affordance.
      className="ask-history-rail hidden md:flex w-[230px] flex-shrink-0 min-h-0 flex-col border-r border-[var(--theme-border-primary)]"
      data-testid="ask-history-rail"
      aria-label="Chat history"
    >
      <div className="ask-history-header flex-shrink-0 p-2">
        <button
          type="button"
          onClick={startNewConversation}
          data-testid="ask-history-new"
          className="ask-history-new w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-tertiary)] text-[13px] text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-hover)] transition-colors"
        >
          <NewConversationIcon />
          New chat
        </button>
      </div>

      <div className="ask-history-list flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        {history.isError && (
          <p className="ask-history-error px-2 py-2 text-[12px] text-[var(--theme-text-muted)]">
            Couldn&apos;t load chat history.
          </p>
        )}
        {history.isSuccess && chats.length === 0 && (
          <p
            className="ask-history-empty px-2 py-2 text-[12px] text-[var(--theme-text-muted)]"
            data-testid="ask-history-empty"
          >
            Past chats appear here.
          </p>
        )}
        <ul className="ask-history-items flex flex-col gap-0.5">
          {chats.map((chat) => {
            const active = chat.id === activeChatId;
            return (
              <li key={chat.id} className="ask-history-row group relative">
                <button
                  type="button"
                  onClick={() => void openChat(chat)}
                  data-testid="ask-history-item"
                  data-chat-id={chat.id}
                  data-active={active ? "true" : undefined}
                  className={`ask-history-item w-full text-left pl-2.5 pr-7 py-1.5 rounded-lg transition-colors ${
                    active
                      ? "bg-[var(--theme-bg-active)]"
                      : "hover:bg-[var(--theme-bg-hover)]"
                  } ${openingId === chat.id ? "opacity-60" : ""}`}
                >
                  <span
                    className={`ask-history-title block truncate text-[13px] ${
                      active
                        ? "text-[var(--theme-text-primary)]"
                        : "text-[var(--theme-text-secondary)]"
                    }`}
                  >
                    {chat.title ?? "New conversation"}
                  </span>
                  <span className="ask-history-time block text-[11px] text-[var(--theme-text-muted)]">
                    {timeAgo(chat.updated_at)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void removeChat(chat)}
                  title="Delete chat"
                  data-testid="ask-history-delete"
                  className="ask-history-delete absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 hidden group-hover:flex items-center justify-center rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-hover)]"
                >
                  <CrossIcon />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

function CrossIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
