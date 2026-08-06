"use client";

/**
 * Searchable select + typeahead combobox — the app-wide replacement
 * for native `<select>` / `<datalist>` controls (2026-08-07).
 *
 * Why not native: option popups are browser chrome — unstylable,
 * unsearchable, and (datalist) misaligned against the anchor. Every
 * dropdown in the app chrome renders through these two components so
 * long lists (companies) stay typeable and the expanded menu matches
 * the design system.
 *
 * - `SelectMenu` — button-trigger single select. Search box appears
 *   automatically once the list is long enough to warrant it
 *   (`SEARCHABLE_AT`); override with `searchable`.
 * - `TypeaheadCombobox` — free-text input with suggestions (the
 *   "existing or new company" pattern). Typing filters; picking fills
 *   the input; unmatched text stays valid input.
 *
 * Positioning is @floating-ui/react (flip/shift/size + autoUpdate)
 * with the menu portaled to <body>, so it never clips inside
 * overflow containers (modals, table rows) and never inherits a
 * transformed ancestor's coordinate space (wide-viewport centering).
 * Host surfaces that dismiss on outside clicks stay open while the
 * user is inside the menu — `useClickOutside` ignores
 * `[data-crm-select-menu]` subtrees.
 *
 * E2E drives these through `e2e/helpers/select.ts` (`pickOption` /
 * `expectSelectValue`); the trigger exposes the current value as
 * `data-value`, options expose theirs on `role="option"` rows.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import { Check, ChevronDown, Search } from "lucide-react";
import clsx from "clsx";

export interface SelectOption {
  value: string;
  label: string;
}

/** `["matter_chaos", …]` → labeled options (`"matter chaos"`). */
export function keyOptions(keys: readonly string[]): SelectOption[] {
  return keys.map((k) => ({ value: k, label: k.replace(/_/g, " ") }));
}

/** List length at which the search box appears by default. */
const SEARCHABLE_AT = 6;

const MENU_MAX_HEIGHT = 320;

function filterOptions(
  options: readonly SelectOption[],
  query: string,
): SelectOption[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...options];
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(needle) ||
      o.value.toLowerCase().includes(needle),
  );
}

/** Shared floating setup for both components. */
function useMenuFloating(open: boolean) {
  return useFloating({
    open,
    // The menu PORTALS out of overflow containers; fixed strategy
    // keeps coordinates viewport-based. `transform: false` positions
    // via top/left so the pop-in keyframe (which animates transform)
    // can't clobber the computed position.
    strategy: "fixed",
    transform: false,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            minWidth: `${Math.max(rects.reference.width, 160)}px`,
            maxHeight: `${Math.min(availableHeight, MENU_MAX_HEIGHT)}px`,
          });
        },
      }),
    ],
  });
}

/** The CRM theme tokens are SCOPED to `.crm-app` — a menu portaled to
 *  <body> would resolve them against :root (light). Portal into the
 *  app shell instead, resolved from the anchor element once open. */
function usePortalRoot(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      setRoot(
        anchorRef.current?.closest<HTMLElement>(".crm-app") ?? document.body,
      );
    }
  }, [open, anchorRef]);
  return root;
}

/** Dismiss when a pointer-down lands outside both the trigger and the
 *  menu. Deliberately NOT the shared `useClickOutside` — that hook
 *  ignores `[data-crm-select-menu]` subtrees (so HOST surfaces stay
 *  open), while the menu itself must still close from its own. */
function useMenuDismiss(
  open: boolean,
  close: () => void,
  ...refs: Array<React.RefObject<HTMLElement | null>>
) {
  // Refs are stable across renders; the effect keys on open/close only.
  const refsRef = useRef(refs);
  useEffect(() => {
    refsRef.current = refs;
  });
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const inside = refsRef.current.some((r) => r.current?.contains(target));
      if (!inside) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, close]);
}

function OptionRow({
  option,
  active,
  selected,
  id,
  onPick,
  onHover,
}: {
  option: SelectOption;
  active: boolean;
  selected: boolean;
  id: string;
  onPick: () => void;
  onHover: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Optional call: jsdom has no scrollIntoView.
    if (active) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [active]);
  return (
    <button
      ref={ref}
      type="button"
      role="option"
      id={id}
      aria-selected={selected}
      data-value={option.value}
      data-active={active ? "true" : undefined}
      className="crm-select-option"
      // Pick on mousedown-follow-up click; hover moves the active row.
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      onMouseMove={onHover}
    >
      <span className="crm-select-option-label">{option.label}</span>
      {selected && (
        <Check size={14} className="crm-select-option-check" aria-hidden />
      )}
    </button>
  );
}

