/**
 * Persisted order for the Pipeline layout tabs (Summary / Table /
 * Board) — drag-to-rearrange like Jira's project tab strip (founder
 * 2026-08-04). Pure helpers kept React-free for unit testing; the
 * external-store wiring lives in `SalesPipelineView`.
 */

export const PIPELINE_TAB_IDS = ["summary", "table", "kanban"] as const;
export type PipelineTabId = (typeof PIPELINE_TAB_IDS)[number];

export const PIPELINE_TAB_ORDER_STORAGE_KEY = "crm-pipeline-tab-order";

/** The default (and server-render) order. */
export const DEFAULT_TAB_ORDER: readonly PipelineTabId[] = PIPELINE_TAB_IDS;

/**
 * Parse a stored order defensively: only a FULL permutation of the tab
 * ids is trusted (a stale value from an older tab set, junk, or a
 * partial array falls back to the default — a lost tab would be an
 * unrecoverable UI hole).
 */
export function sanitizeTabOrder(raw: unknown): PipelineTabId[] {
  if (!Array.isArray(raw)) return [...PIPELINE_TAB_IDS];
  const known = raw.filter((t): t is PipelineTabId =>
    (PIPELINE_TAB_IDS as readonly string[]).includes(t as string),
  );
  const unique = new Set(known);
  if (
    raw.length !== PIPELINE_TAB_IDS.length ||
    known.length !== raw.length ||
    unique.size !== PIPELINE_TAB_IDS.length
  ) {
    return [...PIPELINE_TAB_IDS];
  }
  return known;
}
