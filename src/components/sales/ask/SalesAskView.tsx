"use client";

/**
 * `/sales/ask` — the FULL-PAGE Ask chat (2026-07-18).
 *
 * Same conversation as the drawer: both surfaces mount
 * `AskConversation` against the same `useAskPanel` store, so the
 * transcript carries over when the user expands the drawer (its header
 * expand button routes here). Opening this page closes the drawer —
 * one chat on screen, never two.
 *
 * Unlike the drawer, the page has NO page-context framing
 * (`pageContext={null}`): the full page IS the conversation, there is
 * no "current view" underneath it to ground on.
 */

import { useEffect } from "react";
import { useAskPanel } from "@/stores/use-ask-panel";
import { AskConversation, NewConversationIcon } from "./AskConversation";

export function SalesAskView() {
  const closePanel = useAskPanel((s) => s.closePanel);
  const startNewConversation = useAskPanel((s) => s.startNewConversation);

  // No double chat: landing on the page dismisses the drawer (it stays
  // mounted in CrmShell and can be re-summoned with Ctrl/Cmd+J).
  useEffect(() => {
    closePanel();
  }, [closePanel]);

  return (
    <div
      className="sales-ask-view flex-1 min-w-0 flex flex-col min-h-0"
      data-testid="sales-ask-view"
    >
      <div className="crm-view-header">
        <h1 className="crm-view-title">Ask</h1>
        <span className="crm-view-meta">grounded in this workspace</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={startNewConversation}
          title="New conversation"
          data-testid="sales-ask-new"
          className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-hover)] rounded-md transition-colors"
        >
          <NewConversationIcon />
        </button>
      </div>

      <div className="sales-ask-body flex-1 min-h-0 flex justify-center overflow-hidden">
        <div className="sales-ask-column w-full max-w-[720px] min-h-0 flex flex-col">
          <AskConversation pageContext={null} />
        </div>
      </div>
    </div>
  );
}
