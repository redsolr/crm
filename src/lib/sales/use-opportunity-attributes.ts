"use client";

/**
 * Fan-out helper that hydrates `next_action_date` (and the other
 * date-bearing attributes) for a list of opportunities, returning a
 * keyed map the pipeline view + filter pill can consume.
 *
 * Phase 2A stubbed the date-driven filter pills (overdue / due today
 * / no next action) honest-blank because per-card attribute fetch
 * was outside the foundation slice. Phase 2B promotes them: one
 * `useQueries` fan-out fetches every opportunity's attribute values
 * in parallel and projects `next_action_date` into a flat map.
 */

import { useMemo } from "react";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import { useAttributeValuesByItem } from "./use-item-attribute-values";
import { defKeyIndex, rawValuesByKey } from "./attribute-projection";
import type { WorkItem } from "@/lib/workItemsApi";

export interface OpportunityAttributeSnapshot {
  /** ISO date string, or null when unset. */
  nextActionDate: string | null;
  /** Free-text "what's next?". */
  nextAction: string | null;
  /** USD/yr forecast. */
  valueEstimate: number | null;
  /** ISO date string, or null when unset. */
  expectedCloseDate: string | null;
  /** Picklist string. */
  lostReason: string | null;
  notNowUntil: string | null;
}

const EMPTY_SNAPSHOT: OpportunityAttributeSnapshot = {
  nextActionDate: null,
  nextAction: null,
  valueEstimate: null,
  expectedCloseDate: null,
  lostReason: null,
  notNowUntil: null,
};

export interface OpportunityAttributes {
  snapshots: Record<string, OpportunityAttributeSnapshot>;
  /** Aggregate first-load flag from the fan-out — see
   *  `AttributeValuesByItem.isLoading`. */
  isLoading: boolean;
}

/**
 * Returns `{ snapshots: { [opportunityId]: snapshot }, isLoading }`
 * for every opportunity passed in. Underlying
 * `GET /work_items/:id/attribute_values` calls run in parallel via
 * `useQueries` and are individually cached, so navigating between
 * Pipeline ↔ Detail re-uses the same hot rows.
 */
export function useOpportunityAttributes(
  opportunities: WorkItem[],
  opportunityDefinitions: AttributeDefinition[],
  enabled = true,
): OpportunityAttributes {
  const { valuesById: valuesByItem, isLoading } = useAttributeValuesByItem(
    opportunities,
    enabled,
  );

  const snapshots = useMemo(() => {
    const index = defKeyIndex(opportunityDefinitions);

    const map: Record<string, OpportunityAttributeSnapshot> = {};
    for (const opp of opportunities) {
      const raw = rawValuesByKey(valuesByItem[opp.id] ?? [], index);
      const valueEstimate = raw.value_estimate;
      map[opp.id] = {
        ...EMPTY_SNAPSHOT,
        nextActionDate:
          typeof raw.next_action_date === "string"
            ? raw.next_action_date
            : null,
        nextAction:
          typeof raw.next_action === "string" ? raw.next_action : null,
        valueEstimate:
          typeof valueEstimate === "number"
            ? valueEstimate
            : typeof valueEstimate === "string" && valueEstimate !== ""
              ? Number(valueEstimate)
              : null,
        expectedCloseDate:
          typeof raw.expected_close_date === "string"
            ? raw.expected_close_date
            : null,
        lostReason:
          typeof raw.lost_reason === "string" ? raw.lost_reason : null,
        notNowUntil:
          typeof raw.not_now_until === "string" ? raw.not_now_until : null,
      };
    }
    return map;
  }, [opportunities, opportunityDefinitions, valuesByItem]);

  return { snapshots, isLoading };
}

/** Local-time `YYYY-MM-DD` for "today" — used by the filter
 *  pills so the comparison runs against the user's wall clock,
 *  not UTC midnight. */
export function todayDateString(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
