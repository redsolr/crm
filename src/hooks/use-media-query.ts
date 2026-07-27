import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query (e.g. `"(min-width: 768px)"`).
 * Returns `false` during SSR and the very first client render so
 * the rendered output matches the server, then switches to the
 * actual match value after hydration.
 *
 * Replaces the `useEffect(() => setMatches(...))` pattern that
 * trips `react-hooks/set-state-in-effect`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    [query],
  );
  const getClientSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);
  return useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    () => false,
  );
}
