/**
 * Cache helpers for resolving the current `version` of a WorkItem so
 * mutations can round-trip `If-Match: W/"v<n>"` per
 * `docs/platform/api-discipline.md` § C4.
 *
 * The version is the optimistic-concurrency token the platform requires
 * on every PATCH/DELETE against `/v1/work-items/:id`. A missing or stale
 * `If-Match` header is rejected (428 / 412), so before mutating we look
 * the WorkItem up in the react-query cache and pull `.version` off it.
 *
 * Covers all four shapes WorkItems live in client-side:
 *   - `workItems.list(...)` — flat `{ data: WorkItem[], total }`
 *   - folder board view  — `{ folder, columns: { [status]: WorkItem[] } }`
 *   - folder backlog view — `{ folder, tasks: WorkItem[] }`
 *   - folder calendar view — `{ folder, tasks_by_date: { [date]: WorkItem[] } }`
 *
 * If a future view introduces another shape, extend `findInFolderView`.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { WorkItem } from "@/lib/workItemsApi";
import { queryKeys } from "./query-keys";

export function findCachedWorkItemVersion(
  qc: QueryClient,
  id: string,
): number | null {
  const lists = qc.getQueriesData<unknown>({
    queryKey: queryKeys.workItems.all,
  });
  for (const [, data] of lists) {
    const found = findInWorkItemsCache(data, id);
    if (found !== null) return found.version;
  }

  const folderViews = qc.getQueriesData({
    queryKey: queryKeys.folderViews.all,
  });
  for (const [, data] of folderViews) {
    const found = findInFolderView(data, id);
    if (found) return found.version;
  }

  return null;
}

/**
 * The `workItems.*` query keys store WorkItems in one of four shapes:
 *   - bare array `WorkItem[]` (project-backlog / sprint views call
 *     `response.data.sort(...)` and store the result)
 *   - cursor envelope `{ data, has_more, next_page_url }` (raw
 *     `listWorkItems` consumers)
 *   - legacy `{ data, total }` envelope (kept for back-compat in case
 *     any older query still stores it)
 *   - board-grouped object `{ [stateKey: string]: WorkItem[] }` —
 *     `use-board-query` groups by `state.key`. Required so
 *     delete / move mutations can resolve the row's `version` for the
 *     If-Match round-trip; without this branch the mutation throws
 *     "no cached version available" and the optimistic update is
 *     reverted before the network call fires.
 * Probe in that order — first match wins.
 */
function findInWorkItemsCache(data: unknown, id: string): WorkItem | null {
  if (Array.isArray(data)) {
    return (data as WorkItem[]).find((w) => w.id === id) ?? null;
  }
  if (data !== null && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const arr = obj.data;
    if (Array.isArray(arr)) {
      return (arr as WorkItem[]).find((w) => w.id === id) ?? null;
    }
    // Board-grouped shape: every value is a WorkItem[]. Walk every
    // column. We accept the shape if at least one value is an array
    // of objects with an `id` field, so we don't false-positive on
    // unrelated record shapes.
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        const found = (value as WorkItem[]).find((w) => w?.id === id);
        if (found) return found;
      }
    }
  }
  return null;
}

/**
 * Throwing variant for use inside mutation `mutationFn` — react-query
 * routes the error through `onError`, which reverts the optimistic
 * update. The thrown message names the resource so the caller can
 * recover by refetching before retrying.
 */
export function requireCachedWorkItemVersion(
  qc: QueryClient,
  id: string,
): number {
  const version = findCachedWorkItemVersion(qc, id);
  if (version === null) {
    throw new Error(
      `work-item ${id}: no cached version available — refetch before mutating ` +
        `to round-trip If-Match (docs/platform/api-discipline.md § C4)`,
    );
  }
  return version;
}

/**
 * Delete-mutation version-capture buffer for view query hooks.
 *
 * Problem: react-query's `useMutation` runs `onMutate` BEFORE
 * `mutationFn`. A delete-mutation's `onMutate` typically filters the
 * row out of the cache for the optimistic UI — by the time
 * `mutationFn` runs, the row is gone and `findCachedWorkItemVersion`
 * returns null → "no cached version available".
 *
 * Solution: `onMutate` captures the version BEFORE the optimistic
 * filter via `captureDeleteVersion`; `mutationFn` reads it via
 * `consumeDeleteVersion`. The consume call deletes the entry so
 * subsequent reads (e.g. accidental double-consume) fail loudly
 * via the requireCachedWorkItemVersion fallback.
 *
 * Module-scoped Map is correct here — react-query's mutation
 * lifecycle is single-threaded per-mutation, and the id is the
 * disambiguator across concurrent deletes (bulk delete fans out to N
 * parallel mutateAsync calls, each with its own id).
 */
const capturedDeleteVersions = new Map<string, number>();

export function captureDeleteVersion(
  qc: QueryClient,
  id: string,
): number | null {
  const version = findCachedWorkItemVersion(qc, id);
  if (version != null) capturedDeleteVersions.set(id, version);
  return version;
}

/**
 * Consume the captured version for `id`. Returns null when nothing
 * was captured — the mutationFn should then fall back to a fresh
 * `requireCachedWorkItemVersion` lookup (which will throw if the row
 * is genuinely gone — that's the desired loud failure).
 */
export function consumeDeleteVersion(id: string): number | null {
  const v = capturedDeleteVersions.get(id);
  if (v != null) capturedDeleteVersions.delete(id);
  return v ?? null;
}

/**
 * Cleanup hook for `onSettled` / `onError` — clears any leftover
 * capture for `id` if `mutationFn` didn't consume it (e.g. the
 * network call threw before reading).
 */
export function discardDeleteVersion(id: string): void {
  capturedDeleteVersions.delete(id);
}

function findInFolderView(data: unknown, id: string): WorkItem | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.tasks)) {
    const found = (obj.tasks as WorkItem[]).find((t) => t.id === id);
    if (found) return found;
  }

  if (obj.columns && typeof obj.columns === "object") {
    for (const arr of Object.values(
      obj.columns as Record<string, WorkItem[]>,
    )) {
      if (Array.isArray(arr)) {
        const found = arr.find((t) => t.id === id);
        if (found) return found;
      }
    }
  }

  if (obj.tasks_by_date && typeof obj.tasks_by_date === "object") {
    for (const arr of Object.values(
      obj.tasks_by_date as Record<string, WorkItem[]>,
    )) {
      if (Array.isArray(arr)) {
        const found = arr.find((t) => t.id === id);
        if (found) return found;
      }
    }
  }

  return null;
}
