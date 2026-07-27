/**
 * Deterministic avatar helpers — shared logic for initials + a stable color
 * pick. The palette is a caller argument (passed to `colorFromSeed`), but the
 * two canonical palettes live here so they don't drift between call sites:
 *   - BRAND  — vivid brand colors (account menu, onboarding avatar preview)
 *   - RAIL   — muted, lower-saturation (team-chat message avatars, where many
 *              show at once and vivid would be noisy)
 * Keep the math AND the canonical palettes here; pass the palette in.
 */

/** Vivid brand palette — account menu, onboarding avatar preview. */
export const BRAND_AVATAR_COLORS = [
  "#FF385C",
  "#7C3AED",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
] as const;

/** Muted palette — team-chat message avatars (many on screen at once). */
export const RAIL_AVATAR_COLORS = [
  "#4f86c6",
  "#3fa178",
  "#c95f7e",
  "#9b6fc4",
  "#c98a3a",
  "#4ca3b8",
  "#c2705a",
  "#6f8fd6",
] as const;

/** Up to two uppercase initials from a name/label; "?" when empty. */
export function getInitials(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  return (
    trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Stable index into `palette` derived from `seed` (same seed → same color). */
export function colorFromSeed(
  seed: string,
  palette: readonly string[],
): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}
