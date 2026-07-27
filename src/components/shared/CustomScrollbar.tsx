"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useCustomScrollbar } from "@/hooks/use-custom-scrollbar";
import { useScrollbarStore } from "@/stores/scrollbar.store";

/**
 * Layout-level custom horizontal scrollbar.
 * Fixed-positioned to align exactly with the scroll element it controls,
 * sitting just above the status bar. Views register their scroll container
 * via `useScrollbarStore().setScrollEl(el)`.
 */
export function CustomScrollbar({ className = "" }: { className?: string }) {
  const scrollEl = useScrollbarStore((s) => s.scrollEl);
  const { trackRef, thumbWidth, thumbLeft, hasScroll, handleTrackClick, handleThumbDown } =
    useCustomScrollbar(scrollEl);

  // Track the scroll element's horizontal bounds so the scrollbar aligns with it
  const [rect, setRect] = useState<{ left: number; width: number } | null>(null);

  // Reset rect when the underlying scroll element disappears.
  // Adjusting state during render — the in-effect setRect(null) the
  // compiler flagged was a state-mirror of `scrollEl == null`.
  const [lastScrollEl, setLastScrollEl] = useState(scrollEl);
  if (scrollEl !== lastScrollEl) {
    if (!scrollEl) setRect(null);
    setLastScrollEl(scrollEl);
  }

  const measure = useCallback(() => {
    if (!scrollEl) return;
    const r = scrollEl.getBoundingClientRect();
    setRect({ left: r.left, width: window.innerWidth - r.left });
  }, [scrollEl]);

  useEffect(() => {
    if (!scrollEl) return;
    // Defer the initial measure so the setState that lands inside
    // isn't classified as "synchronously called from the effect
    // body" by the React compiler.
    const initialId = window.setTimeout(measure, 0);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(initialId);
      window.removeEventListener("resize", measure);
    };
  }, [scrollEl, measure]);

  if (!scrollEl || !rect) return null;

  return (
    <div
      className={`custom-scrollbar-wrapper fixed bottom-6 z-[9999] pointer-events-none ${className}`}
      style={{ left: rect.left, width: rect.width }}
    >
      <div
        ref={trackRef}
        role="scrollbar"
        aria-orientation="horizontal"
        aria-valuenow={Math.round((thumbLeft / Math.max(rect.width, 1)) * 100)}
        tabIndex={0}
        onClick={handleTrackClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleTrackClick(e as unknown as React.MouseEvent<HTMLDivElement>);
          }
        }}
        className="custom-scrollbar-track w-full relative cursor-pointer bg-[var(--theme-bg-secondary)] pointer-events-auto"
        style={{ height: 10 }}
      >
        {hasScroll && (
          <div
            role="slider"
            aria-orientation="horizontal"
            aria-valuenow={Math.round((thumbLeft / Math.max(rect.width, 1)) * 100)}
            tabIndex={0}
            onMouseDown={handleThumbDown}
            className="custom-scrollbar-thumb absolute top-0 bottom-0 rounded-full bg-[var(--theme-text-muted)] hover:bg-[var(--theme-text-secondary)] transition-colors cursor-grab active:cursor-grabbing"
            style={{
              width: thumbWidth,
              transform: `translateX(${thumbLeft}px)`,
            }}
          />
        )}
      </div>
    </div>
  );
}
