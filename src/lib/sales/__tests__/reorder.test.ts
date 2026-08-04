import {
  planReorder,
  positionBetween,
  renumberWrites,
  POSITION_STEP,
} from "../reorder";

describe("positionBetween", () => {
  it("seeds the first rank in an empty list", () => {
    expect(positionBetween(null, null)).toBe(POSITION_STEP);
  });

  it("ranks above the first row", () => {
    expect(positionBetween(null, 1024)).toBe(0);
    expect(positionBetween(null, 0)).toBe(-POSITION_STEP);
  });

  it("ranks below the last row", () => {
    expect(positionBetween(2048, null)).toBe(2048 + POSITION_STEP);
  });

  it("returns the midpoint between spaced neighbors", () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  it("returns null when neighbors carry equal ranks (imported default 0)", () => {
    expect(positionBetween(0, 0)).toBeNull();
  });

  it("returns null when neighbors are out of order", () => {
    expect(positionBetween(2048, 1024)).toBeNull();
  });
});

describe("planReorder", () => {
  const spaced = [
    { id: "a", position: 1024 },
    { id: "b", position: 2048 },
    { id: "c", position: 3072 },
  ];

  it("moves with a single midpoint write on a healthy list", () => {
    // Final order: b, a, c — `a` was dragged between b and c.
    expect(planReorder([spaced[1], spaced[0], spaced[2]], "a")).toEqual([
      { id: "a", position: (2048 + 3072) / 2 },
    ]);
  });

  it("moves to the top with a below-first write", () => {
    expect(planReorder([spaced[2], spaced[0], spaced[1]], "c")).toEqual([
      { id: "c", position: 1024 - POSITION_STEP },
    ]);
  });

  it("moves to the bottom with an above-last write", () => {
    expect(planReorder([spaced[1], spaced[2], spaced[0]], "a")).toEqual([
      { id: "a", position: 3072 + POSITION_STEP },
    ]);
  });

  it("renumbers the whole list when neighbor ranks are degenerate", () => {
    // Every row still at the imported default 0 — no midpoint exists.
    const flat = [
      { id: "a", position: 0 },
      { id: "b", position: 0 },
      { id: "c", position: 0 },
    ];
    expect(planReorder([flat[1], flat[0], flat[2]], "a")).toEqual([
      { id: "b", position: POSITION_STEP },
      { id: "a", position: 2 * POSITION_STEP },
      { id: "c", position: 3 * POSITION_STEP },
    ]);
  });

  it("returns no writes for an unknown row", () => {
    expect(planReorder(spaced, "nope")).toEqual([]);
  });
});

describe("renumberWrites", () => {
  it("skips rows already at their target rank", () => {
    const rows = [
      { id: "a", position: POSITION_STEP },
      { id: "b", position: 0 },
      { id: "c", position: 3 * POSITION_STEP },
    ];
    expect(renumberWrites(rows)).toEqual([
      { id: "b", position: 2 * POSITION_STEP },
    ]);
  });
});
