"use client";

/**
 * Companies table — Attio-class flat record list of every account in
 * the Sales workspace, rendered through the reusable CrmRecordTable:
 * click-to-sort headers, a dense filter bar (source/segment by option,
 * name/URL/pain by contains), inline type-aware cell editing (source,
 * segment, company URL, pain summary), and saved views (`/api/views`,
 * surface `crm_companies`).
 *
 * Default sort stays "last activity, newest first" — the signal that
 * makes the list read as a living pipeline; the sort chip declares it
 * whenever that default is active. Each row opens the right-snap peek
 * panel; the panel's expand button promotes to the account detail page.
 */

import { useMemo, useState } from "react";
import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  useAccountsQuery,
  useOpportunitiesQuery,
} from "@/lib/sales/use-sales-queries";
import { useAttributeValuesByItem } from "@/lib/sales/use-item-attribute-values";
import { useFirstLoad } from "@/lib/sales/use-first-load";
import { useUpsertAttributeValue } from "@/lib/sales/use-sales-mutations";
import {
  SALES_TYPE_KEYS,
  ACCOUNT_SOURCE_OPTIONS,
  ACCOUNT_SEGMENT_OPTIONS,
} from "@/lib/sales/constants";
import { parseAttributeValueForType } from "@/lib/sales/attribute-editing";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import type { WorkItem } from "@/lib/workItemsApi";
import { latestActivity, timeAgo } from "@/lib/sales/relative-time";
import { domainFromUrl } from "@/lib/sales/company-domain";
import { CompanyLogo } from "./CompanyLogo";
import { SalesPeekPanel } from "./peek/SalesPeekPanel";
import { usePeekRoute } from "@/lib/sales/use-peek-route";
import { CrmRecordTable } from "./table/CrmRecordTable";
import { CrmTableSkeleton } from "./table/CrmTableSkeleton";
import { CrmViewSwitcher } from "./table/CrmViewSwitcher";
import type {
  CrmColumn,
  CrmTableViewState,
  TableFilters,
  TableSort,
} from "./table/table-model";

/** The list's identity sort — most recently touched companies first. */
const DEFAULT_SORT: TableSort = {
  columnId: "last_activity",
  direction: "desc",
};
const DEFAULT_VIEW_STATE: CrmTableViewState = {
  filters: {},
  sort: DEFAULT_SORT,
};

