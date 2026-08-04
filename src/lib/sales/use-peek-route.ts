"use client";

/**
 * URL-routed peek state — `?peek=<workItemId>` on the current list
 * route (founder ask 2026-08-04: record details must be shareable and
 * back-button friendly).
 *
 * Contract:
 *   - open  → push  (`/sales?peek=wi_x`) — browser Back closes the
 *     peek, and the link is shareable/team-pasteable as-is;
 *   - close → replace (strip the param) — no history spam, and a
 *     directly-opened share link closes into the plain list instead
 *     of leaving the app.
 *
 * Views read `peekId` from the URL as the single source of truth —
 * no local peek state anywhere.
 */

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const PEEK_PARAM = "peek";

export function usePeekRoute(): {
  peekId: string | null;
  openPeek: (id: string) => void;
  closePeek: () => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const peekId = searchParams.get(PEEK_PARAM);

  const openPeek = useCallback(
    (id: string) => {
      router.push(`${pathname}?${PEEK_PARAM}=${encodeURIComponent(id)}`, {
        scroll: false,
      });
    },
    [router, pathname],
  );

  const closePeek = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  return { peekId, openPeek, closePeek };
}
