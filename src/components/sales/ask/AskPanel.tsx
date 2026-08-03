"use client";

/**
 * "Ask" — the CRM's Attio-class AI chat DRAWER (2026-07-18).
 *
 * This file is the drawer SHELL only: portal over `.crm-main` (same
 * portal/outside-click/Escape contract as `SalesPeekPanel`), the global
 * Ctrl/Cmd+J hotkey, and the header (title + page-context chip + new
 * conversation + expand-to-page + close). The chat itself — message
 * list, streaming, composer, send wiring — is the shared
 * `AskConversation`, which the full-page `/sales/ask` view
 * (`SalesAskView`) also mounts against the same `useAskPanel` store, so
 * the transcript carries between drawer and page.
 *
 * Page context: the drawer treats the CURRENT view as the
 * conversation's main context. `usePageContext` derives a descriptor
 * from the pathname + cached record queries; the header shows it as a
 * chip and `AskConversation` prepends it to the wire text at send time.
 *
 * Entry points: the per-view header icon (`AskHeaderButton`, rightmost
 * in each `crm-view-header`) and the hotkey — both toggle the store.
 * The expand button routes to `/sales/ask` and closes the drawer.
 *
 * Closing the drawer does NOT abort an in-flight stream — the reply
 * keeps accumulating in the store and is waiting when the drawer (or
 * the page) shows it next. Only Stop and "new conversation" abort.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAskPanel } from "@/stores/use-ask-panel";
import { AskConversation, NewConversationIcon } from "./AskConversation";
import { usePageContext } from "./use-page-context";

/** CrmShell's content column — portal target + dismiss region. */
const MAIN_AREA_SELECTOR = ".crm-main";

const CloseIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ExpandIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Maximize — diagonal arrows to the corners (peek-panel parity). */}
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

export function AskPanel() {
  const router = useRouter();
  const { isOpen, closePanel, togglePanel, startNewConversation } =
    useAskPanel();
  const pageContext = usePageContext();

  const panelRef = useRef<HTMLDivElement>(null);

  // Global hotkey — Ctrl/Cmd+J toggles the drawer from anywhere in the
  // shell (this component is always mounted alongside CommandPalette;
  // on /sales/ask it simply opens the drawer too — same conversation).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        togglePanel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePanel]);

  // Portal target resolved when the drawer opens — `.crm-main` is
  // committed by then (this component mounts in the same shell render
  // as the content column, so a first-render querySelector would miss).
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    setPortalTarget(document.querySelector<HTMLElement>(MAIN_AREA_SELECTOR));
  }, [isOpen]);

  // Dismiss on clicks in the content area outside the drawer (sidebar is
  // a sibling) and on Escape. Same contract as SalesPeekPanel. Closing
  // does NOT abort the stream.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const panel = panelRef.current;
      if (!panel || panel.contains(e.target as Node)) return;
      const main = panel.closest(MAIN_AREA_SELECTOR);
      if (main && main.contains(e.target as Node)) closePanel();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, closePanel]);

  // Expand — promote the drawer to the full-page chat at /sales/ask
  // (same store, same transcript). Mirrors the peek panel's affordance.
  const handleExpand = useCallback(() => {
    closePanel();
    router.push("/sales/ask");
  }, [closePanel, router]);

  if (!isOpen || portalTarget === null) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Ask AI"
      className="crm-ask-panel absolute right-0 top-0 bottom-0 z-30 w-full md:w-[37%] md:min-w-[380px] md:max-w-[560px] flex flex-col bg-[var(--theme-bg-secondary)] border-l border-[var(--theme-border-secondary)] shadow-[-12px_0_32px_rgba(0,0,0,0.4)]"
      data-testid="crm-ask-panel"
    >
      {/* ── Header ── */}
      <div className="crm-ask-header flex items-center gap-1 px-3 h-12 border-b border-[var(--theme-border-primary)] flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-text-muted)]">
          Ask
        </span>
        {pageContext !== null ? (
          <span
            className="sales-ask-context-chip ml-1.5 max-w-[160px] truncate px-2 py-0.5 rounded-full border border-[var(--theme-border-primary)] bg-[var(--theme-bg-tertiary)] text-[11px] text-[var(--theme-text-secondary)]"
            data-testid="sales-ask-context"
            title={`Conversation context (captured when you send): ${pageContext.label}`}
          >
            Context: {pageContext.chip}
          </span>
        ) : (
          <span className="text-[12px] text-[var(--theme-text-muted)] ml-1">
            — grounded in this workspace
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={startNewConversation}
          title="New conversation"
          data-testid="crm-ask-new"
          className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-hover)] rounded-md transition-colors"
        >
          <NewConversationIcon />
        </button>
        <button
          type="button"
          onClick={handleExpand}
          title="Open full view"
          data-testid="sales-ask-expand"
          className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-hover)] rounded-md transition-colors"
        >
          <ExpandIcon />
        </button>
        <div className="w-px h-4 bg-[var(--theme-border-secondary)] mx-0.5" />
        <button
          type="button"
          onClick={closePanel}
          title="Close"
          data-testid="crm-ask-close"
          className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-hover)] rounded-md transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      <AskConversation pageContext={pageContext?.label ?? null} />
    </div>,
    portalTarget,
  );
}
