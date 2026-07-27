import type { WorkItem } from "./workItemsApi";

/**
 * Tree model for the backlog list view.
 *
 * The platform's ordering contract (work-items-write.service.ts): `position`
 * is an index within a sibling LANE = (workspace, parent_id, workflow state).
 * A `PATCH { parent_id?, position }` renumbers the destination lane to a
 * contiguous 0..n with the moved row at the requested index, ordered by
 * `(position, created_at, id)`.
 *
 * Everything in this file mirrors that contract on the client so that
 * optimistic order === post-refetch server order (no snap-back):
 * - `compareSiblings` is the server's ORDER BY.
 * - `lanePositionForVisualIndex` translates a visual "drop between these two
 *   rows" index into the lane-relative position the server understands.
 * - `applyMoveLocally` is the client-side twin of the server renumber.
 */

export interface FlatItem {
  task: WorkItem;
  depth: number;
  /** Effective parent: `parent_id`, or null when the parent row isn't in the
   *  loaded list (orphans render at root instead of vanishing). */
  parentId: string | null;
  hasChildren: boolean;
}

export interface TreeIndex {
  flat: FlatItem[];
  byId: Map<string, WorkItem>;
  /** Ordered children per effective parent (null key = root level). */
  childrenByParent: Map<string | null, WorkItem[]>;
  effectiveParentOf: Map<string, string | null>;
}

/** Mirrors the server's sibling ordering: ORDER BY position, created_at, id. */
export function compareSiblings(a: WorkItem, b: WorkItem): number {
  if (a.position !== b.position) return a.position - b.position;
  if (a.created_at !== b.created_at)
    return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Builds the full tree index in one pass: sibling groups keyed by effective
 * parent, each sorted with the server's comparator, plus the DFS-flattened
 * row list the view renders.
 */
export function buildTreeIndex(tasks: WorkItem[]): TreeIndex {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const childrenByParent = new Map<string | null, WorkItem[]>();
  const effectiveParentOf = new Map<string, string | null>();

  for (const task of tasks) {
    // A parent_id pointing outside the loaded list must not hide the row —
    // treat it as a root ("orphan" rendering).
    const parentId =
      task.parent_id && byId.has(task.parent_id) ? task.parent_id : null;
    effectiveParentOf.set(task.id, parentId);
    const siblings = childrenByParent.get(parentId);
    if (siblings) {
      siblings.push(task);
    } else {
      childrenByParent.set(parentId, [task]);
    }
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort(compareSiblings);
  }

  const flat: FlatItem[] = [];
  const flatten = (items: WorkItem[], depth: number) => {
    for (const item of items) {
      const children = childrenByParent.get(item.id);
      flat.push({
        task: item,
        depth,
        parentId: effectiveParentOf.get(item.id) ?? null,
        hasChildren: !!children?.length,
      });
      if (children) flatten(children, depth + 1);
    }
  };
  flatten(childrenByParent.get(null) ?? [], 0);

  return { flat, byId, childrenByParent, effectiveParentOf };
}

/**
 * Converts a flat task list into a tree-ordered flat list with depth info.
 * Root tasks appear first, followed by their children (indented).
 */
export function buildFlatTree(tasks: WorkItem[]): FlatItem[] {
  return buildTreeIndex(tasks).flat;
}

/**
 * Returns a Set of all descendant task IDs for a given task.
 * Used to hide a dragged parent's subtree (it travels with the parent) and
 * to prevent circular nesting.
 */
export function getDescendantIds(
  work_item_id: string,
  tasks: WorkItem[],
): Set<string> {
  return getDescendantIdsForRoots([work_item_id], tasks);
}

/**
 * Multi-root variant of `getDescendantIds` — the union of every root's
 * descendants, with the parent→children map built once instead of per
 * root. Used to hide all collapsed subtrees in one pass.
 */
export function getDescendantIdsForRoots(
  rootIds: Iterable<string>,
  tasks: WorkItem[],
): Set<string> {
  const childIds = new Map<string, string[]>();
  for (const t of tasks) {
    if (!t.parent_id) continue;
    const list = childIds.get(t.parent_id);
    if (list) {
      list.push(t.id);
    } else {
      childIds.set(t.parent_id, [t.id]);
    }
  }
  const ids = new Set<string>();
  const stack: string[] = [];
  for (const rootId of rootIds) {
    stack.push(...(childIds.get(rootId) ?? []));
  }
  while (stack.length) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    const children = childIds.get(id);
    if (children) stack.push(...children);
  }
  return ids;
}

/**
 * Translates "insert at `visualIndex` among this parent's ordered children"
 * into the lane-relative position for `PATCH { position }`: the count of
 * lane-mates (same workflow state, excluding the moving row itself) that sit
 * before the insertion point.
 */
export function lanePositionForVisualIndex(
  orderedChildren: WorkItem[],
  visualIndex: number,
  stateId: string,
  excludeId: string,
): number {
  let lanePosition = 0;
  const end = Math.min(Math.max(visualIndex, 0), orderedChildren.length);
  for (let i = 0; i < end; i++) {
    const sibling = orderedChildren[i];
    if (sibling.id !== excludeId && sibling.state.id === stateId) {
      lanePosition++;
    }
  }
  return lanePosition;
}

export interface LocalMove {
  /** Omitted = keep the current parent. */
  parent_id?: string | null;
  /** Lane-relative index (see lanePositionForVisualIndex). */
  position: number;
}

/**
 * Client-side twin of the server renumber that runs on
 * `PATCH { parent_id?, position }`: reparent the row, then renumber its
 * destination lane (same parent_id + same state, ordered by compareSiblings)
 * to a contiguous 0..n with the moved row at the clamped requested index.
 * Rows outside the destination lane are untouched — exactly like the server.
 * Returns a new array; input is not mutated.
 */
export function applyMoveLocally(
  tasks: WorkItem[],
  id: string,
  move: LocalMove,
): WorkItem[] {
  const current = tasks.find((t) => t.id === id);
  if (!current) return tasks;

  const newParentId =
    move.parent_id === undefined ? (current.parent_id ?? null) : move.parent_id;

  const laneMates = tasks
    .filter(
      (t) =>
        t.id !== id &&
        (t.parent_id ?? null) === newParentId &&
        t.state.id === current.state.id,
    )
    .sort(compareSiblings);

  const clamped = Math.min(Math.max(move.position, 0), laneMates.length);
  const orderedIds = [
    ...laneMates.slice(0, clamped).map((t) => t.id),
    id,
    ...laneMates.slice(clamped).map((t) => t.id),
  ];
  const positionById = new Map(orderedIds.map((wid, i) => [wid, i]));

  return tasks.map((t) => {
    if (t.id === id) {
      return { ...t, parent_id: newParentId, position: positionById.get(id)! };
    }
    const pos = positionById.get(t.id);
    return pos !== undefined && pos !== t.position
      ? { ...t, position: pos }
      : t;
  });
}
