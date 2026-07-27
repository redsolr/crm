import { useSyncExternalStore } from "react";

/**
 * Returns the current epoch millisecond, snapshotted at the start of
 * each calendar day so that components computing "days until X" or
 * "X days ago" don't trigger a render every microsecond.
 *
 * Calling `Date.now()` directly inside render trips
 * `react-hooks/purity` because it's an impure read; threading the
 * value through `useSyncExternalStore` with a daily-rotation
 * subscription gives the React 19 compiler a stable handle while
 * keeping the visible value fresh.
 *
 * SSR safe: server snapshot returns 0, which yields negative
 * "daysRemaining" for any concrete due_date — UI typically renders
 * "—" or hides the badge until hydration commits, at which point
 * the real value flows in.
 */
export function useToday(): number {
  return useSyncExternalStore(subscribeToMidnight, getDayStart, getServerStart);
}

function getDayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getServerStart(): number {
  return 0;
}

function subscribeToMidnight(notify: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  let id: number;
  const schedule = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    id = window.setTimeout(() => {
      notify();
      // Re-arm for the following midnight so a long-lived tab keeps
      // ticking forward day-by-day instead of going stale after the
      // first rotation. Note: browsers throttle background timers so
      // a sleeping tab may miss midnights and only catch up when the
      // user returns — the next user interaction triggers a render
      // that re-snapshots `getDayStart()` correctly.
      schedule();
    }, tomorrow.getTime() - now.getTime());
  };
  schedule();
  return () => window.clearTimeout(id);
}
