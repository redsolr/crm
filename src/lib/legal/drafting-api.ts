"use client";

/**
 * `legalDraftingApi` — the PLATFORM legal drafting surface
 * (`POST /v1/legal/matters/:id/draft`). Synthesizes a memo GROUNDED in the
 * matter's findings and creates it as a page in the matter. The trust posture
 * matches `search_legal_corpus` / findings: with no findings the backend
 * abstains (`drafted: false` + a "research first" message) rather than
 * inventing authority, and a draft that cites authority outside the findings is
 * rejected server-side. Workspace context is sent as `Jurisimus-Workspace-Id`.
 *
 * Platform module: `platform/src/modules/legal/` (`LegalDraftingService`).
 */
import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";

// The memo page — only the fields the matter UI needs to open it in the editor;
// zod strips the rest of the page projection.
const DraftPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  matter_id: z.string().nullable(),
});

const DraftResultSchema = z.object({
  drafted: z.boolean(),
  page: DraftPageSchema.nullable(),
  citations: z.array(z.string()),
  message: z.string(),
});
export type DraftMemoResult = z.infer<typeof DraftResultSchema>;

export interface DraftMemoPayload {
  /** What to draft. Omit for a matter-wide summary of all findings. */
  instruction?: string;
  /** Optional memo title; derived from the instruction when omitted. */
  title?: string;
}

class LegalDraftingApiClient extends BaseApiClient {
  /** Draft a grounded memo on a matter (prefixed `wi_…`). */
  async draftMemo(
    matterId: string,
    payload: DraftMemoPayload,
    workspaceId: string,
  ): Promise<DraftMemoResult> {
    const res = await this.request<unknown>(
      `/legal/matters/${encodeURIComponent(matterId)}/draft`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return DraftResultSchema.parse(res);
  }
}

export const legalDraftingApi = new LegalDraftingApiClient();
