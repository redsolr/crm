/**
 * Format a date as a human-readable relative time string.
 *
 * Two styles, gated by `opts.compact`:
 *
 *   - Verbose (default, used by chat/inbox): "Just now",
 *     "5 minutes ago", "2 days ago", "3 months ago".
 *   - Compact (used by FeatureBase comments + similar dense lists):
 *     "just now", "5m ago", "2d ago", and a localized date for
 *     anything older than 30 days.
 *
 * Accepts either a `Date` or an ISO-8601 string so wire payloads
 * (which arrive as strings from the API) don't need a `new Date(...)`
 * wrap at every call site. Negative diffs (future timestamps from
 * clock skew) clamp to 0 rather than falling into the "just now"
 * branch off-by-accident.
 */
export function formatRelativeTime(
  input: Date | string,
  opts: { compact?: boolean } = {},
): string {
  const date = input instanceof Date ? input : new Date(input);
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (opts.compact) {
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
