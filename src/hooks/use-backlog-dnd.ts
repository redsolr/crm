import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  MeasuringStrategy,
  type MeasuringConfiguration,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import type { WorkItem } from "@/lib/workItemsApi";
import type { MoveTaskArgs } from "@/queries/views/use-backlog-query";
import {
  buildTreeIndex,
  getDescendantIds,
  getDescendantIdsForRoots,
  lanePositionForVisualIndex,
  compareSiblings,
  type FlatItem,
  type TreeIndex,
} from "@/lib/task-tree";

/**
 * Drag-and-drop for the backlog tree list.
 *
 * Model (first principles):
 * - Rows do NOT shift while dragging. A drop indicator (line for
 *   before/after, ring for nest) shows exactly where the row will land, and
 *   the drop executes exactly what the indicator shows.
 * - A dragged parent carries its whole subtree: descendants are hidden from
 *   the list during the drag and re-appear under the parent at its new spot.
 *   This also makes cycles structurally impossible (a descendant is never a
 *   drop target).
 * - Drop targets are resolved at hover time into (parent, visual index among
 *   that parent's children); on drop this is translated into the platform's
 *   lane-relative `position` — an index among siblings sharing
 *   (parent_id, workflow state) — matching the server renumber contract.
 *
 * Hover zones on a row — reorder is the default, nesting is a deliberate
 * horizontal gesture:
 * - Pointer left of the row's content start (the status-checkmark area,
 *   marked `data-nest-zone-start`): reorder only — top half = insert before,
 *   bottom half = insert after. This is where a drag naturally starts (the
 *   grip handle), so plain vertical drags never nest by accident.
 * - Pointer at/past the content start ("exactly on top" of the item): the
 *   middle 40% nests as a subtask; top/bottom 30% still reorder.
 * "After" a row with visible children means "first child" — the spot
 * directly below the row IS inside its subtree.
 */

export type DropKind = "before" | "after" | "nest";

export interface DropIndicator {
  /** Row the pointer is over (where the line/ring renders). */
  overId: string;
  kind: DropKind;
  /** Depth the dragged row will land at. */
  depth: number;
  /** Resolved target parent (null = root level). */
  parentId: string | null;
  /** Resolved insert index among the target parent's ordered children. */
  visualIndex: number;
}

interface UseBacklogDndOptions {
  tasks: WorkItem[];
  moveTask: (id: string, move: MoveTaskArgs) => Promise<WorkItem | null>;
  /** "desktop" uses Pointer+Keyboard sensors; "mobile" uses Pointer+Touch */
  mode: "desktop" | "mobile";
  /** Rows whose subtree is collapsed — their descendants are hidden from the
   *  list and from drop-target resolution (dropping below a collapsed parent
   *  inserts as its sibling, never invisibly inside the subtree). */
  collapsedIds?: ReadonlySet<string>;
}

interface UseBacklogDndReturn {
  // State
  activeId: string | null;
  nestTargetId: string | null;
  dropIndicator: DropIndicator | null;
  flatItems: FlatItem[];
  sortableIds: string[];
  localTasks: WorkItem[];
  activeItem: FlatItem | null;
  /** Number of descendants travelling with the dragged row. */
  activeChildCount: number;
  /** Full tree index (sibling groups, effective parents) for callers that
   *  need to compute insert targets — e.g. the insert-between-rows button. */
  treeIndex: TreeIndex;

  // Sensors + collision + measuring
  sensors: ReturnType<typeof useSensors>;
  collisionDetection: CollisionDetection;
  measuring: MeasuringConfiguration;

  // Handlers
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragMove: (event: DragMoveEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
  handleUnnest: (work_item_id: string) => Promise<void>;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/** Rows are static during drag, so the row under the pointer is the target;
 *  fall back to closest-center for keyboard-driven drags. */
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCenter(args);
};

// The dragged row's descendants unmount when the drag starts (the subtree
// travels with the parent), shifting every row below — droppable rects must
// be re-measured during the drag or collisions run on stale geometry.
const measuring: MeasuringConfiguration = {
  droppable: { strategy: MeasuringStrategy.Always },
};

export function useBacklogDnd({
  tasks,
  moveTask,
  mode,
  collapsedIds,
}: UseBacklogDndOptions): UseBacklogDndReturn {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null,
  );
  // Handlers need the latest indicator synchronously (state lags inside the
  // same event tick).
  const indicatorRef = useRef<DropIndicator | null>(null);
  const setIndicator = useCallback((ind: DropIndicator | null) => {
    indicatorRef.current = ind;
    setDropIndicator((prev) => {
      if (
        prev === ind ||
        (prev &&
          ind &&
          prev.overId === ind.overId &&
          prev.kind === ind.kind &&
          prev.depth === ind.depth &&
          prev.parentId === ind.parentId &&
          prev.visualIndex === ind.visualIndex)
      ) {
        return prev;
      }
      return ind;
    });
  }, []);

