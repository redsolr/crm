/**
 * Attribute-value projection helpers — SOLID/DRY pass 2026-07-18.
 *
 * The "definition_id → key, then pick values by key" dance was
 * quadruplicated (account/contact/opportunity snapshot hooks + the
 * record-timeline merge). One implementation now.
 */

import type { AttributeDefinition } from "@/lib/generated/api/models";

/** `definition_id → key` lookup. */
export type DefKeyIndex = Record<string, string>;

export function defKeyIndex(
  definitions: ReadonlyArray<Pick<AttributeDefinition, "id" | "key">>,
): DefKeyIndex {
  const index: DefKeyIndex = {};
  for (const d of definitions) index[d.id] = d.key;
  return index;
}

interface ValueRowLike {
  definition_id: string;
  value: unknown;
}

/** Raw values keyed by attribute KEY (unknown definitions dropped). */
export function rawValuesByKey(
  values: ReadonlyArray<ValueRowLike>,
  index: DefKeyIndex,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const v of values) {
    const key = index[v.definition_id];
    if (key !== undefined) out[key] = v.value;
  }
  return out;
}

/** Non-empty STRING values keyed by attribute KEY — the common case for
 *  select/text/date/url display projections. */
export function stringValuesByKey(
  values: ReadonlyArray<ValueRowLike>,
  index: DefKeyIndex,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of values) {
    const key = index[v.definition_id];
    if (key !== undefined && typeof v.value === "string" && v.value !== "") {
      out[key] = v.value;
    }
  }
  return out;
}
