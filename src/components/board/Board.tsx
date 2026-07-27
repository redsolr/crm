"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useBoardDrag } from "@/hooks/use-board-drag";
import { BoardColumn } from "./BoardColumn";
import type {
  BoardCardBase,
  BoardColumnDef,
  BoardDataSource,
} from "./board-data-source";

/**
 * The one kanban board. Driven entirely by a `BoardDataSource` adapter (project
 * / matter / sales), so every surface shares identical drag behaviour — only
 * the data differs. Replaces the old `KanbanBoard` + standalone
 * `SalesKanbanBoard`.
 */

export interface BoardProps<TCard extends BoardCardBase> {
  source: BoardDataSource<TCard>;
  scrollRef?: (node: HTMLDivElement | null) => void;
  renderColumnTop?: (column: BoardColumnDef, cards: TCard[]) => React.ReactNode;
  renderColumnFooter?: (
    column: BoardColumnDef,
    cards: TCard[],
  ) => React.ReactNode;
  /** Trailing element after the last column (e.g. an add-column button). */
  trailing?: React.ReactNode;
}

export function Board<TCard extends BoardCardBase>({
  source,
  scrollRef,
  renderColumnTop,
  renderColumnFooter,
  trailing,
}: BoardProps<TCard>) {
  const dnd = useBoardDrag({
    columns: source.columns,
    cardsByColumn: source.cardsByColumn,
    moveCard: source.moveCard,
    updateCard: source.updateCard,
  });

  // dnd-kit "multiple containers" collision recipe. Resolves the over-target to
  // a single, STABLE card (so the sortable strategy eases siblings one-at-a-time
  // instead of jiggling/jumping), while still letting EMPTY columns be drop
  // targets. `lastOverId` holds the over steady across the in-between frames
  // pointer detection would otherwise report as "nothing".
  const lastOverId = useRef<string | null>(null);
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const columnIds = new Set(source.columns.map((c) => c.id));
      const pointerHits = pointerWithin(args);
      const hits =
        pointerHits.length > 0 ? pointerHits : rectIntersection(args);
      let overId = getFirstCollision(hits, "id");
      if (overId != null) {
        // If the pointer resolved to a column, narrow to the closest CARD
        // inside it so reordering targets a position (empty column → keep the
        // column id so the lane is still droppable).
        if (columnIds.has(String(overId))) {
          const cardIds = (dnd.localColumns[String(overId)] ?? []).map(
            (c) => c.id,
          );
          if (cardIds.length > 0) {
            const within = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) => c.id !== overId && cardIds.includes(String(c.id)),
              ),
            });
            const inner = getFirstCollision(within, "id");
            if (inner != null) overId = inner;
          }
        }
        lastOverId.current = String(overId);
        return [{ id: overId }];
      }
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [source.columns, dnd.localColumns],
  );

  const [dragClone, setDragClone] = useState<{
    html: string;
    width: number;
  } | null>(null);

  const handleDragStart = (e: DragStartEvent) => {
    const el = document.querySelector(`[data-card-id="${e.active.id}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setDragClone({ html: el.innerHTML, width: rect.width });
    }
    dnd.handleDragStart(e);
  };
  const handleDragEnd = (e: Parameters<typeof dnd.handleDragEnd>[0]) => {
    setDragClone(null);
    void dnd.handleDragEnd(e);
  };
  const handleDragCancel = () => {
    setDragClone(null);
    dnd.handleDragCancel();
  };

  const firstColumnId = source.columns[0]?.id;
  const showComposer = (id: string): boolean =>
    source.onCreate != null &&
    (source.canCreateInColumn
      ? source.canCreateInColumn(id)
      : id === firstColumnId);

  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={dnd.handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={scrollRef}
        className="board-scroll flex flex-1 gap-2 overflow-x-auto overflow-y-hidden px-4 pt-4 pb-2"
      >
        {source.columns.map((column) => (
          <BoardColumn<TCard>
            key={column.id}
            column={column}
            cards={dnd.localColumns[column.id] ?? []}
            isDropTarget={dnd.overColumnId === column.id}
            nestTargetId={dnd.nestTargetId}
            selectedCardId={source.selectedCardId}
            renderCard={source.renderCard}
            renderColumnTop={renderColumnTop}
            renderColumnFooter={renderColumnFooter}
            onCreate={source.onCreate}
            renameColumn={source.renameColumn}
            showComposer={showComposer(column.id)}
            alwaysShowCreateTrigger={
              source.alwaysShowCreateTrigger?.(column.id) ?? false
            }
          />
        ))}
        {trailing}
      </div>
      <DragOverlay>
        {dragClone ? (
          <div
            style={{ width: dragClone.width }}
            className={source.cloneClassName}
            dangerouslySetInnerHTML={{ __html: dragClone.html }}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
