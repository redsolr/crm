"use client";

/**
 * Empty-query content for the topbar search dropdown — Slack-shaped
 * (founder 2026-08-04, modeled on Slack's search popover + the OpenAI
 * console palette): ACTIONABLE rows, not a passive legend.
 *
 *   1. Recent searches (interactive — Enter/click re-applies the term)
 *   2. "Suggested" navigation rows (Enter/click routes) — this also
 *      carries the nav-jump job of the removed sidebar find box
 *   3. A keycap footer (↑↓ select · Enter open · Esc close)
 *
 * Keyboard selection is owned by the parent over ONE flat index space:
 * recents first, then the nav rows — `SUGGESTED_NAV.length` and the
 * parent's `recents.length` define it together.
 */

import type { ReactNode } from "react";
import {
  BarChart3,
  Building2,
  Inbox,
  LineChart,
  MessageSquare,
  Mic,
  Settings,
  Users,
} from "lucide-react";

export interface SuggestedNavItem {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
}

/** Navigation destinations offered before a query exists — mirrors the
 *  sidebar nav (Workflow / Records / Insights / Account). */
export const SUGGESTED_NAV: readonly SuggestedNavItem[] = [
  { id: "pipeline", label: "Pipeline", href: "/sales", icon: <BarChart3 size={14} /> },
  { id: "inbox", label: "Summary", href: "/sales/inbox", icon: <Inbox size={14} /> },
  { id: "chat", label: "Chat", href: "/sales/ask", icon: <MessageSquare size={14} /> },
  { id: "interviews", label: "Interviews", href: "/sales/interviews", icon: <Mic size={14} /> },
  { id: "companies", label: "Companies", href: "/sales/companies", icon: <Building2 size={14} /> },
  { id: "contacts", label: "Contacts", href: "/sales/contacts", icon: <Users size={14} /> },
  { id: "reports", label: "Reports", href: "/sales/reports", icon: <LineChart size={14} /> },
  { id: "settings", label: "Settings", href: "/account", icon: <Settings size={14} /> },
];

interface SearchSuggestionsProps {
  recents: string[];
  /** Parent's active row index over recents ++ SUGGESTED_NAV. */
  activeIndex: number;
  onHover: (index: number) => void;
  onApply: (term: string) => void;
  onOpenNav: (item: SuggestedNavItem) => void;
  onClearRecents: () => void;
}

export function SearchSuggestions({
  recents,
  activeIndex,
  onHover,
  onApply,
  onOpenNav,
  onClearRecents,
}: SearchSuggestionsProps) {
  return (
    <div className="crm-search-suggest" data-testid="crm-search-suggest">
      {recents.length > 0 && (
        <div className="crm-search-recent" data-testid="crm-search-recent">
          <div className="crm-search-recent-header flex items-baseline justify-between px-4 pt-2 pb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--theme-text-muted)]">
              Recent searches
            </span>
            <button
              type="button"
              className="crm-search-recent-clear text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-secondary)] transition-colors"
              data-testid="crm-search-recent-clear"
              onClick={onClearRecents}
            >
              Clear
            </button>
          </div>
          <ul className="crm-search-recent-list">
            {recents.map((term, index) => (
              <li key={term}>
                <button
                  type="button"
                  data-testid="crm-search-recent-item"
                  className={`crm-search-recent-item w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors ${
                    index === activeIndex
                      ? "bg-[var(--theme-bg-active)] text-[var(--theme-text-primary)]"
                      : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-hover)]"
                  }`}
                  onMouseEnter={() => onHover(index)}
                  onClick={() => onApply(term)}
                >
                  <span className="crm-search-recent-icon flex-shrink-0 text-[var(--theme-text-muted)]">
                    <ClockIcon />
                  </span>
                  <span className="crm-search-recent-term truncate">
                    {term}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="crm-search-nav" data-testid="crm-search-nav">
        <div className="crm-search-nav-label px-4 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--theme-text-muted)]">
          Suggested
        </div>
        <ul className="crm-search-nav-list">
          {SUGGESTED_NAV.map((item, i) => {
            const index = recents.length + i;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid={`crm-search-nav-${item.id}`}
                  className={`crm-search-nav-item w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors ${
                    index === activeIndex
                      ? "bg-[var(--theme-bg-active)] text-[var(--theme-text-primary)]"
                      : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-hover)]"
                  }`}
                  onMouseEnter={() => onHover(index)}
                  onClick={() => onOpenNav(item)}
                >
                  <span className="crm-search-nav-icon flex-shrink-0 text-[var(--theme-text-muted)]">
                    {item.icon}
                  </span>
                  <span className="crm-search-nav-term flex-1 truncate">
                    {item.label}
                  </span>
                  {index === activeIndex && <FooterKey label="Enter" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Slack's footer bar — the keyboard legend. */}
      <div
        className="crm-search-suggest-footer flex items-center gap-3 px-4 pt-2 pb-1 mt-1 border-t border-[var(--theme-border-primary)] text-[11px] text-[var(--theme-text-muted)]"
        data-testid="crm-search-suggest-footer"
      >
        <span className="flex items-center gap-1">
          <FooterKey label="↑" />
          <FooterKey label="↓" />
          Select
        </span>
        <span className="flex items-center gap-1">
          <FooterKey label="Enter" />
          Open
        </span>
        <span className="flex items-center gap-1">
          <FooterKey label="Esc" />
          Close
        </span>
      </div>
    </div>
  );
}

function FooterKey({ label }: { label: string }) {
  return (
    <kbd className="px-1 py-0.5 rounded border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] font-mono text-[10px] leading-none">
      {label}
    </kbd>
  );
}

function ClockIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
