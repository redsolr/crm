"use client";

/**
 * Empty-query content for the topbar search dropdown — what Slack
 * shows before you type: your recent searches (interactive, keyboard-
 * navigable via the parent's flat index space) plus a legend of what
 * the search reaches, so the surface teaches itself.
 */

import {
  SEARCH_GROUP_ORDER,
  type SearchResultKind,
} from "@/lib/sales/search-results";
import { KindIcon } from "./SearchResultsList";

interface SearchSuggestionsProps {
  recents: string[];
  /** Parent's active row index over `recents`. */
  activeIndex: number;
  onHover: (index: number) => void;
  onApply: (term: string) => void;
  onClearRecents: () => void;
}

/** Legend chips — the "Other" junk drawer isn't worth advertising. */
const LEGEND_KINDS: ReadonlyArray<{ kind: SearchResultKind; label: string }> =
  SEARCH_GROUP_ORDER.filter((g) => g.kind !== "other");

export function SearchSuggestions({
  recents,
  activeIndex,
  onHover,
  onApply,
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

      <div className="crm-search-kinds px-4 pt-2 pb-3" data-testid="crm-search-kinds">
        <div className="crm-search-kinds-label pb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--theme-text-muted)]">
          Search across
        </div>
        <div className="crm-search-kinds-chips flex flex-wrap gap-1.5">
          {LEGEND_KINDS.map(({ kind, label }) => (
            <span
              key={kind}
              className="crm-search-kinds-chip inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-[var(--theme-border-primary)] bg-[var(--theme-bg-tertiary)] text-xs text-[var(--theme-text-secondary)]"
            >
              <KindIcon kind={kind} />
              {label}
            </span>
          ))}
        </div>
        <p className="crm-search-kinds-hint pt-2 text-xs text-[var(--theme-text-muted)]">
          Try a firm name, a deal title, a person, or words from a call
          note.
        </p>
      </div>
    </div>
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
