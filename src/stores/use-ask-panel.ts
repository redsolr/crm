import { create } from "zustand";
import {
  askReducer,
  initialAskState,
  type AskConversationState,
  type AskEvent,
} from "@/lib/sales/ask-messages";

/**
 * Open/closed state + session conversation for the CRM "Ask" chat.
 *
 * Lives in a store (not component state) so EVERY entry point — the
 * per-view header icon (`AskHeaderButton`), the Ctrl/Cmd+J hotkey, and
 * the full-page `/sales/ask` view — drives the same conversation, and
 * the transcript survives closing/reopening the drawer and moving
 * between the drawer and the page within a session. `chatId` is the
 * lazily-created backend conversation (POST /api/chats on first send);
 * `startNewConversation` aborts any in-flight stream and starts fresh.
 *
 * The active stream's AbortController ALSO lives here (not in a
 * component ref): the drawer and the page are separate mounts of
 * `AskConversation`, and a reply started in one must remain stoppable
 * from the other after the first mount unmounts.
 *
 * All message-list mutations flow through the pure `askReducer`
 * (src/lib/sales/ask-messages.ts) via `dispatchConversation`.
 */
interface AskPanelState {
  isOpen: boolean;
  chatId: string | null;
  conversation: AskConversationState;
  /** AbortController for the in-flight stream, null when idle. */
  streamAbort: AbortController | null;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setChatId: (chatId: string) => void;
  dispatchConversation: (event: AskEvent) => void;
  setStreamAbort: (controller: AbortController | null) => void;
  /** Abort the in-flight stream (the Stop button). Safe when idle. */
  stopStream: () => void;
  /** Abort any in-flight stream and reset to a fresh conversation. */
  startNewConversation: () => void;
}

export const useAskPanel = create<AskPanelState>((set, get) => ({
  isOpen: false,
  chatId: null,
  conversation: initialAskState,
  streamAbort: null,

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  setChatId: (chatId) => set({ chatId }),
  dispatchConversation: (event) =>
    set((s) => ({ conversation: askReducer(s.conversation, event) })),
  setStreamAbort: (streamAbort) => set({ streamAbort }),
  stopStream: () => {
    get().streamAbort?.abort();
  },
  startNewConversation: () => {
    get().streamAbort?.abort();
    set({ chatId: null, conversation: initialAskState, streamAbort: null });
  },
}));
