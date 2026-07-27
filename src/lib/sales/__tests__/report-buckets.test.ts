import { buildMonthBuckets, buildWeekBuckets } from "../report-buckets";
import { makeWorkItem } from "./fixtures";
import type { WorkItem } from "@/lib/workItemsApi";

// Fixed local clock: Saturday 2026-07-18.
const NOW = new Date(2026, 6, 18, 12, 0, 0);

function opp(
  id: string,
  createdAt: string,
  won?: { completedAt: string },
): WorkItem {
  return makeWorkItem(id, {
    type: { id: "wit-opportunity", key: "opportunity", name: "Opportunity" },
    state: won
      ? { id: "st-won", key: "won", name: "Won", category: "done" }
      : {
          id: "st-c",
          key: "contacted",
          name: "Contacted",
          category: "not_started",
        },
    created_at: createdAt,
    completed_at: won?.completedAt ?? null,
  });
}

function callNote(id: string, createdAt: string): WorkItem {
  return makeWorkItem(id, {
    type: { id: "wit-call_note", key: "call_note", name: "Call Note" },
    created_at: createdAt,
  });
}

describe("buildMonthBuckets", () => {
  it("returns monthsBack buckets oldest-first ending at the current month", () => {
    const buckets = buildMonthBuckets([], NOW, 6);
    expect(buckets.map((b) => b.label)).toEqual([
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
    ]);
  });

  it("counts created by created_at and won by completed_at independently", () => {
    // Created in May, won in July → registers in BOTH months.
    const mayToJuly = opp("a", "2026-05-10T09:00:00", {
      completedAt: "2026-07-02T09:00:00",
    });
    const juneOnly = opp("b", "2026-06-20T09:00:00");
    const buckets = buildMonthBuckets([mayToJuly, juneOnly], NOW, 6);
    const byLabel = Object.fromEntries(buckets.map((b) => [b.label, b]));
    expect(byLabel.May).toMatchObject({ created: 1, won: 0 });
    expect(byLabel.Jun).toMatchObject({ created: 1, won: 0 });
    expect(byLabel.Jul).toMatchObject({ created: 0, won: 1 });
  });

  it("excludes items outside the window and non-won completed items", () => {
    const ancient = opp("c", "2025-01-01T00:00:00");
    // Lost deal with a completed_at must not count as won.
    const lost = makeWorkItem("d", {
      type: { id: "wit-opportunity", key: "opportunity", name: "Opportunity" },
      state: { id: "st-l", key: "lost", name: "Lost", category: "dead" },
      created_at: "2026-07-01T00:00:00",
      completed_at: "2026-07-05T00:00:00",
    });
    const buckets = buildMonthBuckets([ancient, lost], NOW, 6);
    expect(buckets.reduce((n, b) => n + b.won, 0)).toBe(0);
    expect(buckets.reduce((n, b) => n + b.created, 0)).toBe(1);
  });
});

describe("buildWeekBuckets", () => {
  it("returns weeksBack Monday-aligned buckets ending in the current week", () => {
    const buckets = buildWeekBuckets([], NOW, 8);
    expect(buckets).toHaveLength(8);
    // 2026-07-18 is a Saturday → current week starts Monday 7/13.
    expect(buckets[7]!.label).toBe("7/13");
    expect(buckets[6]!.label).toBe("7/6");
  });

  it("counts call notes into their week and drops out-of-window ones", () => {
    const notes = [
      callNote("n1", "2026-07-14T10:00:00"), // current week
      callNote("n2", "2026-07-13T00:00:00"), // Monday boundary — current week
      callNote("n3", "2026-07-12T23:59:59"), // Sunday before — previous week
      callNote("n4", "2026-01-01T00:00:00"), // far outside the window
    ];
    const buckets = buildWeekBuckets(notes, NOW, 8);
    expect(buckets[7]!.count).toBe(2);
    expect(buckets[6]!.count).toBe(1);
    expect(buckets.reduce((n, b) => n + b.count, 0)).toBe(3);
  });
});
