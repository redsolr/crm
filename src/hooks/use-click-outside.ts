import { useEffect, type RefObject } from "react";

/**
 * Calls `handler` when a click/touch lands outside `ref`,
 * or when Escape is pressed.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      // Portaled select menus render under <body>, so they are
      // "outside" every host surface by DOM position — but picking an
      // option must not dismiss the host (inline-create row, search
      // bar, menus). The menu handles its own dismissal.
      if (
        target instanceof Element &&
        target.closest("[data-crm-select-menu]") !== null
      ) {
        return;
      }
      if (ref.current && !ref.current.contains(target)) {
        handler();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, handler, enabled]);
}
