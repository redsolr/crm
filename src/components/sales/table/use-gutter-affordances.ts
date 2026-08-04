"use client";

/**
 * Gutter-affordance mechanics for CrmRecordTable (Jira mechanic,
 * founder 2026-08-04): a row's vertical PADDING bands (top/bottom
 * ~28%) offer the insert "+" at the nearer BOUNDARY SLOT; the inner
 * text band offers the reorder grip. Tracked per pointer position —
 * pure CSS hover can't split a row into bands.
 *
 * Normalized to the slot index (not per-row zones): the band below
 * boundary k and the band above it both resolve to slot k, so
 * crossing the line keeps ONE stable button instead of remounting a
 * twin from the other row.
 *
 * `y` is the anchor line and `x` the shell's MEASURED left edge, both
 * in ROOT coordinates — the affordances render on an overlay OUTSIDE
 * the scroll container (in the margin strip left of the shell), so
 * row cells never reserve space for them and the icons center on the
 * real edge regardless of the shell's own margins (never a CSS
 * constant — the 2026-08-04 lesson).
 *
 * The hover-intent timer keeps the overlay alive while the pointer
 * travels from a row into the margin strip; without it the row's
 * pointerleave would dismiss the button before it can be clicked.
 */

import { useRef, useState } from "react";

export type GutterHover =
  | { kind: "slot"; slot: number; y: number; x: number }
  | { kind: "grip"; rowId: string; y: number; x: number }
  | null;

export interface RowPointerHandlers {
  onPointerMove?: (e: React.PointerEvent<HTMLTableRowElement>) => void;
  onPointerLeave?: () => void;
}

export function useGutterAffordances(
  enabled: boolean,
  rootEl: HTMLDivElement | null,
) {
  const [gutterHover, setGutterHover] = useState<GutterHover>(null);
  const clearTimer = useRef<number | null>(null);

  const cancelClear = () => {
    if (clearTimer.current !== null) {
      window.clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  };

  const scheduleClear = () => {
    cancelClear();
    clearTimer.current = window.setTimeout(() => {
      clearTimer.current = null;
      setGutterHover(null);
    }, 150);
  };

  const clearNow = () => {
    cancelClear();
    setGutterHover(null);
  };

  /** Pointer→band tracking for one row. Only rerenders when the
   *  resolved affordance actually changes. */
  const rowPointerHandlers = (
    rowId: string,
    rowIndex: number,
  ): RowPointerHandlers =>
    enabled
      ? {
          onPointerMove: (e: React.PointerEvent<HTMLTableRowElement>) => {
            if (rootEl === null) return;
            cancelClear();
            const rect = e.currentTarget.getBoundingClientRect();
            const rootRect = rootEl.getBoundingClientRect();
            const rootTop = rootRect.top;
            // The shell's real left edge, measured — never a constant.
            const shellRect = e.currentTarget
              .closest(".crm-table-shell")
              ?.getBoundingClientRect();
            const x = (shellRect?.left ?? rootRect.left) - rootRect.left;
            const rel = (e.clientY - rect.top) / rect.height;
            const next: NonNullable<GutterHover> =
              rel < 0.28
                ? { kind: "slot", slot: rowIndex, y: rect.top - rootTop, x }
                : rel > 0.72
                  ? {
                      kind: "slot",
                      slot: rowIndex + 1,
                      y: rect.bottom - rootTop,
                      x,
                    }
                  : {
                      kind: "grip",
                      rowId,
                      y: rect.top + rect.height / 2 - rootTop,
                      x,
                    };
            setGutterHover((prev) => {
              if (
                prev !== null &&
                prev.kind === next.kind &&
                prev.y === next.y &&
                prev.x === next.x &&
                (prev.kind === "slot"
                  ? prev.slot === (next as { slot: number }).slot
                  : prev.rowId === (next as { rowId: string }).rowId)
              ) {
                return prev;
              }
              return next;
            });
          },
          onPointerLeave: () => scheduleClear(),
        }
      : {};

  return {
    gutterHover,
    rowPointerHandlers,
    cancelClear,
    scheduleClear,
    clearNow,
  };
}
