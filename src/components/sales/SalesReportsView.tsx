"use client";

/**
 * Reports — the CRM's insight surface (Attio-class "Business Metrics"
 * page, scoped to what the pipeline data actually contains today).
 *
 * Everything is computed CLIENT-SIDE from the same queries the
 * pipeline/companies/inbox views already run — no reporting backend,
 * no new endpoints (pull-driven: aggregation moves server-side only
 * when the row counts make this slow).
 *
 * Form choices follow the dataviz method: headline numbers are stat
 * tiles (not one-bar charts); stage/source comparisons are horizontal
 * bars in a single hue (magnitude, not identity); commitment health
 * uses the app's status tokens WITH icon + label (never color alone);
 * every bar carries a visible direct label plus a hover tooltip.
 */

import { ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  useAccountsQuery,
  useCallNotesQuery,
  useOpportunitiesQuery,
} from "@/lib/sales/use-sales-queries";
import {
  todayDateString,
  useOpportunityAttributes,
} from "@/lib/sales/use-opportunity-attributes";
import { useAttributeValuesByItem } from "@/lib/sales/use-item-attribute-values";
import { useAccountAttributes } from "@/lib/sales/use-account-attributes";
import { useCommitmentsInbox } from "@/lib/sales/use-commitments-inbox";
import {
  ACCOUNT_SOURCE_OPTIONS,
  PIPELINE_STAGE_ORDER,
  PIPELINE_STATE_KEYS,
  SALES_TYPE_KEYS,
} from "@/lib/sales/constants";
import type { WorkItem } from "@/lib/workItemsApi";
import { LoadingDots } from "@/components/shared/LoadingDots";
import { CompanyLogo } from "./CompanyLogo";
import {
  buildMonthBuckets,
  buildWeekBuckets,
} from "@/lib/sales/report-buckets";
import {
  SalesCallsLine,
  SalesDonutChart,
  SalesMonthlyBars,
  type DonutSlice,
  type MonthBucket,
  type WeekBucket,
} from "./reports/SalesCharts";

/** Fixed entity → categorical-slot map (dataviz rule: color follows the
 *  entity, never its rank; slice order stays fixed so ring adjacency
 *  matches the validated palette adjacency). */
const SOURCE_SLOT_ORDER: ReadonlyArray<string> = [
  ...ACCOUNT_SOURCE_OPTIONS,
  "unknown",
];

const CLOSED_STAGES: string[] = [
  PIPELINE_STATE_KEYS.won,
  PIPELINE_STATE_KEYS.lost,
  PIPELINE_STATE_KEYS.not_now,
];

/** Module-level (stable identity) — derived from constants only. */
const ACTIVE_STAGES: ReadonlyArray<string> = PIPELINE_STAGE_ORDER.filter(
  (s) => !CLOSED_STAGES.includes(s),
);

