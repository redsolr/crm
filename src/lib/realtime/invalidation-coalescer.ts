/**
 * Coalesces bursts of realtime `invalidate` frames into bounded
 * refetch work (CI red 2026-08-03, run 30827170864): every write by
 * every connected client broadcasts an invalidate, and firing
 * `invalidateQueries` per frame cancels/restarts in-flight refetches —
 * under a busy room (parallel e2e specs, a busy team) the record
 * queries churn and never settle, so views serve stale rows and
 * If-Match writes 412.
 *
 * Leading edge fires immediately (solo-user latency unchanged); frames
 * arriving inside the window collapse into ONE trailing fire.
 */

export interface InvalidationCoalescer {
  /** Call per incoming invalidate frame. */
  schedule: () => void;
  /** Drop any pending trailing fire (socket teardown). */
  dispose: () => void;
}

export function createInvalidationCoalescer(
  fire: () => void,
  windowMs = 400,
): InvalidationCoalescer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;

  const schedule = () => {
    if (timer !== null) {
      pending = true;
      return;
    }
    fire();
    timer = setTimeout(() => {
      timer = null;
      if (pending) {
        pending = false;
        schedule();
      }
    }, windowMs);
  };

  return {
    schedule,
    dispose: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = false;
    },
  };
}
