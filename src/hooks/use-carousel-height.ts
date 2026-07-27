"use client";

import { useRef, useState, useLayoutEffect } from "react";

/**
 * Measures the current slide's height using ResizeObserver.
 * Returns a ref for the track element, the measured height,
 * and whether the first measurement has been taken.
 */
export function useCarouselHeight(currentStep: number) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    setHeight(el.offsetHeight);
    setReady(true);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.borderBoxSize[0].blockSize);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [currentStep]);

  return { trackRef, height, ready };
}
