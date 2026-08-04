"use client";

import { Suspense } from "react";
import { SalesContactsView } from "@/components/sales/SalesContactsView";

export default function SalesContactsPage() {
  return (
    // Suspense: the view reads useSearchParams (URL-routed peek) —
    // Next requires a boundary on statically rendered pages.
    <Suspense fallback={null}>
      <SalesContactsView />
    </Suspense>
  );
}
