/**
 * Reports time-bucketing — pure, clock-injected, unit-tested (SOLID/DRY
 * pass round 2: this math lived inline in `SalesReportsView` as the
 * only new pure logic without named specs).
 *
 * All boundaries are LOCAL time: the founder reads "July" and "week of
 * 7/13" against their wall clock, mirroring `todayDateString`'s
 * local-not-UTC decision.
 */

import { PIPELINE_STATE_KEYS } from "./constants";
import type { WorkItem } from "@/lib/workItemsApi";

export interface MonthBucket {
  label: string;
  created: number;
  won: number;
}

export interface WeekBucket {
  label: string;
  count: number;
}

const DAY_MS = 86_400_000;

/** Last `monthsBack` calendar months (oldest first, current month last):
 *  `created` counts by created_at, `won` counts closed-won by
 *  completed_at — a deal created in May and won in July registers in
 *  both months, which is the honest read of "created vs won". */
export function buildMonthBuckets(
  opportunities: ReadonlyArray<WorkItem>,
  now: Date,
  monthsBack = 6,
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const inMonth = (iso: string | null) => {
      if (!iso) return false;
      const t = Date.parse(iso);
      return t >= start.getTime() && t < end.getTime();
    };
    buckets.push({
      label: start.toLocaleString("en", { month: "short" }),
      created: opportunities.filter((o) => inMonth(o.created_at)).length,
      won: opportunities.filter(
        (o) =>
          o.state.key === PIPELINE_STATE_KEYS.won && inMonth(o.completed_at),
      ).length,
    });
  }
  return buckets;
}

/** Last `weeksBack` Monday-aligned weeks (oldest first, current week
 *  last). Calls count by when they HAPPENED — `callDateById` carries the
 *  `call_date` attribute (`YYYY-MM-DD`, parsed as local midnight so the
 *  week boundary matches the founder's wall clock); rows without one
 *  fall back to created_at. Bucketing by created_at alone piled a whole
 *  backfilled tour week onto the logging day. */
export function buildWeekBuckets(
  callNotes: ReadonlyArray<WorkItem>,
  now: Date,
  callDateById: Record<string, string | undefined> = {},
  weeksBack = 8,
): WeekBucket[] {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monday =
    midnight.getTime() - ((midnight.getDay() + 6) % 7) * DAY_MS;
  const buckets: WeekBucket[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const start = monday - i * 7 * DAY_MS;
    const end = start + 7 * DAY_MS;
    buckets.push({
      label: new Date(start).toLocaleString("en", {
        month: "numeric",
        day: "numeric",
      }),
      count: callNotes.filter((n) => {
        const callDate = callDateById[n.id];
        const t =
          callDate !== undefined
            ? new Date(`${callDate}T00:00:00`).getTime()
            : Date.parse(n.created_at);
        return t >= start && t < end;
      }).length,
    });
  }
  return buckets;
}
