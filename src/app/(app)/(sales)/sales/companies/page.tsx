"use client";

import { Suspense } from "react";
import { SalesCompaniesView } from "@/components/sales/SalesCompaniesView";

export default function SalesCompaniesPage() {
  return (
    // Suspense: the view reads useSearchParams (URL-routed peek) —
    // Next requires a boundary on statically rendered pages.
    <Suspense fallback={null}>
      <SalesCompaniesView />
    </Suspense>
  );
}
