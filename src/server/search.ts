import { desc, sql } from "drizzle-orm";
import { db, records, recordTypes, workflowStages } from "@/db";

/**
 * Keyword search over CRM records (backend-swap step: search) — plain
 * Postgres FTS replacing the platform's hybrid-search keyword lane.
 *
 * Serves the exact wire shape `src/lib/searchApi.ts` consumes
 * (`HybridSearchResponseDto`): work-item hits with `source_type:
 * "task"`, the indexer's camelCase `metadata`, and the semantic-lane
 * fields pinned null — the CRM never enables vector/graph search. The
 * tsvector expression here must stay byte-identical to the GIN
 * expression index in `drizzle/0002_records_fts.sql` or the planner
 * falls back to a sequential scan.
 */

/** Result budget cap — the dialog asks for 20. */
export const MAX_SEARCH_LIMIT = 50;

/** Bound tsquery cost on pathological input. */
const MAX_QUERY_TOKENS = 8;

/**
 * Build a prefix-matching tsquery string (`acme & pil:*`) from user
 * input. Tokens are reduced to letters/digits so no to_tsquery syntax
 * (`& | ! ( ) : * '`) survives; the last token gets `:*` so
 * search-as-you-type matches mid-word. Null = nothing searchable.
 */
export function buildTsquery(query: string): string | null {
  const tokens = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, MAX_QUERY_TOKENS);
  if (tokens.length === 0) return null;
  return tokens.map((t, i) => (i === tokens.length - 1 ? `${t}:*` : t)).join(" & ");
}

/** Wire shape of one hit — mirrors `SearchHit` in `src/lib/searchApi.ts`. */
export interface SearchHitPayload {
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

// The document expression the GIN index covers (see module docblock).
const documentSql = sql`coalesce(${records.title}, '') || ' ' || coalesce(${records.subject}, '') || ' ' || coalesce(${records.description}, '') || ' ' || ${records.identifier}`;
const vectorSql = sql`to_tsvector('simple', ${documentSql})`;

export async function searchRecords(
  tsquery: string,
  limit: number,
): Promise<SearchHitPayload[]> {
  const tsquerySql = sql`to_tsquery('simple', ${tsquery})`;
  const rows = await db
    .select({
      record: records,
      state: workflowStages,
      type: recordTypes,
      rank: sql<number>`ts_rank(${vectorSql}, ${tsquerySql})`,
      snippet: sql<string>`ts_headline('simple', ${documentSql}, ${tsquerySql}, 'StartSel=<mark>, StopSel=</mark>, MaxWords=18, MinWords=6, MaxFragments=1')`,
    })
    .from(records)
    .innerJoin(workflowStages, sql`${records.stateId} = ${workflowStages.id}`)
    .innerJoin(recordTypes, sql`${records.typeId} = ${recordTypes.id}`)
    .where(sql`${vectorSql} @@ ${tsquerySql}`)
    .orderBy(
      desc(sql`ts_rank(${vectorSql}, ${tsquerySql})`),
      desc(records.updatedAt),
    )
    .limit(limit);

  return rows.map((row) => ({
    source_type: "task",
    source_id: row.record.id,
    title: row.record.title,
    snippet: row.snippet,
    score: row.rank,
    matched_by: ["fts"],
    fts_rank: row.rank,
    vector_score: null,
    graph_depth: null,
    community_rank: null,
    community_title: null,
    updated_at: row.record.updatedAt.toISOString(),
    // Indexed shape (camelCase), per the platform indexer's `indexTask`
    // — `search-results.ts` reads `typeKey` / `identifier` / `parentId`.
    metadata: {
      identifier: row.record.identifier,
      status: row.state.key,
      folderId: null,
      assigneeId: row.record.assigneeId,
      typeKey: row.type.key,
      updatedAt: row.record.updatedAt.toISOString(),
      ...(row.record.parentId !== null ? { parentId: row.record.parentId } : {}),
    },
  }));
}
