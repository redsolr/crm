"use client";

import { Suspense } from "react";
import { SalesInterviewsView } from "@/components/sales/SalesInterviewsView";

/**
 * Suspense: the view reads `useSearchParams` for the ⌘K deep-link
 * (`?new=1` opens the quick-create) — Next requires a boundary around
 * the CSR bailout during prerender.
 */
export default function SalesInterviewsPage() {
  return (
    <Suspense>
      <SalesInterviewsView />
    </Suspense>
  );
}