function labelize(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function usd(n: number): string {
  return `$${n.toLocaleString()}`;
}

export function SalesReportsView() {
  const { bundle, isLoading: bundleLoading } = useSalesWorkspaceBundle();
  const workspaceId = bundle?.workspace.id;

  const opportunitiesQuery = useOpportunitiesQuery(workspaceId);
  const accountsQuery = useAccountsQuery(workspaceId);
  const opportunities = useMemo(
    () => opportunitiesQuery.data?.data ?? [],
    [opportunitiesQuery.data],
  );
  const accounts = useMemo(
    () => accountsQuery.data?.data ?? [],
    [accountsQuery.data],
  );

  const opportunityType = bundle?.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.opportunity,
  );
  const opportunityDefs = opportunityType
    ? bundle?.attributeDefinitionsByType[opportunityType.id] ?? []
    : [];
  const oppAttributes = useOpportunityAttributes(
    opportunities,
    opportunityDefs,
  );

  // Account attribute fan-out — shared hook, so the per-item queries
  // hit the same cache the Companies table populates.
  const accountDefs = useMemo(() => {
    const accountType = bundle?.workItemTypes.find(
      (t) => t.key === SALES_TYPE_KEYS.account,
    );
    return accountType
      ? bundle?.attributeDefinitionsByType[accountType.id] ?? []
      : [];
  }, [bundle]);
  const valuesByAccountId = useAttributeValuesByItem(accounts);
  const sourceByAccountId = useMemo(() => {
    const sourceDef = accountDefs.find((d) => d.key === "source");
    const map: Record<string, string> = {};
    for (const a of accounts) {
      const values = valuesByAccountId[a.id] ?? [];
      const row = sourceDef
        ? values.find((v) => v.definition_id === sourceDef.id)
        : undefined;
      const raw = row?.value;
      map[a.id] = typeof raw === "string" && raw.length > 0 ? raw : "unknown";
    }
    return map;
  }, [accounts, accountDefs, valuesByAccountId]);

  const commitmentType = bundle?.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.commitment,
  );
  const commitmentDefs = commitmentType
    ? bundle?.attributeDefinitionsByType[commitmentType.id] ?? []
    : [];
  const inbox = useCommitmentsInbox(workspaceId, commitmentDefs);

  // ── Aggregations ──────────────────────────────────────────────────

  const activeOpps = useMemo(
    () =>
      opportunities.filter((o) => !CLOSED_STAGES.includes(o.state.key ?? "")),
    [opportunities],
  );
  const valueOf = (o: WorkItem) => oppAttributes[o.id]?.valueEstimate ?? 0;
  const activeValue = activeOpps.reduce((sum, o) => sum + valueOf(o), 0);

  const byStage = ACTIVE_STAGES.map((stage) => {
    const inStage = activeOpps.filter((o) => o.state.key === stage);
    return {
      key: stage,
      label: labelize(stage),
      count: inStage.length,
      value: inStage.reduce((sum, o) => sum + valueOf(o), 0),
    };
  });

  const bySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of accounts) {
      const s = sourceByAccountId[a.id] ?? "unknown";
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, label: labelize(key), count }))
      .sort((a, b) => b.count - a.count);
  }, [accounts, sourceByAccountId]);

  const closed = CLOSED_STAGES.map((stage) => {
    const inStage = opportunities.filter((o) => o.state.key === stage);
    return {
      key: stage,
      label: labelize(stage),
      count: inStage.length,
      value: inStage.reduce((sum, o) => sum + valueOf(o), 0),
    };
  });
  const won = closed.find((c) => c.key === PIPELINE_STATE_KEYS.won);

  const overdueCount = inbox.buckets.overdue.length;
  const openCommitments =
    overdueCount +
    inbox.buckets.due_today.length +
    inbox.buckets.upcoming.length;

  // ── Chart data ────────────────────────────────────────────────────

  const callNotesQuery = useCallNotesQuery(workspaceId);
  const callNotes = useMemo(
    () => callNotesQuery.data?.data ?? [],
    [callNotesQuery.data],
  );

  const donutSlices = useMemo<DonutSlice[]>(
    () =>
      SOURCE_SLOT_ORDER.map((key, i) => ({
        key,
        label: labelize(key),
        count: bySource.find((s) => s.key === key)?.count ?? 0,
        slot: i + 1,
      })),
    [bySource],
  );

  // Clock snapshot per mount (lazy init keeps render pure) — the same
  // pattern as the follow-up ranking's clock.
  const [now] = useState(() => new Date());
  const monthBuckets = useMemo<MonthBucket[]>(
    () => buildMonthBuckets(opportunities, now),
    [opportunities, now],
  );
  const weekBuckets = useMemo<WeekBucket[]>(
    () => buildWeekBuckets(callNotes, now),
    [callNotes, now],
  );

  // Stage roster — which client sits at which state right now.
  const accountsById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const accountAttrsById = useAccountAttributes(accounts, accountDefs);
  const rosterByStage = useMemo(
    () =>
      ACTIVE_STAGES.map((stage) => ({
        key: stage,
        label: labelize(stage),
        deals: activeOpps
          .filter((o) => o.state.key === stage)
          .map((o) => ({
            opportunity: o,
            account: o.parent_id ? accountsById[o.parent_id] : undefined,
            domain: o.parent_id
              ? (accountAttrsById[o.parent_id]?.domain ?? null)
              : null,
            value: oppAttributes[o.id]?.valueEstimate ?? 0,
            nextActionDate: oppAttributes[o.id]?.nextActionDate ?? null,
          }))
          .sort((a, b) => b.value - a.value),
      })),
    [activeOpps, accountsById, accountAttrsById, oppAttributes],
  );

  if (bundleLoading || opportunitiesQuery.isLoading) {
    return (
      <div className="crm-reports-loading flex-1 flex items-center justify-center">
        <LoadingDots label="Loading reports" />
      </div>
    );
  }

  return (
    <div
      className="crm-reports flex-1 min-h-0 overflow-y-auto"
      data-testid="sales-reports-view"
    >
      <div className="crm-view-header">
        <h1 className="crm-view-title">Reports</h1>
        <span className="crm-view-meta">
          Live from the pipeline — no snapshotting, refresh is the data
        </span>
        <div className="flex-1" />
      </div>

      <div className="crm-reports-body">
        {/* KPI row */}
        <div className="crm-stat-row">
          <StatTile
            label="Active pipeline"
            value={usd(activeValue)}
            sub={`${activeOpps.length} open ${activeOpps.length === 1 ? "opportunity" : "opportunities"}`}
            testId="report-stat-active-value"
          />
          <StatTile
            label="Companies"
            value={String(accounts.length)}
            sub={`${bySource.length} ${bySource.length === 1 ? "source" : "sources"}`}
            testId="report-stat-companies"
          />
          <StatTile
            label="Won"
            value={usd(won?.value ?? 0)}
            sub={`${won?.count ?? 0} closed-won`}
            testId="report-stat-won"
          />
          <StatTile
            label="Open commitments"
            value={String(openCommitments)}
            sub={
              overdueCount > 0
                ? `${overdueCount} overdue`
                : "nothing overdue"
            }
            subTone={overdueCount > 0 ? "serious" : "good"}
            testId="report-stat-commitments"
          />
        </div>

        <div className="crm-reports-grid">
          <ReportCard
            title="Open opportunities by stage"
            testId="report-card-stage-count"
          >
            <BarList
              rows={byStage.map((s) => ({
                key: s.key,
                label: s.label,
                amount: s.count,
                display: String(s.count),
                tooltip: `${s.label} — ${s.count} open · ${usd(s.value)}`,
              }))}
            />
          </ReportCard>

          <ReportCard
            title="Active value by stage"
            testId="report-card-stage-value"
          >
            <BarList
              rows={byStage.map((s) => ({
                key: s.key,
                label: s.label,
                amount: s.value,
                display: usd(s.value),
                tooltip: `${s.label} — ${usd(s.value)} across ${s.count} ${s.count === 1 ? "deal" : "deals"}`,
              }))}
            />
          </ReportCard>

          <ReportCard title="Companies by source" testId="report-card-sources">
            <SalesDonutChart
              slices={donutSlices}
              testId="report-chart-sources"
            />
          </ReportCard>

          <ReportCard
            title="Created vs won by month"
            subtitle="Last 6 months"
            testId="report-card-monthly"
          >
            <SalesMonthlyBars
              months={monthBuckets}
              testId="report-chart-monthly"
            />
          </ReportCard>

          <ReportCard
            title="Calls logged per week"
            subtitle="Last 8 weeks — the tour's heartbeat"
            testId="report-card-calls"
          >
            <SalesCallsLine weeks={weekBuckets} testId="report-chart-calls" />
          </ReportCard>

          <ReportCard
            title="Who's where right now"
            subtitle="Every active deal by stage — the founder's one-glance roster"
            testId="report-card-roster"
            wide
          >
            <StageRoster stages={rosterByStage} />
          </ReportCard>

          <ReportCard
            title="Execution"
            subtitle="Commitments and closed outcomes"
            testId="report-card-execution"
          >
            <div className="crm-status-list">
              <StatusRow
                tone="serious"
                label="Overdue"
                count={overdueCount}
              />
              <StatusRow
                tone="warning"
                label="Due today"
                count={inbox.buckets.due_today.length}
              />
              <StatusRow
                tone="neutral"
                label="Upcoming"
                count={inbox.buckets.upcoming.length}
              />
              <StatusRow
                tone="muted"
                label="Done / dropped"
                count={inbox.buckets.done_dropped.length}
              />
            </div>
            <div className="crm-outcome-row">
              {closed.map((c) => (
                <span
                  key={c.key}
                  className="crm-outcome-chip"
                  data-tone={
                    c.key === PIPELINE_STATE_KEYS.won
                      ? "good"
                      : c.key === PIPELINE_STATE_KEYS.lost
                        ? "serious"
                        : "muted"
                  }
                >
                  {c.label} · {c.count}
                </span>
              ))}
            </div>
          </ReportCard>
        </div>
      </div>
    </div>
  );
}