  const treeIndex = useMemo(() => buildTreeIndex(tasks), [tasks]);

  // Descendants of the dragged row travel with it — hide them while dragging.
  const dragHiddenIds = useMemo<ReadonlySet<string>>(
    () => (activeId ? getDescendantIds(activeId, tasks) : EMPTY_SET),
    [activeId, tasks],
  );

  // Descendants of collapsed rows are hidden too — from the rendered list
  // AND from drop resolution (they can't be drop targets, and a collapsed
  // parent's subtree doesn't count as "visible children").
  const collapsedHiddenIds = useMemo<ReadonlySet<string>>(
    () =>
      collapsedIds && collapsedIds.size > 0
        ? getDescendantIdsForRoots(collapsedIds, tasks)
        : EMPTY_SET,
    [collapsedIds, tasks],
  );

  const hiddenIds = useMemo<ReadonlySet<string>>(() => {
    if (dragHiddenIds.size === 0) return collapsedHiddenIds;
    if (collapsedHiddenIds.size === 0) return dragHiddenIds;
    return new Set([...dragHiddenIds, ...collapsedHiddenIds]);
  }, [dragHiddenIds, collapsedHiddenIds]);

  const flatItems = useMemo(
    () =>
      hiddenIds.size === 0
        ? treeIndex.flat
        : treeIndex.flat.filter((i) => !hiddenIds.has(i.task.id)),
    [treeIndex, hiddenIds],
  );
  const sortableIds = useMemo(
    () => flatItems.map((i) => i.task.id),
    [flatItems],
  );
  const flatById = useMemo(
    () => new Map(treeIndex.flat.map((i) => [i.task.id, i])),
    [treeIndex],
  );

  const activeItem = useMemo(
    () => (activeId ? (flatById.get(activeId) ?? null) : null),
    [activeId, flatById],
  );
  const activeChildCount = dragHiddenIds.size;

  // Sensors — all hooks called unconditionally (rules-of-hooks); only the
  // mode-relevant ones are passed to useSensors().
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: mode === "desktop" ? 5 : 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(
    pointerSensor,
    ...(mode === "mobile" ? [touchSensor] : [keyboardSensor]),
  );

