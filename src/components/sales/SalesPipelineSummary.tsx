"use client";

/**
 * Pipeline Summary tab — the day-start feed (2026-08-04, founder-
 * approved after the modern-CRM scan: Attio Home / Pipedrive Pulse /
 * Close Inbox all converge on "work your day", not charts).
 *
 * Sections:
 *   1. Pulse strip — active deals · active value · due counts.
 *   2. Due & overdue — next actions and commitments MERGED into one
 *      dated list (the two due-date systems finally share a surface).
 *      Commitment rows mark done inline; action rows open the peek.
 *   3. Overlooked deals — active opportunities with NO next action
 *      (Pipedrive's "overlooked" idea; same set as the
 *      no_next_action chip, surfaced proactively).
 *
 * Charts stay in Reports; this surface is for acting, not analyzing.
 * The commitment Inbox still exists as its own view — folding it in
 * fully is queued (its retirement needs the e2e journey-net rework).
 */

import { useQueryClient } from "@tanstack/react-query";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import type { OpportunityAttributeSnapshot } from "@/lib/sales/use-opportunity-attributes";
import { todayDateString } from "@/lib/sales/use-opportunity-attributes";
import {
  useCommitmentsInbox,
  type InboxCommitmentRow,
} from "@/lib/sales/use-commitments-inbox";
import { COMMITMENT_STATE_KEYS, SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { useTransitionWorkItem } from "@/lib/sales/use-sales-mutations";
import { fireActivation } from "@/lib/sales/activation";
import { queryKeys } from "@/queries/query-keys";
import { formatTHB } from "@/lib/format-currency";
import { CompanyLogo } from "./CompanyLogo";

interface Props {
  bundle: SalesWorkspaceBundle;
  /** ALL opportunities (unfiltered — the summary owns its slicing). */
  opportunities: WorkItem[];
  accountsById: Record<string, WorkItem>;
  attributesById: Record<string, OpportunityAttributeSnapshot>;
  accountDomainsById: Record<string, { domain: string | null }>;
  activePipelineValue: number;
  onOpenOpportunity: (id: string) => void;
}

const isActive = (o: WorkItem) =>
  o.state.category !== "done" && o.state.category !== "dead";

export function SalesPipelineSummary({
  bundle,
  opportunities,
  accountsById,
  attributesById,
  accountDomainsById,
  activePipelineValue,
  onOpenOpportunity,
}: Props) {
  const queryClient = useQueryClient();
  const transition = useTransitionWorkItem();

  const commitmentType = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.commitment,
  );
  const commitmentDefs = commitmentType
    ? bundle.attributeDefinitionsByType[commitmentType.id] ?? []
    : [];
  const inbox = useCommitmentsInbox(bundle.workspace.id, commitmentDefs);

  const today = todayDateString();
  const activeOpps = opportunities.filter(isActive);

  // Next actions due (date <= today), oldest first.
  const dueActions = activeOpps
    .filter((o) => {
      const d = attributesById[o.id]?.nextActionDate ?? null;
      return d !== null && d <= today;
    })
    .sort(
      (a, b) =>
        (attributesById[a.id]?.nextActionDate ?? "").localeCompare(
          attributesById[b.id]?.nextActionDate ?? "",
        ),
    );

  const dueCommitments = [
    ...inbox.buckets.overdue,
    ...inbox.buckets.due_today,
  ];

  const overlooked = activeOpps.filter(
    (o) => (attributesById[o.id]?.nextActionDate ?? null) === null,
  );

  // Same completion semantics as the Inbox (incl. the activation
  // event) — a promise closed from the summary counts the same.
  const markDone = (row: InboxCommitmentRow) => {
    transition.mutate(
      {
        id: row.commitment.id,
        version: row.commitment.version,
        state_key: COMMITMENT_STATE_KEYS.done,
      },
      {
        onSuccess: () => {
          fireActivation("first_commitment_completed", {
            commitment_id: row.commitment.id,
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.workItems.all,
          });
        },
      },
    );
  };

  const companyOf = (opp: WorkItem) =>
    opp.parent_id ? accountsById[opp.parent_id] : undefined;

  return (
    <div
      className="sales-pipeline-summary flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6"
      data-testid="sales-pipeline-summary"
    >
      {/* ── Pulse strip ── */}
      <div className="crm-summary-pulse" data-testid="summary-pulse">
        <span>
          {activeOpps.length} active deal{activeOpps.length === 1 ? "" : "s"}
        </span>
        <span className="crm-summary-pulse-value">
          {formatTHB(activePipelineValue)}
        </span>
        {dueActions.length + dueCommitments.length > 0 ? (
          <span className="crm-summary-pulse-due">
            {dueActions.length + dueCommitments.length} due
          </span>
        ) : (
          <span className="crm-summary-pulse-clear">nothing overdue</span>
        )}
      </div>

      {/* ── Due & overdue ── */}
      <section data-testid="summary-due-section">
        <h2 className="crm-summary-heading">Due &amp; overdue</h2>
        {inbox.isLoading && dueActions.length === 0 ? (
          <p className="crm-summary-empty">Loading…</p>
        ) : dueActions.length === 0 && dueCommitments.length === 0 ? (
          <p className="crm-summary-empty" data-testid="summary-due-empty">
            Nothing due — you&apos;re clear. Line up next actions so the
            pipeline keeps moving.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {dueCommitments.map((row) => (
              <li
                key={row.commitment.id}
                className="crm-row-card"
                data-testid="summary-commitment-row"
              >
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() =>
                    row.parent && onOpenOpportunity(row.parent.id)
                  }
                >
                  <div className="text-[13px] font-medium text-[var(--theme-text-primary)] truncate">
                    {row.commitment.title}
                  </div>
                  <div className="text-xs text-[var(--theme-text-muted)] truncate mt-0.5">
                    Promise{row.parent ? ` · ${row.parent.title}` : ""}
                    {row.dueDate
                      ? ` · due ${row.dueDate}`
                      : ""}
                  </div>
                </button>
                <span
                  className={
                    row.bucket === "overdue" ? "crm-badge-danger" : "crm-tag"
                  }
                >
                  {row.bucket === "overdue" ? "overdue" : "today"}
                </span>
                <button
                  type="button"
                  data-testid="summary-commitment-done"
                  onClick={() => markDone(row)}
                  className="crm-btn-ghost crm-btn-xs"
                >
                  Mark done
                </button>
              </li>
            ))}
            {dueActions.map((opp) => {
              const attrs = attributesById[opp.id];
              const account = companyOf(opp);
              const overdue =
                (attrs?.nextActionDate ?? "") < today;
              return (
                <li key={opp.id}>
                  <button
                    type="button"
                    className="crm-row-card w-full text-left"
                    data-testid="summary-action-row"
                    onClick={() => onOpenOpportunity(opp.id)}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-[var(--theme-text-primary)] truncate">
                        {attrs?.nextAction ?? "Next action"}
                      </span>
                      <span className="block text-xs text-[var(--theme-text-muted)] truncate mt-0.5">
                        {opp.title}
                        {account ? ` · ${account.title}` : ""}
                      </span>
                    </span>
                    <span
                      className={overdue ? "crm-badge-danger" : "crm-tag"}
                    >
                      {overdue ? attrs?.nextActionDate : "today"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Overlooked deals ── */}
      <section data-testid="summary-overlooked-section">
        <h2 className="crm-summary-heading">Overlooked deals</h2>
        {overlooked.length === 0 ? (
          <p
            className="crm-summary-empty"
            data-testid="summary-overlooked-empty"
          >
            Every active deal has a next action. Clean board.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {overlooked.map((opp) => {
              const account = companyOf(opp);
              const value = attributesById[opp.id]?.valueEstimate ?? 0;
              return (
                <li key={opp.id}>
                  <button
                    type="button"
                    className="crm-row-card w-full text-left"
                    data-testid="summary-overlooked-row"
                    onClick={() => onOpenOpportunity(opp.id)}
                  >
                    <span className="flex-1 min-w-0 flex items-center gap-2">
                      {account && (
                        <CompanyLogo
                          name={account.title}
                          domain={
                            accountDomainsById[account.id]?.domain ?? null
                          }
                          size={16}
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-[var(--theme-text-primary)] truncate">
                          {opp.title}
                        </span>
                        <span className="block text-xs text-[var(--theme-text-muted)] truncate mt-0.5">
                          {opp.state.key.replace(/_/g, " ")}
                          {value > 0 ? ` · ${formatTHB(value)}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="crm-badge-warn">no next action</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
