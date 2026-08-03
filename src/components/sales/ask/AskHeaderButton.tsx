"use client";

/**
 * `AskHeaderButton` — the Ask drawer's entry point (2026-07-18).
 *
 * Now a LABELED "Ask AI" pill living once in the global topbar's right
 * corner (the Attio "Ask Attio" pattern), not a per-view icon — one
 * stable place, every view. Toggles the drawer via `useAskPanel`,
 * exactly like the Ctrl/Cmd+J hotkey.
 */

import { useAskPanel } from "@/stores/use-ask-panel";

/** Sparkle — the Ask glyph. */
const AskSparkleIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M11 4l1.7 4.6L17.3 10.3l-4.6 1.7L11 16.6l-1.7-4.6L4.7 10.3l4.6-1.7L11 4z" />
    <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
  </svg>
);

export function AskHeaderButton() {
  const isOpen = useAskPanel((s) => s.isOpen);
  const togglePanel = useAskPanel((s) => s.togglePanel);

  return (
    <button
      type="button"
      onClick={togglePanel}
      title="Ask AI (Ctrl+J)"
      aria-label="Ask AI"
      aria-pressed={isOpen}
      data-testid="crm-header-ask"
      className="crm-ask-ai-button flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)] text-[12.5px] font-medium text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-border-hover)] transition-colors"
    >
      <AskSparkleIcon />
      {/* Label is desktop-only (CSS) — phones keep just the spark. */}
      <span className="crm-ask-ai-label">Ask AI</span>
    </button>
  );
}
