"use client";

/**
 * Sidebar ("explorer") inline search — Slack-shape: ONE find box
 * embedded in the rail that narrows IN PLACE. While a query is
 * typed the sidebar's nav is swapped for matches (the shell hides the
 * nav — this component renders the results): first the nav views whose
 * label matches (Slack's channel rows), then CRM records from the
 * keyword FTS lane, grouped by kind. Esc or clearing restores the nav.
 *
 * Command mode (user decision 2026-07-19): a leading `/` hands the
 * keystroke off to the ⌘K quick-actions palette — the box clears and
 * the palette opens. Normal text searches; `/` commands. This box is
 * the rail's single entry point (the separate "Quick actions" row is
 * gone).
 *
 * Controlled: `CrmSidebar` owns the query so it knows when to hide
 * its nav; everything else (debounce, fetching, keyboard nav,
 * routing) lives here.
 */

import { ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { routeForHit } from "@/lib/sales/search-results";
import type { SearchHit } from "@/lib/searchApi";
import { useCrmSearch } from "./useCrmSearch";
import { MagnifierIcon, SearchResultsList } from "./SearchResultsList";

export interface SidebarViewItem {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
}

interface SidebarSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Nav destinations the filter matches by label (Slack's channels). */
  views: SidebarViewItem[];
}

export function SidebarSearch({
  query,
  onQueryChange,
  views,
}: SidebarSearchProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(0);

  const search = useCrmSearch(query);
  const { flatHits } = search;
  const active = query.trim() !== "";

  // Nav views whose label matches — client-side, from the first char.
  const viewMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return [];
    return views.filter((v) => v.label.toLowerCase().includes(q));
  }, [query, views]);

  // One flat keyboard-nav space: view rows first, then record hits.
  const navCount = viewMatches.length + flatHits.length;
  const activeIndex = Math.min(selected, Math.max(0, navCount - 1));

  function reset() {
    onQueryChange("");
    setSelected(0);
  }

  function openView(view: SidebarViewItem) {
    router.push(view.href);
    reset();
  }

  function openHit(hit: SearchHit) {
    router.push(routeForHit(hit));
    reset();
  }

  function activate(index: number) {
    if (index < viewMatches.length) {
      const view = viewMatches[index];
      if (view) openView(view);
    } else {
      const hit = flatHits[index - viewMatches.length];
      if (hit) openHit(hit);
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(Math.min(activeIndex + 1, Math.max(0, navCount - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      reset();
      e.currentTarget.blur();
    }
  }

  return (
    <>
      <div
        className="crm-sidebar-search px-3 pb-1.5"
        data-testid="crm-sidebar-search"
      >
        <div className="crm-sidebar-search-field flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] text-xs text-[var(--theme-text-muted)] focus-within:border-[var(--theme-border-hover)] transition-colors">
          <span className="crm-sidebar-search-icon flex-shrink-0">
            <MagnifierIcon size={13} />
          </span>
          <input
            type="text"
            data-testid="crm-sidebar-search-input"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              // Command mode: a leading `/` opens the ⌘K palette and
              // clears the box — same dispatch the old quick-actions
              // button used; the palette autofocuses its own input.
              if (value.startsWith("/")) {
                reset();
                e.currentTarget.blur();
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", ctrlKey: true })
                );
                return;
              }
              onQueryChange(value);
              setSelected(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search — / for commands"
            className="crm-sidebar-search-input flex-1 min-w-0 bg-transparent text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)] focus:outline-none"
          />
          {!active && (
            <kbd
              className="crm-sidebar-search-keycap flex-shrink-0 px-1 py-0.5 rounded border border-[var(--theme-border-secondary)] font-mono text-[10px] leading-none"
              title="Quick actions (⌘K, or type /)"
            >
              ⌘K
            </kbd>
          )}
          {active && (
            <button
              type="button"
              data-testid="crm-sidebar-search-clear"
              aria-label="Clear search"
              onClick={reset}
              className="crm-sidebar-search-clear flex-shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]"
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {active && (
        <div
          className="crm-sidebar-search-results flex-1 min-h-0 overflow-y-auto px-1.5 pb-2"
          data-testid="crm-sidebar-search-results"
        >
          {viewMatches.length > 0 && (
            <div className="crm-sidebar-search-views">
              <div className="crm-search-group-label px-2.5 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--theme-text-muted)]">
                Views
              </div>
              {viewMatches.map((view, i) => (
                <button
                  key={view.id}
                  type="button"
                  data-testid={`crm-sidebar-search-view-${view.id}`}
                  className={`crm-sidebar-search-view w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors ${
                    i === activeIndex
                      ? "bg-[var(--theme-bg-active)] text-[var(--theme-text-primary)]"
                      : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-hover)]"
                  }`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => openView(view)}
                >
                  <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-[var(--theme-text-muted)]">
                    {view.icon}
                  </span>
                  <span className="flex-1 truncate">{view.label}</span>
                </button>
              ))}
            </div>
          )}
          <SearchResultsList
            // A view match already answers the query — only claim "no
            // matches" when neither surface found anything.
            search={{
              ...search,
              showEmpty: search.showEmpty && viewMatches.length === 0,
            }}
            activeIndex={activeIndex}
            indexOffset={viewMatches.length}
            compact
            testIdPrefix="crm-sidebar-search"
            onHover={setSelected}
            onOpen={openHit}
          />
        </div>
      )}
    </>
  );
}
