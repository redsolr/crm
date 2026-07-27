"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Tracks the width of a container element using ResizeObserver.
 * Returns a ref to attach to the container and the current width.
 *
 * Usage:
 *   const { ref, width } = useContainerWidth();
 *   <div ref={ref}>...</div>
 *   if (width < 1000) { // hide column }
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(el);
    setWidth(el.clientWidth);

    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
