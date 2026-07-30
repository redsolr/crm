"use client";

/**
 * `legalApi` — client for the Legal Library + intelligent legal search.
 *
 * Talks the platform's eventual `/api/legal/*` contract (snake_case wire),
 * so adopting the platform module is a base-URL swap: today it points at
 * the proven sandbox engine (`D:\Jurisimus\crawler`, the Hono dev API on
 * :8787); flip `NEXT_PUBLIC_LEGAL_API_URL` to the platform host and the
 * same Zod shapes hold. Design: platform `docs/platform/legal-search-2026-05-31.md`.
 *
 * Trust posture mirrors the engine: results carry a *basis*
 * (`cited-in-passage` deterministic / `keyword` lexical / `semantic-match`
 * RAG) and a conservative `confidence` floor — never "trust me bro". The UI
 * renders the basis + a calibrated band, not a raw reranker score.
 */
import { z } from "zod";

const LEGAL_API_BASE =
  process.env.NEXT_PUBLIC_LEGAL_API_URL || "http://localhost:8787";

// ---------------------------------------------------------------------------
// Wire schemas (snake_case — mirror the sandbox `src/server/api.ts` DTOs).
// ---------------------------------------------------------------------------

export const LegalCodeSchema = z.object({
  code: z.string(),
  name_th: z.string().nullable(),
  name_en: z.string().nullable(),
  section_count: z.number(),
});
export type LegalCode = z.infer<typeof LegalCodeSchema>;

export const LegalSectionSummarySchema = z.object({
  code: z.string(),
  section_no: z.string(),
  book: z.string().nullable(),
  title: z.string().nullable(),
  chapter: z.string().nullable(),
  preview_th: z.string(),
});
export type LegalSectionSummary = z.infer<typeof LegalSectionSummarySchema>;

const LegalSectionsResponseSchema = z.object({
  code: z.string(),
  sections: z.array(LegalSectionSummarySchema),
});

export const LegalCaseRefSchema = z.object({
  docid: z.string(),
  citation: z.string(),
  source_url: z.string().nullable(),
  raw: z.string().nullable(),
});
export type LegalCaseRef = z.infer<typeof LegalCaseRefSchema>;

export const LegalSectionDetailSchema = z.object({
  code: z.string(),
  section_no: z.string(),
  book: z.string().nullable(),
  title: z.string().nullable(),
  chapter: z.string().nullable(),
  text_th: z.string().nullable(),
  text_en: z.string().nullable(),
  source_url: z.string().nullable(),
  cross_refs: z.array(z.string()),
  cases: z.array(LegalCaseRefSchema),
});
export type LegalSectionDetail = z.infer<typeof LegalSectionDetailSchema>;

/** Match basis — drives the trust badge. Order = descending authority. */
export const LegalBasisSchema = z.enum([
  "cited-in-passage",
  "keyword",
  "semantic-match",
]);
export type LegalBasis = z.infer<typeof LegalBasisSchema>;

/**
 * Calibrated confidence — the engine now sends a banded object, not a bare
 * percentage: an action ("what to do"), a conservative lower-bound floor
 * (under-promises by construction), and a ready-to-render band + label. The
 * UI shows the band/label directly rather than re-deriving from a number.
 * (camelCase mirrors the engine's `Confidence` interface, serialized raw.)
 */
export const LegalConfidenceSchema = z.object({
  band: z.enum(["high", "medium", "low"]),
  action: z.string(),
  floor_pct: z.number(),
  label: z.string(),
});
export type LegalConfidence = z.infer<typeof LegalConfidenceSchema>;

/** A related CCC section reached via the corpus cross-reference graph (§→§). */
export const LegalRelatedSectionSchema = z.object({
  section_no: z.string(),
  citation: z.string(),
});
export type LegalRelatedSection = z.infer<typeof LegalRelatedSectionSchema>;

/** A Deka (Supreme Court) judgment that cites the hit section (case→§). */
export const LegalCitedCaseSchema = z.object({
  citation: z.string(),
  year: z.number().nullable(),
});
export type LegalCitedCase = z.infer<typeof LegalCitedCaseSchema>;

export const LegalSearchHitSchema = z.object({
  section_no: z.string(),
  citation: z.string(),
  preview_th: z.string(),
  basis: LegalBasisSchema,
  confidence: LegalConfidenceSchema,
  // Graph-expansion — present only on the comprehensive tier, and only when the
  // section actually has cross-refs / citing cases (the platform omits empty
  // arrays). The sandbox engine doesn't send these yet, so both are optional.
  related_sections: z.array(LegalRelatedSectionSchema).optional(),
  cited_cases: z.array(LegalCitedCaseSchema).optional(),
});
export type LegalSearchHit = z.infer<typeof LegalSearchHitSchema>;

const LegalSearchResponseSchema = z.object({
  query: z.string(),
  abstained: z.boolean().optional(),
  hits: z.array(LegalSearchHitSchema),
});
export type LegalSearchResponse = z.infer<typeof LegalSearchResponseSchema>;

// --- Tabular Review (matter document grid) ------------------------------------

