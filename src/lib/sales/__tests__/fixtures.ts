/**
 * Shared unit-test fixture for sales work items.
 *
 * `makeWorkItem` returns the full WorkItem wire shape with neutral
 * defaults; each test file layers its own type/state/date defaults in a
 * thin wrapper (see followup-ranking.test.ts / record-timeline.test.ts).
 *
 * NOTE: this file is listed in jest.config.js `testPathIgnorePatterns`
 * so the default `__tests__` glob doesn't collect it as an empty suite.
 */

import type { WorkItem } from "@/lib/workItemsApi";

export function makeWorkItem(
  id: string,
  overrides: Partial<WorkItem> = {},
): WorkItem {
  return {
    id,
    identifier: `SAL-${id}`,
    title: `Item ${id}`,
    subject: null,
    description: null,
    workspace_id: "ws-1",
    folder_id: null,
    state: {
      id: "st-1",
      key: "active",
      name: "Active",
      category: "active",
    },
    type: { id: "wit-item", key: "item", name: "Item" },
    priority: "none",
    position: 0,
    iteration_id: null,
    parent_id: null,
    assignee_id: null,
    assignee_name: null,
    dri_id: null,
    dri_name: null,
    created_by_id: "u-1",
    created_by_name: null,
    due_date: null,
    estimate: null,
    visibility: "internal",
    vote_count: 0,
    version: 1,
    shipped_at: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    completed_at: null,
    ...overrides,
  } as WorkItem;
}
