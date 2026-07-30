"use client";

/**
 * `legalRedlineApi` — propose a GROUNDED revision of one clause from a matter
 * document (`POST /api/legal/matters/:id/suggest_revision`). The "edit docs"
 * pillar, completing cite-check: cite-check flags a clause; this proposes the
 * rewrite, grounded in a real CCC section or abstaining. Suggestion only — the
 * document is never modified. Workspace context as `Jurisimus-Workspace-Id`.
 *
 * Platform module: `platform/src/modules/legal/` (`LegalRedlineService`).
 */
import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";

/**
 * What a revision is grounded in — a discriminated union mirroring the backend:
 * `kind: 'section'` carries the corpus § it rests on; `kind: 'playbook_rule'`
 * carries the firm-standard rule it rewrites toward. Fields are per-branch, so
 * each is optional and read by `kind`.
 */
const RevisionGroundingSchema = z.object({
  kind: z.enum(["section", "playbook_rule"]).optional(),
  // kind === 'section'
  section_no: z.string().optional(),
  citation: z.string().optional(),
  preview_th: z.string().optional(),
  // kind === 'playbook_rule'
  rule_id: z.string().optional(),
  rule_title: z.string().optional(),
});

const SuggestRevisionResultSchema = z.object({
  suggested: z.boolean(),
  original: z.string(),
  revision: z.string().nullable(),
  grounding: RevisionGroundingSchema.nullable(),
  message: z.string(),
});
export type SuggestRevisionResult = z.infer<typeof SuggestRevisionResultSchema>;

const ApplyRevisionResultSchema = z.object({
  applied: z.boolean(),
  page: z.object({ content: z.string() }).passthrough(),
});
export type ApplyRevisionResult = z.infer<typeof ApplyRevisionResultSchema>;

class LegalRedlineApiClient extends BaseApiClient {
  /**
   * Propose a grounded revision of `clause` (which must be verbatim in the
   * document `pageId`). Grounding precedence: `playbookRuleId` (rewrite toward
   * the firm's standard) → `targetSection` (a specific CCC §) → corpus search.
   */
  async suggestRevision(
    matterId: string,
    pageId: string,
    clause: string,
    workspaceId: string,
    targetSection?: string,
    playbookRuleId?: string,
  ): Promise<SuggestRevisionResult> {
    const res = await this.request<unknown>(
      `/legal/matters/${encodeURIComponent(matterId)}/suggest_revision`,
      {
        method: "POST",
        body: JSON.stringify({
          page_id: pageId,
          clause,
          target_section: targetSection,
          playbook_rule_id: playbookRuleId,
        }),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return SuggestRevisionResultSchema.parse(res);
  }

  /**
   * Accept a proposed revision — write `revision` over the (verbatim) `original`
   * clause in the document. Returns the updated page.
   */
  async applyRevision(
    matterId: string,
    pageId: string,
    original: string,
    revision: string,
    workspaceId: string,
  ): Promise<ApplyRevisionResult> {
    const res = await this.request<unknown>(
      `/legal/matters/${encodeURIComponent(matterId)}/apply_revision`,
      {
        method: "POST",
        body: JSON.stringify({
          page_id: pageId,
          original,
          revision,
        }),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return ApplyRevisionResultSchema.parse(res);
  }
}

export const legalRedlineApi = new LegalRedlineApiClient();
