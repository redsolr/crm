"use client";

/**
 * `legalDocumentsApi` — the PLATFORM legal-documents surface
 * (`/v1/legal/documents/*`): paginated court-ready documents authored in
 * the in-app editor. Content is ProseMirror JSON (NOT markdown — redline
 * marks, page breaks, and typography don't survive markdown); the
 * platform validates it against the legal-document node vocabulary at
 * write time (unknown node types are a 422, never a silent drop).
 *
 * Export downloads are REAL files: native OOXML .docx (hard page breaks,
 * A4 section, footer page numbers, Word tracked changes) or a PDF
 * converted from that DOCX via Gotenberg. The exported file is the
 * product — the editor's pagination is only a preview.
 *
 * Platform module: `platform/src/modules/legal-documents/`.
 */
import { z } from "zod";
import { BaseApiClient, buildApiError } from "../api-client";
import { API_V1, API_VERSION } from "@/lib/api-base";
import { authService } from "../authTokenManager";
import { freshIdempotencyKey } from "../idempotency";

export const PageSettingsSchema = z.object({
  paper_size: z.enum(["A4", "Letter"]),
  margins_mm: z.object({
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
    left: z.number(),
  }),
  font_family: z.string(),
  font_size_pt: z.number(),
  page_numbers: z.object({
    enabled: z.boolean(),
    position: z.enum(["bottom-right", "bottom-center", "bottom-left"]),
  }),
});
export type PageSettings = z.infer<typeof PageSettingsSchema>;

export const LegalDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** ProseMirror doc JSON — handed to TipTap verbatim. */
  content: z.record(z.string(), z.unknown()),
  page_settings: PageSettingsSchema,
  matter_id: z.string().nullable(),
  version: z.number(),
  in_trash: z.boolean(),
  workspace_id: z.string(),
  owner_id: z.string(),
  owner_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LegalDocument = z.infer<typeof LegalDocumentSchema>;

const EnvelopeSchema = z.object({ document: LegalDocumentSchema });
const ListSchema = z.object({ data: z.array(LegalDocumentSchema) });

// ── Versioning (immutable v1/v2/v3 snapshots; no git) ──
export const VersionMetaSchema = z.object({
  document_id: z.string(),
  version_number: z.number(),
  source: z.string(),
  label: z.string().nullable(),
  title: z.string(),
  schema_version: z.number(),
  content_hash: z.string(),
  created_by: z.string(),
  created_by_name: z.string().nullable(),
  created_at: z.string(),
});
export type LegalDocumentVersionMeta = z.infer<typeof VersionMetaSchema>;

export const VersionFullSchema = VersionMetaSchema.extend({
  content: z.record(z.string(), z.unknown()),
  page_settings: PageSettingsSchema,
});
export type LegalDocumentVersionFull = z.infer<typeof VersionFullSchema>;

export const DocDiffSchema = z.object({
  from_version: z.number(),
  to_version: z.number().nullable(),
  changed: z.boolean(),
  added_blocks: z.number(),
  removed_blocks: z.number(),
  segments: z.array(
    z.object({ status: z.string(), text: z.string() }),
  ),
});
export type LegalDocumentDiff = z.infer<typeof DocDiffSchema>;

/** Inline tracked-changes redline — a single annotated ProseMirror doc. */
export const DocRedlineSchema = z.object({
  from_version: z.number(),
  to_version: z.number().nullable(),
  changed: z.boolean(),
  content: z.record(z.string(), z.unknown()),
});
export type LegalDocumentRedline = z.infer<typeof DocRedlineSchema>;

const VersionsListSchema = z.object({ data: z.array(VersionMetaSchema) });
const VersionEnvelopeSchema = z.object({ version: VersionFullSchema });
const RestoreSchema = z.object({
  document: LegalDocumentSchema,
  version: VersionFullSchema.nullable(),
});

export interface CreateLegalDocumentPayload {
  title?: string;
  content?: Record<string, unknown>;
  matter_id?: string;
  page_settings?: Partial<PageSettings>;
}

export interface UpdateLegalDocumentPayload {
  title?: string;
  content?: Record<string, unknown>;
  page_settings?: Partial<PageSettings>;
  in_trash?: boolean;
  /** Optimistic concurrency — platform returns 409 `version_conflict` on staleness. */
  expected_version?: number;
}

export type LegalDocumentExportFormat = "docx" | "pdf";

class LegalDocumentsApiClient extends BaseApiClient {
  private workspaceHeaders(workspaceId: string): Record<string, string> {
    return { "Jurisimus-Workspace-Id": workspaceId };
  }

  /** `?from=&to=` query for the version compare/redline endpoints. */
  private fromToQuery(from: number, to?: number): string {
    const q = new URLSearchParams({ from: String(from) });
    if (to !== undefined) q.set("to", String(to));
    return q.toString();
  }

