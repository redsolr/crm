import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { WorkItem } from "@/lib/workItemsApi";
import { getDescendantIds } from "@/lib/task-tree";
import type { BoardCardBase, BoardColumnDef } from "@/components/board/board-data-source";

/**
 * The single board drag controller. Used by <Board> for every surface
 * (project / matter / sales) — the data differs (a `BoardDataSource` adapter),
 * the drag behaviour is identical.
 *
 * Two design rules that fix the bugs we kept hitting:
 *
 * 1. **No render-phase setState.** While idle the board renders `cardsByColumn`
 *    directly; only an *active drag* holds a local snapshot (`dragColumns`).
 *    There is no "resync server data during render" branch, so it can't loop
 *    ("Maximum update depth").
 *
 * 2. **Correct @dnd-kit reorder.** We do NOT mutate the array on same-lane
 *    `onDragOver` — `SortableContext`'s `verticalListSortingStrategy` animates
 *    the sibling shift via transforms (smooth, one-at-a-time). We only move a
 *    card in `onDragOver` when it crosses into a *different* lane (so it
 *    visually enters). The final order is committed with `arrayMove` on
 *    `onDragEnd`. Mutating the array on every same-lane hover was what made the
 *    lower items "all shift up at once".
 */

interface UseBoardDragArgs<TCard extends BoardCardBase> {
  columns: BoardColumnDef[];
  cardsByColumn: Record<string, TCard[]>;
  moveCard: (
    id: string,
    toColumnId: string,
    position?: number,
  ) => Promise<unknown | null>;
  updateCard?: (
    id: string,
    patch: { parent_id?: string | null },
  ) => Promise<unknown | null>;
}

