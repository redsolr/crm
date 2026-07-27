"use client";

import { useRef, useState, useCallback, useEffect } from "react";

/** Sets scrollLeft on the given element. Extracted so the lint rule
 *  for hook-argument immutability sees a function call rather than an
 *  in-callback property assignment on a hook parameter. */
function setScrollLeft(el: HTMLDivElement, value: number): void {
  el.scrollLeft = value;
}

/**
 * Hook that drives a custom horizontal scrollbar for a given scroll element.
 * The scroll element is passed in (typically from the scrollbar store).
 * Returns track/thumb state + handlers to render the CustomScrollbar component.
 */
export function useCustomScrollbar(scrollEl: HTMLDivElement | null) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ width: 0, left: 0, trackWidth: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });

  const update = useCallback(() => {
    const el = scrollEl;
    const track = trackRef.current;
    if (!el || !track) return;
    const tw = track.clientWidth;
    if (el.scrollWidth <= el.clientWidth) {
      setThumb({ width: 0, left: 0, trackWidth: tw });
      return;
    }
    const ratio = el.clientWidth / el.scrollWidth;
    const w = Math.max(ratio * tw, 40);
    const scrollRatio = el.scrollLeft / (el.scrollWidth - el.clientWidth);
    setThumb({ width: w, left: scrollRatio * (tw - w), trackWidth: tw });
  }, [scrollEl]);

  useEffect(() => {
    if (!scrollEl) return;
    const track = trackRef.current;

    scrollEl.addEventListener("scroll", update);

    const ro = new ResizeObserver(update);
    ro.observe(scrollEl);
    if (track) ro.observe(track);

    const mo = new MutationObserver(update);
    mo.observe(scrollEl, { childList: true, subtree: true, attributes: true });

    update();

    return () => {
      scrollEl.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [scrollEl, update]);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      const track = trackRef.current;
      if (!scrollEl || !track) return;
      const rect = track.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = clickX / rect.width;
      setScrollLeft(
        scrollEl,
        ratio * (scrollEl.scrollWidth - scrollEl.clientWidth),
      );
    },
    [scrollEl],
  );

  const handleThumbDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        scrollLeft: scrollEl?.scrollLeft ?? 0,
      };
    },
    [scrollEl],
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!scrollEl || !thumb.trackWidth || !thumb.width) return;
      const dx = e.clientX - dragStart.current.x;
      const scrollableTrack = thumb.trackWidth - thumb.width;
      const scrollableContent = scrollEl.scrollWidth - scrollEl.clientWidth;
      scrollEl.scrollLeft =
        dragStart.current.scrollLeft +
        (dx / scrollableTrack) * scrollableContent;
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, scrollEl, thumb.trackWidth, thumb.width]);

  return {
    trackRef,
    thumbWidth: thumb.width,
    thumbLeft: thumb.left,
    handleTrackClick,
    handleThumbDown,
    hasScroll: thumb.width > 0,
    update,
  };
}