  async create(
    payload: CreateLegalDocumentPayload,
    workspaceId: string,
  ): Promise<LegalDocument> {
    const res = await this.request<unknown>(`/legal/documents`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        ...this.workspaceHeaders(workspaceId),
        "Idempotency-Key": freshIdempotencyKey(),
      },
    });
    return EnvelopeSchema.parse(res).document;
  }

  async get(documentId: string, workspaceId: string): Promise<LegalDocument> {
    const res = await this.request<unknown>(
      `/legal/documents/${encodeURIComponent(documentId)}`,
      { headers: this.workspaceHeaders(workspaceId) },
    );
    return EnvelopeSchema.parse(res).document;
  }

  async list(
    workspaceId: string,
    matterId?: string,
  ): Promise<LegalDocument[]> {
    const query =
      matterId === undefined
        ? ""
        : `?matter_id=${encodeURIComponent(matterId)}`;
    const res = await this.request<unknown>(`/legal/documents${query}`, {
      headers: this.workspaceHeaders(workspaceId),
    });
    return ListSchema.parse(res).data;
  }

  async update(
    documentId: string,
    payload: UpdateLegalDocumentPayload,
    workspaceId: string,
  ): Promise<LegalDocument> {
    const res = await this.request<unknown>(
      `/legal/documents/${encodeURIComponent(documentId)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: {
          ...this.workspaceHeaders(workspaceId),
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return EnvelopeSchema.parse(res).document;
  }

  // ── Versions ──────────────────────────────────────────────────────────
  async listVersions(
    documentId: string,
    workspaceId: string,
  ): Promise<LegalDocumentVersionMeta[]> {
    const res = await this.request<unknown>(
      `/legal/documents/${encodeURIComponent(documentId)}/versions`,
      { headers: this.workspaceHeaders(workspaceId) },
    );
    return VersionsListSchema.parse(res).data;
  }

  async getVersion(
    documentId: string,
    versionNumber: number,
    workspaceId: string,
  ): Promise<LegalDocumentVersionFull> {
    const res = await this.request<unknown>(
      `/legal/documents/${encodeURIComponent(documentId)}/versions/${versionNumber}`,
      { headers: this.workspaceHeaders(workspaceId) },
    );
    return VersionEnvelopeSchema.parse(res).version;
  }

  async cutVersion(
    documentId: string,
    workspaceId: string,
    opts: { source?: "manual" | "sent" | "finalized"; label?: string } = {},
  ): Promise<LegalDocumentVersionFull> {
    const res = await this.request<unknown>(
      `/legal/documents/${encodeURIComponent(documentId)}/versions`,
      {
        method: "POST",
        body: JSON.stringify(opts),
        headers: {
          ...this.workspaceHeaders(workspaceId),
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return VersionEnvelopeSchema.parse(res).version;
  }

  async restoreVersion(
    documentId: string,
    versionNumber: number,
    workspaceId: string,
  ): Promise<z.infer<typeof RestoreSchema>> {
    const res = await this.request<unknown>(
      `/legal/documents/${encodeURIComponent(documentId)}/versions/${versionNumber}/restore`,
      {
        method: "POST",
        headers: {
          ...this.workspaceHeaders(workspaceId),
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return RestoreSchema.parse(res);
  }

  /** Structured delta — `to` omitted compares against the live head. */
  async compareVersions(
    documentId: string,
    from: number,
    workspaceId: string,
    to?: number,
  ): Promise<LegalDocumentDiff> {
    const res = await this.request<unknown>(
      `/legal/documents/${encodeURIComponent(documentId)}/versions/compare?${this.fromToQuery(from, to)}`,
      { headers: this.workspaceHeaders(workspaceId) },
    );
    return DocDiffSchema.parse(res);
  }

  /**
   * Inline tracked-changes redline — `to` omitted compares against the live
   * head. Returns one annotated ProseMirror doc with inline insertion/deletion
   * marks (rendered read-only by `LegalRedlineView`).
   */
  async redlineVersions(
    documentId: string,
    from: number,
    workspaceId: string,
    to?: number,
  ): Promise<LegalDocumentRedline> {
    const res = await this.request<unknown>(
      `/legal/documents/${encodeURIComponent(documentId)}/versions/redline?${this.fromToQuery(from, to)}`,
      { headers: this.workspaceHeaders(workspaceId) },
    );
    return DocRedlineSchema.parse(res);
  }

  async moveToTrash(documentId: string, workspaceId: string): Promise<void> {
    await this.request<unknown>(
      `/legal/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
        headers: {
          ...this.workspaceHeaders(workspaceId),
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
  }

  /**
   * Download the court-ready export. Raw fetch (not `request()`) because
   * the response is binary — mirrors `pagesApi.exportAllNotes()`. POST is
   * a mutating method on the wire, so the CSRF reflection header rides
   * along (the platform's CSRF middleware requires it on cookie-auth).
   */
  async exportFile(
    documentId: string,
    format: LegalDocumentExportFormat,
    workspaceId: string,
  ): Promise<Blob> {
    const csrf = authService.getCsrfToken();
    const response = await fetch(
      `${API_V1}/legal/documents/${encodeURIComponent(documentId)}/export`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Jurisimus-Version": API_VERSION,
          "Jurisimus-Workspace-Id": workspaceId,
          // Export is a read-shaped POST, but it rides the platform's
          // uniform write-idempotency contract like every other POST.
          "Idempotency-Key": freshIdempotencyKey(),
          ...(csrf === null ? {} : { "X-CSRF-Token": csrf }),
        },
        body: JSON.stringify({ format }),
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        authService.notifySessionExpired();
      }
      throw await buildApiError(response);
    }
    return response.blob();
  }
}

export const legalDocumentsApi = new LegalDocumentsApiClient();