// ── Stage roster ────────────────────────────────────────────────────────────

interface RosterDeal {
  opportunity: WorkItem;
  account: WorkItem | undefined;
  domain: string | null;
  value: number;
  nextActionDate: string | null;
}

function StageRoster({
  stages,
}: {
  stages: Array<{ key: string; label: string; deals: RosterDeal[] }>;
}) {
  const router = useRouter();
  const today = todayDateString();
  const totalActive = stages.reduce((n, s) => n + s.deals.length, 0);

  if (totalActive === 0) {
    return (
      <p
        className="text-sm italic text-[var(--theme-text-muted)]"
        data-testid="report-roster-empty"
      >
        No active deals — the roster fills as leads enter the pipeline.
      </p>
    );
  }

  return (
    <table className="crm-roster-table crm-table" data-testid="report-roster">
      <thead>
        <tr>
          <th className="text-left pl-5 w-[140px]">Stage</th>
          <th className="text-left">Client</th>
          <th className="text-left">Deal</th>
          <th className="text-right">Value</th>
          <th className="text-left">Next action</th>
        </tr>
      </thead>
      <tbody>
        {stages.map((stage) =>
          stage.deals.length === 0 ? (
            <tr
              key={stage.key}
              className="crm-roster-empty-row"
              data-testid={`report-roster-stage-${stage.key}`}
            >
              <td className="pl-5">
                <span className="crm-tag">{stage.label}</span>
              </td>
              <td
                colSpan={4}
                className="text-[var(--theme-text-muted)] italic"
              >
                —
              </td>
            </tr>
          ) : (
            stage.deals.map((deal, i) => (
              <tr
                key={deal.opportunity.id}
                className="crm-roster-row cursor-pointer"
                data-testid={`report-roster-stage-${stage.key}`}
                onClick={() =>
                  router.push(`/sales/opportunity/${deal.opportunity.id}`)
                }
              >
                <td className="pl-5">
                  {i === 0 ? (
                    <span className="crm-tag">{stage.label}</span>
                  ) : null}
                </td>
                <td>
                  {deal.account ? (
                    <span className="flex items-center gap-1.5 min-w-0 font-medium text-[var(--theme-text-primary)]">
                      <CompanyLogo
                        name={deal.account.title}
                        domain={deal.domain}
                        size={14}
                      />
                      <span className="truncate">{deal.account.title}</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-[var(--theme-text-secondary)] max-w-[280px] truncate">
                  {deal.opportunity.title}
                </td>
                <td className="text-right tabular-nums text-[var(--crm-green)]">
                  {deal.value > 0 ? usd(deal.value) : "—"}
                </td>
                <td>
                  {deal.nextActionDate ? (
                    <span
                      className={
                        deal.nextActionDate < today
                          ? "crm-badge-danger"
                          : "crm-tag"
                      }
                    >
                      {deal.nextActionDate}
                    </span>
                  ) : (
                    <span className="crm-badge-warn">none</span>
                  )}
                </td>
              </tr>
            ))
          ),
        )}
      </tbody>
    </table>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  subTone,
  testId,
}: {
  label: string;
  value: string;
  sub: string;
  subTone?: "good" | "serious";
  testId: string;
}) {
  return (
    <div className="crm-stat-tile" data-testid={testId}>
      <div className="crm-stat-label">{label}</div>
      <div className="crm-stat-value">{value}</div>
      <div className="crm-stat-sub" data-tone={subTone}>
        {sub}
      </div>
    </div>
  );
}

function ReportCard({
  title,
  subtitle,
  testId,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  testId: string;
  /** Span the full grid width (roster-class cards). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`crm-report-card${wide ? " crm-report-card-wide" : ""}`}
      data-testid={testId}
    >
      <h2 className="crm-report-card-title">{title}</h2>
      {subtitle ? (
        <p className="crm-report-card-subtitle">{subtitle}</p>
      ) : null}
      {children}
    </section>
  );
}

interface BarRow {
  key: string;
  label: string;
  amount: number;
  display: string;
  tooltip: string;
}

/** Horizontal bar list — single hue (magnitude, not identity); every
 *  row carries a visible direct label, hover adds the detail bubble. */
function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  if (rows.length === 0 || rows.every((r) => r.amount === 0)) {
    return <div className="crm-report-empty">Nothing here yet.</div>;
  }
  return (
    <div className="crm-bar-list">
      {rows.map((r) => (
        <div className="crm-bar-row" key={r.key}>
          <span className="crm-bar-label">{r.label}</span>
          <span className="crm-bar-track">
            <span
              className="crm-bar-fill"
              style={{
                // Zero draws NOTHING — a minimum-width stub would read
                // as a non-zero value.
                width:
                  r.amount === 0
                    ? 0
                    : `${Math.max(2, (r.amount / max) * 100)}%`,
              }}
            />
          </span>
          <span className="crm-bar-value">{r.display}</span>
          <span className="crm-bar-tooltip" role="tooltip">
            {r.tooltip}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusRow({
  tone,
  label,
  count,
}: {
  tone: "serious" | "warning" | "neutral" | "muted";
  label: string;
  count: number;
}) {
  return (
    <div className="crm-status-row" data-tone={tone}>
      <span className="crm-status-dot" aria-hidden />
      <span className="crm-status-label">{label}</span>
      <span className="crm-status-count">{count}</span>
    </div>
  );
}
