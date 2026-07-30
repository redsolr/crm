"use client";

/**
 * `legalCiteCheckApi` — verify the citations a document CONTAINS against the CCC
 * corpus (`POST /api/legal/matters/:id/check_citations`). Each citation comes
 * back `verified` (exists) or `not_found` (verify manually — never silently
 * blessed), plus grounded alternatives the corpus surfaces for the same claim
 * (the "did you mean / also relevant" signal). Workspace context as
 * `Jurisimus-Workspace-Id`.
 *
 * Platform module: `platform/src/modules/legal/` (`LegalCiteCheckService`).
 */
import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";

const SuggestionSchema = z.object({
  code: z.literal("CCC"),
  section_no: z.string(),
  citation: z.string(),
  confidence: z.object({
    band: z.string(),
    floor_pct: z.number(),
  }),
});

/**
 * Whether a VERIFIED citation actually supports the surrounding claim:
 * `on_point` (the cited § is relevant) or `review` (a REAL section that reads as
 * off-topic for this claim — the real-but-wrong-context shape existence alone
 * can't catch). Present only when the backend could compute a relevance signal
 * (cross-encoder bound + section text held); absent otherwise — never guessed.
 */
const RelevanceSchema = z.object({
  verdict: z.enum(["on_point", "review"]),
  action: z.string(),
  label: z.string(),
  floor_pct: z.number(),
});
export type CitationRelevance = z.infer<typeof RelevanceSchema>;

const CheckedCitationSchema = z.object({
  section_no: z.string(),
  citation: z.string(),
  context: z.string(),
  status: z.enum(["verified", "not_found"]),
  relevance: RelevanceSchema.optional(),
  suggestions: z.array(SuggestionSchema),
});
export type CheckedCitation = z.infer<typeof CheckedCitationSchema>;

const CiteCheckResultSchema = z.object({
  citations: z.array(CheckedCitationSchema),
  summary: z.object({
    total: z.number(),
    verified: z.number(),
    not_found: z.number(),
  }),
});
export type CiteCheckResult = z.infer<typeof CiteCheckResultSchema>;

class LegalCiteCheckApiClient extends BaseApiClient {
  /** Verify the citations in an ingested document (page `pg_…`). */
  async checkCitations(
    matterId: string,
    pageId: string,
    workspaceId: string,
  ): Promise<CiteCheckResult> {
    const res = await this.request<unknown>(
      `/legal/matters/${encodeURIComponent(matterId)}/check_citations`,
      {
        method: "POST",
        body: JSON.stringify({ page_id: pageId }),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return CiteCheckResultSchema.parse(res);
  }
}

export const legalCiteCheckApi = new LegalCiteCheckApiClient();
