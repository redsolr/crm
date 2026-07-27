/**
 * Unit tests for the global-search grouping + routing map
 * (`src/lib/sales/search-results.ts`).
 *
 * Claims under test:
 * - a hit's kind comes from `metadata.typeKey` (unknown/absent → other);
 * - grouping follows the fixed Companies → Deals → Contacts → Call
 *   notes → Other order, preserves backend rank within a group, and
 *   drops empty groups;
 * - the routing map sends each kind where the dialog promises:
 *   account/opportunity detail pages, the contacts list, a call note's
 *   parent opportunity (falling back to /sales), /sales for the rest.
 */

import type { SearchHit } from "@/lib/searchApi";
import {
  groupHits,
  identifierOfHit,
  kindOfHit,
  routeForHit,
  SEARCH_GROUP_ORDER,
} from "../search-results";

function hit(overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    source_type: "task",
    source_id: "wi_1",
    title: "A record",
    snippet: "…snippet…",
    score: 1,
    matched_by: ["fts"],
    fts_rank: 0.5,
    vector_score: null,
    graph_depth: null,
    community_rank: null,
    community_title: null,
    updated_at: "2026-07-18T00:00:00.000Z",
    metadata: null,
    ...overrides,
  };
}

function taskHit(
  typeKey: string,
  extra: Record<string, unknown> = {},
  overrides: Partial<SearchHit> = {},
): SearchHit {
  return hit({
    metadata: { typeKey, identifier: "SAL-12", ...extra },
    ...overrides,
  });
}

describe("kindOfHit", () => {
  it("maps each sales type key to its kind", () => {
    expect(kindOfHit(taskHit("account"))).toBe("account");
    expect(kindOfHit(taskHit("opportunity"))).toBe("opportunity");
    expect(kindOfHit(taskHit("contact"))).toBe("contact");
    expect(kindOfHit(taskHit("call_note"))).toBe("call_note");
  });

  it("falls back to other for unknown, missing, or non-string typeKey", () => {
    expect(kindOfHit(taskHit("matter"))).toBe("other");
    expect(kindOfHit(hit({ metadata: null }))).toBe("other");
    expect(kindOfHit(hit({ metadata: {} }))).toBe("other");
    expect(kindOfHit(hit({ metadata: { typeKey: 7 } }))).toBe("other");
    expect(kindOfHit(hit({ source_type: "page", metadata: null }))).toBe(
      "other",
    );
  });
});

describe("identifierOfHit", () => {
  it("returns the identifier when it is a non-empty string", () => {
    expect(identifierOfHit(taskHit("account"))).toBe("SAL-12");
  });

  it("returns null for missing, empty, or non-string identifiers", () => {
    expect(identifierOfHit(hit({ metadata: null }))).toBeNull();
    expect(
      identifierOfHit(hit({ metadata: { identifier: "" } })),
    ).toBeNull();
    expect(
      identifierOfHit(hit({ metadata: { identifier: 42 } })),
    ).toBeNull();
  });
});

describe("routeForHit", () => {
  it("routes accounts and opportunities to their detail pages", () => {
    expect(
      routeForHit(taskHit("account", {}, { source_id: "wi_acc" })),
    ).toBe("/sales/account/wi_acc");
    expect(
      routeForHit(taskHit("opportunity", {}, { source_id: "wi_opp" })),
    ).toBe("/sales/opportunity/wi_opp");
  });

  it("routes contacts to the contacts list", () => {
    expect(routeForHit(taskHit("contact"))).toBe("/sales/contacts");
  });

  it("routes a call note to its parent opportunity when it carries one", () => {
    expect(routeForHit(taskHit("call_note", { parentId: "wi_opp" }))).toBe(
      "/sales/opportunity/wi_opp",
    );
  });

  it("routes a call note without a usable parent to the pipeline", () => {
    expect(routeForHit(taskHit("call_note"))).toBe("/sales");
    expect(routeForHit(taskHit("call_note", { parentId: "" }))).toBe("/sales");
    expect(routeForHit(taskHit("call_note", { parentId: 9 }))).toBe("/sales");
  });

  it("routes everything else to the pipeline", () => {
    expect(routeForHit(hit({ source_type: "page", metadata: null }))).toBe(
      "/sales",
    );
    expect(routeForHit(taskHit("matter"))).toBe("/sales");
  });
});

describe("groupHits", () => {
  it("buckets in fixed order, preserves in-group rank, drops empty groups", () => {
    const note = taskHit("call_note", {}, { source_id: "wi_n1" });
    const acc1 = taskHit("account", {}, { source_id: "wi_a1" });
    const opp = taskHit("opportunity", {}, { source_id: "wi_o1" });
    const acc2 = taskHit("account", {}, { source_id: "wi_a2" });

    const groups = groupHits([note, acc1, opp, acc2]);

    expect(groups.map((g) => g.kind)).toEqual([
      "account",
      "opportunity",
      "call_note",
    ]);
    expect(groups[0]!.label).toBe("Companies");
    // Backend rank preserved within the group.
    expect(groups[0]!.hits.map((h) => h.source_id)).toEqual([
      "wi_a1",
      "wi_a2",
    ]);
    expect(groups[1]!.hits).toEqual([opp]);
    expect(groups[2]!.hits).toEqual([note]);
  });

  it("returns no groups for no hits", () => {
    expect(groupHits([])).toEqual([]);
  });

  it("labels every kind the dialog can render", () => {
    expect(SEARCH_GROUP_ORDER.map((g) => g.kind)).toEqual([
      "account",
      "opportunity",
      "contact",
      "call_note",
      "other",
    ]);
  });
});
