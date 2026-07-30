/**
 * CrmRecordTable model — pure column/sort/filter/view-state logic for
 * the Attio-class CRM record tables (Companies, Pipeline table mode).
 *
 * Everything here is a pure function over `CrmColumn.getValue`
 * projections so it unit-tests without React:
 *   - `cycleSort` — header click cycles asc → desc → none.
 *   - `applyTableFilters` — select columns match exactly, text columns
 *     match case-insensitive contains.
 *   - `applyTableSort` — string/number compare, nulls always last.
 *   - `buildViewQuery` / `parseViewQuery` — the saved-view (`/api/views`)
 *     opaque `query` blob. The platform only accepts `kind:
 *     'work_items'`, so the CRM surface discriminator lives INSIDE the
 *     blob (`surface: 'crm_companies' | 'crm_pipeline'`).
 */

import type { ReactNode } from "react";
import type { AttributeDefinition } from "@/lib/generated/api/models";

// ── Sort ────────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc";

export interface TableSort {
  columnId: string;
  direction: SortDirection;
}

/** Header click cycle: none → asc → desc → none. Clicking a different
 *  column always restarts at asc. */
export function cycleSort(
  current: TableSort | null,
  columnId: string,
): TableSort | null {
  if (!current || current.columnId !== columnId) {
    return { columnId, direction: "asc" };
  }
  if (current.direction === "asc") return { columnId, direction: "desc" };
  return null;
}

// ── Filters ─────────────────────────────────────────────────────────────────

/** `{ [columnId]: filterValue }` — empty string means "no filter". */
export type TableFilters = Record<string, string>;

export type ColumnFilterConfig =
  | { type: "text" }
  | { type: "select"; options: readonly string[] };

// ── Column definition ───────────────────────────────────────────────────────

/** Inline-edit config for a column. `commit` receives the raw editor
 *  string; the owner parses it (per data_type) and fires the mutation. */
export interface CrmColumnEdit<Row> {
  dataType: AttributeDefinition["data_type"];
  /** Select options (select data_type only). */
  options?: readonly string[];
  /** Current value as an editor string. */
  getEditValue: (row: Row) => string;
  commit: (row: Row, raw: string) => void;
}

export interface CrmColumn<Row> {
  id: string;
  label: string;
  /** Projection used for sorting + filtering (NOT display). */
  getValue: (row: Row) => string | number | null;
  sortable?: boolean;
  filter?: ColumnFilterConfig;
  align?: "left" | "right";
  /** Display cell (read mode). */
  render: (row: Row) => ReactNode;
  /** Present ⇒ the cell is inline-editable. */
  edit?: CrmColumnEdit<Row>;
  headerClassName?: string;
  cellClassName?: string;
}

// ── Projections ─────────────────────────────────────────────────────────────

export function applyTableFilters<Row>(
  rows: Row[],
  columns: ReadonlyArray<CrmColumn<Row>>,
  filters: TableFilters,
): Row[] {
  const active = Object.entries(filters).filter(([, v]) => v !== "");
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every(([columnId, filterValue]) => {
      const column = columns.find((c) => c.id === columnId);
      // Unknown / non-filterable column ids (e.g. from a stale saved
      // view) never exclude rows.
      if (!column?.filter) return true;
      const value = column.getValue(row);
      if (column.filter.type === "select") {
        return typeof value === "string" && value === filterValue;
      }
      return String(value ?? "")
        .toLowerCase()
        .includes(filterValue.toLowerCase());
    }),
  );
}

export function applyTableSort<Row>(
  rows: Row[],
  columns: ReadonlyArray<CrmColumn<Row>>,
  sort: TableSort | null,
): Row[] {
  if (!sort) return rows;
  const column = columns.find((c) => c.id === sort.columnId);
  if (!column) return rows;
  const dir = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = column.getValue(a);
    const vb = column.getValue(b);
    if (va === null && vb === null) return 0;
    // Nulls sort last regardless of direction (Attio/Linear convention).
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * dir;
    }
    return String(va).localeCompare(String(vb)) * dir;
  });
}

// ── Saved-view query blob ───────────────────────────────────────────────────

export const CRM_TABLE_VIEW_VERSION = 1;

/** Which CRM table a saved view belongs to. The platform's `/api/views`
 *  `kind` enum only has `work_items`, so this discriminator rides
 *  inside the opaque `query` payload. */
export type CrmTableSurface = "crm_companies" | "crm_pipeline";

export interface CrmTableViewState {
  filters: TableFilters;
  sort: TableSort | null;
}

export function buildViewQuery(
  surface: CrmTableSurface,
  state: CrmTableViewState,
): Record<string, unknown> {
  return {
    surface,
    v: CRM_TABLE_VIEW_VERSION,
    filters: state.filters,
    sort: state.sort,
  };
}

/** True when a saved view's query blob targets the given CRM surface. */
export function isSurfaceView(
  view: { query: Record<string, unknown> },
  surface: CrmTableSurface,
): boolean {
  return view.query["surface"] === surface;
}

/** Defensive parse of a saved-view blob back into table state.
 *  Returns null on surface mismatch; drops malformed pieces rather
 *  than throwing (the blob is user-era data, not a trusted contract). */
export function parseViewQuery(
  query: Record<string, unknown>,
  surface: CrmTableSurface,
): CrmTableViewState | null {
  if (query["surface"] !== surface) return null;

  const filters: TableFilters = {};
  const rawFilters = query["filters"];
  if (rawFilters !== null && typeof rawFilters === "object") {
    for (const [key, value] of Object.entries(
      rawFilters as Record<string, unknown>,
    )) {
      if (typeof value === "string") filters[key] = value;
    }
  }

  let sort: TableSort | null = null;
  const rawSort = query["sort"];
  if (rawSort !== null && typeof rawSort === "object") {
    const s = rawSort as Record<string, unknown>;
    if (
      typeof s["columnId"] === "string" &&
      (s["direction"] === "asc" || s["direction"] === "desc")
    ) {
      sort = { columnId: s["columnId"], direction: s["direction"] };
    }
  }

  return { filters, sort };
}