interface SelectMenuProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Trigger text while nothing is selected. */
  placeholder?: string;
  /** When set, renders a clearable `""` option with this label
   *  (`"—"`, `"Any"`, `"No company"`, …). */
  emptyOptionLabel?: string;
  /** Default: automatic — searchable once the list has ≥6 entries. */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** Focus the trigger on mount (modal first-field parity). */
  autoFocus?: boolean;
  /** Open the menu immediately on mount (inline cell editors). */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Trigger classes — pass the site's input-style constant. */
  className?: string;
  /** Trigger inline style (realtime claim rings). */
  style?: React.CSSProperties;
  /** True while the user is "in" the field: trigger focused or menu
   *  open. Powers realtime field-claim presence. */
  onEngagedChange?: (engaged: boolean) => void;
  ariaLabel?: string;
  testId?: string;
}

export function SelectMenu({
  value,
  onChange,
  options,
  placeholder = "Select…",
  emptyOptionLabel,
  searchable,
  searchPlaceholder = "Search…",
  disabled,
  autoFocus,
  defaultOpen = false,
  onOpenChange,
  className,
  style,
  onEngagedChange,
  ariaLabel,
  testId,
}: SelectMenuProps) {
  const [open, setOpenRaw] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [triggerFocused, setTriggerFocused] = useState(false);
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // The menu mounts through a portal a beat after `open` flips — the
  // element in STATE (not just a ref) lets the focus effect fire when
  // it actually lands.
  const [menuEl, setMenuEl] = useState<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  // Non-searchable lists still jump on typed characters.
  const typeahead = useRef({ buffer: "", at: 0 });

  const { refs, floatingStyles } = useMenuFloating(open);
  const portalRoot = usePortalRoot(open, triggerRef);

  const allOptions = useMemo<SelectOption[]>(
    () =>
      emptyOptionLabel !== undefined
        ? [{ value: "", label: emptyOptionLabel }, ...options]
        : [...options],
    [options, emptyOptionLabel],
  );
  const hasSearch = searchable ?? options.length >= SEARCHABLE_AT;
  const filtered = useMemo(
    () => filterOptions(allOptions, hasSearch ? query : ""),
    [allOptions, hasSearch, query],
  );

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenRaw(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const openMenu = useCallback(() => {
    setQuery("");
    const selectedAt = allOptions.findIndex((o) => o.value === value);
    setActiveIndex(selectedAt >= 0 ? selectedAt : 0);
    setOpen(true);
  }, [allOptions, value, setOpen]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  useMenuDismiss(open, close, triggerRef, menuRef);

  // "Engaged" = the user is in this field (trigger focused or menu
  // open) — the realtime field-claim signal.
  const engaged = open || triggerFocused;
  const engagedRef = useRef(engaged);
  useEffect(() => {
    if (engaged !== engagedRef.current) {
      engagedRef.current = engaged;
      onEngagedChange?.(engaged);
    }
  }, [engaged, onEngagedChange]);

  // Focus lands in the menu (search box, else the list container) so
  // arrow keys work immediately; closing returns it to the trigger.
  useEffect(() => {
    if (open && menuEl !== null) {
      (searchRef.current ?? menuEl).focus();
    }
  }, [open, menuEl]);

  const pick = useCallback(
    (next: string) => {
      // onChange BEFORE close: hosts that treat "closed without a
      // pick" as cancel (cell editors) must see the commit first.
      if (next !== value) onChange(next);
      close();
      triggerRef.current?.focus();
    },
    [close, onChange, value],
  );

  function moveActive(delta: number) {
    if (filtered.length === 0) return;
    setActiveIndex((i) => {
      const next = (i + delta + filtered.length) % filtered.length;
      return next;
    });
  }

  function handleMenuKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(Math.max(filtered.length - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const active = filtered[activeIndex];
      if (active) pick(active.value);
    } else if (e.key === "Escape") {
      // The menu consumes its own Escape — the host modal/row stays.
      e.preventDefault();
      e.stopPropagation();
      close();
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      close();
    } else if (!hasSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // Plain-list typeahead: accumulate a short buffer, jump to match.
      const now = Date.now();
      const state = typeahead.current;
      state.buffer = now - state.at > 600 ? e.key : state.buffer + e.key;
      state.at = now;
      const needle = state.buffer.toLowerCase();
      const at = filtered.findIndex((o) =>
        o.label.toLowerCase().startsWith(needle),
      );
      if (at >= 0) setActiveIndex(at);
    }
  }

  const selected = allOptions.find((o) => o.value === value);
  const showPlaceholder = selected === undefined || selected.label === "";

  return (
    <>
      <button
        ref={(node) => {
          triggerRef.current = node;
          refs.setReference(node);
        }}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        autoFocus={autoFocus}
        data-testid={testId}
        data-value={value}
        data-open={open ? "true" : undefined}
        className={clsx("crm-select-trigger", className)}
        style={style}
        onFocus={() => setTriggerFocused(true)}
        onBlur={() => setTriggerFocused(false)}
        onClick={(e) => {
          // Selects live inside clickable rows/cards — the trigger
          // never doubles as a row click.
          e.stopPropagation();
          if (open) close();
          else openMenu();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) openMenu();
          }
        }}
      >
        <span
          className={clsx(
            "crm-select-value",
            showPlaceholder && "crm-select-placeholder",
          )}
        >
          {selected !== undefined && selected.label !== ""
            ? selected.label
            : placeholder}
        </span>
        <ChevronDown size={14} className="crm-select-chevron" aria-hidden />
      </button>
      {open && portalRoot !== null && (
        <FloatingPortal root={portalRoot}>
          <div
            ref={(node) => {
              menuRef.current = node;
              setMenuEl(node);
              refs.setFloating(node);
            }}
            style={floatingStyles}
            className="crm-select-menu"
            data-crm-select-menu
            data-testid="crm-select-menu"
            tabIndex={-1}
            onKeyDown={handleMenuKeyDown}
            // Keep pointer interactions inside the menu from reaching
            // host rows/cards/backdrops.
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
          {hasSearch && (
            <div className="crm-select-search">
              <Search size={13} aria-hidden />
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                data-testid="crm-select-search-input"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
              />
            </div>
          )}
          <div
            className="crm-select-options"
            role="listbox"
            id={listboxId}
            aria-label={ariaLabel}
          >
            {filtered.map((o, i) => (
              <OptionRow
                key={o.value === "" ? " empty" : o.value}
                option={o}
                active={i === activeIndex}
                selected={o.value === value}
                id={`${listboxId}-${i}`}
                onPick={() => pick(o.value)}
                onHover={() => setActiveIndex(i)}
              />
            ))}
            {filtered.length === 0 && (
              <p className="crm-select-empty">No matches</p>
            )}
          </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

interface TypeaheadComboboxProps {
  /** Free text — the caller owns it (matched or new). */
  value: string;
  onValueChange: (text: string) => void;
  /** Suggestions; picking one fills the input with its label. */
  options: readonly SelectOption[];
  /** Fired when a suggestion is explicitly picked. */
  onPick?: (option: SelectOption) => void;
  /** Enter with no highlighted suggestion (submit-style hosts). */
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  testId?: string;
  autoFocus?: boolean;
}

export function TypeaheadCombobox({
  value,
  onValueChange,
  options,
  onPick,
  onEnter,
  placeholder,
  className,
  ariaLabel,
  testId,
  autoFocus,
}: TypeaheadComboboxProps) {
  const [open, setOpen] = useState(false);
  // -1 = nothing highlighted: Enter falls through to the host.
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { refs, floatingStyles } = useMenuFloating(open);
  const portalRoot = usePortalRoot(open, inputRef);

  const filtered = useMemo(
    () => filterOptions(options, value),
    [options, value],
  );
  const exactMatch = useMemo(() => {
    const needle = value.trim().toLowerCase();
    return options.some((o) => o.label.trim().toLowerCase() === needle);
  }, [options, value]);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  useMenuDismiss(open, close, inputRef, menuRef);

  const showMenu = open && filtered.length > 0 && !exactMatch;

  const pick = useCallback(
    (option: SelectOption) => {
      onValueChange(option.label);
      onPick?.(option);
      close();
      inputRef.current?.focus();
    },
    [onValueChange, onPick, close],
  );

  function handleKeyDown(e: ReactKeyboardEvent) {
    if (showMenu && e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (showMenu && e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        i <= 0 ? filtered.length - 1 : i - 1,
      );
    } else if (e.key === "Enter") {
      const active = activeIndex >= 0 ? filtered[activeIndex] : undefined;
      if (showMenu && active !== undefined) {
        e.preventDefault();
        pick(active);
      } else {
        onEnter?.();
      }
    } else if (e.key === "Escape" && showMenu) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  return (
    <>
      <input
        ref={(node) => {
          inputRef.current = node;
          refs.setReference(node);
        }}
        type="text"
        role="combobox"
        aria-expanded={showMenu}
        aria-autocomplete="list"
        aria-controls={showMenu ? listboxId : undefined}
        aria-activedescendant={
          showMenu && activeIndex >= 0
            ? `${listboxId}-${activeIndex}`
            : undefined
        }
        aria-label={ariaLabel}
        data-testid={testId}
        className={className}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {showMenu && portalRoot !== null && (
        <FloatingPortal root={portalRoot}>
          <div
            ref={(node) => {
              menuRef.current = node;
              refs.setFloating(node);
            }}
            style={floatingStyles}
            className="crm-select-menu"
            data-crm-select-menu
            data-testid="crm-select-menu"
            onMouseDown={(e) => {
              // Keep focus in the input while picking.
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="crm-select-options" role="listbox" id={listboxId}>
              {filtered.map((o, i) => (
                <OptionRow
                  key={o.value}
                  option={o}
                  active={i === activeIndex}
                  selected={false}
                  id={`${listboxId}-${i}`}
                  onPick={() => pick(o)}
                  onHover={() => setActiveIndex(i)}
                />
              ))}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
