import {
  PIPELINE_TAB_IDS,
  sanitizeTabOrder,
} from "../pipeline-tab-order";

describe("sanitizeTabOrder", () => {
  it("accepts a full permutation", () => {
    expect(sanitizeTabOrder(["kanban", "summary", "table"])).toEqual([
      "kanban",
      "summary",
      "table",
    ]);
  });

  it("falls back to the default on junk", () => {
    expect(sanitizeTabOrder(null)).toEqual([...PIPELINE_TAB_IDS]);
    expect(sanitizeTabOrder("kanban")).toEqual([...PIPELINE_TAB_IDS]);
    expect(sanitizeTabOrder(42)).toEqual([...PIPELINE_TAB_IDS]);
  });

  it("falls back when a tab is missing (stale value from an older set)", () => {
    expect(sanitizeTabOrder(["table", "kanban"])).toEqual([
      ...PIPELINE_TAB_IDS,
    ]);
  });

  it("falls back on duplicates or unknown ids", () => {
    expect(sanitizeTabOrder(["table", "table", "kanban"])).toEqual([
      ...PIPELINE_TAB_IDS,
    ]);
    expect(
      sanitizeTabOrder(["table", "kanban", "summary", "docs"]),
    ).toEqual([...PIPELINE_TAB_IDS]);
  });
});
