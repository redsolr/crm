import type { CSSProperties, ReactNode } from "react";

/**
 * The single board contract. Every board surface (project board, matters-lab,
 * sales pipeline) adapts its data + mutations to this shape and hands it to
 * <Board>. The board component + drag controller are then identical across all
 * surfaces — only the adapter differs. This is what makes "production and
 * matter (and sales) behave the same" structural rather than hand-maintained.
 *
 * Replaces the old per-prop `KanbanBoard` API (serverColumns / mapStatus /
 * moveTask / updateTask / renderCard / …) — those are now fields on one object.
 */

/** Minimal card shape the board needs to drive DnD. Adapters extend it. */
export interface BoardCardBase {
  id: string;
  title: string;
  state: { key: string };
  parent_id?: string | null;
}

export interface BoardColumnDef {
  id: string;
  title: string;
  /** Accent colour for the column header. */
  accent?: string;
  /** Render the "done" check glyph on this column header. */
  isDone?: boolean;
}

/** Drag wiring spread onto a card root by the consumer's `renderCard`. */
export interface BoardCardDrag {
  setNodeRef: (el: HTMLElement | null) => void;
  style: CSSProperties;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  isDragging: boolean;
  /** True when this card is the center-zone nest target (drop = make subtask). */
  isNestTarget: boolean;
  /** True when this card's detail is open — render the blue "selected" ring. */
  isSelected: boolean;
}

export interface BoardDataSource<TCard extends BoardCardBase> {
  /** Ordered columns (lanes). */
  columns: BoardColumnDef[];
  /** Cards grouped by column id, each already ordered for display. */
  cardsByColumn: Record<string, TCard[]>;
  /**
   * Persist a move of `id` into `toColumnId` at lane-relative `position`.
   * Returns the updated card / truthy on success, or `null` when the move
   * failed OR was declined (e.g. sales closed-stage interception opens a modal
   * instead) — the board reverts to server order on `null`.
   */
  moveCard: (
    id: string,
    toColumnId: string,
    position?: number,
  ) => Promise<unknown | null>;
  /** Optional: nest `id` under another card (drag onto card center). */
  updateCard?: (
    id: string,
    patch: { parent_id?: string | null },
  ) => Promise<unknown | null>;
  /** Render the card body; spread `drag` onto the card root element. */
  renderCard: (card: TCard, drag: BoardCardDrag) => ReactNode;
  /** Id of the card whose detail is open — gets the blue "selected" ring
   *  (Jira-style), so the board shows which card the sidebar is showing. */
  selectedCardId?: string | null;
  /** Rename a lane. When provided, the column header becomes editable (double-
   *  click → inline input). Boards without it have static headers. */
  renameColumn?: (columnId: string, name: string) => Promise<unknown>;
  /** Optional inline-create composer per column. */
  onCreate?: (columnId: string, title: string) => void;
  canCreateInColumn?: (columnId: string) => boolean;
  /** Columns whose composer trigger stays visible (vs hover-reveal). */
  alwaysShowCreateTrigger?: (columnId: string) => boolean;
  /** CSS class applied to the drag-overlay clone. */
  cloneClassName?: string;
}
