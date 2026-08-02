import {
  rankFollowupSuggestions,
  STALE_AFTER_DAYS,
  type FollowupClock,
} from "../use-followup-suggestions";
import type { OpportunityAttributeSnapshot } from "../use-opportunity-attributes";
import type { WorkItem } from "@/lib/workItemsApi";
import { makeWorkItem } from "./fixtures";

const CLOCK: FollowupClock = {
  today: "2026-07-18",
  nowMs: Date.parse("2026-07-18T12:00:00Z"),
};

function makeOpportunity(
  id: string,
  overrides: Partial<WorkItem> = {},
): WorkItem {
  return makeWorkItem(id, {
    title: `Opp ${id}`,
    state: {
      id: "st-1",
      key: "contacted",
      name: "Contacted",
      category: "not_started",
    },
    type: { id: "wit-opportunity", key: "opportunity", name: "Opportunity" },
    parent_id: "acc-1",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-17T00:00:00Z",
    ...overrides,
  });
}

function snapshot(
  overrides: Partial<OpportunityAttributeSnapshot> = {},
): OpportunityAttributeSnapshot {
  return {
    nextActionDate: null,
    nextAction: null,
    valueEstimate: null,
    lostReason: null,
    notNowUntil: null,
    expectedCloseDate: null,
    ...overrides,
  } as OpportunityAttributeSnapshot;
}

