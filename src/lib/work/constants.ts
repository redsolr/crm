/**
 * Work module constants — internal org-management v1 (2026-08-06).
 *
 * The Work area is the CRM substrate pointed at internal delivery
 * work: one `task` record type in the same single-tenant universe.
 * Jira's "space" concept maps to the `project` select attribute —
 * each project option is a space in the sidebar, and a board is the
 * task set filtered to one project. Deliberately NOT a workspace:
 * ops work wants cross-project slices ("everything due this week"),
 * which an isolation boundary would make impossible.
 *
 * Internal-only: this surface never ships to demos or customer
 * seats — see the guard note in CrmSidebar's Work section.
 */

/** Work-item-type keys owned by the work module. */
export const WORK_TYPE_KEYS = {
  task: "task",
} as const;

/** Task workflow state keys (mirrors scripts/db-seed.ts `task`). */
export const TASK_STATE_KEYS = {
  todo: "todo",
  in_progress: "in_progress",
  in_review: "in_review",
  done: "done",
  canceled: "canceled",
} as const;

/** Board column order. Canceled is hidden unless "show canceled". */
export const TASK_STATE_ORDER: string[] = [
  TASK_STATE_KEYS.todo,
  TASK_STATE_KEYS.in_progress,
  TASK_STATE_KEYS.in_review,
  TASK_STATE_KEYS.done,
  TASK_STATE_KEYS.canceled,
];

/** Column/state display names (seeded names — labelize can't produce
 *  "To Do" from "todo", so the map is explicit). */
export const TASK_STATE_LABELS: Record<string, string> = {
  [TASK_STATE_KEYS.todo]: "To Do",
  [TASK_STATE_KEYS.in_progress]: "In Progress",
  [TASK_STATE_KEYS.in_review]: "In Review",
  [TASK_STATE_KEYS.done]: "Done",
  [TASK_STATE_KEYS.canceled]: "Canceled",
};

/** Project options = the Jira-style spaces. Wire-stable keys; the
 *  label comes from labelizeOptionKey. Retune in db-seed.ts and here
 *  together (same discipline as the sales option lists). */
export const TASK_PROJECT_OPTIONS = [
  "jurisimus",
  "crm",
  "class_room",
  "hq",
  "other",
] as const;
export type TaskProject = (typeof TASK_PROJECT_OPTIONS)[number];

export const TASK_PRIORITY_OPTIONS = [
  "urgent",
  "high",
  "medium",
  "low",
] as const;
export type TaskPriority = (typeof TASK_PRIORITY_OPTIONS)[number];

export const TASK_ASSIGNEE_OPTIONS = ["founder", "claude"] as const;

/** `class_room` → `Class Room` — display labels for option keys. */
export function labelizeOptionKey(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
