"use client";

import { Suspense } from "react";
import { SalesPipelineView } from "@/components/sales/SalesPipelineView";

export default function SalesPage() {
  return (
    // Suspense: the view reads useSearchParams (URL-routed peek) —
    // Next requires a boundary on statically rendered pages.
    <Suspense fallback={null}>
      <SalesPipelineView />
    </Suspense>
  );
}
