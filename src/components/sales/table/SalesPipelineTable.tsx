"use client";

/**
 * Pipeline table mode — the Attio-style flat-table alternative to the
 * kanban on /sales. Rides CrmRecordTable with opportunity rows:
 * title / account (with logo) / stage / value_estimate / next_action /
 * next_action_date / expected_close_date.
 *
 * The Stage column is an always-on inline select over the pipeline
 * states. Transitions to `lost` / `not_now` are intercepted and open
 * the existing TransitionToClosedModal (same discipline as the
 * kanban's `useSalesBoardSource.moveCard` — no reasonless closures);
 * every other stage change PATCHes directly via useTransitionWorkItem.
 *
 * The chip filters (All / Active / Overdue / …) stay upstream — the
 * caller passes the already-chip-filtered opportunity list; the
 * table's own filter bar + sort + saved views layer on top.
 */

import { useMemo, useState, type ReactNode } from "react";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import type { OpportunityAttributeSnapshot } from "@/lib/sales/use-opportunity-attributes";
import type { AccountAttributeSnapshot } from "@/lib/sales/use-account-attributes";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import {
  PIPELINE_STAGE_ORDER,
  SALES_TYPE_KEYS,
} from "@/lib/sales/constants";
import {
  useCreateOpportunity,
  useReorderOpportunities,
  useTransitionWorkItem,
  useUpsertAttributeValue,
  type PositionWrite,
} from "@/lib/sales/use-sales-mutations";
import {
  planReorder,
  positionBetween,
  renumberWrites,
  type ReorderWrite,
} from "@/lib/sales/reorder";
import { parseAttributeValueForType } from "@/lib/sales/attribute-editing";
import { fireActivation } from "@/lib/sales/activation";
import { formatTHB } from "@/lib/format-currency";
import { CompanyLogo } from "../CompanyLogo";
import { TransitionToClosedModal } from "../TransitionToClosedModal";
import { CrmRecordTable } from "./CrmRecordTable";
import {
  InlineOpportunityCreateRow,
  type InlineOpportunityInput,
} from "./InlineOpportunityCreateRow";
import type {
  CrmColumn,
  CrmTableViewState,
  TableFilters,
  TableSort,
} from "./table-model";
import { CrmViewSwitcher } from "./CrmViewSwitcher";

const DEFAULT_VIEW_STATE: CrmTableViewState = { filters: {}, sort: null };

interface Props {
  bundle: SalesWorkspaceBundle;
  /** Chip-filtered opportunity list (the caller owns the chip state). */
  opportunities: WorkItem[];
  accountsById: Record<string, WorkItem>;
  attributesById: Record<string, OpportunityAttributeSnapshot>;
  accountAttributesById: Record<string, AccountAttributeSnapshot>;
  onOpenOpportunity: (id: string) => void;
  /** Chip strip rendered INSIDE the toolbar row (Jira-class single
   *  control strip — chips · view switcher · column filters share one
   *  line in table mode). */
  filterChips?: ReactNode;
  /** Background refetch over visible rows (`isFetching && !isLoading`)
   *  — forwarded to CrmRecordTable's toolbar refresh indicator. */
  refreshing?: boolean;
}

