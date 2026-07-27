"use client";

/**
 * Reports charts — hand-rolled SVG on the dataviz method (no chart dep).
 *
 * Palette: the `--crm-viz-*` categorical slots (globals.css), validated
 * in both modes against the CRM surfaces. Rules honored here:
 *   - color follows the ENTITY (fixed slot per source option / series),
 *     never rank; slice order is fixed, not sorted, so ring adjacency
 *     matches the validated adjacent pairlist;
 *   - one axis per chart; single-series charts carry no legend (the
 *     title names them); ≥2 series get legend + direct labels;
 *   - visible direct labels everywhere (the light-mode relief rule);
 *   - 2px surface gaps between fills; text wears text tokens, never the
 *     series color; per-mark native tooltips (<title>) as hover layer.
 */

import { useMemo } from "react";

const SURFACE_GAP = "var(--theme-bg-secondary)";
const TEXT_MUTED = "var(--theme-text-muted)";
const TEXT_SECONDARY = "var(--theme-text-secondary)";
const TEXT_PRIMARY = "var(--theme-text-primary)";
const GRID = "var(--theme-border-primary)";

export interface DonutSlice {
  key: string;
  label: string;
  count: number;
  /** 1-based categorical slot — fixed per entity. */
  slot: number;
}

// ── Donut (identity: part-of-whole) ─────────────────────────────────────────

