"use client";

import React, { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import type { OpportunityAttributeSnapshot } from "@/lib/sales/use-opportunity-attributes";
import type { AccountAttributeSnapshot } from "@/lib/sales/use-account-attributes";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { useTransitionWorkItem } from "@/lib/sales/use-sales-mutations";
import type {
  BoardColumnDef,
  BoardDataSource,
} from "@/components/board/board-data-source";
import { SalesCardBody } from "./SalesCard";
import { TransitionToClosedModal } from "./TransitionToClosedModal";

// Per Pipedrive convention: closed stages don't appear on the active kanban
// unless the user opts in (the "show closed" toggle).
const ACTIVE_STAGE_KEYS: ReadonlyArray<string> = [
  "identified",
  "contacted",
  "replied",
  "call_booked",
  "call_done",
  "trial",
];
const CLOSED_STAGE_KEYS: ReadonlyArray<string> = ["won", "lost", "not_now"];

/**
 * Adapts the sales pipeline onto the shared <Board>: opportunities grouped by
 * stage, a stage-transition `moveCard` that intercepts drops onto `lost` /
 * `not_now` to open the reason-capture modal (returns null so the board reverts
 * until the modal completes), and a card that opens the opportunity detail.
 * Returns the `modal` so the caller renders it alongside the board.
 */
export function useSalesBoardSource({
  bundle,
  opportunities,
  accountsById,
  attributesById,
  accountAttributesById,
  showClosed,
  onOpenOpportunity,
}: {
  bundle: SalesWorkspaceBundle;
  opportunities: WorkItem[];
  accountsById: Record<string, WorkItem>;
  attributesById: Record<string, OpportunityAttributeSnapshot>;
  /** Account snapshots (logo domain etc.) keyed by account id. */
  accountAttributesById?: Record<string, AccountAttributeSnapshot>;
  showClosed: boolean;
  /** Card-click handler. Defaults to navigating to the full detail
   *  route; the pipeline view passes the peek-panel opener instead. */
  onOpenOpportunity?: (id: string) => void;
}): { source: BoardDataSource<WorkItem>; modal: ReactNode } {
  const router = useRouter();
  const openOpportunity =
    onOpenOpportunity ?? ((id: string) => router.push(`/sales/opportunity/${id}`));
  const transition = useTransitionWorkItem();
  const [closedTransition, setClosedTransition] = useState<{
    opportunity: WorkItem;
    nextStateKey: "lost" | "not_now";
  } | null>(null);

  const stages = showClosed
    ? [...ACTIVE_STAGE_KEYS, ...CLOSED_STAGE_KEYS]
    : [...ACTIVE_STAGE_KEYS];

  const columns: BoardColumnDef[] = stages.map((key) => ({
    id: key,
    title: key.replace(/_/g, " "),
    isDone: key === "won",
  }));

  const cardsByColumn: Record<string, WorkItem[]> = {};
  for (const key of stages) cardsByColumn[key] = [];
  for (const opp of opportunities) {
    const key = opp.state.key;
    if (key in cardsByColumn) cardsByColumn[key]!.push(opp);
  }

  const opportunityType = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.opportunity,
  );
  const opportunityDefs = opportunityType
    ? (bundle.attributeDefinitionsByType[opportunityType.id] ?? [])
    : [];

  const source: BoardDataSource<WorkItem> = {
    columns,
    cardsByColumn,
    cloneClassName: "w-72",
    moveCard: (id, toStage) => {
      const opp = opportunities.find((o) => o.id === id);
      // Same-stage drops are no-ops (the pipeline has no intra-stage order).
      if (!opp || toStage === opp.state.key) return Promise.resolve(true);
      // Closing a deal needs a reason — intercept and open the modal. Returning
      // null makes the board revert the optimistic move until the modal commits.
      if (toStage === "lost" || toStage === "not_now") {
        setClosedTransition({ opportunity: opp, nextStateKey: toStage });
        return Promise.resolve(null);
      }
      transition.mutate({ id, version: opp.version, state_key: toStage });
      return Promise.resolve(true);
    },
    renderCard: (opp, drag) => (
      <div
        ref={drag.setNodeRef}
        style={drag.style}
        data-card-id={opp.id}
        data-testid="sales-kanban-card"
        data-opportunity-id={opp.id}
        role="button"
        tabIndex={0}
        {...drag.attributes}
        {...drag.listeners}
        onClick={(e) => {
          if (drag.isDragging) return;
          e.stopPropagation();
          openOpportunity(opp.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            openOpportunity(opp.id);
          }
        }}
        className={`rounded-md ${
          drag.isSelected || drag.isNestTarget
            ? "ring-2 ring-inset ring-[var(--ctx-accent-primary,#FF385C)]"
            : ""
        }`}
      >
        <SalesCardBody
          opportunity={opp}
          account={accountsById[opp.parent_id ?? ""]}
          attributes={attributesById[opp.id]}
          accountAttributes={accountAttributesById?.[opp.parent_id ?? ""]}
        />
      </div>
    ),
  };

  const modal = closedTransition ? (
    <TransitionToClosedModal
      opportunityId={closedTransition.opportunity.id}
      opportunityVersion={closedTransition.opportunity.version}
      nextStateKey={closedTransition.nextStateKey}
      definitions={opportunityDefs}
      onClose={() => setClosedTransition(null)}
    />
  ) : null;

  return { source, modal };
}
