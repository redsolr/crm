import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptTermsScreen } from "./AcceptTermsScreen";

export const metadata: Metadata = {
  title: "Accept the Terms",
  robots: { index: false, follow: false },
};

/**
 * The full-screen terms-acceptance gate (spec § 6.1). Deliberately a
 * standalone route segment — no app shell, no modal, no ESC, nothing
 * behind it. The 403 interceptor (`TermsGateListener`) routes here;
 * `GET /v1/terms/status` is the only platform call this screen needs
 * that is callable while gated.
 *
 * Suspense: the screen reads `useSearchParams` for the view-only
 * preview mode (`?preview=1` / `?preview=hold` / `&variant=member`) —
 * Next requires a boundary around CSR bailout during prerender.
 */
export default function AcceptTermsPage() {
  return (
    <Suspense>
      <AcceptTermsScreen />
    </Suspense>
  );
}