export function SalesDonutChart({
  slices,
  testId,
}: {
  /** Fixed entity order (NOT sorted by count) — adjacency stays validated. */
  slices: DonutSlice[];
  testId: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const visible = slices.filter((s) => s.count > 0);

  const geometry = useMemo(() => {
    const R = 70;
    const r = 42;
    const cx = 90;
    const cy = 90;
    // Prefix-sum start angles first (plain loop, no closure-captured
    // mutable — keeps the render-purity lint clean).
    const starts: number[] = [];
    for (let i = 0, acc = -Math.PI / 2; i < visible.length; i++) {
      starts[i] = acc;
      acc += (total > 0 ? visible[i]!.count / total : 0) * Math.PI * 2;
    }
    return visible.map((s, i) => {
      const frac = total > 0 ? s.count / total : 0;
      const start = starts[i]!;
      const end = start + frac * Math.PI * 2;
      const large = end - start > Math.PI ? 1 : 0;
      const p = (a: number, radius: number) =>
        `${cx + radius * Math.cos(a)},${cy + radius * Math.sin(a)}`;
      const mid = (start + end) / 2;
      return {
        ...s,
        frac,
        d:
          `M ${p(start, R)} A ${R} ${R} 0 ${large} 1 ${p(end, R)} ` +
          `L ${p(end, r)} A ${r} ${r} 0 ${large} 0 ${p(start, r)} Z`,
        labelX: cx + (R + 14) * Math.cos(mid),
        labelY: cy + (R + 14) * Math.sin(mid),
      };
    });
  }, [visible, total]);

  if (total === 0) {
    return (
      <p className="text-sm italic" style={{ color: TEXT_MUTED }}>
        No data yet.
      </p>
    );
  }

  return (
    <div className="crm-chart-donut flex items-center gap-4" data-testid={testId}>
      <svg
        viewBox="0 0 180 180"
        className="w-[180px] h-[180px] flex-shrink-0"
        role="img"
        aria-label="Part-of-whole breakdown"
      >
        {geometry.map((s) => (
          <path
            key={s.key}
            d={s.d}
            fill={`var(--crm-viz-${s.slot})`}
            stroke={SURFACE_GAP}
            strokeWidth={2}
          >
            <title>{`${s.label} — ${s.count} (${Math.round(s.frac * 100)}%)`}</title>
          </path>
        ))}
        <text
          x={90}
          y={86}
          textAnchor="middle"
          fontSize={22}
          fontWeight={650}
          fill={TEXT_PRIMARY}
        >
          {total}
        </text>
        <text
          x={90}
          y={104}
          textAnchor="middle"
          fontSize={10}
          fill={TEXT_MUTED}
        >
          total
        </text>
      </svg>
      <ul className="crm-chart-legend space-y-1 min-w-0">
        {visible.map((s) => (
          <li
            key={s.key}
            className="flex items-center gap-2 text-xs"
            style={{ color: TEXT_SECONDARY }}
          >
            <span
              aria-hidden="true"
              className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: `var(--crm-viz-${s.slot})` }}
            />
            <span className="truncate">{s.label}</span>
            <span
              className="tabular-nums flex-shrink-0"
              style={{ color: TEXT_PRIMARY }}
            >
              {s.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Grouped monthly bars (two series: created vs won) ───────────────────────

// Bucket shapes are the data layer's (`report-buckets.ts`) — charts
// render them; re-exported so chart consumers import from one place.
export type { MonthBucket, WeekBucket } from "@/lib/sales/report-buckets";
import type {
  MonthBucket,
  WeekBucket,
} from "@/lib/sales/report-buckets";

export function SalesMonthlyBars({
  months,
  testId,
}: {
  months: MonthBucket[];
  testId: string;
}) {
  const W = 360;
  const H = 150;
  const PAD_BOTTOM = 22;
  const PAD_TOP = 14;
  const max = Math.max(1, ...months.flatMap((m) => [m.created, m.won]));
  const groupW = W / Math.max(1, months.length);
  const barW = Math.min(18, groupW / 3);
  const scaleY = (n: number) => ((H - PAD_TOP - PAD_BOTTOM) * n) / max;

  return (
    <div className="crm-chart-monthly" data-testid={testId}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Opportunities created vs won per month"
      >
        <line
          x1={0}
          y1={H - PAD_BOTTOM}
          x2={W}
          y2={H - PAD_BOTTOM}
          stroke={GRID}
          strokeWidth={1}
        />
        {months.map((m, i) => {
          const cx = i * groupW + groupW / 2;
          const bars = [
            { key: "created", n: m.created, slot: 1, x: cx - barW - 1 },
            { key: "won", n: m.won, slot: 2, x: cx + 1 },
          ];
          return (
            <g key={m.label}>
              {bars.map((b) => {
                const h = scaleY(b.n);
                const y = H - PAD_BOTTOM - h;
                return (
                  <g key={b.key}>
                    <rect
                      x={b.x}
                      y={y}
                      width={barW}
                      height={Math.max(h, b.n > 0 ? 3 : 0)}
                      rx={3}
                      fill={`var(--crm-viz-${b.slot})`}
                      stroke={SURFACE_GAP}
                      strokeWidth={1}
                    >
                      <title>{`${m.label} — ${b.key}: ${b.n}`}</title>
                    </rect>
                    {b.n > 0 && (
                      <text
                        x={b.x + barW / 2}
                        y={y - 3}
                        textAnchor="middle"
                        fontSize={9}
                        fill={TEXT_SECONDARY}
                      >
                        {b.n}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={cx}
                y={H - 7}
                textAnchor="middle"
                fontSize={9}
                fill={TEXT_MUTED}
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        className="crm-chart-legend flex items-center gap-4 mt-1 text-xs"
        style={{ color: TEXT_SECONDARY }}
      >
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: "var(--crm-viz-1)" }}
          />
          Created
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: "var(--crm-viz-2)" }}
          />
          Won
        </span>
      </div>
    </div>
  );
}

// ── Weekly line (single series: calls logged) ───────────────────────────────

export function SalesCallsLine({
  weeks,
  testId,
}: {
  weeks: WeekBucket[];
  testId: string;
}) {
  const W = 360;
  const H = 130;
  const PAD = 16;
  const PAD_BOTTOM = 22;
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const stepX =
    weeks.length > 1 ? (W - PAD * 2) / (weeks.length - 1) : 0;
  const x = (i: number) => PAD + i * stepX;
  const y = (n: number) =>
    H - PAD_BOTTOM - ((H - PAD - PAD_BOTTOM) * n) / max;
  const path = weeks
    .map((w, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(w.count)}`)
    .join(" ");
  const last = weeks[weeks.length - 1];

  return (
    <div className="crm-chart-calls" data-testid={testId}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Calls logged per week"
      >
        <line
          x1={PAD}
          y1={H - PAD_BOTTOM}
          x2={W - PAD}
          y2={H - PAD_BOTTOM}
          stroke={GRID}
          strokeWidth={1}
        />
        {weeks.length > 1 && (
          <path d={path} fill="none" stroke="var(--crm-viz-1)" strokeWidth={2} />
        )}
        {weeks.map((w, i) => (
          <g key={w.label}>
            <circle
              cx={x(i)}
              cy={y(w.count)}
              r={4}
              fill="var(--crm-viz-1)"
              stroke={SURFACE_GAP}
              strokeWidth={2}
            >
              <title>{`${w.label} — ${w.count} call${w.count === 1 ? "" : "s"}`}</title>
            </circle>
            <text
              x={x(i)}
              y={H - 7}
              textAnchor="middle"
              fontSize={9}
              fill={TEXT_MUTED}
            >
              {w.label}
            </text>
          </g>
        ))}
        {last && (
          <text
            x={x(weeks.length - 1)}
            y={y(last.count) - 8}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill={TEXT_PRIMARY}
          >
            {last.count}
          </text>
        )}
      </svg>
    </div>
  );
}
