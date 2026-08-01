/**
 * Deterministic peer color from a user id — CLIENT MIRROR of the
 * worker's `colorFor` (realtime/src/index.ts). Both sides hash the
 * same id to the same palette slot, so a person renders in one hue
 * everywhere (avatar, cursor, field claim, note caret) without the
 * color ever traveling on the wire for self.
 *
 * Keep palette + hash IN SYNC with the worker copy (the worker can't
 * import app modules).
 */

export const PEER_COLORS = [
  "#6E9BFF", // blue
  "#F59E0B", // amber
  "#34D399", // green
  "#F472B6", // pink
  "#A78BFA", // violet
  "#F87171", // red
  "#22D3EE", // cyan
  "#FBBF24", // yellow
] as const;

export function peerColorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length]!;
}