describe("rankFollowupSuggestions", () => {
  it("ranks overdue > no-next-action > stale, regardless of input order", () => {
    const stale = makeOpportunity("stale", {
      updated_at: "2026-07-01T00:00:00Z", // 17 days untouched
    });
    const noNext = makeOpportunity("nonext", {
      updated_at: "2026-07-17T00:00:00Z",
    });
    const overdue = makeOpportunity("overdue");
    const attrs = {
      stale: snapshot({ nextAction: "ping them", nextActionDate: "2026-07-30" }),
      nonext: snapshot(),
      overdue: snapshot({
        nextAction: "send proposal",
        nextActionDate: "2026-07-13",
      }),
    };

    const ranked = rankFollowupSuggestions(
      [stale, noNext, overdue],
      attrs,
      {},
      CLOCK,
    );
    expect(ranked.map((s) => s.reason)).toEqual([
      "overdue_next_action",
      "no_next_action",
      "stale",
    ]);
    expect(ranked[0]!.detail).toBe("next action 5 days overdue");
    expect(ranked[2]!.detail).toBe("untouched for 17 days");
  });

  it("surfaces due-today between overdue and no-next-action", () => {
    const overdue = makeOpportunity("overdue");
    const dueToday = makeOpportunity("today", {
      updated_at: "2026-07-17T00:00:00Z",
    });
    const noNext = makeOpportunity("nonext", {
      updated_at: "2026-07-17T00:00:00Z",
    });
    const attrs = {
      overdue: snapshot({
        nextAction: "send proposal",
        nextActionDate: "2026-07-13",
      }),
      today: snapshot({
        nextAction: "pilot check-in",
        nextActionDate: "2026-07-18",
      }),
      nonext: snapshot(),
    };

    const ranked = rankFollowupSuggestions(
      [noNext, dueToday, overdue],
      attrs,
      {},
      CLOCK,
    );
    expect(ranked.map((s) => s.reason)).toEqual([
      "overdue_next_action",
      "due_today",
      "no_next_action",
    ]);
    expect(ranked[1]!.detail).toBe("next action due today");
    expect(ranked[1]!.nextAction).toBe("pilot check-in");
  });

  it("excludes won and dead opportunities entirely", () => {
    const won = makeOpportunity("won", {
      state: { id: "st-w", key: "won", name: "Won", category: "done" },
    });
    const lost = makeOpportunity("lost", {
      state: { id: "st-l", key: "lost", name: "Lost", category: "dead" },
    });
    const ranked = rankFollowupSuggestions(
      [won, lost],
      { won: snapshot(), lost: snapshot() },
      {},
      CLOCK,
    );
    expect(ranked).toEqual([]);
  });

  it("resurfaces a parked deal once its revisit date arrives, ranked under overdue and above due-today", () => {
    const notNowState = {
      id: "st-nn",
      key: "not_now",
      name: "Not now",
      category: "dead",
    } as const;
    const revisitDue = makeOpportunity("revisit", { state: notNowState });
    const revisitToday = makeOpportunity("revisit-today", {
      state: notNowState,
    });
    const parkedFuture = makeOpportunity("parked", { state: notNowState });
    const parkedNoDate = makeOpportunity("undated", { state: notNowState });
    const overdue = makeOpportunity("overdue");
    const dueToday = makeOpportunity("today", {
      updated_at: "2026-07-17T00:00:00Z",
    });

    const ranked = rankFollowupSuggestions(
      [parkedFuture, dueToday, revisitDue, parkedNoDate, overdue, revisitToday],
      {
        revisit: snapshot({ notNowUntil: "2026-07-01" }),
        "revisit-today": snapshot({ notNowUntil: "2026-07-18" }),
        parked: snapshot({ notNowUntil: "2026-10-01" }),
        undated: snapshot(),
        overdue: snapshot({ nextActionDate: "2026-07-13" }),
        today: snapshot({ nextActionDate: "2026-07-18" }),
      },
      {},
      CLOCK,
    );

    expect(ranked.map((s) => [s.opportunity.id, s.reason])).toEqual([
      ["overdue", "overdue_next_action"],
      ["revisit", "revisit_due"],
      ["revisit-today", "revisit_due"],
      ["today", "due_today"],
    ]);
    expect(ranked[1]!.detail).toBe("parked until 2026-07-01 — time to revisit");
  });

  it("does not flag a fresh deal with a future next action", () => {
    const healthy = makeOpportunity("healthy", {
      updated_at: "2026-07-17T00:00:00Z",
    });
    const ranked = rankFollowupSuggestions(
      [healthy],
      {
        healthy: snapshot({
          nextAction: "demo",
          nextActionDate: "2026-07-25",
        }),
      },
      {},
      CLOCK,
    );
    expect(ranked).toEqual([]);
  });

  it("flags a deal with a planned step as stale only past the threshold", () => {
    const justUnder = makeOpportunity("under", {
      updated_at: new Date(
        CLOCK.nowMs - (STALE_AFTER_DAYS - 1) * 86_400_000,
      ).toISOString(),
    });
    const justOver = makeOpportunity("over", {
      updated_at: new Date(
        CLOCK.nowMs - (STALE_AFTER_DAYS + 1) * 86_400_000,
      ).toISOString(),
    });
    const planned = snapshot({
      nextAction: "call",
      nextActionDate: "2026-08-01",
    });
    const ranked = rankFollowupSuggestions(
      [justUnder, justOver],
      { under: planned, over: planned },
      {},
      CLOCK,
    );
    expect(ranked.map((s) => s.opportunity.id)).toEqual(["over"]);
    expect(ranked[0]!.reason).toBe("stale");
  });

  it("respects the limit after sorting by severity", () => {
    const opps = Array.from({ length: 5 }, (_, i) =>
      makeOpportunity(`o${i}`),
    );
    const attrs = Object.fromEntries(
      opps.map((o, i) => [
        o.id,
        // Increasing overdue-ness: o4 is the most overdue.
        snapshot({ nextActionDate: `2026-07-${17 - i}` }),
      ]),
    );
    const ranked = rankFollowupSuggestions(opps, attrs, {}, CLOCK, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked.map((s) => s.opportunity.id)).toEqual(["o4", "o3"]);
  });

  it("attaches the parent account when present", () => {
    const account = makeOpportunity("acc-1", {
      type: { id: "wit-account", key: "account", name: "Account" },
    });
    const opp = makeOpportunity("o1");
    const ranked = rankFollowupSuggestions(
      [opp],
      { o1: snapshot() },
      { "acc-1": account },
      CLOCK,
    );
    expect(ranked[0]!.account?.id).toBe("acc-1");
  });
});
