import {
  buildFlatTree,
  buildTreeIndex,
  compareSiblings,
  getDescendantIds,
  getDescendantIdsForRoots,
  lanePositionForVisualIndex,
  applyMoveLocally,
} from "../task-tree";
import type { WorkItem } from "../workItemsApi";

/**
 * These tests assert the ordering PROMISE of the backlog list:
 * - the tree renders siblings in the server's order (position, created_at, id)
 * - a drop expressed as "insert at this visual spot" lands exactly there
 * - the optimistic local move produces the same order the server's lane
 *   renumber produces after a refetch (no snap-back)
 *
 * `position` lanes are (parent_id, workflow state) — mirroring
 * platform/src/modules/work-items/internal/work-items-write.service.ts.
 */

interface TaskSeed {
  id: string;
  parent_id?: string | null;
  position?: number;
  created_at?: string;
  state_id?: string;
}

function task(seed: TaskSeed): WorkItem {
  return {
    id: seed.id,
    title: `Task ${seed.id}`,
    identifier: seed.id.toUpperCase(),
    parent_id: seed.parent_id ?? null,
    position: seed.position ?? 0,
    created_at: seed.created_at ?? "2026-01-01T00:00:00.000Z",
    state: { id: seed.state_id ?? "st_backlog", key: "backlog" },
  } as unknown as WorkItem;
}

const flatIds = (tasks: WorkItem[]) =>
  buildFlatTree(tasks).map((i) => i.task.id);

describe("compareSiblings", () => {
  it("orders by position, then created_at, then id (server ORDER BY)", () => {
    const a = task({ id: "a", position: 1 });
    const b = task({ id: "b", position: 0 });
    const c = task({ id: "c", position: 1, created_at: "2025-01-01T00:00:00.000Z" });
    const d = task({ id: "d", position: 1 });

    expect([a, b, c, d].sort(compareSiblings).map((t) => t.id)).toEqual([
      "b", // lowest position
      "c", // position 1, earliest created_at
      "a", // position 1, same created_at as d, lower id
      "d",
    ]);
  });
});

describe("buildFlatTree", () => {
  it("renders roots in order with children nested under their parent", () => {
    const tasks = [
      task({ id: "child2", parent_id: "root1", position: 1 }),
      task({ id: "root2", position: 1 }),
      task({ id: "child1", parent_id: "root1", position: 0 }),
      task({ id: "root1", position: 0 }),
    ];
    const flat = buildFlatTree(tasks);
    expect(flat.map((i) => i.task.id)).toEqual([
      "root1",
      "child1",
      "child2",
      "root2",
    ]);
    expect(flat.map((i) => i.depth)).toEqual([0, 1, 1, 0]);
    expect(flat.find((i) => i.task.id === "root1")?.hasChildren).toBe(true);
    expect(flat.find((i) => i.task.id === "root2")?.hasChildren).toBe(false);
  });

  it("renders orphans (parent not in the list) at root instead of dropping them", () => {
    const tasks = [
      task({ id: "root1", position: 0 }),
      task({ id: "orphan", parent_id: "missing", position: 5 }),
    ];
    const flat = buildFlatTree(tasks);
    expect(flat.map((i) => i.task.id)).toEqual(["root1", "orphan"]);
    expect(flat[1].depth).toBe(0);
    expect(flat[1].parentId).toBeNull();
  });
});

describe("getDescendantIds", () => {
  it("collects the whole subtree, not just direct children", () => {
    const tasks = [
      task({ id: "a" }),
      task({ id: "b", parent_id: "a" }),
      task({ id: "c", parent_id: "b" }),
      task({ id: "d", parent_id: "c" }),
      task({ id: "e" }),
    ];
    expect([...getDescendantIds("a", tasks)].sort()).toEqual(["b", "c", "d"]);
    expect(getDescendantIds("e", tasks).size).toBe(0);
  });
});

describe("getDescendantIdsForRoots", () => {
  it("unions every root's subtree; unknown roots contribute nothing", () => {
    const tasks = [
      task({ id: "a" }),
      task({ id: "b", parent_id: "a" }),
      task({ id: "c", parent_id: "b" }),
      task({ id: "x" }),
      task({ id: "y", parent_id: "x" }),
      task({ id: "e" }),
    ];
    expect([...getDescendantIdsForRoots(["a", "x"], tasks)].sort()).toEqual([
      "b",
      "c",
      "y",
    ]);
    expect(getDescendantIdsForRoots(["e", "missing"], tasks).size).toBe(0);
    expect(getDescendantIdsForRoots([], tasks).size).toBe(0);
  });

  it("matches the single-root helper for one root", () => {
    const tasks = [
      task({ id: "a" }),
      task({ id: "b", parent_id: "a" }),
      task({ id: "c", parent_id: "b" }),
    ];
    expect(getDescendantIdsForRoots(["a"], tasks)).toEqual(
      getDescendantIds("a", tasks),
    );
  });
});

describe("lanePositionForVisualIndex", () => {
  it("counts only lane-mates (same state) before the insertion point, excluding the moving row", () => {
    const siblings = [
      task({ id: "a", position: 0, state_id: "st_backlog" }),
      task({ id: "b", position: 0, state_id: "st_todo" }),
      task({ id: "moving", position: 1, state_id: "st_backlog" }),
      task({ id: "c", position: 2, state_id: "st_backlog" }),
    ];
    // Insert at visual index 3 (before "c"): backlog-lane rows above are
    // "a" (counted) and "moving" (excluded) — lane position 1.
    expect(
      lanePositionForVisualIndex(siblings, 3, "st_backlog", "moving"),
    ).toBe(1);
    // Out-of-range indices clamp.
    expect(
      lanePositionForVisualIndex(siblings, 99, "st_backlog", "moving"),
    ).toBe(2);
    expect(
      lanePositionForVisualIndex(siblings, -1, "st_backlog", "moving"),
    ).toBe(0);
  });
});

