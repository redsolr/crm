/**
 * Manual-rank math for the pipeline table's Jira-style list ordering —
 * drag-to-rearrange and insert-between-rows create.
 *
 * Records list by `position` (double precision, ascending; ties break
 * by created_at then id — see the server's `listWorkItems`). New
 * records get `max + POSITION_STEP`, so a healthy list carries spaced
 * ranks and a move is ONE write: the midpoint between the new
 * neighbors. Rows that predate manual ordering all carry the schema
 * default 0, so the first move on such a list can't find a strict
 * midpoint — that degenerate case renumbers the whole list back to
 * POSITION_STEP spacing (self-healing, one-time).
 */

export const POSITION_STEP = 1024;

export interface PositionedRow {
  id: string;
  position: number;
}

export interface ReorderWrite {
  id: string;
  position: number;
}

/**
 * A rank strictly between two neighbors (`null` = list edge). Returns
 * null when no strictly-between value exists (equal/unordered
 * neighbors — the caller renumbers instead).
 */
export function positionBetween(
  before: number | null,
  after: number | null,
): number | null {
  if (before === null && after === null) return POSITION_STEP;
  if (before === null && after !== null) return after - POSITION_STEP;
  if (before !== null && after === null) return before + POSITION_STEP;
  const mid = ((before as number) + (after as number)) / 2;
  return mid > (before as number) && mid < (after as number) ? mid : null;
}

/** Full-list renumber to POSITION_STEP spacing in `finalOrder`,
 *  skipping rows already at their target rank. */
export function renumberWrites(finalOrder: PositionedRow[]): ReorderWrite[] {
  return finalOrder
    .map((row, index) => ({ id: row.id, position: (index + 1) * POSITION_STEP }))
    .filter((write, index) => finalOrder[index].position !== write.position);
}

/**
 * The PATCH set that persists `movedId` sitting where it now sits in
 * `finalOrder`. Normally one midpoint write; degenerate neighbor ranks
 * fall back to renumbering the whole list.
 */
export function planReorder(
  finalOrder: PositionedRow[],
  movedId: string,
): ReorderWrite[] {
  const index = finalOrder.findIndex((row) => row.id === movedId);
  if (index === -1) return [];
  const before = index > 0 ? finalOrder[index - 1].position : null;
  const after =
    index < finalOrder.length - 1 ? finalOrder[index + 1].position : null;
  const target = positionBetween(before, after);
  if (target !== null) return [{ id: movedId, position: target }];
  return renumberWrites(finalOrder);
}
