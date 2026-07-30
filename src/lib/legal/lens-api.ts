"use client";

/**
 * `lensApi` — the PLATFORM Lens surface (`/api/lens`), the matter-scoped tabular
 * document review (Legora "Tabular Review" / Harvey "Review Tables"). Rows are
 * documents, columns are extraction prompts, cells are the extracted value
 * (+ optional `source_excerpt`). Authenticated via `BaseApiClient`; workspace
 * context is sent explicitly as `Jurisimus-Workspace-Id` (mirroring
 * `findings-api.ts`) so a review lands in the workspace the user is viewing.
 *
 * Platform module: `platform/src/modules/work-items/` (lens tools).
 */
import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";

// ---------------------------------------------------------------------------
// Wire schemas (snake_case, prefixed IDs — mirror the platform DTOs exactly).
// ---------------------------------------------------------------------------

const LensReviewSchema = z.object({
  id: z.string(),
  matter_id: z.string(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LensReview = z.infer<typeof LensReviewSchema>;

const LensColumnSchema = z.object({
  id: z.string(),
  label: z.string(),
  prompt: z.string().nullable(),
  format: z.string(),
  position: z.number(),
});
export type LensColumn = z.infer<typeof LensColumnSchema>;

const LensRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  doc_type: z.string().nullable(),
  source_page_id: z.string().nullable(),
  position: z.number(),
});
export type LensRow = z.infer<typeof LensRowSchema>;

/**
 * Cell trust status (server-decided, never client-asserted):
 * `manual` (a human typed it) / `filled` (AI, excerpt verbatim-anchored in the
 * document) / `unanchored` (AI, anchor failed — verify manually) / `not_found`
 * (AI, the document doesn't contain the answer).
 */
const LensCellStatusSchema = z.enum([
  "manual",
  "filled",
  "unanchored",
  "not_found",
]);
export type LensCellStatus = z.infer<typeof LensCellStatusSchema>;

const LensCellSchema = z.object({
  id: z.string(),
  row_id: z.string(),
  column_id: z.string(),
  value: z.string(),
  source_excerpt: z.string().nullable(),
  status: LensCellStatusSchema,
  /** When a human verified this cell (null = unverified). Cleared by any value write. */
  verified_at: z.string().nullable(),
});
export type LensCell = z.infer<typeof LensCellSchema>;

const LensColumnTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  columns: z.array(
    z.object({ label: z.string(), prompt: z.string(), format: z.string() }),
  ),
  created_at: z.string(),
});
export type LensColumnTemplate = z.infer<typeof LensColumnTemplateSchema>;

const LensGridSchema = z.object({
  review: LensReviewSchema.nullable(),
  columns: z.array(LensColumnSchema),
  rows: z.array(LensRowSchema),
  cells: z.array(LensCellSchema),
});
export type LensGrid = z.infer<typeof LensGridSchema>;

const ReviewEnvelopeSchema = z.object({ review: LensReviewSchema });
const ColumnEnvelopeSchema = z.object({ column: LensColumnSchema });
const RowEnvelopeSchema = z.object({ row: LensRowSchema });
const CellEnvelopeSchema = z.object({ cell: LensCellSchema });

/**
 * Extract result: the cells written, the rows skipped (no linked document),
 * and the rows whose extraction FAILED (no cell written — values untouched).
 * Failures are loud, surfaced to the lawyer, never silently dropped.
 */
const LensExtractResultSchema = z.object({
  cells: z.array(LensCellSchema),
  skipped_row_ids: z.array(z.string()),
  failures: z.array(z.object({ row_id: z.string(), reason: z.string() })),
});
export type LensExtractResult = z.infer<typeof LensExtractResultSchema>;

/**
 * Async extraction job — the "tabular review at SCALE" lane. `POST …/extract_async`
 * enqueues a background job (202) and returns it `pending`/`running`; the FE polls
 * `GET /lens/extract_jobs/:id` for live counts until a terminal `completed` /
 * `failed`. `status='failed'` carries an `error_code` (e.g. `budget_exhausted`)
 * the FE surfaces loudly instead of a green "done" — no silent partial grid.
 */
export const LensExtractionJobStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
]);
export type LensExtractionJobStatus = z.infer<
  typeof LensExtractionJobStatusSchema
>;

