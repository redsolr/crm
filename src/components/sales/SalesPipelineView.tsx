"use client";

/**
 * Sales Pipeline view — horizontal kanban board (Attio/Pipedrive
 * class), rendered inside the CRM shell (`CrmShell`), which owns the
 * sidebar nav and the `.crm-app` dark-dense token scope.
 *
 * Filter chips narrow the active set (All / Active / Overdue / Due
 * today / No next action / Closed). Closed kicks the kanban into
 * "show closed" mode so won / lost / not_now columns surface.
 *
 * Attio table slice (2026-07-18): a kanban ⇄ table toggle in the
 * header. Table mode renders the same (chip-filtered) opportunities
 * through CrmRecordTable — inline stage select (closed stages still
 * intercepted by the reason modal), inline attribute editing, sort /
 * filter / saved views. The mode persists in localStorage.
 *
 * Per the 2026-05-26 architecture decision, the Sales container is
 * auto-provisioned by the platform at signup time
 * (`provisionModuleContainers` in tenant-bootstrap). The "no Sales
 * project" defensive state is intentionally non-actionable — if it
 * ever fires, the BE provisioning contract broke and the right fix
 * is BE-side, not a user-clickable CTA.
 */

import { useState, useSyncExternalStore } from "react";
import {
  SALES_FILTERS,
  SALES_TYPE_KEYS,
  type SalesFilterId,
} from "@/lib/sales/constants";
import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  useAccountsQuery,
  useOpportunitiesQuery,
} from "@/lib/sales/use-sales-queries";
import type { WorkItem } from "@/lib/workItemsApi";
import { CreateAccountModal } from "./CreateAccountModal";
import { CreateOpportunityModal } from "./CreateOpportunityModal";
import { SalesKanbanBoard } from "./SalesKanbanBoard";
import { SalesPeekPanel } from "./peek/SalesPeekPanel";
import {
  todayDateString,
  useOpportunityAttributes,
  type OpportunityAttributeSnapshot,
} from "@/lib/sales/use-opportunity-attributes";
import { useAccountAttributes } from "@/lib/sales/use-account-attributes";
import { formatTHB } from "@/lib/format-currency";
import { SalesPipelineTable } from "./table/SalesPipelineTable";

/** localStorage key persisting the kanban ⇄ table mode choice. */
const PIPELINE_VIEW_MODE_STORAGE_KEY = "crm-pipeline-view-mode";

type PipelineViewMode = "kanban" | "table";

// The persisted view mode is an EXTERNAL store (module value backed
// by localStorage), read via useSyncExternalStore: the server
// snapshot always renders kanban and the client snapshot restores the
// stored choice hydration-safely — no setState-in-effect rehydration.
const viewModeListeners = new Set<() => void>();
let viewModeCache: PipelineViewMode | null = null;

function readStoredViewMode(): PipelineViewMode {
  if (viewModeCache === null) {
    try {
      // TABLE is the default (user decision 2026-07-18) — board is the
      // opt-in. Only an explicit stored "kanban" choice restores it.
      viewModeCache =
        window.localStorage.getItem(PIPELINE_VIEW_MODE_STORAGE_KEY) ===
        "kanban"
          ? "kanban"
          : "table";
    } catch (err) {
      console.warn(
        "[SalesPipelineView] could not read persisted view mode:",
        err,
      );
      viewModeCache = "table";
    }
  }
  return viewModeCache;
}

function subscribeToViewMode(callback: () => void): () => void {
  viewModeListeners.add(callback);
  return () => {
    viewModeListeners.delete(callback);
  };
}

function writeStoredViewMode(mode: PipelineViewMode) {
  viewModeCache = mode;
  try {
    window.localStorage.setItem(PIPELINE_VIEW_MODE_STORAGE_KEY, mode);
  } catch (err) {
    console.warn("[SalesPipelineView] could not persist view mode:", err);
  }
  for (const listener of viewModeListeners) listener();
}