export function SalesCompaniesView() {
  const { bundle, isLoading: bundleLoading } = useSalesWorkspaceBundle();
  // Row click opens the right-snap peek panel; expand promotes to the
  // full account detail route (web-app mini-panel pattern).
  const { peekId, openPeek, closePeek } = usePeekRoute();
  const [sort, setSort] = useState<TableSort | null>(DEFAULT_SORT);
  const [filters, setFilters] = useState<TableFilters>({});
  const workspaceId = bundle?.workspace.id;
  const accounts = useAccountsQuery(workspaceId);
  const opportunities = useOpportunitiesQuery(workspaceId);
  const upsert = useUpsertAttributeValue();

  const accountType = bundle?.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.account,
  );
  const accountDefs = useMemo(
    () =>
      accountType
        ? bundle?.attributeDefinitionsByType[accountType.id] ?? []
        : [],
    [accountType, bundle?.attributeDefinitionsByType],
  );

  const rows = useMemo(
    () => accounts.data?.data ?? [],
    [accounts.data?.data],
  );

  // Fan-out attribute_values per account so the Source / Segment /
  // URL / Pain columns render + edit real data, not placeholders.
  const { valuesById: valuesByAccountId, isLoading: attrsLoading } =
    useAttributeValuesByItem(rows);

  // Count opportunities per account so the # column shows the real
  // sales-motion density per company.
  const opportunitiesByAccountId = useMemo(() => {
    const map: Record<string, WorkItem[]> = {};
    for (const opp of opportunities.data?.data ?? []) {
      if (!opp.parent_id) continue;
      if (!(opp.parent_id in map)) map[opp.parent_id] = [];
      map[opp.parent_id]!.push(opp);
    }
    return map;
  }, [opportunities.data?.data]);

  // Last-activity signal per account (own edits OR any of its
  // opportunities moving) — the default sort key.
  const lastActivityByAccountId = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const a of rows) {
      map[a.id] = latestActivity(
        a.updated_at,
        opportunitiesByAccountId[a.id] ?? [],
      );
    }
    return map;
  }, [rows, opportunitiesByAccountId]);

  const columns = useMemo<CrmColumn<WorkItem>[]>(() => {
    const defByKey: Record<string, AttributeDefinition> = {};
    for (const d of accountDefs) defByKey[d.key] = d;

    const attrString = (account: WorkItem, key: string): string | null => {
      const def = defByKey[key];
      if (!def) return null;
      const raw = (valuesByAccountId[account.id] ?? []).find(
        (v) => v.definition_id === def.id,
      )?.value;
      return typeof raw === "string" && raw !== "" ? raw : null;
    };

    /** Inline attribute commit — parse per data_type, then upsert. */
    const commitAttribute =
      (key: string) => (account: WorkItem, raw: string) => {
        const def = defByKey[key];
        if (!def) {
          console.warn(
            `[SalesCompaniesView] no attribute definition for key "${key}" — edit dropped`,
          );
          return;
        }
        upsert.mutate({
          workItemId: account.id,
          definitionId: def.id,
          value: parseAttributeValueForType(raw, def.data_type),
        });
      };

    const selectOptions = (
      key: string,
      fallback: readonly string[],
    ): readonly string[] => {
      const config = (defByKey[key]?.config ?? null) as {
        options?: string[];
      } | null;
      const options = config?.options;
      return Array.isArray(options) ? options : fallback;
    };

    const renderTag = (value: string | null) =>
      value === null ? (
        "—"
      ) : (
        <span className="crm-tag">{value.replace(/_/g, " ")}</span>
      );

    return [
      {
        id: "company",
        label: "Company",
        getValue: (account) => account.title,
        sortable: true,
        filter: { type: "text" },
        headerClassName: "pl-5",
        cellClassName: "pl-5 font-medium text-[var(--theme-text-primary)]",
        render: (account) => (
          <span className="flex items-center gap-2 min-w-0">
            <CompanyLogo
              name={account.title}
              domain={domainFromUrl(attrString(account, "company_url"))}
              size={18}
            />
            <span className="truncate">{account.title}</span>
          </span>
        ),
      },
      {
        id: "source",
        label: "Source",
        getValue: (account) => attrString(account, "source"),
        sortable: true,
        filter: {
          type: "select",
          options: selectOptions("source", ACCOUNT_SOURCE_OPTIONS),
        },
        render: (account) => renderTag(attrString(account, "source")),
        edit: {
          dataType: "select",
          options: selectOptions("source", ACCOUNT_SOURCE_OPTIONS),
          getEditValue: (account) => attrString(account, "source") ?? "",
          commit: commitAttribute("source"),
        },
      },
      {
        id: "segment",
        label: "Segment",
        getValue: (account) => attrString(account, "segment"),
        sortable: true,
        filter: {
          type: "select",
          options: selectOptions("segment", ACCOUNT_SEGMENT_OPTIONS),
        },
        render: (account) => renderTag(attrString(account, "segment")),
        edit: {
          dataType: "select",
          options: selectOptions("segment", ACCOUNT_SEGMENT_OPTIONS),
          getEditValue: (account) => attrString(account, "segment") ?? "",
          commit: commitAttribute("segment"),
        },
      },
      {
        id: "company_url",
        label: "URL",
        getValue: (account) => attrString(account, "company_url"),
        filter: { type: "text" },
        cellClassName: "max-w-[180px] truncate",
        render: (account) => attrString(account, "company_url") ?? "—",
        edit: {
          dataType: "url",
          getEditValue: (account) =>
            attrString(account, "company_url") ?? "",
          commit: commitAttribute("company_url"),
        },
      },
      {
        id: "opportunities",
        label: "Opportunities",
        getValue: (account) =>
          (opportunitiesByAccountId[account.id] ?? []).length,
        sortable: true,
        align: "right",
        render: (account) =>
          (opportunitiesByAccountId[account.id] ?? []).length,
      },
      {
        id: "last_activity",
        label: "Last activity",
        getValue: (account) => lastActivityByAccountId[account.id] ?? null,
        sortable: true,
        cellClassName:
          "whitespace-nowrap text-[var(--theme-text-secondary)]",
        render: (account) => (
          <span data-testid="sales-companies-last-activity">
            {timeAgo(lastActivityByAccountId[account.id] ?? null)}
          </span>
        ),
      },
      {
        id: "pain",
        label: "Pain",
        getValue: (account) => attrString(account, "pain_summary"),
        sortable: true,
        filter: { type: "text" },
        cellClassName: "text-[var(--theme-text-muted)] max-w-md truncate",
        render: (account) => attrString(account, "pain_summary") ?? "—",
        edit: {
          dataType: "text",
          getEditValue: (account) =>
            attrString(account, "pain_summary") ?? "",
          commit: commitAttribute("pain_summary"),
        },
      },
    ];
  }, [
    accountDefs,
    valuesByAccountId,
    opportunitiesByAccountId,
    lastActivityByAccountId,
    upsert,
  ]);

  const isDefaultSort =
    sort?.columnId === DEFAULT_SORT.columnId &&
    sort.direction === DEFAULT_SORT.direction;

  // First load only (no cached data): real chrome + shimmer rows.
  // Column labels are static, so the true headers render immediately.
  // Includes the attribute fan-out so rows land fully hydrated instead
  // of cells popping in one by one (founder 2026-08-04); the latch
  // keeps a mid-session create from bouncing back to skeleton.
  const showSkeleton = useFirstLoad(
    bundleLoading || accounts.isLoading || attrsLoading,
  );
  if (showSkeleton) {
    return (
      <div className="sales-companies-view crm-mobile-page-scroll flex-1 min-w-0 flex flex-col min-h-0">
        <div className="crm-view-header">
          <h1 className="crm-view-title">Companies</h1>
        </div>
        <CrmTableSkeleton columns={columns} testIdPrefix="sales-companies" />
      </div>
    );
  }

  return (
    <div
      className="sales-companies-view crm-mobile-page-scroll flex-1 min-w-0 flex flex-col min-h-0"
      data-testid="sales-companies-view"
    >
      <div className="crm-view-header">
        <h1 className="crm-view-title">Companies</h1>
        <span className="crm-view-meta">
          {rows.length} account{rows.length === 1 ? "" : "s"}
        </span>
        {isDefaultSort && (
          <span
            className="crm-tag"
            data-testid="sales-companies-sort-chip"
            title="Most recently touched companies first — own edits or any opportunity moving"
          >
            Sorted by last activity
          </span>
        )}
        <div className="flex-1" />
      </div>

      {rows.length === 0 ? (
        <div
          className="py-16 text-center text-sm text-[var(--theme-text-muted)]"
          data-testid="sales-companies-empty"
        >
          No companies yet. Add the first one from the Pipeline tab.
        </div>
      ) : (
        <CrmRecordTable<WorkItem>
          rows={rows}
          columns={columns}
          getRowId={(account) => account.id}
          sort={sort}
          onSortChange={setSort}
          filters={filters}
          onFiltersChange={setFilters}
          onRowClick={(account) => openPeek(account.id)}
          testIdPrefix="sales-companies"
          refreshing={accounts.isFetching && !accounts.isLoading}
          toolbar={
            // Moved out of the view header (2026-08-04 mobile pass) so
            // both record tables carry their saved-view controls the
            // same way — desktop gets a toolbar row like Pipeline's,
            // phones collapse it behind the Filters toggle.
            <CrmViewSwitcher
              surface="crm_companies"
              state={{ filters, sort }}
              defaultState={DEFAULT_VIEW_STATE}
              onApplyState={(state) => {
                setFilters(state.filters);
                setSort(state.sort);
              }}
              testIdPrefix="sales-companies"
            />
          }
          renderFooter={(visible) => {
            const totalOpportunities = visible.reduce(
              (n, account) =>
                n + (opportunitiesByAccountId[account.id] ?? []).length,
              0,
            );
            return (
              <>
                {visible.length}{" "}
                {visible.length === 1 ? "company" : "companies"} ·{" "}
                {totalOpportunities} opportunit
                {totalOpportunities === 1 ? "y" : "ies"}
              </>
            );
          }}
        />
      )}

      {peekId && bundle && (
        <SalesPeekPanel
          bundle={bundle}
          workItemId={peekId}
          onClose={closePeek}
        />
      )}
    </div>
  );
}
