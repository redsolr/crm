import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Returns `false` during SSR + the very first client render, then
 * `true` on every subsequent render. The canonical React 19 way to
 * gate "client-only" UI without tripping the
 * `react-hooks/set-state-in-effect` rule, replacing the older
 * `useState(false) + useEffect(() => setMounted(true), [])` pattern.
 *
 * The subscribe function is a no-op because the value never
 * changes after the first commit — `useSyncExternalStore` handles
 * the SSR-to-client transition automatically.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}
