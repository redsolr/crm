"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

/** Extract chat ID from pathname */
function getChatIdFromPath(pathname: string): string | undefined {
  if (pathname.startsWith("/c/")) {
    return pathname.split("/")[2];
  }
  return undefined;
}

interface ChatNavigationState {
  activeChatId: string | undefined;
}

interface ChatNavigationActions {
  navigateToChat: (chatId: string) => void;
  navigateToNewChat: () => void;
  syncFromPathname: (pathname: string) => void;
  setActiveChatId: (chatId: string | undefined) => void;
}

export const useChatNavigationStore = create<
  ChatNavigationState & ChatNavigationActions
>()(
  devtools(
    (set, get) => ({
      activeChatId:
        typeof window !== "undefined"
          ? getChatIdFromPath(window.location.pathname)
          : undefined,

      navigateToChat: (chatId) => {
        if (get().activeChatId === chatId) return;
        window.history.pushState({ chatId }, "", `/c/${chatId}`);
        set({ activeChatId: chatId }, false, "navigateToChat");
      },

      navigateToNewChat: () => {
        if (window.location.pathname !== "/") {
          window.history.pushState({}, "", "/");
        }
        set({ activeChatId: undefined }, false, "navigateToNewChat");
      },

      syncFromPathname: (pathname) => {
        const chatId = getChatIdFromPath(pathname);
        set({ activeChatId: chatId }, false, "syncFromPathname");
      },

      setActiveChatId: (chatId) =>
        set({ activeChatId: chatId }, false, "setActiveChatId"),
    }),
    { name: "ChatNavigationStore" },
  ),
);
