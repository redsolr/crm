/**
 * Local-date math shared by both e2e tiers. The app's due-date /
 * next-action semantics are LOCAL `YYYY-MM-DD` days (Asia/Bangkok in
 * prod, the runner's zone in tests — see `todayInAppTimeZone` on the
 * server side), so specs must never derive dates via `toISOString()`
 * (UTC off-by-one before 07:00 — the 2026-08-01 dogfood papercut #2).
 */

/** Today ± offsetDays as a local `YYYY-MM-DD` string. */
export function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
