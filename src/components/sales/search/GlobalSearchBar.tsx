"use client";

/**
 * Topbar global search — Slack-shape: a REAL input living in the
 * topbar whose results render in a dropdown anchored directly under
 * it, always exactly as wide as the input (inset-x-0 — never a fixed
 * width the field doesn't share). No centered modal, no dimmed
 * backdrop — the page stays visible while you search.
 *
 * Before the query is long enough to search, the dropdown offers
 * suggestions instead of a bare hint: recent successful searches
 * (localStorage, keyboard-navigable) plus a legend of what the search
 * reaches. See `SearchSuggestions`.
 *
 * `/` anywhere in the CRM shell focuses this input (unless the user
 * is typing somewhere else or a sibling overlay — ⌘K palette, Ask
 * drawer — owns the keyboard). Ctrl/Cmd+F is deliberately NOT
 * intercepted — browser find stays native. Full keyboard nav: ↑↓
 * moves the selection (results or recents), Enter opens the record
 * (or applies the recent), Esc closes the dropdown and blurs.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClickOutside } from "@/hooks/use-click-outside";
import { routeForHit } from "@/lib/sales/search-results";
import {
  clearRecentSearches,
  readRecentSearches,
  recordRecentSearch,
} from "@/lib/sales/recent-searches";
import type { SearchHit } from "@/lib/searchApi";
import { useAskPanel } from "@/stores/use-ask-panel";
import {
  MIN_QUERY_LENGTH,
  isTextEntryTarget,
  useCrmSearch,
} from "./useCrmSearch";
import { MagnifierIcon, SearchResultsList } from "./SearchResultsList";
import {
  SearchSuggestions,
  SUGGESTED_NAV,
  type SuggestedNavItem,
} from "./SearchSuggestions";

export function GlobalSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCrmSearch(query);
  const { flatHits } = search;

  // Mode follows the LIVE input (not the debounced query) so the
  // suggestions never flash while the debounce catches up.
  const suggestMode = query.trim().length < MIN_QUERY_LENGTH;
  // Suggest mode's flat keyboard space: recents first, then the
  // Suggested nav rows (Slack shape — see SearchSuggestions).
  const navLength = suggestMode
    ? recents.length + SUGGESTED_NAV.length
    : flatHits.length;

  // Derived clamp (no state-sync effect) — same pattern as the palette.
  const activeIndex = Math.min(selected, Math.max(0, navLength - 1));

  // Recents are re-read every time the dropdown opens — another tab or
  // an earlier search this session may have added entries.
  useEffect(() => {
    if (isOpen) setRecents(readRecentSearches());
  }, [isOpen]);

  // Global hotkey — `/` focuses the input when the user isn't typing
  // somewhere else and no sibling overlay is up.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTextEntryTarget(e.target)) return;
      // The command palette has no store — DOM presence is its truth.
      if (document.querySelector('[data-testid="crm-command-palette"]')) {
        return;
      }
      if (useAskPanel.getState().isOpen) return;
      e.preventDefault();
      inputRef.current?.focus();
      setIsOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Also fires on Escape — the dropdown closes but the query is kept,
  // Slack-style, so refocusing resumes where the user left off.
  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, closeDropdown);

  function openHit(hit: SearchHit) {
    // The query that surfaced a record the user actually opened is
    // worth offering back next time.
    recordRecentSearch(search.effectiveQuery);
    router.push(routeForHit(hit));
    setQuery("");
    setSelected(0);
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function applyRecent(term: string) {
    setQuery(term);
    setSelected(0);
    inputRef.current?.focus();
  }

  function openNav(item: SuggestedNavItem) {
    router.push(item.href);
    setQuery("");
    setSelected(0);
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function clearRecents() {
    clearRecentSearches();
    setRecents([]);
    setSelected(0);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(Math.min(activeIndex + 1, Math.max(0, navLength - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestMode) {
        if (activeIndex < recents.length) {
          const term = recents[activeIndex];
          if (term !== undefined) applyRecent(term);
        } else {
          const item = SUGGESTED_NAV[activeIndex - recents.length];
          if (item !== undefined) openNav(item);
        }
        return;
      }
      const hit = flatHits[activeIndex];
      if (hit) openHit(hit);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  // Live input is long enough but the debounced query hasn't caught up
  // yet — the results list would render blank for the debounce window.
  const waitingForDebounce = !suggestMode && !search.enabled;

  return (
    <div
      ref={containerRef}
      className="crm-topbar-search relative w-full max-w-[560px]"
      data-testid="crm-topbar-search"
      role="search"
    >
      {/* Jira-visible field (founder 2026-08-04): the RESTING border
          sits on the ladder's visible tier and the icon/placeholder/
          keycap read a step brighter — the box must be findable on the
          dark topbar without hovering. */}
      <div
        className={`crm-topbar-search-field flex items-center gap-2 w-full px-3 py-1.5 rounded-lg border bg-[var(--theme-bg-tertiary)] text-sm transition-colors ${
          isOpen
            ? "border-[var(--theme-text-muted)]"
            : "border-[var(--theme-border-hover)] hover:border-[var(--theme-text-muted)]"
        }`}
      >
        <span className="crm-topbar-search-icon flex-shrink-0 text-[var(--theme-text-secondary)]">
          <MagnifierIcon size={14} />
        </span>
        <input
          ref={inputRef}
          type="text"
          data-testid="crm-search-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search companies, deals, contacts, call notes…"
          className="crm-topbar-search-input flex-1 min-w-0 bg-transparent text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-secondary)] focus:outline-none"
        />
        <kbd className="crm-topbar-search-keycap flex-shrink-0 px-1.5 py-0.5 rounded border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)] font-mono text-[10px] leading-none text-[var(--theme-text-secondary)]">
          /
        </kbd>
      </div>

      {isOpen && (
        <div
          className="crm-search-dropdown absolute top-full inset-x-0 mt-1.5 max-h-[420px] overflow-y-auto rounded-xl border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] shadow-2xl z-[60] py-1.5"
          data-testid="crm-search-dropdown"
        >
          {suggestMode ? (
            <SearchSuggestions
              recents={recents}
              activeIndex={activeIndex}
              onHover={setSelected}
              onApply={applyRecent}
              onOpenNav={openNav}
              onClearRecents={clearRecents}
            />
          ) : waitingForDebounce ? (
            <div
              className="crm-search-loading mx-4 my-3 h-3 rounded bg-[var(--theme-bg-hover)] animate-pulse"
              aria-hidden
            />
          ) : (
            <SearchResultsList
              search={search}
              activeIndex={activeIndex}
              onHover={setSelected}
              onOpen={openHit}
            />
          )}
        </div>
      )}
    </div>
  );
}
