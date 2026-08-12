/**
 * Escape LIKE/ILIKE wildcards so user-typed text matches literally —
 * shared by every module that builds `%…%` patterns (ask-tools record
 * search, memory matching).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
