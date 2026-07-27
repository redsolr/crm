"use client";

import { useChatNavigationStore } from "./chat-navigation.store";
import { useShallow } from "zustand/react/shallow";

/**
 * Drop-in replacement for the old useChatNavigation() context hook.
 */
export function useChatNavigation() {
  return useChatNavigationStore(
    useShallow((s) => ({
      activeChatId: s.activeChatId,
      navigateToChat: s.navigateToChat,
      navigateToNewChat: s.navigateToNewChat,
    })),
  );
}