  // Pointer tracking — dnd-kit events carry deltas, not the live pointer.
  // Y resolves the before/nest/after zone within the row; X gates nesting
  // (nest requires the pointer at/past the row's content start).
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  useEffect(() => {
    if (!activeId) return;
    const onPointer = (e: PointerEvent) => {
      pointerXRef.current = e.clientX;
      pointerYRef.current = e.clientY;
    };
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) {
        pointerXRef.current = e.touches[0].clientX;
        pointerYRef.current = e.touches[0].clientY;
      }
    };
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("touchmove", onTouch);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [activeId]);

  // ──── Indicator projection ────

  const computeIndicator = useCallback(
    (draggedId: string, overId: string | null): DropIndicator | null => {
      if (!overId || overId === draggedId) return null;
      const overFlat = flatById.get(overId);
      if (!overFlat) return null;

      const overEl = document.querySelector(`[data-task-id="${overId}"]`);
      if (!overEl) return null;
      const rect = overEl.getBoundingClientRect();
      const fraction = (pointerYRef.current - rect.top) / rect.height;

      // Nesting requires the pointer horizontally at/past the row's content
      // start (the status-checkmark area, marked data-nest-zone-start).
      // Drags live in the left gutter by default (the grip handle is where a
      // drag starts), so plain vertical drags reorder; moving right "onto"
      // the item is the deliberate make-it-a-child gesture. Rows without the
      // marker keep the old always-nestable behavior.
      const nestStartEl = overEl.querySelector("[data-nest-zone-start]");
      const nestEnabled =
        !nestStartEl ||
        pointerXRef.current >= nestStartEl.getBoundingClientRect().left;

      // Middle 40% = nest as subtask (append to the row's children) — only
      // when the pointer is on the item itself, never from the left gutter.
      if (nestEnabled && fraction >= 0.3 && fraction <= 0.7) {
        const children = treeIndex.childrenByParent.get(overId) ?? [];
        return {
          overId,
          kind: "nest",
          depth: overFlat.depth + 1,
          parentId: overId,
          visualIndex: children.length,
        };
      }

      // Without a nest zone the row splits 50/50 into before/after.
      const after = nestEnabled ? fraction > 0.7 : fraction > 0.5;

      // "After" a row whose children are visible = first child: the slot
      // directly below that row is inside its subtree. (The dragged row's own
      // hidden descendants never count — if they were the only children, the
      // subtree isn't visible.)
      const overChildren = treeIndex.childrenByParent.get(overId) ?? [];
      const hasVisibleChildren = overChildren.some(
        (c) => c.id !== draggedId && !hiddenIds.has(c.id),
      );
      if (after && hasVisibleChildren) {
        return {
          overId,
          kind: "after",
          depth: overFlat.depth + 1,
          parentId: overId,
          visualIndex: 0,
        };
      }

      // Sibling insert before/after the row, at the row's own level.
      const siblings = treeIndex.childrenByParent.get(overFlat.parentId) ?? [];
      const overIdx = siblings.findIndex((s) => s.id === overId);
      if (overIdx === -1) return null;
      return {
        overId,
        kind: after ? "after" : "before",
        depth: overFlat.depth,
        parentId: overFlat.parentId,
        visualIndex: after ? overIdx + 1 : overIdx,
      };
    },
    [flatById, treeIndex, hiddenIds],
  );

  // ──── Handlers ────

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      document.body.classList.add("is-dragging");
      // Seed the pointer position — the window pointermove listener only
      // attaches after the next render, and the zone math needs a sane Y
      // from the very first drag-over.
      const activator = event.activatorEvent;
      if (activator instanceof MouseEvent) {
        pointerXRef.current = activator.clientX;
        pointerYRef.current = activator.clientY;
      } else if (
        typeof TouchEvent !== "undefined" &&
        activator instanceof TouchEvent &&
        activator.touches[0]
      ) {
        pointerXRef.current = activator.touches[0].clientX;
        pointerYRef.current = activator.touches[0].clientY;
      }
      setActiveId(event.active.id as string);
      setIndicator(null);
    },
    [setIndicator],
  );

  // One projection for both events: onDragOver fires when the over-row
  // changes, onDragMove as the pointer moves WITHIN a row (the
  // before/nest/after zone depends on the in-row Y position).
  const projectIndicator = useCallback(
    (event: DragOverEvent | DragMoveEvent) => {
      setIndicator(
        computeIndicator(
          event.active.id as string,
          (event.over?.id as string | undefined) ?? null,
        ),
      );
    },
    [computeIndicator, setIndicator],
  );
  const handleDragOver = projectIndicator;
  const handleDragMove = projectIndicator;

  const executeMove = useCallback(
    (task: WorkItem, parentId: string | null, visualIndex: number) => {
      const siblings = treeIndex.childrenByParent.get(parentId) ?? [];
      const lanePosition = lanePositionForVisualIndex(
        siblings,
        visualIndex,
        task.state.id,
        task.id,
      );

      // Skip no-op drops (row dropped back where it already sits).
      const currentParent = task.parent_id ?? null;
      if (currentParent === parentId) {
        const laneMates = siblings
          .filter((s) => s.state.id === task.state.id)
          .sort(compareSiblings);
        if (laneMates.findIndex((s) => s.id === task.id) === lanePosition) {
          return;
        }
      }

      void moveTask(task.id, {
        position: lanePosition,
        ...(currentParent !== parentId && { parent_id: parentId }),
      });
    },
    [treeIndex, moveTask],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      document.body.classList.remove("is-dragging");
      const indicator = indicatorRef.current;
      setActiveId(null);
      setIndicator(null);

      if (!indicator) return;
      const task = treeIndex.byId.get(event.active.id as string);
      if (!task) return;

      executeMove(task, indicator.parentId, indicator.visualIndex);
    },
    [treeIndex, executeMove, setIndicator],
  );

  const handleDragCancel = useCallback(() => {
    document.body.classList.remove("is-dragging");
    setActiveId(null);
    setIndicator(null);
  }, [setIndicator]);

  // Pop the row out one level: it lands directly below its former parent,
  // as the parent's next sibling.
  const handleUnnest = useCallback(
    async (work_item_id: string) => {
      const task = treeIndex.byId.get(work_item_id);
      const parentId = treeIndex.effectiveParentOf.get(work_item_id);
      if (!task || !parentId) return;
      const grandparentId = treeIndex.effectiveParentOf.get(parentId) ?? null;
      const parentSiblings = treeIndex.childrenByParent.get(grandparentId) ?? [];
      const parentIdx = parentSiblings.findIndex((s) => s.id === parentId);
      const visualIndex = parentIdx === -1 ? parentSiblings.length : parentIdx + 1;
      const lanePosition = lanePositionForVisualIndex(
        parentSiblings,
        visualIndex,
        task.state.id,
        task.id,
      );
      await moveTask(work_item_id, {
        parent_id: grandparentId,
        position: lanePosition,
      });
    },
    [treeIndex, moveTask],
  );

  return {
    activeId,
    nestTargetId: dropIndicator?.kind === "nest" ? dropIndicator.overId : null,
    dropIndicator,
    flatItems,
    sortableIds,
    localTasks: tasks,
    activeItem,
    activeChildCount,
    treeIndex,
    sensors,
    collisionDetection,
    measuring,
    handleDragStart,
    handleDragOver,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
    handleUnnest,
  };
}