export function SalesPipelineTable({
  bundle,
  opportunities,
  accountsById,
  attributesById,
  accountAttributesById,
  onOpenOpportunity,
  filterChips,
  refreshing,
}: Props) {
  const upsert = useUpsertAttributeValue();
  const transition = useTransitionWorkItem();
  const reorder = useReorderOpportunities(bundle.workspace.id);
  const createOpportunity = useCreateOpportunity();

  const [sort, setSort] = useState<TableSort | null>(null);
  const [filters, setFilters] = useState<TableFilters>({});
  const [closedTransition, setClosedTransition] = useState<{
    opportunity: WorkItem;
    nextStateKey: "lost" | "not_now";
  } | null>(null);

  const opportunityType = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.opportunity,
  );
  const opportunityDefs = useMemo(
    () =>
      opportunityType
        ? bundle.attributeDefinitionsByType[opportunityType.id] ?? []
        : [],
    [bundle.attributeDefinitionsByType, opportunityType],
  );

  const columns = useMemo<CrmColumn<WorkItem>[]>(() => {
    const defByKey: Record<string, AttributeDefinition> = {};
    for (const d of opportunityDefs) defByKey[d.key] = d;
    const snapshot = (opp: WorkItem) => attributesById[opp.id];

    /** Inline attribute commit — parse per data_type, then upsert. */
    const commitAttribute = (key: string) => (opp: WorkItem, raw: string) => {
      const def = defByKey[key];
      if (!def) {
        console.warn(
          `[SalesPipelineTable] no attribute definition for key "${key}" — edit dropped`,
        );
        return;
      }
      upsert.mutate({
        workItemId: opp.id,
        definitionId: def.id,
        value: parseAttributeValueForType(raw, def.data_type),
      });
    };

    return [
      {
        id: "title",
        label: "Opportunity",
        getValue: (opp) => opp.title,
        sortable: true,
        filter: { type: "text" },
        headerClassName: "pl-5",
        cellClassName: "pl-5 font-medium text-[var(--theme-text-primary)]",
        render: (opp) => <span className="truncate">{opp.title}</span>,
      },
      {
        id: "account",
        label: "Company",
        getValue: (opp) =>
          accountsById[opp.parent_id ?? ""]?.title ?? null,
        sortable: true,
        render: (opp) => {
          const account = accountsById[opp.parent_id ?? ""];
          if (!account) return "—";
          return (
            <span className="flex items-center gap-2 min-w-0">
              <CompanyLogo
                name={account.title}
                domain={
                  accountAttributesById[account.id]?.domain ?? null
                }
                size={16}
              />
              <span className="truncate">{account.title}</span>
            </span>
          );
        },
      },
      {
        id: "stage",
        label: "Stage",
        getValue: (opp) => {
          const idx = PIPELINE_STAGE_ORDER.indexOf(opp.state.key);
          return idx === -1 ? null : idx;
        },
        sortable: true,
        render: (opp) => (
          // Keyed by the server stage: when the refetch lands, the cell
          // remounts and drops its optimistic override.
          <StageSelectCell
            key={opp.state.key}
            opportunity={opp}
            onTransition={async (nextStateKey) => {
              // Closing a deal needs a reason — intercept and open the
              // modal (same rule as the kanban's moveCard).
              if (nextStateKey === "lost" || nextStateKey === "not_now") {
                setClosedTransition({ opportunity: opp, nextStateKey });
                return "intercepted";
              }
              try {
                await transition.mutateAsync({
                  id: opp.id,
                  version: opp.version,
                  state_key: nextStateKey,
                });
                return "applied";
              } catch (err) {
                console.error(
                  `[SalesPipelineTable] stage transition to "${nextStateKey}" failed for ${opp.id}:`,
                  err,
                );
                return "failed";
              }
            }}
          />
        ),
      },
      {
        id: "value_estimate",
        label: "Value",
        getValue: (opp) => snapshot(opp)?.valueEstimate ?? null,
        sortable: true,
        align: "right",
        render: (opp) => {
          const v = snapshot(opp)?.valueEstimate ?? null;
          return v === null ? "—" : formatTHB(v);
        },
        edit: {
          dataType: "number",
          getEditValue: (opp) => {
            const v = snapshot(opp)?.valueEstimate ?? null;
            return v === null ? "" : String(v);
          },
          commit: commitAttribute("value_estimate"),
        },
      },
      {
        id: "next_action",
        label: "Next action",
        getValue: (opp) => snapshot(opp)?.nextAction ?? null,
        filter: { type: "text" },
        cellClassName: "max-w-xs truncate",
        render: (opp) => snapshot(opp)?.nextAction ?? "—",
        edit: {
          dataType: "text",
          getEditValue: (opp) => snapshot(opp)?.nextAction ?? "",
          commit: commitAttribute("next_action"),
        },
      },
      {
        id: "next_action_date",
        label: "Next action date",
        getValue: (opp) => snapshot(opp)?.nextActionDate ?? null,
        sortable: true,
        // Dates line-break after their hyphens in squeezed columns,
        // inflating the row (41 → 59px) — never wrap them.
        cellClassName: "whitespace-nowrap",
        render: (opp) => snapshot(opp)?.nextActionDate ?? "—",
        edit: {
          dataType: "date",
          getEditValue: (opp) => snapshot(opp)?.nextActionDate ?? "",
          commit: commitAttribute("next_action_date"),
        },
      },
      {
        id: "expected_close_date",
        label: "Expected close",
        getValue: (opp) => snapshot(opp)?.expectedCloseDate ?? null,
        sortable: true,
        cellClassName: "whitespace-nowrap",
        render: (opp) => snapshot(opp)?.expectedCloseDate ?? "—",
        edit: {
          dataType: "date",
          getEditValue: (opp) => snapshot(opp)?.expectedCloseDate ?? "",
          commit: commitAttribute("expected_close_date"),
        },
      },
    ];
  }, [
    opportunityDefs,
    attributesById,
    accountsById,
    accountAttributesById,
    upsert,
    transition,
  ]);

  const accountsList = useMemo(
    () =>
      Object.values(accountsById).sort((a, b) =>
        a.title.localeCompare(b.title),
      ),
    [accountsById],
  );

  /** Attach `If-Match` versions to a reorder plan, dropping rows we
   *  can't version (shouldn't happen — the plan comes from the same
   *  rows). */
  const withVersions = (
    writes: ReorderWrite[],
    rows: WorkItem[],
  ): PositionWrite[] => {
    const versionById = new Map(rows.map((o) => [o.id, o.version]));
    return writes.flatMap((w) => {
      const version = versionById.get(w.id);
      if (version === undefined) {
        console.warn(
          `[SalesPipelineTable] no version for ${w.id} — position write dropped`,
        );
        return [];
      }
      return [{ ...w, version }];
    });
  };

  /** Drag-to-rearrange drop: persist the moved row's new rank (one
   *  midpoint write on a healthy list; degenerate imported ranks
   *  renumber the whole visible order — see reorder.ts). */
  const handleReorder = (moved: WorkItem, finalOrder: WorkItem[]) => {
    const plan = planReorder(
      finalOrder.map((o) => ({ id: o.id, position: o.position })),
      moved.id,
    );
    if (plan.length === 0) return;
    reorder.mutate(withVersions(plan, finalOrder));
  };

  /** Inline create (between rows or at the end). Between rows the new
   *  record is created directly AT the midpoint rank; when the
   *  neighbors carry degenerate ranks (imported rows all at 0) it is
   *  created at the end and the list is renumbered into the intended
   *  slot right after. The heal uses the chip-filtered list — with the
   *  default "All" chip that is the full set. */
  const submitInlineCreate = async (
    slot: { before: WorkItem | null; after: WorkItem | null },
    input: InlineOpportunityInput,
  ) => {
    const between = slot.after !== null;
    const target = between
      ? positionBetween(
          slot.before?.position ?? null,
          slot.after?.position ?? null,
        )
      : null;
    const created = await createOpportunity.mutateAsync({
      title: input.title,
      workspace_id: bundle.workspace.id,
      parent_id: input.accountId,
      position: between && target !== null ? target : undefined,
      definitions: opportunityDefs,
      attributes: { use_case: input.useCase },
    });
    if (between && target === null && slot.after !== null) {
      const afterId = slot.after.id;
      const ordered = opportunities.filter((o) => o.id !== created.id);
      const afterIndex = ordered.findIndex((o) => o.id === afterId);
      ordered.splice(
        afterIndex === -1 ? ordered.length : afterIndex,
        0,
        created,
      );
      const writes = renumberWrites(
        ordered.map((o) => ({ id: o.id, position: o.position })),
      );
      if (writes.length > 0) reorder.mutate(withVersions(writes, ordered));
    }
    fireActivation("first_opportunity_created", {
      opportunity_id: created.id,
      use_case: input.useCase,
    });
  };

  // Note: the `sales-pipeline-table` testid lives on the inner <table>
  // (CrmRecordTable's `${testIdPrefix}-table`) — don't duplicate it on
  // this wrapper, Playwright strict mode rejects ambiguous testids.
  return (
    <div className="sales-pipeline-table-view flex-1 min-h-0 flex flex-col">
      <CrmRecordTable<WorkItem>
        rows={opportunities}
        columns={columns}
        getRowId={(opp) => opp.id}
        sort={sort}
        onSortChange={setSort}
        filters={filters}
        onFiltersChange={setFilters}
        onRowClick={(opp) => onOpenOpportunity(opp.id)}
        onReorder={handleReorder}
        inlineCreate={({ before, after, close }) => (
          <InlineOpportunityCreateRow
            accounts={accountsList}
            atEnd={after === null}
            onSubmit={(input) => submitInlineCreate({ before, after }, input)}
            onClose={close}
          />
        )}
        testIdPrefix="sales-pipeline"
        refreshing={refreshing}
        toolbar={
          <>
            {filterChips}
            <CrmViewSwitcher
              surface="crm_pipeline"
              state={{ filters, sort }}
              defaultState={DEFAULT_VIEW_STATE}
              onApplyState={(state) => {
                setFilters(state.filters);
                setSort(state.sort);
              }}
              testIdPrefix="sales-pipeline"
            />
          </>
        }
        renderFooter={(visible) => {
          const total = visible.reduce(
            (sum, opp) => sum + (attributesById[opp.id]?.valueEstimate ?? 0),
            0,
          );
          return (
            <>
              {visible.length} opportunit{visible.length === 1 ? "y" : "ies"} ·{" "}
              {formatTHB(total)} total value
            </>
          );
        }}
      />
      {closedTransition && (
        <TransitionToClosedModal
          opportunityId={closedTransition.opportunity.id}
          opportunityVersion={closedTransition.opportunity.version}
          nextStateKey={closedTransition.nextStateKey}
          definitions={opportunityDefs}
          onClose={() => setClosedTransition(null)}
        />
      )}
    </div>
  );
}

type StageTransitionResult = "applied" | "intercepted" | "failed";

/**
 * Always-on stage select. Holds an optimistic local value from the
 * moment of the pick so the select never flickers back to the stale
 * stage while the PATCH + list refetch are in flight. Intercepted
 * (closed-stage modal) and failed transitions clear the override so
 * the select reverts to the server truth.
 */
function StageSelectCell({
  opportunity,
  onTransition,
}: {
  opportunity: WorkItem;
  onTransition: (nextStateKey: string) => Promise<StageTransitionResult>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const serverValue = opportunity.state.key;
  // Once the refetch catches up, the override is redundant — render
  // server truth (pending only bridges the gap).
  const value = pending ?? serverValue;

  return (
    <select
      className="crm-stage-select"
      data-testid="sales-pipeline-stage-select"
      value={value}
      aria-label="Pipeline stage"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        const next = e.target.value;
        if (next === serverValue) return;
        setPending(next);
        void onTransition(next).then((result) => {
          if (result !== "applied") setPending(null);
        });
      }}
    >
      {PIPELINE_STAGE_ORDER.map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