export interface UseBoardDragReturn<TCard extends BoardCardBase> {
  /** Cards per column to render — the drag snapshot while dragging, else server. */
  localColumns: Record<string, TCard[]>;
  activeCard: TCard | null;
  /** Card id currently in the center-zone nest target (drop = subtask). */
  nestTargetId: string | null;
  /** Column under the pointer — drives the drop highlight. */
  overColumnId: string | null;
  sensors: ReturnType<typeof useSensors>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

export function useBoardDrag<TCard extends BoardCardBase>({
  columns,
  cardsByColumn,
  moveCard,
  updateCard,
}: UseBoardDragArgs<TCard>): UseBoardDragReturn<TCard> {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  // Idle = render server data directly. Active drag = render the snapshot.
  const [dragColumns, setDragColumns] = useState<Record<string, TCard[]> | null>(
    null,
  );
  const [activeCard, setActiveCard] = useState<TCard | null>(null);
  const [nestTargetId, setNestTargetId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const dragOriginRef = useRef<{ columnId: string; index: number } | null>(null);

  const localColumns = dragColumns ?? cardsByColumn;

  // Pointer Y for nest-zone (center 40% of a card) detection.
  const pointerYRef = useRef(0);
  useEffect(() => {
    if (!activeCard) return;
    const onPointer = (e: PointerEvent) => {
      pointerYRef.current = e.clientY;
    };
    window.addEventListener("pointermove", onPointer);
    return () => window.removeEventListener("pointermove", onPointer);
  }, [activeCard]);

  const allCards = useMemo(
    () => Object.values(localColumns).flat(),
    [localColumns],
  );
  const findCard = useCallback(
    (id: string) => allCards.find((c) => c.id === id),
    [allCards],
  );
  const findColumnId = useCallback(
    (cardId: string): string | null => {
      for (const id of columnIds) {
        if (localColumns[id]?.some((c) => c.id === cardId)) return id;
      }
      return null;
    },
    [localColumns, columnIds],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      document.body.classList.add("is-dragging");
      const card = findCard(event.active.id as string);
      if (!card) return;
      const columnId = findColumnId(card.id);
      const index =
        columnId != null
          ? (localColumns[columnId] ?? []).findIndex((c) => c.id === card.id)
          : -1;
      dragOriginRef.current =
        columnId != null && index >= 0 ? { columnId, index } : null;
      // Freeze the server view as the snapshot we mutate during the drag.
      setDragColumns(cardsByColumn);
      setOverColumnId(columnId);
      setActiveCard(card);
    },
    [findCard, findColumnId, localColumns, cardsByColumn],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) {
        setNestTargetId(null);
        return;
      }
      const activeId = active.id as string;
      const overId = over.id as string;
      const isOverColumn = columnIds.includes(overId);

      // Center-zone of a card = nest target (drop → make subtask).
      if (updateCard && !isOverColumn && overId !== activeId) {
        const overEl = document.querySelector(`[data-card-id="${overId}"]`);
        if (overEl) {
          const rect = overEl.getBoundingClientRect();
          const relativeY = (pointerYRef.current - rect.top) / rect.height;
          if (relativeY > 0.3 && relativeY < 0.7) {
            const descendants = getDescendantIds(
              activeId,
              allCards as unknown as WorkItem[],
            );
            if (!descendants.has(overId)) {
              setNestTargetId(overId);
              return;
            }
          }
        }
      }
      setNestTargetId(null);

      const fromCol = findColumnId(activeId);
      const toCol = isOverColumn ? overId : findColumnId(overId);
      if (!fromCol || !toCol) return;
      setOverColumnId(toCol);

      // ONLY mutate the array when crossing into a different lane, so the card
      // visually enters it. Same-lane reordering is animated by the sortable
      // strategy via transforms — mutating here is what caused the jank.
      if (fromCol === toCol) return;
      setDragColumns((prev) => {
        const base = prev ?? cardsByColumn;
        const card = (base[fromCol] ?? []).find((c) => c.id === activeId);
        if (!card) return base;
        const from = (base[fromCol] ?? []).filter((c) => c.id !== activeId);
        const to = [...(base[toCol] ?? [])];
        const overIdx = isOverColumn
          ? to.length
          : to.findIndex((c) => c.id === overId);
        to.splice(overIdx >= 0 ? overIdx : to.length, 0, card);
        return { ...base, [fromCol]: from, [toCol]: to };
      });
    },
    [findColumnId, columnIds, allCards, cardsByColumn, updateCard],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      document.body.classList.remove("is-dragging");
      const nestTarget = nestTargetId;
      setNestTargetId(null);
      try {
        const activeId = event.active.id as string;
        const card = findCard(activeId);
        if (!card) return;

        // Nest-to-subtask. Server cache updates on success; reverts on null —
        // either way the `finally` releases the snapshot to server truth.
        if (nestTarget && updateCard) {
          await updateCard(activeId, { parent_id: nestTarget });
          return;
        }

        const toCol = findColumnId(activeId);
        if (!toCol) return;
        const overId = event.over ? (event.over.id as string) : null;
        const isOverColumn = overId != null && columnIds.includes(overId);

        const toItems = localColumns[toCol] ?? [];
        const activeIndex = toItems.findIndex((c) => c.id === activeId);
        const overIndex =
          overId == null || isOverColumn
            ? toItems.length - 1
            : toItems.findIndex((c) => c.id === overId);
        const finalItems =
          activeIndex === -1 || overIndex === -1
            ? toItems
            : arrayMove(toItems, activeIndex, overIndex);
        const finalIndex = finalItems.findIndex((c) => c.id === activeId);

        // Show the committed order immediately (the move mutation's optimistic
        // cache update then keeps server data in sync before we release).
        setDragColumns({ ...localColumns, [toCol]: finalItems });

        const origin = dragOriginRef.current;
        const changed =
          origin == null ||
          origin.columnId !== toCol ||
          origin.index !== finalIndex;
        if (changed) {
          await moveCard(activeId, toCol, finalIndex >= 0 ? finalIndex : undefined);
        }
      } catch (err) {
        console.error("[useBoardDrag] drag mutation failed:", err);
      } finally {
        setDragColumns(null);
        setOverColumnId(null);
        dragOriginRef.current = null;
        setActiveCard(null);
      }
    },
    [findCard, findColumnId, columnIds, localColumns, moveCard, updateCard, nestTargetId],
  );

  const handleDragCancel = useCallback(() => {
    document.body.classList.remove("is-dragging");
    dragOriginRef.current = null;
    setActiveCard(null);
    setNestTargetId(null);
    setOverColumnId(null);
    setDragColumns(null);
  }, []);

  return {
    localColumns,
    activeCard,
    nestTargetId,
    overColumnId,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