export function SalesPipelineView() {
  const { bundle, isLoading } = useSalesWorkspaceBundle();
  const workspaceId = bundle?.workspace.id;
  const opportunities = useOpportunitiesQuery(workspaceId);
  const accounts = useAccountsQuery(workspaceId);

  const [filter, setFilter] = useState<SalesFilterId>("all");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  // Card click opens the right-snap peek panel; expand promotes to the
  // full detail route (web-app mini-panel pattern).
  const [peekId, setPeekId] = useState<string | null>(null);
  // Kanban ⇄ table — persisted external store (see module helpers).
  const viewMode = useSyncExternalStore(
    subscribeToViewMode,
    readStoredViewMode,
    // Server snapshot mirrors the client default (table) so hydration
    // never flashes the board for table users.
    () => "table" as PipelineViewMode,
  );
  const changeViewMode = writeStoredViewMode;

  // Derived data BEFORE conditional returns so hook order stays stable.
  const allOpportunities = opportunities.data?.data ?? [];
  const allAccounts = accounts.data?.data ?? [];
  const opportunityType = bundle?.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.opportunity,
  );
  const opportunityDefs = opportunityType
    ? bundle?.attributeDefinitionsByType[opportunityType.id] ?? []
    : [];
  const attributesByOpportunityId = useOpportunityAttributes(
    allOpportunities,
    opportunityDefs,
  );
  const accountType = bundle?.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.account,
  );
  const accountDefs = accountType
    ? bundle?.attributeDefinitionsByType[accountType.id] ?? []
    : [];
  // Account snapshots feed the card's company-logo row (favicon domain).
  const accountAttributesById = useAccountAttributes(allAccounts, accountDefs);

  if (isLoading) {
    return (
      <div className="sales-pipeline-view flex-1 min-w-0 flex items-center justify-center">
        <span className="text-sm text-[var(--theme-text-muted)]">
          Loading Sales pipeline…
        </span>
      </div>
    );
  }

  if (!bundle) {
    return <NoSalesProjectState />;
  }

  const isEmpty = allOpportunities.length === 0;
  const filteredOpportunities = applyFilter(
    allOpportunities,
    filter,
    attributesByOpportunityId,
  );

  // Live pipeline value — sum of value_estimate across ACTIVE
  // opportunities (won/lost/not_now excluded), the Attio-style header
  // calculation that turns the board into a number you steer by.
  const activePipelineValue = allOpportunities.reduce((sum, o) => {
    if (o.state.category === "done" || o.state.category === "dead") return sum;
    return sum + (attributesByOpportunityId[o.id]?.valueEstimate ?? 0);
  }, 0);

  // Closed filter == show all closed-state opportunities AND auto-
  // surface the closed columns in the kanban. Otherwise the closed
  // toggle is user-controlled.
  const effectiveShowClosed = filter === "closed" ? true : showClosed;

  return (
    <div
      className="sales-pipeline-view flex-1 min-w-0 min-h-0 flex flex-col"
      data-testid="sales-pipeline"
    >
      <div className="crm-view-header">
        <h1 className="crm-view-title">Pipeline</h1>
        <span className="crm-view-meta">
          {allOpportunities.length} opportunit
          {allOpportunities.length === 1 ? "y" : "ies"} ·{" "}
          {allAccounts.length} account
          {allAccounts.length === 1 ? "" : "s"}
        </span>
        {activePipelineValue > 0 && (
          <span
            className="crm-view-meta font-medium !text-[var(--crm-green)]"
            data-testid="sales-pipeline-value"
            title="Sum of value estimates across active opportunities"
          >
            {formatTHB(activePipelineValue)} active
          </span>
        )}
        <div className="flex-1" />
        <button
          data-testid="sales-add-account-button"
          onClick={() => setShowAccountModal(true)}
          className="crm-btn-ghost"
        >
          + Company
        </button>
        <button
          data-testid="sales-add-opportunity-button"
          onClick={() => setShowOpportunityModal(true)}
          disabled={allAccounts.length === 0}
          className="crm-btn-primary"
        >
          + Opportunity
        </button>
      </div>

      {/* Board ⇄ Table as first-class tabs (Attio tab-strip pattern). */}
      <div
        className="crm-tabs"
        role="tablist"
        aria-label="Pipeline layout"
        data-testid="sales-pipeline-mode-toggle"
      >
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "kanban"}
          className="crm-tab-btn"
          data-active={viewMode === "kanban" ? "true" : undefined}
          data-testid="sales-pipeline-mode-kanban"
          onClick={() => changeViewMode("kanban")}
        >
          Board
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "table"}
          className="crm-tab-btn"
          data-active={viewMode === "table" ? "true" : undefined}
          data-testid="sales-pipeline-mode-table"
          onClick={() => changeViewMode("table")}
        >
          Table
        </button>
      </div>

      <FilterChips value={filter} onChange={setFilter} />

      {isEmpty ? (
        <EmptyState
          hasAccounts={allAccounts.length > 0}
          onAddCompany={() => setShowAccountModal(true)}
          onAddOpportunity={() => setShowOpportunityModal(true)}
        />
      ) : viewMode === "table" ? (
        <SalesPipelineTable
          bundle={bundle}
          opportunities={filteredOpportunities}
          accountsById={Object.fromEntries(allAccounts.map((a) => [a.id, a]))}
          attributesById={attributesByOpportunityId}
          accountAttributesById={accountAttributesById}
          onOpenOpportunity={setPeekId}
        />
      ) : (
        <SalesKanbanBoard
          bundle={bundle}
          opportunities={filteredOpportunities}
          accountsById={Object.fromEntries(allAccounts.map((a) => [a.id, a]))}
          attributesById={attributesByOpportunityId}
          accountAttributesById={accountAttributesById}
          showClosed={effectiveShowClosed}
          onToggleClosed={setShowClosed}
          onOpenOpportunity={setPeekId}
        />
      )}

      {peekId && (
        <SalesPeekPanel
          bundle={bundle}
          workItemId={peekId}
          onClose={() => setPeekId(null)}
        />
      )}

      {showAccountModal && (
        <CreateAccountModal
          bundle={bundle}
          onClose={() => setShowAccountModal(false)}
        />
      )}
      {showOpportunityModal && (
        <CreateOpportunityModal
          bundle={bundle}
          accounts={allAccounts}
          onClose={() => setShowOpportunityModal(false)}
        />
      )}
    </div>
  );
}

