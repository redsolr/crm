/**
 * Route handler factory for the global-search endpoint.
 *
 * Wire contract: `GET /api/search?q=...` returning the platform's
 * `HybridSearchResponseDto` — snake_case fields per
 * `platform/src/modules/search/search.response.dto.ts` (`results[]`
 * of `SearchHitResponseDto`, plus `query` / `total_results` /
 * `search_methods` / `rerank` / `timing`). Work-item hits ship
 * `source_type: "task"`, a `wi_`-style prefixed `source_id`, and the
 * indexer's camelCase `metadata` (`identifier` / `typeKey` / …) —
 * mirror that shape exactly here.
 *
 * Mount alongside `setupSalesHandlers` in specs; registration order
 * doesn't matter (different path spaces).
 */

import { Page } from "@playwright/test";
import { API_ROOT } from "./shared";

/** Wire shape of one hit — mirrors `SearchHitResponseDto`. */
export interface MockSearchHit {
  source_type: string;
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
  metadata: Record<string, unknown> | null;
}

/** Build a work-item (CRM record) hit with sensible keyword-lane defaults. */
export function makeWorkItemHit(overrides: {
  source_id: string;
  title: string;
  snippet?: string;
  typeKey: string;
  identifier?: string;
  parentId?: string;
  score?: number;
}): MockSearchHit {
  return {
    source_type: "task",
    source_id: overrides.source_id,
    title: overrides.title,
    snippet: overrides.snippet ?? `…<mark>${overrides.title}</mark>…`,
    score: overrides.score ?? 0.8,
    matched_by: ["fts"],
    fts_rank: overrides.score ?? 0.8,
    vector_score: null,
    graph_depth: null,
    community_rank: null,
    community_title: null,
    updated_at: "2026-07-18T00:00:00.000Z",
    metadata: {
      identifier: overrides.identifier ?? null,
      status: "active",
      folderId: null,
      assigneeId: null,
      typeKey: overrides.typeKey,
      ...(overrides.parentId !== undefined
        ? { parentId: overrides.parentId }
        : {}),
    },
  };
}

/**
 * Mock `GET /api/search*`. Queries containing "acme" return one
 * decoy company, the seeded company (pass `accountId` so opening it
 * lands on a work item the sales.handlers store can actually serve),
 * one deal, and one call note; anything else returns no hits.
 */
export async function setupGlobalSearchHandlers(
  page: Page,
  opts?: { accountId?: string; accountTitle?: string },
) {
  const accountId = opts?.accountId ?? "wi_acme";
  const accountTitle = opts?.accountTitle ?? "Acme Legal";

  const acmeResults: MockSearchHit[] = [
    makeWorkItemHit({
      source_id: "wi_acme_decoy",
      title: "Acme Holdings",
      typeKey: "account",
      identifier: "SALES-90",
      score: 0.9,
    }),
    makeWorkItemHit({
      source_id: accountId,
      title: accountTitle,
      typeKey: "account",
      identifier: "SALES-1",
      score: 0.85,
    }),
    makeWorkItemHit({
      source_id: "wi_acme_opp",
      title: "Acme — pilot",
      typeKey: "opportunity",
      identifier: "SALES-91",
      score: 0.7,
    }),
    makeWorkItemHit({
      source_id: "wi_acme_note",
      title: "Call with Acme GC",
      typeKey: "call_note",
      identifier: "SALES-92",
      parentId: "wi_acme_opp",
      score: 0.6,
    }),
  ];

  await page.route(`${API_ROOT}/search**`, async (route, request) => {
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }
    const url = new URL(request.url());
    const query = url.searchParams.get("q") ?? "";
    const sourceTypes = url.searchParams.getAll("source_types");

    let results = query.toLowerCase().includes("acme") ? acmeResults : [];
    if (sourceTypes.length > 0) {
      results = results.filter((r) => sourceTypes.includes(r.source_type));
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results,
        query,
        total_results: results.length,
        search_methods: ["fts"],
        rerank: null,
        timing: {
          fts_ms: 4,
          vector_ms: null,
          graph_ms: null,
          community_ms: null,
          total_ms: 5,
        },
      }),
    });
  });
}