export const LegalReviewFindingSchema = z.object({
  section_no: z.string(),
  citation: z.string(),
  basis: LegalBasisSchema,
  verified: z.boolean(),
  confidence: LegalConfidenceSchema,
  text_th: z.string(),
  source_url: z.string().nullable(),
});
export type LegalReviewFinding = z.infer<typeof LegalReviewFindingSchema>;

export const LegalReviewRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  abstained: z.boolean(),
  findings: z.array(LegalReviewFindingSchema),
});
export type LegalReviewRow = z.infer<typeof LegalReviewRowSchema>;

const LegalReviewResponseSchema = z.object({ rows: z.array(LegalReviewRowSchema) });
export type LegalReviewResponse = z.infer<typeof LegalReviewResponseSchema>;

export interface LegalReviewDocument {
  id?: string;
  name: string;
  text: string;
}

export type LegalRiskProfile = "permissive" | "standard" | "conservative";

// --- Custom columns + matter chat (generative — AI · unverified) --------------

export type LegalColumnFormat = "text" | "number" | "date" | "boolean" | "list";

const LegalExtractColumnResponseSchema = z.object({
  values: z.array(z.object({ id: z.string(), value: z.string() })),
});
export type LegalColumnValue = { id: string; value: string };

const LegalAskResponseSchema = z.object({
  question: z.string(),
  answer: z.string(),
  used: z.array(z.string()),
});
export type LegalAskResponse = z.infer<typeof LegalAskResponseSchema>;

// ---------------------------------------------------------------------------
// Fetch helpers (no auth — the sandbox is open; the platform module will
// inherit `BaseApiClient` headers once the base URL flips).
// ---------------------------------------------------------------------------

async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${LEGAL_API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`legal API ${path} → HTTP ${res.status}`);
  }
  return schema.parse(await res.json());
}

async function postJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${LEGAL_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`legal API ${path} → HTTP ${res.status}`);
  }
  return schema.parse(await res.json());
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const legalApi = {
  /** Codes in the corpus (Library nav). */
  codes: () => getJson("/api/legal/codes", z.array(LegalCodeSchema)),

  /** Browse / filter sections in a code. */
  sections: (opts: { code?: string; q?: string; limit?: number; offset?: number } = {}) =>
    getJson(
      `/api/legal/sections${qs({ code: opts.code, q: opts.q, limit: opts.limit, offset: opts.offset })}`,
      LegalSectionsResponseSchema,
    ).then((r) => r.sections),

  /** One section: authoritative Thai + English gloss + citing cases + cross-refs. */
  section: (code: string, no: string) =>
    getJson(
      `/api/legal/sections/${encodeURIComponent(code)}/${encodeURIComponent(no)}`,
      LegalSectionDetailSchema,
    ),

  /** Intelligent search (exact anchor + lexical + semantic, banded by basis). */
  search: (q: string, opts: { limit?: number } = {}) =>
    getJson(
      `/api/legal/sections/search${qs({ q, limit: opts.limit })}`,
      LegalSearchResponseSchema,
    ),

  /** Tabular Review: a set of documents → a grid of findings (one group per doc). */
  review: (documents: LegalReviewDocument[], riskProfile?: LegalRiskProfile) =>
    postJson(
      "/api/legal/review",
      { documents, risk_profile: riskProfile },
      LegalReviewResponseSchema,
    ).then((r) => r.rows),

  /**
   * Custom column: run a user-defined prompt against each document, grounded in
   * its text (abstains with "N/A" rather than guess). Output is AI · unverified.
   */
  extractColumn: (
    documents: LegalReviewDocument[],
    column: { label: string; prompt: string; format: LegalColumnFormat },
  ) =>
    postJson(
      "/api/legal/extract-column",
      { documents, label: column.label, prompt: column.prompt, format: column.format },
      LegalExtractColumnResponseSchema,
    ).then((r) => r.values),

  /** Matter chat: a cross-document question answered over the supplied docs. */
  ask: (question: string, documents: LegalReviewDocument[]) =>
    postJson("/api/legal/ask", { question, documents }, LegalAskResponseSchema),
};

// ---------------------------------------------------------------------------
// Presentation helpers (shared by the Library view + the global search bar).
// ---------------------------------------------------------------------------

/** A conservative, lawyer-honest label for a match basis. */
export const BASIS_META: Record<
  LegalBasis,
  { label: string; tone: "exact" | "lexical" | "semantic" }
> = {
  "cited-in-passage": { label: "Exact section", tone: "exact" },
  keyword: { label: "Keyword match", tone: "lexical" },
  "semantic-match": { label: "Suggested", tone: "semantic" },
};

/**
 * A finding warrants a human's eyes before it's relied on: anything not pinned
 * to an exact citation, or any match below the high-confidence band. Exact
 * anchors at high confidence are the only "green" cells.
 */
export function findingNeedsReview(f: LegalReviewFinding): boolean {
  return f.basis !== "cited-in-passage" || f.confidence.floor_pct < 80;
}

/**
 * Row-level flag severity for the review overview. `high` = no authority found
 * at all (abstained); `medium` = at least one finding needs a closer look;
 * `none` = every finding is an exact, high-confidence anchor.
 */
export function rowFlagSeverity(row: LegalReviewRow): "high" | "medium" | "none" {
  if (row.abstained || row.findings.length === 0) return "high";
  return row.findings.some(findingNeedsReview) ? "medium" : "none";
}
