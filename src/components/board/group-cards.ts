import type { BoardCardBase, BoardColumnDef } from "./board-data-source";

/**
 * Group raw status-keyed cards into the board's column ids, applying the
 * board's search + filter. This is the grouping the old `useBoardDnd` did
 * internally; it now lives in the data adapters so the board component is
 * purely presentational and every adapter produces the same `cardsByColumn`
 * shape `BoardDataSource` expects.
 *
 * `rawColumns` may be keyed by raw workflow status (project board) or already
 * by column id (matter board, where `mapStatus` is identity) — `mapStatus`
 * reconciles both.
 */
export function groupCardsByColumn<TCard extends BoardCardBase>(
  columns: BoardColumnDef[],
  rawColumns: Record<string, TCard[]>,
  mapStatus: (status: string) => string,
  opts?: { searchQuery?: string; filterFn?: (cards: TCard[]) => TCard[] },
): Record<string, TCard[]> {
  const q = opts?.searchQuery?.trim().toLowerCase();
  const result: Record<string, TCard[]> = {};
  for (const col of columns) {
    let cards = Object.entries(rawColumns)
      .filter(([status]) => mapStatus(status) === col.id)
      .flatMap(([, c]) => c)
      .filter((c) => !q || c.title.toLowerCase().includes(q));
    if (opts?.filterFn) cards = opts.filterFn(cards);
    result[col.id] = cards;
  }
  return result;
}
