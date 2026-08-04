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
 * Jira-style list interactions (2026-08-04, both opt-in via props):
 *
 *   - `onReorder` — drag-to-rearrange rows by a lead-column grip.
 *     Active only while NO column sort is applied (manual rank is only
 *     truthful in rank order — Jira's rule); the owner receives the
 *     moved row + the full visible order and persists positions.
 *   - `inlineCreate` — a hover "+" between rows plus a persistent
 *     "+ Create" row at the table bottom; the owner renders the form
 *     row content for the chosen slot (`before`/`after` neighbors).
 *
 * Sort + filter state is CONTROLLED by the owner so saved views
 * (`/api/views`) can serialize/restore it. Row projection is the pure
 * `applyTableFilters` / `applyTableSort` from table-model.ts.
 *
 * Mobile (<768px): the table swaps for a card list (Attio/HubSpot
 * mobile pattern) — first column renders as the card title, the rest
 * as labelled field rows; tap opens the row (peek). Inline cell
 * editing, drag ordering, and inline create are desktop-only — on a
 * phone, edits happen in the peek panel. The filter bar collapses
 * behind a "Filters" toggle. Both layouts render; CSS picks one, so
 * hydration never guesses the viewport.
 */

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS as DndCss } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import {
  applyTableFilters,
  applyTableSort,
  cycleSort,
  type CrmColumn,
  type TableFilters,
  type TableSort,
} from "./table-model";
import { CrmCellEditor } from "./CrmCellEditor";
import { CrmCard, CrmCardField } from "./CrmCard";
import {
  useGutterAffordances,
  type RowPointerHandlers,
} from "./use-gutter-affordances";

/** Insertion slot for `inlineCreate` — the visible neighbors of the
 *  form row (null = list edge). */
export interface InlineCreateSlot<Row> {
  before: Row | null;
  after: Row | null;
  close: () => void;
}

interface Props<Row> {
  rows: Row[];
  columns: ReadonlyArray<CrmColumn<Row>>;
  getRowId: (row: Row) => string;
  sort: TableSort | null;
  onSortChange: (sort: TableSort | null) => void;
  filters: TableFilters;
  onFiltersChange: (filters: TableFilters) => void;
  onRowClick?: (row: Row) => void;
  /** Jira-style drag-to-rearrange. On drop the owner receives the
   *  moved row plus the FULL visible order and owns persisting ranks.
   *  Handles hide while a column sort is applied. */
  onReorder?: (moved: Row, finalOrder: Row[]) => void;
  /** Jira-style inline create — the owner renders the form row for
   *  the chosen insertion slot. Between-row "+" affordances hide
   *  while a column sort is applied; the bottom "+ Create" row is
   *  always available. */
  inlineCreate?: (slot: InlineCreateSlot<Row>) => ReactNode;
  /** Prefix for every data-testid this table emits
   *  (`{prefix}-table`, `{prefix}-row`, `{prefix}-cell-{col}`, …). */
  testIdPrefix: string;
  /** Saved-view switcher (or other table-level controls). Desktop
   *  renders it as its own row above the filter bar; on phones it
   *  collapses into the same "Filters" toggle as the filter bar. */
  toolbar?: ReactNode;
  /** Attio-style calculation row rendered under the table, given the
   *  currently VISIBLE (filtered) rows. */
  renderFooter?: (visibleRows: Row[]) => ReactNode;
}

interface EditingCell {
  rowId: string;
  columnId: string;
}

