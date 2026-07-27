"use client";

/**
 * Grouped search-result rows shared by the topbar dropdown
 * (`GlobalSearchBar`) and the sidebar filter (`SidebarSearch`).
 *
 * Pure presentation over a `CrmSearchState`: loading shimmer, empty
 * row, then groups in fixed kind order. Keyboard selection is owned by
 * the caller — this component only reports hover (`onHover`) and
 * activation (`onOpen`) against the caller's flat index space, shifted
 * by `indexOffset` when the caller navigates extra rows of its own
 * (e.g. the sidebar's view matches above the record hits).
 */

import type { SearchHit } from "@/lib/searchApi";
import {
  identifierOfHit,
  type SearchResultKind,
} from "@/lib/sales/search-results";
import { renderSnippet } from "@/lib/search-highlight";
import type { CrmSearchState } from "./useCrmSearch";

interface SearchResultsListProps {
  search: CrmSearchState;
  /** Caller's active flat index (already includes `indexOffset` rows). */
  activeIndex: number;
  /** Rows the caller renders above these results in its nav order. */
  indexOffset?: number;
  /** Dense spacing for the narrow sidebar rail. */
  compact?: boolean;
  /** data-testid prefix — keeps the two surfaces distinguishable. */
  testIdPrefix?: string;
  onHover: (index: number) => void;
  onOpen: (hit: SearchHit) => void;
}

export function SearchResultsList({
  search,
  activeIndex,
  indexOffset = 0,
  compact = false,
  testIdPrefix = "crm-search",
  onHover,
  onOpen,
}: SearchResultsListProps) {
  const { groups, flatIndexByHit, isLoading, showEmpty, effectiveQuery } =
    search;
  const rowPadding = compact ? "px-2.5 py-1.5" : "px-4 py-2";
  const labelPadding = compact ? "px-2.5" : "px-4";

  return (
    <div className="crm-search-results">
      {isLoading && (
        <div
          className={`crm-search-loading ${
            compact ? "mx-2.5" : "mx-4"
          } my-3 h-3 rounded bg-[var(--theme-bg-hover)] animate-pulse`}
          data-testid={`${testIdPrefix}-loading`}
          aria-hidden
        />
      )}
      {showEmpty && (
        <div
          className={`crm-search-empty ${labelPadding} py-3 text-sm text-[var(--theme-text-muted)]`}
          data-testid={`${testIdPrefix}-empty`}
        >
          No matches for &ldquo;{effectiveQuery}&rdquo;
        </div>
      )}
      {groups.map((group) => (
        <div
          key={group.kind}
          className="crm-search-group"
          data-testid={`${testIdPrefix}-group-${group.kind}`}
        >
          <div
            className={`crm-search-group-label ${labelPadding} pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--theme-text-muted)]`}
          >
            {group.label}
          </div>
          <ul className="crm-search-group-list">
            {group.hits.map((hit) => {
              const flatIndex = (flatIndexByHit.get(hit) ?? 0) + indexOffset;
              const identifier = identifierOfHit(hit);
              return (
                <li key={hit.source_id}>
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-result`}
                    data-result-id={hit.source_id}
                    className={`crm-search-result w-full flex items-start gap-2.5 ${rowPadding} text-left text-sm transition-colors ${
                      flatIndex === activeIndex
                        ? "bg-[var(--theme-bg-active)] text-[var(--theme-text-primary)]"
                        : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-hover)]"
                    } ${compact ? "rounded-md" : ""}`}
                    onMouseEnter={() => onHover(flatIndex)}
                    onClick={() => onOpen(hit)}
                  >
                    <span className="crm-search-result-icon mt-0.5 flex-shrink-0 text-[var(--theme-text-muted)]">
                      <KindIcon kind={group.kind} />
                    </span>
                    <span className="crm-search-result-body flex-1 min-w-0">
                      <span className="crm-search-result-heading flex items-baseline gap-2">
                        <span className="crm-search-result-title truncate">
                          {hit.title ?? "Untitled"}
                        </span>
                        {identifier !== null && (
                          <span className="crm-search-result-identifier flex-shrink-0 font-mono text-[11px] text-[var(--theme-text-muted)]">
                            {identifier}
                          </span>
                        )}
                      </span>
                      {hit.snippet !== null && hit.snippet !== "" && (
                        <span className="crm-search-result-snippet block truncate text-xs text-[var(--theme-text-muted)]">
                          {renderSnippet(hit.snippet)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── Icons (inline SVG per CRM shell convention) ─────────────────────────────

export function MagnifierIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function KindIcon({ kind }: { kind: SearchResultKind }) {
  const shared = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "account":
      return (
        <svg {...shared}>
          <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
          <path d="M16 8h3a2 2 0 0 1 2 2v11M9 7h3M9 11h3M9 15h3" />
        </svg>
      );
    case "opportunity":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case "contact":
      return (
        <svg {...shared}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a7 7 0 0 1 16 0v1" />
        </svg>
      );
    case "call_note":
      return (
        <svg {...shared}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
        </svg>
      );
    case "other":
      return (
        <svg {...shared}>
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
          <path d="M14 3v6h6" />
        </svg>
      );
  }
}
