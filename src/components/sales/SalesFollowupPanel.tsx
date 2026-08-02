"use client";

/**
 * "Needs attention" — the follow-up intelligence strip at the top of the
 * Inbox (Folk/Close class). Deterministic neglect ranking over active
 * opportunities: overdue next actions first, then deals with no planned
 * step, then stale deals. Each row jumps straight to the opportunity.
 */

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  useAccountsQuery,
  useOpportunitiesQuery,
} from "@/lib/sales/use-sales-queries";
import {
  useFollowupSuggestions,
  type FollowupReason,
} from "@/lib/sales/use-followup-suggestions";
import { useAccountAttributes } from "@/lib/sales/use-account-attributes";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { CompanyLogo } from "./CompanyLogo";

const REASON_BADGE: Record<FollowupReason, { label: string; className: string }> = {
  overdue_next_action: { label: "Overdue", className: "crm-badge-danger" },
  revisit_due: { label: "Revisit", className: "crm-badge-warn" },
  due_today: { label: "Due today", className: "crm-badge-warn" },
  no_next_action: { label: "No next step", className: "crm-badge-warn" },
  stale: { label: "Going cold", className: "crm-tag" },
};

export function SalesFollowupPanel({
  bundle,
}: {
  bundle: SalesWorkspaceBundle;
}) {
  const router = useRouter();
  const workspaceId = bundle.workspace.id;
  const opportunities = useOpportunitiesQuery(workspaceId);
  const accounts = useAccountsQuery(workspaceId);

  const opportunityType = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.opportunity,
  );
  const opportunityDefs = opportunityType
    ? bundle.attributeDefinitionsByType[opportunityType.id] ?? []
    : [];
  const accountType = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.account,
  );
  const accountDefs = accountType
    ? bundle.attributeDefinitionsByType[accountType.id] ?? []
    : [];

  const allOpportunities = useMemo(
    () => opportunities.data?.data ?? [],
    [opportunities.data?.data],
  );
  const allAccounts = useMemo(
    () => accounts.data?.data ?? [],
    [accounts.data?.data],
  );
  const accountsById = useMemo(
    () => Object.fromEntries(allAccounts.map((a) => [a.id, a])),
    [allAccounts],
  );

  const suggestions = useFollowupSuggestions(
    allOpportunities,
    opportunityDefs,
    accountsById,
  );
  const accountAttrsById = useAccountAttributes(allAccounts, accountDefs);

  if (suggestions.length === 0) return null;

  return (
    <section
      className="sales-followup-panel crm-panel mx-5 mt-4"
      data-testid="sales-followup-panel"
    >
      <div className="flex items-center gap-2 mb-3">
        <h2 className="crm-panel-title">Needs attention</h2>
        <span className="text-xs text-[var(--theme-text-muted)]">
          who deserves a follow-up next
        </span>
      </div>
      <ul className="space-y-1.5">
        {suggestions.map((s) => {
          const badge = REASON_BADGE[s.reason];
          return (
            <li key={s.opportunity.id}>
              <button
                type="button"
                data-testid="sales-followup-row"
                data-reason={s.reason}
                className="crm-row-card crm-row-card-inset w-full text-left"
                onClick={() =>
                  router.push(`/sales/opportunity/${s.opportunity.id}`)
                }
              >
                {s.account && (
                  <CompanyLogo
                    name={s.account.title}
                    domain={accountAttrsById[s.account.id]?.domain ?? null}
                    size={16}
                  />
                )}
                <span className="flex-1 min-w-0 truncate text-[13px] text-[var(--theme-text-primary)]">
                  {s.opportunity.title}
                </span>
                {s.nextAction && (
                  <span className="text-xs text-[var(--theme-text-muted)] truncate max-w-[200px]">
                    {s.nextAction}
                  </span>
                )}
                <span className="text-xs text-[var(--theme-text-secondary)] flex-shrink-0">
                  {s.detail}
                </span>
                <span className={`${badge.className} flex-shrink-0`}>
                  {badge.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
