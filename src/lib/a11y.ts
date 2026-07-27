/**
 * Small a11y helpers for making non-`<button>` clickable elements
 * keyboard-operable, satisfying `jsx-a11y/click-events-have-key-events`
 * without suppressing the rule.
 *
 * Prefer a real `<button>` where the markup allows it. Use these only where a
 * semantic element would break layout or nest illegally (clickable list rows,
 * tree items, custom controls) — pair them with `role="button"` +
 * `tabIndex={0}` so the element is focusable and announces its role.
 */

import type { KeyboardEvent, MouseEvent } from "react";

/**
 * `onKeyDown` handler that fires `handler` on Enter or Space — the same keys
 * a native button responds to. Space is `preventDefault`ed so the page
 * doesn't scroll.
 *
 * @example
 * <div
 *   role="button"
 *   tabIndex={0}
 *   onClick={select}
 *   onKeyDown={activateOnKey(select)}
 * />
 */
export function activateOnKey(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
}

/**
 * Accessible modal-backdrop wiring, spread onto the full-screen overlay div
 * of a click-outside-to-close dialog:
 *
 *   <div className="…overlay styles…" {...dialogBackdropProps(onClose, "New matter")}>
 *     <div className="…content styles…">…</div>
 *   </div>
 *
 * - Announces as a dialog (`role` + `aria-modal` + `aria-label`).
 * - Closes on Escape.
 * - Closes on backdrop click ONLY when the click landed directly on the
 *   backdrop (`target === currentTarget`) — no inner `stopPropagation`
 *   needed, so clicks inside content bubble normally.
 *
 * Styling stays on the call site; this helper owns only the behavior, so
 * differently-positioned overlays (fixed vs absolute, z-layers) all share
 * one implementation of the dismiss contract.
 */
export function dialogBackdropProps(onClose: () => void, label: string) {
  return {
    role: "dialog",
    "aria-modal": true,
    "aria-label": label,
    tabIndex: -1,
    onClick: (e: MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
  } as const;
}
