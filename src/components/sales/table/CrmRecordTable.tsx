"use client";

/**
 * CrmRecordTable — the reusable Attio-class record table for CRM
 * surfaces (Companies, Pipeline table mode). Driven by `CrmColumn`
 * definitions (fixed leading columns + AttributeDefinition-backed
 * attribute columns, both expressed the same way):
 *
 *   - click-to-sort headers (asc → desc → none) on sortable columns;
 *   - a dense filter bar (select columns filter by option, text
 *     columns by contains) above the table;
 *   - inline type-aware cell editing (CrmCellEditor) — click a cell,
 *     commit on Enter/blur (select/boolean commit on change), Escape
 *     cancels; the commit callback per column owns the mutation.
 *
 * Sort + filter state is CONTROLLED by the owner so saved views
 * (`/api/views`) can serialize/restore it. Row projection is the pure
 * `applyTableFilters` / `applyTableSort` from table-model.ts.
 */

import { useState, type ReactNode } from "react";
import {
  applyTableFilters,
  applyTableSort,
  cycleSort,
  type CrmColumn,
  type TableFilters,
  type TableSort,
} from "./table-model";
import { CrmCellEditor } from "./CrmCellEditor";

interface Props<Row> {
  rows: Row[];
  columns: ReadonlyArray<CrmColumn<Row>>;
  getRowId: (row: Row) => string;
  sort: TableSort | null;
  onSortChange: (sort: TableSort | null) => void;
  filters: TableFilters;
  onFiltersChange: (filters: TableFilters) => void;
  onRowClick?: (row: Row) => void;
  /** Prefix for every data-testid this table emits
   *  (`{prefix}-table`, `{prefix}-row`, `{prefix}-cell-{col}`, …). */
  testIdPrefix: string;
  /** Attio-style calculation row rendered under the table, given the
   *  currently VISIBLE (filtered) rows. */
  renderFooter?: (visibleRows: Row[]) => ReactNode;
}

interface EditingCell {
  rowId: string;
  columnId: string;
}

export function CrmRecordTable<Row>({
  rows,
  columns,
  getRowId,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  onRowClick,
  testIdPrefix,
  renderFooter,
}: Props<Row>) {
  const [editing, setEditing] = useState<EditingCell | null>(null);

  const filterableColumns = columns.filter((c) => c.filter !== undefined);
  const visibleRows = applyTableSort(
    applyTableFilters(rows, columns, filters),
    columns,
    sort,
  );

  return (
    <div className="crm-record-table flex-1 min-h-0 flex flex-col">
      {filterableColumns.length > 0 && (
        <div
          className="crm-table-filter-bar"
          data-testid={`${testIdPrefix}-filter-bar`}
        >
          {filterableColumns.map((column) => (
            <label key={column.id} className="crm-table-filter">
              <span className="crm-table-filter-label">{column.label}</span>
              {column.filter?.type === "select" ? (
                <select
                  data-testid={`${testIdPrefix}-filter-${column.id}`}
                  className="crm-table-filter-input"
                  value={filters[column.id] ?? ""}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, [column.id]: e.target.value })
                  }
                >
                  <option value="">Any</option>
                  {column.filter.options.map((o) => (
                    <option key={o} value={o}>
                      {o.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  data-testid={`${testIdPrefix}-filter-${column.id}`}
                  className="crm-table-filter-input"
                  type="text"
                  placeholder="Contains…"
                  value={filters[column.id] ?? ""}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, [column.id]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
        </div>
      )}

      <div className="crm-record-table-scroll flex-1 min-h-0 overflow-auto">
        <table className="crm-table" data-testid={`${testIdPrefix}-table`}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={`${
                    column.align === "right" ? "text-right" : "text-left"
                  } ${column.headerClassName ?? ""}`}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className="crm-table-sort-btn"
                      data-testid={`${testIdPrefix}-sort-${column.id}`}
                      data-direction={
                        sort?.columnId === column.id ? sort.direction : "none"
                      }
                      onClick={() => onSortChange(cycleSort(sort, column.id))}
                    >
                      {column.label}
                      <span className="crm-table-sort-icon" aria-hidden="true">
                        {sort?.columnId === column.id
                          ? sort.direction === "asc"
                            ? "▲"
                            : "▼"
                          : ""}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const rowId = getRowId(row);
              return (
                <tr
                  key={rowId}
                  className="crm-record-table-row"
                  data-testid={`${testIdPrefix}-row`}
                  data-row-id={rowId}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => {
                    const isEditing =
                      editing?.rowId === rowId &&
                      editing.columnId === column.id;
                    const editable = column.edit !== undefined;
                    return (
                      <td
                        key={column.id}
                        className={`${
                          column.align === "right"
                            ? "text-right tabular-nums"
                            : ""
                        } ${editable ? "crm-cell-editable" : ""} ${
                          column.cellClassName ?? ""
                        }`}
                        data-testid={`${testIdPrefix}-cell-${column.id}`}
                        onClick={
                          editable
                            ? (e) => {
                                // Editing a cell must not open the row's
                                // peek panel.
                                e.stopPropagation();
                                setEditing({ rowId, columnId: column.id });
                              }
                            : undefined
                        }
                      >
                        {isEditing && column.edit ? (
                          <CrmCellEditor
                            dataType={column.edit.dataType}
                            options={column.edit.options}
                            initialValue={column.edit.getEditValue(row)}
                            testId={`${testIdPrefix}-edit-${column.id}`}
                            onCommit={(raw) => column.edit?.commit(row, raw)}
                            onClose={() => setEditing(null)}
                          />
                        ) : (
                          column.render(row)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {visibleRows.length === 0 && (
              <tr className="crm-record-table-empty-row">
                <td
                  colSpan={columns.length}
                  className="text-center text-[var(--theme-text-muted)] py-8"
                  data-testid={`${testIdPrefix}-no-match`}
                >
                  No records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {renderFooter && (
        <div
          className="crm-table-footer border-t border-[var(--theme-border-primary)]"
          data-testid={`${testIdPrefix}-footer`}
        >
          {renderFooter(visibleRows)}
        </div>
      )}
    </div>
  );
}
