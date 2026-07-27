"use client";

/**
 * `legalIngestionApi` — the PLATFORM document-ingestion surface
 * (`POST /v1/legal/matters/:id/ingest_document`). The file is already in S3
 * (presign → PUT); this finalizes it: the source is kept (an attachment), its
 * digital text layer is extracted (no OCR), and a matter page + per-page
 * provenance are created. A scanned/image PDF (no text layer) is refused
 * server-side with `422 document_no_text_layer`. Workspace context is sent as
 * `Jurisimus-Workspace-Id`.
 *
 * Platform module: `platform/src/modules/legal/` (`DocumentIngestionService`).
 */
import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";

const IngestedPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  matter_id: z.string().nullable(),
});

const IngestResultSchema = z.object({
  page: IngestedPageSchema,
  source: z.object({
    attachment_id: z.string(),
    kind: z.enum(["pdf", "docx"]),
    page_count: z.number(),
    char_count: z.number(),
  }),
});
export type IngestDocumentResult = z.infer<typeof IngestResultSchema>;

export interface IngestDocumentPayload {
  s3_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

class LegalIngestionApiClient extends BaseApiClient {
  /** Finalize an uploaded PDF/Word file into a matter document (prefixed `wi_…`). */
  async ingestDocument(
    matterId: string,
    payload: IngestDocumentPayload,
    workspaceId: string,
  ): Promise<IngestDocumentResult> {
    const res = await this.request<unknown>(
      `/legal/matters/${encodeURIComponent(matterId)}/ingest_document`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return IngestResultSchema.parse(res);
  }
}

export const legalIngestionApi = new LegalIngestionApiClient();

/** Browser MIME types we can ingest (digital text layer only). */
export const INGESTABLE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export function isIngestableType(mime: string): boolean {
  return (INGESTABLE_MIME_TYPES as readonly string[]).includes(mime);
}