describe("applyMoveLocally — mirrors the server lane renumber", () => {
  it("reorders within the same parent: dropped row lands exactly at the requested index", () => {
    const tasks = ["a", "b", "c", "d", "e"].map((id, i) =>
      task({ id, position: i }),
    );
    // Move "e" to index 1 (between "a" and "b").
    expect(flatIds(applyMoveLocally(tasks, "e", { position: 1 }))).toEqual([
      "a",
      "e",
      "b",
      "c",
      "d",
    ]);
    // Move "a" to the end.
    expect(flatIds(applyMoveLocally(tasks, "a", { position: 4 }))).toEqual([
      "b",
      "c",
      "d",
      "e",
      "a",
    ]);
  });

  it("renumbers the destination lane contiguously (0..n), like the server", () => {
    const tasks = [
      task({ id: "a", position: 3 }),
      task({ id: "b", position: 7 }),
      task({ id: "c", position: 9 }),
    ];
    const moved = applyMoveLocally(tasks, "c", { position: 0 });
    const byId = new Map(moved.map((t) => [t.id, t.position]));
    expect(byId.get("c")).toBe(0);
    expect(byId.get("a")).toBe(1);
    expect(byId.get("b")).toBe(2);
  });

  it("reparents: row moves under the new parent with its subtree intact", () => {
    const tasks = [
      task({ id: "p1", position: 0 }),
      task({ id: "p2", position: 1 }),
      task({ id: "x", position: 2 }),
      task({ id: "x1", parent_id: "x", position: 0 }),
    ];
    // Nest "x" (and implicitly its child) under "p1".
    const moved = applyMoveLocally(tasks, "x", {
      parent_id: "p1",
      position: 0,
    });
    expect(flatIds(moved)).toEqual(["p1", "x", "x1", "p2"]);
    const flat = buildFlatTree(moved);
    expect(flat.find((i) => i.task.id === "x")?.depth).toBe(1);
    expect(flat.find((i) => i.task.id === "x1")?.depth).toBe(2);
  });

  it("only touches the destination lane — other states keep their positions", () => {
    const tasks = [
      task({ id: "a", position: 0, state_id: "st_backlog" }),
      task({ id: "b", position: 0, state_id: "st_todo" }),
      task({ id: "c", position: 1, state_id: "st_backlog" }),
    ];
    const moved = applyMoveLocally(tasks, "c", { position: 0 });
    expect(moved.find((t) => t.id === "b")?.position).toBe(0);
  });

  it("does not mutate the input array or its rows", () => {
    const tasks = ["a", "b"].map((id, i) => task({ id, position: i }));
    const snapshot = JSON.parse(JSON.stringify(tasks)) as unknown;
    applyMoveLocally(tasks, "b", { position: 0 });
    expect(JSON.parse(JSON.stringify(tasks))).toEqual(snapshot);
  });
});

describe("drop promise — the row lands exactly where the indicator points", () => {
  // Simulates the full pipeline the DnD hook runs on drop:
  // visual insert index → lane position → optimistic move → rendered order.
  function dropBefore(tasks: WorkItem[], activeId: string, beforeId: string) {
    const index = buildTreeIndex(tasks);
    const active = index.byId.get(activeId)!;
    const beforeFlat = index.flat.find((i) => i.task.id === beforeId)!;
    const siblings = index.childrenByParent.get(beforeFlat.parentId) ?? [];
    const visualIndex = siblings.findIndex((s) => s.id === beforeId);
    const lanePosition = lanePositionForVisualIndex(
      siblings,
      visualIndex,
      active.state.id,
      active.id,
    );
    return applyMoveLocally(tasks, activeId, {
      parent_id: beforeFlat.parentId,
      position: lanePosition,
    });
  }

  it("drag a root above another root — including across a nested subtree", () => {
    const tasks = [
      task({ id: "a", position: 0 }),
      task({ id: "a1", parent_id: "a", position: 0 }),
      task({ id: "a2", parent_id: "a", position: 1 }),
      task({ id: "b", position: 1 }),
      task({ id: "c", position: 2 }),
    ];
    // Visual list: a, a1, a2, b, c. Drag "c" to just above "b".
    // The old flat-index bug: visual index of "b" is 3, but "b" is the
    // SECOND root — sending 3 as position landed "c" at the end instead.
    expect(flatIds(dropBefore(tasks, "c", "b"))).toEqual([
      "a",
      "a1",
      "a2",
      "c",
      "b",
    ]);
  });

  it("drag a parent: its children travel with it", () => {
    const tasks = [
      task({ id: "a", position: 0 }),
      task({ id: "a1", parent_id: "a", position: 0 }),
      task({ id: "b", position: 1 }),
      task({ id: "c", position: 2 }),
    ];
    expect(flatIds(dropBefore(tasks, "a", "c"))).toEqual([
      "b",
      "a",
      "a1",
      "c",
    ]);
  });

  it("drag a child between children of another parent", () => {
    const tasks = [
      task({ id: "a", position: 0 }),
      task({ id: "a1", parent_id: "a", position: 0 }),
      task({ id: "b", position: 1 }),
      task({ id: "b1", parent_id: "b", position: 0 }),
      task({ id: "b2", parent_id: "b", position: 1 }),
    ];
    expect(flatIds(dropBefore(tasks, "a1", "b2"))).toEqual([
      "a",
      "b",
      "b1",
      "a1",
      "b2",
    ]);
    const flat = buildFlatTree(dropBefore(tasks, "a1", "b2"));
    expect(flat.find((i) => i.task.id === "a1")?.parentId).toBe("b");
  });
});
