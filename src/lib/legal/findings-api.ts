"use client";

/**
 * `legalFindingsApi` — the PLATFORM legal-findings surface (`/v1/legal/findings`),
 * authenticated via `BaseApiClient` (unlike `legalApi` in ./client, which hits
 * the sandbox corpus/RAG host). This is the durable read→act bridge: persist a
 * finding, then turn it into a tracked work_item with the link recorded both
 * ways. Workspace context is sent explicitly as `Jurisimus-Workspace-Id` so the
 * finding lands in the workspace the user is actually viewing.
 *
 * Platform module: `platform/src/modules/legal/`.
 */
import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";
import { type LegalReviewFinding } from "./client";

const FindingWireSchema = z.object({
  id: z.string(),
  issue: z.string(),
  status: z.string(),
  verified: z.boolean(),
  work_item_id: z.string().nullable(),
});
const FindingEnvelopeSchema = z.object({ finding: FindingWireSchema });
const BridgeSchema = z.object({
  finding: FindingWireSchema,
  work_item_id: z.string(),
});
export type LegalFindingBridge = z.infer<typeof BridgeSchema>;

/** A finding row as returned by `GET /v1/legal/findings` (list). */
const FindingListItemSchema = z.object({
  id: z.string(),
  issue: z.string(),
  citation: z.string().nullable(),
  risk_level: z.string().nullable(),
  confidence_band: z.string().nullable(),
  verified: z.boolean(),
  work_item_id: z.string().nullable(),
  thread_id: z.string().nullable().optional(),
});
const FindingListSchema = z.object({
  findings: z.array(FindingListItemSchema),
});
export type LegalFindingListItem = z.infer<typeof FindingListItemSchema>;

export interface CreateFindingPayload {
  issue: string;
  summary?: string;
  citation?: string;
  code?: string;
  section_no?: string;
  basis?: string;
  confidence_band?: "low" | "medium" | "high";
  confidence_floor?: number;
  /** Prefixed work_item id (`wi_…`) of the matter to link the finding to on
   *  create — so it appears on that matter's findings list immediately. */
  work_item_id?: string;
  /** Prefixed thread id (`cth_…`) to attach the finding to a conversation —
   *  the search-bar "add to chat" gesture. Works before a matter exists; the
   *  server also links the matter when the thread has one. Takes precedence. */
  thread_id?: string;
}

class LegalFindingsApiClient extends BaseApiClient {
  /** Persist a finding as a `legal_findings` row. */
  async createFinding(payload: CreateFindingPayload, workspaceId: string) {
    const res = await this.request<unknown>("/legal/findings", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Jurisimus-Workspace-Id": workspaceId,
        "Idempotency-Key": freshIdempotencyKey(),
      },
    });
    return FindingEnvelopeSchema.parse(res).finding;
  }

  /** List findings (workspace-scoped via the auth principal), optionally
   *  filtered to one work_item (e.g. a matter). */
  async listFindings(opts?: {
    work_item_id?: string;
    thread_id?: string;
    limit?: number;
  }): Promise<LegalFindingListItem[]> {
    const params = new URLSearchParams();
    if (opts?.work_item_id) params.set("work_item_id", opts.work_item_id);
    if (opts?.thread_id) params.set("thread_id", opts.thread_id);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const q = params.toString();
    const res = await this.request<unknown>(
      `/legal/findings${q ? `?${q}` : ""}`,
    );
    return FindingListSchema.parse(res).findings;
  }

  /** The bridge: create a work_item from a finding and link them both ways. */
  async createWorkItemFromFinding(findingId: string, workspaceId: string) {
    const res = await this.request<unknown>(
      `/legal/findings/${encodeURIComponent(findingId)}/work_item`,
      {
        method: "POST",
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return BridgeSchema.parse(res);
  }
}

export const legalFindingsApi = new LegalFindingsApiClient();

/** Map a Tabular-Review finding to the platform create-finding payload. */
export function findingToPayload(
  documentName: string,
  f: LegalReviewFinding,
): CreateFindingPayload {
  return {
    issue: `${documentName} — ${f.citation}`,
    summary: f.text_th,
    citation: f.citation,
    code: "CCC",
    section_no: f.section_no,
    basis: f.basis,
    confidence_band: f.confidence.band,
    confidence_floor: f.confidence.floor_pct,
  };
}
