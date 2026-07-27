import { useState, useRef, useCallback, useEffect } from "react";
import type { PanelKey } from "@/lib/ui-layout/schemas";
import { useUiLayoutStore } from "@/stores/ui-layout.store";

/**
 * Shared panel size presets — keeps all resizable panels consistent.
 *
 * Defaults tuned to match the "comfortable IDE" look (see the
 * reference VS Code screenshot): long file names and community
 * titles fit without truncation, and the chat panel has room for a
 * real conversation without wrapping every message at 3 words.
 * Users can still drag to shrink; min-widths prevent unreadable
 * 180px columns.
 *
 * When a panel opts in to persistence (passes `persistKey` to
 * `useResizePanel`), the user's stored width overrides the
 * `defaultWidth` below. Defaults remain the anonymous-user /
 * first-visit baseline.
 */
export const PANEL_SIZES = {
  sidebar: {
    defaultWidth: 360,
    minWidth: 220,
    maxWidthRatio: 0.35,
    maxWidthPx: 560,
  },
  chatPanel: {
    defaultWidth: 500,
    minWidth: 340,
    maxWidthRatio: 0.45,
    maxWidthPx: 780,
  },
} as const;

interface UseResizePanelOptions {
  defaultWidth: number;
  minWidth: number;
  maxWidthRatio?: number;
  /** "left" = drag handle on right edge (sidebar), "right" = drag handle on left edge (chat panel) */
  side: "left" | "right";
  /** Mobile width (e.g. "80vw", "100vw"). If set, width resets to viewport-based value on mobile. */
  mobileWidth?: number;
  mobileMaxWidthRatio?: number;
  /** Absolute max width in pixels — panel can never exceed this regardless of viewport */
  maxWidthPx?: number;
  /**
   * When set, user drag-end events write to `useUiLayoutStore` under
   * this key, which mirrors to localStorage and debounce-PATCHes the
   * backend. On mount, the stored width (if any) seeds `width`
   * instead of `defaultWidth`. Panels without a key remain
   * session-scoped — appropriate for transient drawers.
   */
  persistKey?: PanelKey;
}

export function useResizePanel({
  defaultWidth,
  minWidth,
  maxWidthRatio = 0.5,
  side,
  mobileWidth,
  mobileMaxWidthRatio = 0.8,
  maxWidthPx,
  persistKey,
}: UseResizePanelOptions) {
  // Read the stored width once at mount. Subscribing to the store
  // would cause a rerender every time *any* panel's width changes,
  // which is wrong — individual panels should own their width
  // locally after mount and just push updates back to the store.
  const storedWidth = useUiLayoutStore((s) =>
    persistKey != null ? s.panelWidths?.[persistKey] : undefined,
  );
  const setPanelWidth = useUiLayoutStore((s) => s.setPanelWidth);

  const initialWidth =
    storedWidth != null && storedWidth >= minWidth ? storedWidth : defaultWidth;

  const [width, setWidth] = useState(initialWidth);
  const [maxWidth, setMaxWidth] = useState(initialWidth * 2);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);

  // When the store hydrates from the backend after mount, adopt the
  // authoritative width — unless the user has already dragged in
  // this session. `isDragging` is the React-tracked equivalent of
  // `dragging.current` for render-time gating; the ref still drives
  // event-handler-internal synchronous reads. Adjusting state during
  // render (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // skips a setState-in-effect cascade.
  const [lastStoredWidth, setLastStoredWidth] = useState(storedWidth);
  if (storedWidth !== lastStoredWidth) {
    if (
      persistKey != null &&
      storedWidth != null &&
      storedWidth !== width &&
      !isDragging
    ) {
      setWidth(storedWidth);
    }
    setLastStoredWidth(storedWidth);
  }

  // Responsive: update sizes on window resize
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 768) {
        setIsDesktop(false);
        const mw = mobileWidth ?? Math.floor(w * mobileMaxWidthRatio);
        setMaxWidth(mw);
        setWidth(mw);
      } else {
        setIsDesktop(true);
        let newMax = Math.floor(w * maxWidthRatio);
        if (maxWidthPx) newMax = Math.min(newMax, maxWidthPx);
        setMaxWidth(newMax);
        setWidth((curr) => Math.min(Math.max(minWidth, curr), newMax));
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [minWidth, maxWidthRatio, mobileWidth, mobileMaxWidthRatio, maxWidthPx]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isDesktop) return;
      dragging.current = true;
      setIsDragging(true);
      document.body.style.cursor = "ew-resize";
      const startX = e.clientX;
      const startWidth = width;
      // Track the live dragged width separately from React state so
      // the mouseup handler can persist the final value without
      // relying on a stale closure of `width`.
      let latestWidth = startWidth;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta =
          side === "left" ? ev.clientX - startX : startX - ev.clientX;
        latestWidth = Math.max(
          minWidth,
          Math.min(startWidth + delta, maxWidth),
        );
        setWidth(latestWidth);
      };

      const onMouseUp = () => {
        dragging.current = false;
        setIsDragging(false);
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        // Persist drag-end width if this panel opted in. Debounce +
        // backend round-trip happen inside the store; we just fire
        // the intent. No-op for session-scoped panels.
        if (persistKey != null && latestWidth !== startWidth) {
          setPanelWidth(persistKey, latestWidth);
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width, minWidth, maxWidth, side, isDesktop, persistKey, setPanelWidth],
  );

  return {
    width,
    maxWidth,
    minWidth,
    isDesktop,
    handleMouseDown,
    isDragging,
  };
}
