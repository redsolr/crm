"use client";

/**
 * Follow-up intelligence (Folk/Close class, deterministic): ranks ACTIVE
 * opportunities by neglect so the Inbox answers "who deserves attention
 * next?" without anyone scanning the board.
 *
 * Signals (all client-side, from data already fetched):
 *   - overdue next action  — next_action_date < today (worst first)
 *   - revisit due          — "not now" deal whose not_now_until passed
 *                            (parked deals COME BACK — without this a
 *                            parked deal silently never resurfaces)
 *   - due today            — next_action_date = today (the morning list)
 *   - no next action set   — active deal with no planned step
 *   - stale                — nothing touched in STALE_AFTER_DAYS
 *
 * Deliberately NOT an LLM feature: the ranking is explainable and
 * instant. AI drafting rides the workspace chat panel instead.
 */

import { useMemo, useState } from "react";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import type { WorkItem } from "@/lib/workItemsApi";
import {
  todayDateString,
  useOpportunityAttributes,
  type OpportunityAttributeSnapshot,
} from "./use-opportunity-attributes";

export const STALE_AFTER_DAYS = 7;

export type FollowupReason =
  | "overdue_next_action"
  | "revisit_due"
  | "due_today"
  | "no_next_action"
  | "stale";

export interface FollowupSuggestion {
  opportunity: WorkItem;
  account: WorkItem | undefined;
  reason: FollowupReason;
  /** Human line, e.g. "next action 5 days overdue". */
  detail: string;
  /** The planned step, when one exists. */
  nextAction: string | null;
  score: number;
}

export interface FollowupClock {
  /** Local `YYYY-MM-DD`. */
  today: string;
  /** Epoch ms matching `today`. */
  nowMs: number;
}

export function useFollowupSuggestions(
  opportunities: WorkItem[],
  opportunityDefinitions: AttributeDefinition[],
  accountsById: Record<string, WorkItem>,
  limit = 8,
): FollowupSuggestion[] {
  const { snapshots: attrsById } = useOpportunityAttributes(
    opportunities,
    opportunityDefinitions,
  );
  // Clock snapshot per mount (lazy init keeps render pure): neglect
  // ranking doesn't need to tick live, only to be right per page view.
  const [clock] = useState<FollowupClock>(() => ({
    today: todayDateString(),
    nowMs: Date.now(),
  }));

  return useMemo(
    () =>
      rankFollowupSuggestions(
        opportunities,
        attrsById,
        accountsById,
        clock,
        limit,
      ),
    [opportunities, attrsById, accountsById, limit, clock],
  );
}

/**
 * Pure neglect ranking — extracted from the hook so the scoring rules
 * are unit-testable against a fixed clock.
 */
export function rankFollowupSuggestions(
  opportunities: WorkItem[],
  attrsById: Record<string, OpportunityAttributeSnapshot>,
  accountsById: Record<string, WorkItem>,
  clock: FollowupClock,
  limit = 8,
): FollowupSuggestion[] {
  {
    const { today, nowMs: now } = clock;
    const suggestions: FollowupSuggestion[] = [];

    for (const opp of opportunities) {
      const attrs = attrsById[opp.id];
      const account = opp.parent_id ? accountsById[opp.parent_id] : undefined;

      // Parked deals come back: a "not now" whose revisit date has
      // arrived is live follow-up work, ranked just under overdue.
      // Checked BEFORE the closed-state skip (not_now is category
      // "dead" — the skip would silently bury the revisit forever).
      if (opp.state.key === "not_now") {
        if (attrs?.notNowUntil && attrs.notNowUntil <= today) {
          suggestions.push({
            opportunity: opp,
            account,
            reason: "revisit_due",
            detail: `parked until ${attrs.notNowUntil} — time to revisit`,
            nextAction: attrs.nextAction,
            score: 950,
          });
        }
        continue;
      }

      if (opp.state.category === "done" || opp.state.category === "dead") {
        continue;
      }
      const daysSinceTouch = Math.floor(
        (now - Date.parse(opp.updated_at)) / 86_400_000,
      );

      if (attrs?.nextActionDate && attrs.nextActionDate < today) {
        const overdueDays = Math.max(
          1,
          Math.floor(
            (Date.parse(today) - Date.parse(attrs.nextActionDate)) /
              86_400_000,
          ),
        );
        suggestions.push({
          opportunity: opp,
          account,
          reason: "overdue_next_action",
          detail: `next action ${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
          nextAction: attrs.nextAction,
          score: 1000 + overdueDays * 10,
        });
        continue;
      }

      if (attrs?.nextActionDate === today) {
        suggestions.push({
          opportunity: opp,
          account,
          reason: "due_today",
          detail: "next action due today",
          nextAction: attrs.nextAction,
          score: 900,
        });
        continue;
      }

      if (!attrs?.nextActionDate && !attrs?.nextAction) {
        suggestions.push({
          opportunity: opp,
          account,
          reason: "no_next_action",
          detail: "no next action planned",
          nextAction: null,
          score: 500 + Math.min(daysSinceTouch, 30) * 5,
        });
        continue;
      }

      if (daysSinceTouch >= STALE_AFTER_DAYS) {
        suggestions.push({
          opportunity: opp,
          account,
          reason: "stale",
          detail: `untouched for ${daysSinceTouch} days`,
          nextAction: attrs?.nextAction ?? null,
          score: daysSinceTouch,
        });
      }
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
