"use client";

/**
 * Sales pipeline board — now a thin adapter over the shared <Board>. The stage
 * columns, the stage-transition drag (with closed-stage modal interception),
 * and the opportunity card live in `useSalesBoardSource`; this component is just
 * the toolbar (show/hide closed) + the board + the modal. The old standalone
 * @dnd-kit implementation is gone — every board surface rides the one component.
 */

import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import type { OpportunityAttributeSnapshot } from "@/lib/sales/use-opportunity-attributes";
import type { AccountAttributeSnapshot } from "@/lib/sales/use-account-attributes";
import { Board } from "@/components/board/Board";
import { useSalesBoardSource } from "./use-sales-board-source";

interface Props {
  bundle: SalesWorkspaceBundle;
  opportunities: WorkItem[];
  accountsById: Record<string, WorkItem>;
  attributesById: Record<string, OpportunityAttributeSnapshot>;
  /** Account snapshots (logo domain etc.) keyed by account id. */
  accountAttributesById?: Record<string, AccountAttributeSnapshot>;
  showClosed: boolean;
  onToggleClosed: (showClosed: boolean) => void;
  /** Card-click handler — the pipeline view passes the peek opener. */
  onOpenOpportunity?: (id: string) => void;
}

export function SalesKanbanBoard({
  bundle,
  opportunities,
  accountsById,
  attributesById,
  accountAttributesById,
  showClosed,
  onToggleClosed,
  onOpenOpportunity,
}: Props) {
  const { source, modal } = useSalesBoardSource({
    bundle,
    opportunities,
    accountsById,
    attributesById,
    accountAttributesById,
    showClosed,
    onOpenOpportunity,
  });

  return (
    <>
      <div className="sales-kanban-toolbar px-5 py-2 flex items-center gap-2 border-b border-[var(--theme-border-primary)]">
        <span className="text-xs text-[var(--theme-text-muted)]">
          {showClosed
            ? "9 stages (closed visible)"
            : "6 active stages · won / lost / not_now hidden"}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          data-testid="sales-kanban-toggle-closed"
          onClick={() => onToggleClosed(!showClosed)}
          className="crm-btn-ghost crm-btn-xs"
        >
          {showClosed ? "Hide closed" : "Show closed"}
        </button>
      </div>
      <div
        className="sales-kanban-board flex min-h-0 flex-1 flex-col overflow-hidden"
        data-testid="sales-kanban-board"
      >
        <Board<WorkItem> source={source} />
      </div>
      {modal}
    </>
  );
}
