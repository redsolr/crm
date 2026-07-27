/**
 * Identity presentation helpers — ONE home for the deterministic
 * hue-from-string hash and initials derivation used by every avatar
 * surface (team roster, org tiles, group shields, presence stack).
 * Deduplicated 2026-07-12; previously copied per-surface.
 */

/** Stable hue (0–359) from any seed string — drives avatar colors. */
export function stringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/**
 * Display initials for a person: word initials from `name` when it's a
 * real name (present and distinct from `fallback`), otherwise the first
 * character of `fallback` (typically the email).
 */
export function getInitials(name: string, fallback: string): string {
  if (name && name !== fallback) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (fallback[0] ?? name[0] ?? "?").toUpperCase();
}
