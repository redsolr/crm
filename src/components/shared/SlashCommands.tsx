"use client";

/**
 * Shared `/` slash-command primitive for message composers (the Slack-style
 * command palette). Typing `/` as the FIRST character of a draft opens a menu
 * of the surface's commands; typing filters, ↑/↓ moves, Enter/Tab selects,
 * Esc dismisses (re-armed once the draft leaves slash mode).
 *
 * Two command kinds:
 * - **insert** — replaces the draft with `insert` text; the user still
 *   reviews and hits Send (never auto-sent).
 * - **run** — clears the draft and executes the action (e.g. summarize,
 *   mute). The command text itself is never sent as a message.
 *
 * State machine lives in {@link useSlashCommands}; the listbox is
 * {@link SlashCommandsMenu}. Surfaces own WHICH commands exist — this file
 * owns only the trigger/filter/keyboard mechanics, mirroring the
 * matter-intake Communications palette and the team-chat mention menu so all
 * composer menus feel identical.
 */

import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";

export interface SlashCommand {
  /** Command name WITHOUT the leading slash (e.g. `"summarize"`). */
  name: string;
  /** One-line explanation shown under the name (Slack-style). */
  description: string;
  /** Insert-type: text dropped into the composer on select. */
  insert?: string;
  /** Action-type: executed on select; the draft is cleared first. */
  run?: () => void;
}

export interface SlashCommandsState {
  /** Whether the menu should render. */
  open: boolean;
  /** Commands matching the current query. */
  matches: SlashCommand[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** Select a match by index (insert or run). */
  select: (index: number) => void;
  /**
   * Key handler to run BEFORE the composer's own (owns arrows/Enter/Tab/Esc
   * while the menu is open). Returns `true` when the event was handled.
   */
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

/**
 * Slash-command state machine. Slash mode = the draft starts with `/`
 * (Slack's convention — mid-message slashes like "attorney/client" never
 * trigger it).
 */
export function useSlashCommands({
  value,
  onChange,
  commands,
}: {
  /** The composer draft (parent-owned). */
  value: string;
  /** Draft setter — used to insert text / clear the command. */
  onChange: (value: string) => void;
  /** The surface's commands. Pass `[]` to disable entirely. */
  commands: SlashCommand[];
}): SlashCommandsState {
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const slashActive = commands.length > 0 && value.startsWith("/");
  const query = slashActive ? value.slice(1).trim().toLowerCase() : "";

  const matches = useMemo<SlashCommand[]>(() => {
    if (!slashActive) return [];
    return commands.filter(
      (c) =>
        query === "" ||
        c.name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query),
    );
  }, [slashActive, query, commands]);

  const open = slashActive && !dismissed && matches.length > 0;

  // Reset the highlight when the filter changes, and re-arm Esc once the draft
  // leaves slash mode. React's "adjust state during render" recipe instead of
  // effects — applies before paint, no extra commit (react-hooks/set-state-in-effect).
  const [prevFilter, setPrevFilter] = useState({ query, slashActive });
  if (prevFilter.query !== query || prevFilter.slashActive !== slashActive) {
    setPrevFilter({ query, slashActive });
    setActiveIndex(0);
    if (prevFilter.slashActive && !slashActive) setDismissed(false);
  }

  const select = useCallback(
    (index: number): void => {
      const cmd = matches[index];
      if (cmd === undefined) return;
      if (cmd.run !== undefined) {
        // Action command: the draft is the command text, not a message.
        onChange("");
        cmd.run();
      } else if (cmd.insert !== undefined) {
        onChange(cmd.insert);
      }
    },
    [matches, onChange],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!open) return false;
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
        return true;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % matches.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        select(activeIndex);
        return true;
      }
      return false;
    },
    [open, matches.length, activeIndex, select],
  );

  return { open, matches, activeIndex, setActiveIndex, select, onKeyDown };
}

/**
 * The slash-command listbox — rendered by the composer inside its field
 * anchor (absolute, above the textarea). Presentational only; the hook owns
 * all state. `aria-label` names the surface for screen readers.
 */
export function SlashCommandsMenu({
  state,
  ariaLabel,
}: {
  state: SlashCommandsState;
  ariaLabel: string;
}): React.ReactElement | null {
  if (!state.open) return null;
  return (
    <div
      className="slash-commands-menu absolute bottom-full left-0 z-20 mb-1 max-h-64 w-full min-w-64 overflow-y-auto rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] py-1 shadow-2xl [scrollbar-gutter:stable]"
      role="listbox"
      aria-label={ariaLabel}
      data-testid="slash-commands-menu"
    >
      <div className="slash-commands-menu-header px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-text-muted)]">
        Commands
      </div>
      {state.matches.map((cmd, i) => (
        <button
          key={cmd.name}
          type="button"
          role="option"
          aria-selected={i === state.activeIndex}
          data-testid={`slash-command-${cmd.name}`}
          className={clsx(
            "slash-commands-menu-item flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left",
            i === state.activeIndex
              ? "bg-[var(--theme-bg-active)]"
              : "hover:bg-[var(--theme-bg-hover)]",
          )}
          // Keep focus in the textarea — mousedown must not blur it.
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => state.setActiveIndex(i)}
          onClick={() => state.select(i)}
        >
          <span className="slash-commands-menu-item-name text-sm font-semibold text-[var(--theme-text-primary)]">
            /{cmd.name}
          </span>
          <span className="slash-commands-menu-item-description text-[11px] text-[var(--theme-text-muted)]">
            {cmd.description}
          </span>
        </button>
      ))}
    </div>
  );
}
