"use client";

/**
 * Topbar global search — Slack-shape: a REAL input living in the
 * topbar whose results render in a dropdown anchored directly under
 * it. No centered modal, no dimmed backdrop — the page stays visible
 * while you search.
 *
 * `/` anywhere in the CRM shell focuses this input (unless the user
 * is typing somewhere else or a sibling overlay — ⌘K palette, Ask
 * drawer — owns the keyboard). Ctrl/Cmd+F is deliberately NOT
 * intercepted — browser find stays native. Full keyboard nav: ↑↓
 * moves the selection, Enter opens the record, Esc closes the
 * dropdown and blurs.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClickOutside } from "@/hooks/use-click-outside";
import { routeForHit } from "@/lib/sales/search-results";
import type { SearchHit } from "@/lib/searchApi";
import { useAskPanel } from "@/stores/use-ask-panel";
import {
  MIN_QUERY_LENGTH,
  isTextEntryTarget,
  useCrmSearch,
} from "./useCrmSearch";
import { MagnifierIcon, SearchResultsList } from "./SearchResultsList";

export function GlobalSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCrmSearch(query);
  const { flatHits } = search;

  // Derived clamp (no state-sync effect) — same pattern as the palette.
  const activeIndex = Math.min(selected, Math.max(0, flatHits.length - 1));

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
    router.push(routeForHit(hit));
    setQuery("");
    setSelected(0);
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(Math.min(activeIndex + 1, Math.max(0, flatHits.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flatHits[activeIndex];
      if (hit) openHit(hit);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      ref={containerRef}
      className="crm-topbar-search relative w-full max-w-[440px]"
      data-testid="crm-topbar-search"
      role="search"
    >
      <div
        className={`crm-topbar-search-field flex items-center gap-2 w-full px-3 py-1.5 rounded-lg border bg-[var(--theme-bg-tertiary)] text-sm transition-colors ${
          isOpen
            ? "border-[var(--theme-border-hover)]"
            : "border-[var(--theme-border-primary)] hover:border-[var(--theme-border-hover)]"
        }`}
      >
        <span className="crm-topbar-search-icon flex-shrink-0 text-[var(--theme-text-muted)]">
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
          className="crm-topbar-search-input flex-1 min-w-0 bg-transparent text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)] focus:outline-none"
        />
        <kbd className="crm-topbar-search-keycap flex-shrink-0 px-1.5 py-0.5 rounded border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] font-mono text-[10px] leading-none text-[var(--theme-text-muted)]">
          /
        </kbd>
      </div>

      {isOpen && (
        <div
          className="crm-search-dropdown absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-[560px] max-w-[80vw] max-h-[420px] overflow-y-auto rounded-xl border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] shadow-2xl z-[60] py-1.5"
          data-testid="crm-search-dropdown"
        >
          {!search.enabled && !search.isLoading && (
            <div className="crm-search-hint px-4 py-3 text-sm text-[var(--theme-text-muted)]">
              Type at least {MIN_QUERY_LENGTH} characters to search.
            </div>
          )}
          <SearchResultsList
            search={search}
            activeIndex={activeIndex}
            onHover={setSelected}
            onOpen={openHit}
          />
        </div>
      )}
    </div>
  );
}
