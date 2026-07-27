"use client";

/**
 * `legalAnalysisApi` — "which CCC sections apply to this document?"
 * (`POST /v1/legal/matters/:id/analyze_document`). Reads an ingested document
 * (a matter `page`) and returns the applicable sections, grounded + cited, or
 * `abstained: true` when none ground ("no controlling authority found"). The
 * document-driven counterpart to typed-question research. Workspace context is
 * sent as `Jurisimus-Workspace-Id`.
 *
 * Platform module: `platform/src/modules/legal/` (`LegalAnalysisService`).
 */
import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";

const ConfidenceSchema = z.object({
  band: z.string(),
  action: z.string(),
  floor_pct: z.number(),
  label: z.string(),
});

const ApplicableSectionSchema = z.object({
  code: z.literal("CCC"),
  section_no: z.string(),
  citation: z.string(),
  preview_th: z.string(),
  basis: z.string(),
  confidence: ConfidenceSchema,
  passage: z.string(),
});
export type ApplicableSection = z.infer<typeof ApplicableSectionSchema>;

const AnalyzeResultSchema = z.object({
  sections: z.array(ApplicableSectionSchema),
  abstained: z.boolean(),
  chunks_analyzed: z.number(),
  chunks_total: z.number(),
});
export type AnalyzeDocumentResult = z.infer<typeof AnalyzeResultSchema>;

class LegalAnalysisApiClient extends BaseApiClient {
  /** Analyze an ingested document (page `pg_…`) for applicable CCC sections. */
  async analyzeDocument(
    matterId: string,
    pageId: string,
    workspaceId: string,
  ): Promise<AnalyzeDocumentResult> {
    const res = await this.request<unknown>(
      `/legal/matters/${encodeURIComponent(matterId)}/analyze_document`,
      {
        method: "POST",
        body: JSON.stringify({ page_id: pageId }),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return AnalyzeResultSchema.parse(res);
  }
}

export const legalAnalysisApi = new LegalAnalysisApiClient();
