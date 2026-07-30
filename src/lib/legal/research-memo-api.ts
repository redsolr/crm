"use client";

/**
 * `legalResearchMemoApi` — the PLATFORM research-memo surface
 * (`POST /api/legal/matters/:id/research_memo`). Answers a typed legal QUESTION
 * with a memo GROUNDED in a fresh corpus research pass, created as a page in the
 * matter. The one-shot counterpart to `drafting-api` (which grounds in saved
 * findings). Trust posture matches the rest of the workbench: when research
 * surfaces no controlling authority the backend ABSTAINS (`researched: false` +
 * a "refine the question" message) rather than answering from general
 * knowledge, and a memo citing authority research didn't surface is rejected
 * server-side. Workspace context is sent as `Jurisimus-Workspace-Id`.
 *
 * Platform module: `platform/src/modules/legal/` (`LegalResearchMemoService`).
 */
import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";

const MemoPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  matter_id: z.string().nullable(),
});

/** A section research surfaced for the question (provenance). */
const ResearchedSectionSchema = z.object({
  code: z.string(),
  section_no: z.string(),
  citation: z.string(),
  preview_th: z.string(),
  confidence: z.object({ band: z.string(), floor_pct: z.number() }),
});
export type ResearchedSection = z.infer<typeof ResearchedSectionSchema>;

const ResearchMemoResultSchema = z.object({
  researched: z.boolean(),
  page: MemoPageSchema.nullable(),
  citations: z.array(z.string()),
  sections: z.array(ResearchedSectionSchema),
  message: z.string(),
});
export type ResearchMemoResult = z.infer<typeof ResearchMemoResultSchema>;

export interface ResearchMemoPayload {
  /** The legal question to research against the corpus and answer with a memo. */
  question: string;
  /** Optional memo title; derived from the question when omitted. */
  title?: string;
}

class LegalResearchMemoApiClient extends BaseApiClient {
  /** Research a question and write a grounded memo on a matter (prefixed `wi_…`). */
  async researchMemo(
    matterId: string,
    payload: ResearchMemoPayload,
    workspaceId: string,
  ): Promise<ResearchMemoResult> {
    const res = await this.request<unknown>(
      `/legal/matters/${encodeURIComponent(matterId)}/research_memo`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return ResearchMemoResultSchema.parse(res);
  }
}

export const legalResearchMemoApi = new LegalResearchMemoApiClient();
