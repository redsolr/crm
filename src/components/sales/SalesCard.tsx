"use client";

import type { WorkItem } from "@/lib/workItemsApi";
import {
  todayDateString,
  type OpportunityAttributeSnapshot,
} from "@/lib/sales/use-opportunity-attributes";
import type { AccountAttributeSnapshot } from "@/lib/sales/use-account-attributes";
import { CompanyLogo } from "./CompanyLogo";

/**
 * Sales opportunity card body — the chrome rendered inside the shared <Board>
 * (and the drag clone). Attio-class card: title + urgency badge on the first
 * row, company logo + name on the second, next action + deal value on the
 * meta row.
 */
export function SalesCardBody({
  opportunity,
  account,
  attributes,
  accountAttributes,
  dragging,
}: {
  opportunity: WorkItem;
  account: WorkItem | undefined;
  attributes: OpportunityAttributeSnapshot | undefined;
  accountAttributes?: AccountAttributeSnapshot;
  dragging?: boolean;
}) {
  const today = todayDateString();
  const nextActionDate = attributes?.nextActionDate ?? null;
  const isOverdue =
    nextActionDate !== null &&
    nextActionDate < today &&
    opportunity.state.category !== "done" &&
    opportunity.state.category !== "dead";
  const isDueToday = nextActionDate === today;

  return (
    <article
      className={
        "sales-kanban-card-body rounded-lg border p-3 cursor-pointer text-left transition-colors " +
        (dragging
          ? "shadow-2xl border-[var(--theme-accent-border)] bg-[var(--theme-bg-tertiary)]"
          : "border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] hover:border-[var(--theme-border-hover)]")
      }
    >
      <div className="text-[13px] font-medium text-[var(--theme-text-primary)] truncate flex items-center gap-1.5">
        <span className="truncate">{opportunity.title}</span>
        {isOverdue && (
          <span
            data-testid="sales-kanban-card-overdue-badge"
            className="crm-badge-danger flex-shrink-0"
          >
            Overdue
          </span>
        )}
        {!isOverdue && isDueToday && (
          <span
            data-testid="sales-kanban-card-due-today-badge"
            className="crm-badge-warn flex-shrink-0"
          >
            Today
          </span>
        )}
      </div>
      {account && (
        <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
          <CompanyLogo
            name={account.title}
            domain={accountAttributes?.domain ?? null}
            size={14}
          />
          <span className="text-xs text-[var(--theme-text-muted)] truncate">
            {account.title}
          </span>
        </div>
      )}
      {!account && (
        <div className="text-xs text-[var(--theme-text-muted)] truncate mt-1">
          —
        </div>
      )}
      {(attributes?.nextAction || attributes?.valueEstimate != null) && (
        <div className="flex items-center gap-2 mt-2 min-w-0">
          {attributes?.nextAction ? (
            <span className="text-xs text-[var(--theme-text-secondary)] truncate">
              {attributes.nextAction}
            </span>
          ) : null}
          <span className="flex-1" />
          {attributes?.valueEstimate != null ? (
            <span className="text-xs font-medium tabular-nums text-[var(--crm-green)] flex-shrink-0">
              ${attributes.valueEstimate.toLocaleString()}
            </span>
          ) : null}
        </div>
      )}
    </article>
  );
}
