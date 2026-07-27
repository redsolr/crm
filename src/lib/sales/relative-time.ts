/**
 * Compact relative-time formatting for CRM record lists ("2h ago",
 * "3d ago") — the last-activity signal that makes a pipeline read as
 * alive (Attio's sort-by-last-interaction, on our own activity data).
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const delta = Date.now() - then;
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 30 * DAY) return `${Math.floor(delta / DAY)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Latest ISO timestamp across a record and its related items. */
export function latestActivity(
  own: string | null | undefined,
  related: ReadonlyArray<{ updated_at?: string | null }>,
): string | null {
  let latest = own ?? null;
  for (const r of related) {
    const u = r.updated_at ?? null;
    if (u && (!latest || u > latest)) latest = u;
  }
  return latest;
}
