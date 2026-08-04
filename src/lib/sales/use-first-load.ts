"use client";

/**
 * First-load latch for skeleton gates. Returns true only while the
 * FIRST load of a surface is still in flight — once `loading` has
 * been false a single time, it latches and never returns true again
 * for the lifetime of the mount.
 *
 * Why: the table skeleton gates fold in the per-row attribute
 * fan-outs (rows must land fully hydrated). But a record created
 * mid-session mounts a fresh fan-out query, briefly re-raising the
 * aggregate `isLoading` — without the latch the whole view would
 * bounce back to skeleton over data the user is looking at. A tab
 * revisit remounts the view, resetting the latch; with cached data
 * `loading` starts false, so no skeleton shows.
 */

import { useEffect, useState } from "react";

export function useFirstLoad(loading: boolean): boolean {
  const [everLoaded, setEverLoaded] = useState(false);
  useEffect(() => {
    if (!loading && !everLoaded) setEverLoaded(true);
  }, [loading, everLoaded]);
  return loading && !everLoaded;
}
