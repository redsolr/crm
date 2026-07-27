/**
 * Unit tests for the CrmRecordTable pure model — sort cycling, filter
 * projection (select exact / text contains), sort projection
 * (string/number, nulls-last), and the saved-view query blob
 * round-trip incl. the surface discriminator + malformed-blob
 * hardening.
 */

import {
  applyTableFilters,
  applyTableSort,
  buildViewQuery,
  cycleSort,
  isSurfaceView,
  parseViewQuery,
  type CrmColumn,
  type TableSort,
} from "../table-model";

interface Row {
  id: string;
  name: string;
  segment: string | null;
  value: number | null;
}

const rows: Row[] = [
  { id: "a", name: "Acme Alpha", segment: "solo", value: 300 },
  { id: "b", name: "Bangkok Legal", segment: "firm_2_5", value: 100 },
  { id: "c", name: "Chiang Mai Law", segment: null, value: null },
  { id: "d", name: "Acme Delta", segment: "solo", value: 200 },
];

const columns: CrmColumn<Row>[] = [
  {
    id: "name",
    label: "Name",
    getValue: (r) => r.name,
    sortable: true,
    filter: { type: "text" },
    render: (r) => r.name,
  },
  {
    id: "segment",
    label: "Segment",
    getValue: (r) => r.segment,
    sortable: true,
    filter: { type: "select", options: ["solo", "firm_2_5"] },
    render: (r) => r.segment,
  },
  {
    id: "value",
    label: "Value",
    getValue: (r) => r.value,
    sortable: true,
    render: (r) => r.value,
  },
];

const ids = (list: Row[]) => list.map((r) => r.id);

describe("cycleSort", () => {
  it("cycles none → asc → desc → none on the same column", () => {
    const asc = cycleSort(null, "name");
    expect(asc).toEqual({ columnId: "name", direction: "asc" });
    const desc = cycleSort(asc, "name");
    expect(desc).toEqual({ columnId: "name", direction: "desc" });
    expect(cycleSort(desc, "name")).toBeNull();
  });

  it("restarts at asc when a different column is clicked", () => {
    const current: TableSort = { columnId: "name", direction: "desc" };
    expect(cycleSort(current, "value")).toEqual({
      columnId: "value",
      direction: "asc",
    });
  });
});

describe("applyTableFilters", () => {
  it("returns rows unchanged when no filter is active", () => {
    expect(applyTableFilters(rows, columns, {})).toBe(rows);
    expect(ids(applyTableFilters(rows, columns, { name: "" }))).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("text filters match case-insensitive contains", () => {
    expect(ids(applyTableFilters(rows, columns, { name: "acme" }))).toEqual([
      "a",
      "d",
    ]);
  });

  it("text filters treat null values as empty (no match)", () => {
    const filtered = applyTableFilters(rows, columns, { name: "zzz" });
    expect(filtered).toHaveLength(0);
  });

  it("select filters match exactly, excluding null values", () => {
    expect(
      ids(applyTableFilters(rows, columns, { segment: "solo" })),
    ).toEqual(["a", "d"]);
    expect(
      ids(applyTableFilters(rows, columns, { segment: "firm_2_5" })),
    ).toEqual(["b"]);
  });

  it("stacks multiple filters with AND semantics", () => {
    expect(
      ids(
        applyTableFilters(rows, columns, { name: "acme", segment: "solo" }),
      ),
    ).toEqual(["a", "d"]);
    expect(
      ids(
        applyTableFilters(rows, columns, {
          name: "bangkok",
          segment: "solo",
        }),
      ),
    ).toEqual([]);
  });

  it("ignores unknown / non-filterable column ids (stale saved views)", () => {
    expect(
      ids(applyTableFilters(rows, columns, { ghost_column: "x" })),
    ).toEqual(["a", "b", "c", "d"]);
    // `value` exists but has no filter config → never excludes.
    expect(ids(applyTableFilters(rows, columns, { value: "300" }))).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});

describe("applyTableSort", () => {
  it("returns rows unchanged without a sort or with an unknown column", () => {
    expect(applyTableSort(rows, columns, null)).toBe(rows);
    expect(
      applyTableSort(rows, columns, { columnId: "ghost", direction: "asc" }),
    ).toBe(rows);
  });

  it("sorts strings asc/desc without mutating the input", () => {
    const asc = applyTableSort(rows, columns, {
      columnId: "name",
      direction: "asc",
    });
    expect(ids(asc)).toEqual(["a", "d", "b", "c"]);
    const desc = applyTableSort(rows, columns, {
      columnId: "name",
      direction: "desc",
    });
    expect(ids(desc)).toEqual(["c", "b", "d", "a"]);
    // Input order untouched.
    expect(ids(rows)).toEqual(["a", "b", "c", "d"]);
  });

  it("sorts numbers numerically with nulls last in BOTH directions", () => {
    const asc = applyTableSort(rows, columns, {
      columnId: "value",
      direction: "asc",
    });
    expect(ids(asc)).toEqual(["b", "d", "a", "c"]);
    const desc = applyTableSort(rows, columns, {
      columnId: "value",
      direction: "desc",
    });
    expect(ids(desc)).toEqual(["a", "d", "b", "c"]);
  });

  it("sorts null-bearing string columns with nulls last", () => {
    const asc = applyTableSort(rows, columns, {
      columnId: "segment",
      direction: "asc",
    });
    expect(ids(asc)).toEqual(["b", "a", "d", "c"]);
  });
});

describe("saved-view query blob", () => {
  const state = {
    filters: { segment: "solo", name: "acme" },
    sort: { columnId: "value", direction: "desc" } as TableSort,
  };

  it("round-trips state through build → parse for the same surface", () => {
    const blob = buildViewQuery("crm_companies", state);
    expect(blob["surface"]).toBe("crm_companies");
    expect(parseViewQuery(blob, "crm_companies")).toEqual(state);
  });

  it("rejects a blob from a different surface", () => {
    const blob = buildViewQuery("crm_pipeline", state);
    expect(parseViewQuery(blob, "crm_companies")).toBeNull();
  });

  it("isSurfaceView discriminates on the blob's surface field", () => {
    const view = { query: buildViewQuery("crm_companies", state) };
    expect(isSurfaceView(view, "crm_companies")).toBe(true);
    expect(isSurfaceView(view, "crm_pipeline")).toBe(false);
  });

  it("drops malformed filter entries and sorts instead of throwing", () => {
    const parsed = parseViewQuery(
      {
        surface: "crm_companies",
        v: 1,
        filters: { good: "x", bad: 42, worse: { nested: true } },
        sort: { columnId: "value", direction: "sideways" },
      },
      "crm_companies",
    );
    expect(parsed).toEqual({ filters: { good: "x" }, sort: null });
  });

  it("tolerates a blob with no filters/sort at all", () => {
    expect(
      parseViewQuery({ surface: "crm_companies" }, "crm_companies"),
    ).toEqual({ filters: {}, sort: null });
  });
});
