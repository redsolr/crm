/**
 * Starlight palette — pale cool near-whites used to color graph
 * nodes and the community legend bullets. Every entry lives in a
 * tight value + chroma window so the graph reads like a star field
 * with subtle hue variation, not a flag. Community identity comes
 * from position and faint tint rather than high-contrast hue.
 *
 * References: Destiny 2 HUD palette, Mass Effect cold whites + cyan,
 * deep-space photography where stars are near-white and nebulae
 * provide the color.
 */
export const COMMUNITY_PALETTE = [
  "#94a3b8", // slate-400  — silver
  "#c4b5fd", // violet-300 — soft violet
  "#7dd3fc", // sky-300    — soft sky
  "#a5b4fc", // indigo-300 — soft indigo
  "#67e8f9", // cyan-300   — soft cyan
  "#2dd4bf", // teal-400   — blue-green (cyan with a green pull)
] as const;

/** Neutral steel for nodes that don't belong to any community. */
export const UNCLUSTERED_COLOR = "#64748b";

export type NodeOrigin = "structural" | "extracted" | "manual";

/**
 * Map a community id + origin to a palette color. Structural nodes
 * (docs / authors / canonical concepts) pop at full luminance;
 * extracted entities render slightly dimmer so the scaffold reads
 * on top of the mentions.
 */
export function themeColor(
  communityId: number | null,
  origin: NodeOrigin = "structural",
): string {
  if (communityId == null) return UNCLUSTERED_COLOR;
  const i =
    ((communityId % COMMUNITY_PALETTE.length) + COMMUNITY_PALETTE.length) %
    COMMUNITY_PALETTE.length;
  const base = COMMUNITY_PALETTE[i]!;
  return origin === "structural" ? base : darken(base, 0.25);
}

/** Pull a hex color toward black by `amount` (0..1). */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const f = Math.max(0, Math.min(1, 1 - amount));
  return toHex(Math.round(r * f), Math.round(g * f), Math.round(b * f));
}

/** Convert `#rrggbb` + alpha 0..1 to `#rrggbbaa` (Sigma's 8-char form). */
export function toAlphaHex(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const a = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
  const base = hex.startsWith("#") ? hex.slice(1, 7) : hex.slice(0, 6);
  return `#${base}${a}`;
}

/** Midpoint blend of two `#rrggbb` colors in RGB space. */
export function blendHex(a: string, b: string): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  return toHex(
    Math.round((pa[0] + pb[0]) / 2),
    Math.round((pa[1] + pb[1]) / 2),
    Math.round((pa[2] + pb[2]) / 2),
  );
}

function parseHex(hex: string): [number, number, number] {
  const s = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
