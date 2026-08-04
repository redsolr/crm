"use client";

/**
 * JS-measured screen centering (founder 2026-08-04: "things like this
 * should use js"). The previous implementation was a ≥1440px CSS
 * branch (`position: absolute` + `translateX`) — a transform creates a
 * stacking context, which is exactly how the search dropdown became
 * unclickable at full screen only. This hook replaces the whole
 * branch with ONE mechanism at every width:
 *
 *   measure the element's natural (flex-centered) position, shift it
 *   toward the true viewport center with relative `left` (layout-
 *   neutral — a margin inside a justify-center flex parent gets
 *   re-centered and only moves the box HALF the amount — and, unlike
 *   transform, never a stacking context), and CLAMP the shift so the
 *   element never leaves its parent's usable band — on narrow windows
 *   the clamp naturally yields ~0, which is the old sub-1440 behavior
 *   without any breakpoint.
 *
 * Re-measures on window resize and on parent size changes (the
 * sidebar drag-resize changes the topbar's width), mirroring the
 * SidebarResizeHandle pattern: direct style writes in an effect, no
 * React state, no hydration concerns.
 */

import { useEffect, type RefObject } from "react";

/** Pure clamp: the shift that centers `naturalCenter` on `target`,
 *  bounded to the parent's available slack on each side. */
export function computeCenterShift(
  naturalCenter: number,
  target: number,
  maxLeftShift: number,
  maxRightShift: number,
): number {
  return Math.max(maxLeftShift, Math.min(maxRightShift, target - naturalCenter));
}

export function useScreenCentered(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;

    const apply = () => {
      // Reset before measuring so repeated runs converge instead of
      // compounding. Requires the element to be positioned (the
      // container carries `relative` for its dropdown anchor anyway).
      el.style.left = "0px";
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement;
      if (parent === null) return;
      const parentRect = parent.getBoundingClientRect();
      const shift = computeCenterShift(
        rect.left + rect.width / 2,
        window.innerWidth / 2,
        parentRect.left - rect.left,
        parentRect.right - rect.right,
      );
      el.style.left = `${shift}px`;
    };

    apply();
    const observer = new ResizeObserver(apply);
    if (el.parentElement !== null) observer.observe(el.parentElement);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [ref]);
}
