/**
 * Task attribute snapshot — folds a task's `AttributeValue[]` rows into
 * the typed shape the Work board cards and edit modal render. Pure so
 * it unit-tests without React (same discipline as report-buckets).
 */

import type {
  AttributeDefinition,
  AttributeValue,
} from "@/lib/generated/api/models";

export interface TaskSnapshot {
  project: string | null;
  priority: string | null;
  due_date: string | null;
  assignee: string | null;
}

const EMPTY_SNAPSHOT: TaskSnapshot = {
  project: null,
  priority: null,
  due_date: null,
  assignee: null,
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Map value rows (keyed by definition_id) back to attribute keys. */
export function taskSnapshot(
  values: AttributeValue[] | undefined,
  definitions: AttributeDefinition[],
): TaskSnapshot {
  if (!values || values.length === 0) return EMPTY_SNAPSHOT;
  const keyByDefinitionId = new Map(definitions.map((d) => [d.id, d.key]));
  const byKey: Record<string, unknown> = {};
  for (const row of values) {
    const key = keyByDefinitionId.get(row.definition_id);
    if (key) byKey[key] = row.value;
  }
  return {
    project: asString(byKey.project),
    priority: asString(byKey.priority),
    due_date: asString(byKey.due_date),
    assignee: asString(byKey.assignee),
  };
}

/** `2026-08-06`-style local date compare — overdue means strictly
 *  before today. Date-only strings compare lexicographically. */
export function isOverdue(dueDate: string | null, today: string): boolean {
  return dueDate !== null && dueDate < today;
}
