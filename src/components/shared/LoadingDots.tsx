"use client";

/**
 * App loading indicator — three staggered pulsing dots (see
 * `.loading-dots` in globals.css). The ONE loader for boot/full-screen
 * waits, replacing the legacy `animate-spin border-white` ring, which
 * was theme-blind (invisible-ish on light themes) and dated. Small
 * inline button spinners keep their local idiom; this is for surface-
 * level "the app is coming up" states.
 */

export function LoadingDots({ label }: { label?: string }) {
  return (
    <div
      className="loading-dots"
      role="status"
      aria-label={label ?? "Loading"}
    >
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
