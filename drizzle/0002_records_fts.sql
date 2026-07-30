-- Keyword-search (FTS) GIN index over records (backend-swap: search).
-- The expression must stay byte-identical to `documentSql` in
-- src/server/search.ts, or the planner stops using the index.
CREATE INDEX "idx_records_fts" ON "records" USING gin (
  to_tsvector(
    'simple',
    coalesce("title", '') || ' ' || coalesce("subject", '') || ' ' || coalesce("description", '') || ' ' || "identifier"
  )
);
