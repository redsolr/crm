"use client";

/**
 * Inbox sub-route wrapper — resolves the Sales workspace bundle and
 * renders `<SalesCommitmentInbox />` under the CRM view header.
 */

import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import { SalesCommitmentInbox } from "./SalesCommitmentInbox";
import { SalesFollowupPanel } from "./SalesFollowupPanel";
import { CrmViewSkeleton } from "./crm/CrmViewSkeleton";

export function SalesInboxView() {
  const { bundle, isLoading } = useSalesWorkspaceBundle();

  if (isLoading) {
    return (
      <CrmViewSkeleton
        title="Inbox"
        meta="Every promise across every opportunity. No commitment dropped."
        testId="sales-inbox-view-skeleton"
      />
    );
  }

  if (!bundle) {
    return (
      <div className="sales-inbox-view flex-1 min-w-0 flex items-center justify-center">
        <span className="text-sm text-[var(--theme-text-muted)]">
          Setting up Sales for this organization…
        </span>
      </div>
    );
  }

  return (
    <div
      className="sales-inbox-view flex-1 min-w-0 overflow-y-auto"
      data-testid="sales-inbox-view"
    >
      <div className="crm-view-header">
        <h1 className="crm-view-title">Inbox</h1>
        <span className="crm-view-meta">
          Every promise across every opportunity. No commitment dropped.
        </span>
        <div className="flex-1" />
      </div>
      <SalesFollowupPanel bundle={bundle} />
      <SalesCommitmentInbox bundle={bundle} />
    </div>
  );
}
