import { useCallback, useState } from "react";

/**
 * Persistent collapsed-subtree state for the backlog tree list.
 *
 * localStorage, keyed per workspace — deliberately NOT the backend
 * `user_preferences.ui_layout` rail: collapsed IDs are workspace-scoped
 * view state that references data rows (stale after deletes) and churns
 * on every chevron click, unlike the small, stable layout preferences
 * stored there. Per-device stickiness is the expected behavior (Linear
 * does the same); if cross-device sync is ever asked for, this upgrades
 * onto the existing preference rail without redesign.
 *
 * Stale IDs (collapsed tasks later deleted) are harmless — they simply
 * never match a row — and bounded by how many parents a user has ever
 * collapsed in the workspace.
 */

const storageKeyFor = (workspaceId: string) =>
  `backlog-collapsed-v1:${workspaceId}`;

function readCollapsed(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw == null || raw === "") return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id): id is string => typeof id === "string"));
    }
  } catch (err) {
    console.warn("[backlog-collapse] localStorage read failed", err);
  }
  return new Set();
}

function writeCollapsed(storageKey: string, ids: ReadonlySet<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...ids]));
  } catch (err) {
    console.warn("[backlog-collapse] localStorage write failed", err);
  }
}

interface UseCollapsedWorkItemsReturn {
  collapsedIds: ReadonlySet<string>;
  toggle: (work_item_id: string) => void;
  /** Expand (no-op when already expanded) — e.g. after a drop nests into
   *  a collapsed parent, so the moved row is visible at its new spot. */
  expand: (work_item_id: string) => void;
}

export function useCollapsedWorkItems(
  workspaceId: string,
): UseCollapsedWorkItemsReturn {
  const storageKey = storageKeyFor(workspaceId);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
    readCollapsed(storageKey),
  );

  // Re-read when the workspace changes without a remount (render-phase
  // state adjustment — the React-documented derived-state pattern).
  const [loadedKey, setLoadedKey] = useState(storageKey);
  if (loadedKey !== storageKey) {
    setLoadedKey(storageKey);
    setCollapsedIds(readCollapsed(storageKey));
  }

  const toggle = useCallback(
    (work_item_id: string) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(work_item_id)) {
          next.delete(work_item_id);
        } else {
          next.add(work_item_id);
        }
        writeCollapsed(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const expand = useCallback(
    (work_item_id: string) => {
      setCollapsedIds((prev) => {
        if (!prev.has(work_item_id)) return prev;
        const next = new Set(prev);
        next.delete(work_item_id);
        writeCollapsed(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  return { collapsedIds, toggle, expand };
}
