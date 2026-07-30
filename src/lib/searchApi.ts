import { BaseApiClient } from "./api-client";

/**
 * Global-search client — keyword (FTS-only) lane.
 *
 * Wire contract: `GET /api/search?q=...` returning the platform's
 * `HybridSearchResponseDto` (snake_case per platform convention — see
 * `platform/src/modules/search/search.response.dto.ts`, the single
 * source of truth for these shapes).
 *
 * The CRM navbar/dialog search ALWAYS runs keyword-only:
 * `enable_vector=false&enable_graph=false` is hard-coded because the
 * semantic lanes (query-planner LLM, embedding, rerank) cost real
 * model spend per keystroke, and the navbar-keyword-only decision is
 * locked platform-wide. Semantic search stays available to agent/API
 * callers that opt in — never from this client.
 */

/** Single hit — mirrors `SearchHitResponseDto`. */
export interface SearchHit {
  source_type: string;
  /** Prefixed id (`wi_...` for work items); polymorphic on `source_type`. */
  source_id: string;
  title: string | null;
  snippet: string | null;
  score: number;
  matched_by: string[];
  fts_rank: number | null;
  vector_score: number | null;
  graph_depth: number | null;
  community_rank: number | null;
  community_title: string | null;
  updated_at: string | null;
  /**
   * Opaque passthrough from the indexer. Work-item hits carry
   * `{ identifier, status, folderId, assigneeId, typeKey, updatedAt }`
   * (camelCase — indexed shape, not DTO-normalized) per
   * `platform/src/modules/search/search-indexer.service.ts#indexTask`.
   */
  metadata: Record<string, unknown> | null;
}

/** Mirrors `HybridSearchResponseDto`. */
export interface KeywordSearchResponse {
  results: SearchHit[];
  query: string;
  total_results: number;
  search_methods: string[];
  rerank: {
    applied: boolean;
    reason: string | null;
    pool_size: number | null;
    rerank_ms: number | null;
  } | null;
  timing: {
    fts_ms: number | null;
    vector_ms: number | null;
    graph_ms: number | null;
    community_ms: number | null;
    total_ms: number;
  };
}

class SearchApiClient extends BaseApiClient {
  /**
   * Keyword-only search. Workspace scoping is automatic — the
   * `Jurisimus-Workspace-Id` header is stamped by `BaseApiClient`.
   */
  async keywordSearch(
    query: string,
    opts?: {
      limit?: number;
      /**
       * Restrict to these source types (repeated `source_types` query
       * params) so the backend narrows to specific primitives.
       */
      sourceTypes?: string[];
    },
  ): Promise<KeywordSearchResponse> {
    const params = new URLSearchParams();
    params.set("q", query);
    if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
    for (const type of opts?.sourceTypes ?? []) {
      params.append("source_types", type);
    }
    // Hard-coded: the CRM search NEVER enables the paid semantic lanes.
    params.set("enable_vector", "false");
    params.set("enable_graph", "false");
    return this.request<KeywordSearchResponse>(`/search?${params.toString()}`);
  }
}

export const searchApi = new SearchApiClient();
