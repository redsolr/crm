"use client";

/**
 * Inbox tab — the Pipeline's landing surface (founder 2026-08-08):
 * the morning digest on top, then the follow-up queue ("Needs
 * attention") and the commitment inbox. Every promise across every
 * opportunity — no commitment dropped.
 *
 * Supersedes BOTH the standalone /sales/inbox view and the Summary
 * tab (deferred row 25 resolved): Summary's due/overdue + overlooked
 * sections re-rendered the same two engines this tab already owns
 * (followup-ranking + the commitments inbox), so the merge keeps one
 * surface per claim. /sales/inbox redirects here.
 */

import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import { SalesDigestCard } from "./SalesDigestCard";
import { SalesFollowupPanel } from "./SalesFollowupPanel";
import { SalesCommitmentInbox } from "./SalesCommitmentInbox";

export function SalesInboxTab({
  bundle,
  onOpenOpportunity,
}: {
  bundle: SalesWorkspaceBundle;
  onOpenOpportunity: (id: string) => void;
}) {
  return (
    <div
      className="sales-inbox-tab flex-1 min-h-0 overflow-y-auto pb-6"
      data-testid="sales-inbox-tab"
    >
      <div className="sales-inbox-digest mx-5 mt-4">
        <SalesDigestCard onOpenOpportunity={onOpenOpportunity} />
      </div>
      <SalesFollowupPanel bundle={bundle} />
      <SalesCommitmentInbox bundle={bundle} />
    </div>
  );
}