// ── Defensive "no Sales workspace" state ────────────────────────────────────
//
// The platform auto-provisions a `Default` workspace (seeded with the
// sales-pipeline template) at signup time. This state should NEVER fire
// in practice — it's a transient race guard between an org/workspace
// switch and the bundle (workflows + types) resolution.

function NoSalesProjectState() {
  return (
    <div
      className="sales-pipeline-view sales-pipeline-empty flex-1 min-w-0 flex items-center justify-center"
      data-testid="sales-no-project"
    >
      <div className="max-w-md text-center p-8 space-y-3">
        <span className="text-sm text-[var(--theme-text-muted)]">
          Setting up Sales for this organization…
        </span>
        <p className="text-xs text-[var(--theme-text-muted)]">
          This usually takes a moment. If it persists, reload the page
          or contact support.
        </p>
      </div>
    </div>
  );
}

// ── Filter chips ────────────────────────────────────────────────────────────

function FilterChips({
  value,
  onChange,
}: {
  value: SalesFilterId;
  onChange: (id: SalesFilterId) => void;
}) {
  return (
    <div
      className="sales-filter-pills crm-chip-row"
      data-testid="sales-filter-pills"
    >
      {SALES_FILTERS.map((f) => (
        <button
          key={f.id}
          data-testid={`sales-filter-${f.id}`}
          data-active={value === f.id ? "true" : undefined}
          onClick={() => onChange(f.id)}
          className="crm-chip"
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({
  hasAccounts,
  onAddCompany,
  onAddOpportunity,
}: {
  hasAccounts: boolean;
  onAddCompany: () => void;
  onAddOpportunity: () => void;
}) {
  return (
    <div
      className="sales-pipeline-empty crm-empty"
      data-testid="sales-empty-state"
    >
      <h2 className="crm-empty-title">Welcome to your Sales pipeline.</h2>
      <p className="crm-empty-copy">
        Add your first lead, log the first call, and the pipeline starts moving.
      </p>
      <div className="flex items-center gap-3">
        {hasAccounts ? (
          <button
            data-testid="sales-empty-primary-cta"
            onClick={onAddOpportunity}
            className="crm-btn-primary"
          >
            Add first opportunity →
          </button>
        ) : (
          <button
            data-testid="sales-empty-primary-cta"
            onClick={onAddCompany}
            className="crm-btn-primary"
          >
            Add first lead →
          </button>
        )}
        <button
          data-testid="sales-empty-secondary-cta"
          disabled
          className="crm-btn-ghost"
          title="Import is coming in a follow-up"
        >
          Import leads (CSV) · Coming soon
        </button>
        <button
          data-testid="sales-empty-secondary-cta-email"
          disabled
          className="crm-btn-ghost"
          title="Email-to-CRM coming in a follow-up"
        >
          Connect email · Coming soon
        </button>
      </div>
    </div>
  );
}

// ── Filter helper ───────────────────────────────────────────────────────────

function applyFilter(
  opportunities: WorkItem[],
  filter: SalesFilterId,
  attributesById: Record<string, OpportunityAttributeSnapshot>,
): WorkItem[] {
  if (filter === "all") return opportunities;
  if (filter === "active") {
    return opportunities.filter(
      (o) => o.state.category !== "done" && o.state.category !== "dead",
    );
  }
  if (filter === "closed") {
    return opportunities.filter(
      (o) => o.state.category === "done" || o.state.category === "dead",
    );
  }
  const today = todayDateString();
  const isActiveCategory = (o: WorkItem) =>
    o.state.category !== "done" && o.state.category !== "dead";
  if (filter === "overdue") {
    return opportunities.filter((o) => {
      if (!isActiveCategory(o)) return false;
      const d = attributesById[o.id]?.nextActionDate ?? null;
      return d !== null && d < today;
    });
  }
  if (filter === "due_today") {
    return opportunities.filter((o) => {
      if (!isActiveCategory(o)) return false;
      const d = attributesById[o.id]?.nextActionDate ?? null;
      return d === today;
    });
  }
  if (filter === "no_next_action") {
    return opportunities.filter((o) => {
      if (!isActiveCategory(o)) return false;
      const d = attributesById[o.id]?.nextActionDate ?? null;
      return d === null;
    });
  }
  return opportunities;
}
