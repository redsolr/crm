"use client";

/**
 * Follow-up intelligence (Folk/Close class, deterministic): ranks ACTIVE
 * opportunities by neglect so the Inbox answers "who deserves attention
 * next?" without anyone scanning the board.
 *
 * The scoring rules live in `followup-ranking.ts` (pure, no directive)
 * so the server-side morning digest ranks with the SAME rules — this
 * file is the client hook + the WorkItem-typed re-export surface the
 * existing importers consume.
 */

import { useMemo, useState } from "react";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import type { WorkItem } from "@/lib/workItemsApi";
import {
  rankFollowupSuggestions,
  STALE_AFTER_DAYS,
  type FollowupClock,
  type FollowupReason,
  type FollowupSuggestion as GenericFollowupSuggestion,
} from "./followup-ranking";
import {
  useOpportunityAttributes,
  todayDateString,
} from "./use-opportunity-attributes";

export { rankFollowupSuggestions, STALE_AFTER_DAYS };
export type { FollowupClock, FollowupReason };

/** The concrete instantiation every client surface consumes. */
export type FollowupSuggestion = GenericFollowupSuggestion<WorkItem, WorkItem>;

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