/** The drag plumbing a sortable row hands to its lead cell. */
interface SortableDragProps {
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  listeners: ReturnType<typeof useSortable>["listeners"];
  attributes: ReturnType<typeof useSortable>["attributes"];
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
  onReorder,
  inlineCreate,
  testIdPrefix,
  toolbar,
  renderFooter,
}: Props<Row>) {
  const [editing, setEditing] = useState<EditingCell | null>(null);
  // Mobile-only: the filter bar collapses behind this toggle (<768px).
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Inline-create slot: index into the visible rows the form renders
  // AT (form sits before that row); "end" pins to the table bottom.
  const [createSlot, setCreateSlot] = useState<number | "end" | null>(null);
  // The root element anchors the overlay (state, not ref — the portal
  // and rect math need it during render without touching refs).
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);

  // Post-drop order override so the dropped row doesn't snap back
  // during the gap before the owner's optimistic cache patch lands.
  // Keyed to the rows-prop identity: any rows change (optimistic
  // patch, refetch, rollback) is fresher truth than the drop-time
  // snapshot, so the override silently expires with it — no effect,
  // no reset bookkeeping.
  const [orderOverride, setOrderOverride] = useState<{
    forRows: Row[];
    ids: string[];
  } | null>(null);
  const localOrder =
    orderOverride !== null && orderOverride.forRows === rows
      ? orderOverride.ids
      : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Manual rank is only truthful while no column sort is applied
  // (Jira's rule) — sorting hides the grips and the between-row "+".
  const manualOrderActive = sort === null;

  // Gutter overlay mechanics (band tracking, hover-intent timers) —
  // see use-gutter-affordances.ts.
  const {
    gutterHover,
    rowPointerHandlers,
    cancelClear,
    scheduleClear,
    clearNow,
  } = useGutterAffordances(
    manualOrderActive &&
      (onReorder !== undefined || inlineCreate !== undefined),
    rootEl,
  );

  const filterableColumns = columns.filter((c) => c.filter !== undefined);
  const activeFilterCount = filterableColumns.filter(
    (c) => (filters[c.id] ?? "") !== "",
  ).length;
  const visibleRows = applyTableSort(
    applyTableFilters(rows, columns, filters),
    columns,
    sort,
  );
  const displayRows = localOrder
    ? (() => {
        const orderIndex = new Map(localOrder.map((id, i) => [id, i]));
        return [...visibleRows].sort(
          (a, b) =>
            (orderIndex.get(getRowId(a)) ?? 0) -
            (orderIndex.get(getRowId(b)) ?? 0),
        );
      })()
    : visibleRows;
  const [titleColumn, ...cardColumns] = columns;
  const colCount = columns.length;
  const slotIndex =
    createSlot === "end" ? displayRows.length : createSlot;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!onReorder || !over || active.id === over.id) return;
    const ids = displayRows.map(getRowId);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const finalOrder = arrayMove(displayRows, oldIndex, newIndex);
    setOrderOverride({ forRows: rows, ids: finalOrder.map(getRowId) });
    onReorder(displayRows[oldIndex], finalOrder);
  }

  // The overlay grip for the hovered row — PORTALED to the root so it
  // floats in the margin strip OUTSIDE the scroll container (no
  // clipping), while the drag listeners stay the hovered row's own.
  const renderGripOverlay = (rowId: string, drag: SortableDragProps) => {
    if (
      rootEl === null ||
      !manualOrderActive ||
      gutterHover?.kind !== "grip" ||
      gutterHover.rowId !== rowId
    ) {
      return null;
    }
    return createPortal(
      <button
        type="button"
        className="crm-drag-handle"
        style={
          {
            top: gutterHover.y,
            "--gutter-edge": `${gutterHover.x}px`,
          } as React.CSSProperties
        }
        aria-label="Drag to reorder"
        data-testid={`${testIdPrefix}-drag-handle`}
        ref={drag.setActivatorNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        onPointerEnter={cancelClear}
        onPointerLeave={scheduleClear}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>,
      rootEl,
    );
  };

  const renderRowCells = (row: Row, rowId: string) =>
    columns.map((column) => {
      const isEditing =
        editing?.rowId === rowId && editing.columnId === column.id;
      const editable = column.edit !== undefined;
      return (
        <td
          key={column.id}
          className={`${
            column.align === "right" ? "text-right tabular-nums" : ""
          } ${editable ? "crm-cell-editable" : ""} ${
            column.cellClassName ?? ""
          }`}
          data-testid={`${testIdPrefix}-cell-${column.id}`}
          onClick={
            editable
              ? (e) => {
                  // Editing a cell must not open the row's peek panel.
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
    });

  const renderCreateRow = (index: number) => (
    <tr
      // The END slot keys by name, not index: a successful create grows
      // the list, and an index key would remount the form mid-rapid-entry
      // (wiping the kept company/use-case).
      key={`inline-create-${createSlot === "end" ? "end" : index}`}
      className="crm-inline-create-row"
      data-testid={`${testIdPrefix}-inline-create-row`}
    >
      <td colSpan={colCount} className="crm-inline-create-cell">
        {inlineCreate?.({
          before: displayRows[index - 1] ?? null,
          after: displayRows[index] ?? null,
          close: () => setCreateSlot(null),
        })}
      </td>
    </tr>
  );

  const bodyRows: ReactNode[] = [];
  displayRows.forEach((row, rowIndex) => {
    if (slotIndex === rowIndex && createSlot !== "end") {
      bodyRows.push(renderCreateRow(rowIndex));
    }
    const rowId = getRowId(row);
    bodyRows.push(
      onReorder !== undefined ? (
        <CrmSortableRow
          key={rowId}
          rowId={rowId}
          disabled={!manualOrderActive}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          testIdPrefix={testIdPrefix}
          rowHandlers={rowPointerHandlers(rowId, rowIndex)}
        >
          {(drag) => (
            <>
              {renderRowCells(row, rowId)}
              {renderGripOverlay(rowId, drag)}
            </>
          )}
        </CrmSortableRow>
      ) : (
        <tr
          key={rowId}
          className="crm-record-table-row"
          data-testid={`${testIdPrefix}-row`}
          data-row-id={rowId}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          {...rowPointerHandlers(rowId, rowIndex)}
        >
          {renderRowCells(row, rowId)}
        </tr>
      ),
    );
  });
  if (slotIndex === displayRows.length) {
    bodyRows.push(renderCreateRow(displayRows.length));
  }

  const table = (
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
        {bodyRows}
        {displayRows.length === 0 && (
          <tr className="crm-record-table-empty-row">
            <td
              colSpan={colCount}
              className="text-center text-[var(--theme-text-muted)] py-8"
              data-testid={`${testIdPrefix}-no-match`}
            >
              No records match the current filters.
            </td>
          </tr>
        )}
        {inlineCreate !== undefined && createSlot !== "end" && (
          <tr className="crm-table-create-row">
            <td colSpan={colCount}>
              <button
                type="button"
                className="crm-table-create-btn"
                data-testid={`${testIdPrefix}-create-row-button`}
                onClick={() => setCreateSlot("end")}
              >
                <Plus size={13} aria-hidden="true" />
                Create
              </button>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const hasGutterMargin =
    onReorder !== undefined || inlineCreate !== undefined;

  return (
    <div
      ref={setRootEl}
      className="crm-record-table relative flex-1 min-h-0 flex flex-col"
    >
      {(filterableColumns.length > 0 || toolbar) && (
        <button
          type="button"
          className="crm-table-filter-toggle"
          data-testid={`${testIdPrefix}-filter-toggle`}
          data-open={filtersOpen ? "true" : undefined}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="crm-table-filter-toggle-count">
              {activeFilterCount}
            </span>
          )}
          <span aria-hidden="true">{filtersOpen ? "▴" : "▾"}</span>
        </button>
      )}
      {/* Desktop: display:contents — the toolbar + filter rows render
          as siblings, exactly as before. Mobile: one collapsible block
          behind the Filters toggle. */}
      <div
        className="crm-table-controls"
        data-mobile-open={filtersOpen ? "true" : undefined}
      >
      {toolbar && <div className="crm-table-toolbar">{toolbar}</div>}
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
      </div>

      {/* Desktop: table + count footer live in one bordered, rounded
          shell (Jira/Attio-style self-contained list — the table must
          not bleed into the page). Mobile: display:contents, the card
          list owns the layout. */}
      <div
        className={`crm-table-shell ${
          hasGutterMargin ? "crm-table-shell-gutter" : ""
        }`}
      >
      <div
        className="crm-record-table-scroll flex-1 min-h-0 overflow-auto"
        onScroll={clearNow}
      >
        {onReorder !== undefined ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayRows.map(getRowId)}
              strategy={verticalListSortingStrategy}
            >
              {table}
            </SortableContext>
          </DndContext>
        ) : (
          table
        )}
      </div>

      {/* Mobile card list — same projected rows, CSS-switched. */}
      <div className="crm-card-list" data-testid={`${testIdPrefix}-cards`}>
        {displayRows.map((row) => {
          const rowId = getRowId(row);
          return (
            <CrmCard
              key={rowId}
              testId={`${testIdPrefix}-card`}
              rowId={rowId}
              title={titleColumn.render(row)}
              onOpen={onRowClick ? () => onRowClick(row) : undefined}
            >
              {cardColumns.map((column) => {
                const value = column.getValue(row);
                if (value === null || value === "") return null;
                return (
                  <CrmCardField key={column.id} label={column.label}>
                    {column.render(row)}
                  </CrmCardField>
                );
              })}
            </CrmCard>
          );
        })}
        {displayRows.length === 0 && (
          <div
            className="crm-card-list-empty"
            data-testid={`${testIdPrefix}-cards-no-match`}
          >
            No records match the current filters.
          </div>
        )}
      </div>

      {renderFooter && (
        <div
          className="crm-table-footer border-t border-[var(--theme-border-primary)]"
          data-testid={`${testIdPrefix}-footer`}
        >
          {renderFooter(displayRows)}
        </div>
      )}
      </div>

      {/* Insert overlay — lives at the ROOT (outside the scroll
          container's clip): the "+" floats in the margin strip left of
          the shell, the 2px line crosses the shell at the boundary. */}
      {inlineCreate !== undefined &&
        manualOrderActive &&
        gutterHover?.kind === "slot" && (
          <button
            type="button"
            className="crm-row-insert-zone"
            style={
              {
                top: gutterHover.y,
                "--gutter-edge": `${gutterHover.x}px`,
              } as React.CSSProperties
            }
            aria-label="Insert a row here"
            data-testid={`${testIdPrefix}-insert-after`}
            onPointerEnter={cancelClear}
            onPointerLeave={scheduleClear}
            onClick={(e) => {
              e.stopPropagation();
              const slot = gutterHover.slot;
              clearNow();
              setCreateSlot(slot);
            }}
          >
            <span className="crm-row-insert-icon" aria-hidden="true">
              <Plus size={16} />
            </span>
          </button>
        )}
    </div>
  );
}

/**
 * Sortable `<tr>` — dnd-kit transform/transition ride the row while a
 * drag is active; the overlay grip (portaled to the table root) is the
 * only activator, so cell clicks (peek, inline edit) stay untouched.
 */
function CrmSortableRow({
  rowId,
  disabled,
  onClick,
  testIdPrefix,
  rowHandlers,
  children,
}: {
  rowId: string;
  disabled: boolean;
  onClick?: () => void;
  testIdPrefix: string;
  rowHandlers: RowPointerHandlers;
  children: (drag: SortableDragProps) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowId, disabled });
  return (
    <tr
      ref={setNodeRef}
      className="crm-record-table-row"
      data-testid={`${testIdPrefix}-row`}
      data-row-id={rowId}
      data-dragging={isDragging ? "true" : undefined}
      style={{
        transform: DndCss.Transform.toString(transform),
        transition,
      }}
      onClick={onClick}
      {...rowHandlers}
    >
      {children({ setActivatorNodeRef, listeners, attributes })}
    </tr>
  );
}
