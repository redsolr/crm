"use client";

/**
 * CrmRefreshIndicator — the "is this fresh?" signal of the
 * stale-while-revalidate model: a tiny spinner + label shown while a
 * background refetch is in flight OVER already-rendered rows. Owners
 * pass `isFetching && !isLoading` — a first load shows
 * CrmTableSkeleton instead, so this never doubles as a loading state,
 * and it must never block or dim the data it annotates.
 */

import { RefreshCw } from "lucide-react";

interface Props {
  active: boolean;
  testId?: string;
}

export function CrmRefreshIndicator({ active, testId }: Props) {
  if (!active) return null;
  return (
    <span
      className="crm-refresh-indicator"
      data-testid={testId}
      role="status"
      aria-label="Refreshing data"
    >
      <RefreshCw size={11} aria-hidden="true" />
      Updating…
    </span>
  );
}
