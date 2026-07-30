import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api-error";
import {
  MAX_SEARCH_LIMIT,
  buildTsquery,
  searchRecords,
  type SearchHitPayload,
} from "@/server/search";

/**
 * `GET /v1/search` — keyword (FTS) search over CRM records, local
 * replacement for the platform's hybrid-search endpoint. The CRM
 * client hard-codes `enable_vector=false&enable_graph=false`; those
 * params (and the paid semantic lanes behind them) don't exist here,
 * so they're accepted and ignored. Only work items exist in this
 * backend — a `source_types` filter that excludes `task` short-circuits
 * to zero hits.
 */

function emptyResponse(query: string, totalMs: number): NextResponse {
  return NextResponse.json({
    results: [] as SearchHitPayload[],
    query,
    total_results: 0,
    search_methods: ["fts"],
    rerank: null,
    timing: {
      fts_ms: null,
      vector_ms: null,
      graph_ms: null,
      community_ms: null,
      total_ms: totalMs,
    },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const started = Date.now();
  const params = request.nextUrl.searchParams;

  const query = params.get("q");
  if (query === null || query.trim() === "") {
    return apiError(422, "validation_failed", "q is required");
  }

  let limit = 20;
  const rawLimit = params.get("limit");
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
      return apiError(
        422,
        "validation_failed",
        `limit must be an integer between 1 and ${MAX_SEARCH_LIMIT}`,
      );
    }
  }

  const sourceTypes = params.getAll("source_types");
  if (sourceTypes.length > 0 && !sourceTypes.includes("task")) {
    return emptyResponse(query, Date.now() - started);
  }

  const tsquery = buildTsquery(query);
  if (tsquery === null) {
    return emptyResponse(query, Date.now() - started);
  }

  const ftsStarted = Date.now();
  const results = await searchRecords(tsquery, limit);
  const ftsMs = Date.now() - ftsStarted;

  return NextResponse.json({
    results,
    query,
    total_results: results.length,
    search_methods: ["fts"],
    rerank: null,
    timing: {
      fts_ms: ftsMs,
      vector_ms: null,
      graph_ms: null,
      community_ms: null,
      total_ms: Date.now() - started,
    },
  });
}