const LensExtractionJobSchema = z.object({
  id: z.string(),
  review_id: z.string(),
  column_id: z.string(),
  status: LensExtractionJobStatusSchema,
  total_rows: z.number(),
  processed_rows: z.number(),
  cells_written: z.number(),
  skipped_rows: z.number(),
  failed_rows: z.number(),
  error_code: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
export type LensExtractionJob = z.infer<typeof LensExtractionJobSchema>;

const ColumnsEnvelopeSchema = z.object({ columns: z.array(LensColumnSchema) });
const TemplateEnvelopeSchema = z.object({
  column_template: LensColumnTemplateSchema,
});
const TemplateListSchema = z.object({
  column_templates: z.array(LensColumnTemplateSchema),
});

// ---------------------------------------------------------------------------
// Request payloads.
// ---------------------------------------------------------------------------

export type LensColumnFormat =
  | "text"
  | "date"
  | "number"
  | "currency"
  | "boolean";

export interface AddColumnPayload {
  label: string;
  prompt?: string;
  format?: LensColumnFormat;
}

export interface AddRowPayload {
  name: string;
  doc_type?: string;
  source_page_id?: string;
}

export interface UpsertCellPayload {
  row_id: string;
  column_id: string;
  value: string;
  source_excerpt?: string;
}

export interface CreateColumnTemplatePayload {
  name: string;
  columns: { label: string; prompt?: string; format?: LensColumnFormat }[];
}

class LensApiClient extends BaseApiClient {
  /** Fetch the whole grid for a matter — review + columns + rows + cells. */
  async getGrid(matterId: string): Promise<LensGrid> {
    const res = await this.request<unknown>(
      `/lens?matter_id=${encodeURIComponent(matterId)}`,
    );
    return LensGridSchema.parse(res);
  }

  /** Create (or return the existing) review for a matter. Idempotent on the BE. */
  async createReview(
    matterId: string,
    workspaceId: string,
    name?: string,
  ): Promise<LensReview> {
    const res = await this.request<unknown>("/lens/reviews", {
      method: "POST",
      body: JSON.stringify({ matter_id: matterId, ...(name ? { name } : {}) }),
      headers: {
        "Jurisimus-Workspace-Id": workspaceId,
        "Idempotency-Key": freshIdempotencyKey(),
      },
    });
    return ReviewEnvelopeSchema.parse(res).review;
  }

  /** Add an extraction column (prompt) to a review. */
  async addColumn(
    reviewId: string,
    body: AddColumnPayload,
    workspaceId: string,
  ): Promise<LensColumn> {
    const res = await this.request<unknown>(
      `/lens/reviews/${encodeURIComponent(reviewId)}/columns`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return ColumnEnvelopeSchema.parse(res).column;
  }

  /** Add a document row to a review. */
  async addRow(
    reviewId: string,
    body: AddRowPayload,
    workspaceId: string,
  ): Promise<LensRow> {
    const res = await this.request<unknown>(
      `/lens/reviews/${encodeURIComponent(reviewId)}/rows`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return RowEnvelopeSchema.parse(res).row;
  }

  /**
   * AI auto-fill: run a column's extraction prompt over every document row.
   * Returns the cells written (value + verbatim-anchored source excerpt +
   * trust status), the rows skipped (no linked document), and the rows whose
   * extraction failed (values untouched). A total failure (LLM down) is a 503.
   */
  async extractColumn(
    reviewId: string,
    columnId: string,
    workspaceId: string,
  ): Promise<LensExtractResult> {
    const res = await this.request<unknown>(
      `/lens/reviews/${encodeURIComponent(reviewId)}/columns/${encodeURIComponent(columnId)}/extract`,
      {
        method: "POST",
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return LensExtractResultSchema.parse(res);
  }

  /**
   * Async AI auto-fill — enqueue a background extraction job over every document
   * row and return it immediately (202). Use for any review; the worker meters
   * per row and the FE polls `getExtractJob` for live progress. A second
   * in-flight job for the same column is rejected (409).
   */
  async extractColumnAsync(
    reviewId: string,
    columnId: string,
    workspaceId: string,
  ): Promise<LensExtractionJob> {
    const res = await this.request<unknown>(
      `/lens/reviews/${encodeURIComponent(reviewId)}/columns/${encodeURIComponent(columnId)}/extract_async`,
      {
        method: "POST",
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return LensExtractionJobSchema.parse(res);
  }

  /** Poll an async extraction job's status + live progress counts. */
  async getExtractJob(
    jobId: string,
    workspaceId: string,
  ): Promise<LensExtractionJob> {
    const res = await this.request<unknown>(
      `/lens/extract_jobs/${encodeURIComponent(jobId)}`,
      { headers: { "Jurisimus-Workspace-Id": workspaceId } },
    );
    return LensExtractionJobSchema.parse(res);
  }

  /** Upsert a cell value (on row + column). */
  async upsertCell(
    reviewId: string,
    body: UpsertCellPayload,
    workspaceId: string,
  ): Promise<LensCell> {
    const res = await this.request<unknown>(
      `/lens/reviews/${encodeURIComponent(reviewId)}/cells`,
      {
        method: "PUT",
        body: JSON.stringify(body),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return CellEnvelopeSchema.parse(res).cell;
  }

  /** Mark a cell human-verified. The BE clears it on any later value write. */
  async verifyCell(cellId: string, workspaceId: string): Promise<LensCell> {
    const res = await this.request<unknown>(
      `/lens/cells/${encodeURIComponent(cellId)}/verify`,
      {
        method: "POST",
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return CellEnvelopeSchema.parse(res).cell;
  }

  /** Remove a cell's human-verification mark. */
  async unverifyCell(cellId: string, workspaceId: string): Promise<LensCell> {
    const res = await this.request<unknown>(
      `/lens/cells/${encodeURIComponent(cellId)}/verify`,
      {
        method: "DELETE",
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return CellEnvelopeSchema.parse(res).cell;
  }

  /**
   * Download the review grid as CSV (value + trust status + source per
   * column). Raw text fetch — `BaseApiClient.request` JSON-parses, and this
   * endpoint returns `text/csv`. Cookie auth rides on `credentials:include`;
   * GET is CSRF-exempt.
   */
  async exportReviewCsv(
    reviewId: string,
    workspaceId: string,
  ): Promise<string> {
    const res = await fetch(
      `${this.baseUrl}/lens/reviews/${encodeURIComponent(reviewId)}/export?format=csv`,
      {
        credentials: "include",
        headers: { "Jurisimus-Workspace-Id": workspaceId },
      },
    );
    if (!res.ok) throw new Error(`CSV export failed: HTTP ${res.status}`);
    return res.text();
  }

  /** The workspace's saved column sets (the firm's reusable review columns). */
  async listColumnTemplates(): Promise<LensColumnTemplate[]> {
    const res = await this.request<unknown>("/lens/column_templates");
    return TemplateListSchema.parse(res).column_templates;
  }

  /** Save a reusable column set (e.g. the firm's standard NDA review). */
  async createColumnTemplate(
    body: CreateColumnTemplatePayload,
    workspaceId: string,
  ): Promise<LensColumnTemplate> {
    const res = await this.request<unknown>("/lens/column_templates", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Jurisimus-Workspace-Id": workspaceId,
        "Idempotency-Key": freshIdempotencyKey(),
      },
    });
    return TemplateEnvelopeSchema.parse(res).column_template;
  }

  async deleteColumnTemplate(id: string, workspaceId: string): Promise<void> {
    await this.request<void>(
      `/lens/column_templates/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
  }

  /** Append a saved column set's columns to a review. */
  async applyColumnTemplate(
    reviewId: string,
    templateId: string,
    workspaceId: string,
  ): Promise<LensColumn[]> {
    const res = await this.request<unknown>(
      `/lens/reviews/${encodeURIComponent(reviewId)}/apply_column_template`,
      {
        method: "POST",
        body: JSON.stringify({ column_template_id: templateId }),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return ColumnsEnvelopeSchema.parse(res).columns;
  }

  /** Delete a column (and its cells, server-side). */
  async deleteColumn(id: string, workspaceId: string): Promise<void> {
    await this.request<void>(`/lens/columns/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        "Jurisimus-Workspace-Id": workspaceId,
        "Idempotency-Key": freshIdempotencyKey(),
      },
    });
  }

  /** Delete a row (and its cells, server-side). */
  async deleteRow(id: string, workspaceId: string): Promise<void> {
    await this.request<void>(`/lens/rows/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        "Jurisimus-Workspace-Id": workspaceId,
        "Idempotency-Key": freshIdempotencyKey(),
      },
    });
  }
}

export const lensApi = new LensApiClient();
