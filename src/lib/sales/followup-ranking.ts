/**
 * Pure neglect ranking — the follow-up intelligence rules (Folk/Close
 * class, deterministic). NO "use client" directive: this module is the
 * single source of scoring for BOTH the client surfaces (Inbox strip,
 * Summary tab via `use-followup-suggestions`) and the server-side
 * morning digest (`src/server/digest.ts`), so "who deserves attention"
 * can never drift between the page and the push.
 *
 * Signals:
 *   - overdue next action  — next_action_date < today (worst first)
 *   - revisit due          — "not now" deal whose not_now_until passed
 *                            (parked deals COME BACK — without this a
 *                            parked deal silently never resurfaces)
 *   - due today            — next_action_date = today (the morning list)
 *   - no next action set   — active deal with no planned step
 *   - stale                — nothing touched in STALE_AFTER_DAYS
 *
 * Deliberately NOT an LLM feature: the ranking is explainable and
 * instant. AI drafting rides on top of it (digest drafts), never
 * inside it.
 */

export const STALE_AFTER_DAYS = 7;

export type FollowupReason =
  | "overdue_next_action"
  | "revisit_due"
  | "due_today"
  | "no_next_action"
  | "stale";

/** The attribute subset the ranking reads — the client's full
 *  `OpportunityAttributeSnapshot` satisfies it structurally. */
export interface FollowupAttributeSnapshot {
  /** ISO date string, or null when unset. */
  nextActionDate: string | null;
  /** Free-text "what's next?". */
  nextAction: string | null;
  notNowUntil: string | null;
}

/** The record subset the ranking reads — both the client `WorkItem`
 *  and the server's serialized wire shape satisfy it. */
export interface RankableOpportunity {
  id: string;
  updated_at: string;
  parent_id?: string | null;
  state: { key: string; category: string };
}

export interface FollowupSuggestion<
  T extends RankableOpportunity = RankableOpportunity,
  A = unknown,
> {
  opportunity: T;
  account: A | undefined;
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

/**
 * Rank opportunities by neglect. Extracted pure so the scoring rules
 * are unit-testable against a fixed clock and shareable server-side.
 */
export function rankFollowupSuggestions<
  T extends RankableOpportunity,
  A = unknown,
>(
  opportunities: T[],
  attrsById: Record<string, FollowupAttributeSnapshot>,
  accountsById: Record<string, A>,
  clock: FollowupClock,
  limit = 8,
): FollowupSuggestion<T, A>[] {
  const { today, nowMs: now } = clock;
  const suggestions: FollowupSuggestion<T, A>[] = [];

  for (const opp of opportunities) {
    const attrs = attrsById[opp.id];
    const account =
      opp.parent_id != null ? accountsById[opp.parent_id] : undefined;

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
          (Date.parse(today) - Date.parse(attrs.nextActionDate)) / 86_400_000,
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
